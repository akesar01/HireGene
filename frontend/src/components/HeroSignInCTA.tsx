"use client";

import { SignInButton } from "@clerk/nextjs";

export default function HeroSignInCTA() {
  return (
    <SignInButton mode="modal">
      <button className="inline-flex items-center gap-2 bg-foreground text-white text-sm font-bold px-6 py-3 rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-xl border-2 border-white/10">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Sign in to get your personalized feed
      </button>
    </SignInButton>
  );
}
