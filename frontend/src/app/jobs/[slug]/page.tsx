import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import Header from "@/components/Header";
import { fetchJobDetail } from "@/lib/api";
import { JOB_EXPIRY_DAYS } from "@/lib/config";
import { OG_IMAGE } from "@/lib/og-image";
import type { JobDetail } from "@/lib/data";
import {
  buildJobPostingJsonLd,
  employmentLabel,
  formatPostedDate,
  isJobPageExpired,
  isKnownCompany,
  jobMetaDescription,
  jobPageTitle,
  jobPath,
  jobSlug,
  jobSummary,
  jobUrl,
  locationLabel,
  parseJobSlug,
  posterLabel,
  serializeJsonLd,
  skillLabels,
  sourceLabel,
} from "@/lib/job-seo";

// Public and identical for everyone: rendered on first visit, then served from
// the cache and refreshed in the background every 5 minutes (ISR). Must match
// JOB_PAGE_REVALIDATE_SECONDS in lib/api.ts; segment config has to be a literal.
export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

async function loadJob(slug: string): Promise<JobDetail> {
  const id = parseJobSlug(slug);
  if (id === null) notFound();
  const job = await fetchJobDetail(id);
  if (!job) notFound();
  return job;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const job = await loadJob(slug);
  const title = jobPageTitle(job);
  const description = jobMetaDescription(job);
  return {
    title,
    description,
    alternates: { canonical: jobPath(job) },
    openGraph: {
      type: "website",
      title: `${title} | SkipTheBoard`,
      description,
      url: jobUrl(job),
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | SkipTheBoard`,
      description,
      images: [OG_IMAGE.url],
    },
    // Google must not list jobs that are no longer open.
    ...(isJobPageExpired(job) ? { robots: { index: false, follow: true } } : {}),
  };
}

function Fact({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-light">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export default async function JobPage({ params }: Props) {
  const { slug } = await params;
  const job = await loadJob(slug);
  const canonical = jobSlug(job);
  if (slug !== canonical) permanentRedirect(`/jobs/${canonical}`);

  const expired = isJobPageExpired(job);
  const jsonLd = buildJobPostingJsonLd(job);
  const skills = skillLabels(job.stack);
  const bullets = job.description.map((d) => d.trim()).filter(Boolean);
  const source = sourceLabel(job.source);

  return (
    <div className="min-h-screen">
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      )}
      <Header maxWidth="max-w-3xl" />

      <article className="max-w-3xl mx-auto px-6 py-8">
        <Link href="/" className="text-xs font-medium text-muted hover:text-foreground transition-colors">
          &larr; All jobs
        </Link>

        {expired && (
          <p className="mt-4 rounded-lg border border-card-border bg-surface px-4 py-3 text-sm text-muted">
            This job has expired. Posts leave SkipTheBoard after {JOB_EXPIRY_DAYS} days, so it may already be filled.{" "}
            <Link href="/" className="font-semibold text-accent hover:text-accent-hover">
              See live jobs
            </Link>
          </p>
        )}

        <header className="mt-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">{job.title}</h1>
          {isKnownCompany(job.company) && <p className="mt-1 text-base text-muted">{job.company}</p>}
        </header>

        <dl className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 rounded-xl bg-card-bg border border-card-border p-5 shadow-card">
          <Fact label="Location" value={locationLabel(job)} />
          <Fact label="Work mode" value={job.remoteLabel} />
          <Fact label="Level" value={job.levelLabel} />
          <Fact label="Employment" value={employmentLabel(job)} />
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-light">Posted</dt>
            <dd className="mt-0.5 text-sm font-medium text-foreground">
              <time dateTime={job.postedAt}>{formatPostedDate(job.postedAt)}</time>
            </dd>
          </div>
        </dl>

        {skills.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Skills">
            {skills.map((skill) => (
              <li key={skill} className="bg-tag-gray-bg text-tag-gray-text text-xs font-medium px-2 py-0.5 rounded-md">
                {skill}
              </li>
            ))}
          </ul>
        )}

        <section className="mt-8">
          <h2 className="text-sm font-bold text-foreground">About the role</h2>
          <p className="mt-2 text-sm text-muted leading-relaxed">{jobSummary(job)}</p>
          {bullets.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm text-muted leading-relaxed">
              {bullets.map((line, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-bold text-foreground">Posted by</h2>
          <p className="mt-2 text-sm text-muted">
            {posterLabel(job)} on {source}
          </p>
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={job.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-accent-hover transition-colors"
          >
            View original post / Apply on {source}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
          <p className="text-xs text-muted-light">
            You apply on {source}, directly with the person hiring. We only link to their post.
          </p>
        </div>
      </article>
    </div>
  );
}
