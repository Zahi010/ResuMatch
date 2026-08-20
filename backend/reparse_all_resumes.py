import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import Resume, ResumeVersion, User
from app.services.parser import extract_text, parse_resume_with_ai

DATABASE_URL = "sqlite:///./sql_app.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

print("Starting re-parsing of all resumes in DB...")
resumes = db.query(Resume).all()
for r in resumes:
    print(f"Processing Resume ID: {r.id}, Filename: {r.filename}")
    if not os.path.exists(r.file_path):
        print(f"  Warning: file path {r.file_path} not found on disk. Skipping.")
        continue
        
    try:
        user = db.query(User).filter(User.id == r.user_id).first()
        api_key = user.gemini_api_key if user else None
        
        # Read file bytes
        with open(r.file_path, "rb") as f:
            file_bytes = f.read()
            
        # Extract text
        raw_text = extract_text(file_bytes, r.filename)
        
        # Parse skills and details
        parsed_data = parse_resume_with_ai(raw_text, user_api_key=api_key)
        
        # Update latest version in DB
        version = db.query(ResumeVersion).filter(ResumeVersion.resume_id == r.id).order_by(ResumeVersion.version_number.desc()).first()
        if version:
            version.raw_text = raw_text
            version.extracted_data = parsed_data
            db.commit()
            print(f"  Success: Updated extracted data. Skills found: {parsed_data.get('skills')}")
        else:
            print("  Warning: No ResumeVersion found for this record.")
    except Exception as e:
        print(f"  Error processing: {e}")

print("Completed re-parsing.")
db.close()
