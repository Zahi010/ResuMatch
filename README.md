# ResuMatch 🚀

ResuMatch is a powerful, AI-driven job application management suite designed to give candidates a serious edge in their job hunt. It combines a smart Kanban-style job tracker, an AI-powered resume builder, and a Chrome extension to automate the tedious parts of applying for jobs.

## ✨ Key Features

### 1. 🎯 AI Resume Match & ATS Analyzer (Dashboard)
Instantly know your chances before you apply, and prepare for the interview all in one place:
- **Semantic Match Scoring:** Compares your resume against the Job Description to calculate an Overall Match Score and ATS Compatibility Score.
- **Diagnostic Checks:** Verifies contact info, required skills, experience level, and education requirements are properly formatted.
- **Gap Analysis & Optimization:** Identifies missing skills and keywords, then suggests how to rewrite your bullet points to beat the ATS.
- **Outreach Letter Generator:** Drafts a tailored cold-email/message to recruiters based on your specific job match.
- **Interactive Interview Prep:** Features an AI Mock Interview simulator, Aptitude Tests, and English Practice modules.
- **Learning Roadmap:** Generates a custom study plan to help you bridge any skill gaps found in the ATS analysis.
- **Recent Matches & History:** Keeps a log of all your previous match scores and interview history for easy reference.

### 2. 🧠 AI Job Tracker
Move beyond simple spreadsheets. The ResuMatch job tracker acts as your personal command center:
- **Instant Job Insights:** Summarizes job descriptions to highlight core responsibilities and potential "Red Flags" or "Green Flags".
- **Smart Salary Estimator:** Cross-references a job description with your resume to provide a realistic, experience-based target salary.
- **Ghosting Auto-Archiver:** Automatically fades out and tags applications that have been sitting without an interview for over 30 days.
- **Automated Brag Sheet:** When moving a job to "Interviewing", it analyzes the job requirements and your resume to generate customized STAR-method talking points for your upcoming interview.
- **Offer Comparison Matrix:** A dedicated view to compare multiple job offers side-by-side (Target vs. Offered Salary, Work Setup, and Pros/Cons).

### 3. 📄 Smart Resume Builder
Create perfectly tailored, ATS-friendly resumes in minutes:
- Build a master resume and clone it for specific job applications.
- Integrated AI helps rewrite bullet points for maximum impact.
- Generates pixel-perfect PDFs using LaTex styling via PyMuPDF.

### 4. ⚡ Chrome Extension (One-Click Auto-Fill)
Stop typing out your work history over and over:
- Extracts data from your master resume in the database.
- Uses AI to intelligently map your experience to the DOM fields of popular job boards (Workday, Greenhouse, Lever, etc.).
- Auto-fills the entire application form with a single click.

## 🛠️ Tech Stack

- **Frontend:** Next.js (React), Tailwind CSS (Custom futuristic glassmorphism UI)
- **Backend:** FastAPI (Python), SQLAlchemy, SQLite
- **AI Integration:** Google Gemini Pro API
- **Browser Extension:** Manifest V3 (JavaScript, HTML, CSS)
- **PDF Generation:** PyMuPDF (Fitz)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python 3.10+
- A Google Gemini API Key

### Backend Setup
1. Navigate to the `backend` directory: `cd backend`
2. Create a virtual environment: `python -m venv venv`
3. Activate the environment: `.\venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux)
4. Install dependencies: `pip install -r requirements.txt`
5. Create a `.env` file in the `backend` directory and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
6. Start the FastAPI server: `uvicorn app.main:app --reload` (Runs on `http://localhost:8000`)

### Frontend Setup
1. Navigate to the `frontend` directory: `cd frontend`
2. Install dependencies: `npm install`
3. Start the Next.js development server: `npm run dev` (Runs on `http://localhost:3000`)

### Extension Setup
1. Open Google Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner.
3. Click "Load unpacked" and select the `extension` folder from this repository.

## 📄 License
This project is open-source and available for personal use.
