import { describe, expect, it } from "vitest";
import { parseVector, readCvss, scoreVector, severityFromScore } from "./cvss";
import { rate } from "./severity";

describe("CVSS 3.1 scores match the FIRST calculator", () => {
  const cases: [string, number, string][] = [
    ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", 9.8, "Critical"],
    ["CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H", 8.8, "High"],
    ["CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N", 6.1, "Medium"],
    ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N", 5.3, "Medium"],
    ["CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N", 4.3, "Medium"],
    ["CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N", 3.7, "Low"],
    ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H", 10, "Critical"],
    ["CVSS:3.1/AV:P/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N", 1.6, "Low"],
    ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N", 0, "Info"],
  ];
  for (const [vector, score, severity] of cases) {
    it(vector, () => {
      const result = scoreVector(vector);
      expect(result?.score).toBe(score);
      expect(result?.severity).toBe(severity);
    });
  }
});

// 9.3, 8.1 and 0.0 are read from FIRST's reference lookup table
// (cvss_lookup.js, macrovectors 000200 and 000220); those vectors sit at the
// top of their macrovector, so the score is the table value itself.
describe("CVSS 4.0 scores match the FIRST calculator", () => {
  const cases: [string, number][] = [
    ["CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N", 9.3],
    ["CVSS:4.0/AV:L/AC:L/AT:N/PR:L/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N", 8.5],
    ["CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:N/SC:N/SI:N/SA:N", 0],
    ["CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N/E:U", 8.1],
  ];
  for (const [vector, score] of cases) {
    it(vector, () => expect(scoreVector(vector)?.score).toBe(score));
  }
  it("names the score by the metrics used", () => {
    expect(scoreVector(cases[0]?.[0] ?? "")?.nomenclature).toBe("CVSS-B 4.0");
    expect(scoreVector(cases[3]?.[0] ?? "")?.nomenclature).toBe("CVSS-BT 4.0");
  });
});

describe("the rating scale", () => {
  it.each([
    [0, "Info"],
    [0.1, "Low"],
    [3.9, "Low"],
    [4.0, "Medium"],
    [5.3, "Medium"],
    [6.9, "Medium"],
    [7.0, "High"],
    [8.9, "High"],
    [9.0, "Critical"],
    [10, "Critical"],
  ])("%s is %s", (score, severity) => expect(severityFromScore(score)).toBe(severity));
});

describe("the strict parser", () => {
  it("rejects malformed vectors the library would silently accept", () => {
    expect(parseVector("CVSS:3.1/AV:X").ok).toBe(false);
    expect(parseVector("AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H").ok).toBe(false);
    expect(parseVector("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H").ok).toBe(false);
    expect(parseVector("CVSS:3.1/AV:N/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H").ok).toBe(false);
    expect(parseVector("CVSS:3.1/AV:Q/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H").ok).toBe(false);
    expect(parseVector("CVSS:2.0/AV:N").ok).toBe(false);
  });
  it("canonicalises metric order", () => {
    const parsed = parseVector("CVSS:3.1/C:H/I:H/A:H/AV:N/AC:L/PR:N/UI:N/S:U");
    expect(parsed.ok && parsed.vector).toBe("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H");
  });
  it("drops an unset optional threat metric", () => {
    const parsed = parseVector(
      "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N/E:X",
    );
    expect(parsed.ok && parsed.vector).toBe(
      "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
    );
  });
});

describe("the CVSS field", () => {
  it("accepts a bare base score", () => {
    const read = readCvss(" 5.3 ");
    expect(read.ok && read.cvss.severity).toBe("Medium");
    expect(read.ok && read.cvss.vector).toBe(null);
  });
  it("rejects scores outside 0.0 to 10.0 and stray text", () => {
    expect(readCvss("10.5").ok).toBe(false);
    expect(readCvss("5.33").ok).toBe(false);
    expect(readCvss("high").ok).toBe(false);
  });
  it("scores a vector", () => {
    const read = readCvss("CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N");
    expect(read.ok && read.cvss.score).toBe(6.5);
  });
});

describe("severity follows the score", () => {
  const base = { manualSeverity: "Low" as const, override: null };
  it("a 5.3 vector is Medium even when the manual choice says Low", () => {
    const r = rate({ ...base, cvss: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N" });
    expect(r.severity).toBe("Medium");
    expect(r.source).toBe("cvss");
  });
  it("an override is used and keeps the CVSS rating for the report", () => {
    const r = rate({
      manualSeverity: "Low",
      override: { severity: "Low", reason: "Internal only" },
      cvss: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",
    });
    expect(r.severity).toBe("Low");
    expect(r.source).toBe("override");
    expect(r.cvssSeverity).toBe("Medium");
  });
  it("a bare score of 5.3 is Medium too", () => {
    expect(rate({ ...base, cvss: "5.3" }).severity).toBe("Medium");
  });
  it("without a score the manual severity stands", () => {
    expect(rate({ ...base, cvss: "" }).severity).toBe("Low");
    expect(rate({ ...base, cvss: "not a vector" }).severity).toBe("Low");
  });
});
