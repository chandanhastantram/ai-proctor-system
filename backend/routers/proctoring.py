"""Proctoring WebSocket — real-time violation streaming (v2).

Enhancements over v1:
  - Ping/pong heartbeat: frontend sends {"event": "ping"}, server responds {"status": "pong"}
  - Warning-tier responses: {"status": "warning", "warning_count": N, "warnings_until_violation": M}
  - Status query: {"event": "status"} → returns current tracker summary
  - Cleaned up disconnection handling
"""

from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from database import async_session
from models import InterviewSession, Violation, SessionStatus
from services.proctoring_service import (
    process_event,
    clear_tracker,
    get_session_summary,
    SEVERITY_PENALTIES,
    TERMINATE_THRESHOLD,
)

router = APIRouter(tags=["proctoring"])


@router.websocket("/ws/proctor/{session_id}")
async def proctoring_ws(websocket: WebSocket, session_id: UUID):
    """WebSocket endpoint for real-time proctoring.

    Messages the frontend can send:
        {"event": "ping"}
            → {"status": "pong"}

        {"event": "status"}
            → {"status": "tracker_summary", "summary": {...}}

        {"event": "tab_switch"|"no_face"|"multiple_faces"|..., "data": {"detail": "..."}}
            → {"status": "warning", "warning_count": N, "warnings_until_violation": M}
            → {"status": "violation_logged", "violation_type": "...", "integrity_score": 85.0, ...}
            → {"status": "terminated", "integrity_score": 15.0}
            → {"status": "ignored", "reason": "cooldown_active"|"unknown_event"}
    """
    await websocket.accept()

    # ── Validate session ──────────────────────────────────────────────────────
    async with async_session() as db:
        result = await db.execute(
            select(InterviewSession).where(InterviewSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            await websocket.send_json({"status": "error", "message": "Session not found."})
            await websocket.close(code=4004)
            return
        if session.status != SessionStatus.ACTIVE.value:
            await websocket.send_json({"status": "error", "message": "Session is not active."})
            await websocket.close(code=4001)
            return

    session_id_str = str(session_id)

    try:
        while True:
            message    = await websocket.receive_json()
            event_type = message.get("event", "")
            event_data = message.get("data", {})

            # ── Heartbeat ─────────────────────────────────────────────────────
            if event_type == "ping":
                await websocket.send_json({"status": "pong"})
                continue

            # ── Status query ──────────────────────────────────────────────────
            if event_type == "status":
                summary = get_session_summary(session_id_str) or {}
                await websocket.send_json({"status": "tracker_summary", "summary": summary})
                continue

            # ── Process event through detection service ────────────────────────
            result = process_event(session_id_str, event_type, event_data)

            if result is None:
                # Suppressed by cooldown or unknown event
                reason = "cooldown_active" if event_type in (
                    "tab_switch", "no_face", "multiple_faces",
                    "looking_away", "audio_detected", "face_mismatch",
                    "copy_paste", "window_blur",
                ) else "unknown_event"
                await websocket.send_json({"status": "ignored", "reason": reason})
                continue

            # ── Warning tier (no DB write yet) ────────────────────────────────
            if result.get("status") == "warning":
                await websocket.send_json({
                    "status": "warning",
                    "event_type": result["event_type"],
                    "warning_count": result["warning_count"],
                    "warnings_until_violation": result["warnings_until_violation"],
                    "message": f"Warning {result['warning_count']}: {result['event_type'].replace('_', ' ')} detected.",
                })
                continue

            # ── Real violation — log to database ──────────────────────────────
            async with async_session() as db:
                sess_result = await db.execute(
                    select(InterviewSession).where(InterviewSession.id == session_id)
                )
                session = sess_result.scalar_one_or_none()

                if not session or session.status != SessionStatus.ACTIVE.value:
                    await websocket.send_json({
                        "status": "error",
                        "message": "Session is no longer active.",
                    })
                    break

                # Create violation record
                violation = Violation(
                    session_id=session_id,
                    violation_type=result["violation_type"],
                    description=result["description"],
                    severity=result["severity"],
                )
                db.add(violation)

                # Deduct integrity points
                penalty = result["penalty"]
                session.integrity_score = max(0.0, session.integrity_score - penalty)

                # Check auto-terminate
                auto_terminated = False
                if session.integrity_score <= TERMINATE_THRESHOLD:
                    session.status = SessionStatus.TERMINATED.value
                    session.ended_at = datetime.now(timezone.utc)
                    auto_terminated = True
                    clear_tracker(session_id_str)

                await db.flush()
                await db.refresh(violation)

                if auto_terminated:
                    await websocket.send_json({
                        "status": "terminated",
                        "message":  "Session auto-terminated: integrity too low.",
                        "integrity_score":   session.integrity_score,
                        "violation_type":    result["violation_type"],
                        "total_violations":  result["total_violations"],
                    })
                    await websocket.close(code=4002)
                    return

                await websocket.send_json({
                    "status":          "violation_logged",
                    "violation_type":  result["violation_type"],
                    "severity":        result["severity"],
                    "integrity_score": session.integrity_score,
                    "event_count":     result["event_count"],
                    "total_violations":result["total_violations"],
                    "description":     result["description"],
                })

    except WebSocketDisconnect:
        clear_tracker(session_id_str)
    except Exception as exc:
        clear_tracker(session_id_str)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass   # already closed
