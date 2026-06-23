import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const SITE_URL = "https://skiptheboard.in";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SkipTheBoard — Real tech jobs from hiring managers, not job boards",
    template: "%s | SkipTheBoard",
  },
  description:
    "SkipTheBoard captures real hiring posts from founders, VPs, and team leads on LinkedIn and X. Community-ranked, auto-expiring job feed with direct links to the original posts.",
  keywords: [
    "tech jobs",
    "hiring managers",
    "LinkedIn jobs",
    "startup jobs",
    "software engineer jobs",
    "remote tech jobs",
    "job feed",
    "community job board",
    "real hiring posts",
    "founder hiring",
  ],
  authors: [{ name: "SkipTheBoard" }],
  creator: "SkipTheBoard",
  publisher: "SkipTheBoard",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "SkipTheBoard",
    title: "SkipTheBoard — Real tech jobs from hiring managers, not job boards",
    description:
      "We watch real hiring managers across LinkedIn and X. Every post they make gets captured here before it vanishes. No job boards. Just real jobs from the people actually hiring.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SkipTheBoard — Real tech jobs from hiring managers",
    description:
      "Community-ranked job feed capturing real hiring posts from LinkedIn and X. No job boards. Just real jobs.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "jobs",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "SkipTheBoard",
  url: SITE_URL,
  description:
    "Community-driven job discovery platform capturing real hiring posts from LinkedIn and X.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/?company={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
      </body>
    </html>
  );
}
