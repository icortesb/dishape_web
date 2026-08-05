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
  "social.jsonld":
    "Conviene incluir un bloque JSON-LD con el tipo que corresponda (Organization, Product, Article, LocalBusiness…).",
  "social.favicon":
    "El <link rel=\"icon\" href=\"/favicon.svg\"> debe ir en el <head>.",
};

const WHY_PINNED = [
  "The Spanish `fix` strings are pinned exactly, on purpose, and this test is",
  "the only thing that reads their text at all.",
  "If you are here because you changed one: that is fine, but the snapshot in",
  "tests/unit/i18n-audit.spec.ts must be updated deliberately, not to get green.",
  "Two rules to re-read first. (1) docs/voice.md: español neutro, SIN VOSEO —",
  "no \"agregá\", \"olvidate\", \"necesitás\", \"tenés\"; write impersonal or in the",
  "third person. (2) FindingItem.astro hides `fix` only for `pass`, so the",
  "sentence renders on fail, warn AND na and must be true on every non-pass",
  "branch of its check — it may prescribe, but it may not assert a state the",
  "checker never observed.",
].join(" ");

test.describe("Spanish register guard", () => {
  test("every Spanish check fix string matches its snapshot exactly", () => {
    const actual = Object.fromEntries(
      Object.entries(es.audit.checks).map(([id, copy]) => [
        id,
        (copy as { fix: string }).fix,
      ]),
    );
    expect(actual, WHY_PINNED).toEqual(ES_FIX_SNAPSHOT);
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
