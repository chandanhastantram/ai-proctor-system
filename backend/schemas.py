"""Pydantic schemas for request/response validation."""

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID
from models import SessionStatus, Difficulty, ViolationType, QuestionCategory


# ── Candidate Schemas ───────────────────────────────────────────────────────

class CandidateCreate(BaseModel):
    name: str
    email: EmailStr
    role: str
    face_descriptor: Optional[str] = None


class CandidateResponse(BaseModel):
    id: UUID
    name: str
    email: str
    role: str
    registered_at: datetime

    class Config:
        from_attributes = True


# ── Session Schemas ─────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    candidate_id: UUID


class SessionResponse(BaseModel):
    id: UUID
    candidate_id: UUID
    status: SessionStatus
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    total_score: float
    integrity_score: float
    question_count: int
    current_difficulty: Difficulty

    class Config:
        from_attributes = True


class SessionDetail(SessionResponse):
    candidate: CandidateResponse
    answer_count: Optional[int] = 0
    violation_count: Optional[int] = 0


# ── Question Schemas ────────────────────────────────────────────────────────

class QuestionResponse(BaseModel):
    id: UUID
    category: QuestionCategory
    difficulty: Difficulty
    text: str
    time_limit_seconds: int

    class Config:
        from_attributes = True


class QuestionCreate(BaseModel):
    category: QuestionCategory
    difficulty: Difficulty
    text: str
    reference_answer: str
    time_limit_seconds: int = 120


# ── Answer Schemas ──────────────────────────────────────────────────────────

class AnswerSubmit(BaseModel):
    session_id: UUID
    question_id: UUID
    candidate_answer: str
    time_taken_seconds: Optional[int] = None


class AnswerResponse(BaseModel):
    id: UUID
    session_id: UUID
    question_id: UUID
    candidate_answer: str
    score: float
    feedback: Optional[str]
    submitted_at: datetime
    time_taken_seconds: Optional[int]

    class Config:
        from_attributes = True


# ── Violation Schemas ───────────────────────────────────────────────────────

class ViolationCreate(BaseModel):
    session_id: UUID
    violation_type: ViolationType
    description: Optional[str] = None
    severity: int = 1
    screenshot_url: Optional[str] = None


class ViolationResponse(BaseModel):
    id: UUID
    session_id: UUID
    violation_type: ViolationType
    description: Optional[str]
    severity: int
    timestamp: datetime
    screenshot_url: Optional[str]

    class Config:
        from_attributes = True


# ── Report Schemas ──────────────────────────────────────────────────────────

class SessionReport(BaseModel):
    session: SessionResponse
    candidate: CandidateResponse
    answers: list[AnswerResponse]
    violations: list[ViolationResponse]
    overall_result: str  # "PASS" or "FAIL"
    summary: str
