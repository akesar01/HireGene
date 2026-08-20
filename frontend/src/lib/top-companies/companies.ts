export type CompanyStatus = "live" | "soon";

export interface TopCompany {
  id: string;
  name: string;
  status: CompanyStatus;
  source: string;
  blurb: string;
  accent: string;
}

export const TOP_COMPANIES: TopCompany[] = [
  {
    id: "amazon",
    name: "Amazon",
    status: "live",
    source: "amazon.jobs",
    blurb: "Live roles from Amazon and AWS. Official apply page.",
    accent: "#FF9900",
  },
  {
    id: "google",
    name: "Google",
    status: "soon",
    source: "careers.google.com",
    blurb: "In-house careers site. Tracker coming next.",
    accent: "#4285F4",
  },
  {
    id: "microsoft",
    name: "Microsoft",
    status: "soon",
    source: "careers.microsoft.com",
    blurb: "In-house careers site. Tracker coming next.",
    accent: "#00A4EF",
  },
  {
    id: "meta",
    name: "Meta",
    status: "soon",
    source: "metacareers.com",
    blurb: "In-house careers site. Tracker coming next.",
    accent: "#0668E1",
  },
  {
    id: "apple",
    name: "Apple",
    status: "soon",
    source: "jobs.apple.com",
    blurb: "In-house careers site. Tracker coming next.",
    accent: "#111111",
  },
];
