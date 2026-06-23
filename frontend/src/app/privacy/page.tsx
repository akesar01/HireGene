import type { Metadata } from "next";
import Link from "next/link";
import { JOB_EXPIRY_DAYS } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "SkipTheBoard privacy policy. We collect minimal data — votes by IP address and recruiter submissions. No accounts, no passwords, no payment information.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | SkipTheBoard",
    description:
      "We collect minimal data. No accounts, no passwords, no payments. Here's exactly what we track and why.",
    url: "https://skiptheboard.in/privacy",
  },
};

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-xs text-muted-light">Last updated: June 2025</p>

        <p className="mt-6 text-sm text-muted leading-relaxed">
          SkipTheBoard is designed to collect as little data as possible. We don&apos;t have user
          accounts, we don&apos;t ask for your name or email, and we don&apos;t process payments.
          Here&apos;s exactly what we collect and why.
        </p>

        {/* What we collect */}
        <h2 className="mt-10 text-xl font-bold text-foreground">What we collect</h2>

        <h3 className="mt-6 text-sm font-bold text-foreground">Votes (upvotes &amp; downvotes)</h3>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          When you upvote or downvote a job post, we record your IP address to prevent duplicate
          voting. We store: the job ID, your IP address, and the vote direction (up or down).
          We do <strong className="text-foreground">not</strong> link votes to any identity.
        </p>

        <h3 className="mt-6 text-sm font-bold text-foreground">Recruiter submissions</h3>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          When you submit a hiring manager for review, we store: the hiring manager&apos;s name,
          their LinkedIn URL, their company and role (if provided), your note (if provided), and
          your IP address (to prevent spam). We do <strong className="text-foreground">not</strong>{" "}
          collect your name, email, or any personal information.
        </p>

        <h3 className="mt-6 text-sm font-bold text-foreground">Analytics</h3>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          We use Google Analytics 4 to understand aggregate traffic patterns &mdash; page views,
          traffic sources, and general location (country/city level). GA4 uses cookieless
          measurement by default. We do not track individual users across sessions.
        </p>

        {/* What we don't collect */}
        <h2 className="mt-10 text-xl font-bold text-foreground">What we DON&apos;T collect</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-accent shrink-0 mt-0.5">&#10005;</span>
            <span><strong className="text-foreground">No accounts.</strong> We don&apos;t have user registration, login, or profiles.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent shrink-0 mt-0.5">&#10005;</span>
            <span><strong className="text-foreground">No email addresses.</strong> We don&apos;t ask for your email on the submit form.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent shrink-0 mt-0.5">&#10005;</span>
            <span><strong className="text-foreground">No payment information.</strong> The site is completely free. We don&apos;t process payments.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent shrink-0 mt-0.5">&#10005;</span>
            <span><strong className="text-foreground">No tracking cookies.</strong> GA4 uses cookieless measurement. No cross-site tracking.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent shrink-0 mt-0.5">&#10005;</span>
            <span><strong className="text-foreground">No personal information.</strong> We don&apos;t sell or share data with third parties.</span>
          </li>
        </ul>

        {/* How data is used */}
        <h2 className="mt-10 text-xl font-bold text-foreground">How your data is used</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-accent shrink-0 mt-0.5">&#10003;</span>
            <span><strong className="text-foreground">Votes</strong> are used to rank job posts in the community feed.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent shrink-0 mt-0.5">&#10003;</span>
            <span><strong className="text-foreground">Submissions</strong> are reviewed by our team. Approved submissions become tracked recruiters whose public posts are captured.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent shrink-0 mt-0.5">&#10003;</span>
            <span><strong className="text-foreground">Analytics</strong> help us understand which job categories are most popular and where our visitors come from.</span>
          </li>
        </ul>

        {/* Data retention */}
        <h2 className="mt-10 text-xl font-bold text-foreground">Data retention</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
            <span><strong className="text-foreground">Job posts</strong> auto-expire after {JOB_EXPIRY_DAYS} days and are removed from the feed.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
            <span><strong className="text-foreground">Votes</strong> are retained as long as the associated job post exists. When a job is deleted, its votes are deleted too.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
            <span><strong className="text-foreground">Submissions</strong> are retained after review (approved or rejected) for record-keeping.</span>
          </li>
        </ul>

        {/* Third-party services */}
        <h2 className="mt-10 text-xl font-bold text-foreground">Third-party services</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
            <span><strong className="text-foreground">Google Analytics 4</strong> &mdash; Privacy-friendly, cookieless traffic analytics. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Google&apos;s Privacy Policy</a>.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
            <span><strong className="text-foreground">Apify</strong> &mdash; Used to scrape public LinkedIn and X posts. We only collect publicly available hiring posts.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
            <span><strong className="text-foreground">Vercel</strong> &mdash; Hosting provider. Standard server logs are retained by Vercel per their policies.</span>
          </li>
        </ul>

        {/* Newsletter */}
        <h2 className="mt-10 text-xl font-bold text-foreground">Newsletter</h2>
        <p className="mt-4 text-sm text-muted leading-relaxed">
          If we offer a newsletter in the future, email collection will be handled by a third-party
          provider (e.g. Substack) under their own privacy policy. Your email will never be stored
          on our servers.
        </p>

        {/* Your rights */}
        <h2 className="mt-10 text-xl font-bold text-foreground">Your rights</h2>
        <p className="mt-4 text-sm text-muted leading-relaxed">
          Since we don&apos;t collect personal information tied to your identity, most data
          protection rights (GDPR, CCPA) are limited. If you believe we have data about you and
          would like it removed, contact us and we will review your request.
        </p>

        {/* Changes */}
        <h2 className="mt-10 text-xl font-bold text-foreground">Changes to this policy</h2>
        <p className="mt-4 text-sm text-muted leading-relaxed">
          We may update this privacy policy as the service evolves. The &quot;Last updated&quot; date
          at the top of this page reflects the most recent revision.
        </p>

        <div className="mt-10 rounded-xl bg-card-bg border border-card-border p-5 shadow-card">
          <p className="text-sm font-semibold text-foreground">Questions about privacy?</p>
          <p className="mt-1 text-xs text-muted">
            We&apos;re happy to clarify. Reach out and we&apos;ll respond.
          </p>
          <Link
            href="/"
            className="mt-3 inline-flex items-center gap-1.5 bg-accent text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors"
          >
            Back to feed &rarr;
          </Link>
        </div>
      </article>
    </div>
  );
}
