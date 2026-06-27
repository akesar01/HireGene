"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import JobCard from "./JobCard";
import type { Job } from "@/lib/data";
import type { ResumeProfile } from "@/lib/profile";
import { BACKEND_URL } from "@/lib/config";

interface PersonalizedFeedProps {
  jobs: Job[];
  profile: ResumeProfile;
  initialScores: Record<string, number>;
}

interface RefinedMatch {
  jobId: string;
  score: number;
  reason: string;
}

export default function PersonalizedFeed({ jobs, profile, initialScores }: PersonalizedFeedProps) {
  const { getToken } = useAuth();
  const [refinedScores, setRefinedScores] = useState<Map<string, RefinedMatch>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const refineTopJobs = async () => {
      // Take top 5 jobs by initial tag-overlap score
      const sorted = [...jobs].sort(
        (a, b) => (initialScores[String(b.id)] ?? 0) - (initialScores[String(a.id)] ?? 0)
      );
      const top5 = sorted.slice(0, 5);

      if (top5.length === 0) {
        setIsLoading(false);
        return;
      }

      try {
        const token = await getToken();
        if (!token) {
          setIsLoading(false);
          return;
        }

        const res = await fetch(`${BACKEND_URL}/api/profile/match`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jobs: top5.map((j) => ({
              id: String(j.id),
              title: j.title,
              description: j.description,
              stack: j.stack,
              roleFamily: j.roleFamily,
              seniority: j.seniority,
              remoteMode: j.remoteMode,
            })),
          }),
        });

        if (res.ok) {
          const data = await res.json() as { matches: RefinedMatch[] };
          const map = new Map<string, RefinedMatch>();
          for (const m of data.matches) {
            map.set(m.jobId, m);
          }
          setRefinedScores(map);
        }
      } catch {
        // Graceful fallback — keep tag-overlap scores
      } finally {
        setIsLoading(false);
      }
    };

    refineTopJobs();
  }, [jobs, initialScores, getToken]);

  // Build final scores: refined scores override initial scores
  const getScore = useCallback((jobId: string): number | undefined => {
    const refined = refinedScores.get(jobId);
    if (refined) return refined.score;
    if (initialScores[jobId] !== undefined) return initialScores[jobId];
    return undefined;
  }, [refinedScores, initialScores]);

  const getReason = useCallback((jobId: string): string | undefined => {
    return refinedScores.get(jobId)?.reason;
  }, [refinedScores]);

  // Re-sort by refined score when not loading
  const sortedJobs = isLoading
    ? jobs
    : [...jobs].sort((a, b) => (getScore(String(b.id)) ?? 0) - (getScore(String(a.id)) ?? 0));

  return (
    <div className="space-y-4">
      {sortedJobs.map((job, i) => {
        const score = getScore(String(job.id));
        const reason = getReason(String(job.id));
        return (
          <JobCard
            key={job.id}
            job={job}
            rank={i + 1}
            matchScore={score}
            matchReason={reason}
          />
        );
      })}
    </div>
  );
}
