"use client";

import toast, { Toaster } from "react-hot-toast";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useMatchStore } from "@/lib/store";
import { api } from "@/lib/api";
import { 
  Upload, FileText, CheckCircle2, AlertTriangle, HelpCircle, 
  BookOpen, Star, RefreshCw, LogOut, Code, Briefcase, Award, Trash2, Download, Link, Settings,
  Mic, MicOff, Volume2, BrainCircuit, MessageSquareText
} from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { AptitudeTest } from "@/components/AptitudeTest";
import { EnglishPractice } from "@/components/EnglishPractice";

export default function DashboardPage() {
  const router = useRouter();
  const { token, user, setUser, logout } = useAuthStore();
  const { resumes, jobDescriptions, currentAnalysis, setResumes, setJobDescriptions, setCurrentAnalysis } = useMatchStore();

  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  
  // Form inputs
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [jdTitle, setJdTitle] = useState("");
  const [jdCompany, setJdCompany] = useState("");
  const [jdText, setJdText] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [scrapingUrl, setScrapingUrl] = useState(false);
  const [activeTab, setActiveTab] = useState("scores");
  const [expandedAnswerIndex, setExpandedAnswerIndex] = useState<number | null>(null);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [selectedSkillsToAdd, setSelectedSkillsToAdd] = useState<string[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedSuggestions, setOptimizedSuggestions] = useState<any[]>([]);

  // Advanced features state
  const [atsData, setAtsData] = useState<any>(null);
  const [loadingAts, setLoadingAts] = useState(false);
  
  const [bulletToOptimize, setBulletToOptimize] = useState("");
  const [optimizingBullet, setOptimizingBullet] = useState(false);
  const [applyingBullet, setApplyingBullet] = useState(false);
  const [tailoring, setTailoring] = useState(false);

  const [outreachData, setOutreachData] = useState<any | null>(null);
  const [generatingOutreach, setGeneratingOutreach] = useState(false);
  const [originalSelectedBullet, setOriginalSelectedBullet] = useState("");
  const [coverLetterName, setCoverLetterName] = useState("");
  const [coverLetterDate, setCoverLetterDate] = useState("");
  const [coverLetterTitle, setCoverLetterTitle] = useState("");
  const [coverLetterCompany, setCoverLetterCompany] = useState("");

  const [interviewQuestions, setInterviewQuestions] = useState<any[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [answerEvaluations, setAnswerEvaluations] = useState<any[]>([]);
  const [evaluatingAnswer, setEvaluatingAnswer] = useState(false);
  const [interviewHistory, setInterviewHistory] = useState<any[]>([]);
  const [activeInterviewId, setActiveInterviewId] = useState<number | null>(null);

  // Settings state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-flash-lite-latest");
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [usageData, setUsageData] = useState<{model_name: string, usage_today: number} | null>(null);

  // Speech Interactive Mode State
  const [interviewMode, setInterviewMode] = useState<'text' | 'speech'>('text');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = React.useRef<any>(null);

  const handleAutoTailor = async () => {
    if (!selectedResumeId || !currentAnalysis?.job_description_id) {
      toast.error("Please select a resume and run an analysis first.");
      return;
    }

    setTailoring(true);
    try {
      const res = await api.post("/analyses/auto-tailor", {
        resume_id: parseInt(selectedResumeId),
        job_description_id: currentAnalysis.job_description_id
      });
      toast.success("Resume auto-tailored successfully! Opening Builder...");
      
      const { useBuilderStore } = await import('@/lib/builderStore');
      useBuilderStore.getState().loadResume(res.extracted_data);
      
      router.push("/builder");
    } catch (err: any) {
      toast.error("Failed to auto-tailor resume: " + err.message);
    } finally {
      setTailoring(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setUserAnswer(transcript);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsRecording(false);
        };
        
        recognitionRef.current.onend = () => {
          setIsRecording(false);
        };
      }
    }
  }, []);

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsRecording(true);
      } else {
        toast.error("Speech recognition is not supported in this browser. Please use Text mode.");
      }
    }
  };

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }

    // Fetch user details
    api.get("/auth/me")
      .then((data) => {
        setUser(data);
        if (data.gemini_api_key) {
          setGeminiApiKey(data.gemini_api_key);
        }
        if (data.gemini_model) {
          setGeminiModel(data.gemini_model);
        }
      })
      .catch(() => logout());

    // Fetch resumes
    api.get("/resumes")
      .then((data) => {
        setResumes(data);
        if (data.length > 0) {
          setSelectedResumeId(data[0].id.toString());
        }
      })
      .catch(console.error);

    // Fetch job descriptions
    api.get("/job-descriptions")
      .then(setJobDescriptions)
      .catch(console.error);

    // Fetch previous analyses
    api.get("/analyses")
      .then((data) => {
        const reversedData = data.reverse(); // Show newest first
        setAnalyses(reversedData);
        if (reversedData.length > 0) {
          const newest = reversedData[0];
          setCurrentAnalysis(newest);
          if (newest.resume_version?.resume_id) {
            setSelectedResumeId(newest.resume_version.resume_id.toString());
          }
          if (newest.job_description) {
            setJdTitle(newest.job_description.title || "");
            setJdCompany(newest.job_description.company || "");
            setJdText(newest.job_description.raw_text || "");
          }
        }
      })
      .catch(console.error);
      
    // Fetch mock interview history
    api.get("/features/interviews")
      .then(setInterviewHistory)
      .catch(console.error);
  }, [token]);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.postForm("/resumes/upload", formData);
      setResumes([...resumes, res]);
      setSelectedResumeId(res.id.toString());
      alert("Resume uploaded and parsed successfully!");
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleResumeDelete = async () => {
    if (!selectedResumeId) return;
    if (!confirm("Are you sure you want to delete this resume? This will also delete all associated analysis version history.")) return;
    
    try {
      await api.delete(`/resumes/${selectedResumeId}`);
      const updated = resumes.filter((r) => r.id.toString() !== selectedResumeId);
      setResumes(updated);
      if (updated.length > 0) {
        setSelectedResumeId(updated[0].id.toString());
      } else {
        setSelectedResumeId("");
      }
      setCurrentAnalysis(null);
      alert("Resume deleted successfully");
    } catch (err: any) {
      toast.error("Failed to delete resume: " + err.message);
    }
  };

  const handleRunAnalysis = async () => {
    if (!selectedResumeId) {
      alert("Please upload or select a resume first");
      return;
    }
    if (!jdText.trim()) {
      alert("Please paste the job description text");
      return;
    }

    setAnalyzing(true);
    try {
      // 1. Create Job Description
      const jd = await api.post("/job-descriptions/", {
        title: jdTitle || "Target Role",
        company: jdCompany || "Target Company",
        raw_text: jdText
      });
      setJobDescriptions([...jobDescriptions, jd]);

      // 2. Trigger Match Analysis
      const analysis = await api.post("/analyses/analyze", {
        resume_id: parseInt(selectedResumeId),
        job_description_id: jd.id
      });
      setCurrentAnalysis(analysis);
      setAnalyses([analysis, ...analyses]);
      toast.success("Analysis complete!");
    } catch (err: any) {
      toast.error("Analysis failed: " + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleScrapeUrl = async () => {
    if (!jobUrl.trim()) {
      toast.error("Please enter a job URL.");
      return;
    }
    setScrapingUrl(true);
    try {
      const res = await api.post("/features/scrape-url", { url: jobUrl });
      if (res.title) setJdTitle(res.title);
      if (res.company) setJdCompany(res.company);
      if (res.description) setJdText(res.description);
      toast.success("Job description extracted successfully!");
    } catch (err: any) {
      toast.error("Failed to scrape URL: " + err.message);
    } finally {
      setScrapingUrl(false);
    }
  };

  const handleOptimizeSkills = async () => {
    if (selectedSkillsToAdd.length === 0) {
      toast.error("Please select at least one skill to add.");
      return;
    }
    setOptimizing(true);
    setOptimizedSuggestions([]);
    try {
      // Call backend analyses optimize endpoint
      const res = await api.post("/analyses/optimize", {
        resume_id: parseInt(selectedResumeId),
        job_description_id: currentAnalysis.job_description_id,
        skills_to_add: selectedSkillsToAdd
      });
      
      // Save suggestions in state
      setOptimizedSuggestions(res.suggestions);
      
      // Fetch latest resumes list from DB to load version change
      const updatedResumes = await api.get("/resumes");
      setResumes(updatedResumes);
      setSelectedSkillsToAdd([]);
      
      toast.success("Skills added to database! Re-running match analysis...");
      
      // Programmatically trigger a re-run using latest resume state
      setAnalyzing(true);
      
      const analysis = await api.post("/analyses/analyze", {
        resume_id: parseInt(selectedResumeId),
        job_description_id: currentAnalysis.job_description_id
      });
      setCurrentAnalysis(analysis);
      setAnalyses([analysis, ...analyses.filter(a => a.id !== analysis.id)]);
      toast.success("Updated Analysis complete!");
    } catch (err: any) {
      toast.error("Failed to add skills: " + err.message);
    } finally {
      setOptimizing(false);
      setAnalyzing(false);
    }
  };

  const runAtsCheck = async () => {
    if (!selectedResumeId) return;
    setLoadingAts(true);
    try {
      const data = await api.post("/features/ats-check", {
        resume_id: parseInt(selectedResumeId)
      });
      setAtsData(data);
    } catch (err: any) {
      toast.error("ATS Check failed: " + err.message);
    } finally {
      setLoadingAts(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingApiKey(true);
    try {
      const updatedUser = await api.put("/auth/me/api-key", { 
        gemini_api_key: geminiApiKey || null,
        gemini_model: geminiModel || "gemini-flash-lite-latest"
      });
      setUser(updatedUser);
      toast.success("API Key saved successfully!");
      setShowSettingsModal(false);
    } catch (err: any) {
      toast.error("Failed to save API Key: " + err.message);
    } finally {
      setSavingApiKey(false);
    }
  };

  useEffect(() => {
    if (showSettingsModal) {
      api.get("/auth/me/usage")
        .then((data) => setUsageData(data))
        .catch((err) => console.error("Failed to fetch usage:", err));
    }
  }, [showSettingsModal, geminiModel]);

  const handleAutoTailorUI = async () => {
    handleAutoTailor();
  };

  const handleApplyBullet = async () => {
    if (!originalSelectedBullet) {
      toast.error("Original bullet is required to replace it in the resume.");
      return;
    }
    setApplyingBullet(true);
    try {
      const res = await api.post("/features/apply-bullet", {
        resume_id: parseInt(selectedResumeId),
        job_description_id: currentAnalysis.job_description_id,
        original_bullet: originalSelectedBullet,
        optimized_bullet: optimizedBullet // Note: This state needs to be available
      });
      
      toast.success(res.message);
      
      // Refresh current analysis to show updated match score
      const newAnalysis = await api.post("/analyses/analyze", {
        resume_id: parseInt(selectedResumeId),
        job_description_id: currentAnalysis.job_description_id
      });
      setCurrentAnalysis(newAnalysis);
      setAnalyses([newAnalysis, ...analyses]);
      
      // Refresh all resumes from backend to get the newly created version
      const updatedResumes = await api.get("/resumes");
      setResumes(updatedResumes);
    } catch (err: any) {
      toast.error("Failed to apply bullet: " + err.message);
    } finally {
      setApplyingBullet(false);
    }
  };

  const handleGenerateOutreach = async () => {
    setGeneratingOutreach(true);
    try {
      const data = await api.post("/features/generate-outreach", {
        resume_id: parseInt(selectedResumeId),
        job_description_id: currentAnalysis.job_description_id
      });
      setOutreachData(data);
    } catch (err: any) {
      toast.error("Outreach generation failed: " + err.message);
    } finally {
      setGeneratingOutreach(false);
    }
  };

  const handleStartMockInterview = async () => {
    setGeneratingQuestions(true);
    setInterviewQuestions([]);
    setCurrentQuestionIdx(0);
    setAnswerEvaluations([]);
    setUserAnswer("");
    try {
      const data = await api.post("/features/generate-interview", {
        resume_id: parseInt(selectedResumeId),
        job_description_id: currentAnalysis.job_description_id
      });
      setInterviewQuestions(data.questions);
      setActiveInterviewId(data.interview_id);
      
      if (interviewMode === 'speech' && data.questions.length > 0) {
        speakText(data.questions[0].text);
      }
      
      // Refresh history
      api.get("/features/interviews").then(setInterviewHistory).catch(console.error);
    } catch (err: any) {
      toast.error("Failed to generate mock interview: " + err.message);
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) {
      toast.error("Please enter your answer first.");
      return;
    }
    setEvaluatingAnswer(true);
    try {
      const q = interviewQuestions[currentQuestionIdx];
      const evalData = await api.post("/features/evaluate-answer", {
        question_id: q.id,
        answer: userAnswer
      });
      setAnswerEvaluations([...answerEvaluations, {
        question: q.text,
        answer: userAnswer,
        ...evalData
      }]);
      setUserAnswer("");
      if (currentQuestionIdx < interviewQuestions.length - 1) {
        setCurrentQuestionIdx(currentQuestionIdx + 1);
        if (interviewMode === 'speech') {
          speakText(interviewQuestions[currentQuestionIdx + 1].text);
        }
      } else {
        toast.success("Mock Interview Complete! Review your feedback below.");
      }
      // Refresh history
      api.get("/features/interviews").then(setInterviewHistory).catch(console.error);
    } catch (err: any) {
      toast.error("Answer evaluation failed: " + err.message);
    } finally {
      setEvaluatingAnswer(false);
    }
  };

  if (!token) return null;

  return (
    <div className="min-h-screen text-white font-sans flex flex-col justify-between">
      <Toaster position="top-center" toastOptions={{style: { background: "#18181b", color: "#fff", border: "1px solid #27272a" }}} />
      {/* Header */}
      <header className="border-b border-zinc-900 glass-panel sticky top-0 z-50 border-b-0 rounded-none px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center font-bold text-lg">
            R
          </div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            ResuMatch
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">
            {user?.full_name || user?.email || "User Session"}
          </span>
          <button
            onClick={() => router.push('/tracker')}
            className="flex items-center gap-2 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg text-sm transition font-medium"
          >
            <Briefcase size={16} />
            Job Tracker
          </button>
          <button
            onClick={() => router.push('/builder')}
            className="flex items-center gap-2 hover:bg-purple-900/30 border border-purple-500/30 text-purple-400 hover:text-purple-300 px-4 py-1.5 rounded-lg text-sm transition font-medium"
          >
            <FileText size={16} />
            Resume Builder
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg text-sm transition"
          >
            <Settings size={16} />
            Settings
          </button>
          <button
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="flex items-center gap-2 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg text-sm transition"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <div className="max-w-7xl mx-auto w-full px-6 py-10 flex-grow grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* Left Control Panel: Upload, Job Input */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-panel p-6 rounded-2xl backdrop-blur-md">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-purple-400">
              <Upload size={18} />
              1. Upload Resume
            </h3>
            
            <div className="space-y-4">
              {resumes.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Select Existing Resume
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedResumeId}
                      onChange={(e) => setSelectedResumeId(e.target.value)}
                      className="flex-grow glass-input text-sm px-3 py-2.5 rounded-xl px-3 py-2 rounded-xl focus:outline-none"
                    >
                      {resumes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.filename}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleResumeDelete}
                      title="Delete Resume"
                      className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 p-2.5 rounded-xl transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}

              <div className="border border-dashed border-zinc-800 rounded-xl p-6 text-center hover:border-zinc-700 transition cursor-pointer relative">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleResumeUpload}
                  disabled={uploading}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <FileText className="mx-auto text-zinc-500 mb-2" size={28} />
                <span className="text-sm font-semibold text-zinc-300 block">
                  {uploading ? "Parsing..." : "Upload PDF or Word file"}
                </span>
                <span className="text-xs text-zinc-500 mt-1 block">Maximum file size 10MB</span>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl backdrop-blur-md">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-400">
              <FileText size={18} />
              2. Target Role Details
            </h3>

            <div className="space-y-4">
              <div className="p-4 bg-zinc-900/40 rounded-xl border border-zinc-800/50 mb-4">
                <label className="block text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Link size={14} /> Auto-Fill from URL (Magic)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                    placeholder="Paste LinkedIn or Job Board URL..."
                    className="w-full glass-input text-sm px-3 py-2.5 rounded-xl focus:outline-none"
                  />
                  <button
                    onClick={handleScrapeUrl}
                    disabled={scrapingUrl}
                    className="glass-button text-white px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition"
                  >
                    {scrapingUrl ? "Scraping..." : "Auto-Fill"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Job Title
                </label>
                <input
                  type="text"
                  value={jdTitle}
                  onChange={(e) => setJdTitle(e.target.value)}
                  placeholder="e.g. Staff Software Engineer"
                  className="w-full glass-input text-sm px-3 py-2.5 rounded-xl px-3 py-2.5 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={jdCompany}
                  onChange={(e) => setJdCompany(e.target.value)}
                  placeholder="e.g. Stripe"
                  className="w-full glass-input text-sm px-3 py-2.5 rounded-xl px-3 py-2.5 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Job Description Text
                </label>
                <textarea
                  rows={6}
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  placeholder="Paste the job responsibilities, skills, requirements..."
                  className="w-full glass-input text-sm px-3 py-2.5 rounded-xl px-3 py-2.5 rounded-xl focus:outline-none resize-none"
                />
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex gap-4">
                  <button
                    onClick={handleRunAnalysis}
                    disabled={analyzing}
                    className="flex-1 glass-button text-white font-bold py-3 rounded-xl shadow-lg transition active:scale-[0.98] disabled:opacity-50"
                  >
                    {analyzing ? "Analyzing Match..." : "Analyze Match & ATS"}
                  </button>
                  <button
                    onClick={() => {
                      const tokenVal = localStorage.getItem("token") || "";
                      const downloadUrl = `http://localhost:8000/api/v1/resumes/${selectedResumeId}/download?token=${encodeURIComponent(tokenVal)}`;
                      window.open(downloadUrl, "_blank");
                    }}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl shadow-lg transition active:scale-[0.98]"
                  >
                    Download Original Resume
                  </button>
                </div>
                
                {/* Auto-Tailor Button */}
                <button
                  onClick={handleAutoTailor}
                  disabled={tailoring || !currentAnalysis}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Star size={18} />
                  {tailoring ? "✨ Tailoring with AI..." : "✨ Auto-Tailor Resume (Magic)"}
                </button>
              </div>
            </div>
          </div>

          {/* History Panel */}
          {analyses.length > 0 && (
            <div className="glass-panel p-6 rounded-2xl backdrop-blur-md">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-teal-400">
                <RefreshCw size={18} />
                Recent Matches
              </h3>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {analyses.map((an) => {
                  const utcDateStr = an.created_at.endsWith('Z') ? an.created_at : `${an.created_at}Z`;
                  const dateStr = new Date(utcDateStr).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  });
                  const matchResume = resumes.find(r => r.id === an.resume_version?.resume_id);
                  const resumeName = matchResume?.filename || `Resume #${an.resume_version?.resume_id || 'Unknown'}`;
                  return (
                    <button
                      key={an.id}
                      onClick={() => {
                        setCurrentAnalysis(an);
                        if (an.job_description) {
                          setJdTitle(an.job_description.title || "");
                          setJdCompany(an.job_description.company || "");
                          setJdText(an.job_description.raw_text || "");
                        }
                        if (an.resume_version) {
                          setSelectedResumeId(an.resume_version.resume_id.toString());
                        }
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between ${currentAnalysis?.id === an.id ? "bg-purple-950/20 border-purple-500/50" : "bg-zinc-950 border-zinc-900 hover:border-zinc-800"}`}
                    >
                      <div className="min-w-0 flex-grow mr-2">
                        <span className="font-bold text-xs text-zinc-200 block truncate">
                          {an.job_description ? `${an.job_description.title || 'Unknown Role'} @ ${an.job_description.company || 'Unknown Company'}` : "Match Analysis"}
                        </span>
                        <span className="text-[10px] text-zinc-400 block truncate mt-0.5 font-medium">
                          {resumeName}
                        </span>
                        <span className="text-[10px] text-zinc-500 block mt-0.5">
                          {dateStr}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-black text-sm text-purple-400">
                          {an.match_score}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Dashboard panel: Matches & Gaps */}
        <div className="lg:col-span-8">
          {currentAnalysis ? (
            <div className="space-y-6">
              {/* Tab Navigation */}
              <div className="flex border-b border-zinc-800 gap-6 text-sm font-semibold overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setActiveTab("scores")}
                  className={`pb-3 whitespace-nowrap ${activeTab === "scores" ? "border-b-2 border-purple-500 text-purple-400" : "text-zinc-400 hover:text-white"}`}
                >
                  Match Scores
                </button>
                <button
                  onClick={() => {
                    setActiveTab("ats");
                    runAtsCheck();
                  }}
                  className={`pb-3 whitespace-nowrap ${activeTab === "ats" ? "border-b-2 border-purple-500 text-purple-400" : "text-zinc-400 hover:text-white"}`}
                >
                  ATS Checker
                </button>
                <button
                  onClick={() => setActiveTab("skills")}
                  className={`pb-3 whitespace-nowrap ${activeTab === "skills" ? "border-b-2 border-purple-500 text-purple-400" : "text-zinc-400 hover:text-white"}`}
                >
                  Skill Gaps
                </button>
                <button
                  onClick={() => setActiveTab("keywords")}
                  className={`pb-3 whitespace-nowrap ${activeTab === "keywords" ? "border-b-2 border-purple-500 text-purple-400" : "text-zinc-400 hover:text-white"}`}
                >
                  Keywords
                </button>
                <button
                  onClick={() => setActiveTab("optimize")}
                  className={`pb-3 whitespace-nowrap ${activeTab === "optimize" ? "border-b-2 border-purple-500 text-purple-400" : "text-zinc-400 hover:text-white"}`}
                >
                  Optimize Skills
                </button>
                <button
                  onClick={() => setActiveTab("bullet")}
                  className={`pb-3 whitespace-nowrap ${activeTab === "bullet" ? "border-b-2 border-purple-500 text-purple-400" : "text-zinc-400 hover:text-white"}`}
                >
                  Bullet Optimizer
                </button>
                <button
                  onClick={() => {
                    setActiveTab("outreach");
                    handleGenerateOutreach();
                  }}
                  className={`pb-3 whitespace-nowrap ${activeTab === "outreach" ? "border-b-2 border-purple-500 text-purple-400" : "text-zinc-400 hover:text-white"}`}
                >
                  Outreach Letter
                </button>
                <button
                  onClick={() => setActiveTab("interview")}
                  className={`pb-3 whitespace-nowrap ${activeTab === "interview" ? "border-b-2 border-purple-500 text-purple-400" : "text-zinc-400 hover:text-white"}`}
                >
                  Mock Interview
                </button>
                <button
                  onClick={() => setActiveTab("roadmap")}
                  className={`pb-3 whitespace-nowrap ${activeTab === "roadmap" ? "border-b-2 border-purple-500 text-purple-400" : "text-zinc-400 hover:text-white"}`}
                >
                  Learning Roadmap
                </button>
                <button
                  onClick={() => setActiveTab("aptitude")}
                  className={`pb-3 whitespace-nowrap ${activeTab === "aptitude" ? "border-b-2 border-amber-500 text-amber-400" : "text-zinc-400 hover:text-white flex items-center gap-1"}`}
                >
                  <BrainCircuit size={14}/> Aptitude Test
                </button>
                <button
                  onClick={() => setActiveTab("english")}
                  className={`pb-3 whitespace-nowrap ${activeTab === "english" ? "border-b-2 border-blue-500 text-blue-400" : "text-zinc-400 hover:text-white flex items-center gap-1"}`}
                >
                  <MessageSquareText size={14}/> English Practice
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`pb-3 whitespace-nowrap ${activeTab === "history" ? "border-b-2 border-purple-500 text-purple-400" : "text-zinc-400 hover:text-white"}`}
                >
                  Interview History
                </button>
              </div>

              {/* Tab Content: Scores */}
              {activeTab === "scores" && (
                <div className="space-y-6">
                  {/* Summary card */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
                      <div>
                        <h4 className="text-zinc-400 font-semibold text-sm">Overall Match Score</h4>
                        <p className="text-5xl font-black text-white mt-2">
                          {currentAnalysis.analysis_results.match_scores?.overall}%
                        </p>
                      </div>
                      <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
                        Calculated by semantic similarity of your projects, experience alignment, and keyword density.
                      </p>
                    </div>

                    <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
                      <div>
                        <h4 className="text-zinc-400 font-semibold text-sm">ATS Compatibility Score</h4>
                        <p className="text-5xl font-black text-white mt-2">
                          {currentAnalysis.analysis_results.ats_compatibility?.score}%
                        </p>
                      </div>
                      <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
                        {currentAnalysis.analysis_results.ats_compatibility?.explanation}
                      </p>
                    </div>
                  </div>

                  {/* Radar Chart */}
                  {currentAnalysis.analysis_results.match_scores?.radar_dimensions && (
                    <div className="glass-panel p-6 rounded-2xl">
                      <h4 className="text-white font-bold mb-6 flex items-center gap-2">
                        <Star size={18} className="text-purple-400" />
                        Skill Match Radar
                      </h4>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={currentAnalysis.analysis_results.match_scores.radar_dimensions}>
                            <PolarGrid stroke="#3f3f46" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar name="Candidate" dataKey="score" stroke="#a855f7" fill="#a855f7" fillOpacity={0.4} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}



                  {/* ATS Checklist */}
                  <div className="glass-panel p-6 rounded-2xl">
                    <h4 className="font-bold text-base mb-4 text-purple-400">ATS Layout Diagnostic Checks</h4>
                    <div className="space-y-3">
                      {currentAnalysis.analysis_results.ats_compatibility?.checks?.map((check: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 bg-zinc-950 p-3 rounded-xl border border-zinc-900">
                          {check.passed ? (
                            <CheckCircle2 className="text-emerald-500 mt-0.5" size={18} />
                          ) : (
                            <AlertTriangle className="text-amber-500 mt-0.5" size={18} />
                          )}
                          <div>
                            <span className="font-bold text-sm text-zinc-200">{check.name}</span>
                            <p className="text-xs text-zinc-400 mt-0.5">{check.details}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Experience Gap Analysis */}
                  {currentAnalysis.analysis_results.experience_analysis && (
                    <div className="glass-panel p-6 rounded-2xl">
                      <h4 className="font-bold text-base mb-4 text-blue-400 flex items-center gap-2">
                        <Briefcase size={18} />
                        Experience Gap Analysis
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-900 text-center">
                          <span className="text-xs text-zinc-500 block mb-1">Required</span>
                          <span className="text-xl font-bold text-white">
                            {currentAnalysis.analysis_results.experience_analysis.years_required}
                          </span>
                        </div>
                        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-900 text-center">
                          <span className="text-xs text-zinc-500 block mb-1">On Resume</span>
                          <span className={`text-xl font-bold ${currentAnalysis.analysis_results.experience_analysis.gap_years > 0 ? "text-red-400" : "text-emerald-400"}`}>
                            {currentAnalysis.analysis_results.experience_analysis.years_present}
                          </span>
                        </div>
                        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-900 text-center">
                          <span className="text-xs text-zinc-500 block mb-1">Gap</span>
                          <span className={`text-xl font-bold ${currentAnalysis.analysis_results.experience_analysis.gap_years > 0 ? "text-red-400" : "text-emerald-400"}`}>
                            {currentAnalysis.analysis_results.experience_analysis.gap_years > 0 ? `-${currentAnalysis.analysis_results.experience_analysis.gap_years} years` : "No Gap"}
                          </span>
                        </div>
                      </div>
                      <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-900">
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Verdict</span>
                        <p className="text-sm font-bold text-zinc-200 mb-2">
                          {currentAnalysis.analysis_results.experience_analysis.verdict}
                        </p>
                        {currentAnalysis.analysis_results.experience_analysis.suggestions?.map((sug: any, sidx: number) => (
                          <p key={sidx} className="text-xs text-zinc-400 leading-relaxed">
                            💡 {typeof sug === "string" ? sug : sug.suggestion}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: Skills */}
              {activeTab === "skills" && (
                <div className="glass-panel p-6 rounded-2xl space-y-4">
                  <h4 className="font-bold text-base text-blue-400">Target Skill Gaps</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentAnalysis.analysis_results.skill_gap?.map((skill: any, idx: number) => (
                      <div 
                        key={idx} 
                        className={`p-4 rounded-xl border flex flex-col justify-between ${skill.status === "Present" ? "bg-emerald-950/10 border-emerald-900/30" : "bg-red-950/10 border-red-900/30"}`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-white">{skill.name}</span>
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${skill.status === "Present" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                              {skill.status}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{skill.reason}</p>
                        </div>
                        <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-800/40 text-[10px] text-zinc-500 font-semibold">
                          <span>Importance: {skill.importance}</span>
                          <span>Impact: +{skill.impact}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab Content: Keywords */}
              {activeTab === "keywords" && (
                <div className="space-y-6">
                  <div className="glass-panel p-6 rounded-2xl">
                    <h4 className="font-bold text-base mb-4 text-teal-400">Keyword Density & Recognition</h4>
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-2">Matched Keywords</span>
                        <div className="flex flex-wrap gap-2">
                          {currentAnalysis.analysis_results.keywords?.matched?.map((kw: string, idx: number) => (
                            <span key={idx} className="bg-zinc-950 border border-zinc-800 px-3 py-1 rounded-lg text-xs text-zinc-300">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-2">Missing Keywords</span>
                        <div className="flex flex-wrap gap-2">
                          {currentAnalysis.analysis_results.keywords?.missing?.map((kw: string, idx: number) => (
                            <span key={idx} className="bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-lg text-xs text-red-400">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content: Roadmap */}
              {activeTab === "roadmap" && (
                <div className="glass-panel p-6 rounded-2xl space-y-4">
                  <h4 className="font-bold text-base text-purple-400">Personalized Learning Roadmap</h4>
                  <div className="space-y-4">
                    {currentAnalysis.analysis_results.learning_roadmap?.map((item: any, idx: number) => (
                      <div key={idx} className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-sm text-white">{item.skill}</span>
                          <span className="text-xs text-zinc-400">Estimated time: {item.estimated_time}</span>
                        </div>
                        <div className="mt-2 space-y-1">
                          <span className="text-xs font-semibold text-zinc-500">Free Resources:</span>
                          <div className="space-y-1 mt-1">
                            {item.free_courses?.map((course: any, cidx: number) => (
                              <a 
                                key={cidx} 
                                href={course.url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="block text-xs text-purple-400 hover:underline"
                              >
                                • {course.title} ({course.priority} priority)
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab Content: ATS Checker */}
              {activeTab === "ats" && (
                <div className="glass-panel p-6 rounded-2xl space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-base text-purple-400">ATS Formatting & Layout Audit</h4>
                      <p className="text-xs text-zinc-500 mt-1">Real-time parser heuristics simulation and layout validation checks.</p>
                    </div>
                    {loadingAts && <span className="text-xs text-zinc-500 animate-pulse">Scanning...</span>}
                  </div>

                  {atsData ? (
                    <div className="space-y-6">
                      <div className="bg-zinc-950 p-6 rounded-xl border border-zinc-900 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">ATS Score</span>
                          <span className={`text-4xl font-black ${atsData.score >= 80 ? "text-emerald-400" : atsData.score >= 60 ? "text-amber-400" : "text-red-400"}`}>
                            {atsData.score}/100
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 max-w-md italic">{atsData.summary}</p>
                      </div>

                      <div className="space-y-3">
                        {atsData.issues.map((issue: any, idx: number) => (
                          <div key={idx} className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl flex gap-3 items-start">
                            {issue.type === "error" ? (
                              <AlertTriangle className="text-red-400 mt-0.5 flex-shrink-0" size={18} />
                            ) : (
                              <AlertTriangle className="text-amber-400 mt-0.5 flex-shrink-0" size={18} />
                            )}
                            <div>
                              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">{issue.category}</span>
                              <p className="text-sm font-semibold text-zinc-200 mt-1">{issue.message}</p>
                              <p className="text-xs text-purple-400 mt-1 leading-relaxed">💡 Recommendation: {issue.suggestion}</p>
                            </div>
                          </div>
                        ))}
                        {atsData.issues.length === 0 && (
                          <div className="bg-zinc-950/40 border border-zinc-900 p-6 rounded-xl text-center">
                            <span className="text-xs text-emerald-400 font-bold block mb-1">🎉 Clean Audit Report!</span>
                            <p className="text-[11px] text-zinc-500">Your resume passed all formatting density and structural section diagnostics.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <button 
                        onClick={runAtsCheck}
                        disabled={loadingAts}
                        className="bg-zinc-950 border border-zinc-800 text-xs px-4 py-2.5 rounded-xl hover:border-zinc-700 transition"
                      >
                        {loadingAts ? "Running Scan..." : "Trigger ATS Diagnostic Audit"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: Experience Bullet Optimizer */}
              {activeTab === "bullet" && (
                <div className="glass-panel p-6 rounded-2xl space-y-4">
                  <div>
                    <h4 className="font-bold text-base text-purple-400">Experience Bullet Point Optimizer</h4>
                    <p className="text-xs text-zinc-500 mt-1">Paste a description bullet point from your work history, or select one from your parsed resume below. The AI will rewrite it to include relevant skills, action verbs, and business impact metrics matching the job requirements.</p>
                  </div>

                  {/* Existing Resume Bullets Selection */}
                  {(() => {
                    const activeResume = resumes.find(r => r.id.toString() === selectedResumeId);
                    const latestVersion = activeResume?.versions?.[activeResume.versions.length - 1];
                    const experienceList = latestVersion?.extracted_data?.experience || [];
                    
                    if (experienceList.length > 0) {
                      return (
                        <div className="space-y-2 mt-4 mb-6">
                          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">Select from your Resume</label>
                          <div className="max-h-60 overflow-y-auto space-y-3 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50 no-scrollbar">
                            {experienceList.map((exp: any, expIdx: number) => (
                              <div key={expIdx} className="space-y-2">
                                <div className="text-xs font-bold text-zinc-400 sticky top-0 bg-zinc-950/90 py-1 backdrop-blur-sm">
                                  {exp.role} @ {exp.company}
                                </div>
                                {exp.responsibilities && exp.responsibilities.length > 0 ? (
                                  <div className="space-y-1.5 pl-2">
                                    {exp.responsibilities.map((resp: string, rIdx: number) => (
                                      <div 
                                        key={rIdx} 
                                        onClick={() => {
                                          const text = String(resp).trim();
                                          setBulletToOptimize(text);
                                          setOriginalSelectedBullet(text);
                                          setOptimizedBullet("");
                                        }}
                                        className="text-xs text-zinc-300 bg-zinc-900/40 hover:bg-purple-900/30 border border-zinc-800 hover:border-purple-500/50 p-2.5 rounded-lg cursor-pointer transition flex items-start gap-2"
                                      >
                                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0"></div>
                                        <p className="leading-relaxed">{resp}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-zinc-600 italic pl-2">No bullets parsed for this role.</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Bullet Point to Optimize</label>
                      <textarea
                        rows={3}
                        value={bulletToOptimize}
                        onChange={(e) => setBulletToOptimize(e.target.value)}
                        placeholder="e.g. Worked on the backend platform and implemented new features to improve efficiency."
                        className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white p-3 rounded-xl focus:outline-none resize-none"
                      />
                    </div>

                    <button
                      onClick={handleOptimizeBullet}
                      disabled={optimizingBullet || !bulletToOptimize.trim()}
                      className="w-full glass-button text-white font-bold py-2.5 rounded-xl text-xs transition active:scale-[0.98] disabled:opacity-50"
                    >
                      {optimizingBullet ? "Optimizing with AI..." : "Optimize Bullet Point"}
                    </button>

                    {optimizedBullet && (
                      <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-3">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">✨ AI Optimized Output</span>
                        <p className="text-xs text-zinc-300 leading-relaxed italic bg-zinc-900/30 p-3 rounded-lg border border-zinc-900/60">
                          "{optimizedBullet}"
                        </p>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(optimizedBullet);
                              toast.success("Copied to clipboard!");
                            }}
                            className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[10px] text-zinc-300 font-bold px-3 py-1.5 rounded-lg transition"
                          >
                            Copy to Clipboard
                          </button>
                          
                          {originalSelectedBullet && (
                            <button
                              onClick={handleApplyBullet}
                              disabled={applyingBullet}
                              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-[10px] text-white font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                            >
                              {applyingBullet ? "Applying..." : "Apply to Resume"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab Content: Outreach & Letters */}
              {activeTab === "outreach" && (
                <div className="glass-panel p-6 rounded-2xl space-y-6">
                  <div>
                    <h4 className="font-bold text-base text-teal-400">Personalized Job Outreach Assistant</h4>
                    <p className="text-xs text-zinc-500 mt-1">AI-generated cover letter and LinkedIn networking message mapping your resume gaps to recruiter expectations.</p>
                  </div>

                  {generatingOutreach && (
                    <div className="text-center py-12">
                      <span className="text-xs text-zinc-500 animate-pulse">Generating personalized cover letter and connection message...</span>
                    </div>
                  )}

                  {!generatingOutreach && outreachData && (
                    <div className="space-y-6">
                      <div className="glass-card p-6 rounded-xl space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tailored Cover Letter</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(outreachData.cover_letter);
                                toast.success("Cover Letter copied!");
                              }}
                              className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[10px] text-zinc-300 font-bold px-3 py-1 rounded-lg transition"
                            >
                              Copy Cover Letter
                            </button>
                            <button
                              onClick={() => {
                                const tokenVal = localStorage.getItem("token") || "";
                                const downloadUrl = `http://localhost:8000/api/v1/features/download-cover-letter?resume_id=${selectedResumeId}&job_description_id=${currentAnalysis.job_description_id}&token=${encodeURIComponent(tokenVal)}`;
                                window.open(downloadUrl, "_blank");
                              }}
                              className="bg-purple-600 hover:bg-purple-500 text-[10px] text-white font-bold px-3 py-1 rounded-lg transition"
                            >
                              Download PDF
                            </button>
                          </div>
                        </div>
                        <pre className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto bg-zinc-900/20 p-4 rounded-lg border border-zinc-900">
                          {outreachData.cover_letter}
                        </pre>
                      </div>

                      <div className="glass-card p-6 rounded-xl space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">LinkedIn Recruiter Message</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(outreachData.linkedin_message);
                              toast.success("LinkedIn message copied!");
                            }}
                            className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[10px] text-zinc-300 font-bold px-3 py-1 rounded-lg transition"
                          >
                            Copy Message
                          </button>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/20 p-4 rounded-lg border border-zinc-900">
                          {outreachData.linkedin_message}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: Mock Interview Simulator */}
              {activeTab === "interview" && (
                <div className="glass-panel p-6 rounded-2xl space-y-6">
                  <div>
                    <h4 className="font-bold text-base text-amber-400">Tailored Mock Interview Simulator</h4>
                    <p className="text-xs text-zinc-500 mt-1">Practice with custom questions based specifically on the gaps discovered between your profile and the target job description.</p>
                  </div>

                  {generatingQuestions && (
                    <div className="text-center py-12">
                      <span className="text-xs text-zinc-500 animate-pulse">Creating custom interview questions tailored to your gaps...</span>
                    </div>
                  )}

                  {!generatingQuestions && interviewQuestions.length === 0 && (
                    <div className="text-center py-8 space-y-8">
                      <div className="flex flex-col md:flex-row justify-center gap-4">
                        <button
                          onClick={() => setInterviewMode('text')}
                          className={`p-6 rounded-2xl border flex flex-col items-center gap-3 transition ${interviewMode === 'text' ? 'border-amber-500 bg-amber-500/10 text-white' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white hover:border-zinc-700'}`}
                        >
                          <FileText size={24} className={interviewMode === 'text' ? 'text-amber-400' : ''} />
                          <div>
                            <div className="font-bold text-sm">Text Mode</div>
                            <div className="text-xs mt-1 opacity-80">Read questions, type answers</div>
                          </div>
                        </button>
                        <button
                          onClick={() => setInterviewMode('speech')}
                          className={`p-6 rounded-2xl border flex flex-col items-center gap-3 transition ${interviewMode === 'speech' ? 'border-amber-500 bg-amber-500/10 text-white' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white hover:border-zinc-700'}`}
                        >
                          <Mic size={24} className={interviewMode === 'speech' ? 'text-amber-400' : ''} />
                          <div>
                            <div className="font-bold text-sm">Speech Interactive</div>
                            <div className="text-xs mt-1 opacity-80">Listen to questions, speak answers</div>
                          </div>
                        </button>
                      </div>

                      <button
                        onClick={handleStartMockInterview}
                        className="bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white font-bold py-3 px-8 rounded-xl text-sm transition active:scale-[0.98] shadow-lg shadow-amber-900/20"
                      >
                        Start Mock Interview Session
                      </button>
                    </div>
                  )}

                  {interviewQuestions.length > 0 && answerEvaluations.length < interviewQuestions.length && (
                    <div className="space-y-4">
                      <div className="glass-card p-6 rounded-xl relative">
                        <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block mb-1">Question {currentQuestionIdx + 1} of {interviewQuestions.length}</span>
                        <p className="text-sm font-bold text-zinc-200 leading-relaxed pr-8">
                          {interviewQuestions[currentQuestionIdx].text}
                        </p>
                        {interviewMode === 'speech' && (
                          <button 
                            onClick={() => speakText(interviewQuestions[currentQuestionIdx].text)}
                            className="absolute top-6 right-6 text-zinc-400 hover:text-purple-400 transition"
                            title="Replay Question"
                          >
                            <Volume2 size={18} />
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                          <span>Your Answer</span>
                          {interviewMode === 'speech' && (
                            <span className={`text-[10px] ${isRecording ? 'text-red-400 animate-pulse' : 'text-zinc-500'}`}>
                              {isRecording ? 'Recording...' : 'Mic Ready'}
                            </span>
                          )}
                        </label>
                        
                        {interviewMode === 'text' ? (
                          <textarea
                            rows={5}
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            placeholder="Type or paste your response here..."
                            className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white p-3 rounded-xl focus:outline-none resize-none"
                          />
                        ) : (
                          <div className="space-y-3">
                            <div className="flex justify-center py-6 bg-zinc-950 border border-zinc-800 rounded-xl">
                              <button
                                onClick={toggleRecording}
                                className={`p-6 rounded-full transition-all duration-300 ${isRecording ? 'bg-red-500/20 text-red-500 scale-110 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                              >
                                {isRecording ? <Mic size={32} /> : <MicOff size={32} />}
                              </button>
                            </div>
                            {userAnswer && (
                              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl">
                                <p className="text-xs text-zinc-300 italic">"{userAnswer}"</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={handleSubmitAnswer}
                        disabled={evaluatingAnswer || !userAnswer.trim()}
                        className="w-full bg-white hover:bg-zinc-200 text-black py-2.5 rounded-xl font-bold text-xs transition active:scale-[0.98] disabled:opacity-50"
                      >
                        {evaluatingAnswer ? "Evaluating response with AI..." : "Submit Answer"}
                      </button>
                    </div>
                  )}

                  {answerEvaluations.length > 0 && (
                    <div className="space-y-6 pt-4 border-t border-zinc-800">
                      <h5 className="font-bold text-sm text-zinc-300">Answer Evaluations & Feedback</h5>
                      <div className="space-y-4">
                        {answerEvaluations.map((item, idx) => (
                          <div key={idx} className="glass-card p-6 rounded-xl space-y-4">
                            <div>
                              <span className="text-[10px] text-zinc-500 font-semibold block uppercase">Question {idx + 1}</span>
                              <p className="text-xs font-bold text-zinc-200 mt-1">{item.question}</p>
                            </div>
                            <div className="border-t border-zinc-900/60 pt-3">
                              <span className="text-[10px] text-zinc-500 font-semibold block uppercase">Your Response</span>
                              <p className="text-xs text-zinc-400 mt-1 italic">"{item.answer}"</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-zinc-900/60 pt-3">
                              <div className="md:col-span-1">
                                <span className="text-[10px] text-zinc-500 font-semibold block uppercase">AI Score</span>
                                <span className={`text-2xl font-black block mt-0.5 ${item.score >= 80 ? "text-emerald-400" : item.score >= 60 ? "text-amber-400" : "text-red-400"}`}>
                                  {item.score}/100
                                </span>
                              </div>
                              <div className="md:col-span-3">
                                <span className="text-[10px] text-zinc-500 font-semibold block uppercase">Strengths</span>
                                <p className="text-xs text-zinc-300 mt-0.5">{item.strengths}</p>
                              </div>
                            </div>
                            <div className="border-t border-zinc-900/60 pt-3">
                              <span className="text-[10px] text-zinc-500 font-semibold block uppercase">Constructive Feedback</span>
                              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{item.feedback}</p>
                            </div>
                            <div className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-lg">
                              <span className="text-[10px] text-purple-400 font-bold block uppercase mb-1">Recommended Response Model</span>
                              <p className="text-xs text-zinc-400 leading-relaxed italic">"{item.model_answer}"</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: Mock Interview History */}
              {activeTab === "history" && (
                <div className="glass-panel p-6 rounded-2xl space-y-6">
                  <div>
                    <h4 className="font-bold text-base text-purple-400">Mock Interview History</h4>
                    <p className="text-xs text-zinc-500 mt-1">Review your past interview questions, answers, and evaluations.</p>
                  </div>
                  
                  {interviewHistory.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-zinc-500 text-sm">No interview history found. Take a mock interview first!</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {interviewHistory.map((hist) => (
                        <div key={hist.id} className="glass-card p-6 rounded-xl space-y-4">
                          <div className="border-b border-zinc-800 pb-2 mb-4">
                            <span className="text-xs font-bold text-zinc-400">Interview Session #{hist.id}</span>
                            <span className="text-[10px] text-zinc-500 block">
                              {new Date(hist.created_at).toLocaleString()}
                            </span>
                          </div>
                          
                          {hist.questions.map((q: any, idx: number) => (
                            <div key={q.id} className="bg-zinc-950/50 border border-zinc-800/50 p-4 rounded-lg space-y-3">
                              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Question {idx + 1}</span>
                              <p className="text-sm font-bold text-zinc-200">{q.text}</p>
                              
                              <div className="pl-4 border-l-2 border-zinc-800">
                                <span className="text-[10px] text-zinc-500 font-semibold block uppercase">Your Answer</span>
                                <p className="text-xs text-zinc-400 italic mt-1">{q.answer || "No answer provided"}</p>
                              </div>
                              
                              {q.score !== null && (
                                <div className="mt-4 pt-3 border-t border-zinc-800/50">
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="md:col-span-1">
                                      <span className="text-[10px] text-zinc-500 font-semibold block uppercase">Score</span>
                                      <span className={`text-xl font-black block mt-0.5 ${q.score >= 80 ? "text-emerald-400" : q.score >= 60 ? "text-amber-400" : "text-red-400"}`}>
                                        {q.score}/100
                                      </span>
                                    </div>
                                    <div className="md:col-span-3">
                                      <span className="text-[10px] text-zinc-500 font-semibold block uppercase">Feedback</span>
                                      <p className="text-xs text-zinc-300 mt-0.5">{q.feedback}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: Optimize Skills */}
              {activeTab === "optimize" && (
                <div className="glass-panel p-6 rounded-2xl space-y-4">
                  <h4 className="font-bold text-base text-purple-400">Add Missing Skills directly to Resume</h4>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Select missing skills below to append them directly to your parsed resume profile. 
                    This will create a new resume version in your history and trigger a match analysis update.
                  </p>
                  
                  {optimizedSuggestions.length > 0 && (
                    <div className="glass-card p-6 rounded-xl space-y-4">
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">✨ AI Recommended Resume Bullet Points</span>
                      <div className="space-y-3">
                        {optimizedSuggestions.map((sug: any, idx: number) => (
                          <div key={idx} className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-900">
                            <span className="text-xs font-bold text-zinc-300 block mb-1">For Skill: {sug.skill}</span>
                            <p className="text-xs text-zinc-400 leading-relaxed italic">
                              "{sug.bullet_suggestion}"
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-2">
                        Copy these into your resume experience section to naturally demonstrate your exposure. A new version of your parsed resume has been saved in the database with these skills, and the match score has been recalculated.
                      </p>
                      <div className="pt-2">
                        <button
                          onClick={() => {
                            try {
                              const tokenVal = localStorage.getItem("token") || "";
                              const downloadUrl = `http://localhost:8000/api/v1/resumes/${selectedResumeId}/download?token=${encodeURIComponent(tokenVal)}`;
                              window.open(downloadUrl, "_blank");
                            } catch (err: any) {
                              toast.error("Failed to download updated resume: " + err.message);
                            }
                          }}
                          className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition active:scale-[0.98] shadow-md mt-3"
                        >
                          <Download size={14} />
                          Download Updated Resume File
                        </button>
                      </div>
                    </div>
                  )}

                  {currentAnalysis.analysis_results.skill_gap?.filter((s: any) => s.status === "Missing").length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {currentAnalysis.analysis_results.skill_gap
                          ?.filter((s: any) => s.status === "Missing")
                          .map((skill: any, idx: number) => {
                            const isChecked = selectedSkillsToAdd.includes(skill.name);
                            return (
                              <label 
                                key={idx} 
                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${isChecked ? "bg-purple-950/20 border-purple-500/50" : "bg-zinc-950 border-zinc-900 hover:border-zinc-800"}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedSkillsToAdd(selectedSkillsToAdd.filter((s) => s !== skill.name));
                                    } else {
                                      setSelectedSkillsToAdd([...selectedSkillsToAdd, skill.name]);
                                    }
                                  }}
                                  className="w-4 h-4 rounded text-purple-600 border-zinc-800 focus:ring-purple-500 focus:ring-offset-zinc-900 accent-purple-600"
                                />
                                <div className="min-w-0">
                                  <span className="font-bold text-xs text-zinc-200 block">{skill.name}</span>
                                  <span className="text-[10px] text-zinc-500 mt-0.5 block">Priority: {skill.importance} (+{skill.impact}% match)</span>
                                </div>
                              </label>
                            );
                          })}
                      </div>
                      
                      <button
                        onClick={handleOptimizeSkills}
                        disabled={optimizing || selectedSkillsToAdd.length === 0}
                        className="w-full bg-white hover:bg-zinc-200 text-black py-3 rounded-xl font-bold shadow-lg transition active:scale-[0.98] disabled:opacity-50 mt-4"
                      >
                        {optimizing ? "Adding & Re-analyzing..." : `Add Selected Skills (${selectedSkillsToAdd.length})`}
                      </button>
                    </div>
                  ) : (
                    <div className="glass-card p-6 rounded-xl text-center">
                      <span className="text-xs text-emerald-400 font-bold block mb-1">🎉 100% Skill Alignment!</span>
                      <p className="text-[11px] text-zinc-500">Your resume contains all the required and preferred skills parsed from the job description.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: Aptitude Test */}
              {activeTab === "aptitude" && (
                <AptitudeTest jobDescriptionId={currentAnalysis?.job_description_id} />
              )}

              {/* Tab Content: English Practice */}
              {activeTab === "english" && (
                <EnglishPractice jobDescriptionId={currentAnalysis?.job_description_id} />
              )}
            </div>
          ) : (
            <div className="bg-zinc-900/40 border border-zinc-900 p-12 rounded-2xl text-center flex flex-col items-center justify-center min-h-[300px]">
              <HelpCircle className="text-zinc-700 mb-4" size={48} />
              <h4 className="font-bold text-lg mb-2">No Analysis Selected</h4>
              <p className="text-zinc-500 text-sm max-w-md">
                Select or upload a resume on the left, paste the job description, and click "Analyze Match" to generate match diagnostics.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-6 text-center text-zinc-600 text-xs">
        &copy; {new Date().getFullYear()} ResuMatch Platform. Built for Staff-level ATS diagnostics.
      </footer>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
              <Settings size={20} className="text-purple-400" />
              User Settings
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="Enter your Gemini API Key..."
                  className="w-full glass-input text-sm px-3 py-2.5 rounded-xl focus:outline-none"
                />
                <p className="text-xs text-zinc-500 mt-2">
                  Used for job URL scraping and other AI features. If left blank, the platform's default shared key will be used (which may be rate-limited).
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  Gemini Model
                </label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full glass-input text-sm px-3 py-2.5 rounded-xl focus:outline-none bg-zinc-900/50"
                >
                  <option value="gemini-flash-lite-latest">gemini-flash-lite-latest (Recommended)</option>
                  <option value="gemini-3.5-flash">gemini-3.5-flash</option>
                  <option value="gemini-3.6-flash">gemini-3.6-flash</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                </select>
                <p className="text-xs text-zinc-500 mt-2">
                  Select the underlying AI model. Different models have different rate limits and capabilities.
                </p>
              </div>

              {usageData && (
                <div className="space-y-2 mt-4 p-4 rounded-xl bg-zinc-900/40 border border-white/5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400">Today's Usage ({usageData.model_name})</span>
                    <span className="text-zinc-300 font-medium">{usageData.usage_today} requests</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2">
                    <div 
                      className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min((usageData.usage_today / (usageData.model_name.includes('flash-lite') ? 1500 : 20)) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Estimated limit: {usageData.model_name.includes('flash-lite') ? '1,500/day' : '20/day'} (local tracking)
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-8">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingApiKey}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg transition active:scale-95 disabled:opacity-50"
              >
                {savingApiKey ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
