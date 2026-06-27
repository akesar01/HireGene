"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { updateProfile, type ResumeProfile, type FilterSummary } from "@/lib/profile";

const ROLE_FAMILIES = [
  { value: "engineering", label: "Engineering" },
  { value: "ai_ml", label: "AI / ML" },
  { value: "product", label: "Product" },
  { value: "design", label: "Design" },
  { value: "data", label: "Data" },
  { value: "growth", label: "Growth" },
  { value: "marketing", label: "Marketing" },
  { value: "content", label: "Content" },
  { value: "ops", label: "Operations" },
  { value: "founders_office", label: "Founder's Office" },
  { value: "sales", label: "Sales" },
  { value: "strategy", label: "Strategy" },
  { value: "finance", label: "Finance" },
  { value: "business", label: "Business" },
  { value: "people", label: "People" },
];

const SENIORITY_LEVELS = [
  { value: "intern", label: "Intern" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
  { value: "staff", label: "Staff" },
  { value: "head", label: "Head" },
];

const REMOTE_MODES = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "in_office", label: "In-office" },
];

const TECH_STACKS = [
  "python", "java", "sql", "ai", "aws", "langchain", "rag",
  "react", "llm", "nextjs", "typescript", "nodejs", "go", "rust", "docker",
];

interface FilterEditorProps {
  profile: ResumeProfile;
  onUpdated: (profile: ResumeProfile) => void;
  onError: (msg: string) => void;
}

export default function FilterEditor({ profile, onUpdated, onError }: FilterEditorProps) {
  const { getToken } = useAuth();
  const [currentTitle, setCurrentTitle] = useState(profile.filterSummary.currentTitle);
  const [roleFamily, setRoleFamily] = useState(profile.filterSummary.roleFamily);
  const [seniority, setSeniority] = useState(profile.filterSummary.seniority);
  const [remoteMode, setRemoteMode] = useState(profile.filterSummary.remoteMode);
  const [stack, setStack] = useState<string[]>(profile.filterSummary.stack);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync when profile changes (e.g. after resume upload)
  useEffect(() => {
    setCurrentTitle(profile.filterSummary.currentTitle);
    setRoleFamily(profile.filterSummary.roleFamily);
    setSeniority(profile.filterSummary.seniority);
    setRemoteMode(profile.filterSummary.remoteMode);
    setStack(profile.filterSummary.stack);
  }, [profile]);

  const toggleStack = (tech: string) => {
    setStack((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
    );
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      const token = await getToken();
      if (!token) {
        onError("Not authenticated. Please sign in again.");
        return;
      }
      const updated = await updateProfile(token, {
        currentTitle,
        roleFamily,
        seniority,
        remoteMode,
        stack,
      });
      onUpdated(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [getToken, currentTitle, roleFamily, seniority, remoteMode, stack, onUpdated, onError]);

  const selectClass = "w-full bg-surface border border-card-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-accent focus:ring-1 focus:ring-accent transition-colors";

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5 shadow-card space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
        Job Feed Preferences
      </h3>
      <p className="text-xs text-muted">
        These filters auto-apply to your feed. Adjust them anytime.
      </p>

      {/* Current Title */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Current Title</label>
        <input
          type="text"
          value={currentTitle}
          onChange={(e) => setCurrentTitle(e.target.value)}
          placeholder="e.g. Senior Software Engineer"
          className={selectClass}
        />
      </div>

      {/* Role Family */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Role Family</label>
        <select value={roleFamily} onChange={(e) => setRoleFamily(e.target.value)} className={selectClass}>
          {ROLE_FAMILIES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Seniority */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Seniority</label>
        <select value={seniority} onChange={(e) => setSeniority(e.target.value)} className={selectClass}>
          {SENIORITY_LEVELS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Remote Mode */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Work Mode</label>
        <select value={remoteMode} onChange={(e) => setRemoteMode(e.target.value)} className={selectClass}>
          {REMOTE_MODES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Tech Stack */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Tech Stack</label>
        <div className="flex flex-wrap gap-1.5">
          {TECH_STACKS.map((tech) => (
            <button
              key={tech}
              onClick={() => toggleStack(tech)}
              className={`
                text-xs font-medium px-2.5 py-1 rounded-md transition-colors
                ${stack.includes(tech)
                  ? "bg-foreground text-white"
                  : "bg-surface text-muted hover:bg-surface-hover"
                }
              `}
            >
              {tech}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-accent text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save Preferences"}
        </button>
        {saved && <span className="text-xs text-green-600 font-medium">✓ Saved</span>}
      </div>
    </div>
  );
}
