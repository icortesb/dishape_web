import { test, expect } from "@playwright/test";
import { parse } from "node-html-parser";
import { registry, runChecks } from "../../src/lib/audit/registry";
import type { PageContext, Check } from "../../src/lib/audit/types";

/** Minimal PageContext for a fixture; overrides win. */
function ctx(html: string, over: Partial<PageContext> = {}): PageContext {
  return {
    url: new URL("https://example.com/pagina"),
    status: 200,
    headers: new Headers(),
    html,
    bytes: html.length,
    redirects: 0,
    doc: parse(html),
    robotsTxt: "User-agent: *\nAllow: /",
    sitemapOk: true,
    ogImageOk: true,
    httpRedirectsToHttps: true,
    ...over,
  };
}

test.describe("registry", () => {
  test("has 14 checks", () => {
    expect(registry.length).toBe(14);
  });

  test("all checks have unique ids", () => {
    const ids = registry.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("runChecks returns a result for every registered check", () => {
    const c = ctx("<html></html>");
    const results = runChecks(c);
    expect(results.length).toBe(registry.length);
    const resultIds = results.map((r) => r.id);
    const registryIds = registry.map((c) => c.id);
    expect(resultIds.sort()).toEqual(registryIds.sort());
  });

  test("runChecks degrades a throwing check to na status", () => {
    // Create a PageContext that will cause a specific check to throw.
    // We'll use a test by injecting a malformed doc that might cause issues.
    // But since our checks are generally robust, we'll instead mock by
    // temporarily replacing a registry entry.

    const originalRegistry = [...registry];
    let throwCheckCalled = false;

    // Find a simple check to replace temporarily (e.g., seo.title.present)
    const titleCheckIndex = registry.findIndex((c) => c.id === "seo.title.present");
    const originalCheck = registry[titleCheckIndex];

    // Replace it with a throwing version
    const throwingCheck: Check = {
      ...originalCheck,
      run: () => {
        throwCheckCalled = true;
        throw new Error("Intentional test error");
      },
    };
    registry[titleCheckIndex] = throwingCheck;

    try {
      const c = ctx("<html><head><title>Test</title></head></html>");
      const results = runChecks(c);

      // The throwing check should come back as na, not throw
      const throwCheckResult = results.find((r) => r.id === "seo.title.present");
      expect(throwCheckResult?.status).toBe("na");
      expect(throwCheckCalled).toBe(true);

      // All other checks should have normal results (not na)
      const otherResults = results.filter((r) => r.id !== "seo.title.present");
      expect(otherResults.length).toBe(13);
      // At least some should be pass or other normal statuses, not all na
      const nonNaCount = otherResults.filter((r) => r.status !== "na").length;
      expect(nonNaCount).toBeGreaterThan(0);
    } finally {
      // Restore the original registry
      registry[titleCheckIndex] = originalCheck;
    }
  });
});
