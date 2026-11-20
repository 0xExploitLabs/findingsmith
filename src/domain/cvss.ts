import * as cvssModule from "ae-cvss-calculator";
import type { CvssVersion, Severity } from "./types";

// The calculator ships as CommonJS. Node's ESM loader exposes it only as a
// default export, while Vite's pre-bundling exposes named exports too, so
// resolve whichever shape arrived.
const lib = ((cvssModule as unknown as { default?: typeof cvssModule }).default ??
  cvssModule) as typeof cvssModule;

type MetricSelection = Record<string, string>;

/** The base metrics of each version, in specification order, with their valid values. */
const METRICS: Record<CvssVersion, { key: string; values: string; optional?: boolean }[]> = {
  "3.1": [
    { key: "AV", values: "NALP" },
    { key: "AC", values: "LH" },
    { key: "PR", values: "NLH" },
    { key: "UI", values: "NR" },
    { key: "S", values: "UC" },
    { key: "C", values: "HLN" },
    { key: "I", values: "HLN" },
    { key: "A", values: "HLN" },
  ],
  "4.0": [
    { key: "AV", values: "NALP" },
    { key: "AC", values: "LH" },
    { key: "AT", values: "NP" },
    { key: "PR", values: "NLH" },
    { key: "UI", values: "NPA" },
    { key: "VC", values: "HLN" },
    { key: "VI", values: "HLN" },
    { key: "VA", values: "HLN" },
    { key: "SC", values: "HLN" },
    { key: "SI", values: "HLN" },
    { key: "SA", values: "HLN" },
    // Exploit Maturity, the one threat metric; optional.
    { key: "E", values: "APU", optional: true },
  ],
};

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
  const defs = METRICS[version];
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
    if (value.length !== 1 || !def.values.includes(value)) {
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
function buildVector(version: CvssVersion, metrics: MetricSelection): string {
  const parts = METRICS[version]
    .filter((d) => metrics[d.key] && metrics[d.key] !== "X")
    .map((d) => `${d.key}:${metrics[d.key]}`);
  return [`CVSS:${version}`, ...parts].join("/");
}

export interface CvssScore {
  /** Null when only a score was given, without a vector. */
  version: CvssVersion | null;
  vector: string | null;
  score: number;
  severity: Severity;
  /** "CVSS 3.1", or the 4.0 nomenclature: CVSS-B for base only, CVSS-BT with threat. */
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

export type CvssInput = { ok: true; cvss: CvssScore } | { ok: false; error: string };

/**
 * Reads what a tester types in the CVSS field: a full vector, scored here, or
 * a bare base score from another tool, such as "5.3".
 */
export function readCvss(input: string): CvssInput {
  const raw = input.trim();
  if (/^\d{1,2}(\.\d)?$/.test(raw)) {
    const score = Number(raw);
    if (score > 10) return { ok: false, error: "A CVSS score is between 0.0 and 10.0." };
    return {
      ok: true,
      cvss: {
        version: null,
        vector: null,
        score,
        severity: severityFromScore(score),
        nomenclature: "CVSS",
      },
    };
  }
  const parsed = parseVector(raw);
  if (!parsed.ok) return parsed;
  const cvss = scoreVector(parsed.vector);
  return cvss ? { ok: true, cvss } : { ok: false, error: "This vector could not be scored." };
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
