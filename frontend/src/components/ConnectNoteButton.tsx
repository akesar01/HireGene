"use client";

import { useEffect, useId, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Job } from "@/lib/data";
import { draftOutreach } from "@/lib/profile";

interface ConnectNoteButtonProps {
  job: Job;
}

export default function ConnectNoteButton({ job }: ConnectNoteButtonProps) {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsResume, setNeedsResume] = useState(false);
  const [note, setNote] = useState("");
  const [openUrl, setOpenUrl] = useState(job.authorProfileUrl || job.sourceUrl);
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
    setNote("");
    setCopied(false);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const next = await draftOutreach(token, job.id);
      setNote(next.connectNote);
      setOpenUrl(next.openUrl || job.authorProfileUrl || job.sourceUrl);
      await copyText(next.connectNote);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        setNeedsResume(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to draft note");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-foreground transition-colors"
        aria-label="Get a LinkedIn connection request note"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
          />
        </svg>
        Connect note
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button
            type="button"
            aria-label="Close connection note"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full sm:max-w-md bg-card-bg border border-card-border rounded-t-2xl sm:rounded-2xl shadow-card-hover p-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Not a DM
                </p>
                <h2 id={titleId} className="text-base font-bold text-foreground">
                  Connection request note
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  LinkedIn invites allow one 300-character note. Paste this under Connect → Add a note.
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
              <div className="py-8 text-center">
                <div className="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted mt-3">Writing a short invite note…</p>
              </div>
            )}

            {needsResume && (
              <div className="rounded-lg bg-accent-light border border-accent/20 px-4 py-4 text-sm">
                <p className="text-foreground font-medium">Upload a resume first</p>
                <p className="text-muted text-xs mt-1 mb-3">
                  The note needs one real example from your profile.
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

            {!loading && note && (
              <>
                <p className="text-xs font-semibold text-foreground mb-2">
                  {note.length}/300
                </p>
                <textarea
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setCopied(false);
                  }}
                  rows={5}
                  className="w-full text-sm leading-relaxed rounded-lg border border-card-border bg-surface px-3 py-2.5 text-foreground focus:outline-none focus:border-accent"
                />
                {note.length > 300 && (
                  <p className="text-xs text-red-600 mt-1">
                    Trim {note.length - 300} characters or LinkedIn will cut it.
                  </p>
                )}

                <ol className="mt-3 space-y-1.5 text-[11px] text-muted leading-relaxed">
                  <li>1. Copy the note</li>
                  <li>2. Open their LinkedIn profile</li>
                  <li>3. Connect → Add a note → paste → Send</li>
                </ol>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyText(note)}
                    className="inline-flex items-center gap-1.5 bg-foreground text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-foreground/90"
                  >
                    {copied ? "Copied" : "Copy note"}
                  </button>
                  <a
                    href={openUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-accent text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-accent-hover"
                  >
                    Open profile
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
