"use client";

import { useState } from "react";
import Link from "next/link";
import { BACKEND_URL } from "@/lib/config";

export default function SubmitForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const linkedinUrl = formData.get("linkedinUrl") as string;
    const company = formData.get("company") as string;
    const title = formData.get("title") as string;
    const note = formData.get("note") as string;

    try {
      const res = await fetch(`${BACKEND_URL}/api/recruiter-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, linkedinUrl, company, title, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong");
        setStatus("error");
        return;
      }
      setStatus("success");
      (e.target as HTMLFormElement).reset();
    } catch {
      setErrorMsg("Failed to submit. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <header className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <img src="/logo.svg" alt="SkipTheBoard" width={24} height={24} className="shrink-0" />
            <span className="text-lg font-bold text-foreground tracking-tight">SkipTheBoard</span>
          </Link>
          <p className="mt-1 text-xs text-muted">
            <Link href="/" className="hover:text-foreground transition-colors">← back to feed</Link>
          </p>
        </header>

        <div className="max-w-md">
          <h2 className="text-lg font-bold text-foreground">Suggest a hiring manager</h2>
          <p className="mt-1 text-sm text-muted">
            Know a founder, VP, or team lead who posts hiring updates on LinkedIn?
            Share their profile — our team reviews every submission before adding them to the tracking list.
          </p>

          {status === "success" ? (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-800">Submission received!</p>
              <p className="mt-1 text-xs text-green-700">
                Our team will review this hiring manager before adding them to the tracking list.
                Thanks for contributing.
              </p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="mt-3 text-xs font-semibold text-green-800 hover:underline"
              >
                Submit another →
              </button>
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="name" className="block text-xs font-semibold text-muted mb-1.5">
                  Hiring manager name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Sumitha Chandran"
                  className="w-full rounded-lg border border-card-border bg-card-bg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                />
              </div>

              <div>
                <label htmlFor="linkedinUrl" className="block text-xs font-semibold text-muted mb-1.5">
                  LinkedIn profile URL
                </label>
                <input
                  id="linkedinUrl"
                  name="linkedinUrl"
                  type="url"
                  required
                  placeholder="https://linkedin.com/in/..."
                  className="w-full rounded-lg border border-card-border bg-card-bg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                />
              </div>

              <div>
                <label htmlFor="company" className="block text-xs font-semibold text-muted mb-1.5">
                  Company (optional)
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  placeholder="e.g. Google, Stripe, Startup Inc."
                  className="w-full rounded-lg border border-card-border bg-card-bg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                />
              </div>

              <div>
                <label htmlFor="title" className="block text-xs font-semibold text-muted mb-1.5">
                  Their role (optional)
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  placeholder="e.g. Engineering Manager @ Google"
                  className="w-full rounded-lg border border-card-border bg-card-bg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                />
              </div>

              <div>
                <label htmlFor="note" className="block text-xs font-semibold text-muted mb-1.5">
                  Why should we track them? (optional)
                </label>
                <textarea
                  id="note"
                  name="note"
                  rows={3}
                  placeholder="e.g. They regularly post hiring updates for their team..."
                  className="w-full rounded-lg border border-card-border bg-card-bg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 resize-none"
                />
              </div>

              {status === "error" && (
                <p className="text-xs text-red-600">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {status === "submitting" ? "Submitting..." : "Submit for review"}
              </button>
            </form>
          )}

          <p className="mt-4 text-xs text-muted-light">
            🔍 Every submission is reviewed by our team before the hiring manager is added to the tracking list.
          </p>
        </div>
      </div>
    </div>
  );
}
