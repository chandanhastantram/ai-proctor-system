"""Violations router — log and retrieve proctoring violations."""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Violation, InterviewSession, SessionStatus
from schemas import ViolationCreate, ViolationResponse

router = APIRouter(prefix="/api/violations", tags=["violations"])

# Integrity score penalties per violation type
SEVERITY_PENALTIES = {
    1: 3.0,   # Low severity: -3 points
    2: 7.0,   # Medium severity: -7 points
    3: 15.0,  # High severity: -15 points
}

# Auto-terminate threshold
TERMINATE_THRESHOLD = 20.0  # If integrity drops below 20%, auto-terminate


@router.post("/", response_model=ViolationResponse)
async def log_violation(data: ViolationCreate, db: AsyncSession = Depends(get_db)):
    """Log a proctoring violation and update session integrity score."""
    # Verify session
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == data.session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.status not in (SessionStatus.ACTIVE.value, SessionStatus.PENDING.value):
        raise HTTPException(status_code=400, detail="Session is not active.")

    violation_type_val = data.violation_type.value if hasattr(data.violation_type, 'value') else data.violation_type
    # Create violation
    violation = Violation(
        session_id=data.session_id,
        violation_type=violation_type_val,
        description=data.description,
        severity=data.severity,
        screenshot_url=data.screenshot_url,
    )
    db.add(violation)

    # Update integrity score
    penalty = SEVERITY_PENALTIES.get(data.severity, 5.0)
    session.integrity_score = max(0, session.integrity_score - penalty)

    # Auto-terminate if too many violations
    auto_terminated = False
    if session.integrity_score <= TERMINATE_THRESHOLD:
        session.status = SessionStatus.TERMINATED.value
        from datetime import datetime, timezone
        session.ended_at = datetime.now(timezone.utc)
        auto_terminated = True

    await db.flush()
    await db.refresh(violation)

    return violation


@router.get("/session/{session_id}", response_model=list[ViolationResponse])
async def get_session_violations(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get all violations for a session."""
    result = await db.execute(
        select(Violation)
        .where(Violation.session_id == session_id)
        .order_by(Violation.timestamp)
    )
    return result.scalars().all()


@router.get("/session/{session_id}/summary")
async def get_violation_summary(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a summary of violations for a session."""
    result = await db.execute(
        select(Violation).where(Violation.session_id == session_id)
    )
    violations = result.scalars().all()

    breakdown = {}
    for v in violations:
        vtype = v.violation_type.value
        if vtype not in breakdown:
            breakdown[vtype] = {"count": 0, "total_severity": 0}
        breakdown[vtype]["count"] += 1
        breakdown[vtype]["total_severity"] += v.severity

    # Get current integrity score
    sess_result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == session_id)
    )
    session = sess_result.scalar_one_or_none()

    return {
        "session_id": str(session_id),
        "total_violations": len(violations),
        "integrity_score": session.integrity_score if session else 0,
        "breakdown": breakdown,
        "is_terminated": session.status == SessionStatus.TERMINATED.value if session else False,
    }
