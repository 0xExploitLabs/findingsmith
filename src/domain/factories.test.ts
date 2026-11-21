import { describe, expect, it } from "vitest";
import { createFinding, normalizeFinding } from "./factories";

describe("the properties a finding shows", () => {
  it("start as CVSS, endpoint, host and CWE", () => {
    expect(createFinding("p", 0).properties).toEqual(["cvss", "endpoint", "host", "cwe"]);
  });

  it("are kept as saved, removed ones included", () => {
    const saved = { ...createFinding("p", 0), properties: ["host" as const] };
    expect(normalizeFinding(saved).properties).toEqual(["host"]);
  });

  it("for a finding saved before they could be removed, are the starting ones and any with a value", () => {
    const { properties: _, ...old } = { ...createFinding("p", 0), port: "8443", method: "GET" };
    expect(normalizeFinding(old).properties).toEqual(["cvss", "endpoint", "host", "port", "cwe"]);
  });
});
