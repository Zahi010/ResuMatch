import { create } from "zustand";

interface AuthState {
  token: string | null;
  user: any | null;
  setToken: (token: string | null) => void;
  setUser: (user: any | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== "undefined" ? localStorage.getItem("token") : null,
  user: null,
  setToken: (token) => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
    set({ token });
  },
  setUser: (user) => set({ user }),
  logout: () => {
    localStorage.removeItem("token");
    set({ token: null, user: null });
  },
}));

interface MatchState {
  resumes: any[];
  jobDescriptions: any[];
  currentAnalysis: any | null;
  setResumes: (resumes: any[]) => void;
  setJobDescriptions: (jobDescriptions: any[]) => void;
  setCurrentAnalysis: (analysis: any | null) => void;
}

export const useMatchStore = create<MatchState>((set) => ({
  resumes: [],
  jobDescriptions: [],
  currentAnalysis: null,
  setResumes: (resumes) => set({ resumes }),
  setJobDescriptions: (jobDescriptions) => set({ jobDescriptions }),
  setCurrentAnalysis: (currentAnalysis) => set({ currentAnalysis }),
}));
