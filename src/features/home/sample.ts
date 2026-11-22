import type { Severity } from "../../domain/types";
import type { ContentsEntry, ReportParties } from "./ReportSheet";

/* The report the overview shows as printed pages: its cover, its contents and one finding. */
export const SAMPLE_PARTIES: ReportParties = {
  client: "Northwind Traders",
  name: "External web application test",
  preparedBy: "Kestrel Security",
  classification: "Confidential",
};
/** The colour a new project's report starts with. */
export const SAMPLE_ACCENT = "#036877";
export const SAMPLE_COUNTS: Partial<Record<Severity, number>> = {
  Critical: 1,
  High: 2,
  Medium: 3,
  Low: 1,
};
export const SAMPLE_PARTICULARS: [string, string][] = [
  ["Prepared for", "Northwind Traders"],
  ["Prepared by", "Kestrel Security"],
  ["Assessors", "R. Okafor, M. Lindqvist"],
  ["Assessment period", "2 to 13 March 2026"],
  ["Report date", "20 March 2026"],
];
export const SAMPLE_CONTENTS: ContentsEntry[] = [
  { num: "1", label: "Executive summary", page: 3 },
  { num: "2", label: "Scope and methodology", page: 4 },
  { num: "3", label: "Findings overview", page: 5 },
  { num: "4", label: "Detailed findings", page: 6 },
  { num: "F-01", label: "SQL injection in the login form", page: 6, finding: true },
  { num: "F-02", label: "Stored cross-site scripting in order notes", page: 7, finding: true },
  { num: "F-03", label: "Password reset tokens never expire", page: 8, finding: true },
  { num: "F-04", label: "Invoices of other customers can be read", page: 9, finding: true },
  { num: "F-05", label: "Session cookie set without the Secure flag", page: 9, finding: true },
  { num: "F-06", label: "No rate limit on the login form", page: 10, finding: true },
  { num: "F-07", label: "Server version shown in response headers", page: 10, finding: true },
  { num: "5", label: "Conclusion", page: 11 },
  { num: "A", label: "Appendix A. Severity rating", page: 12 },
];

/* The finding. */
export const SAMPLE_TITLE = "SQL injection in the login form";
export const SAMPLE_VECTOR = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H";
export const SAMPLE_ENDPOINT = { method: "POST", url: "https://app.example.com/login" };
export const SAMPLE_PARAMETER = "username";
export const SAMPLE_WEAKNESS = "CWE-89";
export const SAMPLE_BODY = `## Description

The login form builds its SQL query by joining user input into the query text, so anything typed into \`username\` runs as SQL. No account is needed to reach it.

## Steps to reproduce

1. Open the login page.
2. Enter \`admin'--\` as the username, and any password.
3. Submit the form. The response is the admin dashboard.

## Evidence

\`\`\`http
POST /login HTTP/1.1
Host: app.example.com
Content-Type: application/x-www-form-urlencoded

username=admin'--&password=x
\`\`\`

The server answers \`302 Found\` and sets a session cookie for the \`admin\` account.

## Impact

Anyone on the internet can sign in as any user, read and change every record in the database, and take over the administrator account.

## Remediation

Use **parameterised queries** for every database call, and never build SQL from request data. Give the application's database user only the rights it needs.
`;
