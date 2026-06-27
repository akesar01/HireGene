"use client";

import Link from "next/link";
import { Show } from "@clerk/nextjs";

interface PersonalizationPromptProps {
  hasProfile: boolean;
}

export default function PersonalizationPrompt({ hasProfile }: PersonalizationPromptProps) {
  return (
    <Show when="signed-out">
      <div className="bg-gradient-to-br from-accent to-[#ff8c42] rounded-xl p-5 text-white shadow-card">
        <h3 className="text-sm font-bold mb-1">Personalize your feed</h3>
        <p className="text-xs text-white/90 leading-relaxed mb-3">
          Sign in, upload your resume, and we&apos;ll match you with relevant jobs automatically.
        </p>
        <Link
          href="/sign-in?redirect_url=/profile"
          className="inline-flex items-center gap-1 bg-white text-accent text-xs font-semibold px-3 py-2 rounded-lg hover:bg-white/90 transition-colors"
        >
          Get started &rarr;
        </Link>
      </div>
    </Show>
  );
}
