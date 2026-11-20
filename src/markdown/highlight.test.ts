import { describe, expect, it } from "vitest";
import { highlightCode } from "./highlight";

describe("highlighting code blocks", () => {
  it("uses the language the block names", () => {
    expect(highlightCode('{"a": 1}', "json")?.data?.language).toBe("json");
  });
  it("recognises an unlabelled HTTP request or response", () => {
    expect(highlightCode("GET /api/users/2 HTTP/1.1\nHost: example.com", null)).not.toBeNull();
    expect(highlightCode("HTTP/1.1 403 Forbidden\nServer: nginx", null)).not.toBeNull();
  });
  it("leaves plain output plain", () => {
    expect(highlightCode("Access denied for user 2", null)).toBeNull();
  });
});
