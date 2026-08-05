import { test, expect } from "@playwright/test";
import { parse } from "node-html-parser";
import { es } from "../../src/i18n/es";
import { en } from "../../src/i18n/en";
import { registry, runChecks } from "../../src/lib/audit/registry";
import { TITLE_MAX, TITLE_MIN } from "../../src/lib/audit/checks/seo";
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

  /**
   * Every leaf path in the dictionary, e.g. `audit.hero.submit` or
   * `audit.faq.items[1][0]`. Arrays are walked by index so a translated list
   * that gained or lost an entry shows up too — the FAQ array is mirrored
   * one-for-one into FAQPage schema, so a length drift is a real defect.
   */
  function leafPaths(value: unknown, prefix = ""): string[] {
    if (Array.isArray(value)) {
      return value.flatMap((v, i) => leafPaths(v, `${prefix}[${i}]`));
    }
    if (value && typeof value === "object") {
      return Object.entries(value).flatMap(([k, v]) =>
        leafPaths(v, prefix ? `${prefix}.${k}` : k),
      );
    }
    return [prefix];
  }

  // The check-id comparison above only sees `audit.checks`. Everything else —
  // nav labels, the landing hero, whatWeCheck.cards, the FAQ — had no
  // structural guard at all, and `astro check` is not installed, so TypeScript
  // never runs over these files either. A key added to one language and
  // forgotten in the other renders as `undefined` for half the visitors.
  test("es and en declare the same keys, everywhere, not just under audit.checks", () => {
    const esPaths = new Set(leafPaths(es));
    const enPaths = new Set(leafPaths(en));
    const missingInEn = [...esPaths].filter((p) => !enPaths.has(p)).sort();
    const missingInEs = [...enPaths].filter((p) => !esPaths.has(p)).sort();
    // Guard the guard: a walker that silently returned nothing would make the
    // two assertions below pass against any pair of dictionaries.
    expect(esPaths.size, "the dictionary walker found nothing").toBeGreaterThan(200);
    expect(missingInEn, "declared in es, missing from en").toEqual([]);
    expect(missingInEs, "declared in en, missing from es").toEqual([]);
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

  // foundEmpty and foundOne are optional, so a check could gain one in a
  // single language and still satisfy every other structural guard here —
  // and the language without it silently keeps rendering the wrong sentence.
  for (const field of ["foundEmpty", "foundOne"] as const) {
    test(`${field} is present in both languages wherever it appears`, () => {
      const esChecks = es.audit.checks as Record<string, CheckCopy>;
      const enChecks = en.audit.checks as Record<string, CheckCopy>;
      const mismatched = Object.keys(esChecks).filter(
        (id) => Boolean(esChecks[id][field]) !== Boolean(enChecks[id]?.[field]),
      );
      expect(mismatched).toEqual([]);
    });
  }
});

/**
 * The landing states the same fact twice: `whatWeCheck.eyebrow` renders
 * "{count} CHEQUEOS + RENDIMIENTO" from the registry length, and the FAQ says
 * what those checks are. The registry holds SEO and sharing only — performance
 * comes from PageSpeed and is not one of the counted checks — so an FAQ answer
 * that folds performance into the number contradicts the eyebrow two sections
 * above it. On a tool whose whole pitch is that it reports accurately, a
 * numeric self-contradiction on its own landing page is a credibility defect.
 */
test.describe("the landing's check count means the same thing in both places", () => {
  const answers = {
    es: {
      question: "¿Qué analiza exactamente?",
      answer:
        "Alrededor de veinte chequeos técnicos sobre la página que se indique: SEO técnico (qué entiende Google) y cómo se ve el link al compartirlo. El rendimiento se mide aparte, con la API de PageSpeed Insights de Google, y no entra en esa cuenta.",
    },
    en: {
      question: "What exactly does it check?",
      answer:
        "About twenty technical checks on the page you enter: technical SEO (what Google understands) and how the link looks when shared. Performance is measured separately, with Google's PageSpeed Insights API, and is not part of that count.",
    },
  } as const;

  test("the eyebrow's premise holds: no counted check is a performance check", () => {
    // If this ever stops being true the eyebrow and both FAQ answers below
    // become wrong at once, and the fix is copy, not this assertion.
    expect(registry.filter((c) => c.category !== "seo" && c.category !== "social")).toEqual(
      [],
    );
  });

  for (const [lang, dict] of [
    ["es", es],
    ["en", en],
  ] as const) {
    test(`${lang}: the FAQ keeps performance out of the counted checks`, () => {
      const item = dict.audit.faq.items.find(([q]) => q === answers[lang].question);
      expect(item, `no "what does it check" question in ${lang}`).toBeTruthy();
      expect(item![1]).toBe(answers[lang].answer);

      // Phrasing-independent restatement of the same rule, so a future rewrite
      // that drifts back is caught even if someone updates the string above:
      // the sentence carrying the number must not also carry performance.
      const counted = item![1].split(". ")[0];
      expect(
        counted.toLowerCase(),
        "the sentence that states the number also claims to cover performance",
      ).not.toMatch(/rendimiento|performance|pagespeed/);
      expect(item![1].toLowerCase()).toContain("pagespeed");
    });
  }
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
  // The report renders the found/why/fix block for "fail" and "warn" only:
  // FindingItem.astro:43 hides it for "pass", and "na" is dropped before it
  // ever gets there (score.ts:55, FindingList.astro:17). This sweeps every
  // non-pass result anyway, "na" included, for the same reason the copy rule
  // is written that way — the strings must survive a change in the filtering.
  // A placeholder that only resolves on the pass branch — like seo.html.lang's
  // old {found}, which was only ever populated when lang WAS present — is
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
      // Counts of exactly 1 — a one-character title and description, a single
      // alternate with no self-reference. This is the branch a `foundOne`
      // sentence is selected on, and no fixture above reaches it, so without
      // this one a stray placeholder in a singular string ships unseen.
      pageCtx(`
        <title>a</title>
        <meta name="description" content="b">
        <link rel="alternate" hreflang="en" href="https://otro.com/en/p">
      `),
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
 * A `found` that states a count has to agree with it grammatically. Every
 * branch below is reachable at exactly 1 — a half-configured bilingual site
 * with a single alternate, a one-character title — so the singular is the
 * boundary case, not an edge. Spanish gets it wrong twice: the noun and, on
 * the report's own disclosure, the article.
 *
 * Each case drives the real registry so the assertion pins what a visitor
 * reads, not a dictionary string that could be changed in two places at once.
 * Every singular is paired with a plural control, so a blanket-singular
 * "fix" fails here instead of shipping the mirrored bug.
 */
test.describe("a counted finding agrees with the number it reports", () => {
  /** Resolve one check's `found` in both languages, from a real check run. */
  const render = (id: string, html: string, over: Partial<PageContext> = {}) => {
    const result = runChecks(pageCtx(html, over)).find((r) => r.id === id)!;
    const text = Object.fromEntries(
      dicts.map(({ lang, checks }) => [lang, resolveFound(checks[id], result.evidence)]),
    ) as Record<"es" | "en", string>;
    return { result, text };
  };

  test.describe("seo.hreflang", () => {
    // links.length === 0 already returns "na", so a page declaring exactly one
    // alternate that does not point back at itself yields count 1 — the
    // ordinary shape of a bilingual site someone half-configured.
    test("a single non-self-referencing alternate reads as one tag", () => {
      const { result, text } = render(
        "seo.hreflang",
        '<link rel="alternate" hreflang="en" href="https://otro.com/en/p">',
      );
      expect(result.status).toBe("warn");
      expect(result.evidence).toMatchObject({ count: 1, reason: "no-self" });

      expect(text.es).not.toMatch(/\b1 etiquetas\b/);
      expect(text.es).toBe(
        "Encontramos una etiqueta hreflang con un problema de configuración.",
      );
      expect(text.en).not.toMatch(/\b1 hreflang tags\b/);
      expect(text.en).toBe("We found one hreflang tag with a configuration problem.");
    });

    // The other warn branch: invalid.length is >= 1 by its own guard.
    test("a single invalid language code reads as one tag", () => {
      const { result, text } = render(
        "seo.hreflang",
        `
        <link rel="alternate" hreflang="es" href="https://example.com/pagina">
        <link rel="alternate" hreflang="not-a-code!!" href="https://example.com/otra">
      `,
      );
      expect(result.status).toBe("warn");
      expect(result.evidence).toMatchObject({ count: 1, reason: "invalid-code" });

      expect(text.es).not.toMatch(/\b1 etiquetas\b/);
      expect(text.es).toContain("una etiqueta hreflang");
      expect(text.en).toContain("one hreflang tag");
    });

    test("two problem tags still read as plural", () => {
      const { result, text } = render(
        "seo.hreflang",
        `
        <link rel="alternate" hreflang="es" href="https://example.com/pagina">
        <link rel="alternate" hreflang="not-a-code!!" href="https://example.com/a">
        <link rel="alternate" hreflang="tampoco!!" href="https://example.com/b">
      `,
      );
      expect(result.evidence).toMatchObject({ count: 2 });
      expect(text.es).toBe(
        "Encontramos 2 etiquetas hreflang con un problema de configuración.",
      );
      expect(text.en).toBe("We found 2 hreflang tags with a configuration problem.");
    });
  });

  // warn fires on actual < TITLE_MIN / DESC_MIN, so a one-character title or
  // description lands on the displayed branch with a count of 1.
  test.describe("seo.title.length and seo.description.length", () => {
    test("a one-character title reads as one character", () => {
      const { result, text } = render("seo.title.length", "<title>a</title>");
      expect(result.status).toBe("warn");
      expect(result.evidence).toMatchObject({ actual: 1 });

      expect(text.es).not.toMatch(/\b1 caracteres\b/);
      expect(text.es).toBe("El título tiene un solo carácter.");
      expect(text.en).not.toMatch(/\b1 characters\b/);
      expect(text.en).toBe("The title is a single character long.");
    });

    test("a long title still reads as plural", () => {
      const { text } = render("seo.title.length", `<title>${"a".repeat(87)}</title>`);
      expect(text.es).toBe("El título tiene 87 caracteres.");
      expect(text.en).toBe("The title is 87 characters long.");
    });

    test("a one-character meta description reads as one character", () => {
      const { result, text } = render(
        "seo.description.length",
        '<meta name="description" content="a">',
      );
      expect(result.status).toBe("warn");
      expect(result.evidence).toMatchObject({ actual: 1 });

      expect(text.es).not.toMatch(/\b1 caracteres\b/);
      expect(text.es).toBe("La meta descripción tiene un solo carácter.");
      expect(text.en).not.toMatch(/\b1 characters\b/);
      expect(text.en).toBe("The meta description is a single character long.");
    });

    test("a long meta description still reads as plural", () => {
      const { text } = render(
        "seo.description.length",
        `<meta name="description" content="${"a".repeat(175)}">`,
      );
      expect(text.es).toBe("La meta descripción tiene 175 caracteres.");
      expect(text.en).toBe("The meta description is 175 characters long.");
    });
  });

  /**
   * The selection rule itself. `foundOne` is picked only for the number 1 in a
   * single-placeholder template: every other `found` placeholder carries the
   * visitor's own content (a title, a URL), and a page whose canonical happens
   * to be the string "1" must not be handed our singular copy.
   */
  test.describe("resolveFound picks the singular narrowly", () => {
    const copy = {
      found: "{count} cosas",
      foundOne: "una cosa",
      foundEmpty: "ninguna cosa",
    };

    test("the number 1 selects foundOne", () => {
      expect(resolveFound(copy, { count: 1 })).toBe("una cosa");
    });

    test("the string \"1\" does not", () => {
      expect(resolveFound(copy, { count: "1" })).toBe("1 cosas");
    });

    test("any other count does not", () => {
      expect(resolveFound(copy, { count: 2 })).toBe("2 cosas");
      expect(resolveFound(copy, { count: 0 })).toBe("0 cosas");
    });

    test("missing evidence still falls back to foundEmpty", () => {
      expect(resolveFound(copy, undefined)).toBe("ninguna cosa");
    });

    test("a template naming two placeholders keeps found", () => {
      const two = { found: "{a} de {b}", foundOne: "una" };
      expect(resolveFound(two, { a: 1, b: 3 })).toBe("1 de 3");
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

  /**
   * A token only reaches the visitor if some sentence names its placeholder.
   * seo.hreflang emits `reason` today and needs no labels precisely because its
   * copy never interpolates it — so the requirement is derived from the
   * templates, not from a hand-kept list of checks.
   */
  const namesAToken = (copy: CheckCopy) =>
    LOCALIZED_EVIDENCE_KEYS.some((key) =>
      [copy.found, copy.why, copy.fix].some((s) => s.includes(`{${key}}`)),
    );

  test("a check whose copy names {reason} or {source} ships labels", () => {
    // Catches the case no fixture can: copy that starts interpolating a token
    // while the dictionary has nothing to resolve it with.
    const bare: string[] = [];
    for (const lang of ["es", "en"] as const) {
      for (const { id } of registry) {
        const copy = checkCopy(lang, id);
        if (!copy || !namesAToken(copy)) continue;
        if (!copy.evidenceLabels) bare.push(`${lang}:${id}`);
      }
    }
    expect(bare).toEqual([]);
  });

  test("every token such a check actually emits has a label", () => {
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
      // seo.hreflang's two token branches: exempt only for as long as its copy
      // does not name them, and covered the moment it does.
      pageCtx('<link rel="alternate" hreflang="en" href="https://example.com/en/p">'),
      pageCtx(`
        <link rel="alternate" hreflang="es" href="https://example.com/pagina">
        <link rel="alternate" hreflang="not-a-code!!" href="https://example.com/otra">
      `),
    ].flatMap((ctx) => runChecks(ctx));

    const emitted = new Set<string>();
    const seen = new Set<string>();
    const unlabeled: string[] = [];
    for (const r of results) {
      for (const key of LOCALIZED_EVIDENCE_KEYS) {
        const token = r.evidence?.[key];
        if (typeof token !== "string") continue;
        emitted.add(`${r.id}:${token}`);
        for (const lang of ["es", "en"] as const) {
          const copy = checkCopy(lang, r.id);
          if (!copy || !namesAToken(copy)) continue;
          seen.add(`${r.id}:${token}`);
          if (!copy.evidenceLabels?.[token]) {
            unlabeled.push(`${lang}:${r.id}:${key}=${token}`);
          }
        }
      }
    }
    // Guard the guard: if the fixtures stop reaching these branches the
    // assertion below would pass against a dictionary with no labels at all.
    expect(emitted.size).toBeGreaterThanOrEqual(8);
    expect(seen.size).toBeGreaterThanOrEqual(6);
    expect([...new Set(unlabeled)]).toEqual([]);
  });
});

/**
 * The audit landing feeds `audit.meta.title` straight into <title>
 * (src/pages/auditoria/index.astro), and it is the one page of the tool that
 * has to rank. A visitor who audits that page gets seo.title.length back — so
 * if the string runs past TITLE_MAX the tool warns about its own pitch page,
 * and Google truncates "| dishape", the brand, off the end.
 *
 * The bound is imported from the check, never retyped: a second copy of 60
 * would let the two drift apart silently, which is the defect this guards.
 */
test.describe("the audit landing passes the title check the tool runs on visitors", () => {
  for (const [lang, dict] of [
    ["es", es],
    ["en", en],
  ] as const) {
    test(`${lang}: audit.meta.title stays inside seo.title.length's bounds`, () => {
      const title = dict.audit.meta.title;
      const detail = `${lang} audit.meta.title is ${title.length} characters; seo.title.length accepts ${TITLE_MIN}-${TITLE_MAX}: "${title}"`;

      // Both bounds, because the check warns on either side of the range.
      expect(title.length, detail).toBeLessThanOrEqual(TITLE_MAX);
      expect(title.length, detail).toBeGreaterThanOrEqual(TITLE_MIN);

      // …and run the real check over the real string, so this cannot pass by
      // reimplementing the predicate slightly wrong.
      const result = runChecks(pageCtx(`<title>${title}</title>`)).find(
        (r) => r.id === "seo.title.length",
      )!;
      expect(result.status, detail).toBe("pass");
    });
  }
});

/**
 * An exact snapshot of every Spanish check `fix` string.
 *
 * It exists because nothing else in either suite reads their text: a reviewer
 * rewrote one of these with two blatant voseo tokens and both suites stayed
 * fully green, and an entire dictionary had already shipped in violation of
 * docs/voice.md once. A regex voice-lint would need a hand-kept accent
 * exclusion list (está, más, después, así…) that a future author could weaken
 * to get green; a snapshot has no such knob.
 */
const ES_FIX_SNAPSHOT: Record<string, string> = {
  "seo.title.present":
    "Falta un <title> descriptivo y único en el <head>, con el término por el que interesa que Google encuentre la página.",
  "seo.title.length":
    "El título debe tener entre 30 y 60 caracteres, con lo más importante al principio.",
  "seo.description.present":
    "Falta <meta name=\"description\" content=\"…\"> con un resumen concreto de lo que ofrece la página.",
  "seo.description.length":
    "La meta descripción debe tener entre 70 y 160 caracteres.",
  "seo.h1.unique":
    "Cada página lleva exactamente un H1, con el tema principal. El resto de los títulos van como H2 o H3.",
  "seo.headings.hierarchy":
    "Conviene usar los encabezados en orden, sin saltear niveles. Si el salto es por estética, el tamaño se cambia con CSS, no el nivel.",
  "seo.canonical":
    "El <link rel=\"canonical\"> debe apuntar a la URL absoluta y definitiva de esta misma página.",
  "seo.html.lang":
    "El atributo lang va en la etiqueta <html>, por ejemplo <html lang=\"es\">.",
  "seo.robots.txt":
    "Con un robots.txt mínimo en la raíz del dominio basta, y es donde se declara la ubicación del sitemap.",
  "seo.sitemap":
    "El sitemap.xml se genera y se declara en robots.txt con la línea Sitemap: https://tudominio.com/sitemap.xml",
  "seo.noindex":
    "La directiva noindex se quita del meta robots o del encabezado X-Robots-Tag. Suele quedar de un entorno de pruebas.",
  "seo.hreflang":
    "Cada versión debe listar todas las alternativas, incluida ella misma, con códigos de idioma válidos.",
  "seo.https":
    "El sitio debe servirse por HTTPS, con un certificado TLS. Con Let's Encrypt es gratis y se renueva solo.",
  "seo.http.redirect":
    "Todo el tráfico HTTP debe redirigirse a HTTPS con una redirección 301 permanente.",
  "social.og.title":
    "Falta <meta property=\"og:title\" content=\"…\"> con el título que debe verse al compartir.",
  "social.og.description":
    "Falta <meta property=\"og:description\"> con un resumen breve y concreto.",
  "social.og.image":
    "La imagen para compartir debe medir 1200×630 px y declararse en og:image con la URL absoluta completa, incluido https://",
  "social.twitter.card":
    "El <meta name=\"twitter:card\" content=\"summary_large_image\"> debe ir en el <head>.",
  // Updated deliberately: the previous sentence ("Conviene incluir un bloque
  // JSON-LD…") was false on both warn branches, where social.ts:84 has already
  // established that a block exists.
  "social.jsonld":
    "La página necesita un bloque JSON-LD válido, con el @type que corresponda (Organization, Product, Article, LocalBusiness…).",
  "social.favicon":
    "El <link rel=\"icon\" href=\"/favicon.svg\"> debe ir en el <head>.",
};

/**
 * The same, for English — which until now had no pin of any kind.
 *
 * The Spanish snapshot closes register *and* phrasing; this one is here for the
 * other rule, truthfulness, because English is where that rule kept breaking:
 * ten of the fourteen strings found asserting a state the checker never
 * observed were English, including the three fixed in the commit that added the
 * Spanish snapshot, and one more (social.jsonld) that the same commit left
 * behind in both languages.
 */
const EN_FIX_SNAPSHOT: Record<string, string> = {
  "seo.title.present":
    "Add a descriptive, unique <title> in the <head>, including the term you want to be found for.",
  "seo.title.length":
    "The title needs to be 30–60 characters, with the most important part first.",
  "seo.description.present":
    "Add <meta name=\"description\" content=\"…\"> with a concrete summary of what the page offers.",
  "seo.description.length":
    "The meta description needs to be 70 to 160 characters.",
  "seo.h1.unique":
    "Keep exactly one H1 per page, with the main topic. Everything else goes as H2 or H3.",
  "seo.headings.hierarchy":
    "Use headings in order, without skipping levels. If the jump is for visual reasons, change the size with CSS, not the level.",
  "seo.canonical":
    "The <link rel=\"canonical\"> must point to the absolute, definitive URL of this same page.",
  "seo.html.lang":
    "Add the lang attribute to the <html> tag, for example <html lang=\"en\">.",
  "seo.robots.txt":
    "The domain root must serve a robots.txt; a minimal one is enough, and it is where the sitemap location is declared.",
  "seo.sitemap":
    "The sitemap.xml must be generated and declared in robots.txt, with the line Sitemap: https://yourdomain.com/sitemap.xml",
  "seo.noindex":
    "Remove the noindex directive from the meta robots tag or the X-Robots-Tag header. It's usually left over from a staging environment.",
  "seo.hreflang":
    "Each version must list all alternatives, including itself, with valid language codes.",
  "seo.https":
    "The site must be served over HTTPS, with a TLS certificate. With Let's Encrypt it's free and renews itself.",
  "seo.http.redirect":
    "All HTTP traffic must redirect to HTTPS with a permanent 301.",
  "social.og.title":
    "Add <meta property=\"og:title\" content=\"…\"> with the title you want to show when shared.",
  "social.og.description":
    "Add <meta property=\"og:description\"> with a short, concrete summary.",
  "social.og.image":
    "The share image must be 1200×630 px and declared in og:image with the full absolute URL, including https://",
  "social.twitter.card":
    "Add <meta name=\"twitter:card\" content=\"summary_large_image\"> in the <head>.",
  "social.jsonld":
    "The page needs a valid JSON-LD block with the @type that applies (Organization, Product, Article, LocalBusiness…).",
  "social.favicon":
    "Add <link rel=\"icon\" href=\"/favicon.svg\"> in the <head>.",
};

/**
 * The truthfulness rule both snapshots protect, stated once so the two failure
 * messages cannot drift apart.
 */
const RENDER_RULE = [
  "A `fix` renders on `fail` and `warn`, and on nothing else.",
  "FindingItem.astro:43 hides it for `pass`, and an `na` result never gets that",
  "far: score.ts:55 rankFindings drops `na` before the report is assembled and",
  "FindingList.astro:17 refilters to fail|warn. The rule these strings are held",
  "to is deliberately stricter than that — a `fix` must be true on EVERY",
  "non-pass branch of its check, `na` included — so a string stays correct if",
  "the filtering ever changes. It may prescribe, but it may not assert a state",
  "the checker never observed: \"add a canonical\" is false on the branch where a",
  "canonical exists and points at another host.",
].join(" ");

const WHY_PINNED_ES = [
  "The Spanish `fix` strings are pinned exactly, on purpose, and this test and",
  "its English twin are the only things that read their text at all.",
  "If you are here because you changed one: that is fine, but the snapshot in",
  "tests/unit/i18n-audit.spec.ts must be updated deliberately, not to get green.",
  "Two rules to re-read first. (1) docs/voice.md: español neutro, SIN VOSEO —",
  "no \"agregá\", \"olvidate\", \"necesitás\", \"tenés\"; write impersonal or in the",
  "third person. (2)",
  RENDER_RULE,
].join(" ");

const WHY_PINNED_EN = [
  "The English `fix` strings are pinned exactly, on purpose. English carries no",
  "voseo constraint, so unlike its Spanish twin this snapshot exists for one",
  "rule only: truthfulness. English is where that rule kept breaking — ten of",
  "the fourteen strings caught asserting a state the checker never observed",
  "were English, and they reached half the tool's visitors for four tasks",
  "because nothing read them.",
  "If you are here because you changed one: update the snapshot deliberately,",
  "not to get green, and re-read the rule first.",
  RENDER_RULE,
].join(" ");

test.describe("check fix strings are pinned", () => {
  const fixes = (checks: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(checks).map(([id, copy]) => [id, (copy as { fix: string }).fix]),
    );

  test("every Spanish check fix string matches its snapshot exactly", () => {
    expect(fixes(es.audit.checks), WHY_PINNED_ES).toEqual(ES_FIX_SNAPSHOT);
  });

  test("every English check fix string matches its snapshot exactly", () => {
    expect(fixes(en.audit.checks), WHY_PINNED_EN).toEqual(EN_FIX_SNAPSHOT);
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
