import os
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.models.models import User, Resume, ResumeVersion
from app.schemas.schemas import ResumeResponse, ResumeBuildRequest
from app.services.parser import extract_text, parse_resume_with_ai
from app.services.builder import generate_resume_pdf
from app.services.usage import track_usage
from fastapi.responses import Response

router = APIRouter()

UPLOAD_DIR = "uploads/resumes"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload", response_model=ResumeResponse)
async def upload_resume(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    file: UploadFile = File(...),
) -> Any:
    # Read file content
    file_bytes = await file.read()
    
    # Save the file locally
    user_dir = os.path.join(UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    file_path = os.path.join(user_dir, file.filename)
    
    with open(file_path, "wb") as f:
        f.write(file_bytes)
        
    # Extract text from document
    try:
        raw_text = extract_text(file_bytes, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract text: {str(e)}")
        
    # Create resume entry
    resume = Resume(
        user_id=current_user.id,
        filename=file.filename,
        file_path=file_path
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    
    # Parse resume structure using LLM
    extracted_data = parse_resume_with_ai(raw_text, user_api_key=current_user.gemini_api_key, user_model=current_user.gemini_model)
    track_usage(db, current_user.id, current_user.gemini_model)
    
    # Create the first version
    version = ResumeVersion(
        resume_id=resume.id,
        version_number=1,
        raw_text=raw_text,
        extracted_data=extracted_data
    )
    db.add(version)
    db.commit()
    db.refresh(resume)
    
    return resume

@router.get("/", response_model=List[ResumeResponse])
def read_resumes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    return db.query(Resume).filter(Resume.user_id == current_user.id).all()

@router.get("/{resume_id}", response_model=ResumeResponse)
def read_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    resume = db.query(Resume).filter(Resume.id == resume_id, Resume.user_id == current_user.id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume

@router.delete("/{resume_id}")
def delete_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    resume = db.query(Resume).filter(Resume.id == resume_id, Resume.user_id == current_user.id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    db.delete(resume)
    db.commit()
    return {"status": "success", "message": "Resume deleted"}

@router.get("/{resume_id}/download")
def download_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    resume = db.query(Resume).filter(Resume.id == resume_id, Resume.user_id == current_user.id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if not os.path.exists(resume.file_path):
        raise HTTPException(status_code=404, detail="File on disk not found")
    return FileResponse(
        path=resume.file_path,
        filename=resume.filename,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{resume.filename}"'}
    )

@router.post("/preview")
def preview_built_resume(
    request: ResumeBuildRequest,
    current_user: User = Depends(get_current_active_user)
) -> Any:
    # Generates a transient PDF for preview
    pdf_bytes = generate_resume_pdf(request)
    return Response(content=pdf_bytes, media_type="application/pdf")

@router.post("/build", response_model=ResumeResponse)
def build_resume(
    request: ResumeBuildRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Any:
    # Generate the PDF
    pdf_bytes = generate_resume_pdf(request)
    
    # Save it to disk
    user_dir = os.path.join(UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    filename = f"{request.personal.full_name or 'Resume'}_Generated.pdf"
    
    # Ensure unique filename
    base, ext = os.path.splitext(filename)
    counter = 1
    file_path = os.path.join(user_dir, filename)
    while os.path.exists(file_path):
        filename = f"{base}_{counter}{ext}"
        file_path = os.path.join(user_dir, filename)
        counter += 1
        
    with open(file_path, "wb") as f:
        f.write(pdf_bytes)
        
    # Create DB records
    db_resume = Resume(
        user_id=current_user.id,
        filename=filename,
        file_path=file_path
    )
    db.add(db_resume)
    db.commit()
    db.refresh(db_resume)
    
    # Add initial version
    db_version = ResumeVersion(
        resume_id=db_resume.id,
        version_number=1,
        extracted_data=request.model_dump()
    )
    db.add(db_version)
    db.commit()
    
    return db_resume
