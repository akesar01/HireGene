"use client";

import { useEffect, useId, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Job } from "@/lib/data";
import { draftOutreach, type OutreachDraft, type OutreachOption } from "@/lib/profile";

interface MessageButtonProps {
  job: Job;
}

export default function MessageButton({ job }: MessageButtonProps) {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsResume, setNeedsResume] = useState(false);
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function copyText(value: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      return false;
    }
  }

  async function handleOpen() {
    if (!isSignedIn) {
      router.push("/sign-in?redirect_url=/");
      return;
    }
    setOpen(true);
    setLoading(true);
    setError(null);
    setNeedsResume(false);
    setDraft(null);
    setPickedId(null);
    setCopied(false);
    setText("");

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const next = await draftOutreach(token, job.id);
      setDraft(next);
      const options = next.options?.length
        ? next.options
        : [{ id: "proof", label: "Proof-first", why: "", message: next.message }];
      if (options.length === 1) {
        pickOption(options[0]);
      }
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        setNeedsResume(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to draft message");
      }
    } finally {
      setLoading(false);
    }
  }

  function pickOption(option: OutreachOption) {
    setPickedId(option.id);
    setText(option.message);
    void copyText(option.message);
  }

  const options: OutreachOption[] = draft?.options?.length
    ? draft.options
    : draft
      ? [{ id: "proof", label: "Proof-first", why: "", message: draft.message }]
      : [];
  const choosing = Boolean(draft && !pickedId && options.length > 1);
  const picked = options.find((o) => o.id === pickedId) ?? null;
  const openUrl = draft?.openUrl ?? job.authorProfileUrl ?? job.sourceUrl;
  const sourceLabel = job.source === "x" ? "Open on X" : "Open LinkedIn";

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-accent-light border-accent/20 text-accent hover:bg-accent hover:text-white hover:border-accent transition-colors"
        aria-label="Get a ready-to-send DM draft"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"
          />
        </svg>
        Draft DM
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button
            type="button"
            aria-label="Close draft"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full sm:max-w-2xl bg-card-bg border border-card-border rounded-t-2xl sm:rounded-2xl shadow-card-hover p-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 id={titleId} className="text-base font-bold text-foreground">
                  {choosing ? "Which DM do you want?" : "Ready-to-send DM"}
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  {choosing
                    ? "Two drafts from this post and your resume. Pick one, then paste it into their chat."
                    : `Copy it, then send it yourself on ${job.source === "x" ? "X" : "LinkedIn"}. We never send as you.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted hover:text-foreground text-lg leading-none px-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {loading && (
              <div className="py-10 text-center">
                <div className="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted mt-3">Writing two specific DMs from this post and your resume…</p>
              </div>
            )}

            {needsResume && (
              <div className="rounded-lg bg-accent-light border border-accent/20 px-4 py-4 text-sm">
                <p className="text-foreground font-medium">Upload a resume first</p>
                <p className="text-muted text-xs mt-1 mb-3">
                  The draft needs real examples from your profile plus this hiring post.
                </p>
                <Link
                  href="/profile"
                  className="inline-flex items-center bg-accent text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-accent-hover"
                >
                  Go to profile
                </Link>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {choosing && (
              <div className="grid gap-3 sm:grid-cols-2">
                {options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => pickOption(option)}
                    className="text-left rounded-xl border border-card-border bg-surface hover:border-accent hover:bg-accent-light/40 transition-colors p-3"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-foreground">{option.label}</span>
                      <span className="text-[11px] font-semibold text-accent">Use this</span>
                    </div>
                    {option.why && (
                      <p className="text-[11px] text-muted mb-2">{option.why}</p>
                    )}
                    <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-56 overflow-y-auto">
                      {option.message}
                    </pre>
                  </button>
                ))}
              </div>
            )}

            {!loading && draft && picked && (
              <>
                {options.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPickedId(null);
                      setCopied(false);
                    }}
                    className="text-xs font-semibold text-accent hover:text-accent-hover mb-3"
                  >
                    ← Compare the other draft
                  </button>
                )}

                <p className="text-xs font-semibold text-foreground mb-2">
                  {picked.label} DM
                </p>

                <textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setCopied(false);
                  }}
                  rows={10}
                  className="w-full text-sm leading-relaxed rounded-lg border border-card-border bg-surface px-3 py-2.5 text-foreground focus:outline-none focus:border-accent whitespace-pre-wrap"
                />

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyText(text)}
                    className="inline-flex items-center gap-1.5 bg-foreground text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-foreground/90"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <a
                    href={openUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-accent text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-accent-hover"
                  >
                    {sourceLabel} to paste
                  </a>
                  {job.sourceUrl !== openUrl && (
                    <a
                      href={job.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover"
                    >
                      Original post
                    </a>
                  )}
                </div>

                <p className="mt-3 text-[11px] text-muted-light leading-relaxed">
                  Open their chat, paste this, and hit Send yourself. If you are not connected yet, use
                  Connect note on the card. That is a separate invite note, not this DM.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
