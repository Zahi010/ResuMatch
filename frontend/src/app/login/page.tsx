"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const setToken = useAuthStore((state) => state.setToken);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        // Register
        await api.post("/auth/register", {
          email,
          password,
          full_name: fullName,
        });
        // Auto-login after successful registration
        setIsRegister(false);
        setError("Account created! Please enter your password to login.");
        setLoading(false);
        return;
      }

      // Login
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);
      
      const res = await api.postForm("/auth/login", formData);
      setToken(res.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent text-white relative overflow-hidden px-4">
      {/* Background Gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px] pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 p-8 rounded-2xl shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            {isRegister ? "Create an account" : "Welcome back"}
          </h2>
          <p className="text-sm text-zinc-400 mt-2">
            {isRegister ? "Get started with ResuMatch today" : "Sign in to access your dashboard"}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-transparent/80 border border-zinc-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-transparent/80 border border-zinc-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-transparent/80 border border-zinc-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white hover:bg-zinc-200 text-black py-3 rounded-xl font-semibold shadow-lg transition active:scale-[0.98] disabled:opacity-50 mt-4"
          >
            {loading ? "Processing..." : isRegister ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
            className="text-sm text-zinc-400 hover:text-white transition"
          >
            {isRegister
              ? "Already have an account? Sign In"
              : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
