import { test, expect } from "@playwright/test";
import { scoreCategory, rankFindings } from "../../src/lib/audit/score";
import type { CheckResult } from "../../src/lib/audit/types";

const r = (id: string, status: CheckResult["status"]): CheckResult => ({ id, status });

test.describe("scoreCategory", () => {
  test("counts pass as 1 and warn as 0.5", () => {
    const results = [
      r("seo.title.present", "pass"),
      r("seo.h1.unique", "pass"),
      r("seo.title.length", "warn"),
      r("seo.canonical", "fail"),
    ];
    const s = scoreCategory(results, "seo");
    expect(s.total).toBe(4);
    expect(s.passed).toBe(2);
    // (1 + 1 + 0.5 + 0) / 4 = 62.5 → 63
    expect(s.percent).toBe(63);
  });

  test("excludes na from the denominator", () => {
    const results = [
      r("seo.title.present", "pass"),
      r("seo.hreflang", "na"),
      r("seo.http.redirect", "na"),
    ];
    const s = scoreCategory(results, "seo");
    expect(s.total).toBe(1);
    expect(s.percent).toBe(100);
  });

  test("is 0 with no applicable checks rather than NaN", () => {
    const s = scoreCategory([r("seo.hreflang", "na")], "seo");
    expect(s.total).toBe(0);
    expect(s.percent).toBe(0);
  });

  test("ignores results from other categories", () => {
    const results = [r("seo.title.present", "pass"), r("social.og.title", "fail")];
    expect(scoreCategory(results, "seo").total).toBe(1);
    expect(scoreCategory(results, "social").total).toBe(1);
  });
});

test.describe("rankFindings", () => {
  test("puts fail before warn before pass, and drops na", () => {
    const results = [
      r("seo.title.length", "warn"),
      r("seo.title.present", "pass"),
      r("seo.hreflang", "na"),
      r("seo.h1.unique", "fail"),
    ];
    expect(rankFindings(results).map((x) => x.status)).toEqual(["fail", "warn", "pass"]);
  });

  test("orders by severity within the same status", () => {
    // seo.noindex is critical, seo.sitemap is important
    const results = [r("seo.sitemap", "fail"), r("seo.noindex", "fail")];
    expect(rankFindings(results).map((x) => x.id)).toEqual(["seo.noindex", "seo.sitemap"]);
  });
});
