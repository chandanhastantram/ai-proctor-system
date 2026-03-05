"""Sessions router — interview session management."""

from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import InterviewSession, Candidate, Answer, Violation, SessionStatus
from schemas import SessionCreate, SessionResponse, SessionDetail

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("/", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(data: SessionCreate, db: AsyncSession = Depends(get_db)):
    """Create a new interview session for a candidate."""
    # Verify candidate exists
    result = await db.execute(select(Candidate).where(Candidate.id == data.candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    # Check for existing active session
    active = await db.execute(
        select(InterviewSession).where(
            InterviewSession.candidate_id == data.candidate_id,
            InterviewSession.status.in_([SessionStatus.PENDING.value, SessionStatus.ACTIVE.value]),
        )
    )
    if active.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Candidate already has an active session.",
        )

    session = InterviewSession(candidate_id=data.candidate_id)
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


@router.post("/{session_id}/start", response_model=SessionResponse)
async def start_session(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Start an interview session."""
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.status != SessionStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Session is not in pending state.")

    session.status = SessionStatus.ACTIVE.value
    session.started_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(session)
    return session


@router.post("/{session_id}/end", response_model=SessionResponse)
async def end_session(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """End an interview session."""
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.status not in (SessionStatus.ACTIVE.value, SessionStatus.PENDING.value):
        raise HTTPException(status_code=400, detail="Session is already ended.")

    session.status = SessionStatus.COMPLETED.value
    session.ended_at = datetime.now(timezone.utc)

    # Calculate final total score
    answers_result = await db.execute(
        select(Answer).where(Answer.session_id == session_id)
    )
    answers = answers_result.scalars().all()
    if answers:
        session.total_score = sum(a.score for a in answers) / len(answers)

    await db.flush()
    await db.refresh(session)
    return session


@router.post("/{session_id}/terminate", response_model=SessionResponse)
async def terminate_session(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Terminate a session due to excessive violations."""
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    session.status = SessionStatus.TERMINATED.value
    session.ended_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(session)
    return session


@router.get("/", response_model=list[SessionResponse])
async def list_sessions(
    status_filter: SessionStatus | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List all sessions, optionally filtered by status."""
    query = select(InterviewSession).order_by(InterviewSession.started_at.desc())
    if status_filter:
        query = query.where(InterviewSession.status == status_filter.value)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{session_id}", response_model=SessionDetail)
async def get_session(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get detailed session info including candidate data and counts."""
    result = await db.execute(
        select(InterviewSession)
        .options(selectinload(InterviewSession.candidate))
        .where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    # Count answers and violations
    ans_count = await db.execute(
        select(func.count()).select_from(Answer).where(Answer.session_id == session_id)
    )
    viol_count = await db.execute(
        select(func.count()).select_from(Violation).where(Violation.session_id == session_id)
    )

    return SessionDetail(
        id=session.id,
        candidate_id=session.candidate_id,
        status=session.status,
        started_at=session.started_at,
        ended_at=session.ended_at,
        total_score=session.total_score,
        integrity_score=session.integrity_score,
        question_count=session.question_count,
        current_difficulty=session.current_difficulty,
        candidate=session.candidate,
        answer_count=ans_count.scalar(),
        violation_count=viol_count.scalar(),
    )
