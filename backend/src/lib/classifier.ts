// Hiring post classifier — regex-based heuristic for v1.
// Best-effort: will miss edge cases. Clean extraction deferred to v2 LLM re-parse.

const HIRING_PATTERNS = [
  /\bhiring\b/i,
  /\bwe'?re looking for\b/i,
  /\blooking for\b.*\b(engineer|developer|designer|manager|analyst|intern|lead|head)\b/i,
  /\bjoin (my|our) team\b/i,
  /\bopen (role|position)\b/i,
  /\bjob opening\b/i,
  /\bwe need\b.*\b(engineer|developer|designer|manager|analyst|intern|lead|head)\b/i,
  /\bmy team is (hiring|looking)\b/i,
  /\bactively (hiring|recruiting)\b/i,
  /\bI'?m hiring\b/i,
  /\bwe'?re hiring\b/i,
  // Indirect hiring language
  /\bstrong (opening|role|candidate)\b/i,
  /\bthis (role|position) (stands out|is tied|sits on|focuses on)\b/i,
  /\brole (sits on|stands out|focuses on|is tied to)\b/i,
  /\b(engineer|developer|designer|manager|analyst|intern|lead|head) who (will|can|wants to)\b/i,
  /\bknow someone who\b/i,
  /\bbasic qualifications\b/i,
  /\bpreferred qualifications\b/i,
  /\bresponsibilities include\b/i,
  /\byears of (software development|experience|technical support|engineering)\b/i,
  /\bwe are responsible for building technologies\b/i,
];

const NON_HIRING_PATTERNS = [
  /\bi was hired\b/i,
  /\bi got hired\b/i,
  /\bjust got (the )?job\b/i,
  /\bhired at\b/i,
  /\baccepted (the )?offer\b/i,
];

export function isJobPost(text: string): boolean {
  if (!text || text.trim().length < 20) return false;

  for (const pattern of NON_HIRING_PATTERNS) {
    if (pattern.test(text)) return false;
  }

  for (const pattern of HIRING_PATTERNS) {
    if (pattern.test(text)) return true;
  }

  return false;
}

const SENIORITY_MAP: Record<string, RegExp> = {
  intern: /\bintern(ship)?\b/i,
  junior: /\bjunior\b|\bjr\b|\bentry.level\b/i,
  mid: /\bmid.level\b|\bintermediate\b/i,
  senior: /\bsenior\b|\bsr\b|\bsmt[s]?\b/i,
  lead: /\blead\b|\btech lead\b/i,
  staff: /\bstaff\b/i,
  head: /\bhead of\b|\bhead\b/i,
};

const REMOTE_MAP: Record<string, RegExp> = {
  remote: /\bremote\b|\bwfh\b|\bwork from home\b/i,
  hybrid: /\bhybrid\b/i,
  in_office: /\bon.site\b|\bin.office\b|\boffice\b/i,
};

const ROLE_FAMILY_MAP: Record<string, RegExp> = {
  ai_ml: /\bml\b|\bai\b|\bmachine learning\b|\bdeep learning\b|\bllm\b|\bgen.?ai\b/i,
  engineering: /\bengineer\b|\bdeveloper\b|\bbackend\b|\bfrontend\b|\bfull.stack\b|\bsde\b|\bsoftware\b/i,
  product: /\bproduct manager\b|\bpm\b|\bproduct\b/i,
  design: /\bdesigner\b|\bdesign\b|\bux\b|\bui\b/i,
  data: /\bdata (engineer|analyst|scientist)\b|\banalytics\b/i,
  growth: /\bgrowth\b|\bacquisition\b/i,
  marketing: /\bmarketing\b|\bseo\b|\bbrand\b|\bcontent marketing\b/i,
  content: /\bcontent (writer|strategist|creator)\b|\bcopywriter\b/i,
  ops: /\boperations\b|\bops\b|\bsupply chain\b/i,
  founders_office: /\bchief of staff\b|\bfounder.?s office\b|\bstrategy\b/i,
  sales: /\bsales\b|\baccount executive\b|\bbdr\b|\bsdr\b/i,
  strategy: /\bstrategy\b|\bconsulting\b/i,
  finance: /\bfinance\b|\baccountant\b|\bfp&a\b/i,
  business: /\bbusiness (development|analyst)\b|\bbd\b/i,
  people: /\bhr\b|\bpeople\b|\btalent\b|\brecruiter\b/i,
};

const TECH_STACK_MAP: Record<string, RegExp> = {
  python: /\bpython\b/i,
  java: /\bjava\b/i,
  sql: /\bsql\b|\bpostgres\b|\bmysql\b/i,
  ai: /\bai\b|\bartificial intelligence\b/i,
  aws: /\baws\b|\bamazon web services\b/i,
  langchain: /\blangchain\b/i,
  rag: /\brag\b|\bretrieval.augmented\b/i,
  react: /\breact\b/i,
  llm: /\bllm\b|\blarge language model\b/i,
  nextjs: /\bnext\.?js\b/i,
  typescript: /\btypescript\b|\bts\b/i,
  nodejs: /\bnode\.?js\b/i,
  go: /\bgolang\b|\bgo\b/i,
  rust: /\brust\b/i,
  docker: /\bdocker\b|\bkubernetes\b|\bk8s\b/i,
};

export function extractSeniority(text: string): string {
  for (const [key, pattern] of Object.entries(SENIORITY_MAP)) {
    if (pattern.test(text)) return key;
  }
  return "mid";
}

export function extractRemoteMode(text: string): string {
  for (const [key, pattern] of Object.entries(REMOTE_MAP)) {
    if (pattern.test(text)) return key;
  }
  return "in_office";
}

export function extractRoleFamily(text: string): string {
  for (const [key, pattern] of Object.entries(ROLE_FAMILY_MAP)) {
    if (pattern.test(text)) return key;
  }
  return "engineering";
}

export function extractTechStack(text: string): string[] {
  const stacks: string[] = [];
  for (const [key, pattern] of Object.entries(TECH_STACK_MAP)) {
    if (pattern.test(text)) stacks.push(key);
  }
  return stacks;
}

export function extractTitle(text: string): string {
  // Try to find "hiring [X]" or "looking for [X]" patterns
  const hiringMatch = text.match(/(?:hiring|looking for)\s+(?:a\s+|an\s+)?([^\n.]{5,60})/i);
  if (hiringMatch) return hiringMatch[1].trim();

  // Fallback: look for role + seniority
  const seniority = extractSeniority(text);
  const family = extractRoleFamily(text);
  const titleMap: Record<string, string> = {
    engineering: "Software Engineer",
    ai_ml: "ML Engineer",
    product: "Product Manager",
    design: "Designer",
    data: "Data Analyst",
    growth: "Growth Manager",
    marketing: "Marketing Manager",
    content: "Content Writer",
    ops: "Operations Manager",
    founders_office: "Chief of Staff",
    sales: "Sales Manager",
    strategy: "Strategy Manager",
    finance: "Finance Manager",
    business: "Business Development",
    people: "HR Manager",
  };
  const base = titleMap[family] ?? "Specialist";
  if (seniority === "head") return `Head of ${base}`;
  if (seniority === "lead") return `Lead ${base}`;
  if (seniority === "staff") return `Staff ${base}`;
  if (seniority === "senior") return `Senior ${base}`;
  if (seniority === "junior") return `Junior ${base}`;
  if (seniority === "intern") return `${base} Intern`;
  return base;
}

export function extractDescription(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 10 && l.length < 200)
    .filter((l) => !/^(hiring|we'?re|looking|join|my team)/i.test(l))
    .slice(0, 3);
  return lines;
}
