import { test, expect } from "@playwright/test";
import { parse } from "node-html-parser";
import { es } from "../../src/i18n/es";
import { en } from "../../src/i18n/en";
import { registry, runChecks } from "../../src/lib/audit/registry";
import { interpolate } from "../../src/lib/audit/copy";
import type { PageContext } from "../../src/lib/audit/types";

test.describe("audit copy", () => {
  test("every registered check has Spanish copy", () => {
    const missing = registry
      .map((c) => c.id)
      .filter((id) => !(id in es.audit.checks));
    expect(missing).toEqual([]);
  });

  test("every registered check has English copy", () => {
    const missing = registry
      .map((c) => c.id)
      .filter((id) => !(id in en.audit.checks));
    expect(missing).toEqual([]);
  });

  test("the two dictionaries declare the same check ids", () => {
    expect(Object.keys(es.audit.checks).sort()).toEqual(
      Object.keys(en.audit.checks).sort(),
    );
  });

  test("every check entry has all four fields in both languages", () => {
    for (const dict of [es, en]) {
      for (const [id, copy] of Object.entries(dict.audit.checks)) {
        for (const field of ["name", "why", "found", "fix"] as const) {
          expect(typeof copy[field], `${id}.${field}`).toBe("string");
          expect(copy[field].length, `${id}.${field}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

test.describe("interpolate", () => {
  test("substitutes evidence values", () => {
    expect(interpolate("Tiene {actual} de {max}", { actual: 87, max: 60 })).toBe(
      "Tiene 87 de 60",
    );
  });

  test("leaves unknown placeholders untouched rather than printing undefined", () => {
    expect(interpolate("Valor {nope}", { actual: 1 })).toBe("Valor {nope}");
  });

  test("handles a missing evidence object", () => {
    expect(interpolate("Sin datos", undefined)).toBe("Sin datos");
  });
});

/**
 * Minimal PageContext fixture; overrides win. Mirrors the helper in
 * tests/unit/checks-seo.spec.ts — no network I/O, built as a plain object.
 */
function pageCtx(html: string, over: Partial<PageContext> = {}): PageContext {
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

test.describe("audit copy resolves against real check output", () => {
  // The report only renders the found/why/fix block for non-pass results
  // (FindingList puts "pass" in the collapsed section, which never calls
  // interpolate). A placeholder that only resolves on the pass branch — like
  // seo.html.lang's {found}, which was only ever populated when lang WAS
  // present — is invisible to a naive check and still renders literally to
  // every visitor whose page fails the check.
  test("found/why/fix never leave a stray {placeholder} for any displayed (fail/warn) result", () => {
    const fixtures: PageContext[] = [
      // A bare page: forces the "nothing declared at all" fail branches. This
      // is exactly where seo.canonical and seo.html.lang broke — their
      // fail-with-no-evidence path is the page's ordinary state, not an edge case.
      pageCtx("<html></html>", {
        robotsTxt: null,
        sitemapOk: false,
        httpRedirectsToHttps: false,
      }),
      // A page with plenty declared, but wrong: drives most of the warn branches.
      pageCtx(`
        <title>${"a".repeat(87)}</title>
        <meta name="description" content="${"a".repeat(175)}">
        <h1>Main</h1><h3>Skip</h3>
        <link rel="canonical" href="https://otro.com/x">
        <link rel="alternate" hreflang="en" href="https://example.com/en/pagina">
        <meta name="robots" content="noindex, follow">
        <meta property="og:image" content="/img.png">
        <script type="application/ld+json">{not valid json}</script>
      `),
      // A canonical href that survives extraction but fails URL parsing, plus
      // an hreflang set with a self-reference and one invalid language code,
      // plus an absolute og:image the reachability probe couldn't confirm.
      pageCtx(
        `
        <link rel="canonical" href="http://[invalid">
        <link rel="alternate" hreflang="es" href="https://example.com/pagina">
        <link rel="alternate" hreflang="not-a-code!!" href="https://example.com/otra">
        <meta property="og:image" content="https://example.com/img.jpg">
      `,
        { ogImageOk: false },
      ),
      // Plain HTTP: the one branch that needs a non-https URL to reach.
      pageCtx("<html></html>", { url: new URL("http://example.com/pagina") }),
    ];

    const results = fixtures.flatMap((fixture) => runChecks(fixture));
    const displayed = results.filter((r) => r.status === "fail" || r.status === "warn");

    // Sanity check: if this collapses to near-zero the fixtures stopped
    // exercising anything and the assertion below would pass for free.
    expect(displayed.length).toBeGreaterThan(20);

    const violations: string[] = [];
    const dicts = [
      { lang: "es", checks: es.audit.checks as Record<string, { found: string; why: string; fix: string }> },
      { lang: "en", checks: en.audit.checks as Record<string, { found: string; why: string; fix: string }> },
    ];
    for (const { lang, checks } of dicts) {
      for (const r of results) {
        if (r.status !== "fail" && r.status !== "warn") continue;
        const copy = checks[r.id];
        if (!copy) continue;
        for (const field of ["found", "why", "fix"] as const) {
          const out = interpolate(copy[field], r.evidence);
          if (/\{\w+\}/.test(out)) {
            violations.push(`${lang}:${r.id}.${field} -> "${out}"`);
          }
        }
      }
    }
    expect([...new Set(violations)]).toEqual([]);
  });
});
