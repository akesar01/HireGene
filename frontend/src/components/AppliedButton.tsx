"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { BACKEND_URL } from "@/lib/config";

interface AppliedButtonProps {
  jobId: number;
  initialApplied?: boolean;
}

export default function AppliedButton({ jobId, initialApplied = false }: AppliedButtonProps) {
  const { isSignedIn, getToken } = useAuth();
  const [applied, setApplied] = useState(initialApplied);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setApplied(initialApplied);
  }, [initialApplied]);

  if (!isSignedIn) return null;

  async function handleToggle() {
    if (loading) return;
    setLoading(true);

    const prevApplied = applied;
    setApplied(!prevApplied);

    try {
      const token = await getToken();
      if (!token) throw new Error("No token");

      const res = await fetch(`${BACKEND_URL}/api/posts/${jobId}/apply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApplied(data.applied);
    } catch {
      setApplied(prevApplied);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className={[
        "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors",
        applied
          ? "bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20"
          : "bg-surface border-card-border text-muted hover:border-green-500/30 hover:text-green-600",
      ].join(" ")}
      aria-label={applied ? "Mark as not applied" : "Mark as applied"}
      aria-pressed={applied}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {applied ? "Applied" : "Mark Applied"}
    </button>
  );
}
