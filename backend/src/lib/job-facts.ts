// Facts for the public job page and its JobPosting structured data, read from
// the job's own text. Jobs have no location or employment-type column, so a
// fact is reported only when the title, bullets, or post text state it; when
// they do not, the result is empty and the page omits the field. Pure: no DB,
// no LLM.

export interface JobLocation {
  /** City as Google expects it in addressLocality, e.g. "Bengaluru". */
  city: string;
  /** State or union territory, e.g. "Karnataka". */
  region: string;
  /** ISO 3166-1 alpha-2. Only Indian cities are recognised. */
  country: "IN";
}

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACTOR" | "INTERN";

export interface JobFacts {
  /** Cities the post names, in order of first mention, at most MAX_LOCATIONS. */
  locations: JobLocation[];
  /** Country applicants must be in, when the post points at one country. */
  country: "IN" | null;
  employmentTypes: EmploymentType[];
}

export interface JobFactsInput {
  title: string;
  description: string[];
  rawText: string;
}

export const MAX_LOCATIONS = 3;

const CITIES: { city: string; region: string; aliases: string[] }[] = [
  { city: "Bengaluru", region: "Karnataka", aliases: ["bengaluru", "bangalore", "blr"] },
  { city: "Hyderabad", region: "Telangana", aliases: ["hyderabad"] },
  { city: "Pune", region: "Maharashtra", aliases: ["pune"] },
  { city: "Mumbai", region: "Maharashtra", aliases: ["mumbai", "bombay"] },
  { city: "Chennai", region: "Tamil Nadu", aliases: ["chennai", "madras"] },
  { city: "Gurugram", region: "Haryana", aliases: ["gurugram", "gurgaon"] },
  { city: "Noida", region: "Uttar Pradesh", aliases: ["noida"] },
  { city: "New Delhi", region: "Delhi", aliases: ["new delhi", "delhi"] },
  { city: "Kolkata", region: "West Bengal", aliases: ["kolkata", "calcutta"] },
  { city: "Ahmedabad", region: "Gujarat", aliases: ["ahmedabad"] },
  { city: "Jaipur", region: "Rajasthan", aliases: ["jaipur"] },
  { city: "Kochi", region: "Kerala", aliases: ["kochi", "cochin"] },
  { city: "Thiruvananthapuram", region: "Kerala", aliases: ["thiruvananthapuram", "trivandrum"] },
  { city: "Indore", region: "Madhya Pradesh", aliases: ["indore"] },
  { city: "Chandigarh", region: "Chandigarh", aliases: ["chandigarh"] },
  { city: "Coimbatore", region: "Tamil Nadu", aliases: ["coimbatore"] },
  { city: "Mysuru", region: "Karnataka", aliases: ["mysuru", "mysore"] },
  { city: "Bhubaneswar", region: "Odisha", aliases: ["bhubaneswar"] },
  { city: "Nagpur", region: "Maharashtra", aliases: ["nagpur"] },
  { city: "Vadodara", region: "Gujarat", aliases: ["vadodara", "baroda"] },
];

// "IIT Delhi", "IIIT Hyderabad", "IIM Bangalore", "University of Mumbai" name a
// college, not where the job is.
const INSTITUTE_BEFORE = String.raw`(?<!\b(?:iit|iiit|nit|iim|iisc|bits|university of|college of)[\s,-]*)`;
const INSTITUTE_AFTER = String.raw`(?![\s-]*(?:university|institute|college)\b)`;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CITY_PATTERNS = CITIES.map((c) => ({
  location: { city: c.city, region: c.region, country: "IN" as const },
  re: new RegExp(
    `${INSTITUTE_BEFORE}\\b(?:${c.aliases.map(escapeRegex).join("|")})\\b${INSTITUTE_AFTER}`,
    "i",
  ),
}));

const INDIA_RE = /\bindia\b/i;
// "USA" only in capitals. A bare "US" ("DM US", "US clients") is not a place;
// it counts only after location phrasing such as "based in the US", only when it
// ends the phrase ("in US shift" is not a place), and only in capitals, since
// lowercase "us" is ordinary English ("join us").
const USA_RE = /\bU\.S\.A\.|\bUSA\b/;
const US_AS_PLACE_RE = /\b(?:based|located|on-?site|in|from|within|or)\s+(?:the\s+)?(US|U\.S\.)(?=\s*(?:$|[,.;:!)/\n]|or\b|and\b|only\b))/gi;
const US_PLACE_RE =
  /\bunited states\b|\bseattle\b|\bsan francisco\b|\bbay area\b|\bnew york\b|\bsunnyvale\b|\bmountain view\b|\bpalo alto\b|\baustin\b/i;

function pointsAtUS(text: string): boolean {
  return (
    USA_RE.test(text) ||
    US_PLACE_RE.test(text) ||
    [...text.matchAll(US_AS_PLACE_RE)].some((m) => m[1] === m[1].toUpperCase())
  );
}

const INTERN_TITLE_RE = /\bintern(?:ship)?s?\b/i;
const PART_TIME_RE = /\bpart[\s-]?time\b/i;
const CONTRACT_RE =
  /\bcontract[\s-]to[\s-]hire\b|\bc2h\b|\bfreelance\b|\bcontract(?:ual)?\s+(?:role|position|basis|opening|job|engagement)\b|\bon\s+(?:a\s+)?contract\b/i;
const FULL_TIME_RE = /\bfull[\s-]?time\b/i;

/** Cities the text names, in order of first mention. */
export function extractLocations(text: string): JobLocation[] {
  return CITY_PATTERNS.map((p) => ({ location: p.location, index: text.search(p.re) }))
    .filter((m) => m.index >= 0)
    .sort((a, b) => a.index - b.index)
    .slice(0, MAX_LOCATIONS)
    .map((m) => m.location);
}

/** Employment types the job states. Unknown stays empty, never assumed full-time. */
export function extractEmploymentTypes(title: string, text: string): EmploymentType[] {
  const types: EmploymentType[] = [];
  if (INTERN_TITLE_RE.test(title)) types.push("INTERN");
  if (FULL_TIME_RE.test(text)) types.push("FULL_TIME");
  if (PART_TIME_RE.test(text)) types.push("PART_TIME");
  if (CONTRACT_RE.test(text)) types.push("CONTRACTOR");
  return types;
}

export function jobFacts(job: JobFactsInput): JobFacts {
  const text = [job.title, ...(job.description ?? []), job.rawText ?? ""].join("\n");
  if (pointsAtUS(text)) {
    return { locations: [], country: null, employmentTypes: extractEmploymentTypes(job.title, text) };
  }
  const locations = extractLocations(text);
  return {
    locations,
    country: locations.length > 0 || INDIA_RE.test(text) ? "IN" : null,
    employmentTypes: extractEmploymentTypes(job.title, text),
  };
}
