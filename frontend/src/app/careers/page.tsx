import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Join SkipTheBoard. We're hiring a marketing intern to help us grow the community and reach more job seekers.",
  alternates: { canonical: "/careers" },
  openGraph: {
    title: "Careers | SkipTheBoard",
    description:
      "We're hiring a marketing intern. Join SkipTheBoard and help us fix tech hiring.",
    url: "https://skiptheboard.in/careers",
  },
};

export default function CareersPage() {
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
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Careers</h1>
        <p className="mt-4 text-base text-muted leading-relaxed">
          We&apos;re a small team building a new way to discover tech jobs &mdash; straight from
          the people actually hiring. No job boards, no recruiter spam, just real posts from real
          hiring managers. We&apos;re looking for people who want to help us grow.
        </p>

        {/* Open role */}
        <div className="mt-10 rounded-xl bg-card-bg border border-card-border p-6 shadow-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-foreground">Marketing Intern</h2>
              <p className="mt-1 text-xs text-muted">
                Remote &middot; Part-time &middot; 3 months &middot; Paid (stipend based on experience)
              </p>
            </div>
            <span className="inline-block rounded-md bg-accent-light px-2.5 py-1 text-xs font-semibold text-accent">
              Open
            </span>
          </div>

          <p className="mt-4 text-sm text-muted leading-relaxed">
            We&apos;re looking for a marketing intern to help us grow SkipTheBoard&apos;s
            reach and build a community of job seekers and hiring managers. This is a great
            opportunity for someone who wants hands-on experience at an early-stage product.
          </p>

          <h3 className="mt-6 text-sm font-bold text-foreground">What you&apos;ll do</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
              <span>Manage social media presence (X/Twitter, LinkedIn) &mdash; post job highlights, engage with the community</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
              <span>Write and schedule content &mdash; weekly job digests, hiring trends, tips for job seekers</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
              <span>Reach out to tech communities (Reddit, Discord, Slack groups) to spread the word</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
              <span>Help launch on Product Hunt, Hacker News, and other platforms</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
              <span>Analyze GA4 data to understand what content drives traffic and engagement</span>
            </li>
          </ul>

          <h3 className="mt-6 text-sm font-bold text-foreground">What we&apos;re looking for</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
              <span>Strong written communication skills &mdash; you can write engaging social posts</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
              <span>Interest in tech, startups, and the job market</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
              <span>Self-starter &mdash; you can work independently and come up with your own ideas</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
              <span>Familiarity with X/Twitter and LinkedIn &mdash; you know how to build an audience</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
              <span>Available 10-15 hours per week for 3 months</span>
            </li>
          </ul>

          <h3 className="mt-6 text-sm font-bold text-foreground">What you&apos;ll get</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
              <span>Hands-on marketing experience at a live product with real users</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
              <span>Stipend based on experience and performance</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
              <span>Full ownership of social media &mdash; build a portfolio you can show future employers</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
              <span>Letter of recommendation + potential for a full-time role based on performance</span>
            </li>
          </ul>

          <h3 className="mt-6 text-sm font-bold text-foreground">How to apply</h3>
          <p className="mt-3 text-sm text-muted leading-relaxed">
            Send an email with:
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
              <span>A brief intro about yourself and why you&apos;re interested</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
              <span>Links to any social media accounts you manage (personal or professional)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
              <span>A sample tweet/post promoting SkipTheBoard</span>
            </li>
          </ul>
          <a
            href="mailto:kesarmania01@gmail.com?subject=Marketing Intern Application"
            className="mt-5 inline-flex items-center gap-1.5 bg-accent text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors"
          >
            Apply via email &rarr;
          </a>
          <p className="mt-2 text-xs text-muted-light">
            Email: kesarmania01@gmail.com
          </p>
        </div>

        {/* No other roles */}
        <div className="mt-6 text-center text-sm text-muted">
          No other open roles right now. Check back later or{" "}
          <Link href="/submit" className="text-accent hover:underline font-medium">
            submit a hiring manager
          </Link>{" "}
          to the feed.
        </div>
      </article>
    </div>
  );
}
