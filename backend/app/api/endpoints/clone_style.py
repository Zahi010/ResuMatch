from fastapi import APIRouter, File, UploadFile, HTTPException, Form, Depends
from pydantic import BaseModel
from typing import Optional, List
import fitz
import base64
import json

from app.core.llm import query_llm_vision
from app.services.parser import heuristic_parse_resume
from app.api.deps import get_current_user, get_db
from app.models.models import User
from sqlalchemy.orm import Session
from app.services.usage import track_usage

router = APIRouter()

class CloneResponse(BaseModel):
    design: dict
    parsed_content: Optional[dict] = None
    custom_html: Optional[str] = None

@router.post("", response_model=CloneResponse)
async def clone_style(
    file: UploadFile = File(...),
    extract_content: bool = Form(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyzes an uploaded PDF or Image, extracts layout information using Gemini Vision,
    and optionally extracts text content.
    """
    try:
        content = await file.read()
        
        # 1. Convert to Image
        base64_image = ""
        mime_type = "image/png"
        
        if file.filename.lower().endswith(".pdf"):
            base64_image = base64.b64encode(content).decode('utf-8')
            mime_type = "application/pdf"
        elif file.filename.lower().split('.')[-1] in ["png", "jpg", "jpeg", "webp"]:
            base64_image = base64.b64encode(content).decode('utf-8')
            if file.filename.lower().endswith(".jpg") or file.filename.lower().endswith(".jpeg"):
                mime_type = "image/jpeg"
            elif file.filename.lower().endswith(".webp"):
                mime_type = "image/webp"
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload PDF, PNG, or JPG.")

        # 2. Extract Design Strategy using Vision Model
        prompt = """
        You are a highly capable UI/UX and Typography expert. I have provided an image of a resume.
        Analyze the layout and typography of this resume.
        
        Infer the closest matching values for the following parameters based on our design system:
        
        1. template_style:
           - "classic": Uses horizontal lines to divide sections. Left aligned.
           - "modern": Centers the name and personal info, uses lots of whitespace, centers section headers.
           - "minimal": Stripped down, clean, left-aligned, no horizontal lines under sections.
           - "custom": Any layout that differs significantly from the above (e.g., 2 columns, unique header styling, missing underlines where expected, custom icons).
        
        2. font_family:
           - "helvetica" (Clean, standard sans-serif)
           - "arial" (Modern sans-serif)
           - "calibri" (Sleek sans-serif)
           - "verdana" (Wide, legible sans-serif)
           - "times" (Traditional serif)
           - "georgia" (Elegant serif)
           - "courier" (Typewriter/monospace)
           - "cmr9" (LaTeX Computer Modern)
           Choose the one that best matches the visual appearance.
           
        3. section_order:
           Identify the vertical order of these sections (if they exist, ignore missing ones, but output an array containing all 6 strings in the inferred order, pushing missing ones to the end):
           ["summary", "experience", "education", "projects", "skills", "custom_sections"]
           
        4. margin:
           Estimate the margin around the page. Standard is 36. Use 36 for normal, 24 for narrow, 48 for wide.
           
        5. font_size:
           Estimate the base font size. Usually 10, 11, or 12.
           
        Return a strict JSON object with this exact structure:
        {
            "template_style": "classic|modern|minimal|custom",
            "font_family": "helvetica|arial|calibri|verdana|times|georgia|courier|cmr9",
            "section_order": ["string"],
            "margin": number,
            "font_size": number
        }
        """
        
        vision_response = query_llm_vision(
            prompt=prompt,
            base64_image=base64_image,
            mime_type=mime_type,
            response_format_json=True,
            user_api_key=current_user.gemini_api_key,
            user_model=current_user.gemini_model
        )
        
        try:
            design_config = json.loads(vision_response)
            track_usage(db, current_user.id, current_user.gemini_model)
        except json.JSONDecodeError:
            # Fallback if parsing fails
            import re
            json_match = re.search(r'\{.*\}', vision_response, re.DOTALL)
            if json_match:
                design_config = json.loads(json_match.group(0))
            else:
                design_config = {
                    "template_style": "classic",
                    "font_family": "helvetica",
                    "section_order": ["summary", "experience", "education", "projects", "skills", "custom_sections"],
                    "margin": 36,
                    "font_size": 11
                }

        # 2b. Generate Custom HTML unconditionally
        custom_html = None
        html_prompt = """
        You are an expert front-end developer. I have provided an image of a resume.
        Write a complete, single-file HTML document (with embedded CSS in a <style> tag) that visually perfectly matches the resume in the image.
        - Ensure the layout, margins, colors, fonts, and spacing are as close to pixel-perfect as possible.
        - Include the actual text content from the image in the HTML.
        - Use a standard page width (e.g., 8.5in or 210mm) and ensure text scales properly.
        - Return ONLY the raw HTML string. Do NOT use markdown code blocks like ```html.
        """
        custom_html_response = query_llm_vision(
            prompt=html_prompt,
            base64_image=base64_image,
            mime_type=mime_type,
            response_format_json=False,
            user_api_key=current_user.gemini_api_key,
            user_model=current_user.gemini_model
        )
        custom_html = custom_html_response.strip()
        if custom_html.startswith("```html"):
            custom_html = custom_html[7:]
        if custom_html.endswith("```"):
            custom_html = custom_html[:-3]
        custom_html = custom_html.strip()
        
        design_config["custom_html"] = custom_html
        track_usage(db, current_user.id, current_user.gemini_model)
        
        print("GENERATED CUSTOM HTML length:", len(custom_html))

        # 3. Extract Text Content if requested
        parsed_content = None
        if extract_content:
            text_prompt = """
            Extract all the textual content from this resume and return it as a strictly formatted JSON object.
            Do NOT include markdown block markers (like ```json), just return the raw JSON object.
            
            The JSON MUST follow this exact schema:
            {
                "personal": {
                    "full_name": "string",
                    "email": "string",
                    "phone": "string",
                    "location": "string",
                    "linkedin": "string",
                    "github": "string",
                    "portfolio": "string"
                },
                "summary": "string (the entire summary paragraph)",
                "experience": [
                    {
                        "company": "string",
                        "role": "string",
                        "date": "string (e.g. 'Jan 2020 - Present')",
                        "location": "string",
                        "bullets": ["string (bullet point 1)", "string (bullet point 2)"]
                    }
                ],
                "education": [
                    {
                        "institution": "string",
                        "degree": "string",
                        "date": "string",
                        "location": "string",
                        "bullets": ["string", "string"]
                    }
                ],
                "projects": [
                    {
                        "name": "string",
                        "technologies": "string",
                        "date": "string",
                        "bullets": ["string", "string"]
                    }
                ],
                "skills": [
                    {
                        "category": "string (e.g. 'Programming Languages')",
                        "skills": "string (comma separated list of skills)"
                    }
                ],
                "custom_sections": [
                    {
                        "heading": "string",
                        "body": "string"
                    }
                ]
            }
            
            If a section does not exist in the resume, return an empty array [] or empty string "" for it.
            """
            
            extracted_text_json = query_llm_vision(
                prompt=text_prompt,
                base64_image=base64_image,
                mime_type=mime_type,
                response_format_json=True,
                user_api_key=current_user.gemini_api_key,
                user_model=current_user.gemini_model
            )
            
            try:
                parsed_content = json.loads(extracted_text_json)
                track_usage(db, current_user.id, current_user.gemini_model)
            except json.JSONDecodeError:
                import re
                json_match = re.search(r'\{.*\}', extracted_text_json, re.DOTALL)
                if json_match:
                    parsed_content = json.loads(json_match.group(0))
                else:
                    parsed_content = None

        return CloneResponse(
            design=design_config,
            parsed_content=parsed_content,
            custom_html=custom_html
        )

    except Exception as e:
        print(f"Clone Style Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
