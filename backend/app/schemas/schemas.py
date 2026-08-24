from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[int] = None

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: bool = False
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = "gemini-flash-lite-latest"

class UserCreate(UserBase):
    password: str

class UserUpdate(UserBase):
    password: Optional[str] = None

class UserApiKeyUpdate(BaseModel):
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None

class UserResponse(UserBase):
    id: int
    created_at: datetime
    is_superuser: bool
    gemini_api_key: Optional[str] = None

    class Config:
        from_attributes = True

# Resume Version Schemas
class ResumeVersionBase(BaseModel):
    version_number: int
    raw_text: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None

class ResumeVersionResponse(ResumeVersionBase):
    id: int
    resume_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Resume Schemas
class ResumeBase(BaseModel):
    filename: str

class ResumeResponse(ResumeBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    versions: List[ResumeVersionResponse] = []

    class Config:
        from_attributes = True

# Job Description Schemas
class JobDescriptionBase(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    raw_text: str

class JobDescriptionCreate(JobDescriptionBase):
    pass

class JobDescriptionResponse(JobDescriptionBase):
    id: int
    user_id: int
    parsed_data: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Resume Analysis Schemas
class ResumeAnalysisResponse(BaseModel):
    id: int
    user_id: int
    resume_version_id: int
    job_description_id: int
    ats_score: Optional[int] = None
    match_score: Optional[int] = None
    analysis_results: Optional[Dict[str, Any]] = None
    created_at: datetime
    job_description: Optional[JobDescriptionResponse] = None
    resume_version: Optional[ResumeVersionResponse] = None

    class Config:
        from_attributes = True

class AnalysisRequest(BaseModel):
    resume_id: int
    job_description_id: int

class OptimizeRequest(BaseModel):
    resume_id: int
    job_description_id: int
    skills_to_add: List[str]

# Resume Builder Schemas
class DesignConfig(BaseModel):
    template_style: str = "classic"
    font_family: str = "Helvetica"
    font_size: float = 11.0
    margin: float = 36.0
    section_order: List[str] = ["summary", "experience", "education", "projects", "skills", "custom_sections"]

class PersonalInfo(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = ""
    location: Optional[str] = ""
    linkedin: Optional[str] = ""
    github: Optional[str] = ""
    portfolio: Optional[str] = ""

class EducationItem(BaseModel):
    institution: str
    degree: str
    location: Optional[str] = ""
    date: str
    gpa: Optional[str] = ""
    bullets: List[str] = []

class ExperienceItem(BaseModel):
    company: str
    role: str
    location: Optional[str] = ""
    date: str
    bullets: List[str] = []

class ProjectItem(BaseModel):
    name: str
    technologies: str
    date: Optional[str] = ""
    link: Optional[str] = ""
    bullets: List[str] = []

class SkillCategory(BaseModel):
    category: str
    skills: str

class CustomSection(BaseModel):
    heading: str
    body: str

class ResumeBuildRequest(BaseModel):
    design: DesignConfig
    personal: PersonalInfo
    summary: Optional[str] = ""
    education: List[EducationItem] = []
    experience: List[ExperienceItem] = []
    projects: List[ProjectItem] = []
    skills: List[SkillCategory] = []
    custom_sections: List[CustomSection] = []
    custom_html: Optional[str] = None

# Job Application Tracker Schemas
class JobApplicationBase(BaseModel):
    job_description_id: Optional[int] = None
    job_title: str
    company: str
    url: Optional[str] = None
    status: Optional[str] = "Saved"
    notes: Optional[str] = None
    location: Optional[str] = None
    application_method: Optional[str] = None
    contact_person: Optional[str] = None
    contact_url: Optional[str] = None
    work_mode: Optional[str] = None
    job_type: Optional[str] = None
    interview_date: Optional[datetime] = None
    resume_id: Optional[int] = None
    follow_up_date: Optional[datetime] = None
    priority: Optional[str] = None
    target_salary: Optional[str] = None
    offered_salary: Optional[str] = None
    is_archived: Optional[bool] = False
    insights: Optional[Dict[str, Any]] = None
    brag_sheet: Optional[Dict[str, Any]] = None

class JobApplicationCreate(JobApplicationBase):
    pass

class JobApplicationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    location: Optional[str] = None
    application_method: Optional[str] = None
    contact_person: Optional[str] = None
    contact_url: Optional[str] = None
    work_mode: Optional[str] = None
    job_type: Optional[str] = None
    interview_date: Optional[datetime] = None
    resume_id: Optional[int] = None
    follow_up_date: Optional[datetime] = None
    priority: Optional[str] = None
    target_salary: Optional[str] = None
    offered_salary: Optional[str] = None
    is_archived: Optional[bool] = None
    insights: Optional[Dict[str, Any]] = None
    brag_sheet: Optional[Dict[str, Any]] = None

class JobApplicationHistoryResponse(BaseModel):
    id: int
    previous_status: Optional[str]
    new_status: str
    changed_at: datetime

    class Config:
        from_attributes = True

class JobApplicationResponse(JobApplicationBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    history: List[JobApplicationHistoryResponse] = []

    class Config:
        from_attributes = True
