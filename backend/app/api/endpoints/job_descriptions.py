from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.models.models import User, JobDescription
from app.schemas.schemas import JobDescriptionCreate, JobDescriptionResponse
from app.services.parser import parse_job_description_with_ai
from app.services.usage import track_usage

router = APIRouter()

@router.post("/", response_model=JobDescriptionResponse)
def create_job_description(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    jd_in: JobDescriptionCreate,
) -> Any:
    # Run parsing service to extract structured items
    try:
        parsed_data = parse_job_description_with_ai(jd_in.raw_text, user_api_key=current_user.gemini_api_key, user_model=current_user.gemini_model)
        track_usage(db, current_user.id, current_user.gemini_model)
    except Exception as e:
        print(f"Error parsing job description: {e}")
        if "Rate Limit Exceeded" in str(e):
            raise HTTPException(status_code=429, detail=str(e))
        raise HTTPException(status_code=500, detail="Failed to parse job description.")
        
    
    # Save to db
    db_jd = JobDescription(
        user_id=current_user.id,
        title=jd_in.title or parsed_data.get("title", "Untitled Role"),
        company=jd_in.company or parsed_data.get("company", "Unknown Company"),
        raw_text=jd_in.raw_text,
        parsed_data=parsed_data
    )
    db.add(db_jd)
    db.commit()
    db.refresh(db_jd)
    return db_jd

@router.get("/", response_model=List[JobDescriptionResponse])
def read_job_descriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    return db.query(JobDescription).filter(JobDescription.user_id == current_user.id).all()

@router.get("/{jd_id}", response_model=JobDescriptionResponse)
def read_job_description(
    jd_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    jd = db.query(JobDescription).filter(JobDescription.id == jd_id, JobDescription.user_id == current_user.id).first()
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found")
    return jd
