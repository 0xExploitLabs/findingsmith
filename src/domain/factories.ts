import type { Finding, Project } from "./types";

export function newId(): string {
  return crypto.randomUUID();
}

export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The starting document for a project: the sections every report needs. */
export const PROJECT_TEMPLATE = `## Executive summary

Summarise what was tested, the overall security posture and the most important actions, for a non-technical reader.

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
    version: "1.0",
    classification: "Confidential",
    idPrefix: "F",
    accent: "#036877",
    logoAssetId: null,
    defaultCvssVersion: "3.1",
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
    cvssVector: "",
    manualSeverity: "Medium",
    override: null,
    cwe: "",
    cve: "",
    affected: "",
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
  return { ...createFinding(raw.projectId, raw.order ?? 0), ...raw };
}
