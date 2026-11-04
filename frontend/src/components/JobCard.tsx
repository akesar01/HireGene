import Link from "next/link";
import type { Job } from "@/lib/data";
import { jobPath } from "@/lib/job-seo";
import { timeAgo } from "@/lib/data";
import UpvoteButton from "./UpvoteButton";
import MatchBadge from "./MatchBadge";
import AppliedButton from "./AppliedButton";
import MessageButton from "./MessageButton";
import ConnectNoteButton from "./ConnectNoteButton";
import AuthorAvatar from "./AuthorAvatar";

interface JobCardProps {
  job: Job;
  matchScore?: number;
  matchReason?: string;
}

// The whole card opens the job page: the title link's ::after stretches over the
// card, so it is one real link (keyboard, middle-click, tap). Controls sit above
// it: the upvote column, earlier in the DOM, needs a z-index; the badge and the
// actions row, later in the DOM, only need to be positioned. No z-index wraps the
// actions, so the DM and connection-note modals keep their own fixed z-50; the
// row lets clicks in the gaps between its controls fall through to the card.
export default function JobCard({ job, matchScore, matchReason }: JobCardProps) {
  return (
    <article className="relative bg-card-bg border border-card-border rounded-xl p-4 shadow-card hover:shadow-card-hover hover:border-muted-light/40 transition-all duration-200 ease-out">
      <div className="flex gap-4">
        {/* Upvote button */}
        <div className="relative z-[1]">
          <UpvoteButton jobId={job.id} initialScore={job.score} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Author header */}
          <div className="flex items-center gap-2.5">
            <AuthorAvatar src={job.authorAvatar} name={job.author} />
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
              <Link
                href={jobPath(job)}
                prefetch={false}
                className="hover:text-accent transition-colors focus-visible:outline-none! after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-accent"
              >
                {job.title}
              </Link>
            </h3>
            {matchScore !== undefined && (
              <span className="relative">
                <MatchBadge score={matchScore} reason={matchReason} />
              </span>
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

          {/* Actions */}
          <div className="relative mt-3 flex items-center gap-3 flex-wrap pointer-events-none *:pointer-events-auto">
            <MessageButton job={job} />
            {job.source === "linkedin" && <ConnectNoteButton job={job} />}
            <AppliedButton jobId={job.id} />
            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
            >
              view original post
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
