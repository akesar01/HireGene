import type { Metadata } from "next";
import SubmitForm from "./SubmitForm";

export const metadata: Metadata = {
  title: "Suggest a Hiring Manager",
  description:
    "Know a founder, VP, or team lead who posts hiring updates on LinkedIn or X? Submit their profile to SkipTheBoard and we'll start tracking their posts.",
  alternates: { canonical: "/submit" },
  openGraph: {
    title: "Suggest a Hiring Manager | SkipTheBoard",
    description:
      "Submit a hiring manager's LinkedIn or X profile to SkipTheBoard. We'll review and start tracking their hiring posts.",
    url: "https://skiptheboard.in/submit",
  },
};

export default function SubmitPage() {
  return <SubmitForm />;
}
