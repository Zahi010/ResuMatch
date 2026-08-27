"use client";

import { useEffect, useState, useCallback } from "react";
import { useBuilderStore } from "@/lib/builderStore";
import { api } from "@/lib/api";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import RichTextEditor from "@/components/RichTextEditor";

function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitFor: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>): void => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };
}

const getBulletsHtml = (bullets: string[] | undefined) => {
  if (!bullets || bullets.length === 0) return "";
  if (bullets.length === 1 && bullets[0].trim().startsWith("<")) return bullets[0];
  return `<ul>${bullets.map(b => `<li>${b}</li>`).join("")}</ul>`;
};

function SortableSection({ id, children }: { id: string, children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mb-4 text-zinc-500 hover:text-zinc-300 flex items-center gap-2 font-medium text-sm select-none uppercase tracking-wider">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path></svg>
        Drag to Reorder {id.replace("_", " ")}
      </div>
      {children}
    </div>
  );
}

export default function BuilderPage() {
  const store = useBuilderStore();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [cloning, setCloning] = useState(false);

  const fetchPreview = useCallback(
    debounce(async (state) => {
      setLoading(true);
      try {
        const blob = await api.postBlob("/resumes/preview", state);
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (err) {
        console.error("Failed to generate preview", err);
      } finally {
        setLoading(false);
      }
    }, 1000),
    []
  );

  useEffect(() => {
    fetchPreview(store);
  }, [store, fetchPreview]);

  const handleBuild = async () => {
    setBuilding(true);
    try {
      await api.postBlob("/resumes/build", store);
      alert("Resume built and saved successfully!");
      window.location.href = "/dashboard";
    } catch (err) {
      alert("Failed to build resume.");
    } finally {
      setBuilding(false);
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = store.design.section_order.indexOf(active.id);
      const newIndex = store.design.section_order.indexOf(over.id);
      store.reorderSections(oldIndex, newIndex);
    }
  };

  const handleCloneStyle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extractContent = window.confirm(
      "Do you want to extract and copy the text content from this resume as well?\n\nClick 'OK' to extract layout AND content.\nClick 'Cancel' to extract layout ONLY."
    );

    setCloning(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("extract_content", extractContent.toString());

      const res = await api.postForm("/clone-style", formData);
      
      if (res.design) {
        store.updateDesign(res.design);
      }
      
      if (res.parsed_content) {
         store.loadResume(res.parsed_content);
      }
      
      if (res.custom_html) {
         store.setCustomHtml(res.custom_html);
      }
      
      alert("Resume style cloned successfully!");
    } catch (err: any) {
      alert("Failed to clone resume style: " + err.message);
    } finally {
      setCloning(false);
      e.target.value = "";
    }
  };

  const renderSection = (id: string) => {
    switch (id) {
      case "summary":
        return (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-zinc-200 border-b border-zinc-800 pb-2">Professional Summary</h2>
            <RichTextEditor 
              placeholder="A brief summary of your background..." 
              value={store.summary} 
              onChange={val => store.setSummary(val)} 
            />
          </section>
        );
      case "experience":
        return (
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <h2 className="text-xl font-semibold text-zinc-200">Experience</h2>
              <button onClick={() => store.addItem("experience", { company: "", role: "", date: "", bullets: [] })} className="text-blue-600 font-medium text-sm hover:underline">+ Add Role</button>
            </div>
            {store.experience.map((exp, idx) => (
              <div key={idx} className="p-4 border border-zinc-700 bg-zinc-950 rounded text-zinc-100 placeholder-zinc-600-lg bg-zinc-900 space-y-3 relative">
                <button onClick={() => store.removeItem("experience", idx)} className="absolute top-2 right-2 text-red-500 font-bold">&times;</button>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Company" className="p-2 border border-zinc-700 bg-zinc-950 rounded text-zinc-100 placeholder-zinc-600" value={exp.company} onChange={e => store.updateItem("experience", idx, { company: e.target.value })} />
                  <input type="text" placeholder="Role Title" className="p-2 border border-zinc-700 bg-zinc-950 rounded text-zinc-100 placeholder-zinc-600" value={exp.role} onChange={e => store.updateItem("experience", idx, { role: e.target.value })} />
                  <input type="text" placeholder="Date Range" className="p-2 border border-zinc-700 bg-zinc-950 rounded text-zinc-100 placeholder-zinc-600" value={exp.date} onChange={e => store.updateItem("experience", idx, { date: e.target.value })} />
                  <input type="text" placeholder="Location" className="p-2 border border-zinc-700 bg-zinc-950 rounded text-zinc-100 placeholder-zinc-600" value={exp.location || ""} onChange={e => store.updateItem("experience", idx, { location: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 font-medium uppercase">Bullets (pipe | separated)</label>
                  <RichTextEditor 
                    value={getBulletsHtml(exp.bullets)} 
                    onChange={val => store.updateItem("experience", idx, { bullets: [val] })} 
                  />
                </div>
              </div>
            ))}
          </section>
        );
      case "education":
        return (
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <h2 className="text-xl font-semibold text-zinc-200">Education</h2>
              <button onClick={() => store.addItem("education", { institution: "", degree: "", date: "", bullets: [] })} className="text-blue-600 font-medium text-sm hover:underline">+ Add Degree</button>
            </div>
            {store.education.map((edu, idx) => (
              <div key={idx} className="p-4 border border-zinc-700 bg-zinc-950 rounded text-zinc-100 placeholder-zinc-600-lg bg-zinc-900 space-y-3 relative">
                <button onClick={() => store.removeItem("education", idx)} className="absolute top-2 right-2 text-red-500 font-bold">&times;</button>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Institution" className="p-2 border border-zinc-700 bg-zinc-950 rounded text-zinc-100 placeholder-zinc-600" value={edu.institution} onChange={e => store.updateItem("education", idx, { institution: e.target.value })} />
                  <input type="text" placeholder="Degree" className="p-2 border border-zinc-700 bg-zinc-950 rounded text-zinc-100 placeholder-zinc-600" value={edu.degree} onChange={e => store.updateItem("education", idx, { degree: e.target.value })} />
                  <input type="text" placeholder="Date" className="p-2 border border-zinc-700 bg-zinc-950 rounded text-zinc-100 placeholder-zinc-600" value={edu.date} onChange={e => store.updateItem("education", idx, { date: e.target.value })} />
                  <input type="text" placeholder="GPA (Optional)" className="p-2 border border-zinc-700 bg-zinc-950 rounded text-zinc-100 placeholder-zinc-600" value={edu.gpa || ""} onChange={e => store.updateItem("education", idx, { gpa: e.target.value })} />
                </div>
              </div>
            ))}
          </section>
        );
      case "projects":
        return (
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <h2 className="text-xl font-semibold text-zinc-200">Projects</h2>
              <button onClick={() => store.addItem("projects", { name: "", technologies: "", date: "", link: "", bullets: [] })} className="text-blue-600 font-medium text-sm hover:underline">+ Add Project</button>
            </div>
            {store.projects.map((proj, idx) => (
              <div key={idx} className="p-4 border border-zinc-700 bg-zinc-950 rounded text-zinc-100 placeholder-zinc-600-lg bg-zinc-900 space-y-3 relative">
                <button onClick={() => store.removeItem("projects", idx)} className="absolute top-2 right-2 text-red-500 font-bold">&times;</button>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Project Name" className="p-2 border border-zinc-700 bg-zinc-950 rounded text-zinc-100 placeholder-zinc-600" value={proj.name} onChange={e => store.updateItem("projects", idx, { name: e.target.value })} />
                  <input type="text" placeholder="Technologies" className="p-2 border border-zinc-700 bg-zinc-950 rounded text-zinc-100 placeholder-zinc-600" value={proj.technologies} onChange={e => store.updateItem("projects", idx, { technologies: e.target.value })} />
                  <input type="text" placeholder="Date" className="p-2 border border-zinc-700 bg-zinc-950 rounded text-zinc-100 placeholder-zinc-600" value={proj.date} onChange={e => store.updateItem("projects", idx, { date: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 font-medium uppercase">Bullets (pipe | separated)</label>
                  <RichTextEditor 
                    value={getBulletsHtml(proj.bullets)} 
                    onChange={val => store.updateItem("projects", idx, { bullets: [val] })} 
                  />
                </div>
              </div>
            ))}
          </section>
        );
      case "skills":
        return (
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <h2 className="text-xl font-semibold text-zinc-200">Skills</h2>
              <button onClick={() => store.addItem("skills", { category: "", skills: "" })} className="text-blue-600 font-medium text-sm hover:underline">+ Add Category</button>
            </div>
            {store.skills.map((skill, idx) => (
              <div key={idx} className="flex gap-3 relative">
                <input type="text" placeholder="Category (e.g. Languages)" className="w-1/3 p-2 border border-zinc-700 bg-zinc-950 rounded text-zinc-100 placeholder-zinc-600" value={skill.category} onChange={e => store.updateItem("skills", idx, { category: e.target.value })} />
                <input type="text" placeholder="Skills (comma separated)" className="w-2/3 p-2 border border-zinc-700 bg-zinc-950 rounded text-zinc-100 placeholder-zinc-600 pr-8" value={skill.skills} onChange={e => store.updateItem("skills", idx, { skills: e.target.value })} />
                <button onClick={() => store.removeItem("skills", idx)} className="absolute right-2 top-2 text-red-500 font-bold">&times;</button>
              </div>
            ))}
          </section>
        );
      case "custom_sections":
        return (
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <h2 className="text-xl font-semibold text-zinc-200">Custom Sections</h2>
              <button onClick={() => store.addItem("custom_sections", { heading: "", body: "" })} className="text-blue-600 font-medium text-sm hover:underline">+ Add Section</button>
            </div>
            {store.custom_sections.map((section, idx) => (
              <div key={idx} className="p-4 border border-zinc-700 bg-zinc-950 rounded-lg space-y-3 relative">
                <button onClick={() => store.removeItem("custom_sections", idx)} className="absolute top-2 right-2 text-red-500 font-bold">&times;</button>
                <div className="space-y-3">
                  <input type="text" placeholder="Section Heading" className="w-full p-2 border border-zinc-700 bg-zinc-950 rounded text-zinc-100 placeholder-zinc-600" value={section.heading} onChange={e => store.updateItem("custom_sections", idx, { heading: e.target.value })} />
                  <RichTextEditor 
                    placeholder="Section Body Content" 
                    value={section.body} 
                    onChange={val => store.updateItem("custom_sections", idx, { body: val })} 
                  />
                </div>
              </div>
            ))}
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      {/* Left Pane - Forms */}
      <div className="w-1/2 overflow-y-auto p-6 border-r border-zinc-800 bg-zinc-950 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Resume Builder</h1>
          <button 
            onClick={handleBuild}
            disabled={building}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow transition-all"
          >
            {building ? "Saving..." : "Save & Finish"}
          </button>
        </div>

        <div className="space-y-8">
          {/* Design Settings */}
          <section className="bg-zinc-900 p-5 rounded-xl border border-zinc-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-zinc-200">Design Settings</h2>
              <div className="relative">
                <input 
                  type="file" 
                  id="cloneStyle" 
                  accept=".pdf,image/png,image/jpeg,image/webp" 
                  className="hidden" 
                  onChange={handleCloneStyle} 
                />
                <label 
                  htmlFor="cloneStyle" 
                  className="cursor-pointer px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg text-zinc-200 border border-zinc-700 transition-colors flex items-center gap-2"
                >
                  {cloning ? (
                    <div className="animate-spin w-4 h-4 border-2 border-zinc-400 border-t-white rounded-full"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                  )}
                  {cloning ? "Cloning Style..." : "Clone Friend's Resume"}
                </label>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Template Style</label>
                <select 
                  className="w-full p-2 border border-zinc-700 bg-zinc-950 rounded-md shadow-sm text-zinc-100"
                  value={store.design.template_style}
                  onChange={(e) => store.updateDesign({ template_style: e.target.value })}
                >
                  <option value="classic">Classic (Lines)</option>
                  <option value="modern">Modern (Centered)</option>
                  <option value="minimal">Minimal (Clean)</option>
                  <option value="custom">Custom (AI Generated)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Font Family</label>
                <select 
                  className="w-full p-2 border border-zinc-700 bg-zinc-950 rounded-md shadow-sm text-zinc-100"
                  value={store.design.font_family}
                  onChange={(e) => store.updateDesign({ font_family: e.target.value })}
                >
                  <option value="helvetica">Helvetica</option>
                  <option value="times">Times New Roman</option>
                  <option value="courier">Courier</option>
                  <option value="cmr9">Computer Modern (LaTeX)</option>
                  <option value="arial">Arial</option>
                  <option value="georgia">Georgia</option>
                  <option value="verdana">Verdana</option>
                  <option value="calibri">Calibri</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Font Size ({store.design.font_size}pt)</label>
                <input 
                  type="range" min="8" max="14" step="0.5"
                  className="w-full mt-2"
                  value={store.design.font_size}
                  onChange={(e) => store.updateDesign({ font_size: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </section>

          {store.design.template_style === "custom" ? (
            <section className="space-y-4 flex flex-col h-full">
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-md p-4 mb-4">
                <p className="text-sm text-orange-400">
                  <span className="font-semibold">Custom Template Mode:</span> You are editing the raw HTML/CSS directly. The standard form inputs are disabled.
                </p>
              </div>
              <textarea 
                className="w-full flex-1 p-4 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-100 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                style={{ minHeight: "500px" }}
                value={store.custom_html}
                onChange={(e) => store.setCustomHtml(e.target.value)}
                placeholder="<html>...</html>"
              />
            </section>
          ) : (
            <>
              {/* Personal Info */}
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-zinc-200 border-b border-zinc-800 pb-2">Personal Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Full Name" className="w-full p-2 border border-zinc-700 bg-zinc-950 rounded shadow-sm text-zinc-100 placeholder-zinc-600" value={store.personal.full_name} onChange={e => store.updatePersonal({ full_name: e.target.value })} />
                  <input type="email" placeholder="Email" className="w-full p-2 border border-zinc-700 bg-zinc-950 rounded shadow-sm text-zinc-100 placeholder-zinc-600" value={store.personal.email} onChange={e => store.updatePersonal({ email: e.target.value })} />
                  <input type="text" placeholder="Phone" className="w-full p-2 border border-zinc-700 bg-zinc-950 rounded shadow-sm text-zinc-100 placeholder-zinc-600" value={store.personal.phone} onChange={e => store.updatePersonal({ phone: e.target.value })} />
                  <input type="text" placeholder="Location" className="w-full p-2 border border-zinc-700 bg-zinc-950 rounded shadow-sm text-zinc-100 placeholder-zinc-600" value={store.personal.location} onChange={e => store.updatePersonal({ location: e.target.value })} />
                  <input type="text" placeholder="LinkedIn" className="w-full p-2 border border-zinc-700 bg-zinc-950 rounded shadow-sm text-zinc-100 placeholder-zinc-600" value={store.personal.linkedin} onChange={e => store.updatePersonal({ linkedin: e.target.value })} />
                  <input type="text" placeholder="GitHub" className="w-full p-2 border border-zinc-700 bg-zinc-950 rounded shadow-sm text-zinc-100 placeholder-zinc-600" value={store.personal.github} onChange={e => store.updatePersonal({ github: e.target.value })} />
                  <input type="text" placeholder="Portfolio" className="w-full p-2 border border-zinc-700 bg-zinc-950 rounded shadow-sm text-zinc-100 placeholder-zinc-600 col-span-2" value={store.personal.portfolio} onChange={e => store.updatePersonal({ portfolio: e.target.value })} />
                </div>
              </section>

              {/* Dynamic Reorderable Sections */}
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={store.design.section_order} strategy={verticalListSortingStrategy}>
                  {store.design.section_order.map((sectionId) => (
                    <SortableSection key={sectionId} id={sectionId}>
                      {renderSection(sectionId)}
                    </SortableSection>
                  ))}
                </SortableContext>
              </DndContext>
            </>
          )}

        </div>
      </div>

      {/* Right Pane - Live Preview */}
      <div className="w-1/2 bg-zinc-800 flex flex-col items-center justify-center relative p-6">
        {loading && (
          <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-xs font-semibold animate-pulse z-10">
            Updating preview...
          </div>
        )}
        
        {pdfUrl ? (
          <div className="w-full h-full bg-white rounded-lg shadow-2xl overflow-hidden border border-zinc-700">
            <iframe src={`${pdfUrl}#toolbar=0&navpanes=0`} className="w-full h-full border-0" />
          </div>
        ) : (
          <div className="text-zinc-400 font-medium text-lg flex flex-col items-center">
            <div className="animate-spin w-8 h-8 border-4 border-zinc-600 border-t-blue-500 rounded-full mb-4"></div>
            Initializing Preview...
          </div>
        )}
      </div>
    </div>
  );
}
