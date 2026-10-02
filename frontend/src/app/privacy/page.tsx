import type { Metadata } from "next";
import Link from "next/link";
import { JOB_EXPIRY_DAYS } from "@/lib/config";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What SkipTheBoard stores (account, resume, email preferences, votes), who processes it, and how to unsubscribe or delete your data.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | SkipTheBoard",
    description: "What we store, who processes it, and how to unsubscribe or delete your data.",
    url: "https://skiptheboard.in/privacy",
  },
};

const CONTACT = "hello@skiptheboard.in";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <Header maxWidth="max-w-3xl" />

      <article className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-xs text-muted-light">Last updated: October 2026</p>

        <p className="mt-6 text-sm text-muted leading-relaxed">
          SkipTheBoard shows hiring posts that founders, managers and recruiters publish on LinkedIn and X.
          You can browse without an account. If you sign in and upload a resume, we store that data to rank the
          feed for you and to email you matching jobs. This page lists exactly what we keep, why, who processes
          it, and how to opt out or delete it.
        </p>

        <h2 className="mt-10 text-xl font-bold text-foreground">What we store</h2>

        <h3 className="mt-6 text-sm font-bold text-foreground">Your account</h3>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Sign-in is handled by Clerk. Clerk stores your name, email address and sign-in method and sets the
          cookies needed to keep you signed in. We read your user id and your primary email from Clerk. We never
          see your password.
        </p>

        <h3 className="mt-6 text-sm font-bold text-foreground">Your resume</h3>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          When you upload a resume we extract its text and parse it with an AI model (Groq) into contact details,
          experience, education, skills and a short filter summary (role, seniority, work mode, stack). We store the
          parsed data and the filter summary, not the file itself. The parsed data powers your match scores, the
          Draft DM feature and a shareable resume page at a private link that only people you give it to can open.
          Re-uploading replaces the stored data.
        </p>

        <h3 className="mt-6 text-sm font-bold text-foreground">Email preferences and sends</h3>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          If you have signed in and uploaded a resume, we email you the jobs on the board that best match it,
          weekly by default. You can switch to daily, pause, or turn it off on your profile at any time, and every
          email has a one-click unsubscribe link that needs no login. We store your choice (on or off, frequency,
          pause date), when each email was sent and which jobs it contained, and whether it was delivered, opened
          or clicked. Links in the email pass through our own redirect so we can count clicks; we also receive
          delivery, bounce and complaint reports from the email provider. A hard bounce or a spam complaint turns
          emails off automatically. We never email the address printed in your resume, only the address on your
          account.
        </p>

        <h3 className="mt-6 text-sm font-bold text-foreground">Applied and votes</h3>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Marking a job as applied stores the job id against your account. Upvotes and downvotes store the job id,
          the vote direction and your IP address, which we use only to stop duplicate voting.
        </p>

        <h3 className="mt-6 text-sm font-bold text-foreground">Hiring-manager submissions</h3>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          When you suggest a hiring manager we store the details you enter and your IP address to stop spam.
        </p>

        <h3 className="mt-6 text-sm font-bold text-foreground">Payments</h3>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          If you buy a plan, Stripe handles the payment. We store only your plan status, never card details.
        </p>

        <h3 className="mt-6 text-sm font-bold text-foreground">Analytics</h3>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          We use Google Analytics 4 for aggregate traffic reporting (page views, referrers, country). Google may set
          analytics cookies in your browser for this. We do not sell or share data with advertisers.
        </p>

        <h2 className="mt-10 text-xl font-bold text-foreground">Who processes it</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted leading-relaxed">
          <li><strong className="text-foreground">Clerk</strong> for sign-in and account data.</li>
          <li><strong className="text-foreground">Resend</strong> sends our emails and reports delivery, bounces, opens, clicks and complaints back to us.</li>
          <li><strong className="text-foreground">Groq</strong> parses resume text and job posts. Text is sent for processing and is not used by us to train models.</li>
          <li><strong className="text-foreground">Stripe</strong> for payments.</li>
          <li><strong className="text-foreground">Google Analytics</strong> for aggregate traffic.</li>
          <li><strong className="text-foreground">Vercel</strong>, plus hosted PostgreSQL and MongoDB, run the site and store the data above.</li>
        </ul>

        <h2 className="mt-10 text-xl font-bold text-foreground">Retention</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Job posts expire and are deleted after {JOB_EXPIRY_DAYS} days. Account, resume and email data stay until
          you delete them. Send and unsubscribe records are kept for one year so we can prove when you opted out.
        </p>

        <h2 className="mt-10 text-xl font-bold text-foreground">Your choices</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted leading-relaxed">
          <li>
            <strong className="text-foreground">Stop emails:</strong> click &ldquo;Unsubscribe in one click&rdquo; in any email, or turn the switch off on your{" "}
            <Link href="/profile#email" className="text-accent hover:underline">profile</Link>. It takes effect immediately.
          </li>
          <li>
            <strong className="text-foreground">Delete your data:</strong> email <a href={`mailto:${CONTACT}`} className="text-accent hover:underline">{CONTACT}</a> from your account address. We delete your resume data, preferences, applied marks and send history, and remove your Clerk account, within 30 days.
          </li>
          <li>
            <strong className="text-foreground">See your data:</strong> your profile page shows everything we parsed from your resume. Ask at the same address for a full copy.
          </li>
          <li>
            <strong className="text-foreground">Complain:</strong> if we do not resolve a concern, you may approach the Data Protection Board of India under the Digital Personal Data Protection Act, 2023.
          </li>
        </ul>

        <h2 className="mt-10 text-xl font-bold text-foreground">Hiring posts</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Posts in the feed are public LinkedIn and X posts and link back to the original. If you wrote a post and
          want it removed, email <a href={`mailto:${CONTACT}`} className="text-accent hover:underline">{CONTACT}</a> with the link.
        </p>

        <h2 className="mt-10 text-xl font-bold text-foreground">Changes</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          We will update this page when what we collect changes, and change the date at the top.
        </p>

        <p className="mt-10 text-xs text-muted-light">
          Questions: <a href={`mailto:${CONTACT}`} className="hover:text-foreground">{CONTACT}</a> ·{" "}
          <Link href="/terms" className="hover:text-foreground">Terms</Link> ·{" "}
          <Link href="/" className="hover:text-foreground">Back to the feed</Link>
        </p>
      </article>
    </div>
  );
}
