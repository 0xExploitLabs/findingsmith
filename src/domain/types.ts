/** The qualitative severity scale shared by CVSS 3.1 and 4.0, highest first. */
export const SEVERITIES = ["Critical", "High", "Medium", "Low", "Info"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const STATUSES = ["Open", "Partially fixed", "Fixed", "Risk accepted"] as const;
export type FindingStatus = (typeof STATUSES)[number];

export const CLASSIFICATIONS = ["Confidential", "Restricted", "Internal", "Public"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export type CvssVersion = "3.1" | "4.0";

export interface Project {
  id: string;
  name: string;
  client: string;
  /** Who wrote the report: a person, a team or a company. */
  preparedBy: string;
  assessors: string;
  startDate: string;
  endDate: string;
  reportDate: string;
  version: string;
  classification: Classification;
  /** Prefix for finding IDs in the report, for example "F" gives F-01. */
  idPrefix: string;
  /** Hex colour used for the report's headings and rules. */
  accent: string;
  /** Asset id of an optional logo shown on the cover. */
  logoAssetId: string | null;
  defaultCvssVersion: CvssVersion;
  /**
   * The report's own text as one Markdown document. Each `## Heading` becomes a
   * numbered section placed before the findings: summary, scope, methodology.
   */
  body: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * When a tester rates a finding differently from its CVSS base score, for
 * example because of environmental context, the report states both and says why.
 */
export interface SeverityOverride {
  severity: Severity;
  reason: string;
}

export interface Finding {
  id: string;
  projectId: string;
  /** Position in the sidebar when sorted manually. */
  order: number;
  title: string;
  status: FindingStatus;
  /** A full CVSS vector string ("CVSS:3.1/..." or "CVSS:4.0/..."), or "" when unscored. */
  cvssVector: string;
  /** Used only when the finding has no CVSS vector. */
  manualSeverity: Severity;
  override: SeverityOverride | null;
  cwe: string;
  cve: string;
  /** One affected host, URL or component per line. */
  affected: string;
  /**
   * The write-up as one Markdown document. Each `## Heading` (Description,
   * Impact, Steps to reproduce, Remediation...) becomes a section in the report.
   */
  body: string;
  /** Private notes. Never exported to the report. */
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** Images pasted or uploaded into a report, referenced from Markdown as `asset:<id>`. */
export interface Asset {
  id: string;
  projectId: string;
  name: string;
  type: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: string;
}
