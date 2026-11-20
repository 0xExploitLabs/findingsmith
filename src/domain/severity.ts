import { type CvssScore, readCvss } from "./cvss";
import { type Finding, SEVERITIES, type Severity } from "./types";

export type SeveritySource = "cvss" | "override" | "manual";

export interface Rating {
  /** The severity the report uses. */
  severity: Severity;
  source: SeveritySource;
  cvss: CvssScore | null;
  /** The CVSS-derived severity when an override replaces it. */
  cvssSeverity: Severity | null;
}

/** The finding's CVSS score, or null when the field is empty or not valid. */
export function cvssOf(finding: Pick<Finding, "cvss">): CvssScore | null {
  if (!finding.cvss.trim()) return null;
  const read = readCvss(finding.cvss);
  return read.ok ? read.cvss : null;
}

/**
 * One rule decides a finding's severity, everywhere it is shown:
 * a valid CVSS score decides it, unless the tester has recorded an override
 * with a reason; without a score, the tester's own choice stands.
 */
export function rate(finding: Pick<Finding, "cvss" | "manualSeverity" | "override">): Rating {
  const cvss = cvssOf(finding);
  if (cvss) {
    if (finding.override && finding.override.severity !== cvss.severity) {
      return {
        severity: finding.override.severity,
        source: "override",
        cvss,
        cvssSeverity: cvss.severity,
      };
    }
    return { severity: cvss.severity, source: "cvss", cvss, cvssSeverity: cvss.severity };
  }
  return { severity: finding.manualSeverity, source: "manual", cvss: null, cvssSeverity: null };
}

export function severityRank(severity: Severity): number {
  return SEVERITIES.indexOf(severity);
}

/** Highest severity first, then highest CVSS score, then manual order. */
export function compareFindings(a: Finding, b: Finding): number {
  const ra = rate(a);
  const rb = rate(b);
  const bySeverity = severityRank(ra.severity) - severityRank(rb.severity);
  if (bySeverity !== 0) return bySeverity;
  const byScore = (rb.cvss?.score ?? -1) - (ra.cvss?.score ?? -1);
  if (byScore !== 0) return byScore;
  return a.order - b.order;
}

/** Report colours, chosen to read on white paper and to stay distinct in greyscale. */
export const SEVERITY_HEX: Record<Severity, string> = {
  Critical: "#B4232A",
  High: "#D4561C",
  Medium: "#C98A04",
  Low: "#2D7D9A",
  Info: "#6B7780",
};
