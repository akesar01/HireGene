import { ImageResponse } from "next/og";
import { OG_IMAGE } from "@/lib/og-image";

export const alt = OG_IMAGE.alt;
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };
export const contentType = OG_IMAGE.type;

// Brand colors from globals.css (--accent, --foreground, --muted, --background).
const ACCENT = "#ff5414";
const FOREGROUND = "#1a1a1a";
const MUTED = "#6b7280";
const BACKGROUND = "#f7f7f8";

const TAGLINE = "Real tech jobs from hiring managers' own posts";
const FOOTER = "From LinkedIn & X · Community-ranked · skiptheboard.in";

// The image is prerendered at build, so this runs once per deploy. If Google
// Fonts is unreachable we fall back to next/og's bundled font.
async function loadInter(weight: number, text: string) {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&text=${encodeURIComponent(text)}`,
      )
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image() {
  const text = `SkipTheBoard${TAGLINE}${FOOTER}`;
  const [semibold, bold] = await Promise.all([loadInter(600, text), loadInter(700, text)]);
  const fonts = [
    semibold && { name: "Inter", data: semibold, weight: 600 as const, style: "normal" as const },
    bold && { name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
  ].filter((f) => !!f);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: BACKGROUND,
          fontFamily: "Inter",
          borderTop: `16px solid ${ACCENT}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          {/* Same mark as public/logo.svg */}
          <svg width="144" height="144" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill={ACCENT} />
            <path d="M11 9.5v13l9-6.5z" fill="#fff" />
            <rect x="21" y="9.5" width="2.5" height="13" rx="1" fill="#fff" />
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 112,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: FOREGROUND,
            }}
          >
            Skip<span style={{ color: ACCENT }}>The</span>Board
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 56,
            fontSize: 60,
            fontWeight: 600,
            lineHeight: 1.2,
            color: FOREGROUND,
          }}
        >
          {TAGLINE}
        </div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 36, fontWeight: 600, color: MUTED }}>
          {FOOTER}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
