import { test, expect } from "@playwright/test";
import { normalizeUrl } from "../../src/lib/audit/normalizeUrl";

test.describe("normalizeUrl", () => {
  test("forces https, drops www, lowercases host", () => {
    expect(normalizeUrl("http://WWW.Example.COM")).toBe("https://example.com");
  });

  test("adds a scheme when the user omits it", () => {
    expect(normalizeUrl("example.com/precios")).toBe("https://example.com/precios");
  });

  test("drops trailing slash, query and hash", () => {
    expect(normalizeUrl("https://example.com/a/?utm_source=x#top")).toBe(
      "https://example.com/a",
    );
  });

  test("keeps the root path as bare origin", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com");
  });

  test("preserves path case (paths are case-sensitive)", () => {
    expect(normalizeUrl("https://example.com/MiPagina")).toBe(
      "https://example.com/MiPagina",
    );
  });

  test("rejects junk", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
    expect(normalizeUrl("not a url at all")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
  });
});
