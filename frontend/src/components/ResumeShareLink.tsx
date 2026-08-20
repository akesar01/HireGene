"use client";

import { useState } from "react";

export default function ResumeShareLink({
  url,
  hasPdf = false,
}: {
  url: string;
  hasPdf?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-4 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wider text-foreground mb-1">Resume link</p>
      <p className="text-xs text-muted mb-3">
        {hasPdf
          ? "Hiring managers get your original uploaded PDF at this link. Draft DM and Connect note include it."
          : "Re-upload a PDF to share the real file. Right now this link shows extracted text only."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-accent hover:text-accent-hover break-all"
        >
          {url}
        </a>
        <button
          type="button"
          onClick={copy}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-card-border bg-surface text-muted hover:text-foreground"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
