"use client";

import Link from "next/link";
import React from "react";

export default function LandingPage() {
  return (
    <div className="bg-transparent text-white min-h-screen relative overflow-hidden flex flex-col justify-between font-sans">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-purple-600/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-20 left-1/4 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900 bg-transparent/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center font-bold text-lg">
            R
          </div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            ResuMatch
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-zinc-400 hover:text-white font-medium text-sm transition"
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="bg-white hover:bg-zinc-200 text-black px-4 py-2 rounded-lg font-medium text-sm transition shadow-lg"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-6 py-24 flex-grow flex flex-col items-center justify-center text-center relative z-10">
        <span className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wider mb-6 inline-block">
          ⚡ Powered by Next.js & GPT-4o
        </span>
        
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent max-w-4xl leading-[1.1] mb-6">
          Know your chances <br className="hidden sm:inline" /> before you apply.
        </h1>
        
        <p className="text-zinc-400 text-lg sm:text-xl max-w-2xl leading-relaxed mb-10">
          Upload your resume and target job description. Instantly check ATS compatibility, match score, find missing skills/keywords, and get customized roadmaps.
        </p>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="bg-white hover:bg-zinc-200 text-black px-8 py-4 rounded-xl font-bold text-base transition-all transform hover:scale-[1.02] shadow-xl"
          >
            Start Analyzing Free
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 w-full">
          <div className="bg-zinc-900/40 border border-zinc-900 p-8 rounded-2xl hover:border-zinc-800 transition">
            <div className="text-purple-500 mb-4 text-2xl font-bold">01 / ATS Match</div>
            <h3 className="font-bold text-lg mb-2">Check Formatting & Layouts</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Analyze columns, graphics, unreadable fonts, margins, and headers for seamless parsing.
            </p>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-900 p-8 rounded-2xl hover:border-zinc-800 transition">
            <div className="text-blue-500 mb-4 text-2xl font-bold">02 / Skill Gap</div>
            <h3 className="font-bold text-lg mb-2">Keyword & Competence Gap</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Identify missing required or preferred skills, certifications, and project gaps with actionable solutions.
            </p>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-900 p-8 rounded-2xl hover:border-zinc-800 transition">
            <div className="text-teal-500 mb-4 text-2xl font-bold">03 / Roadmaps & Prep</div>
            <h3 className="font-bold text-lg mb-2">Learn & Ace Interviews</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Get free online course links, learning timers, and role-specific technical/behavioral interview practice questions.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-8 px-6 text-center text-zinc-600 text-xs">
        &copy; {new Date().getFullYear()} ResuMatch Platform. Built for Staff-level ATS diagnostics.
      </footer>
    </div>
  );
}
