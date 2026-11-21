import { type Finding, PROPERTIES, type Project, type PropertyKey } from "./types";

/** The properties a new finding starts with: nearly every finding states these. */
export const STARTING_PROPERTIES: PropertyKey[] = ["cvss", "endpoint", "host", "cwe"];

/** Whether a finding has a value for a property. */
export function hasProperty(finding: Finding, key: PropertyKey): boolean {
  if (key === "endpoint") return !!(finding.endpoint.trim() || finding.method);
  return !!finding[key].trim();
}

export function newId(): string {
  return crypto.randomUUID();
}

export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The starting document for a project: the sections every report needs. The
 * summary is left empty, with a prompt in the editor, so that the report never
 * prints a placeholder as if it had been written.
 */
export const PROJECT_TEMPLATE = `## Executive summary



## Scope

| Target | Notes |
| --- | --- |
| https://app.example.com | Production web application |

Out of scope: third-party services.

## Methodology

Testing followed the OWASP Web Security Testing Guide, using manual techniques supported by automated tools.
`;

/** The starting document for a blank finding. */
export const FINDING_TEMPLATE = `## Description



## Impact



## Steps to reproduce

1.

## Remediation



## References

`;

export function createProject(name: string): Project {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name,
    client: "",
    preparedBy: "",
    assessors: "",
    startDate: "",
    endDate: "",
    reportDate: today(),
    classification: "Confidential",
    idPrefix: "F",
    accent: "#036877",
    logoAssetId: null,
    body: PROJECT_TEMPLATE,
    createdAt: now,
    updatedAt: now,
  };
}

export function createFinding(projectId: string, order: number): Finding {
  const now = new Date().toISOString();
  return {
    id: newId(),
    projectId,
    order,
    title: "",
    status: "Open",
    cvss: "",
    manualSeverity: "Medium",
    override: null,
    cwe: "",
    cve: "",
    method: "",
    endpoint: "",
    parameter: "",
    host: "",
    port: "",
    affected: "",
    properties: [...STARTING_PROPERTIES],
    body: FINDING_TEMPLATE,
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

/** Fills in any field a stored or imported record lacks with its default. */
export function normalizeProject(raw: Partial<Project> & { id: string; name: string }): Project {
  return { ...createProject(raw.name), ...raw };
}

export function normalizeFinding(
  raw: Partial<Finding> & { id: string; projectId: string },
): Finding {
  const finding = { ...createFinding(raw.projectId, raw.order ?? 0), ...raw };
  if (raw.properties) return finding;
  // Saved before properties could be removed: it showed the starting ones and
  // whichever others had a value.
  return {
    ...finding,
    properties: PROPERTIES.filter(
      (key) => STARTING_PROPERTIES.includes(key) || hasProperty(finding, key),
    ),
  };
}
