import { describe, expect, it } from "vitest";
import { splitSections } from "./sections";

describe("splitSections", () => {
  it("splits at level-2 headings and keeps deeper headings inside", () => {
    const doc =
      "Intro text.\n\n## Description\n\nIt breaks.\n\n### Detail\n\nMore.\n\n## Remediation\n\n- Fix it\n";
    expect(splitSections(doc)).toEqual([
      { title: "", markdown: "Intro text." },
      { title: "Description", markdown: "It breaks.\n\n### Detail\n\nMore." },
      { title: "Remediation", markdown: "- Fix it" },
    ]);
  });
  it("ignores headings inside fenced code", () => {
    const doc = "## Steps\n\n```md\n## not a heading\n```\n";
    expect(splitSections(doc)).toHaveLength(1);
  });
  it("drops empty sections from the template", () => {
    expect(splitSections("## Description\n\n\n\n## Impact\n\nReal impact.\n")).toEqual([
      { title: "Impact", markdown: "Real impact." },
    ]);
  });
  it("uses the heading's text, not its markup", () => {
    expect(splitSections("## **Bold** `title`\n\nx")[0]?.title).toBe("Bold title");
  });
});
