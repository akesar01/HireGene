import { describe, expect, it } from "vitest";
import { extractEmploymentTypes, extractLocations, jobFacts, MAX_LOCATIONS } from "../src/lib/job-facts";

const job = (rawText: string, title = "Backend Engineer", description: string[] = []) => ({
  title,
  description,
  rawText,
});

describe("extractLocations", () => {
  it("maps aliases to the canonical city, region and country", () => {
    expect(extractLocations("Office in Bangalore (Koramangala)")).toEqual([
      { city: "Bengaluru", region: "Karnataka", country: "IN" },
    ]);
    expect(extractLocations("Gurgaon, WFO")[0]).toEqual({ city: "Gurugram", region: "Haryana", country: "IN" });
  });

  it("orders cities by first mention and caps the list", () => {
    const cities = extractLocations("Roles in Pune, Hyderabad, Chennai, Noida and Mumbai").map((l) => l.city);
    expect(cities).toEqual(["Pune", "Hyderabad", "Chennai"]);
    expect(cities).toHaveLength(MAX_LOCATIONS);
  });

  it("does not read a college name as the job location", () => {
    expect(extractLocations("Ex-IIT Delhi, IIM Bangalore alum. Delhi University grad.")).toEqual([]);
    expect(extractLocations("IIT Bombay grads welcome. Role is in Pune.").map((l) => l.city)).toEqual(["Pune"]);
  });

  it("returns nothing when no city is named", () => {
    expect(extractLocations("We are hiring a backend engineer. DM me.")).toEqual([]);
  });
});

describe("extractEmploymentTypes", () => {
  it("only reports types the post states", () => {
    expect(extractEmploymentTypes("Backend Engineer", "Full-time role, Pune")).toEqual(["FULL_TIME"]);
    expect(extractEmploymentTypes("Backend Engineer", "6 month contract role, C2H")).toEqual(["CONTRACTOR"]);
    expect(extractEmploymentTypes("Backend Engineer", "part time, flexible hours")).toEqual(["PART_TIME"]);
    expect(extractEmploymentTypes("Backend Engineer", "We build tools for engineers")).toEqual([]);
  });

  it("reads full-time and part-time even when the next word is glued on", () => {
    expect(extractEmploymentTypes("Data Engineer", "Employment Type: Full-timeWe are looking for a Data Engineer")).toEqual([
      "FULL_TIME",
    ]);
    expect(extractEmploymentTypes("Data Engineer", "FULL TIME, Pune")).toEqual(["FULL_TIME"]);
    expect(extractEmploymentTypes("Data Engineer", "Part-timeRemote")).toEqual(["PART_TIME"]);
    expect(extractEmploymentTypes("Data Engineer", "We value full-timers")).toEqual([]);
  });

  it("marks interns from the title, not from a passing mention", () => {
    expect(extractEmploymentTypes("SDE Intern", "Summer internship")).toEqual(["INTERN"]);
    expect(extractEmploymentTypes("Backend Engineer", "Started as an intern here myself")).toEqual([]);
  });

  it("does not treat smart contracts as a contract role", () => {
    expect(extractEmploymentTypes("Solidity Engineer", "Write and audit smart contracts")).toEqual([]);
  });
});

describe("jobFacts", () => {
  it("reads the title, bullets and post text together", () => {
    const facts = jobFacts(job("Apply via DM", "Backend Engineer - Hyderabad", ["Full time, 3+ years"]));
    expect(facts.locations.map((l) => l.city)).toEqual(["Hyderabad"]);
    expect(facts.employmentTypes).toEqual(["FULL_TIME"]);
    expect(facts.country).toBe("IN");
  });

  it("knows the country for a remote role that only says India", () => {
    const facts = jobFacts(job("Fully remote, anywhere in India"));
    expect(facts.locations).toEqual([]);
    expect(facts.country).toBe("IN");
  });

  it("leaves the country unknown when the post is not only about India", () => {
    expect(jobFacts(job("Remote, worldwide")).country).toBeNull();
    expect(jobFacts(job("Remote within India or the United States")).country).toBeNull();
  });

  it("drops Indian cities when the post points at the US", () => {
    const facts = jobFacts(
      job("Hiring a backend engineer onsite in San Francisco. Our Bangalore team supports infra."),
    );
    expect(facts.locations).toEqual([]);
    expect(facts.country).toBeNull();
  });

  it("does not read lowercase \"us\" as the United States", () => {
    const pune = jobFacts(job("Join us based in Pune"));
    expect(pune.locations.map((l) => l.city)).toEqual(["Pune"]);
    expect(pune.country).toBe("IN");
    expect(jobFacts(job("Remote role in India, open to applicants from India, for us only")).country).toBe("IN");
  });

  it("does not read a bare uppercase US as the job's place", () => {
    for (const text of ["WE'RE HIRING in Bengaluru! DM US", "JOIN US in Bengaluru"]) {
      const facts = jobFacts(job(text));
      expect(facts.locations.map((l) => l.city)).toEqual(["Bengaluru"]);
      expect(facts.country).toBe("IN");
    }
    const pune = jobFacts(job("Backend engineer, onsite Pune, working with US clients / US shift"));
    expect(pune.locations.map((l) => l.city)).toEqual(["Pune"]);
    expect(pune.country).toBe("IN");
  });

  it("does not read US before a noun as the job's place", () => {
    const pune = jobFacts(job("Backend engineer, onsite Pune, working in US shift"));
    expect(pune.locations.map((l) => l.city)).toEqual(["Pune"]);
    expect(pune.country).toBe("IN");
    const blr = jobFacts(job("Bengaluru office; experience in the US market is a plus"));
    expect(blr.locations.map((l) => l.city)).toEqual(["Bengaluru"]);
    expect(blr.country).toBe("IN");
    expect(jobFacts(job("Remote India, overlap in the US time zone")).country).toBe("IN");
  });

  it("treats USA and US location phrasing as a US signal", () => {
    expect(jobFacts(job("Onsite role in the US.")).country).toBeNull();
    const dotted = jobFacts(job("Senior engineer, based in the U.S. Our Bangalore team supports infra."));
    expect(dotted.locations).toEqual([]);
    expect(dotted.country).toBeNull();
    expect(jobFacts(job("Pune or Bangalore, or in the US only")).locations).toEqual([]);
    expect(jobFacts(job("Remote, based in the US")).country).toBeNull();
    expect(jobFacts(job("Bangalore team, role located in the U.S.")).locations).toEqual([]);
    expect(jobFacts(job("Remote in India or the US")).country).toBeNull();
    expect(jobFacts(job("Pune or USA, remote")).locations).toEqual([]);
    expect(jobFacts(job("Bangalore or U.S.A.")).country).toBeNull();
  });
});
