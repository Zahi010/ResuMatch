import json
from typing import Any, List, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.core.config import settings
from app.core.llm import query_llm
from app.models.models import User, Resume, ResumeVersion, JobDescription, MockInterview, InterviewQuestion, ScrapedURL

router = APIRouter()

# Schema definitions
class ATSCheckRequest(BaseModel):
    resume_id: int

class BulletOptimizeRequest(BaseModel):
    bullet_point: str
    job_description_id: int

class OutreachRequest(BaseModel):
    resume_id: int
    job_description_id: int

class ApplyBulletRequest(BaseModel):
    resume_id: int
    job_description_id: int
    original_bullet: str
    optimized_bullet: str

class InterviewRequest(BaseModel):
    resume_id: int
    job_description_id: int

class EvaluateRequest(BaseModel):
    question_id: int
    answer: str

class ScrapeUrlRequest(BaseModel):
    url: str

@router.post("/scrape-url")
def scrape_job_url(
    request: ScrapeUrlRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    from bs4 import BeautifulSoup
    
    # 1. Check if URL is already cached
    cached_url = db.query(ScrapedURL).filter(ScrapedURL.url == request.url).first()
    if cached_url:
        return {
            "title": cached_url.title,
            "company": cached_url.company,
            "description": cached_url.description
        }
        
    try:
        with httpx.Client(timeout=15.0) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            res = client.get(request.url, headers=headers)
            res.raise_for_status()
            soup = BeautifulSoup(res.text, "html.parser")
            
            # Remove scripts and styles
            for script in soup(["script", "style", "nav", "footer"]):
                script.decompose()
                
            raw_text = soup.get_text(separator=" ", strip=True)
            # Limit text to avoid blowing up context window
            raw_text = raw_text[:15000]
            
            prompt = f"""
            You are an expert ATS system and recruiter. Extract the Job Title, Company Name, and the core Job Description from the following scraped website text.
            If you cannot find the company name, infer it or return 'Unknown Company'.
            Return ONLY a valid JSON object with the keys "title", "company", and "description". Do not wrap it in markdown.
            
            Scraped Text:
            {raw_text}
            """
            
            extracted_json = query_llm(prompt, response_format_json=True, user_api_key=current_user.gemini_api_key)
            if not extracted_json:
                raise HTTPException(status_code=500, detail="Failed to extract details using AI.")
                
            try:
                import json
                cleaned_json = extracted_json.strip()
                if cleaned_json.startswith("```json"):
                    cleaned_json = cleaned_json[7:]
                if cleaned_json.startswith("```"):
                    cleaned_json = cleaned_json[3:]
                if cleaned_json.endswith("```"):
                    cleaned_json = cleaned_json[:-3]
                cleaned_json = cleaned_json.strip()
                
                data = json.loads(cleaned_json)
                
                # 2. Save to cache
                new_cache = ScrapedURL(
                    url=request.url,
                    title=data.get("title", ""),
                    company=data.get("company", ""),
                    description=data.get("description", "")
                )
                db.add(new_cache)
                db.commit()
                
                return data
            except json.JSONDecodeError:
                # Fallback to string slicing if JSON parsing fails
                raise HTTPException(status_code=500, detail="AI returned malformed JSON: " + extracted_json)
                
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to scrape URL: {str(e)}")

@router.post("/ats-check")
def run_ats_check(
    request: ATSCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    resume = db.query(Resume).filter(Resume.id == request.resume_id, Resume.user_id == current_user.id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
        
    latest_version = db.query(ResumeVersion).filter(ResumeVersion.resume_id == resume.id).order_by(ResumeVersion.version_number.desc()).first()
    if not latest_version:
        raise HTTPException(status_code=400, detail="Resume has no versions")

    raw_text = latest_version.raw_text or ""
    
    # 1. Rules-based diagnostic checks
    issues = []
    score = 100
    
    # Check for contact information
    has_email = "@" in raw_text
    has_phone = any(c.isdigit() for c in raw_text) and len([c for c in raw_text if c.isdigit()]) >= 10
    
    if not has_email:
        issues.append({
            "type": "error",
            "category": "Contact Information",
            "message": "Email address not found in resume.",
            "suggestion": "Include a professional email address (e.g., yourname@domain.com) near the header."
        })
        score -= 15
        
    if not has_phone:
        issues.append({
            "type": "warning",
            "category": "Contact Information",
            "message": "Phone number not clearly detected.",
            "suggestion": "Ensure a mobile number with country code is listed in the header."
        })
        score -= 10

    # Check for standard sections
    sections = {
        "education": ["education", "academic", "university", "college", "degree"],
        "experience": ["experience", "employment", "work history", "professional background"],
        "skills": ["skills", "technologies", "technical strengths", "expertise"]
    }
    
    for section, keywords in sections.items():
        found = any(k in raw_text.lower() for k in keywords)
        if not found:
            issues.append({
                "type": "error",
                "category": "Structure",
                "message": f"'{section.capitalize()}' section header could not be verified.",
                "suggestion": f"Create a distinct section titled '{section.capitalize()}' using a clear bold header."
            })
            score -= 15

    # Check word count / page density
    word_count = len(raw_text.split())
    if word_count < 200:
        issues.append({
            "type": "warning",
            "category": "Length",
            "message": "Resume is unusually short (under 200 words).",
            "suggestion": "Expand on your bullet points under work experience and list relevant academic projects."
        })
        score -= 10
    elif word_count > 1200:
        issues.append({
            "type": "warning",
            "category": "Length",
            "message": "Resume exceeds 1200 words.",
            "suggestion": "Keep your resume concise. Aim for a maximum of 2 pages (approx. 400-800 words)."
        })
        score -= 10

    score = max(30, score)
    
    return {
        "score": score,
        "issues": issues,
        "summary": "Your resume has a solid basic structure, but minor formatting improvements could increase parser success rates." if score > 75 else "Important layout elements are missing. Update your resume structure to prevent ATS parsing errors."
    }

@router.post("/optimize-bullet")
def optimize_bullet(
    request: BulletOptimizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    jd = db.query(JobDescription).filter(JobDescription.id == request.job_description_id, JobDescription.user_id == current_user.id).first()
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found")

    prompt = f"""
    You are an expert resume optimizer and career coach.
    I have a bullet point from my resume:
    "{request.bullet_point}"
    
    And here is the target Job Description:
    "{jd.raw_text}"
    
    Rewrite this bullet point to make it highly optimized for this job description.
    Follow these constraints:
    1. Weave in relevant technical keywords from the job description.
    2. Start with a strong action verb.
    3. Emphasize business impact or results using quantitative metrics where possible (e.g., "reduced latency by 20%", "improved accuracy by 15%").
    4. Keep it concise, professional, and limited to 1-2 lines.
    
    Return ONLY the optimized bullet point text.
    """
    
    res_text = query_llm(prompt, user_api_key=current_user.gemini_api_key)
    if not res_text:
        # Fallback if no API key or failure
        optimized = f"{request.bullet_point} (Optimized with focus on: {', '.join(jd.parsed_data.get('required_skills', [])[:3])})"
        return {"optimized_text": optimized}
        
    return {"optimized_text": res_text}

@router.post("/apply-bullet")
def apply_optimized_bullet(
    request: ApplyBulletRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    # 1. Fetch latest resume version
    resume = db.query(Resume).filter(Resume.id == request.resume_id, Resume.user_id == current_user.id).first()
    if not resume or not resume.versions:
        raise HTTPException(status_code=404, detail="Resume not found")
        
    latest_version = sorted(resume.versions, key=lambda x: x.version_number, reverse=True)[0]
    import copy
    new_data = copy.deepcopy(latest_version.extracted_data) if latest_version.extracted_data else {}
    
    # 2. Find and replace the bullet point in the extracted data
    replaced = False
    if "experience" in new_data and isinstance(new_data["experience"], list):
        for exp in new_data["experience"]:
            if "responsibilities" in exp and isinstance(exp["responsibilities"], list):
                for i, bullet in enumerate(exp["responsibilities"]):
                    if bullet.strip() == request.original_bullet.strip():
                        exp["responsibilities"][i] = request.optimized_bullet
                        replaced = True
                        break
            if replaced:
                break
                
    if not replaced:
        raise HTTPException(status_code=400, detail="Original bullet point not found in the latest resume version.")

    # --- INLINE FILE MODIFICATION ---
    try:
        import fitz
        import docx
        import os
        ext = resume.filename.split(".")[-1].lower()
        if ext == "pdf" and os.path.exists(resume.file_path):
            doc = fitz.open(resume.file_path)
            for page_idx in range(doc.page_count):
                page = doc[page_idx]
                blocks_dict = page.get_text("dict")["blocks"]
                for b in blocks_dict:
                    if "lines" not in b: continue
                    text = ""
                    for l in b["lines"]:
                        for s in l["spans"]:
                            text += s["text"]
                    
                    import re
                    def norm(s): return re.sub(r'[^a-zA-Z0-9]', '', s).lower()
                    
                    text_norm = norm(text)
                    orig_norm = norm(request.original_bullet)
                    
                    # Check if original bullet matches this block
                    if len(orig_norm) > 10 and (orig_norm in text_norm or text_norm in orig_norm):
                        rect = fitz.Rect(b["bbox"])
                        
                        from app.services.font_manager import font_manager
                        
                        # Extract font details
                        spans = [s for l in b["lines"] for s in l["spans"] if s["text"].strip()]
                        values_size = 11.0
                        values_font = "Times-Roman"
                        
                        if spans:
                            values_size = spans[0]["size"]
                            vf = spans[0]["font"]
                            sys_vf = font_manager.get_font_file(vf)
                            if not sys_vf:
                                vf = vf.lower()
                                if "helv" in vf or "arial" in vf or "sans" in vf:
                                    values_font = "Helvetica"
                                elif "cour" in vf or "mono" in vf:
                                    values_font = "Courier"
                                
                        # Create redaction box to wipe out old text
                        redact_rect = fitz.Rect(rect.x0 - 2, rect.y0 - 2, page.rect.x1 - 10, rect.y1 + 4)
                        page.add_redact_annot(redact_rect, fill=(1, 1, 1))
                        page.apply_redactions()
                        
                        # Insert new textbox which handles automatic wrapping
                        if sys_vf:
                            page.insert_textbox(redact_rect, request.optimized_bullet, fontsize=values_size, fontname="fvalues", fontfile=sys_vf)
                        else:
                            page.insert_textbox(redact_rect, request.optimized_bullet, fontsize=values_size, fontname=values_font)
            temp_path = resume.file_path + ".tmp"
            doc.save(temp_path)
            doc.close()
            os.replace(temp_path, resume.file_path)
        elif ext in ["docx", "doc"] and os.path.exists(resume.file_path):
            doc = docx.Document(resume.file_path)
            for p in doc.paragraphs:
                import re
                def norm(s): return re.sub(r'[^a-zA-Z0-9]', '', s).lower()
                p_norm = norm(p.text)
                orig_norm = norm(request.original_bullet)
                if len(orig_norm) > 10 and (orig_norm in p_norm or p_norm in orig_norm):
                    p.text = request.optimized_bullet
            doc.save(resume.file_path)
    except Exception as e:
        print(f"Error modifying bullet inline on disk: {e}")
    # --------------------------------

    # 3. Create a new ResumeVersion
    new_version_number = latest_version.version_number + 1
    new_version = ResumeVersion(
        resume_id=resume.id,
        version_number=new_version_number,
        raw_text=latest_version.raw_text,
        extracted_data=new_data
    )
    db.add(new_version)
    db.flush()  # Use flush instead of commit to get new_version.id while keeping transaction open
    
    # 4. Re-run Match Analysis with the new version
    from app.services.analyzer import analyze_resume_vs_jd
    from app.models.models import ResumeAnalysis
    
    jd = db.query(JobDescription).filter(JobDescription.id == request.job_description_id, JobDescription.user_id == current_user.id).first()
    if jd:
        analysis_results = analyze_resume_vs_jd(new_data, jd.parsed_data)
        
        # Calculate score manually similar to analyzer
        score = 0
        if analysis_results.get("skill_gap"):
            total_skills = len(analysis_results["skill_gap"])
            matched = len([s for s in analysis_results["skill_gap"] if s["status"] == "Matched"])
            score = int((matched / total_skills) * 100) if total_skills > 0 else 0
            
        new_analysis = ResumeAnalysis(
            user_id=current_user.id,
            job_description_id=jd.id,
            resume_version_id=new_version.id,
            analysis_results=analysis_results,
            match_score=score
        )
        db.add(new_analysis)
        
    db.commit() # Atomic commit for both Version and Analysis
    if jd:
        db.refresh(new_analysis)
        
    return {"status": "success", "message": "Bullet applied and analysis updated."}

@router.post("/generate-outreach")
def generate_outreach(
    request: OutreachRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    resume = db.query(Resume).filter(Resume.id == request.resume_id, Resume.user_id == current_user.id).first()
    jd = db.query(JobDescription).filter(JobDescription.id == request.job_description_id, JobDescription.user_id == current_user.id).first()
    
    if not resume or not jd:
        raise HTTPException(status_code=404, detail="Resume or Job Description not found")
        
    latest_version = db.query(ResumeVersion).filter(ResumeVersion.resume_id == resume.id).order_by(ResumeVersion.version_number.desc()).first()
    if not latest_version:
        raise HTTPException(status_code=400, detail="Resume has no versions")

    extracted = latest_version.extracted_data or {}
    personal = extracted.get("personal_info", {})
    candidate_name = personal.get("name") or current_user.full_name or "Zahi Ahmed Vakayil"
    candidate_email = personal.get("email") or current_user.email or "zahiahmedv@gmail.com"
    candidate_phone = personal.get("phone") or "+91 9778592431"
    
    company = jd.company or "Target Company"
    title = jd.title or "Software Developer"

    prompt = f"""
    You are an expert career consultant.
    Generate a professional, high-conversion Cover Letter and a LinkedIn Connection/Cold Message.
    
    Candidate Name: {candidate_name}
    Email: {candidate_email}
    Phone: {candidate_phone}
    Target Job Description:
    "{jd.raw_text}"
    
    Candidate Resume Text:
    "{latest_version.raw_text}"
    
    Format the response as a JSON object with two keys:
    "cover_letter": "string containing the full cover letter",
    "linkedin_message": "string containing the LinkedIn outreach message (under 300 characters)"
    
    Do not add any markdown formatting or surrounding explanation, return ONLY the raw JSON object.
    """
    
    import datetime
    date_str = datetime.date.today().strftime("%B %d, %Y")
    personalized_cover_letter = f"""{candidate_name}
{candidate_email} | {candidate_phone}
Date: {date_str}

To,
Hiring Team
{company}

Subject: Application for {title} position

Dear Hiring Manager,

I am writing to express my strong interest in the {title} position at {company}. As a software engineer with practical experience in designing and building scalable backend architectures, APIs, and interactive client applications, I am confident that my skills align perfectly with your team's needs.

Through my background, I have developed a strong foundation in software engineering, database design, and cloud workflows. I am highly motivated to contribute to {company}'s ongoing success and bring high-quality execution to your engineering roadmap.

Thank you for your consideration. I look forward to the possibility of discussing my application further.

Sincerely,

{candidate_name}"""

    res_text = query_llm(prompt, response_format_json=True, user_api_key=current_user.gemini_api_key)
    if not res_text:
        return {
            "cover_letter": personalized_cover_letter,
            "linkedin_message": f"Hi Hiring Team, I saw you are hiring for a {title} at {company}. Given my background in software engineering, I'd love to connect and share how my experience matches your needs."
        }
        
    try:
        data = json.loads(res_text)
        return data
    except Exception:
        return {
            "cover_letter": personalized_cover_letter,
            "linkedin_message": f"Hi Hiring Team, I saw you are hiring for a {title} at {company}. Given my background in software engineering, I'd love to connect and share how my experience matches your needs."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download-cover-letter")
def download_cover_letter(
    resume_id: int,
    job_description_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    resume = db.query(Resume).filter(Resume.id == resume_id, Resume.user_id == current_user.id).first()
    jd = db.query(JobDescription).filter(JobDescription.id == job_description_id, JobDescription.user_id == current_user.id).first()
    
    if not resume or not jd:
        raise HTTPException(status_code=404, detail="Resume or Job Description not found")
        
    latest_version = db.query(ResumeVersion).filter(ResumeVersion.resume_id == resume.id).order_by(ResumeVersion.version_number.desc()).first()
    if not latest_version:
        raise HTTPException(status_code=400, detail="Resume has no versions")

    extracted = latest_version.extracted_data or {}
    personal = extracted.get("personal_info", {})
    candidate_name = personal.get("name") or current_user.full_name or "Zahi Ahmed Vakayil"
    candidate_email = personal.get("email") or current_user.email or "zahiahmedv@gmail.com"
    candidate_phone = personal.get("phone") or "+91 9778592431"
    
    company = jd.company or "Target Company"
    title = jd.title or "Software Developer"

    openai_client = get_openai_client()
    cover_letter_content = ""
    if openai_client:
        prompt = f"""
        Generate a professional, high-conversion cover letter.
        Candidate Name: {candidate_name}
        Email: {candidate_email}
        Phone: {candidate_phone}
        Company Name: {company}
        Job Title: {title}
        Candidate Resume Details: {latest_version.raw_text}
        
        Write only the letter body text. Start directly with the date, name, and subject.
        """
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
            )
            cover_letter_content = response.choices[0].message.content.strip()
        except Exception:
            pass

    if not cover_letter_content:
        import datetime
        date_str = datetime.date.today().strftime("%B %d, %Y")
        cover_letter_content = f"""{candidate_name}
{candidate_email} | {candidate_phone}
Date: {date_str}

To,
Hiring Team
{company}

Subject: Application for {title} position

Dear Hiring Manager,

I am writing to express my strong interest in the {title} position at {company}. As a software engineer with practical experience in designing and building scalable backend architectures, APIs, and interactive client applications, I am confident that my skills align perfectly with your team's needs.

Through my background, I have developed a strong foundation in software engineering, database design, and cloud workflows. I am highly motivated to contribute to {company}'s ongoing success and bring high-quality execution to your engineering roadmap.

Thank you for your consideration. I look forward to the possibility of discussing my application further.

Sincerely,

{candidate_name}"""

    # Create PDF
    import fitz
    doc = fitz.open()
    page = doc.new_page(width=595, height=842) # A4 Size
    
    # Word wrap utility
    def draw_wrapped_text(page, text, start_x, start_y, fontname, fontsize, max_width, line_height):
        y = start_y
        paragraphs = text.split("\n")
        for para in paragraphs:
            if not para.strip():
                y += line_height
                continue
            words = para.split(" ")
            current_line = []
            for word in words:
                test_line = " ".join(current_line + [word])
                line_w = fitz.get_text_length(test_line, fontname=fontname, fontsize=fontsize)
                if line_w > max_width:
                    page.insert_text(fitz.Point(start_x, y), " ".join(current_line), fontname=fontname, fontsize=fontsize)
                    y += line_height
                    current_line = [word]
                else:
                    current_line.append(word)
            if current_line:
                page.insert_text(fitz.Point(start_x, y), " ".join(current_line), fontname=fontname, fontsize=fontsize)
                y += line_height
            y += line_height * 0.4
        return y

    draw_wrapped_text(
        page, 
        cover_letter_content, 
        start_x=54, 
        start_y=72, 
        fontname="Times-Roman", 
        fontsize=11.5, 
        max_width=487, 
        line_height=15.0
    )
    
    pdf_bytes = doc.write()
    doc.close()
    
    from fastapi.responses import Response
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Cover_Letter_{company.replace(' ', '_')}.pdf"
        }
    )

@router.get("/download-resume")
def download_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Any:
    # 2. Fetch latest resume version
    resume = db.query(Resume).filter(Resume.id == resume_id, Resume.user_id == current_user.id).first()
    if not resume or not resume.versions:
        raise HTTPException(status_code=404, detail="Resume not found")
        
    latest_version = sorted(resume.versions, key=lambda x: x.version_number, reverse=True)[0]
    
    # 3. Generate PDF
    from app.services.pdf_generator import generate_resume_pdf
    from fastapi.responses import StreamingResponse
    
    pdf_buffer = generate_resume_pdf(latest_version.extracted_data or {})
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Resume_{resume.filename or 'Optimized'}.pdf"
        }
    )

@router.post("/generate-interview")
def generate_interview(
    request: InterviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    resume = db.query(Resume).filter(Resume.id == request.resume_id, Resume.user_id == current_user.id).first()
    jd = db.query(JobDescription).filter(JobDescription.id == request.job_description_id, JobDescription.user_id == current_user.id).first()
    
    if not resume or not jd:
        raise HTTPException(status_code=404, detail="Resume or Job Description not found")
        
    latest_version = db.query(ResumeVersion).filter(ResumeVersion.resume_id == resume.id).order_by(ResumeVersion.version_number.desc()).first()
    if not latest_version:
        raise HTTPException(status_code=400, detail="Resume has no versions")

    prompt = f"""
    Analyze the candidate's resume and target Job Description. Identify the key skill gaps or critical requirements.
    Generate exactly 5 interview questions. The questions should be concise, natural, and realistic—exactly how a real interviewer would ask them (e.g., short and direct, not overly long or complex).
    
    - 3 highly tailored technical or behavioral questions designed specifically to address or explore the skill gaps.
    - 1 general question asking "Why should we hire you?" or similar.
    - 1 general question asking about salary expectations, location preferences, or availability.
    
    Target Job Description:
    "{jd.raw_text}"
    
    Candidate Resume:
    "{latest_version.raw_text}"
    
    Format the response as a JSON object with a single key:
    "questions": ["list of exactly 5 question strings"]
    
    Return only the JSON object.
    """
    
    default_questions = [
        "Tell me about a time you had to learn a new technology quickly.",
        "How do you handle performance optimization in your code?",
        "Describe a complex project you completed recently.",
        "Why should we hire you for this role over other candidates?",
        "What are your salary expectations for this position?"
    ]

    res_text = query_llm(prompt, response_format_json=True, user_api_key=current_user.gemini_api_key)
    
    questions_list = default_questions
    if res_text:
        try:
            data = json.loads(res_text)
            if "questions" in data and isinstance(data["questions"], list):
                questions_list = data["questions"]
        except Exception:
            pass

    # Save to DB
    interview = MockInterview(
        user_id=current_user.id,
        resume_id=resume.id,
        job_description_id=jd.id
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)
    
    db_questions = []
    for q_text in questions_list:
        q_obj = InterviewQuestion(
            mock_interview_id=interview.id,
            question_text=q_text
        )
        db.add(q_obj)
        db_questions.append(q_obj)
    
    db.commit()
    for q in db_questions:
        db.refresh(q)
    
    return {
        "interview_id": interview.id,
        "questions": [{"id": q.id, "text": q.question_text} for q in db_questions]
    }

@router.post("/evaluate-answer")
def evaluate_answer(
    request: EvaluateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    # Verify question exists and belongs to user
    question = db.query(InterviewQuestion).join(MockInterview).filter(
        InterviewQuestion.id == request.question_id,
        MockInterview.user_id == current_user.id
    ).first()
    
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
        
    prompt = f"""
    You are an interviewer. Evaluate the candidate's answer to the following question:
    Question: "{question.question_text}"
    Candidate's Answer: "{request.answer}"
    
    Format the response as a JSON object with these keys:
    "score": integer from 0 to 100,
    "strengths": "short string describing strengths",
    "feedback": "constructive feedback on how to improve",
    "model_answer": "an example of an excellent model response to this question"
    
    Return only the JSON object.
    """
    
    # Rule-based offline smart evaluator setup for fallback
    ans_lower = request.answer.lower().strip()
    ans_len = len(ans_lower)
    negatives = ["forgot", "haven't done", "havent done", "don't know", "dont know", "no idea", "none", "nothing", "no", "na"]
    has_negative = any(neg in ans_lower for neg in negatives)
    
    if ans_len < 10 or has_negative:
        fallback_score = 15 if ans_len < 10 else 25
        fallback_strengths = "Direct response."
        fallback_feedback = "The answer is too brief or indicates you lack familiarity with the topic. In a real interview, if you don't know the answer, explain how you would research it or discuss a similar concept you have worked on rather than giving up."
        fallback_model_answer = "To handle database optimization, I begin by analyzing slow queries using EXPLAIN plans, indexing key search columns, implementing caching layers like Redis, and normalizing/denormalizing structures based on read-vs-write ratios."
    else:
        tech_keywords = ["python", "react", "next.js", "docker", "kubernetes", "sql", "aws", "git", "api", "database", "index", "flask", "django"]
        matched_tech = [k for k in tech_keywords if k in ans_lower]
        fallback_score = 55 + min(35, len(matched_tech) * 10 + min(15, ans_len // 20))
        fallback_strengths = "Includes technical terminology and describes the workflow."
        fallback_feedback = f"Good attempt. You mentioned: {', '.join(matched_tech) if matched_tech else 'practical work'}. To improve, structure your answer using the STAR method, and add more quantitative metrics showing the business outcomes of your decisions."
        fallback_model_answer = "For software engineering projects, I structured our microservices with FastAPI and React, automated deployments via Docker/CI pipelines, which reduced release cycles by 30% and improved team collaboration."

    res_text = query_llm(prompt, response_format_json=True, user_api_key=current_user.gemini_api_key)
    eval_data = {
        "score": fallback_score,
        "strengths": fallback_strengths,
        "feedback": fallback_feedback,
        "model_answer": fallback_model_answer
    }
    
    if res_text:
        try:
            data = json.loads(res_text)
            eval_data = data
        except Exception:
            pass

    # Save to DB
    question.candidate_answer = request.answer
    question.score = eval_data.get("score", fallback_score)
    question.feedback = eval_data.get("feedback", fallback_feedback)
    question.model_answer = eval_data.get("model_answer", fallback_model_answer)
    db.commit()
    
    return eval_data

@router.get("/interviews")
def get_interviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    interviews = db.query(MockInterview).filter(
        MockInterview.user_id == current_user.id
    ).order_by(MockInterview.created_at.desc()).all()
    
    result = []
    for interview in interviews:
        questions = []
        for q in interview.questions:
            questions.append({
                "id": q.id,
                "text": q.question_text,
                "answer": q.candidate_answer,
                "score": q.score,
                "feedback": q.feedback,
                "model_answer": q.model_answer
            })
            
        result.append({
            "id": interview.id,
            "resume_id": interview.resume_id,
            "job_description_id": interview.job_description_id,
            "created_at": interview.created_at,
            "questions": questions
        })
        
    return result
