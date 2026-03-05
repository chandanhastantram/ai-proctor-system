"""Questions router — fetch questions and submit answers."""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import (
    Question, Answer, InterviewSession,
    SessionStatus, Difficulty, QuestionCategory,
)
from schemas import QuestionResponse, AnswerSubmit, AnswerResponse
from services.question_engine import get_next_question, adjust_difficulty, QUESTION_BANK
from services.answer_evaluator import evaluate_answer

router = APIRouter(prefix="/api/questions", tags=["questions"])


@router.get("/next/{session_id}", response_model=QuestionResponse)
async def get_next(
    session_id: UUID,
    category: QuestionCategory | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Get the next question for a session based on adaptive difficulty."""
    # Verify session
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.status != SessionStatus.ACTIVE.value:
        raise HTTPException(status_code=400, detail="Session is not active.")

    # Get previously asked questions for this session
    answered = await db.execute(
        select(Answer.question_id).where(Answer.session_id == session_id)
    )
    answered_ids = [str(a) for a in answered.scalars().all()]

    # Find which bank indices have been used (by matching question text)
    asked_indices = []
    existing_questions = await db.execute(
        select(Question).where(Question.id.in_(answered_ids)) if answered_ids else select(Question).where(False)
    )
    existing_texts = {q.text for q in existing_questions.scalars().all()}
    for idx, q in enumerate(QUESTION_BANK):
        if q["text"] in existing_texts:
            asked_indices.append(idx)

    # Get next question from bank
    question_data = get_next_question(
        difficulty=session.current_difficulty,
        category=category,
        asked_indices=asked_indices,
    )

    if not question_data:
        raise HTTPException(status_code=404, detail="No more questions available.")

    # Store question in DB if not already there
    existing = await db.execute(
        select(Question).where(Question.text == question_data["text"])
    )
    question = existing.scalar_one_or_none()

    if not question:
        cat = question_data["category"]
        diff = question_data["difficulty"]
        question = Question(
            category=cat.value if hasattr(cat, 'value') else cat,
            difficulty=diff.value if hasattr(diff, 'value') else diff,
            text=question_data["text"],
            reference_answer=question_data["reference_answer"],
            time_limit_seconds=question_data["time_limit_seconds"],
        )
        db.add(question)
        await db.flush()
        await db.refresh(question)

    return question


@router.post("/submit", response_model=AnswerResponse)
async def submit_answer(data: AnswerSubmit, db: AsyncSession = Depends(get_db)):
    """Submit an answer and get it evaluated by the NLP engine."""
    # Verify session
    sess_result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == data.session_id)
    )
    session = sess_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.status != SessionStatus.ACTIVE.value:
        raise HTTPException(status_code=400, detail="Session is not active.")

    # Get the question
    q_result = await db.execute(
        select(Question).where(Question.id == data.question_id)
    )
    question = q_result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found.")

    # Check if already answered
    dup = await db.execute(
        select(Answer).where(
            Answer.session_id == data.session_id,
            Answer.question_id == data.question_id,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Question already answered in this session.")

    # Evaluate using NLP
    evaluation = evaluate_answer(data.candidate_answer, question.reference_answer)

    # Create answer record
    answer = Answer(
        session_id=data.session_id,
        question_id=data.question_id,
        candidate_answer=data.candidate_answer,
        score=evaluation["score"],
        feedback=evaluation["feedback"],
        time_taken_seconds=data.time_taken_seconds,
    )
    db.add(answer)

    # Update session: adjust difficulty and increment question count
    session.question_count += 1
    new_diff = adjust_difficulty(
        session.current_difficulty, evaluation["score"]
    )
    session.current_difficulty = new_diff.value if hasattr(new_diff, 'value') else new_diff

    # Update running total score
    all_answers = await db.execute(
        select(Answer).where(Answer.session_id == data.session_id)
    )
    answers_list = all_answers.scalars().all()
    total = sum(a.score for a in answers_list) + evaluation["score"]
    count = len(answers_list) + 1
    session.total_score = total / count

    await db.flush()
    await db.refresh(answer)
    return answer


@router.get("/session/{session_id}", response_model=list[AnswerResponse])
async def get_session_answers(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get all answers for a session."""
    result = await db.execute(
        select(Answer)
        .where(Answer.session_id == session_id)
        .order_by(Answer.submitted_at)
    )
    return result.scalars().all()
