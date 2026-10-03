"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import BrandLogo from "@/components/BrandLogo";
import { adminApi } from "@/lib/admin";
import SubscribersPanel from "./SubscribersPanel";
import EmailPanel from "./EmailPanel";
import JobsPanel from "./JobsPanel";
import SendPanel from "./SendPanel";
import ExperimentsPanel from "./ExperimentsPanel";
import { RecruitersPanel, SubmissionsPanel } from "./RecruitersPanel";

type Tab = "subscribers" | "email" | "jobs" | "send" | "experiments" | "submissions" | "recruiters";

const TABS: { id: Tab; label: string }[] = [
  { id: "subscribers", label: "Subscribers" },
  { id: "email", label: "Email performance" },
  { id: "jobs", label: "Jobs & site" },
  { id: "send", label: "Send controls" },
  { id: "experiments", label: "Experiments" },
  { id: "submissions", label: "Submissions" },
  { id: "recruiters", label: "Hiring managers" },
];

export default function AdminDashboard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [access, setAccess] = useState<"checking" | "ok" | "denied">("checking");
  const [tab, setTab] = useState<Tab>("subscribers");

  const token = useCallback(async () => {
    const t = await getToken();
    if (!t) throw new Error("Not signed in");
    return t;
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setAccess("denied");
      return;
    }
    token()
      .then((t) => adminApi.whoami(t))
      .then((r) => setAccess(r.ok ? "ok" : "denied"))
      .catch(() => setAccess("denied"));
  }, [isLoaded, isSignedIn, token]);

  // Non-admins (and signed-out visitors) see an empty page: nothing to probe.
  if (access !== "ok") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        {access === "denied" && <p className="text-xs text-muted-light">Nothing here.</p>}
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border bg-card-bg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <BrandLogo size={24} />
              <span className="text-lg font-bold text-foreground tracking-tight">SkipTheBoard</span>
            </Link>
            <span className="text-xs text-muted-light">/ admin</span>
          </div>
          <Link href="/profile" className="text-xs font-medium text-muted hover:text-foreground transition-colors">
            My profile
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <nav className="flex gap-1 mb-6 border-b border-card-border overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "subscribers" && <SubscribersPanel getToken={token} />}
        {tab === "email" && <EmailPanel getToken={token} />}
        {tab === "jobs" && <JobsPanel getToken={token} />}
        {tab === "send" && <SendPanel getToken={token} />}
        {tab === "experiments" && <ExperimentsPanel getToken={token} />}
        {tab === "submissions" && <SubmissionsPanel getToken={token} />}
        {tab === "recruiters" && <RecruitersPanel getToken={token} />}
      </div>
    </div>
  );
}
