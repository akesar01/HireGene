import { NextResponse } from "next/server";
import { matchAmazonJobs } from "@/lib/top-companies/amazon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RESUME_CHARS = 40_000;
const MAX_QUERY_CHARS = 120;
const MAX_LOCATION_CHARS = 80;

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return runMatch({
    query: clip(searchParams.get("query"), MAX_QUERY_CHARS),
    location: clip(searchParams.get("location"), MAX_LOCATION_CHARS),
    resumeText: "",
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  return runMatch({
    resumeText: clip(payload.resumeText, MAX_RESUME_CHARS),
    query: clip(payload.query, MAX_QUERY_CHARS),
    location: clip(payload.location, MAX_LOCATION_CHARS),
  });
}

async function runMatch(input: { resumeText: string; query: string; location: string }) {
  if (!input.resumeText && !input.query) {
    return NextResponse.json(
      { error: "Paste a resume or enter a job title to search Amazon roles." },
      { status: 400 },
    );
  }

  try {
    const result = await matchAmazonJobs(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Amazon search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
