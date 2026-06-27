"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import Header from "@/components/Header";
import ResumeUpload from "@/components/ResumeUpload";
import ResumeDisplay from "@/components/ResumeDisplay";
import FilterEditor from "@/components/FilterEditor";
import { getProfile, type ResumeProfile } from "@/lib/profile";

export default function ProfilePage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Not authenticated");
        return;
      }
      const p = await getProfile(token);
      setProfile(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadProfile();
    } else if (isLoaded && !isSignedIn) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, loadProfile]);

  // Not signed in state
  if (isLoaded && !isSignedIn) {
    return (
      <div className="min-h-screen">
        <Header maxWidth="max-w-3xl" />
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex w-14 h-14 rounded-xl bg-accent-light items-center justify-center mb-4">
            <svg className="w-7 h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Sign in to personalize your feed</h1>
          <p className="text-sm text-muted max-w-md mx-auto mb-6">
            Upload your resume and we&apos;ll auto-filter jobs that match your skills, role, and experience level.
          </p>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-1.5 bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-accent-hover transition-colors"
          >
            Sign in
          </Link>
          <p className="text-xs text-muted-light mt-4">
            <Link href="/" className="hover:text-foreground transition-colors">&larr; back to feed</Link>
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen">
        <Header maxWidth="max-w-3xl" />
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted mt-3">Loading your profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header maxWidth="max-w-3xl" />

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">My Profile</h1>
          <p className="text-sm text-muted mt-1">
            Upload your resume to auto-filter your job feed with AI-powered matching.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* No profile yet — show upload */}
        {!profile ? (
          <div className="space-y-4">
            <ResumeUpload
              onUploaded={(p) => { setProfile(p); setError(null); }}
              onError={(msg) => setError(msg)}
            />
            <div className="bg-accent-light border border-accent/20 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1">How it works</h3>
              <ul className="space-y-2 text-xs text-muted leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-accent shrink-0 mt-0.5">1.</span>
                  <span>Upload your resume (PDF or TXT). We extract text and parse it with AI.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent shrink-0 mt-0.5">2.</span>
                  <span>We identify your role, seniority, skills, and preferences automatically.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent shrink-0 mt-0.5">3.</span>
                  <span>Your job feed auto-filters to match your profile. Adjust anytime below.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent shrink-0 mt-0.5">4.</span>
                  <span>Your resume is <strong className="text-foreground">not stored</strong> — only the parsed data is saved.</span>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Upload (re-upload) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Resume</h2>
                <span className="text-xs text-muted-light">
                  Last updated {profile.updatedAt ? new Date(profile.updatedAt).toLocaleDateString() : "—"}
                </span>
              </div>
              <ResumeUpload
                onUploaded={(p) => { setProfile(p); setError(null); }}
                onError={(msg) => setError(msg)}
              />
            </div>

            {/* Parsed resume data */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3">Extracted Data</h2>
              <ResumeDisplay profile={profile} />
            </div>

            {/* Filter preferences */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3">Feed Preferences</h2>
              <FilterEditor
                profile={profile}
                onUpdated={(p) => setProfile(p)}
                onError={(msg) => setError(msg)}
              />
            </div>

            {/* Back to feed */}
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 bg-foreground text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-foreground/90 transition-colors"
              >
                View personalized feed &rarr;
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
