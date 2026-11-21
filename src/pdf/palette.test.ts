import { describe, expect, it } from "vitest";
import { coverPixels, INK, onColor, PAPER } from "./palette";

describe("the report's colours", () => {
  it("sets white on a dark accent and ink on a light one", () => {
    expect(onColor("#036877")).toBe(PAPER);
    expect(onColor("#24292F")).toBe(PAPER);
    expect(onColor("#FFD84D")).toBe(INK);
    expect(onColor("#FFFFFF")).toBe(INK);
  });

  it("breaks the cover's edge into the same pixels every time, thinning downwards", () => {
    const rows = coverPixels(34, 4);
    expect(rows).toEqual(coverPixels(34, 4));
    const inked = rows.map((row) => row.filter(Boolean).length);
    expect(inked[0]).toBeGreaterThan(inked[1] ?? 0);
    expect(inked[1]).toBeGreaterThan(inked[3] ?? 0);
    expect(inked[0]).toBeLessThan(34);
  });
});
