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

  it("still treats uppercase US / USA as a US signal", () => {
    expect(jobFacts(job("Remote in India or the US")).country).toBeNull();
    expect(jobFacts(job("Pune or USA, remote")).locations).toEqual([]);
    expect(jobFacts(job("Bangalore or U.S.A.")).country).toBeNull();
  });
});
