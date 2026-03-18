"""Reports router — generate and retrieve session reports."""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import InterviewSession, Answer, Violation, Candidate, Question, SessionStatus
from schemas import SessionReport, SessionResponse, CandidateResponse, AnswerResponse, ViolationResponse
from services.report_generator import generate_report

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/dashboard")
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    """Get aggregate dashboard statistics across all sessions."""
    # Total sessions by status
    status_counts = await db.execute(
        select(
            InterviewSession.status,
            func.count(InterviewSession.id),
        ).group_by(InterviewSession.status)
    )
    status_map = {row[0]: row[1] for row in status_counts.all()}

    total_sessions = sum(status_map.values())
    active_sessions = status_map.get(SessionStatus.ACTIVE.value, 0)
    completed_sessions = status_map.get(SessionStatus.COMPLETED.value, 0)
    terminated_sessions = status_map.get(SessionStatus.TERMINATED.value, 0)

    # Average scores (only for completed/terminated sessions)
    finished_statuses = [SessionStatus.COMPLETED.value, SessionStatus.TERMINATED.value]
    score_stats = await db.execute(
        select(
            func.avg(InterviewSession.total_score),
            func.avg(InterviewSession.integrity_score),
            func.max(InterviewSession.total_score),
            func.min(InterviewSession.integrity_score),
        ).where(InterviewSession.status.in_(finished_statuses))
    )
    row = score_stats.one()
    avg_knowledge = round(row[0] or 0, 1)
    avg_integrity = round(row[1] or 0, 1)
    highest_score = round(row[2] or 0, 1)
    lowest_integrity = round(row[3] or 0, 1)

    # Pass/fail counts (integrity >= 50 and score >= 50 = pass)
    pass_result = await db.execute(
        select(func.count()).select_from(InterviewSession).where(
            InterviewSession.status.in_(finished_statuses),
            InterviewSession.integrity_score >= 50,
            InterviewSession.total_score >= 50,
        )
    )
    pass_count_val = pass_result.scalar()
    fail_count_val = (completed_sessions + terminated_sessions) - pass_count_val

    # Total violations
    total_violations = await db.execute(
        select(func.count()).select_from(Violation)
    )
    total_violations_val = total_violations.scalar()

    # Total candidates
    total_candidates = await db.execute(
        select(func.count()).select_from(Candidate)
    )
    total_candidates_val = total_candidates.scalar()

    return {
        "total_candidates": total_candidates_val,
        "total_sessions": total_sessions,
        "active_sessions": active_sessions,
        "completed_sessions": completed_sessions,
        "terminated_sessions": terminated_sessions,
        "avg_knowledge_score": avg_knowledge,
        "avg_integrity_score": avg_integrity,
        "highest_score": highest_score,
        "lowest_integrity": lowest_integrity,
        "pass_count": pass_count_val,
        "fail_count": max(0, fail_count_val),
        "total_violations": total_violations_val,
    }


@router.get("/leaderboard")
async def get_leaderboard(limit: int = 10, db: AsyncSession = Depends(get_db)):
    """Get top candidates by average score across their completed sessions."""
    results = await db.execute(
        select(
            Candidate.id,
            Candidate.name,
            Candidate.email,
            Candidate.role,
            func.avg(InterviewSession.total_score).label("avg_score"),
            func.avg(InterviewSession.integrity_score).label("avg_integrity"),
            func.count(InterviewSession.id).label("session_count"),
        )
        .join(InterviewSession, InterviewSession.candidate_id == Candidate.id)
        .where(InterviewSession.status.in_([
            SessionStatus.COMPLETED.value,
            SessionStatus.TERMINATED.value,
        ]))
        .group_by(Candidate.id, Candidate.name, Candidate.email, Candidate.role)
        .order_by(func.avg(InterviewSession.total_score).desc())
        .limit(limit)
    )

    leaderboard = []
    for row in results.all():
        leaderboard.append({
            "candidate_id": str(row[0]),
            "name": row[1],
            "email": row[2],
            "role": row[3],
            "avg_score": round(row[4], 1),
            "avg_integrity": round(row[5], 1),
            "session_count": row[6],
        })

    return {"leaderboard": leaderboard}


@router.get("/{session_id}", response_model=SessionReport)
async def get_report(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Generate a comprehensive report for a session."""
    # Get session with candidate
    result = await db.execute(
        select(InterviewSession)
        .options(selectinload(InterviewSession.candidate))
        .where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    if session.status in (SessionStatus.PENDING.value, SessionStatus.ACTIVE.value):
        raise HTTPException(status_code=400, detail="Session is still in progress.")

    # Get answers (with question join for text enrichment)
    answers_result = await db.execute(
        select(Answer, Question.text)
        .join(Question, Answer.question_id == Question.id)
        .where(Answer.session_id == session_id)
        .order_by(Answer.submitted_at)
    )
    answer_rows = answers_result.all()

    violations_result = await db.execute(
        select(Violation).where(Violation.session_id == session_id).order_by(Violation.timestamp)
    )
    violations = violations_result.scalars().all()

    # Generate report
    answers = [row[0] for row in answer_rows]
    report_data = generate_report(session, answers, violations)

    # Build enriched answer responses
    enriched_answers = []
    for answer, q_text in answer_rows:
        ar = AnswerResponse.model_validate(answer)
        ar.question_text = q_text
        enriched_answers.append(ar)

    return SessionReport(
        session=SessionResponse.model_validate(session),
        candidate=CandidateResponse.model_validate(session.candidate),
        answers=enriched_answers,
        violations=[ViolationResponse.model_validate(v) for v in violations],
        overall_result=report_data["overall_result"],
        summary=report_data["summary"],
    )

