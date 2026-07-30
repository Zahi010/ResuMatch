import os
import json
import re
import fitz  # PyMuPDF
import docx
from typing import Dict, Any, List, Optional
from openai import OpenAI
from app.core.config import settings
from app.core.llm import query_llm

TECH_KEYWORDS = [
    # Programming & Tech
    "Python", "JavaScript", "TypeScript", "React", "Next.js", "Vue", "Angular", 
    "Node.js", "Express", "FastAPI", "Django", "Flask", "Kubernetes", "Docker", 
    "AWS", "GCP", "Azure", "Spring", "C++", "C#", "Golang", "Go", "Java", "Rust", "Terraform", 
    "CI/CD", "Git", "HTML", "CSS", "Tailwind", "GraphQL", "REST API", "Microservices", 
    "PyTorch", "TensorFlow", "Scikit-Learn", "Pandas", "Numpy", "Machine Learning", 
    "Deep Learning", "NLP", "Distributed Systems", "Cloud-Native", "Data Structures", 
    "Algorithms", "System Design",
    
    # Data & Analytics
    "SQL", "NoSQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Oracle", "Teradata", "DB2", 
    "SQL Server", "Informatica", "IDQ", "Power BI", "Tableau", "ETL", "ELT", 
    "Data Warehousing", "Data Governance", "Data Quality", "Excel", "Data Lineage",
    "BCBS 239", "Basel III", "AML", "KYC"
]

def extract_text_from_pdf(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    return text

def extract_text_from_docx(file_bytes: bytes) -> str:
    import io
    doc = docx.Document(io.BytesIO(file_bytes))
    return "\n".join([paragraph.text for paragraph in doc.paragraphs])

def extract_text(file_bytes: bytes, filename: str) -> str:
    ext = filename.split(".")[-1].lower()
    if ext == "pdf":
        return extract_text_from_pdf(file_bytes)
    elif ext in ["docx", "doc"]:
        return extract_text_from_docx(file_bytes)
    else:
        return file_bytes.decode("utf-8", errors="ignore")

def match_skill_with_flexibility(kw: str, text: str) -> bool:
    # If keyword has spaces or punctuation, normalize both keyword and text and check substring
    if any(char in kw for char in [" ", ".", "-", "/"]):
        kw_clean = re.sub(r'[^a-zA-Z0-9]', '', kw).lower()
        text_clean = re.sub(r'[^a-zA-Z0-9]', '', text).lower()
        return kw_clean in text_clean
        
    # Standard keyword match with word boundaries
    pattern = re.escape(kw)
    return bool(re.search(r'\b' + pattern + r'\b', text, re.IGNORECASE))

def heuristic_parse_resume(raw_text: str) -> Dict[str, Any]:
    # Extract email (support spacing formats like user @ domain . com)
    email_match = re.search(r'[a-zA-Z0-9_.+-]+\s*@\s*[a-zA-Z0-9-]+\s*\.\s*[a-zA-Z0-9-.]+', raw_text)
    email = ""
    if email_match:
        # Strip all whitespace from the matched email
        email = re.sub(r'\s+', '', email_match.group(0))
    
    # Extract skills by scanning tech keywords
    skills = []
    for kw in TECH_KEYWORDS:
        if match_skill_with_flexibility(kw, raw_text):
            skills.append(kw)
            
    # Extract name (heuristic: first non-empty line)
    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
    name = lines[0] if lines else "Extracted Candidate"
    
    # Extract years of experience (look for "X years of experience" or similar)
    exp_matches = re.findall(r'(\d+)(?:\s*(?:-|–|to)\s*\d+)?\+?\s*years?(?:\s+(?:of\s+)?experience|\s+exp\b)', raw_text, re.IGNORECASE)
    exp_years = 0
    if exp_matches:
        try:
            exp_years = max(int(m) for m in exp_matches)
        except ValueError:
            pass

    return {
        "name": name,
        "email": email,
        "phone": "",
        "location": "",
        "linkedin": "",
        "github": "",
        "portfolio": "",
        "summary": "Candidate profile extracted via rule-based matching.",
        "skills": skills if skills else ["SQL", "Excel", "Data Quality"],
        "experience": [],
        "education": [],
        "projects": [],
        "certifications": [],
        "experience_years": exp_years
    }

def heuristic_parse_jd(raw_text: str) -> Dict[str, Any]:
    # Extract skills
    skills = []
    for kw in TECH_KEYWORDS:
        if match_skill_with_flexibility(kw, raw_text):
            skills.append(kw)
            
    # Heuristic for title (first line)
    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
    title = lines[0] if lines else "Data Quality Analyst"
    
    # Extract years of experience required (look for "10 years", "3+ years", "5 to 7 years")
    exp_matches = re.findall(r'(\d+)(?:\s*(?:-|–|to)\s*\d+)?\+?\s*years?', raw_text, re.IGNORECASE)
    exp_required = 0
    if exp_matches:
        try:
            exp_required = max(int(m) for m in exp_matches)
        except ValueError:
            pass

    # Split matches into required and preferred dynamically
    if len(skills) >= 2:
        split_idx = max(1, int(len(skills) * 0.7))
        req_skills = skills[:split_idx]
        pref_skills = skills[split_idx:]
    else:
        req_skills = skills if skills else ["SQL"]
        pref_skills = ["Data Governance", "Informatica"]

    return {
        "title": title[:60] if len(title) > 60 else title,
        "company": "Target Company",
        "required_skills": req_skills,
        "preferred_skills": pref_skills,
        "responsibilities": ["Profile data", "Ensure compliance with banking frameworks"],
        "experience_required": f"{exp_required}+ years",
        "education_requirements": "Bachelor's Degree",
        "tools_frameworks": req_skills[:3],
        "location": "Remote",
        "employment_type": "Full-time",
        "experience_years": exp_required
    }

def parse_resume_with_ai(resume_text: str, user_api_key: Optional[str] = None, user_model: Optional[str] = None) -> Dict[str, Any]:
    api_key = user_api_key if user_api_key else settings.GEMINI_API_KEY
    
    if not api_key and not settings.OPENAI_API_KEY:
        return heuristic_parse_resume(resume_text)
    
    prompt = f"""
    You are an expert ATS (Applicant Tracking System) parser. Analyze the following raw resume text and extract structured information.
    Format your response as a valid JSON object with the following keys:
    - name: String
    - email: String
    - phone: String
    - location: String
    - linkedin: String
    - github: String
    - portfolio: String
    - summary: String
    - skills: List of Strings
    - experience: List of Objects (company, role, start_date, end_date, description, responsibilities: list of strings)
    - education: List of Objects (institution, degree, major, graduation_date, gpa)
    - projects: List of Objects (title, description, technologies: list of strings)
    - certifications: List of Strings

    Raw Resume Text:
    {resume_text}
    """
    
    try:
        response_text = query_llm(prompt, response_format_json=True, user_api_key=user_api_key, user_model=user_model)
        return json.loads(response_text)
    except Exception as e:
        if "Rate Limit Exceeded" in str(e):
            raise e
        print(f"Error parsing resume with LLM: {e}")
        return heuristic_parse_resume(resume_text)

def parse_job_description_with_ai(jd_text: str, user_api_key: Optional[str] = None, user_model: Optional[str] = None) -> Dict[str, Any]:
    api_key = user_api_key if user_api_key else settings.GEMINI_API_KEY
    if not api_key and not settings.OPENAI_API_KEY:
        return heuristic_parse_jd(jd_text)
    
    prompt = f"""
    Analyze the following Job Description and extract key requirements.
    Format your response as a valid JSON object with the following keys:
    - title: String
    - company: String
    - required_skills: List of Strings
    - preferred_skills: List of Strings
    - responsibilities: List of Strings
    - experience_required: String (e.g. "3+ years")
    - education_requirements: String
    - tools_frameworks: List of Strings
    - location: String
    - employment_type: String

    Job Description:
    {jd_text}
    """
    
    try:
        response_text = query_llm(prompt, response_format_json=True, user_api_key=user_api_key, user_model=user_model)
        return json.loads(response_text)
    except Exception as e:
        if "Rate Limit Exceeded" in str(e):
            raise e
        print(f"Error parsing job description with LLM: {e}")
        return heuristic_parse_jd(jd_text)
