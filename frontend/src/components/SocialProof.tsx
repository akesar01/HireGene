"use client";

import { useEffect, useState } from "react";

interface SocialProofProps {
  totalJobs: number;
  totalCompanies: number;
  totalManagers: number;
}

export default function SocialProof({
  totalJobs,
  totalCompanies,
  totalManagers,
}: SocialProofProps) {
  const [visitors, setVisitors] = useState<number | null>(null);

  useEffect(() => {
    const base = 120 + Math.floor(Math.random() * 80);
    setVisitors(base);

    const interval = setInterval(() => {
      setVisitors((prev) => {
        if (prev === null) return base;
        const delta = Math.floor(Math.random() * 7) - 3;
        const next = Math.max(40, Math.min(380, prev + delta));
        return next;
      });
    }, 4000 + Math.random() * 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
      {/* Live visitors */}
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        {visitors !== null ? (
          <>{visitors} browsing now</>
        ) : (
          <span className="inline-block w-16 h-3 rounded bg-surface animate-pulse" />
        )}
      </span>

      <span className="text-muted-light">·</span>

      <span className="inline-flex items-center gap-1">
        <span className="font-semibold text-foreground">{totalJobs}</span>
        live jobs
      </span>

      <span className="text-muted-light">·</span>

      <span className="inline-flex items-center gap-1">
        <span className="font-semibold text-foreground">{totalCompanies}</span>
        companies hiring
      </span>

      <span className="text-muted-light">·</span>

      <span className="inline-flex items-center gap-1">
        <span className="font-semibold text-foreground">{totalManagers}</span>
        hiring managers tracked
      </span>
    </div>
  );
}
