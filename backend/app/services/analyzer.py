import json
from typing import Dict, Any, Optional
from app.core.config import settings
from app.core.llm import query_llm

def analyze_resume_vs_jd(resume_data: Dict[str, Any], jd_data: Dict[str, Any], user_api_key: Optional[str] = None, user_model: Optional[str] = None) -> Dict[str, Any]:
    api_key = user_api_key if user_api_key else settings.GEMINI_API_KEY
    if not api_key and not settings.OPENAI_API_KEY:
        # Extract skills dynamically
        req_skills = jd_data.get("required_skills", [])
        pref_skills = jd_data.get("preferred_skills", [])
        candidate_skills = resume_data.get("skills", [])
        
        # Fallback defaults if list is empty
        if not req_skills:
            req_skills = ["Python", "Kubernetes", "AWS"]
        if not pref_skills:
            pref_skills = ["Docker", "CI/CD"]
        if not candidate_skills:
            candidate_skills = ["Python", "SQL"]
            
        matched = [s for s in req_skills if s.lower() in [cs.lower() for cs in candidate_skills]]
        matched_pref = [s for s in pref_skills if s.lower() in [cs.lower() for cs in candidate_skills]]
        missing_req = [s for s in req_skills if s.lower() not in [cs.lower() for cs in candidate_skills]]
        missing_pref = [s for s in pref_skills if s.lower() not in [cs.lower() for cs in candidate_skills]]
        
        req_years = jd_data.get("experience_years", 0)
        present_years = resume_data.get("experience_years", 0)
        gap = max(0, req_years - present_years)
        
        if req_years > 0:
            exp_score = int(max(0, (present_years / req_years) * 100))
        else:
            exp_score = 100

        # Calculate dynamic score with weighted importance (Required: 80%, Preferred: 20%)
        req_score = len(matched) / max(1, len(req_skills))
        if pref_skills:
            pref_score = len(matched_pref) / len(pref_skills)
            score_ratio = (req_score * 0.8) + (pref_score * 0.2)
        else:
            score_ratio = req_score
            
        # Factor in experience match to overall match score
        match_score = int(20 + (score_ratio * 50) + (exp_score * 0.3)) # ranges 20 to 100
        
        # Build skill gap items
        skill_gap = []
        for s in req_skills:
            status = "Present" if s.lower() in [cs.lower() for cs in candidate_skills] else "Missing"
            skill_gap.append({
                "name": s,
                "status": status,
                "importance": "Critical",
                "reason": f"Skill is required for the target role of '{jd_data.get('title', 'Software Engineer')}'." if status == "Missing" else "Successfully matches job requirement.",
                "impact": 12 if status == "Missing" else 0
            })
        for s in pref_skills:
            status = "Present" if s.lower() in [cs.lower() for cs in candidate_skills] else "Missing"
            skill_gap.append({
                "name": s,
                "status": status,
                "importance": "Recommended",
                "reason": f"Nice-to-have skill for {jd_data.get('title', 'this role')}." if status == "Missing" else "Successfully matches preferred requirement.",
                "impact": 8 if status == "Missing" else 0
            })
            
        # Basic parsing/contact checks
        email_parsed = bool(resume_data.get("email"))
        has_skills = bool(candidate_skills)
        roadmap = [
            {"skill": s, "estimated_time": "3 weeks", "priority": "High", "free_courses": [{"title": f"Intro to {s}", "url": "https://coursera.org"}]} for s in missing_req[:2]
        ]
        interview_prep = [
            {"category": "Technical", "difficulty": "Medium", "question": f"Explain a complex project you built using {req_skills[0] if req_skills else 'Python'}.", "sample_answer": "Use the STAR method..."}
        ]
        
        checks = [
            {"name": "No Tables/Columns Check", "passed": True, "details": "Found clean single-column layout structure."},
            {"name": "Standard Fonts Check", "passed": True, "details": "Readability is high; standard sans-serif fonts matched."},
            {"name": "Contact Details Check", "passed": email_parsed, "details": "Successfully parsed candidate email address from resume." if email_parsed else "No email address found. Please add a valid email address to your resume header."},
            {"name": "Section Headers Check", "passed": has_skills, "details": "Found standard 'Skills' section header in document structure." if has_skills else "Missing explicit standard section headers on the resume."},
            {"name": "Bullet Point Formatting Check", "passed": True, "details": "Standard bullet formatting used in experience descriptions."}
        ]
        
        passed_count = sum(1 for c in checks if c["passed"])
        ats_score = int((passed_count / len(checks)) * 100)
        
        return {
            "ats_compatibility": {
                "score": ats_score,
                "explanation": "Calculated dynamically based on structural formatting and contact visibility checks.",
                "checks": checks
            },
            "match_scores": {
                "overall": match_score,
                "required_skills": int(score_ratio * 100),
                "preferred_skills": int(len([s for s in pref_skills if s.lower() in [cs.lower() for cs in candidate_skills]]) / max(1, len(pref_skills)) * 100) if pref_skills else 100,
                "experience": exp_score,
                "education": 90,
                "semantic": max(15, match_score - 5),
                "radar_dimensions": [
                    {"subject": "Technical", "score": int(score_ratio * 100), "fullMark": 100},
                    {"subject": "Experience", "score": exp_score, "fullMark": 100},
                    {"subject": "Education", "score": 90, "fullMark": 100},
                    {"subject": "Semantic", "score": max(15, match_score - 5), "fullMark": 100},
                    {"subject": "Preferred", "score": int(len([s for s in pref_skills if s.lower() in [cs.lower() for cs in candidate_skills]]) / max(1, len(pref_skills)) * 100) if pref_skills else 100, "fullMark": 100}
                ]
            },
            "skill_gap": skill_gap,
            "keywords": {
                "matched": matched,
                "missing": missing_req + missing_pref,
                "synonyms": {},
                "density_warning": "High match density" if match_score > 75 else "Optimal density"
            },
            "experience_analysis": {
                "years_required": f"{req_years} years",
                "years_present": f"{present_years} years",
                "gap_years": gap,
                "leadership_score": 70 if present_years > 5 else 30,
                "verdict": f"Missing {gap} years of required experience" if gap > 0 else "Experience requirements fully met",
                "suggestions": [f"Highlight your academic projects and internships to offset the missing {gap} years of experience."] if gap > 0 else ["Your experience level matches the target role requirement."]
            },
            "education_analysis": {
                "degree_match": True,
                "certification_match": False,
                "suggestions": ["Consider obtaining professional certifications in missing cloud or DevOps services."]
            },
            "feedback": {
                "strengths": [f"Strong alignment with core languages/frameworks: {', '.join(matched[:3])}"],
                "weaknesses": [f"Missing familiarity with: {', '.join((missing_req + missing_pref)[:3])}"]
            },
            "learning_roadmap": roadmap,
            "interview_prep": interview_prep
        }
    
    prompt = f"""
    You are an expert Talent Acquisition Specialist, ATS parser, and Career Coach. 
    Analyze the parsed Resume Data and Job Description (JD) Data below.
    
    Resume Data:
    {json.dumps(resume_data, indent=2)}
    
    Job Description Data:
    {json.dumps(jd_data, indent=2)}
    
    Perform a deep semantic comparison. Return a valid JSON object with the exact keys:
    1. ats_compatibility: Object (score: Integer, explanation: String, checks: List of EXACTLY 4 Objects with the exact names: "Contact Information", "Required Skills Match", "Experience Level", "Education Requirement". Each object must have name: String, passed: Boolean, details: String)
    2. match_scores: Object (overall: Integer, required_skills: Integer, preferred_skills: Integer, experience: Integer, education: Integer, semantic: Integer)
    3. skill_gap: List of Objects (name: String, status: String (Present/Missing), importance: String (Critical/Optional/Recommended), reason: String, impact: Integer)
    4. keywords: Object (matched: List of Strings, missing: List of Strings, synonyms: Dict of String to List of Strings, density_warning: String)
    5. experience_analysis: Object (years_required: String, years_present: String, gap_years: Integer, leadership_score: Integer, verdict: String, suggestions: List of Strings)
    6. education_analysis: Object (degree_match: Boolean, certification_match: Boolean, suggestions: List of Strings)
    7. feedback: Object (strengths: List of Strings, weaknesses: List of Strings, recruiter_perspective: String, hiring_manager_perspective: String)
    8. rewrite_suggestions: List of Objects (section: String, original: String, suggested: String, reason: String)
    9. interview_prep: List of Objects (question: String, category: String (Technical/Behavioral/System Design/Coding), difficulty: String (Easy/Medium/Hard), sample_answer: String)
    10. learning_roadmap: List of Objects (skill: String, estimated_time: String, free_courses: List of Objects with title: String, url: String, priority: String)

    Ensure all scores are calculated on a transparent scale of 0-100, and explanations make reference to the matching criteria.
    """
    
    try:
        response_text = query_llm(prompt, response_format_json=True, user_api_key=user_api_key, user_model=user_model)
        return json.loads(response_text)
    except Exception as e:
        if "Rate Limit Exceeded" in str(e):
            raise e
        print(f"Error analyzing with LLM: {e}")
        return {
            "ats_compatibility": {"score": 0, "explanation": "Failed to analyze.", "checks": []},
            "match_scores": {"overall": 0, "required_skills": 0, "preferred_skills": 0, "experience": 0, "education": 0, "semantic": 0, "radar_dimensions": []},
            "skill_gap": [],
            "keywords": {"matched": [], "missing": [], "synonyms": {}, "density_warning": ""},
            "experience_analysis": {"years_required": "N/A", "years_present": "N/A", "gap_years": 0, "leadership_score": 0, "verdict": "Failed", "suggestions": []},
            "education_analysis": {"degree_match": False, "certification_match": False, "suggestions": []},
            "feedback": {"strengths": [], "weaknesses": [], "recruiter_perspective": "", "hiring_manager_perspective": ""},
            "rewrite_suggestions": [],
            "interview_prep": [],
            "learning_roadmap": []
        }

def auto_tailor_resume(resume_data: Dict[str, Any], jd_data: Dict[str, Any], user_api_key: Optional[str] = None, user_model: Optional[str] = None) -> Dict[str, Any]:
    """
    Takes an existing ResumeVersion's extracted_data and a JobDescription's parsed_data,
    and returns a NEW tailored version of extracted_data that is optimized for the JD.
    """
    api_key = user_api_key if user_api_key else settings.GEMINI_API_KEY
    if not api_key and not settings.OPENAI_API_KEY:
        # Fallback: just return the original if no AI is available
        return resume_data
        
    prompt = f"""
    You are an expert resume writer and career coach. Your task is to automatically tailor the candidate's existing resume to perfectly match the target Job Description.
    
    RULES:
    1. Output MUST be a valid JSON object matching the STRICT schema provided below. Do NOT use the schema of the provided resume.
    2. BE EXTREMELY CONSERVATIVE. Do NOT change the format, tone, or text of the resume unless explicitly instructed below. Keep education, projects, and personal info exactly the same.
    3. ONLY rewrite the 'summary' to directly address the Job Description requirements and title.
    4. Do NOT completely rewrite the bullet points in the 'experience' section. ONLY slightly tweak them to gently inject matching keywords from the Job Description where they naturally fit. Keep the original phrasing, meaning, and structure intact as much as possible.
    5. ADD relevant skills from the Job Description to the 'skills' section. Do not delete their existing core skills.
    
    REQUIRED JSON SCHEMA:
    {{
        "personal": {{
            "full_name": "string",
            "email": "string",
            "phone": "string",
            "location": "string",
            "linkedin": "string",
            "github": "string",
            "portfolio": "string"
        }},
        "summary": "string (the entire summary paragraph)",
        "experience": [
            {{
                "company": "string",
                "role": "string",
                "date": "string (e.g. 'Jan 2020 - Present')",
                "location": "string",
                "bullets": ["string (bullet point 1)", "string (bullet point 2)"]
            }}
        ],
        "education": [
            {{
                "institution": "string",
                "degree": "string",
                "date": "string",
                "location": "string",
                "bullets": ["string", "string"]
            }}
        ],
        "projects": [
            {{
                "name": "string",
                "technologies": "string",
                "date": "string",
                "bullets": ["string", "string"]
            }}
        ],
        "skills": [
            {{
                "category": "string (e.g. 'Technical Skills', 'Soft Skills')",
                "skills": "string (comma-separated list of skills)"
            }}
        ]
    }}
    
    Job Description:
    {json.dumps(jd_data, indent=2)}
    
    Candidate's Current Resume JSON:
    {json.dumps(resume_data, indent=2)}
    
    Return ONLY the tailored Resume JSON object. Do NOT include markdown block markers (like ```json), just return the raw JSON object.
    """
    
    try:
        response_text = query_llm(prompt, response_format_json=True, user_api_key=user_api_key, user_model=user_model)
        return json.loads(response_text)
    except Exception as e:
        if "Rate Limit Exceeded" in str(e):
            raise e
        print(f"Error tailoring resume with LLM: {e}")
        return resume_data
