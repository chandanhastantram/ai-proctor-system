"""AI Interview & Exam Proctoring System — FastAPI Backend."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from database import init_db
from routers import candidates, sessions, questions, violations, reports

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup: create tables
    await init_db()
    print("✅ Database tables created successfully (Neon PostgreSQL)")

    # Seed questions on startup
    from database import async_session
    from sqlalchemy import select, func
    from models import Question
    from services.question_engine import QUESTION_BANK

    async with async_session() as db:
        count = await db.execute(select(func.count()).select_from(Question))
        if count.scalar() == 0:
            print("📝 Seeding question bank...")
            for q_data in QUESTION_BANK:
                cat = q_data["category"]
                diff = q_data["difficulty"]
                q = Question(
                    category=cat.value if hasattr(cat, 'value') else cat,
                    difficulty=diff.value if hasattr(diff, 'value') else diff,
                    text=q_data["text"],
                    reference_answer=q_data["reference_answer"],
                    time_limit_seconds=q_data["time_limit_seconds"],
                )
                db.add(q)
            await db.commit()
            print(f"📝 Seeded {len(QUESTION_BANK)} questions into the database.")

    yield
    # Shutdown
    print("👋 Server shutting down.")


app = FastAPI(
    title="AI Proctor — Interview & Exam Proctoring System",
    description=(
        "An AI/ML-powered platform that conducts automated interviews "
        "and detects cheating in real-time using computer vision, "
        "audio analysis, and browser monitoring."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(candidates.router)
app.include_router(sessions.router)
app.include_router(questions.router)
app.include_router(violations.router)
app.include_router(reports.router)


@app.get("/")
async def root():
    return {
        "name": "AI Proctor",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "endpoints": {
            "candidates": "/api/candidates",
            "sessions": "/api/sessions",
            "questions": "/api/questions",
            "violations": "/api/violations",
            "reports": "/api/reports",
        },
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
