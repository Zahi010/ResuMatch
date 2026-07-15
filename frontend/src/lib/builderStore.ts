import { create } from "zustand";

export interface BuilderState {
  design: {
    template_style: string;
    font_family: string;
    font_size: number;
    margin: number;
    section_order: string[];
  };
  personal: {
    full_name: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    github: string;
    portfolio: string;
  };
  summary: string;
  education: any[];
  experience: any[];
  projects: any[];
  skills: any[];
  custom_sections: any[];
  custom_html: string;
  
  updateDesign: (design: Partial<BuilderState["design"]>) => void;
  reorderSections: (startIndex: number, endIndex: number) => void;
  updatePersonal: (personal: Partial<BuilderState["personal"]>) => void;
  setSummary: (summary: string) => void;
  setCustomHtml: (html: string) => void;
  loadResume: (data: Partial<BuilderState>) => void;
  
  addItem: (section: "education" | "experience" | "projects" | "skills" | "custom_sections", item: any) => void;
  updateItem: (section: "education" | "experience" | "projects" | "skills" | "custom_sections", index: number, item: any) => void;
  removeItem: (section: "education" | "experience" | "projects" | "skills" | "custom_sections", index: number) => void;
}

export const useBuilderStore = create<BuilderState>((set) => ({
  design: {
    template_style: "classic",
    font_family: "helvetica",
    font_size: 11,
    margin: 36,
    section_order: ["summary", "experience", "education", "projects", "skills", "custom_sections"],
  },
  personal: {
    full_name: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    portfolio: "",
  },
  summary: "",
  education: [],
  experience: [],
  projects: [],
  skills: [],
  custom_sections: [],
  custom_html: "",
  
  updateDesign: (design) => set((state) => ({ design: { ...state.design, ...design } })),
  reorderSections: (startIndex, endIndex) => set((state) => {
    const result = Array.from(state.design.section_order);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return { design: { ...state.design, section_order: result } };
  }),
  updatePersonal: (personal) => set((state) => ({ personal: { ...state.personal, ...personal } })),
  setSummary: (summary) => set((state) => ({ summary })),
  setCustomHtml: (html) => set((state) => ({ custom_html: html })),
  loadResume: (data) => set((state) => ({ ...state, ...data })),
  
  addItem: (section, item) => set((state) => ({ [section]: [...state[section], item] })),
  updateItem: (section, index, item) => set((state) => {
    const list = [...state[section]];
    list[index] = { ...list[index], ...item };
    return { [section]: list };
  }),
  removeItem: (section, index) => set((state) => {
    const list = [...state[section]];
    list.splice(index, 1);
    return { [section]: list };
  })
}));
