import type { Metadata } from "next";
import Header from "@/components/Header";
import TopCompaniesClient from "./TopCompaniesClient";

export const metadata: Metadata = {
  title: "Top Companies",
  description:
    "Match your resume to live roles at high-demand employers. Amazon is live via amazon.jobs. Apply on the official company page.",
  alternates: { canonical: "/top-companies" },
  openGraph: {
    title: "Top Companies | SkipTheBoard",
    description:
      "Paste your resume and match live Amazon roles. Official apply links only. We do not submit applications for you.",
    url: "https://skiptheboard.in/top-companies",
  },
};

export default function TopCompaniesPage() {
  return (
    <div className="min-h-screen">
      <Header maxWidth="max-w-5xl" />
      <TopCompaniesClient />
    </div>
  );
}
