"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BACKEND_URL } from "@/lib/config";

const ADMIN_SECRET_KEY = "skiptheboard_admin_secret";

interface Submission {
  id: number;
  name: string;
  linkedinUrl: string;
  company: string | null;
  title: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  recruiterId: number | null;
  submittedAt: string;
  reviewedAt: string | null;
}

interface Recruiter {
  id: number;
  name: string;
  linkedinUrl: string;
  active: boolean;
  scrapeIntervalHours: number;
  addedAt: string;
  lastScrapedAt: string | null;
}

type Tab = "submissions" | "recruiters";

export default function AdminDashboard() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("submissions");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Check for stored secret on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_SECRET_KEY);
    if (stored) {
      setSecret(stored);
      setAuthed(true);
    }
  }, []);

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    }),
    [secret],
  );

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/submissions?status=pending`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch submissions");
      const data = await res.json();
      setSubmissions(data.submissions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const fetchRecruiters = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/recruiters`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch recruiters");
      const data = await res.json();
      setRecruiters(data.recruiters);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!authed) return;
    if (tab === "submissions") fetchSubmissions();
    else fetchRecruiters();
  }, [authed, tab, fetchSubmissions, fetchRecruiters]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!secret.trim()) return;
    sessionStorage.setItem(ADMIN_SECRET_KEY, secret);
    setAuthed(true);
  }

  function handleLogout() {
    sessionStorage.removeItem(ADMIN_SECRET_KEY);
    setSecret("");
    setAuthed(false);
    setSubmissions([]);
    setRecruiters([]);
  }

  async function approveSubmission(id: number) {
    setActionId(id);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/submissions/${id}/approve`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to approve");
      }
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setActionId(null);
    }
  }

  async function rejectSubmission(id: number) {
    setActionId(id);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/submissions/${id}/reject`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to reject");
      }
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setActionId(null);
    }
  }

  async function triggerScrape(recruiterId: number) {
    setActionId(recruiterId);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/scrape`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ recruiterId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scrape failed");
      // Refresh recruiter list to show updated lastScrapedAt
      fetchRecruiters();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setActionId(null);
    }
  }

  // ─── Login screen ───────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <Link href="/" className="inline-block mb-6 flex items-center gap-2">
            <img src="/logo.svg" alt="SkipTheBoard" width={24} height={24} className="shrink-0" />
            <span className="text-lg font-bold text-foreground tracking-tight">SkipTheBoard</span>
          </Link>
          <h1 className="text-xl font-bold text-foreground">Admin</h1>
          <p className="mt-1 text-xs text-muted">Enter your admin secret to continue.</p>
          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Admin secret"
              autoFocus
              className="w-full rounded-lg border border-card-border bg-card-bg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-card-border bg-card-bg sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.svg" alt="SkipTheBoard" width={24} height={24} className="shrink-0" />
              <span className="text-lg font-bold text-foreground tracking-tight">
                SkipTheBoard
              </span>
            </Link>
            <span className="text-xs text-muted-light">/ admin</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-medium text-muted hover:text-foreground transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-card-border">
          <button
            type="button"
            onClick={() => setTab("submissions")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === "submissions"
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            Submissions {submissions.length > 0 && `(${submissions.length})`}
          </button>
          <button
            type="button"
            onClick={() => setTab("recruiters")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === "recruiters"
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            Recruiters {recruiters.length > 0 && `(${recruiters.length})`}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-sm text-muted">Loading...</div>
        ) : tab === "submissions" ? (
          /* ─── Submissions tab ─── */
          submissions.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted">
              No pending submissions.
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((s) => (
                <div
                  key={s.id}
                  className="bg-card-bg border border-card-border rounded-xl p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground">{s.name}</h3>
                        {s.company && (
                          <span className="text-xs text-muted">@ {s.company}</span>
                        )}
                      </div>
                      {s.title && (
                        <p className="text-xs text-muted mt-0.5">{s.title}</p>
                      )}
                      <a
                        href={s.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-block text-xs text-accent hover:underline"
                      >
                        {s.linkedinUrl}
                      </a>
                      {s.note && (
                        <p className="mt-2 text-xs text-muted bg-surface rounded-lg px-3 py-2">
                          {s.note}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted-light">
                        Submitted {new Date(s.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => approveSubmission(s.id)}
                        disabled={actionId === s.id}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {actionId === s.id ? "..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectSubmission(s.id)}
                        disabled={actionId === s.id}
                        className="rounded-lg border border-card-border px-3 py-1.5 text-xs font-semibold text-muted hover:bg-surface transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* ─── Recruiters tab ─── */
          recruiters.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted">
              No recruiters being tracked yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-left text-xs text-muted">
                    <th className="pb-2 pr-4 font-semibold">Name</th>
                    <th className="pb-2 pr-4 font-semibold">Status</th>
                    <th className="pb-2 pr-4 font-semibold">Last Scraped</th>
                    <th className="pb-2 pr-4 font-semibold">Added</th>
                    <th className="pb-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recruiters.map((r) => (
                    <tr key={r.id} className="border-b border-border-light">
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-foreground">{r.name}</p>
                        <a
                          href={r.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-accent hover:underline"
                        >
                          LinkedIn profile
                        </a>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
                            r.active
                              ? "bg-green-50 text-green-700"
                              : "bg-surface text-muted"
                          }`}
                        >
                          {r.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted">
                        {r.lastScrapedAt
                          ? new Date(r.lastScrapedAt).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted">
                        {new Date(r.addedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => triggerScrape(r.id)}
                          disabled={actionId === r.id}
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
                        >
                          {actionId === r.id ? "Scraping..." : "Scrape now"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
