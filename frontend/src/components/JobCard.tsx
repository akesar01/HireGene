import type { Job } from "@/lib/data";
import { timeAgo } from "@/lib/data";
import UpvoteButton from "./UpvoteButton";
import MatchBadge from "./MatchBadge";

interface JobCardProps {
  job: Job;
  rank: number;
  matchScore?: number;
  matchReason?: string;
}

export default function JobCard({ job, rank, matchScore, matchReason }: JobCardProps) {
  return (
    <article className="bg-card-bg border border-card-border rounded-xl p-4 shadow-card hover:shadow-card-hover hover:border-muted-light/40 transition-all duration-200 ease-out">
      <div className="flex gap-4">
        {/* Upvote button */}
        <UpvoteButton jobId={job.id} initialScore={job.score} />

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Author header */}
          <div className="flex items-center gap-2.5">
            {job.authorAvatar ? (
              <img
                src={job.authorAvatar}
                alt={job.author}
                className="w-7 h-7 rounded-full object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-surface flex items-center justify-center text-xs font-bold text-muted shrink-0">
                {job.author.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{job.author}</p>
              <p className="text-xs text-muted truncate">{job.authorTitle}</p>
            </div>
            <time
              dateTime={job.postedAt}
              className="text-xs text-muted-light shrink-0"
            >
              {timeAgo(job.postedAt)}
            </time>
          </div>

          {/* Job title + match badge */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-foreground leading-snug">
              {job.title}
            </h3>
            {matchScore !== undefined && (
              <MatchBadge score={matchScore} reason={matchReason} />
            )}
          </div>

          {/* Description bullets */}
          {job.description.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-muted leading-relaxed">
              {job.description.slice(0, 3).map((line, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-muted-light mt-0.5 shrink-0">•</span>
                  <span className="line-clamp-2">{line}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Tag chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="inline-block bg-tag-green-bg text-tag-green-text text-xs font-medium px-2 py-0.5 rounded-md">
              {job.roleFamily}
            </span>
            <span className="inline-block bg-tag-green-bg text-tag-green-text text-xs font-medium px-2 py-0.5 rounded-md">
              {job.seniority}
            </span>
            <span className="inline-block bg-tag-green-bg text-tag-green-text text-xs font-medium px-2 py-0.5 rounded-md">
              {job.remoteMode}
            </span>
            {job.stack.map((tech) => (
              <span
                key={tech}
                className="inline-block bg-tag-gray-bg text-tag-gray-text text-xs font-medium px-2 py-0.5 rounded-md"
              >
                {tech}
              </span>
            ))}
          </div>

          {/* See post link */}
          <a
            href={job.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
          >
            view original post
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </div>
    </article>
  );
}
