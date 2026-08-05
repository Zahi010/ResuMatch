from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.models import User, JobApplication, JobDescription, JobApplicationHistory, Resume, ResumeVersion
from app.schemas.schemas import JobApplicationCreate, JobApplicationUpdate, JobApplicationResponse
from app.services.ai_features import generate_job_insights, estimate_salary, generate_brag_sheet

router = APIRouter()

@router.get("/", response_model=List[JobApplicationResponse])
def get_job_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all job applications for the current user."""
    return db.query(JobApplication).filter(JobApplication.user_id == current_user.id).order_by(JobApplication.created_at.desc()).all()

@router.post("/", response_model=JobApplicationResponse)
def create_job_application(
    application: JobApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new job application."""
    
    # Prevent duplicates
    existing_job = None
    if application.url:
        existing_job = db.query(JobApplication).filter(
            JobApplication.user_id == current_user.id,
            JobApplication.url == application.url
        ).first()
    elif application.company and application.job_title:
        existing_job = db.query(JobApplication).filter(
            JobApplication.user_id == current_user.id,
            JobApplication.company == application.company,
            JobApplication.job_title == application.job_title
        ).first()
        
    if existing_job:
        return existing_job

    if application.job_description_id:
        jd = db.query(JobDescription).filter(
            JobDescription.id == application.job_description_id,
            JobDescription.user_id == current_user.id
        ).first()
        if not jd:
            raise HTTPException(status_code=404, detail="Job description not found")

    new_app = JobApplication(
        user_id=current_user.id,
        job_description_id=application.job_description_id,
        job_title=application.job_title,
        company=application.company,
        url=application.url,
        status=application.status,
        notes=application.notes,
        location=application.location,
        application_method=application.application_method,
        contact_person=application.contact_person,
        contact_url=application.contact_url,
        work_mode=application.work_mode,
        job_type=application.job_type,
        interview_date=application.interview_date,
        resume_id=application.resume_id,
        follow_up_date=application.follow_up_date,
        priority=application.priority
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)

    # Create initial history entry
    history_entry = JobApplicationHistory(
        job_application_id=new_app.id,
        previous_status=None,
        new_status=new_app.status
    )
    db.add(history_entry)
    db.commit()
    db.refresh(new_app)
    
    return new_app

@router.put("/{app_id}", response_model=JobApplicationResponse)
def update_job_application(
    app_id: int,
    application_update: JobApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a job application's status or notes."""
    app = db.query(JobApplication).filter(
        JobApplication.id == app_id,
        JobApplication.user_id == current_user.id
    ).first()
    
    if not app:
        raise HTTPException(status_code=404, detail="Job application not found")
        
    update_data = application_update.dict(exclude_unset=True)
    
    status_changed = False
    old_status = app.status
    new_status = None
    
    if "status" in update_data and update_data["status"] != old_status:
        status_changed = True
        new_status = update_data["status"]
        
    for key, value in update_data.items():
        setattr(app, key, value)
        
    if status_changed:
        history_entry = JobApplicationHistory(
            job_application_id=app.id,
            previous_status=old_status,
            new_status=new_status
        )
        db.add(history_entry)
    
    app.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(app)
    return app

@router.delete("/{app_id}")
def delete_job_application(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a job application."""
    app = db.query(JobApplication).filter(
        JobApplication.id == app_id,
        JobApplication.user_id == current_user.id
    ).first()
    
    if not app:
        raise HTTPException(status_code=404, detail="Job application not found")
        
    db.delete(app)
    db.commit()
    return {"message": "Job application deleted successfully"}

@router.post("/{app_id}/generate-insights")
def generate_insights(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = db.query(JobApplication).filter(JobApplication.id == app_id, JobApplication.user_id == current_user.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Job application not found")
        
    jd_text = ""
    if app.job_description_id:
        jd = db.query(JobDescription).filter(JobDescription.id == app.job_description_id).first()
        if jd:
            jd_text = jd.raw_text
            
    if not jd_text:
        jd_text = f"{app.job_title} at {app.company}"
        
    insights = generate_job_insights(jd_text, current_user.gemini_api_key, current_user.gemini_model)
    app.insights = insights
    db.commit()
    return {"insights": insights}

@router.post("/{app_id}/estimate-salary")
def estimate_salary_endpoint(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = db.query(JobApplication).filter(JobApplication.id == app_id, JobApplication.user_id == current_user.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Job application not found")
        
    jd_text = ""
    if app.job_description_id:
        jd = db.query(JobDescription).filter(JobDescription.id == app.job_description_id).first()
        if jd:
            jd_text = jd.raw_text
    if not jd_text:
        jd_text = f"{app.job_title} at {app.company}"
        
    resume_text = ""
    if app.resume_id:
        resume = db.query(Resume).filter(Resume.id == app.resume_id).first()
        if resume and resume.versions:
            resume_text = resume.versions[-1].raw_text
            
    if not resume_text:
        raise HTTPException(status_code=400, detail="Please link a resume first to estimate salary based on your experience.")
        
    salary_est = estimate_salary(jd_text, resume_text, current_user.gemini_api_key, current_user.gemini_model)
    app.target_salary = salary_est
    db.commit()
    return {"target_salary": salary_est}

@router.post("/{app_id}/generate-brag-sheet")
def generate_brag_sheet_endpoint(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = db.query(JobApplication).filter(JobApplication.id == app_id, JobApplication.user_id == current_user.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Job application not found")
        
    jd_text = ""
    if app.job_description_id:
        jd = db.query(JobDescription).filter(JobDescription.id == app.job_description_id).first()
        if jd:
            jd_text = jd.raw_text
    if not jd_text:
        jd_text = f"{app.job_title} at {app.company}"
        
    resume_text = ""
    if app.resume_id:
        resume = db.query(Resume).filter(Resume.id == app.resume_id).first()
        if resume and resume.versions:
            resume_text = resume.versions[-1].raw_text
            
    if not resume_text:
        raise HTTPException(status_code=400, detail="Please link a resume first to generate a brag sheet.")
        
    brag_sheet = generate_brag_sheet(jd_text, resume_text, current_user.gemini_api_key, current_user.gemini_model)
    app.brag_sheet = brag_sheet
    db.commit()
    return {"brag_sheet": brag_sheet}
