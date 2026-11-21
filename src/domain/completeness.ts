import { findSection, splitSections } from "../markdown/sections";
import { cvssOf } from "./severity";
import type { Finding } from "./types";

/**
 * What a finding still lacks before it reads as finished in the report, in
 * words that follow "needs": "a title", "remediation". Empty when complete.
 */
export function findingGaps(
  finding: Pick<Finding, "title" | "body" | "cvss" | "manualSeverity">,
): string[] {
  const sections = splitSections(finding.body);
  return [
    !finding.title.trim() && "a title",
    sections.length === 0 && "a write-up",
    sections.length > 0 &&
      !findSection(sections, /remediat|recommend|fix|mitigat/i) &&
      "remediation",
    !cvssOf(finding) && finding.manualSeverity !== "Info" && "a CVSS score",
  ].filter((gap): gap is string => !!gap);
}

/** "a title, a write-up and a CVSS score". */
export function listInWords(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
