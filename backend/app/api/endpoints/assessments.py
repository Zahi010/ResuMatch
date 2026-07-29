from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.core.llm import query_llm
from app.models.models import User, JobDescription

router = APIRouter()

class GenerateAptitudeRequest(BaseModel):
    job_description_id: int

class GenerateEnglishRequest(BaseModel):
    job_description_id: int

class EvaluateRequest(BaseModel):
    question_type: str  # 'aptitude' or 'english'
    question: str
    user_answer: str

@router.post("/aptitude/generate")
def generate_aptitude(
    request: GenerateAptitudeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    jd = db.query(JobDescription).filter(JobDescription.id == request.job_description_id, JobDescription.user_id == current_user.id).first()
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found")
        
    prompt = f"""
    You are an expert recruiter and technical assessor. Generate 5 multiple-choice aptitude and logical reasoning questions tailored for a candidate applying to this role.
    Role: {jd.title or 'Professional'}
    Company: {jd.company or 'Unknown'}
    
    Make the questions challenging but fair. Format your response as a JSON array of objects, where each object has:
    - "question": The question text
    - "options": An array of exactly 4 possible answers
    - "correct_answer": The exact text of the correct option
    - "explanation": A brief explanation of why it is correct
    """
    
    try:
        import json
        res = query_llm(prompt, response_format_json=True, user_api_key=current_user.gemini_api_key)
        questions = json.loads(res)
        if isinstance(questions, dict) and "questions" in questions:
            questions = questions["questions"]
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate aptitude test: {str(e)}")


@router.post("/english/generate")
def generate_english(
    request: GenerateEnglishRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    jd = db.query(JobDescription).filter(JobDescription.id == request.job_description_id, JobDescription.user_id == current_user.id).first()
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found")
        
    prompt = f"""
    You are an expert communications assessor. Generate a realistic workplace scenario for the following role that requires the candidate to write a professional email or message.
    Role: {jd.title or 'Professional'}
    Company: {jd.company or 'Unknown'}
    
    Format your response as a JSON object with:
    - "scenario": The background context (e.g. "A client is upset about a delayed delivery...")
    - "task": The specific instruction (e.g. "Draft an email to the client apologizing and offering a solution.")
    """
    
    try:
        import json
        res = query_llm(prompt, response_format_json=True, user_api_key=current_user.gemini_api_key)
        return json.loads(res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate English scenario: {str(e)}")


@router.post("/evaluate")
def evaluate_answer(
    request: EvaluateRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    if request.question_type == 'english':
        prompt = f"""
        You are an expert English communications coach. Evaluate the user's written response to the following scenario/task.
        Scenario/Task: {request.question}
        User's Response: {request.user_answer}
        
        Provide a JSON object with:
        - "score": A score out of 100 for grammar, tone, and clarity.
        - "feedback": A paragraph of constructive feedback.
        - "corrections": A rewritten, polished version of their response.
        """
    else:
        # Aptitude is graded on the frontend, but we can provide a generic evaluate if needed.
        return {"error": "Aptitude should be evaluated on the frontend."}
        
    try:
        import json
        res = query_llm(prompt, response_format_json=True, user_api_key=current_user.gemini_api_key)
        return json.loads(res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to evaluate answer: {str(e)}")
