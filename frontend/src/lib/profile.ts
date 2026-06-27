import { BACKEND_URL } from "./config";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface ExperienceItem {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface EducationItem {
  degree: string;
  institution: string;
  graduationYear: string;
  gpa: string;
}

export interface Skills {
  languages: string[];
  frameworks: string[];
  tools: string[];
  soft: string[];
}

export interface FilterSummary {
  currentTitle: string;
  roleFamily: string;
  seniority: string;
  remoteMode: string;
  stack: string[];
}

export interface ResumeProfile {
  _id?: string;
  contact: ContactInfo;
  experience: ExperienceItem[];
  education: EducationItem[];
  certifications: string[];
  skills: Skills;
  filterSummary: FilterSummary;
  createdAt?: string;
  updatedAt?: string;
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getProfile(token: string): Promise<ResumeProfile | null> {
  const res = await fetch(`${BACKEND_URL}/api/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Profile API returned ${res.status}`);
  }

  const data = await res.json() as { profile: ResumeProfile | null };
  return data.profile;
}

export async function uploadResume(token: string, file: File): Promise<ResumeProfile> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BACKEND_URL}/api/profile/resume`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error ?? `Upload failed (${res.status})`);
  }

  const data = await res.json() as { profile: ResumeProfile };
  return data.profile;
}

export async function updateProfile(
  token: string,
  filterSummary: Partial<FilterSummary>,
): Promise<ResumeProfile> {
  const res = await fetch(`${BACKEND_URL}/api/profile`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(filterSummary),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Update failed" }));
    throw new Error(err.error ?? `Update failed (${res.status})`);
  }

  const data = await res.json() as { profile: ResumeProfile };
  return data.profile;
}
