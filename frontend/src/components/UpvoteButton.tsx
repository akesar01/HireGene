"use client";

import { useState, useEffect } from "react";
import { BACKEND_URL } from "@/lib/config";

interface UpvoteButtonProps {
  jobId: number;
  initialScore: number;
}

function getStoredVote(jobId: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(`vote_${jobId}`) === "up";
  } catch {
    return false;
  }
}

function setStoredVote(jobId: number, voted: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (voted) {
      localStorage.setItem(`vote_${jobId}`, "up");
    } else {
      localStorage.removeItem(`vote_${jobId}`);
    }
  } catch {
    // ignore
  }
}

export default function UpvoteButton({ jobId, initialScore }: UpvoteButtonProps) {
  const [score, setScore] = useState(initialScore);
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync voted state from localStorage on mount
  useEffect(() => {
    setVoted(getStoredVote(jobId));
  }, [jobId]);

  async function handleVote() {
    if (loading) return;
    setLoading(true);

    const prevScore = score;
    const prevVoted = voted;

    // Optimistic update
    const newVoted = !prevVoted;
    setScore(newVoted ? prevScore + 1 : prevScore - 1);
    setVoted(newVoted);

    try {
      const res = await fetch(`${BACKEND_URL}/api/posts/${jobId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: "up" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setScore(data.score);
      setVoted(data.voted);
      setStoredVote(jobId, data.voted);
    } catch {
      setScore(prevScore);
      setVoted(prevVoted);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center shrink-0">
      <button
        type="button"
        onClick={handleVote}
        disabled={loading}
        className={[
          "w-10 h-10 rounded-lg border flex items-center justify-center transition-colors",
          voted
            ? "bg-accent border-accent text-white"
            : "bg-surface border-card-border text-muted hover:bg-accent-light hover:border-accent hover:text-accent",
        ].join(" ")}
        aria-label="Upvote"
        aria-pressed={voted}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>
      <span className="mt-1 text-xs font-bold text-foreground tabular-nums">{score}</span>
    </div>
  );
}
