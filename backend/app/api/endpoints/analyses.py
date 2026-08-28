from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.models.models import User, Resume, ResumeVersion, JobDescription, ResumeAnalysis
from app.schemas.schemas import AnalysisRequest, ResumeAnalysisResponse, OptimizeRequest
from app.services.analyzer import analyze_resume_vs_jd, auto_tailor_resume
from app.schemas.schemas import ResumeVersionResponse
from app.services.usage import track_usage

router = APIRouter()

@router.post("/auto-tailor", response_model=ResumeVersionResponse)
def auto_tailor(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    request: AnalysisRequest,
) -> Any:
    # 1. Fetch resume and its latest version
    resume = db.query(Resume).filter(Resume.id == request.resume_id, Resume.user_id == current_user.id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
        
    latest_version = db.query(ResumeVersion).filter(ResumeVersion.resume_id == resume.id).order_by(ResumeVersion.version_number.desc()).first()
    if not latest_version:
        raise HTTPException(status_code=400, detail="Resume has no versions")
        
    # 2. Fetch job description
    jd = db.query(JobDescription).filter(JobDescription.id == request.job_description_id, JobDescription.user_id == current_user.id).first()
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found")
        
    # 3. Auto-Tailor
    try:
        tailored_data = auto_tailor_resume(latest_version.extracted_data or {}, jd.parsed_data or {}, user_api_key=current_user.gemini_api_key, user_model=current_user.gemini_model)
        track_usage(db, current_user.id, current_user.gemini_model)
    except Exception as e:
        if "Rate Limit Exceeded" in str(e):
            raise HTTPException(status_code=429, detail=str(e))
        raise HTTPException(status_code=500, detail="Failed to tailor resume.")
        
    # 4. Save as new version
    new_version_number = latest_version.version_number + 1
    new_version = ResumeVersion(
        resume_id=resume.id,
        version_number=new_version_number,
        raw_text=latest_version.raw_text, # Keep same raw text
        extracted_data=tailored_data
    )
    db.add(new_version)
    db.commit()
    db.refresh(new_version)
    
    return new_version

@router.post("/analyze", response_model=ResumeAnalysisResponse)
def trigger_analysis(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    request: AnalysisRequest,
) -> Any:
    # 1. Fetch resume and its latest version
    resume = db.query(Resume).filter(Resume.id == request.resume_id, Resume.user_id == current_user.id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
        
    latest_version = db.query(ResumeVersion).filter(ResumeVersion.resume_id == resume.id).order_by(ResumeVersion.version_number.desc()).first()
    if not latest_version:
        raise HTTPException(status_code=400, detail="Resume has no versions")
        
    # 2. Fetch job description
    jd = db.query(JobDescription).filter(JobDescription.id == request.job_description_id, JobDescription.user_id == current_user.id).first()
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found")
        
    # 3. Analyze
    try:
        analysis_data = analyze_resume_vs_jd(latest_version.extracted_data or {}, jd.parsed_data or {}, user_api_key=current_user.gemini_api_key, user_model=current_user.gemini_model)
        track_usage(db, current_user.id, current_user.gemini_model)
    except Exception as e:
        if "Rate Limit Exceeded" in str(e):
            raise HTTPException(status_code=429, detail=str(e))
        raise HTTPException(status_code=500, detail="Failed to analyze resume.")
        
    # 4. Extract overall score & ats score
    ats_score = analysis_data.get("ats_compatibility", {}).get("score", 70)
    match_score = analysis_data.get("match_scores", {}).get("overall", 70)
    
    # 5. Save analysis to database
    analysis = ResumeAnalysis(
        user_id=current_user.id,
        resume_version_id=latest_version.id,
        job_description_id=jd.id,
        ats_score=ats_score,
        match_score=match_score,
        analysis_results=analysis_data
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    
    return analysis

@router.get("/", response_model=List[ResumeAnalysisResponse])
def read_analyses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    return db.query(ResumeAnalysis).filter(ResumeAnalysis.user_id == current_user.id).all()

@router.get("/{analysis_id}", response_model=ResumeAnalysisResponse)
def read_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    analysis = db.query(ResumeAnalysis).filter(ResumeAnalysis.id == analysis_id, ResumeAnalysis.user_id == current_user.id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis

@router.post("/optimize")
def optimize_resume(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    request: OptimizeRequest,
) -> Any:
    # Fetch resume version
    resume = db.query(Resume).filter(Resume.id == request.resume_id, Resume.user_id == current_user.id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    latest_version = db.query(ResumeVersion).filter(ResumeVersion.resume_id == resume.id).order_by(ResumeVersion.version_number.desc()).first()
    if not latest_version:
        raise HTTPException(status_code=400, detail="Resume has no versions")

    # Generate suggested bullet points dynamically
    suggestions = []
    for skill in request.skills_to_add:
        cleaned_skill = skill.strip()
        if cleaned_skill.lower() == "kubernetes":
            sug = "Designed and configured local multi-node Kubernetes container orchestration clusters for project validation."
        elif cleaned_skill.lower() == "docker":
            sug = "Containerized local application layers using Docker and Docker Compose, streamlining operational onboarding."
        elif cleaned_skill.lower() == "informatica" or cleaned_skill.lower() == "idq":
            sug = "Built and deployed automated parsing rules and validation routines using Informatica IDQ Developer."
        elif cleaned_skill.lower() == "data governance":
            sug = "Partnered with Data Governance workflows to update lineage glossaries and corporate metadata terms."
        elif cleaned_skill.lower() == "power bi":
            sug = "Created Power BI dashboards to track data quality metrics, thresholds, and performance scorecards."
        elif cleaned_skill.lower() == "sql server":
            sug = "Optimized complex query execution and stored procedures in relational databases (SQL Server / Oracle)."
        else:
            sug = f"Leveraged {cleaned_skill} concepts during database integration, standardizing data flows and validating parameters."
            
        suggestions.append({
            "skill": cleaned_skill,
            "bullet_suggestion": sug,
            "section": "Skills & Experience Additions"
        })

    # Edit the file on disk!
    import os
    import fitz
    import docx
    from app.services.parser import extract_text

    ext = resume.filename.split(".")[-1].lower()
    
    if os.path.exists(resume.file_path):
        try:
            # Define taxonomy categories
            categories = {
                "programming languages": ["python", "c", "java", "sql", "dart", "javascript", "typescript", "c++", "c#", "golang", "rust"],
                "frontend technologies": ["flutter", "react", "next.js", "html", "css", "tailwind", "angular", "vue"],
                "backend technologies": ["fastapi", "flask", "django", "django rest framework", "rest apis", "rest api", "node.js", "express", "spring", "graphql", "microservices"],
                "databases": ["postgresql", "sqlite", "mysql", "firebase firestore", "hive", "oracle", "teradata", "db2", "sql server", "mongodb", "redis"],
                "data & ai": ["power bi", "streamlit", "pandas", "numpy", "scikit-learn", "jupyter notebook", "machine learning", "deep learning", "nlp", "pytorch", "tensorflow"],
                "tools & technologies": ["git", "github", "linux", "docker", "vs code", "postman", "selenium", "excel", "jira", "openproject", "taiga", "kubernetes", "ci/cd", "aws", "gcp", "azure", "terraform"]
            }

            if ext == "pdf":
                doc = fitz.open(resume.file_path)
                
                # Group added skills by category
                grouped_skills = {cat: [] for cat in categories.keys()}
                for s in request.skills_to_add:
                    found = False
                    for cat, keywords in categories.items():
                        if s.lower() in keywords:
                            grouped_skills[cat].append(s)
                            found = True
                            break
                    if not found:
                        grouped_skills["tools & technologies"].append(s)
                
                # Scan all pages
                for page_idx in range(doc.page_count):
                    page = doc[page_idx]
                    blocks_dict = page.get_text("dict")["blocks"]
                    
                    for b in blocks_dict:
                        if "lines" not in b: continue
                        
                        text = ""
                        for l in b["lines"]:
                            for s in l["spans"]:
                                text += s["text"]
                        text = text.strip()
                        rect = fitz.Rect(b["bbox"])
                        
                        # Find which category block it matches
                        matched_cat = None
                        for cat in categories.keys():
                            if cat + ":" in text.lower() or (cat == "tools & technologies" and "tools:" in text.lower()):
                                matched_cat = cat
                                break
                                
                        if matched_cat and grouped_skills[matched_cat]:
                            from app.services.font_manager import font_manager
                            
                            # Extract font details
                            spans = [s for l in b["lines"] for s in l["spans"] if s["text"].strip()]
                            prefix_size = 13.0
                            values_size = 12.0
                            prefix_font = "Times-Bold"
                            values_font = "Times-Roman"
                            baseline_y = rect.y0 + 10
                            
                            if spans:
                                baseline_y = spans[0]["origin"][1]
                                prefix_size = spans[0]["size"]
                                pf = spans[0]["font"]
                                sys_pf = font_manager.get_font_file(pf)
                                if not sys_pf:
                                    pf = pf.lower()
                                    if "helv" in pf or "arial" in pf or "sans" in pf:
                                        prefix_font = "Helvetica-Bold"
                                    elif "cour" in pf or "mono" in pf:
                                        prefix_font = "Courier-Bold"
                                        
                                if len(spans) > 1:
                                    values_size = spans[-1]["size"]
                                    vf = spans[-1]["font"]
                                    sys_vf = font_manager.get_font_file(vf)
                                    if not sys_vf:
                                        vf = vf.lower()
                                        if "helv" in vf or "arial" in vf or "sans" in vf:
                                            values_font = "Helvetica"
                                        elif "cour" in vf or "mono" in vf:
                                            values_font = "Courier"
                            
                            # Split prefix and values
                            parts = text.split(":", 1)
                            prefix = parts[0] + ": "
                            values = parts[1]
                            
                            # Redact line bounding box
                            redact_rect = fitz.Rect(rect.x0 - 2, rect.y0 - 2, page.rect.x1 - 10, rect.y1 + 4)
                            page.add_redact_annot(redact_rect, fill=(1, 1, 1))
                            page.apply_redactions()
                            
                            # Build updated values text string
                            clean_values = values.replace("\n", " ").strip()
                            updated_values = clean_values.rstrip(", ") + ", " + ", ".join(grouped_skills[matched_cat])
                            
                            available_width = page.rect.x1 - rect.x0 - 20
                            
                            if sys_pf:
                                pf_font = fitz.Font(fontfile=sys_pf)
                                prefix_w = pf_font.text_length(prefix, fontsize=prefix_size)
                            else:
                                prefix_w = fitz.get_text_length(prefix, fontname=prefix_font, fontsize=prefix_size)
                                
                            if sys_vf:
                                vf_font = fitz.Font(fontfile=sys_vf)
                                values_w = vf_font.text_length(updated_values, fontsize=values_size)
                            else:
                                values_w = fitz.get_text_length(updated_values, fontname=values_font, fontsize=values_size)
                                
                            total_w = prefix_w + values_w
                             
                            if total_w > available_width:
                                scale = available_width / max(1, total_w)
                                prefix_size = max(6.0, prefix_size * scale)
                                values_size = max(6.0, values_size * scale)
                                 
                            # Recalculate prefix width after potential scale
                            if sys_pf:
                                prefix_width = pf_font.text_length(prefix, fontsize=prefix_size)
                            else:
                                prefix_width = fitz.get_text_length(prefix, fontname=prefix_font, fontsize=prefix_size)
                            
                            if sys_pf:
                                page.insert_text(fitz.Point(rect.x0, baseline_y), prefix, fontsize=prefix_size, fontname="fprefix", fontfile=sys_pf)
                            else:
                                page.insert_text(fitz.Point(rect.x0, baseline_y), prefix, fontsize=prefix_size, fontname=prefix_font)
                                
                            if sys_vf:
                                page.insert_text(fitz.Point(rect.x0 + prefix_width, baseline_y), updated_values, fontsize=values_size, fontname="fvalues", fontfile=sys_vf)
                            else:
                                page.insert_text(fitz.Point(rect.x0 + prefix_width, baseline_y), updated_values, fontsize=values_size, fontname=values_font)
                                
                            grouped_skills[matched_cat] = [] # Mark handled
                            
                temp_path = resume.file_path + ".tmp"
                doc.save(temp_path)
                doc.close()
                os.replace(temp_path, resume.file_path)
            elif ext in ["docx", "doc"]:
                doc = docx.Document(resume.file_path)
                grouped_skills = {cat: [] for cat in categories.keys()}
                for s in request.skills_to_add:
                    found = False
                    for cat, keywords in categories.items():
                        if s.lower() in keywords:
                            grouped_skills[cat].append(s)
                            found = True
                            break
                    if not found:
                        grouped_skills["tools & technologies"].append(s)
                        
                for p in doc.paragraphs:
                    text_lower = p.text.lower()
                    matched_cat = None
                    for cat in categories.keys():
                        if cat + ":" in text_lower or (cat == "tools & technologies" and "tools:" in text_lower):
                            matched_cat = cat
                            break
                    if matched_cat and grouped_skills[matched_cat]:
                        p.text = p.text.rstrip(", ") + ", " + ", ".join(grouped_skills[matched_cat])
                        grouped_skills[matched_cat] = []
                doc.save(resume.file_path)
        except Exception as e:
            print(f"Error modifying file inline on disk: {e}")

    # Re-extract text from modified file
    new_raw_text = latest_version.raw_text
    if os.path.exists(resume.file_path):
        try:
            with open(resume.file_path, "rb") as f:
                new_raw_text = extract_text(f.read(), resume.filename)
        except Exception as e:
            print(f"Error reading updated file: {e}")

    # Optional: Automatically insert selected skills into candidate's DB skills list to trigger a match upgrade!
    updated_extracted = latest_version.extracted_data.copy() if latest_version.extracted_data else {}
    current_skills = updated_extracted.get("skills", [])
    
    # Merge skills that aren't already present
    added_count = 0
    for skill in request.skills_to_add:
        if skill.lower() not in [s.lower() for s in current_skills]:
            current_skills.append(skill)
            added_count += 1
            
    if added_count > 0:
        updated_extracted["skills"] = current_skills
        
        # Save a NEW version to keep history!
        new_version_num = latest_version.version_number + 1
        new_version = ResumeVersion(
            resume_id=resume.id,
            version_number=new_version_num,
            raw_text=new_raw_text,
            extracted_data=updated_extracted
        )
        db.add(new_version)
        db.commit()

    return {
        "status": "success",
        "message": f"Successfully added {added_count} new skills to the resume file on disk and generated a new database version (v{latest_version.version_number + 1 if added_count > 0 else latest_version.version_number}).",
        "suggestions": suggestions
    }
