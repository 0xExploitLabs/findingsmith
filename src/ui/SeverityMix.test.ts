import { describe, expect, it } from "vitest";
import { type SeverityCounts, shareCells } from "./SeverityMix";

const counts = (c: Partial<SeverityCounts>): SeverityCounts => ({
  Critical: 0,
  High: 0,
  Medium: 0,
  Low: 0,
  Info: 0,
  ...c,
});

describe("the severity meter's pixels", () => {
  it("are shared in proportion and always add up to the row", () => {
    expect(shareCells(counts({ Critical: 1, High: 1, Medium: 3 }), 20)).toEqual(
      counts({ Critical: 4, High: 4, Medium: 12 }),
    );
    const uneven = shareCells(counts({ Critical: 1, Medium: 1, Low: 1 }), 20);
    expect(Object.values(uneven).reduce((a, b) => a + b, 0)).toBe(20);
  });

  it("keep one for a severity that would round away", () => {
    const share = shareCells(counts({ Critical: 1, Low: 60 }), 24);
    expect(share.Critical).toBe(1);
    expect(share.Low).toBe(23);
  });

  it("are all one colour for a single severity, and none for no findings", () => {
    expect(shareCells(counts({ Medium: 2 }), 18).Medium).toBe(18);
    expect(shareCells(counts({}), 18)).toEqual(counts({}));
  });
});
