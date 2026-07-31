import fitz
import os
import io
from playwright.sync_api import sync_playwright
from app.schemas.schemas import ResumeBuildRequest
from app.services.font_manager import font_manager

def generate_custom_pdf(html_str: str) -> bytes:
    """Renders raw HTML/CSS into a PDF using Playwright."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(html_str, wait_until="networkidle")
        pdf_bytes = page.pdf(format="A4", print_background=True, margin={"top": "0px", "right": "0px", "bottom": "0px", "left": "0px"})
        browser.close()
        return pdf_bytes

def get_font(name: str, bold: bool = False, italic: bool = False):
    # Standard PyMuPDF fonts fallback
    base_fonts = {
        "helvetica": {"reg": "helv", "bold": "hebo", "italic": "heit", "bolditalic": "hebi"},
        "times": {"reg": "tiro", "bold": "tibo", "italic": "tiit", "bolditalic": "tibi"},
        "courier": {"reg": "cour", "bold": "cobo", "italic": "coit", "bolditalic": "cobi"},
    }
    
    n = name.lower()
    
    # Check if custom font exists in font manager
    if n in font_manager.font_map or f"{n}regular" in font_manager.font_map:
        if bold:
            # Try to find bold variant
            if f"{n}bold" in font_manager.font_map:
                return None, font_manager.font_map[f"{n}bold"]
            elif "cmr" in n and "cmbx" in font_manager.font_map:
                 return None, font_manager.font_map["cmbx9" if "9" in n else "cmb10"]
        return None, font_manager.get_font_file(name)
        
    if n in base_fonts:
        f = base_fonts[n]
        if bold and italic: return f["bolditalic"], None
        if bold: return f["bold"], None
        if italic: return f["italic"], None
        return f["reg"], None
        
    return "helv", None # Default

def wrap_text(text, fontname, fontfile, fontsize, max_width):
    if fontfile:
        f = fitz.Font(fontfile=fontfile)
        measure = lambda t: f.text_length(t, fontsize=fontsize)
    else:
        measure = lambda t: fitz.get_text_length(t, fontname=fontname, fontsize=fontsize)
        
    words = text.split(" ")
    lines = []
    current_line = []
    
    for word in words:
        test_line = " ".join(current_line + [word])
        if measure(test_line) <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(" ".join(current_line))
            current_line = [word]
    if current_line:
        lines.append(" ".join(current_line))
    return lines

def generate_resume_pdf(data: ResumeBuildRequest) -> bytes:
    if data.design.template_style.lower() == "custom" and data.custom_html:
        return generate_custom_pdf(data.custom_html)
        
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    
    margin = data.design.margin
    y_pos = margin
    max_w = 612 - 2 * margin
    
    base_size = data.design.font_size
    name_size = base_size * 2
    section_size = base_size * 1.3
    
    reg_fname, reg_ffile = get_font(data.design.font_family, False, False)
    bold_fname, bold_ffile = get_font(data.design.font_family, True, False)
    
    def get_w(txt, fname, ffile, fsize):
        if ffile: return fitz.Font(fontfile=ffile).text_length(txt, fontsize=fsize)
        return fitz.get_text_length(txt, fontname=fname, fontsize=fsize)

    def draw_text(txt, x, y, fname, ffile, fsize):
        if ffile:
            page.insert_text(fitz.Point(x, y), txt, fontsize=fsize, fontname="custom", fontfile=ffile)
        else:
            page.insert_text(fitz.Point(x, y), txt, fontsize=fsize, fontname=fname)

    style = data.design.template_style.lower()

    # 1. Personal Info
    p = data.personal
    
    name_w = get_w(p.full_name, bold_fname, bold_ffile, name_size)
    contact_items = [i for i in [p.email, p.phone, p.location, p.linkedin, p.github, p.portfolio] if i]
    contact_str = " | ".join(contact_items)
    contact_w = get_w(contact_str, reg_fname, reg_ffile, base_size)

    if style == "modern":
        draw_text(p.full_name, margin, y_pos, bold_fname, bold_ffile, name_size)
        y_pos += name_size * 1.2
        draw_text(contact_str, margin, y_pos, reg_fname, reg_ffile, base_size)
        y_pos += base_size * 2
    else:
        draw_text(p.full_name, (612 - name_w) / 2, y_pos, bold_fname, bold_ffile, name_size)
        y_pos += name_size * 1.2
        draw_text(contact_str, (612 - contact_w) / 2, y_pos, reg_fname, reg_ffile, base_size)
        y_pos += base_size * 2
    
    # Helper for sections
    def draw_section_header(title):
        nonlocal y_pos
        if style == "modern":
            y_pos += base_size * 1.5
            title_w = get_w(title.upper(), bold_fname, bold_ffile, section_size)
            draw_text(title.upper(), (612 - title_w) / 2, y_pos, bold_fname, bold_ffile, section_size)
            y_pos += base_size * 1.5
        elif style == "minimal":
            y_pos += base_size * 1.5
            draw_text(title.upper(), margin, y_pos, bold_fname, bold_ffile, base_size)
            y_pos += base_size * 1.2
        else: # Classic
            y_pos += base_size
            draw_text(title, margin, y_pos, bold_fname, bold_ffile, section_size)
            y_pos += 4
            page.draw_line(fitz.Point(margin, y_pos), fitz.Point(612 - margin, y_pos))
            y_pos += base_size * 1.2
        
    def check_page_break(height=base_size * 2):
        nonlocal y_pos, page
        if y_pos + height > 792 - margin - 20:
            page = doc.new_page(width=612, height=792)
            y_pos = margin

    def draw_html(html, css_extra=""):
        nonlocal y_pos, page, doc
        # Clean HTML to prevent non-breaking spaces from breaking word wrap
        html = html.replace("&nbsp;", " ")
        
        css = f"* {{ margin: 0; padding: 0; font-family: '{reg_fname}'; font-size: {base_size}pt; }}\n"
        css += "ul, p, li { margin-top: 0; margin-bottom: 0; }\n"
        css += "ul { padding-left: 15pt; }\n"
        # Bulletproof class support in case Quill falls back to classes
        sizes = ["8pt", "10pt", "11pt", "12pt", "14pt", "18pt", "24pt"]
        for s in sizes:
            css += f".ql-size-{s} {{ font-size: {s}; }}\n"
            
        if css_extra:
            css += css_extra
            
        rect = fitz.Rect(margin, y_pos, 612 - margin, 792 - margin)
        # scale_low=1 strictly enforces font sizes and prevents shrinking long unbroken strings
        spare_height, scale = page.insert_htmlbox(rect, html, css=css, scale_low=1)
        
        if spare_height == -1:
            page = doc.new_page(width=612, height=792)
            y_pos = margin
            rect = fitz.Rect(margin, y_pos, 612 - margin, 792 - margin)
            spare_height, scale = page.insert_htmlbox(rect, html, css=css, scale_low=1)
            
        if spare_height != -1:
            y_pos = (792 - margin) - spare_height
            y_pos += base_size * 0.5

    # Render Helpers
    def draw_summary():
        nonlocal y_pos
        if data.summary:
            draw_section_header("Summary")
            draw_html(data.summary)

    def draw_experience():
        nonlocal y_pos
        if data.experience:
            draw_section_header("Experience")
            for exp in data.experience:
                check_page_break()
                draw_text(exp.role, margin, y_pos, bold_fname, bold_ffile, base_size)
                date_w = get_w(exp.date, reg_fname, reg_ffile, base_size)
                draw_text(exp.date, 612 - margin - date_w, y_pos, reg_fname, reg_ffile, base_size)
                y_pos += base_size * 1.2
                
                check_page_break()
                company_str = exp.company + (f" - {exp.location}" if exp.location else "")
                draw_text(company_str, margin, y_pos, reg_fname, reg_ffile, base_size)
                y_pos += base_size * 1.2
                
                for bullet in exp.bullets:
                    draw_html(bullet)

    def draw_education():
        nonlocal y_pos
        if data.education:
            draw_section_header("Education")
            for edu in data.education:
                check_page_break()
                draw_text(edu.institution, margin, y_pos, bold_fname, bold_ffile, base_size)
                date_w = get_w(edu.date, reg_fname, reg_ffile, base_size)
                draw_text(edu.date, 612 - margin - date_w, y_pos, reg_fname, reg_ffile, base_size)
                y_pos += base_size * 1.2
                
                check_page_break()
                draw_text(edu.degree, margin, y_pos, reg_fname, reg_ffile, base_size)
                y_pos += base_size * 1.2
                
                if edu.gpa:
                    check_page_break()
                    draw_text(f"GPA: {edu.gpa}", margin, y_pos, reg_fname, reg_ffile, base_size)
                    y_pos += base_size * 1.2
                y_pos += base_size * 0.5

    def draw_projects():
        nonlocal y_pos
        if data.projects:
            draw_section_header("Projects")
            for proj in data.projects:
                check_page_break()
                draw_text(proj.name, margin, y_pos, bold_fname, bold_ffile, base_size)
                if proj.date:
                    date_w = get_w(proj.date, reg_fname, reg_ffile, base_size)
                    draw_text(proj.date, 612 - margin - date_w, y_pos, reg_fname, reg_ffile, base_size)
                y_pos += base_size * 1.2
                
                check_page_break()
                draw_text(f"Technologies: {proj.technologies}", margin, y_pos, reg_fname, reg_ffile, base_size)
                y_pos += base_size * 1.2
                
                for bullet in proj.bullets:
                    draw_html(bullet)

    def draw_skills():
        nonlocal y_pos
        if data.skills:
            draw_section_header("Skills")
            for skill_cat in data.skills:
                check_page_break()
                cat_str = skill_cat.category + ": "
                cat_w = get_w(cat_str, bold_fname, bold_ffile, base_size)
                draw_text(cat_str, margin, y_pos, bold_fname, bold_ffile, base_size)
                
                skills_lines = wrap_text(skill_cat.skills, reg_fname, reg_ffile, base_size, max_w - cat_w)
                for i, line in enumerate(skills_lines):
                    check_page_break()
                    x_pos = margin + cat_w if i == 0 else margin
                    draw_text(line, x_pos, y_pos, reg_fname, reg_ffile, base_size)
                    y_pos += base_size * 1.2

    def draw_custom_sections():
        nonlocal y_pos
        if hasattr(data, 'custom_sections') and data.custom_sections:
            for section in data.custom_sections:
                if section.heading:
                    draw_section_header(section.heading)
                if section.body:
                    draw_html(section.body)

    # Map section names to render functions
    render_map = {
        "summary": draw_summary,
        "experience": draw_experience,
        "education": draw_education,
        "projects": draw_projects,
        "skills": draw_skills,
        "custom_sections": draw_custom_sections
    }

    # Render according to section_order
    for section_name in data.design.section_order:
        if section_name in render_map:
            render_map[section_name]()
            
    return doc.write()
