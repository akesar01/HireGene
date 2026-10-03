// Email click links land on the site's own domain and are forwarded to the
// backend redirect, which logs the click and answers with the post URL.

import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/config";

const FALLBACK = "/?utm_source=nudge&utm_medium=email";

export async function GET(request: Request, { params }: { params: Promise<{ sendId: string; jobId: string }> }) {
  const { sendId, jobId } = await params;
  const target = `${BACKEND_URL}/go/${encodeURIComponent(sendId)}/${encodeURIComponent(jobId)}`;
  try {
    const res = await fetch(target, { redirect: "manual", cache: "no-store" });
    const location = res.headers.get("location");
    if (location && /^https?:\/\//i.test(location)) {
      return NextResponse.redirect(location, { status: 302, headers: { "Cache-Control": "no-store" } });
    }
  } catch {
    // fall through to the feed
  }
  return NextResponse.redirect(new URL(FALLBACK, request.url), { status: 302, headers: { "Cache-Control": "no-store" } });
}
