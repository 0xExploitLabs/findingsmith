import * as cvssModule from "ae-cvss-calculator";
import type { CvssVersion, Severity } from "./types";

// The calculator ships as CommonJS. Node's ESM loader exposes it only as a
// default export, while Vite's pre-bundling exposes named exports too, so
// resolve whichever shape arrived.
const lib = ((cvssModule as unknown as { default?: typeof cvssModule }).default ??
  cvssModule) as typeof cvssModule;

export interface MetricValue {
  code: string;
  label: string;
  help: string;
}

export interface MetricDef {
  key: string;
  label: string;
  help: string;
  group: string;
  values: MetricValue[];
  /** Optional metrics may be left out of the vector (CVSS 4.0 threat metric). */
  optional?: boolean;
}

const HLN = (subject: string, system: string): MetricValue[] => [
  { code: "H", label: "High", help: `Total loss of ${subject} of the ${system}.` },
  { code: "L", label: "Low", help: `Some loss of ${subject}; the attacker has limited control.` },
  { code: "N", label: "None", help: `No loss of ${subject}.` },
];

export const CVSS31_METRICS: MetricDef[] = [
  {
    key: "AV",
    label: "Attack Vector",
    group: "Exploitability",
    help: "How remote the attacker can be.",
    values: [
      { code: "N", label: "Network", help: "Exploitable remotely, across the internet." },
      { code: "A", label: "Adjacent", help: "Needs the same local network or link." },
      { code: "L", label: "Local", help: "Needs local access or a user to open a file." },
      { code: "P", label: "Physical", help: "Needs physical access to the device." },
    ],
  },
  {
    key: "AC",
    label: "Attack Complexity",
    group: "Exploitability",
    help: "Conditions beyond the attacker's control that must exist.",
    values: [
      { code: "L", label: "Low", help: "Repeatable success, no special conditions." },
      {
        code: "H",
        label: "High",
        help: "Depends on conditions such as a race or a MITM position.",
      },
    ],
  },
  {
    key: "PR",
    label: "Privileges Required",
    group: "Exploitability",
    help: "Privileges the attacker needs before attacking.",
    values: [
      { code: "N", label: "None", help: "Unauthenticated." },
      { code: "L", label: "Low", help: "A normal user account." },
      { code: "H", label: "High", help: "An administrative account." },
    ],
  },
  {
    key: "UI",
    label: "User Interaction",
    group: "Exploitability",
    help: "Whether a victim other than the attacker must act.",
    values: [
      { code: "N", label: "None", help: "No victim action needed." },
      { code: "R", label: "Required", help: "A victim must click, open or visit something." },
    ],
  },
  {
    key: "S",
    label: "Scope",
    group: "Exploitability",
    help: "Whether impact reaches beyond the vulnerable component's security authority.",
    values: [
      { code: "U", label: "Unchanged", help: "Impact stays within the vulnerable component." },
      {
        code: "C",
        label: "Changed",
        help: "Impact reaches other components, such as a victim's browser.",
      },
    ],
  },
  {
    key: "C",
    label: "Confidentiality",
    group: "Impact",
    help: "Impact on the confidentiality of information.",
    values: HLN("confidentiality", "information"),
  },
  {
    key: "I",
    label: "Integrity",
    group: "Impact",
    help: "Impact on the trustworthiness of information.",
    values: HLN("integrity", "information"),
  },
  {
    key: "A",
    label: "Availability",
    group: "Impact",
    help: "Impact on the availability of the component.",
    values: HLN("availability", "component"),
  },
];

export const CVSS40_METRICS: MetricDef[] = [
  {
    key: "AV",
    label: "Attack Vector",
    group: "Exploitability",
    help: "How remote the attacker can be.",
    values: [
      { code: "N", label: "Network", help: "Exploitable remotely, across the internet." },
      { code: "A", label: "Adjacent", help: "Needs the same local network or link." },
      { code: "L", label: "Local", help: "Needs local access or a user to open a file." },
      { code: "P", label: "Physical", help: "Needs physical access to the device." },
    ],
  },
  {
    key: "AC",
    label: "Attack Complexity",
    group: "Exploitability",
    help: "Security measures the attacker must evade, such as ASLR or DEP.",
    values: [
      { code: "L", label: "Low", help: "No target-specific evasion needed." },
      { code: "H", label: "High", help: "Must evade or bypass active defences." },
    ],
  },
  {
    key: "AT",
    label: "Attack Requirements",
    group: "Exploitability",
    help: "Deployment conditions the attack depends on.",
    values: [
      { code: "N", label: "None", help: "Works against any instance." },
      {
        code: "P",
        label: "Present",
        help: "Needs a race win, a specific configuration or a MITM position.",
      },
    ],
  },
  {
    key: "PR",
    label: "Privileges Required",
    group: "Exploitability",
    help: "Privileges the attacker needs before attacking.",
    values: [
      { code: "N", label: "None", help: "Unauthenticated." },
      { code: "L", label: "Low", help: "A normal user account." },
      { code: "H", label: "High", help: "An administrative account." },
    ],
  },
  {
    key: "UI",
    label: "User Interaction",
    group: "Exploitability",
    help: "Whether a human user other than the attacker must take part.",
    values: [
      { code: "N", label: "None", help: "No user involvement." },
      {
        code: "P",
        label: "Passive",
        help: "Limited, involuntary interaction such as viewing a page.",
      },
      {
        code: "A",
        label: "Active",
        help: "Conscious action such as clicking a link or dismissing a warning.",
      },
    ],
  },
  {
    key: "VC",
    label: "Confidentiality",
    group: "Vulnerable system impact",
    help: "Confidentiality impact on the vulnerable system.",
    values: HLN("confidentiality", "vulnerable system"),
  },
  {
    key: "VI",
    label: "Integrity",
    group: "Vulnerable system impact",
    help: "Integrity impact on the vulnerable system.",
    values: HLN("integrity", "vulnerable system"),
  },
  {
    key: "VA",
    label: "Availability",
    group: "Vulnerable system impact",
    help: "Availability impact on the vulnerable system.",
    values: HLN("availability", "vulnerable system"),
  },
  {
    key: "SC",
    label: "Confidentiality",
    group: "Subsequent system impact",
    help: "Confidentiality impact on systems beyond the vulnerable one.",
    values: HLN("confidentiality", "subsequent systems"),
  },
  {
    key: "SI",
    label: "Integrity",
    group: "Subsequent system impact",
    help: "Integrity impact on systems beyond the vulnerable one.",
    values: HLN("integrity", "subsequent systems"),
  },
  {
    key: "SA",
    label: "Availability",
    group: "Subsequent system impact",
    help: "Availability impact on systems beyond the vulnerable one.",
    values: HLN("availability", "subsequent systems"),
  },
  {
    key: "E",
    label: "Exploit Maturity",
    group: "Threat (optional)",
    help: "Likelihood of attack, from public exploit availability. Leave unset for a base score.",
    optional: true,
    values: [
      { code: "A", label: "Attacked", help: "Attacks or easy-to-use exploit code are public." },
      { code: "P", label: "POC", help: "Proof-of-concept code is public." },
      { code: "U", label: "Unreported", help: "No public proof of concept or attacks known." },
    ],
  },
];

export function metricsFor(version: CvssVersion): MetricDef[] {
  return version === "3.1" ? CVSS31_METRICS : CVSS40_METRICS;
}

export type MetricSelection = Record<string, string>;

export const DEFAULT_SELECTION: Record<CvssVersion, MetricSelection> = {
  "3.1": { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "N", I: "N", A: "N" },
  "4.0": {
    AV: "N",
    AC: "L",
    AT: "N",
    PR: "N",
    UI: "N",
    VC: "N",
    VI: "N",
    VA: "N",
    SC: "N",
    SI: "N",
    SA: "N",
  },
};

/**
 * A starting point for a CVSS 4.0 vector from a 3.1 one. The metrics that
 * exist in both carry over; 3.1's single impact triple becomes the vulnerable
 * system's impact, and only a changed scope also fills the subsequent system.
 * User interaction "Required" maps to "Active", the conservative reading.
 * The assessor still reviews the result: the versions measure different things.
 */
export function carryOver31to40(m: MetricSelection): MetricSelection {
  const changed = m.S === "C";
  return {
    AV: m.AV ?? "N",
    AC: m.AC ?? "L",
    AT: "N",
    PR: m.PR ?? "N",
    UI: m.UI === "R" ? "A" : "N",
    VC: m.C ?? "N",
    VI: m.I ?? "N",
    VA: m.A ?? "N",
    SC: changed ? (m.C ?? "N") : "N",
    SI: changed ? (m.I ?? "N") : "N",
    SA: changed ? (m.A ?? "N") : "N",
  };
}

export type ParseResult =
  | { ok: true; version: CvssVersion; metrics: MetricSelection; vector: string }
  | { ok: false; error: string };

/**
 * Strict parser. The scoring library accepts malformed vectors silently and
 * scores them as if the missing metrics were absent, so every vector is
 * validated here before it reaches it: the prefix, every mandatory base
 * metric exactly once, and only values the specification defines.
 */
export function parseVector(input: string): ParseResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Empty vector." };
  const parts = raw.split("/");
  const head = parts.shift() ?? "";
  const prefix = /^CVSS:(3\.1|4\.0)$/.exec(head);
  if (!prefix) {
    return {
      ok: false,
      error: 'The vector must start with "CVSS:3.1/" or "CVSS:4.0/".',
    };
  }
  const version = prefix[1] as CvssVersion;
  const defs = metricsFor(version);
  const metrics: MetricSelection = {};
  for (const part of parts) {
    const [key, value, extra] = part.split(":");
    if (!key || value === undefined || extra !== undefined) {
      return { ok: false, error: `"${part}" is not a metric:value pair.` };
    }
    const def = defs.find((d) => d.key === key);
    if (!def) {
      return {
        ok: false,
        error: `"${key}" is not a supported CVSS ${version} base metric.`,
      };
    }
    if (key in metrics) return { ok: false, error: `"${key}" appears twice.` };
    if (def.optional && value === "X") continue;
    if (!def.values.some((v) => v.code === value)) {
      return { ok: false, error: `"${value}" is not a valid value for ${key}.` };
    }
    metrics[key] = value;
  }
  const missing = defs.filter((d) => !d.optional && !(d.key in metrics)).map((d) => d.key);
  if (missing.length > 0) {
    return { ok: false, error: `Missing ${missing.join(", ")}.` };
  }
  return { ok: true, version, metrics, vector: buildVector(version, metrics) };
}

/** Builds the canonical vector, metrics in specification order. */
export function buildVector(version: CvssVersion, metrics: MetricSelection): string {
  const parts = metricsFor(version)
    .filter((d) => metrics[d.key] && metrics[d.key] !== "X")
    .map((d) => `${d.key}:${metrics[d.key]}`);
  return [`CVSS:${version}`, ...parts].join("/");
}

export interface CvssScore {
  version: CvssVersion;
  vector: string;
  score: number;
  severity: Severity;
  /** The CVSS 4.0 nomenclature: CVSS-B for base only, CVSS-BT with threat. */
  nomenclature: string;
}

export function scoreVector(vector: string): CvssScore | null {
  const parsed = parseVector(vector);
  if (!parsed.ok) return null;
  let score: number;
  if (parsed.version === "3.1") {
    const result = new lib.Cvss3P1(parsed.vector).calculateScores();
    score = result.base ?? result.overall;
  } else {
    score = new lib.Cvss4P0(parsed.vector).calculateScores().overall;
  }
  const nomenclature =
    parsed.version === "3.1" ? "CVSS 3.1" : parsed.metrics.E ? "CVSS-BT 4.0" : "CVSS-B 4.0";
  return {
    version: parsed.version,
    vector: parsed.vector,
    score: Math.round(score * 10) / 10,
    severity: severityFromScore(score),
    nomenclature,
  };
}

/**
 * The qualitative rating scale from the CVSS 3.1 and 4.0 specifications.
 * A score of 0.0 is "None", which the report shows as Info.
 */
export function severityFromScore(score: number): Severity {
  if (score >= 9.0) return "Critical";
  if (score >= 7.0) return "High";
  if (score >= 4.0) return "Medium";
  if (score >= 0.1) return "Low";
  return "Info";
}

export const RATING_SCALE: { severity: Severity; range: string }[] = [
  { severity: "Critical", range: "9.0 - 10.0" },
  { severity: "High", range: "7.0 - 8.9" },
  { severity: "Medium", range: "4.0 - 6.9" },
  { severity: "Low", range: "0.1 - 3.9" },
  { severity: "Info", range: "0.0 (None)" },
];

export function formatScore(score: number): string {
  return score.toFixed(1);
}
