import { test, expect } from "@playwright/test";
import { parse } from "node-html-parser";
import { es } from "../../src/i18n/es";
import { en } from "../../src/i18n/en";
import { registry, runChecks } from "../../src/lib/audit/registry";
import {
  checkCopy,
  checkText,
  interpolate,
  resolveFound,
  LOCALIZED_EVIDENCE_KEYS,
  type CheckCopy,
} from "../../src/lib/audit/copy";
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

  // foundEmpty is optional, so the plain key-set comparison above can't see
  // it — a check could gain foundEmpty in one language and not the other
  // without failing anything else.
  test("foundEmpty is present in both languages wherever it appears", () => {
    const esChecks = es.audit.checks as Record<string, { foundEmpty?: string }>;
    const enChecks = en.audit.checks as Record<string, { foundEmpty?: string }>;
    const mismatched = Object.keys(esChecks).filter(
      (id) => Boolean(esChecks[id].foundEmpty) !== Boolean(enChecks[id]?.foundEmpty),
    );
    expect(mismatched).toEqual([]);
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

const dicts = [
  { lang: "es", checks: es.audit.checks as Record<string, CheckCopy> },
  { lang: "en", checks: en.audit.checks as Record<string, CheckCopy> },
];

test.describe("audit copy resolves against real check output", () => {
  // The report renders the found/why/fix block for every result except
  // "pass" — FindingList puts "pass" in the collapsed section (never calls
  // interpolate), but "fail", "warn" AND "na" all reach it. A placeholder
  // that only resolves on the pass branch — like seo.html.lang's old
  // {found}, which was only ever populated when lang WAS present — is
  // invisible to a naive check and still renders literally to every visitor
  // whose page fails the check.
  test("found/why/fix never leave a stray {placeholder} for any displayed (non-pass) result", () => {
    const fixtures: PageContext[] = [
      // A bare page: forces the "nothing declared at all" fail/na branches.
      // This is exactly where seo.canonical and seo.html.lang broke — their
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
    const displayed = results.filter((r) => r.status !== "pass");

    // Sanity check: if this collapses to near-zero the fixtures stopped
    // exercising anything and the assertion below would pass for free.
    expect(displayed.length).toBeGreaterThan(20);

    const violations: string[] = [];
    for (const { lang, checks } of dicts) {
      for (const r of results) {
        if (r.status === "pass") continue;
        const copy = checks[r.id];
        if (!copy) continue;
        const found = resolveFound(copy, r.evidence);
        if (/\{\w+\}/.test(found)) violations.push(`${lang}:${r.id}.found -> "${found}"`);
        for (const field of ["why", "fix"] as const) {
          const out = interpolate(copy[field], r.evidence);
          if (/\{\w+\}/.test(out)) {
            violations.push(`${lang}:${r.id}.${field} -> "${out}"`);
          }
        }
      }
    }
    expect([...new Set(violations)]).toEqual([]);
  });

  // seo.canonical has three displayable branches sharing one `found` template:
  // nothing declared (no evidence), a declared href that fails URL parsing
  // (evidence carries the raw href), and a declared href on a foreign host
  // (evidence carries the resolved absolute URL). A single blanket sentence
  // can only ever be true for one of these — these three assertions pin down
  // that resolveFound picks the *right* sentence for each, not merely a
  // brace-free one.
  test.describe("seo.canonical selects the right sentence per branch", () => {
    const seoCanonical = (html: string, over: Partial<PageContext> = {}) =>
      runChecks(pageCtx(html, over)).find((r) => r.id === "seo.canonical")!;

    test("cross-host warn names the foreign URL", () => {
      const result = seoCanonical(
        '<link rel="canonical" href="https://otrodominio.com/x">',
      );
      expect(result.status).toBe("warn");
      for (const { lang, checks } of dicts) {
        const found = resolveFound(checks["seo.canonical"], result.evidence);
        expect(found, lang).toContain("otrodominio.com");
      }
    });

    test("an unparseable href renders the declared value, not the empty sentence", () => {
      const result = seoCanonical('<link rel="canonical" href="http://[invalid">');
      expect(result.status).toBe("fail");
      expect(result.evidence).toMatchObject({ found: "http://[invalid" });
      for (const { lang, checks } of dicts) {
        const found = resolveFound(checks["seo.canonical"], result.evidence);
        expect(found, lang).toContain("http://[invalid");
        expect(found, lang).not.toBe(checks["seo.canonical"].foundEmpty);
      }
    });

    test("no canonical at all renders the empty sentence", () => {
      const result = seoCanonical("<html></html>");
      expect(result.status).toBe("fail");
      expect(result.evidence).toBeUndefined();
      for (const { lang, checks } of dicts) {
        const found = resolveFound(checks["seo.canonical"], result.evidence);
        expect(found, lang).toBe(checks["seo.canonical"].foundEmpty);
      }
    });
  });
});

/**
 * Three checks put an internal enum token in their evidence — `reason`
 * ("missing", "unreachable", "no-type"…) and `source` ("meta", "header") — and
 * interpolate it straight into an otherwise-localized sentence. Unfixed, the
 * Spanish report reads "La imagen para compartir tiene un problema: missing.".
 * The stray-placeholder guard above cannot see it: the placeholder resolves
 * cleanly, it just resolves to an English identifier.
 */
test.describe("evidence enum tokens are localized", () => {
  /** Checks whose evidence carries a token that reaches the visitor. */
  const tokenChecks = ["social.og.image", "social.jsonld", "seo.noindex"];

  test("both languages label exactly the same tokens", () => {
    for (const id of tokenChecks) {
      const esKeys = Object.keys(checkCopy("es", id)?.evidenceLabels ?? {}).sort();
      const enKeys = Object.keys(checkCopy("en", id)?.evidenceLabels ?? {}).sort();
      expect(esKeys.length, `${id} has no labels`).toBeGreaterThan(0);
      expect(enKeys, id).toEqual(esKeys);
    }
  });

  test("each token renders as its label and never as the raw token", () => {
    for (const lang of ["es", "en"] as const) {
      for (const id of tokenChecks) {
        const copy = checkCopy(lang, id)!;
        for (const [token, label] of Object.entries(copy.evidenceLabels ?? {})) {
          // Both keys are tried: only the one the template names shows up.
          for (const key of LOCALIZED_EVIDENCE_KEYS) {
            const { found } = checkText(copy, { [key]: token });
            if (!copy.found.includes(`{${key}}`)) continue;
            expect(found, `${lang}:${id}:${key}=${token}`).toContain(label);
            expect(found, `${lang}:${id}:${key}=${token}`).not.toContain(token);
          }
        }
      }
    }
  });

  test("every token a check actually emits has a label", () => {
    // Drive the real checks rather than trusting a hand-written token list:
    // a new branch with a new token fails here instead of shipping raw.
    const results = [
      pageCtx("<html></html>"),
      pageCtx('<meta property="og:image" content="/img.png">'),
      pageCtx('<meta property="og:image" content="https://example.com/i.jpg">', {
        ogImageOk: false,
      }),
      pageCtx('<meta property="og:image" content="https://example.com/i.jpg">', {
        ogImageOk: null,
      }),
      pageCtx('<script type="application/ld+json">{nope}</script>'),
      pageCtx('<script type="application/ld+json">{"a":1}</script>'),
      pageCtx('<meta name="robots" content="noindex">'),
    ].flatMap((ctx) => runChecks(ctx));

    const seen = new Set<string>();
    const unlabeled: string[] = [];
    for (const r of results) {
      for (const key of LOCALIZED_EVIDENCE_KEYS) {
        const token = r.evidence?.[key];
        if (typeof token !== "string") continue;
        seen.add(`${r.id}:${token}`);
        for (const lang of ["es", "en"] as const) {
          if (!checkCopy(lang, r.id)?.evidenceLabels?.[token]) {
            unlabeled.push(`${lang}:${r.id}:${key}=${token}`);
          }
        }
      }
    }
    // Guard the guard: if the fixtures stop reaching these branches the
    // assertion below would pass against a dictionary with no labels at all.
    expect(seen.size).toBeGreaterThanOrEqual(6);
    expect([...new Set(unlabeled)]).toEqual([]);
  });
});

test.describe("checkText", () => {
  test("falls back to foundEmpty when the evidence cannot fill found", () => {
    const copy: CheckCopy = {
      name: "n",
      why: "w",
      found: "Tiene {actual} caracteres.",
      foundEmpty: "No hay título que medir.",
      fix: "f",
    };
    expect(checkText(copy, undefined).found).toBe("No hay título que medir.");
    expect(checkText(copy, { actual: 12 }).found).toBe("Tiene 12 caracteres.");
  });

  test("localizes the token in why and fix too, not only in found", () => {
    const copy: CheckCopy = {
      name: "n",
      why: "Porque {reason}.",
      found: "Encontramos {reason}.",
      fix: "Resolvé {reason}.",
      evidenceLabels: { missing: "que no hay ninguna" },
    };
    expect(checkText(copy, { reason: "missing" })).toEqual({
      found: "Encontramos que no hay ninguna.",
      why: "Porque que no hay ninguna.",
      fix: "Resolvé que no hay ninguna.",
    });
  });

  test("leaves evidence that is not an enum token alone", () => {
    const copy: CheckCopy = {
      name: "n",
      why: "w",
      found: "La canónica es {found}.",
      fix: "f",
      evidenceLabels: { missing: "no declarada" },
    };
    // `found` carries site data, never a token — a page whose canonical URL
    // happens to read "missing" must still render verbatim.
    expect(checkText(copy, { found: "missing" }).found).toBe("La canónica es missing.");
  });
});
