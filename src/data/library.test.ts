import { describe, expect, it } from "vitest";
import { parseVector } from "../domain/cvss";
import { LIBRARY, LIBRARY_CATEGORIES } from "./library";

describe("finding library", () => {
  it("has unique ids", () => {
    expect(new Set(LIBRARY.map((e) => e.id)).size).toBe(LIBRARY.length);
  });
  it.each(LIBRARY.map((e) => [e.id, e] as const))("%s has a valid, canonical vector", (_, e) => {
    const parsed = parseVector(e.vector);
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.vector).toBe(e.vector);
    expect(LIBRARY_CATEGORIES).toContain(e.category);
    expect(e.description.length).toBeGreaterThan(40);
    expect(e.remediation.length).toBeGreaterThan(20);
  });
});
