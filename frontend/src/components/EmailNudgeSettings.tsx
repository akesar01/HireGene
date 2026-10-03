"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import {
  getEmailPreferences,
  updateEmailPreferences,
  type EmailFrequency,
  type EmailPreferences,
} from "@/lib/profile";

const PAUSE_WEEKS = 4;

export default function EmailNudgeSettings() {
  const { getToken } = useAuth();
  const [prefs, setPrefs] = useState<EmailPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const p = await getEmailPreferences(token);
        if (!cancelled) setPrefs(p);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load email settings");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const save = useCallback(
    async (changes: Partial<Pick<EmailPreferences, "subscribed" | "frequency" | "pausedUntil">>) => {
      setSaving(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) throw new Error("Not authenticated. Please sign in again.");
        setPrefs(await updateEmailPreferences(token, changes));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [getToken],
  );

  const paused = !!prefs?.pausedUntil && new Date(prefs.pausedUntil) > new Date();

  return (
    <div id="email" className="bg-card-bg border border-card-border rounded-xl p-5 shadow-card space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Email me matching jobs</h3>
          <p className="text-xs text-muted mt-1">
            The jobs on the board that best match this resume, with a match score on each. Weekly on Monday morning,
            or daily. One click to unsubscribe from any email.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={prefs?.subscribed ?? false}
          disabled={!prefs || saving}
          onClick={() => prefs && save({ subscribed: !prefs.subscribed, pausedUntil: null })}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            prefs?.subscribed ? "bg-accent" : "bg-border"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              prefs?.subscribed ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {prefs?.subscribed && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">How often</label>
            <div className="flex gap-2">
              {(["weekly", "daily"] as EmailFrequency[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  disabled={saving}
                  onClick={() => save({ frequency: f })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors disabled:opacity-50 ${
                    prefs.frequency === f
                      ? "bg-foreground text-white border-foreground"
                      : "bg-surface text-muted border-card-border hover:text-foreground"
                  }`}
                >
                  {f === "weekly" ? "Weekly (Monday)" : "Daily"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {paused ? (
              <>
                <span className="text-muted">
                  Paused until {new Date(prefs.pausedUntil!).toLocaleDateString()}.
                </span>
                <button type="button" disabled={saving} onClick={() => save({ pausedUntil: null })} className="text-accent hover:underline">
                  Resume now
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  save({ pausedUntil: new Date(Date.now() + PAUSE_WEEKS * 7 * 24 * 60 * 60 * 1000).toISOString() })
                }
                className="text-muted hover:text-foreground"
              >
                Pause for {PAUSE_WEEKS} weeks
              </button>
            )}
          </div>
        </div>
      )}

      {prefs && !prefs.subscribed && (
        <p className="text-xs text-muted">
          You will not receive job emails. Turn the switch on to start again.
        </p>
      )}

      {prefs?.lastSentAt && (
        <p className="text-xs text-muted-light">Last email sent {new Date(prefs.lastSentAt).toLocaleDateString()}.</p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <p className="text-xs text-muted-light">
        We email the address on your account. See the <Link href="/privacy" className="underline hover:text-foreground">privacy page</Link> for what we store.
      </p>
    </div>
  );
}
