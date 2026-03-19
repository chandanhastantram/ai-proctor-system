"""SQLAlchemy models for the AI Proctoring System (Neon PostgreSQL)."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean,
    DateTime, ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base
import enum


# ── Enums (Python-side only, stored as String in DB) ───────────────────────

class SessionStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    TERMINATED = "terminated"


class Difficulty(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class ViolationType(str, enum.Enum):
    NO_FACE = "no_face"
    MULTIPLE_FACES = "multiple_faces"
    LOOKING_AWAY = "looking_away"
    TAB_SWITCH = "tab_switch"
    AUDIO_DETECTED = "audio_detected"
    FACE_MISMATCH = "face_mismatch"
    COPY_PASTE = "copy_paste"


class QuestionCategory(str, enum.Enum):
    PYTHON = "python"
    MACHINE_LEARNING = "machine_learning"
    DATA_STRUCTURES = "data_structures"
    SYSTEM_DESIGN = "system_design"
    SQL = "sql"
    GENERAL = "general"


# ── Models ─────────────────────────────────────────────────────────────────

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    role = Column(String(255), nullable=False)
    face_descriptor = Column(Text, nullable=True)  # JSON-encoded face embedding
    registered_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    sessions = relationship("InterviewSession", back_populates="candidate", cascade="all, delete-orphan")


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False)
    status = Column(String(50), default=SessionStatus.PENDING.value, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    total_score = Column(Float, default=0.0)
    integrity_score = Column(Float, default=100.0)  # Starts at 100, decreases with violations
    question_count = Column(Integer, default=0)
    current_difficulty = Column(String(50), default=Difficulty.EASY.value)

    candidate = relationship("Candidate", back_populates="sessions")
    answers = relationship("Answer", back_populates="session", cascade="all, delete-orphan")
    violations = relationship("Violation", back_populates="session", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category = Column(String(100), nullable=False)
    difficulty = Column(String(50), nullable=False)
    text = Column(Text, nullable=False)
    reference_answer = Column(Text, nullable=False)
    time_limit_seconds = Column(Integer, default=120)

    answers = relationship("Answer", back_populates="question")


class Answer(Base):
    __tablename__ = "answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=False)
    candidate_answer = Column(Text, nullable=False)
    score = Column(Float, default=0.0)  # 0-100
    feedback = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    time_taken_seconds = Column(Integer, nullable=True)

    session = relationship("InterviewSession", back_populates="answers")
    question = relationship("Question", back_populates="answers")


class Violation(Base):
    __tablename__ = "violations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id"), nullable=False)
    violation_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(Integer, default=1)  # 1=low, 2=medium, 3=high
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    screenshot_url = Column(Text, nullable=True)

    session = relationship("InterviewSession", back_populates="violations")
