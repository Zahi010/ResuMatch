"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  jobDescriptionId: number;
}

export function EnglishPractice({ jobDescriptionId }: Props) {
  const [scenario, setScenario] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [answer, setAnswer] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);

  const handleGenerate = async () => {
    if (!jobDescriptionId) {
      toast.error("Please analyze a job description first.");
      return;
    }
    setGenerating(true);
    setEvaluation(null);
    setAnswer("");
    try {
      const res = await api.post("/assessments/english/generate", {
        job_description_id: jobDescriptionId
      });
      setScenario(res);
      toast.success("Scenario generated successfully!");
    } catch (err: any) {
      toast.error("Failed to generate scenario: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleEvaluate = async () => {
    if (!answer.trim()) {
      toast.error("Please type your response first.");
      return;
    }
    setEvaluating(true);
    try {
      const res = await api.post("/assessments/evaluate", {
        question_type: "english",
        question: scenario.task,
        user_answer: answer
      });
      setEvaluation(res);
      toast.success("Evaluation complete!");
    } catch (err: any) {
      toast.error("Evaluation failed: " + err.message);
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl space-y-6">
      <div>
        <h4 className="font-bold text-base text-blue-400">English Communication Practice</h4>
        <p className="text-xs text-zinc-500 mt-1">Practice your written professional communication in role-specific scenarios.</p>
      </div>

      {!scenario ? (
        <div className="text-center py-12">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 text-white font-bold py-3 px-8 rounded-xl text-sm transition active:scale-[0.98] shadow-lg shadow-blue-900/20 disabled:opacity-50"
          >
            {generating ? (
              <span className="flex items-center gap-2"><RefreshCw className="animate-spin" size={16}/> Generating Scenario...</span>
            ) : "Generate Scenario"}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-xl border border-blue-500/20 bg-blue-500/5">
            <h5 className="font-bold text-white mb-2">Scenario Context</h5>
            <p className="text-sm text-zinc-300 mb-4">{scenario.scenario}</p>
            <h5 className="font-bold text-white mb-2">Your Task</h5>
            <p className="text-sm text-blue-300 font-semibold">{scenario.task}</p>
          </div>

          {!evaluation ? (
            <div className="space-y-4">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your professional response here..."
                className="w-full h-48 glass-input text-sm p-4 rounded-xl resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleEvaluate}
                disabled={evaluating}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex justify-center items-center gap-2"
              >
                {evaluating ? <><RefreshCw className="animate-spin" size={16}/> Evaluating...</> : "Submit for Evaluation"}
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in-up">
              <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                <span className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">Overall Score</span>
                <span className={`text-2xl font-bold ${evaluation.score >= 80 ? 'text-green-400' : evaluation.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                  {evaluation.score}/100
                </span>
              </div>
              
              <div>
                <h5 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Detailed Feedback</h5>
                <p className="text-sm text-zinc-300 bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/50 leading-relaxed">
                  {evaluation.feedback}
                </p>
              </div>

              <div>
                <h5 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Polished Version (AI Suggestion)</h5>
                <p className="text-sm text-blue-200 bg-blue-900/20 p-4 rounded-xl border border-blue-500/20 leading-relaxed">
                  {evaluation.corrections}
                </p>
              </div>

              <div className="text-center pt-4">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="text-blue-400 hover:text-blue-300 text-sm font-semibold transition"
                >
                  Try Another Scenario
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
