"use client";

import { useState } from "react";

interface UpvoteButtonProps {
  jobId: number;
  initialScore: number;
}

export default function UpvoteButton({ jobId, initialScore }: UpvoteButtonProps) {
  const [score, setScore] = useState(initialScore);
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleVote() {
    if (loading) return;
    setLoading(true);

    // Optimistic update
    const newVoted = !voted;
    setScore(newVoted ? score + 1 : score - 1);
    setVoted(newVoted);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8787"}/api/posts/${jobId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: "up" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Reconcile with server
      setScore(data.score);
      setVoted(data.voted);
    } catch {
      // Rollback on error
      setScore(newVoted ? score - 1 : score + 1);
      setVoted(!newVoted);
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
