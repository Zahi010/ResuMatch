import fitz

resume_path = r"c:\Users\zahia\OneDrive\Desktop\ResumeAI\backend\uploads\resumes\2\Zahi Ahmed Vakayil Resume.pdf"
doc = fitz.open(resume_path)
page = doc[1]
blocks = page.get_text("dict")["blocks"]
for b_idx, b in enumerate(blocks):
    if "lines" not in b:
        continue
    print(f"\nBlock {b_idx}:")
    for l in b["lines"]:
        for span in l["spans"]:
            text = span["text"].strip()
            if text:
                safe_text = text.encode('ascii', 'backslashreplace').decode()
                print(f"  Span: {repr(safe_text)} | Font: {span['font']} | Size: {span['size']:.2f}")
doc.close()
