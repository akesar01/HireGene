import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "SkipTheBoard terms of service. The platform is free, community-driven, and provided as-is. Users are responsible for their submissions and votes.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service | SkipTheBoard",
    description:
      "Rules for using SkipTheBoard — community-driven job feed. Free service, user-generated content, no warranty.",
    url: "https://skiptheboard.in/terms",
  },
};

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-xs text-muted-light">Last updated: June 2025</p>

        <p className="mt-6 text-sm text-muted leading-relaxed">
          By using SkipTheBoard (the &quot;Service&quot;), you agree to these terms. If you
          don&apos;t agree, please don&apos;t use the Service.
        </p>

        {/* Service description */}
        <h2 className="mt-10 text-xl font-bold text-foreground">1. What this service is</h2>
        <p className="mt-4 text-sm text-muted leading-relaxed">
          SkipTheBoard is a free, community-driven job discovery platform that aggregates publicly
          available hiring posts from LinkedIn and X. The Service is provided free of charge. We
          do not charge users, process payments, or offer paid placements.
        </p>

        {/* Acceptable use */}
        <h2 className="mt-10 text-xl font-bold text-foreground">2. Acceptable use</h2>
        <p className="mt-4 text-sm text-muted leading-relaxed">You agree not to:</p>
        <ul className="mt-3 space-y-2 text-sm text-muted leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
            <span>Use bots, scripts, or automated tools to manipulate votes or submissions</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
            <span>Submit false, misleading, or spam recruiter suggestions</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
            <span>Attempt to access admin endpoints or bypass security measures</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
            <span>Scrape, copy, or redistribute the Service&apos;s content at scale without permission</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
            <span>Use the Service for any illegal or unauthorized purpose</span>
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted leading-relaxed">
          Violations may result in IP-level blocking and removal of your votes or submissions.
        </p>

        {/* User-generated content */}
        <h2 className="mt-10 text-xl font-bold text-foreground">3. User-generated content</h2>
        <p className="mt-4 text-sm text-muted leading-relaxed">
          The Service allows you to submit recruiter suggestions and vote on job posts. You are
          responsible for the accuracy of your submissions. By submitting content, you confirm
          that:
        </p>
        <ul className="mt-3 space-y-2 text-sm text-muted leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
            <span>The information you submit is accurate to the best of your knowledge</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
            <span>You are not submitting private or confidential information about individuals</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
            <span>The LinkedIn or X profiles you submit are publicly accessible</span>
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted leading-relaxed">
          We reserve the right to reject, remove, or modify any submission without notice.
        </p>

        {/* Job content */}
        <h2 className="mt-10 text-xl font-bold text-foreground">4. Job post content</h2>
        <p className="mt-4 text-sm text-muted leading-relaxed">
          Job posts displayed on SkipTheBoard are sourced from public LinkedIn and X posts. We do
          not create, verify, or endorse the content of these posts. We are not responsible for
          the accuracy of job descriptions, compensation details, or application outcomes. Every
          post links to the original source &mdash; we encourage you to verify directly with the
          poster.
        </p>

        {/* No warranty */}
        <h2 className="mt-10 text-xl font-bold text-foreground">5. No warranty</h2>
        <p className="mt-4 text-sm text-muted leading-relaxed">
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without
          warranties of any kind, express or implied. We do not guarantee that:
        </p>
        <ul className="mt-3 space-y-2 text-sm text-muted leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
            <span>The Service will be available at all times without interruption</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
            <span>Job posts are accurate, current, or represent actual job opportunities</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-light shrink-0 mt-0.5">&bull;</span>
            <span>The Service will be free of errors or vulnerabilities</span>
          </li>
        </ul>

        {/* Limitation of liability */}
        <h2 className="mt-10 text-xl font-bold text-foreground">6. Limitation of liability</h2>
        <p className="mt-4 text-sm text-muted leading-relaxed">
          To the maximum extent permitted by law, SkipTheBoard and its operators shall not be
          liable for any direct, indirect, incidental, consequential, or special damages arising
          from your use of (or inability to use) the Service. This includes, but is not limited to,
          job application outcomes, lost opportunities, or data loss.
        </p>

        {/* Intellectual property */}
        <h2 className="mt-10 text-xl font-bold text-foreground">7. Intellectual property</h2>
        <p className="mt-4 text-sm text-muted leading-relaxed">
          The Service&apos;s design, code, branding, and infrastructure are owned by SkipTheBoard.
          Job post content belongs to the original authors on LinkedIn and X. We link to original
          sources and do not claim ownership of third-party content.
        </p>

        {/* Changes to terms */}
        <h2 className="mt-10 text-xl font-bold text-foreground">8. Changes to these terms</h2>
        <p className="mt-4 text-sm text-muted leading-relaxed">
          We may update these terms as the Service evolves. The &quot;Last updated&quot; date at
          the top of this page reflects the most recent revision. Continued use of the Service
          after changes constitutes acceptance of the updated terms.
        </p>

        {/* Governing law */}
        <h2 className="mt-10 text-xl font-bold text-foreground">9. Governing law</h2>
        <p className="mt-4 text-sm text-muted leading-relaxed">
          These terms are governed by the laws of India. Any disputes shall be resolved in the
          courts of competent jurisdiction in India.
        </p>

        <div className="mt-10 rounded-xl bg-card-bg border border-card-border p-5 shadow-card">
          <p className="text-sm font-semibold text-foreground">Have questions about these terms?</p>
          <p className="mt-1 text-xs text-muted">
            We&apos;re happy to clarify anything that&apos;s unclear.
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
