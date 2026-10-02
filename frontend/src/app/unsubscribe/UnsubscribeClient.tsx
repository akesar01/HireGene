"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BACKEND_URL } from "@/lib/config";

type State =
  | { kind: "working" }
  | { kind: "done"; email: string | null; subscribed: boolean }
  | { kind: "error"; message: string };

export default function UnsubscribeClient() {
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  const [state, setState] = useState<State>({ kind: "working" });
  const [busy, setBusy] = useState(false);

  async function call(action?: "resubscribe") {
    const url = new URL(`${BACKEND_URL}/api/email/unsubscribe`);
    url.searchParams.set("t", token);
    if (action) url.searchParams.set("action", action);
    const res = await fetch(url.toString(), { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { error?: string; email?: string | null; subscribed?: boolean };
    if (!res.ok) throw new Error(body.error ?? "This link is not valid.");
    return body;
  }

  useEffect(() => {
    if (!token) {
      setState({ kind: "error", message: "This link is missing its token. Open the unsubscribe link from the email again." });
      return;
    }
    let cancelled = false;
    call()
      .then((body) => {
        if (!cancelled) setState({ kind: "done", email: body.email ?? null, subscribed: body.subscribed ?? false });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ kind: "error", message: err instanceof Error ? err.message : "This link is not valid." });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function toggle() {
    if (state.kind !== "done") return;
    setBusy(true);
    try {
      const body = await call(state.subscribed ? undefined : "resubscribe");
      setState({ kind: "done", email: body.email ?? null, subscribed: body.subscribed ?? false });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === "working") {
    return <p className="text-sm text-muted">Updating your email settings…</p>;
  }

  if (state.kind === "error") {
    return (
      <div>
        <h1 className="text-xl font-bold text-foreground">We could not update that</h1>
        <p className="mt-2 text-sm text-muted">{state.message}</p>
        <p className="mt-4 text-sm text-muted">
          You can also sign in and turn emails off on your <Link href="/profile#email" className="text-accent hover:underline">profile</Link>,
          or write to <a href="mailto:hello@skiptheboard.in" className="text-accent hover:underline">hello@skiptheboard.in</a>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground">
        {state.subscribed ? "You are subscribed again" : "You are unsubscribed"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {state.subscribed
          ? "Matching jobs will land in your inbox again on the next send."
          : `No more job emails${state.email ? ` to ${state.email}` : ""}. That took effect immediately.`}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="rounded-lg border border-card-border px-4 py-2 font-semibold text-foreground hover:bg-surface transition-colors disabled:opacity-50"
        >
          {state.subscribed ? "Unsubscribe instead" : "Undo, keep sending"}
        </button>
        <Link href="/profile#email" className="text-muted hover:text-foreground">
          Change frequency or pause instead
        </Link>
      </div>
      <p className="mt-8 text-xs text-muted-light">
        <Link href="/" className="hover:text-foreground">&larr; back to the feed</Link>
      </p>
    </div>
  );
}
