"""Candidates router — registration and management."""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Candidate
from schemas import CandidateCreate, CandidateResponse

router = APIRouter(prefix="/api/candidates", tags=["candidates"])


@router.post("/", response_model=CandidateResponse, status_code=status.HTTP_201_CREATED)
async def register_candidate(data: CandidateCreate, db: AsyncSession = Depends(get_db)):
    """Register a new candidate."""
    # Check if email already exists
    existing = await db.execute(
        select(Candidate).where(Candidate.email == data.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A candidate with this email already exists.",
        )

    candidate = Candidate(
        name=data.name,
        email=data.email,
        role=data.role,
        face_descriptor=data.face_descriptor,
    )
    db.add(candidate)
    await db.flush()
    await db.refresh(candidate)
    return candidate


@router.get("/", response_model=list[CandidateResponse])
async def list_candidates(db: AsyncSession = Depends(get_db)):
    """List all registered candidates."""
    result = await db.execute(select(Candidate).order_by(Candidate.registered_at.desc()))
    return result.scalars().all()


@router.get("/{candidate_id}", response_model=CandidateResponse)
async def get_candidate(candidate_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a candidate by ID."""
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    return candidate


@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_candidate(candidate_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete a candidate."""
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    await db.delete(candidate)
