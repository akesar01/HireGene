import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: "https://skiptheboard.in/sitemap.xml",
    host: "https://skiptheboard.in",
  };
}
