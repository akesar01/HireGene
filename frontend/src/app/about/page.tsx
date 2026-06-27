import type { Metadata } from "next";
import Link from "next/link";
import { JOB_EXPIRY_DAYS } from "@/lib/config";

export const metadata: Metadata = {
  title: "About",
  description:
    "SkipTheBoard is a community-driven job discovery platform that captures real hiring posts from hiring managers on LinkedIn and X. No job boards. Just real jobs from the people actually hiring.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About SkipTheBoard",
    description:
      "We watch real hiring managers across LinkedIn and X. Every post they make gets captured here before it vanishes.",
    url: "https://skiptheboard.in/about",
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border bg-card-bg sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="SkipTheBoard" width={24} height={24} className="shrink-0" />
            <span className="text-lg font-bold text-foreground tracking-tight">
              SkipTheBoard
            </span>
          </Link>
          <Link href="/" className="text-xs text-muted hover:text-foreground transition-colors">
            &larr; back to feed
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">About SkipTheBoard</h1>
        <p className="mt-4 text-base text-muted leading-relaxed">
          The best tech jobs aren&apos;t on job boards. They&apos;re hiding in LinkedIn posts
          written by founders, VPs, and team leads who are actually hiring. Most of those posts
          vanish within a day. SkipTheBoard captures them before they disappear.
        </p>

        <h2 className="mt-10 text-xl font-bold text-foreground">How it works</h2>
        <ol className="mt-4 space-y-4 text-sm text-muted leading-relaxed">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-accent-light text-accent flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
            <span>
              <strong className="text-foreground">We watch.</strong> Our system monitors hiring
              posts from real decision-makers &mdash; founders, heads, leads, the person you&apos;d DM &mdash;
              across LinkedIn and X.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-accent-light text-accent flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
            <span>
              <strong className="text-foreground">We display.</strong> Every captured post
              appears in the feed with the original author, their role, the company, job details,
              and a direct link to the original post. We don&apos;t rewrite or editorialize.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-accent-light text-accent flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
            <span>
              <strong className="text-foreground">You vote.</strong> The community upvotes
              quality posts (real hiring managers, clear roles) and downvotes spam (recruiters,
              vague listings). Your votes decide what stays at the top.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-accent-light text-accent flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">4</span>
            <span>
              <strong className="text-foreground">Posts expire.</strong> Jobs auto-expire after{" "}
              {JOB_EXPIRY_DAYS} days. Fresh stuff only. No stale listings from months ago.
            </span>
          </li>
        </ol>

        <h2 className="mt-10 text-xl font-bold text-foreground">Our principles</h2>
        <ul className="mt-4 space-y-3 text-sm text-muted leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
            <span>
              <strong className="text-foreground">Signal over noise.</strong> Only posts from
              actual hiring managers &mdash; founders, heads, leads. No recruiter spam.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
            <span>
              <strong className="text-foreground">Community-ranked.</strong> Your votes decide
              what stays at the top. No paid placements, no sponsored positions.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
            <span>
              <strong className="text-foreground">Transparent sourcing.</strong> Every post
              links back to the original LinkedIn or X post. We don&apos;t rewrite or editorialize.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
            <span>
              <strong className="text-foreground">Fresh only.</strong> {JOB_EXPIRY_DAYS}-day
              auto-expiry keeps the feed relevant. Old jobs are removed automatically.
            </span>
          </li>
        </ul>

        <h2 className="mt-10 text-xl font-bold text-foreground">Who&apos;s behind this?</h2>
        <p className="mt-4 text-sm text-muted leading-relaxed">
          SkipTheBoard is an independent project built by a small team passionate about fixing
          tech hiring. We believe the best jobs come from the people you&apos;d actually work
          with &mdash; not from job boards flooded with recruiter spam. We keep our identities private
          to keep the focus on the jobs, not the platform.
        </p>
        <p className="mt-3 text-sm text-muted leading-relaxed">
          Have a question or suggestion?{" "}
          <Link href="/submit" className="text-accent hover:underline font-medium">
            Submit a hiring manager
          </Link>{" "}
          or reach out &mdash; we read everything.
        </p>

        <div className="mt-10 rounded-xl bg-card-bg border border-card-border p-5 shadow-card">
          <p className="text-sm font-semibold text-foreground">Ready to find your next job?</p>
          <p className="mt-1 text-xs text-muted">
            Browse real hiring posts from actual hiring managers.
          </p>
          <Link
            href="/"
            className="mt-3 inline-flex items-center gap-1.5 bg-accent text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors"
          >
            Browse jobs &rarr;
          </Link>
        </div>
      </article>
    </div>
  );
}
