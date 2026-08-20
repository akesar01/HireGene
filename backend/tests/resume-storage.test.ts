import { describe, expect, it } from "vitest";
import { isPdfBuffer, sanitizeResumeFileName } from "../src/lib/resume-storage";

describe("isPdfBuffer", () => {
  it("accepts a real PDF header", () => {
    expect(isPdfBuffer(Buffer.from("%PDF-1.7\n%", "utf8"))).toBe(true);
  });

  it("rejects empty or non-pdf bytes", () => {
    expect(isPdfBuffer(Buffer.from(""))).toBe(false);
    expect(isPdfBuffer(Buffer.from("hello resume"))).toBe(false);
  });
});

describe("sanitizeResumeFileName", () => {
  it("keeps a simple pdf name", () => {
    expect(sanitizeResumeFileName("Ankit_Resume.pdf")).toBe("Ankit_Resume.pdf");
  });

  it("uses only the basename and strips unsafe characters", () => {
    expect(sanitizeResumeFileName("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(sanitizeResumeFileName("My Resume (2026).pdf")).toBe("My_Resume__2026_.pdf");
  });

  it("falls back when the name is not a pdf", () => {
    expect(sanitizeResumeFileName("notes.txt")).toBe("resume.pdf");
  });
});
