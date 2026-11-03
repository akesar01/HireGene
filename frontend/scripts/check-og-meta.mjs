// Verifies social-preview tags and the images they point to on the home page and
// on /about (a page that sets its own openGraph and so must re-list the image).
// Usage: node scripts/check-og-meta.mjs [baseUrl]   (default https://skiptheboard.in)
// Against a local server (e.g. http://localhost:3000) the absolute image URLs
// still point at the production origin, so they are fetched from baseUrl instead.
const SITE_URL = "https://skiptheboard.in";
const base = (process.argv[2] ?? SITE_URL).replace(/\/$/, "");

const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${msg}`);
  if (!ok) failures.push(msg);
};

for (const path of ["/", "/about"]) {
  const html = await (await fetch(`${base}${path}`, { headers: { "User-Agent": "Twitterbot/1.0" } })).text();
  const meta = (key) => {
    const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)="${key}"[^>]*>`))?.[0];
    return tag?.match(/content="([^"]*)"/)?.[1];
  };

  for (const key of ["og:image", "twitter:image"]) {
    const url = meta(key);
    check(url?.startsWith(`${SITE_URL}/`), `${path} ${key} is an absolute ${SITE_URL} URL (${url})`);
    if (!url) continue;

    const res = await fetch(url.replace(SITE_URL, base));
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type");
    check(res.status === 200, `${path} ${key} returns 200 (got ${res.status})`);
    check(type === "image/png", `${path} ${key} is image/png (got ${type})`);
    // PNG IHDR: width and height are big-endian uint32 at bytes 16 and 20.
    const [w, h] = buf.length >= 24 ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : [0, 0];
    check(w === 1200 && h === 630, `${path} ${key} is 1200x630 (got ${w}x${h})`);
  }

  for (const key of ["og:image:width", "og:image:height", "og:image:alt", "twitter:card"]) {
    check(!!meta(key), `${path} ${key} present (${meta(key)})`);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
