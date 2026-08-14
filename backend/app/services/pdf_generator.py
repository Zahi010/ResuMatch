import io
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

def generate_resume_pdf(resume_data: dict) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=letter,
        rightMargin=50,
        leftMargin=50,
        topMargin=50,
        bottomMargin=50
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Styles
    name_style = ParagraphStyle(
        'NameStyle', 
        parent=styles['Heading1'],
        alignment=TA_CENTER,
        fontSize=24,
        spaceAfter=12
    )
    
    contact_style = ParagraphStyle(
        'ContactStyle',
        parent=styles['Normal'],
        alignment=TA_CENTER,
        fontSize=10,
        textColor='black',
        spaceAfter=20
    )
    
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        alignment=TA_LEFT,
        fontSize=14,
        textColor='black',
        spaceBefore=15,
        spaceAfter=5,
        borderWidth=1,
        borderColor='black',
        borderPadding=3,
        borderStyle='solid',
        borderRadius=0,
    )
    
    normal_style = styles['Normal']
    normal_style.fontSize = 11
    normal_style.leading = 14
    
    bold_style = ParagraphStyle(
        'BoldStyle',
        parent=normal_style,
        fontName='Helvetica-Bold'
    )
    
    elements = []
    
    # 1. Header (Name & Contact)
    name = resume_data.get("name", "Unknown Name")
    elements.append(Paragraph(name, name_style))
    
    contact_parts = []
    if resume_data.get("email"): contact_parts.append(resume_data["email"])
    if resume_data.get("phone"): contact_parts.append(resume_data["phone"])
    if resume_data.get("location"): contact_parts.append(resume_data["location"])
    if resume_data.get("linkedin"): contact_parts.append(resume_data["linkedin"])
    if resume_data.get("github"): contact_parts.append(resume_data["github"])
    
    contact_info = " | ".join([str(part) for part in contact_parts if part])
    elements.append(Paragraph(contact_info, contact_style))
    
    # 2. Summary
    if resume_data.get("summary"):
        elements.append(Paragraph("SUMMARY", section_heading))
        elements.append(Spacer(1, 2))
        elements.append(Paragraph(resume_data["summary"], normal_style))
    
    # 3. Experience
    experience_list = resume_data.get("experience", [])
    if experience_list:
        elements.append(Paragraph("EXPERIENCE", section_heading))
        elements.append(Spacer(1, 2))
        for exp in experience_list:
            company = exp.get("company", "")
            role = exp.get("role", "")
            start = exp.get("start_date") or ""
            end = exp.get("end_date") or ""
            
            date_str = ""
            if start or end:
                date_str = f" ({start} - {end})"
            
            header = f"<b>{role}</b> at <b>{company}</b>{date_str}"
            elements.append(Paragraph(header, normal_style))
            elements.append(Spacer(1, 4))
            
            responsibilities = exp.get("responsibilities", [])
            if responsibilities:
                bullet_items = [ListItem(Paragraph(str(resp), normal_style), bulletColor='black') for resp in responsibilities]
                elements.append(ListFlowable(bullet_items, bulletType='bullet', start='bulletchar', bulletFontName='Helvetica', bulletFontSize=10, leftIndent=15))
            elements.append(Spacer(1, 8))
            
    # 4. Education
    education_list = resume_data.get("education", [])
    if education_list:
        elements.append(Paragraph("EDUCATION", section_heading))
        elements.append(Spacer(1, 2))
        for edu in education_list:
            inst = edu.get("institution", "")
            degree = edu.get("degree", "")
            major = edu.get("major", "")
            date = edu.get("graduation_date", "")
            
            degree_str = f"<b>{degree}</b>"
            if major: degree_str += f" in {major}"
            inst_str = f", {inst}" if inst else ""
            date_str = f" - {date}" if date else ""
            
            elements.append(Paragraph(f"{degree_str}{inst_str}{date_str}", normal_style))
            elements.append(Spacer(1, 6))
            
    # 5. Projects
    projects_list = resume_data.get("projects", [])
    if projects_list:
        elements.append(Paragraph("PROJECTS", section_heading))
        elements.append(Spacer(1, 2))
        for proj in projects_list:
            title = proj.get("title", "")
            desc = proj.get("description", "")
            elements.append(Paragraph(f"<b>{title}</b>", normal_style))
            if desc:
                elements.append(Spacer(1, 2))
                elements.append(Paragraph(desc, normal_style))
            elements.append(Spacer(1, 6))

    # 6. Skills
    skills_list = resume_data.get("skills", [])
    if skills_list:
        elements.append(Paragraph("SKILLS", section_heading))
        elements.append(Spacer(1, 2))
        skills_str = ", ".join(str(s) for s in skills_list)
        elements.append(Paragraph(skills_str, normal_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer
