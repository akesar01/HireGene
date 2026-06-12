import type { Job } from "@/lib/data";
import { timeAgo } from "@/lib/data";
import VoteButton from "./VoteButton";

interface JobCardProps {
  job: Job;
  rank: number;
}

export default function JobCard({ job, rank }: JobCardProps) {
  return (
    <article className="bg-card-bg border border-card-border rounded-lg p-5 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 ease-out">
      {/* Author header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-sm font-bold text-muted shrink-0">
            {job.author.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{job.author}</p>
            <p className="text-xs text-muted leading-snug line-clamp-1">
              {job.authorTitle}
            </p>
            <time
              dateTime={job.postedAt}
              className="text-xs text-muted-light"
            >
              {timeAgo(job.postedAt)}
            </time>
          </div>
        </div>
        {/* External link icon */}
        <a
          href={job.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-light hover:text-foreground transition-colors"
          aria-label={`View original ${job.source} post`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Role badge */}
      <div className="mt-3">
        <span className="inline-block bg-foreground text-white text-xs font-semibold px-2.5 py-1 rounded">
          {job.roleBadge}
        </span>
      </div>

      {/* Job title */}
      <h3 className="mt-3 text-base font-bold text-foreground leading-snug">
        {job.title}
      </h3>

      {/* Description bullets */}
      {job.description.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-foreground/80">
          {job.description.map((line, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-muted mt-0.5 shrink-0">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Tag chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="inline-block bg-tag-green-bg text-tag-green-text text-xs font-medium px-2 py-0.5 rounded">
          {job.roleFamily}
        </span>
        <span className="inline-block bg-tag-green-bg text-tag-green-text text-xs font-medium px-2 py-0.5 rounded">
          {job.seniority}
        </span>
        <span className="inline-block bg-tag-green-bg text-tag-green-text text-xs font-medium px-2 py-0.5 rounded">
          {job.remoteMode}
        </span>
        {job.stack.map((tech) => (
          <span
            key={tech}
            className="inline-block bg-tag-gray-bg text-tag-gray-text text-xs font-medium px-2 py-0.5 rounded"
          >
            {tech}
          </span>
        ))}
      </div>

      {/* Action bar */}
      <div className="mt-4 pt-3 border-t border-border-light flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Vote */}
          <VoteButton initialScore={job.score} jobId={job.id} />
          {/* Comments */}
          <span className="flex items-center gap-1 text-xs text-muted">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {job.comments}
          </span>
          {/* Share */}
          <button
            type="button"
            className="text-muted hover:text-foreground transition-colors"
            aria-label="Share post"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
        </div>

        {/* See post button */}
        <a
          href={job.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 bg-accent text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-accent-hover transition-colors"
        >
          see post
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </article>
  );
}
