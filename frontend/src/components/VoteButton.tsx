"use client";

import { useCallback, useState } from "react";

type VoteDirection = "up" | "down";

interface VoteButtonProps {
  initialScore: number;
  jobId: number;
}

export default function VoteButton({ initialScore, jobId }: VoteButtonProps) {
  const [score, setScore] = useState(initialScore);
  const [activeVote, setActiveVote] = useState<VoteDirection | null>(null);

  const handleVote = useCallback(
    (direction: VoteDirection) => {
      if (activeVote === direction) {
        setScore(initialScore);
        setActiveVote(null);
      } else {
        setScore(initialScore + (direction === "up" ? 1 : -1));
        setActiveVote(direction);
      }
    },
    [activeVote, initialScore]
  );

  return (
    <div
      className="inline-flex items-center gap-1.5 select-none"
      role="group"
      aria-label={`Vote on job ${jobId}`}
    >
      <button
        type="button"
        onClick={() => handleVote("up")}
        aria-label="Upvote"
        aria-pressed={activeVote === "up"}
        className={[
          "text-sm leading-none transition-colors cursor-pointer",
          activeVote === "up" ? "text-accent" : "text-foreground hover:text-accent",
        ].join(" ")}
      >
        ▲
      </button>
      <span
        aria-live="polite"
        className="text-sm font-bold tabular-nums text-foreground"
      >
        {score}
      </span>
      <button
        type="button"
        onClick={() => handleVote("down")}
        aria-label="Downvote"
        aria-pressed={activeVote === "down"}
        className={[
          "text-sm leading-none transition-colors cursor-pointer",
          activeVote === "down" ? "text-accent" : "text-foreground hover:text-accent",
        ].join(" ")}
      >
        ▼
      </button>
    </div>
  );
}
