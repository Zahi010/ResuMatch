import json
from typing import Dict, Any, Optional
from app.core.config import settings
from app.core.llm import query_llm

def generate_job_insights(job_text: str, user_api_key: Optional[str] = None, user_model: Optional[str] = None) -> Dict[str, Any]:
    prompt = f"""
    Analyze the following Job Description and provide a highly structured JSON response.
    Extract the tech stack, responsibilities (summarized without corporate fluff), and any potential red flags or green flags.
    
    Response format must be valid JSON matching this schema:
    {{
        "tech_stack": ["Skill 1", "Skill 2"],
        "responsibilities": ["Responsibility 1", "Responsibility 2"],
        "red_flags": ["Red flag 1"],
        "green_flags": ["Green flag 1"]
    }}
    
    Job Description:
    {job_text}
    """
    response_text = query_llm(prompt, response_format_json=True, user_api_key=user_api_key, user_model=user_model)
    try:
        return json.loads(response_text)
    except:
        return {"tech_stack": [], "responsibilities": ["Could not parse JD"], "red_flags": [], "green_flags": []}

def estimate_salary(job_text: str, resume_text: str, user_api_key: Optional[str] = None, user_model: Optional[str] = None) -> str:
    prompt = f"""
    You are an expert tech recruiter and salary negotiator.
    Read the following Job Description and the candidate's Resume.
    Based on the seniority implied by the job requirements AND the specific years of experience/skills present on the resume, estimate a realistic target salary for this candidate applying to this role.
    Provide your answer as a simple string range in USD, e.g., "$120k - $140k" or "Not enough data". Only return the string, no other text.
    
    Job Description:
    {job_text}
    
    Candidate Resume:
    {resume_text}
    """
    response_text = query_llm(prompt, response_format_json=False, user_api_key=user_api_key, user_model=user_model)
    return response_text.strip().replace('"', '')

def generate_brag_sheet(job_text: str, resume_text: str, user_api_key: Optional[str] = None, user_model: Optional[str] = None) -> Dict[str, Any]:
    prompt = f"""
    You are an expert interview coach. Based on the provided Job Description and Candidate Resume, identify the TOP 3 projects, experiences, or achievements from the resume that the candidate absolutely MUST bring up in the interview for this specific role.
    
    Provide the response in valid JSON matching this schema:
    {{
        "talking_points": [
            {{
                "project_or_experience": "Name of project/role",
                "why_it_matters": "Why this aligns perfectly with the JD requirements",
                "star_method_summary": "A 1-sentence suggested STAR method pitch"
            }}
        ]
    }}
    
    Job Description:
    {job_text}
    
    Candidate Resume:
    {resume_text}
    """
    response_text = query_llm(prompt, response_format_json=True, user_api_key=user_api_key, user_model=user_model)
    try:
        return json.loads(response_text)
    except:
        return {"talking_points": []}
