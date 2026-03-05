"""Reports router — generate and retrieve session reports."""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import InterviewSession, Answer, Violation, SessionStatus
from schemas import SessionReport, SessionResponse, CandidateResponse, AnswerResponse, ViolationResponse
from services.report_generator import generate_report

router = APIRouter(prefix="/api/reports", tags=["reports"])


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

    if session.status in (SessionStatus.PENDING, SessionStatus.ACTIVE):
        raise HTTPException(status_code=400, detail="Session is still in progress.")

    # Get answers and violations
    answers_result = await db.execute(
        select(Answer).where(Answer.session_id == session_id).order_by(Answer.submitted_at)
    )
    answers = answers_result.scalars().all()

    violations_result = await db.execute(
        select(Violation).where(Violation.session_id == session_id).order_by(Violation.timestamp)
    )
    violations = violations_result.scalars().all()

    # Generate report
    report_data = generate_report(session, answers, violations)

    return SessionReport(
        session=SessionResponse.model_validate(session),
        candidate=CandidateResponse.model_validate(session.candidate),
        answers=[AnswerResponse.model_validate(a) for a in answers],
        violations=[ViolationResponse.model_validate(v) for v in violations],
        overall_result=report_data["overall_result"],
        summary=report_data["summary"],
    )
