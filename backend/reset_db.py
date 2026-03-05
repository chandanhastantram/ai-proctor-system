"""Reset the database — drop all tables with CASCADE and recreate."""
import asyncio
from sqlalchemy import text
from database import engine, Base, init_db
from models import *


async def reset():
    print("Dropping all tables with CASCADE...")
    async with engine.begin() as conn:
        # Drop all tables with CASCADE to handle dependencies
        await conn.execute(text("DROP TABLE IF EXISTS violations CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS answers CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS interview_sessions CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS questions CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS candidates CASCADE"))
        # Drop any leftover enum types from the old schema
        await conn.execute(text("DROP TYPE IF EXISTS sessionstatus CASCADE"))
        await conn.execute(text("DROP TYPE IF EXISTS difficulty CASCADE"))
        await conn.execute(text("DROP TYPE IF EXISTS violationtype CASCADE"))
        await conn.execute(text("DROP TYPE IF EXISTS questioncategory CASCADE"))
    print("Tables dropped. Recreating...")
    await init_db()
    print("Done! Tables recreated with new String-based schema.")


asyncio.run(reset())
