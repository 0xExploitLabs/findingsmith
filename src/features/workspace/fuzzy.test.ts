import { describe, expect, it } from "vitest";
import { fuzzyFilter, fuzzyScore } from "./fuzzy";

/** The findings of the report where search listed the wrong ones, with their references. */
const FINDINGS = [
  "Unauthenticated Bull Board Queue Dashboard Exposure F-02",
  "X-Forwarded-Host reflected in canonical/hreflang Link headers F-03",
  "Verbose Stack Traces Disclose Internal Source Paths and Code F-04",
  "Server-Side Request Forgery (SSRF) via createPlaylist/getPlaylist F-05",
  "Unauthenticated Device Provisioning via GraphQL Mutation (generateDevice) F-06",
];

const search = (query: string) => fuzzyFilter(FINDINGS, query, (t) => t);

describe("fuzzy search", () => {
  it("lists only what the query names, not text that happens to hold its letters", () => {
    expect(search("ssrf")).toEqual([FINDINGS[3]]);
  });

  it("finds words by their initials", () => {
    expect(search("srf")).toEqual([FINDINGS[3]]);
    expect(search("bbq")).toEqual([FINDINGS[0]]);
    expect(search("xfh")).toEqual([FINDINGS[1]]);
  });

  it("finds words by their starts, across punctuation and camelCase", () => {
    expect(search("server side")[0]).toBe(FINDINGS[3]);
    expect(search("xforw")).toEqual([FINDINGS[1]]);
    expect(search("gen dev")).toEqual([FINDINGS[4]]);
    expect(search("create play")).toEqual([FINDINGS[3]]);
  });

  it("finds a reference however it is typed", () => {
    expect(search("f05")).toEqual([FINDINGS[3]]);
    expect(search("F-05")).toEqual([FINDINGS[3]]);
  });

  it("forgives one slip in a longer word", () => {
    expect(search("forgrey")).toEqual([FINDINGS[3]]);
    expect(search("unauthenticted")).toEqual([FINDINGS[0], FINDINGS[4]]);
    expect(search("dashbaord")).toEqual([FINDINGS[0]]);
  });

  it("needs every word of the query", () => {
    expect(search("unauthenticated graphql")).toEqual([FINDINGS[4]]);
    expect(search("unauthenticated ssrf")).toEqual([]);
  });

  it("ranks a whole word above initials, and initials above a slip", () => {
    const items = ["Stored XSS in profile", "Some sort of Session flaw", "Session fixation"];
    // "session" is written out in two, by initials in none.
    expect(fuzzyFilter(items, "session", (t) => t)).toEqual([items[2], items[1]]);
    const shorthand = ["Cross-site request forgery", "CSRF token reuse"];
    expect(fuzzyFilter(shorthand, "csrf", (t) => t)).toEqual([shorthand[1], shorthand[0]]);
  });

  it("prefers a match at the start of a word to one inside it", () => {
    const score = (text: string) => fuzzyScore(text, "port") ?? 0;
    expect(score("Port scan")).toBeGreaterThan(score("Report"));
  });

  it("keeps everything, in order, for an empty query", () => {
    expect(search("  ")).toEqual(FINDINGS);
  });
});
