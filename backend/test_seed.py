"""Test script to debug the seeding issue."""
import asyncio
from database import engine, async_session, init_db
from models import Question, QuestionCategory, Difficulty
from services.question_engine import QUESTION_BANK


async def test():
    try:
        # Try inserting a single question
        async with async_session() as db:
            q = Question(
                category=QuestionCategory.PYTHON,
                difficulty=Difficulty.EASY,
                text="test question unique 123",
                reference_answer="test answer",
                time_limit_seconds=60,
            )
            db.add(q)
            await db.commit()
            print("SUCCESS: Single insert works!")
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")


asyncio.run(test())
