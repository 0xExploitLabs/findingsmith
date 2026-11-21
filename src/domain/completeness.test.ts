import { describe, expect, it } from "vitest";
import { findingGaps, listInWords } from "./completeness";
import { createFinding } from "./factories";

describe("what a finding still needs", () => {
  it("is everything for a blank finding, whose template is only headings", () => {
    expect(findingGaps(createFinding("p", 0))).toEqual(["a title", "a write-up", "a CVSS score"]);
  });

  it("asks for remediation once there is a write-up without one", () => {
    const finding = {
      ...createFinding("p", 0),
      title: "Open redirect",
      cvss: "6.1",
      body: "## Description\n\nThe `next` parameter is not validated.\n\n## Remediation\n\n",
    };
    expect(findingGaps(finding)).toEqual(["remediation"]);
    finding.body += "Allow only relative paths.";
    expect(findingGaps(finding)).toEqual([]);
  });

  it("does not ask an informational finding for a score", () => {
    const finding = { ...createFinding("p", 0), manualSeverity: "Info" as const };
    expect(findingGaps(finding)).not.toContain("a CVSS score");
  });

  it("joins the gaps the way a sentence would", () => {
    expect(listInWords(["a title"])).toBe("a title");
    expect(listInWords(["a title", "a write-up", "a CVSS score"])).toBe(
      "a title, a write-up and a CVSS score",
    );
  });
});
