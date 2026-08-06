"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Trash2, ExternalLink, Plus, Calendar, Search, Filter, AlertCircle, Flag, FileText, PieChart, Activity, CheckCircle2, Clock } from "lucide-react";

const COLUMNS = ["Saved", "Applied", "Interviewing", "Offer", "Rejected"];

interface Resume {
  id: number;
  filename: string;
}

interface JobHistory {
  id: number;
  previous_status: string | null;
  new_status: string;
  changed_at: string;
}

interface JobApp {
  id: number;
  job_title: string;
  company: string;
  url?: string;
  status: string;
  notes?: string;
  location?: string;
  application_method?: string;
  contact_person?: string;
  contact_url?: string;
  work_mode?: string;
  job_type?: string;
  interview_date?: string;
  priority?: string;
  follow_up_date?: string;
  resume_id?: number;
  target_salary?: string;
  offered_salary?: string;
  is_archived?: boolean;
  insights?: any;
  brag_sheet?: any;
  created_at: string;
  history?: JobHistory[];
}

const formatISTDate = (dateString: string) => {
  if (!dateString) return "";
  const utcDateStr = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
  const d = new Date(utcDateStr);
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  return formatter.format(d).replace(/\//g, ' ');
};

const formatISTDateTime = (dateString: string) => {
  if (!dateString) return "";
  const utcDateStr = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
  const d = new Date(utcDateStr);
  const dateFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timeFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  return `${dateFormatter.format(d).replace(/\//g, ' ')}, ${timeFormatter.format(d)}`;
};

export default function JobTracker() {
  const [jobs, setJobs] = useState<JobApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobApp | null>(null);
  const [editingNotes, setEditingNotes] = useState("");
  const [editingLocation, setEditingLocation] = useState("");
  const [editingMethod, setEditingMethod] = useState("");
  const [editingContact, setEditingContact] = useState("");
  const [editingWorkMode, setEditingWorkMode] = useState("");
  const [editingJobType, setEditingJobType] = useState("");
  const [editingInterviewDate, setEditingInterviewDate] = useState("");
  const [editingPriority, setEditingPriority] = useState("");
  const [editingFollowUpDate, setEditingFollowUpDate] = useState("");
  const [editingResumeId, setEditingResumeId] = useState<number | "">("");
  const [editingTargetSalary, setEditingTargetSalary] = useState("");
  const [editingOfferedSalary, setEditingOfferedSalary] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [estimatingSalary, setEstimatingSalary] = useState(false);
  const [generatingBragSheet, setGeneratingBragSheet] = useState(false);
  const [compareOffersOpen, setCompareOffersOpen] = useState(false);
  
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState("");
  const [filterType, setFilterType] = useState("");

  useEffect(() => {
    fetchJobs();
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    try {
      const data = await api.get("/resumes/");
      setResumes(data);
    } catch (err) {
      console.error("Failed to fetch resumes", err);
    }
  };

  const fetchJobs = async () => {
    try {
      const data = await api.get("/tracker/");
      setJobs(data);
    } catch (err) {
      console.error("Failed to fetch job applications", err);
    } finally {
      setLoading(false);
    }
  };

  const router = useRouter();

  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData("jobId", id.toString());
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const jobId = parseInt(e.dataTransfer.getData("jobId"));
    
    // Optimistic update
    const previousJobs = [...jobs];
    setJobs(jobs.map(job => job.id === jobId ? { ...job, status: targetStatus } : job));

    try {
      await api.put(`/tracker/${jobId}`, { status: targetStatus });
    } catch (err) {
      console.error("Failed to update status", err);
      setJobs(previousJobs); // Revert on failure
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const deleteJob = async (id: number) => {
    if (!confirm("Are you sure you want to delete this job application?")) return;
    try {
      await api.delete(`/tracker/${id}`);
      setJobs(jobs.filter(job => job.id !== id));
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  const isGhosted = (job: JobApp) => {
    if (job.status !== "Applied") return false;
    if (job.interview_date) return false;
    const daysSince = (new Date().getTime() - new Date(job.created_at).getTime()) / (1000 * 3600 * 24);
    return daysSince > 30;
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.job_title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          job.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMode = filterMode ? job.work_mode === filterMode : true;
    const matchesType = filterType ? job.job_type === filterType : true;
    const notGhostedOrArchived = showArchived ? true : !(job.is_archived || isGhosted(job));
    return matchesSearch && matchesMode && matchesType && notGhostedOrArchived;
  });

  return (
    <div className="min-h-screen bg-neutral-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] text-white font-sans flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/dashboard')}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center font-bold text-lg">
            R
          </div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            ResuMatch
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg text-sm transition"
          >
            Dashboard
          </button>
          <button
            onClick={() => router.push('/builder')}
            className="flex items-center gap-2 hover:bg-purple-900/30 border border-purple-500/30 text-purple-400 hover:text-purple-300 px-4 py-1.5 rounded-lg text-sm transition font-medium"
          >
            Resume Builder
          </button>
        </div>
      </header>
      
      <main className="flex-1 overflow-x-auto p-8">
        <header className="mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Job Tracker</h1>
            <p className="text-neutral-400 mt-1">Organize your applications from saved to hired.</p>
          </div>
          
          <div className="flex gap-4 items-center">
            {jobs.filter(j => j.status === 'Offer').length > 1 && (
              <button 
                onClick={() => setCompareOffersOpen(true)}
                className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 text-sm px-4 py-2 rounded-xl border border-emerald-500/30 transition-all font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              >
                ⚖️ Compare Offers ({jobs.filter(j => j.status === 'Offer').length})
              </button>
            )}
            <div className="flex gap-4 items-center bg-zinc-900/40 backdrop-blur-md p-3 rounded-2xl border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
            <div className="text-center px-4 border-r border-white/10">
              <div className="text-2xl font-bold text-white">{jobs.length}</div>
              <div className="text-xs text-zinc-500 font-medium">TOTAL SAVED</div>
            </div>
            <div className="text-center px-4 border-r border-white/10">
              <div className="text-2xl font-bold text-purple-400">
                {jobs.filter(j => ['Applied', 'Interviewing', 'Offer'].includes(j.status)).length}
              </div>
              <div className="text-xs text-zinc-500 font-medium">ACTIVE</div>
            </div>
            <div className="text-center px-4">
              <div className="text-2xl font-bold text-emerald-400">
                {jobs.filter(j => ['Applied', 'Interviewing', 'Offer', 'Rejected'].includes(j.status)).length > 0 
                  ? Math.round((jobs.filter(j => ['Interviewing', 'Offer'].includes(j.status)).length / jobs.filter(j => ['Applied', 'Interviewing', 'Offer', 'Rejected'].includes(j.status)).length) * 100) 
                  : 0}%
              </div>
              <div className="text-xs text-zinc-500 font-medium">INTERVIEW RATE</div>
            </div>
          </div>
          </div>
        </header>

        <div className="mb-6 flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text" 
              placeholder="Search by role or company..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/80 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>
          <select 
            value={filterMode} 
            onChange={e => setFilterMode(e.target.value)}
            className="bg-zinc-900/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none"
          >
            <option value="">All Work Modes</option>
            <option value="Remote">Remote</option>
            <option value="Hybrid">Hybrid</option>
            <option value="On-site">On-site</option>
          </select>
          <select 
            value={filterType} 
            onChange={e => setFilterType(e.target.value)}
            className="bg-zinc-900/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none"
          >
            <option value="">All Job Types</option>
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Contract">Contract</option>
            <option value="Internship">Internship</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-zinc-300 ml-4 cursor-pointer">
            <input 
              type="checkbox" 
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
              className="rounded bg-zinc-900 border-zinc-700 text-purple-500 focus:ring-purple-500"
            />
            Show Ghosted
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : (
          <div className="flex gap-6 h-[calc(100vh-140px)] pb-4">
            {COLUMNS.map((column) => (
              <div 
                key={column} 
                className="flex flex-col bg-zinc-900/30 backdrop-blur-xl rounded-2xl min-w-[320px] max-w-[320px] p-4 border border-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] relative overflow-hidden"
                onDrop={(e) => handleDrop(e, column)}
                onDragOver={handleDragOver}
              >
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r 
                  ${column === 'Saved' ? 'from-zinc-500 to-zinc-700' : ''}
                  ${column === 'Applied' ? 'from-blue-500 to-cyan-500' : ''}
                  ${column === 'Interviewing' ? 'from-purple-500 to-pink-500' : ''}
                  ${column === 'Offer' ? 'from-emerald-400 to-teal-500' : ''}
                  ${column === 'Rejected' ? 'from-red-500 to-orange-500' : ''}
                `}></div>
                
                <div className="flex justify-between items-center mb-5 px-1 pt-1">
                  <h2 className="font-bold text-lg text-white tracking-wide">{column}</h2>
                  <span className="bg-white/10 text-xs px-2.5 py-1 rounded-full font-medium text-zinc-300 border border-white/5 shadow-inner">
                    {filteredJobs.filter(j => j.status === column).length}
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                  {filteredJobs
                    .filter((job) => job.status === column)
                    .map((job) => (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, job.id)}
                        onClick={() => { 
                          setSelectedJob(job); 
                          setEditingNotes(job.notes || "");
                          setEditingLocation(job.location || "");
                          setEditingMethod(job.application_method || "");
                          setEditingContact(job.contact_person || "");
                          setEditingWorkMode(job.work_mode || "");
                          setEditingJobType(job.job_type || "");
                          setEditingPriority(job.priority || "");
                          setEditingResumeId(job.resume_id || "");
                          setEditingTargetSalary(job.target_salary || "");
                          setEditingOfferedSalary(job.offered_salary || "");
                          
                          const parseDate = (dString: string) => {
                             const utcStr = dString.endsWith('Z') ? dString : `${dString}Z`;
                             const d = new Date(utcStr);
                             const pad = (n: number) => String(n).padStart(2, '0');
                             return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                          };

                          if (job.interview_date) {
                            setEditingInterviewDate(parseDate(job.interview_date));
                          } else {
                            setEditingInterviewDate("");
                          }
                          
                          if (job.follow_up_date) {
                            setEditingFollowUpDate(parseDate(job.follow_up_date));
                          } else {
                            setEditingFollowUpDate("");
                          }
                        }}
                        className={`relative bg-white/5 backdrop-blur-md p-5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 hover:border-purple-500/50 hover:shadow-[0_8px_30px_rgb(168,85,247,0.15)] hover:-translate-y-1 transition-all duration-300 group ${(isGhosted(job) || job.is_archived) ? 'opacity-50 grayscale' : ''}`}
                      >
                        {(isGhosted(job) || job.is_archived) && (
                          <div className="absolute -top-3 -left-2 bg-zinc-800 text-zinc-300 text-[10px] px-2.5 py-1 rounded-full border border-zinc-700 shadow-lg font-medium">
                            {job.is_archived ? 'Archived' : 'Ghosted?'}
                          </div>
                        )}
                        {job.follow_up_date && ['Saved', 'Applied', 'Interviewing'].includes(job.status) && new Date(job.follow_up_date) < new Date() && (
                          <div className="absolute -top-3 -right-2 bg-gradient-to-r from-red-500 to-rose-600 text-white p-1.5 rounded-full shadow-lg border border-red-400/30" title="Follow-up overdue!">
                            <AlertCircle size={14} />
                          </div>
                        )}
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-white text-base truncate pr-2" title={job.job_title}>{job.job_title}</h3>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteJob(job.id); }}
                            className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-black/40 rounded-md"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm text-zinc-400 font-medium truncate pr-2">{job.company}</p>
                          {job.priority && (
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider shrink-0
                              ${job.priority === 'High' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : ''}
                              ${job.priority === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : ''}
                              ${job.priority === 'Low' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : ''}
                              ${job.priority === 'Dream Job' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : ''}
                            `}>
                              {job.priority}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between text-xs text-zinc-500 font-medium">
                          <span>{formatISTDate(job.created_at)}</span>
                          {job.url && (
                            <a 
                              href={job.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-zinc-400 hover:text-purple-400 transition-colors bg-white/5 px-2 py-1 rounded-md"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Link <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                        {job.interview_date && job.status === "Interviewing" && (
                          <div className="mt-4 pt-3 border-t border-white/5">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold rounded-lg shadow-inner">
                               <Calendar size={14} className="text-purple-400" />
                               {formatISTDateTime(job.interview_date)}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold">{selectedJob.job_title}</h2>
                <p className="text-purple-400">{selectedJob.company}</p>
              </div>
              <button 
                onClick={() => setSelectedJob(null)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Status</label>
                <select 
                  value={selectedJob.status}
                  onChange={async (e) => {
                    const newStatus = e.target.value;
                    const previousJobs = [...jobs];
                    setJobs(jobs.map(job => job.id === selectedJob.id ? { ...job, status: newStatus } : job));
                    setSelectedJob({...selectedJob, status: newStatus});
                    try {
                      await api.put(`/tracker/${selectedJob.id}`, { status: newStatus });
                    } catch {
                      setJobs(previousJobs);
                      setSelectedJob({...selectedJob, status: selectedJob.status});
                    }
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                >
                  {COLUMNS.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Location</label>
                  <input 
                    type="text"
                    value={editingLocation}
                    onChange={(e) => setEditingLocation(e.target.value)}
                    placeholder="e.g. Remote, NYC"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">App Method</label>
                  <input 
                    type="text"
                    value={editingMethod}
                    onChange={(e) => setEditingMethod(e.target.value)}
                    placeholder="e.g. LinkedIn, Referral"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Work Mode</label>
                  <input 
                    type="text"
                    value={editingWorkMode}
                    onChange={(e) => setEditingWorkMode(e.target.value)}
                    placeholder="e.g. Remote, Hybrid, On-site"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Job Type</label>
                  <input 
                    type="text"
                    value={editingJobType}
                    onChange={(e) => setEditingJobType(e.target.value)}
                    placeholder="e.g. Full-time, Contract"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-zinc-500 uppercase">Target Salary</label>
                    <button 
                      disabled={estimatingSalary}
                      onClick={async () => {
                        setEstimatingSalary(true);
                        try {
                          const res = await api.estimateSalary(selectedJob.id);
                          setEditingTargetSalary(res.target_salary);
                          setSelectedJob({...selectedJob, target_salary: res.target_salary});
                        } catch(e) { console.error(e); }
                        setEstimatingSalary(false);
                      }}
                      className="text-xs font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      {estimatingSalary ? <span className="animate-pulse">Estimating...</span> : <>✨ Estimate</>}
                    </button>
                  </div>
                  <input 
                    type="text"
                    value={editingTargetSalary}
                    onChange={(e) => setEditingTargetSalary(e.target.value)}
                    placeholder="e.g. $120k - $140k"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-zinc-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Offered Salary</label>
                  <input 
                    type="text"
                    value={editingOfferedSalary}
                    onChange={(e) => setEditingOfferedSalary(e.target.value)}
                    placeholder="e.g. $135k + Equity"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Priority</label>
                  <select 
                    value={editingPriority}
                    onChange={(e) => setEditingPriority(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="">None</option>
                    <option value="Dream Job">Dream Job</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-zinc-500 uppercase">Resume Linked</label>
                    {editingResumeId && (
                      <button 
                        onClick={async () => {
                          try {
                            const blob = await api.download(`/resumes/${editingResumeId}/download`);
                            const pdfBlob = new Blob([blob], { type: 'application/pdf' });
                            const url = URL.createObjectURL(pdfBlob);
                            window.open(url, '_blank');
                          } catch (err) {
                            console.error("Failed to view resume", err);
                          }
                        }}
                        className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        View <ExternalLink size={10} />
                      </button>
                    )}
                  </div>
                  <select 
                    value={editingResumeId}
                    onChange={(e) => setEditingResumeId(e.target.value === "" ? "" : Number(e.target.value))}
                    disabled={selectedJob.status !== "Saved"}
                    className={`w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none ${selectedJob.status !== "Saved" ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <option value="">None</option>
                    {resumes.map(r => (
                      <option key={r.id} value={r.id}>{r.filename}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 mb-2 border-t border-zinc-800 pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2"><PieChart size={18} className="text-purple-400"/> AI Job Insights</h3>
                  {!selectedJob.insights && (
                    <button 
                      disabled={generatingInsights}
                      onClick={async () => {
                        setGeneratingInsights(true);
                        try {
                          const res = await api.generateJobInsights(selectedJob.id);
                          setSelectedJob({...selectedJob, insights: res.insights});
                        } catch(e) { console.error(e); }
                        setGeneratingInsights(false);
                      }}
                      className="bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 text-xs px-3 py-1.5 rounded-lg border border-purple-500/30 transition-all font-medium flex items-center gap-2"
                    >
                      {generatingInsights ? <span className="animate-pulse">Analyzing...</span> : <>✨ Generate Insights</>}
                    </button>
                  )}
                </div>
                
                {selectedJob.insights && (
                  <div className="space-y-4">
                    <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                      <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Top Requirements</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedJob.insights.tech_stack?.map((t: string, i: number) => (
                          <span key={i} className="text-xs px-2 py-1 bg-zinc-800 rounded-md text-zinc-300">{t}</span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                      <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Core Responsibilities</h4>
                      <ul className="list-disc pl-4 space-y-1">
                        {selectedJob.insights.responsibilities?.map((r: string, i: number) => (
                          <li key={i} className="text-sm text-zinc-300">{r}</li>
                        ))}
                      </ul>
                    </div>
                    {selectedJob.insights.red_flags?.length > 0 && (
                      <div className="bg-red-900/10 p-4 rounded-xl border border-red-500/20">
                        <h4 className="text-xs font-bold text-red-500 uppercase mb-2 flex items-center gap-1"><Flag size={12}/> Red Flags</h4>
                        <ul className="list-disc pl-4 space-y-1 text-sm text-red-400/90">
                          {selectedJob.insights.red_flags.map((r: string, i: number) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedJob.insights.green_flags?.length > 0 && (
                      <div className="bg-emerald-900/10 p-4 rounded-xl border border-emerald-500/20">
                        <h4 className="text-xs font-bold text-emerald-500 uppercase mb-2 flex items-center gap-1"><Flag size={12}/> Green Flags</h4>
                        <ul className="list-disc pl-4 space-y-1 text-sm text-emerald-400/90">
                          {selectedJob.insights.green_flags.map((r: string, i: number) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Follow-Up Date</label>
                <input 
                  type="datetime-local"
                  value={editingFollowUpDate}
                  onChange={(e) => setEditingFollowUpDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-zinc-300"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-semibold text-zinc-500 uppercase">Contact Person / Recruiter</label>
                  {selectedJob.contact_url && (
                    <a href={selectedJob.contact_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      View Profile <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                <input 
                  type="text"
                  value={editingContact}
                  onChange={(e) => setEditingContact(e.target.value)}
                  placeholder="Name or Email"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              {selectedJob.status === "Interviewing" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Interview Date & Time</label>
                    <input 
                      type="datetime-local"
                      value={editingInterviewDate}
                      onChange={(e) => setEditingInterviewDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none text-zinc-300"
                    />
                  </div>
                  
                  <div className="mt-6 mb-2 border-t border-zinc-800 pt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold text-lg flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-400"/> Interview Brag Sheet</h3>
                      {!selectedJob.brag_sheet && (
                        <button 
                          disabled={generatingBragSheet}
                          onClick={async () => {
                            setGeneratingBragSheet(true);
                            try {
                              const res = await api.generateBragSheet(selectedJob.id);
                              setSelectedJob({...selectedJob, brag_sheet: res.brag_sheet});
                            } catch(e) { console.error(e); }
                            setGeneratingBragSheet(false);
                          }}
                          className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 transition-all font-medium flex items-center gap-2"
                        >
                          {generatingBragSheet ? <span className="animate-pulse">Generating...</span> : <>✨ Generate Strategy</>}
                        </button>
                      )}
                    </div>
                    
                    {selectedJob.brag_sheet && selectedJob.brag_sheet.talking_points && (
                      <div className="space-y-3">
                        {selectedJob.brag_sheet.talking_points.map((tp: any, i: number) => (
                          <div key={i} className="bg-zinc-900/80 p-4 rounded-xl border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)] relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                            <h4 className="font-bold text-sm text-white mb-1">{tp.project_or_experience}</h4>
                            <p className="text-xs text-emerald-400 mb-2 font-medium">Why it matters: <span className="text-zinc-400 font-normal">{tp.why_it_matters}</span></p>
                            <div className="bg-black/30 p-2 rounded text-xs text-zinc-300 italic">
                              "{tp.star_method_summary}"
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Notes</label>
                <textarea 
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="Add interview feedback, links, or contacts..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none min-h-[80px] resize-none"
                />
              </div>

              {/* History Timeline */}
              {selectedJob.history && selectedJob.history.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-3 mt-4">Status History</label>
                  <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-800 before:to-transparent">
                    {selectedJob.history.map((hist, index) => (
                      <div key={hist.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-4 h-4 rounded-full border border-zinc-700 bg-zinc-900 text-slate-500 group-[.is-active]:text-emerald-50 group-[.is-active]:bg-purple-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ml-0"></div>
                        <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 shadow">
                          <div className="flex items-center justify-between space-x-2 mb-1">
                            <div className="font-bold text-sm text-purple-400">{hist.new_status}</div>
                            <time className="font-mono text-xs text-zinc-500">{formatISTDateTime(hist.changed_at)}</time>
                          </div>
                          {hist.previous_status && (
                            <div className="text-xs text-zinc-400">Moved from {hist.previous_status}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedJob.url && (
                <div>
                  <a href={selectedJob.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium">
                    <ExternalLink size={16} /> Open original Job Posting
                  </a>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex justify-end gap-3">
              <button 
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-900 border border-transparent hover:border-zinc-800"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  try {
                    const updateData = {
                      notes: editingNotes,
                      location: editingLocation,
                      application_method: editingMethod,
                      contact_person: editingContact,
                      work_mode: editingWorkMode,
                      job_type: editingJobType,
                      priority: editingPriority || null,
                      resume_id: editingResumeId === "" ? null : editingResumeId,
                      follow_up_date: editingFollowUpDate ? new Date(editingFollowUpDate).toISOString() : null,
                      interview_date: editingInterviewDate ? new Date(editingInterviewDate).toISOString() : null,
                      target_salary: editingTargetSalary,
                      offered_salary: editingOfferedSalary
                    };
                    await api.put(`/tracker/${selectedJob.id}`, updateData);
                    setJobs(jobs.map(job => job.id === selectedJob.id ? { ...job, ...updateData } : job));
                    setSelectedJob(null);
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {compareOffersOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_50px_rgba(16,185,129,0.1)]">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <h2 className="text-xl font-bold flex items-center gap-2 text-emerald-400">⚖️ Offer Comparison Matrix</h2>
              <button onClick={() => setCompareOffersOpen(false)} className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-800 transition">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-auto">
              <div className="flex gap-4">
                {jobs.filter(j => j.status === 'Offer').map(job => (
                  <div key={job.id} className="flex-1 min-w-[250px] bg-zinc-900/40 rounded-xl border border-white/10 p-5 space-y-4 relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-t-xl"></div>
                    <div>
                      <h3 className="font-bold text-lg text-white">{job.company}</h3>
                      <p className="text-sm text-zinc-400">{job.job_title}</p>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs text-zinc-500 uppercase font-semibold mb-1">Target vs Offered</div>
                        <div className="text-lg font-bold text-emerald-400">{job.offered_salary || "Not specified"}</div>
                        {job.target_salary && <div className="text-xs text-zinc-400 mt-1">Target: {job.target_salary}</div>}
                      </div>
                      
                      <div>
                        <div className="text-xs text-zinc-500 uppercase font-semibold mb-1">Work Setup</div>
                        <div className="text-sm text-zinc-300">{job.work_mode || "Unknown"} • {job.job_type || "Unknown"}</div>
                      </div>
                      
                      <div>
                        <div className="text-xs text-zinc-500 uppercase font-semibold mb-1">Pros & Cons / Notes</div>
                        <div className="text-sm text-zinc-300 whitespace-pre-wrap">{job.notes || "No notes added"}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
