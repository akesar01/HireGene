"use client";

import Link from "next/link";
import { Show, UserButton, SignInButton } from "@clerk/nextjs";

interface HeaderProps {
  liveJobsCount?: number;
  maxWidth?: string;
}

export default function Header({ liveJobsCount, maxWidth = "max-w-7xl" }: HeaderProps) {
  return (
    <header className="border-b border-card-border bg-card-bg sticky top-0 z-10">
      <div className={`${maxWidth} mx-auto px-6 py-3 flex items-center justify-between`}>
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="SkipTheBoard" width={24} height={24} className="shrink-0" />
          <span className="text-lg font-bold text-foreground tracking-tight">SkipTheBoard</span>
          <span className="hidden sm:inline text-xs text-muted">— stalk the poster, not the board</span>
        </Link>
        <div className="flex items-center gap-4">
          {liveJobsCount !== undefined && (
            <span className="text-xs text-muted hidden sm:inline">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5 align-middle" />
              {liveJobsCount} live jobs
            </span>
          )}
          <Link
            href="/submit"
            className="inline-flex items-center gap-1 bg-accent text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors"
          >
            + submit
          </Link>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="text-sm font-medium text-foreground border border-card-border rounded-lg px-3 py-1.5 hover:bg-surface hover:border-border transition-colors">
                Sign in
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Link
              href="/profile"
              className="text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              My Profile
            </Link>
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}
