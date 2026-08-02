# Auditor de sitios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a free, ungated site-audit tool at `/auditoria` (+ `/en/audit`) that returns SEO/social findings in ~1s and fills in Core Web Vitals progressively, as an organic-traffic and lead-generation asset.

**Architecture:** Two-phase. `POST /api/audit` runs an SSRF-guarded fetch, parses the HTML with `node-html-parser`, executes ~20 pure check functions, persists a JSON record and returns an id. The report page renders immediately, then calls `GET /api/audit/<id>/vitals`, which hits the Google PageSpeed Insights API and merges the result into the stored record. No headless browser, no queue, no database.

**Tech Stack:** Astro 6 (`@astrojs/node` standalone), TypeScript, Tailwind v4 (PostCSS), `node-html-parser`, Google PageSpeed Insights API v5, Playwright (e2e *and* unit).

Spec: `docs/superpowers/specs/2026-08-01-auditor-sitios-design.md`

## Global Constraints

- **Astro server routes must opt out of prerender:** every file under `src/pages/api/` needs `export const prerender = false;`. Everything else in the site stays static.
- **Locale routing:** Spanish is served at `/` (`prefixDefaultLocale: false`), English under `/en/`. Never create an `/es/*` route.
- **All user-facing copy lives in `src/i18n/es.ts` and `src/i18n/en.ts`.** Both files must stay structurally identical — same keys, same shape. Never hardcode Spanish or English strings in a component.
- **Never use HTML comments (`<!-- -->`) in `.astro` files** — they ship to the production HTML. Use `{/* */}`, which does not.
- **`is:inline` scripts must contain raw JavaScript**, not an Astro expression wrapper. `<script is:inline>{`code`}</script>` silently no-ops; write `<script is:inline>code</script>`.
- **Tailwind v4 is wired through PostCSS** (`postcss.config.mjs`), not the Vite plugin. Do not add `@tailwindcss/vite`.
- **Design tokens** (from `src/styles/global.css` `@theme`): colors `base`, `surface`, `elevated`, `card`, `card-hover`, `line`, `accent`, `accent-light`, `ink`, `muted`, `faint`. Layout helper class `.shell`. Use these, never raw hex.
- **Voice:** neutral register, authority-by-diagnosis. State the problem and its cost; never claim results or use hype. See `docs/voice.md`.
- **Node 22** in CI and on the VPS.
- **Commit message trailer** on every commit:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YBpPyAfPcrMRceggz7pDWi
  ```
- Work happens on branch `feat/site-auditor`.

## File Structure

```
src/lib/audit/
  types.ts        · shared types for the whole module (no logic)
  normalizeUrl.ts · cache-key normalization
  safeFetch.ts    · SSRF-guarded fetch — the only dangerous module
  parse.ts        · SafeFetchOk → PageContext (+ best-effort robots/sitemap/og HEAD)
  checks/seo.ts   · 14 pure SEO check functions
  checks/social.ts· 6 pure OG/schema check functions
  checks/vitals.ts· PageSpeed Insights call + response mapping
  registry.ts     · the catalog: Check[] + runChecks()
  score.ts        · per-category score aggregation
  store.ts        · JSON persistence, URL cache index, TTL sweep
  rateLimit.ts    · in-memory per-IP token bucket
src/pages/api/audit.ts
src/pages/api/audit/[id]/vitals.ts
src/pages/auditoria/index.astro          · landing ES
src/pages/auditoria/r/[id].astro         · report ES
src/pages/en/audit/index.astro           · landing EN
src/pages/en/audit/r/[id].astro          · report EN
src/components/audit/
  UrlForm.astro       · the input + submit
  ScoreCards.astro    · the three category scores
  UrgentFindings.astro· the top three problems, above everything else
  FindingList.astro   · a category's findings, sorted
  FindingItem.astro   · one finding: status, evidence, fix
  VitalsPanel.astro   · lab + field Core Web Vitals, filled in async
  SharePreview.astro  · how the audited page looks when shared
  AuditCta.astro      · contextual CTA into the contact form
  ShareButton.astro   · copy the report link
src/scripts/audit.ts  · client: form submit, vitals polling, share button
tests/unit/*.spec.ts  · pure-function tests
tests/e2e/audit.spec.ts
playwright.unit.config.ts
```

`src/lib/audit/types.ts` holds every shared type so the check files, the API routes and the Astro pages import from one place and cannot drift.

### Test runner note

The repo has Playwright but no unit-test runner, and Node 22 cannot execute `.ts` without experimental flags. Rather than add a dependency, unit tests run **through Playwright** with a second config that has no `webServer` (so they don't trigger a build). Playwright handles TypeScript natively. This is set up in Task 1.

---

### Task 1: URL normalization + SSRF-guarded fetch

The security core. Everything else depends on it, and it is the only module that talks to attacker-controlled hosts. Sets up the unit-test harness too.

**Files:**
- Create: `playwright.unit.config.ts`
- Create: `src/lib/audit/types.ts`
- Create: `src/lib/audit/normalizeUrl.ts`
- Create: `src/lib/audit/safeFetch.ts`
- Create: `tests/unit/normalizeUrl.spec.ts`
- Create: `tests/unit/safeFetch.spec.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `normalizeUrl(input: string): string | null`
  - `safeFetch(rawUrl: string): Promise<SafeFetchResult>`
  - types `SafeFetchOk`, `SafeFetchResult`, `AuditErrorCode`

- [ ] **Step 1: Add the unit-test config and scripts**

Create `playwright.unit.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

// Unit tests for pure functions in src/lib. No webServer: these must never
// trigger a build. The e2e suite (playwright.config.ts) covers the real server.
export default defineConfig({
  testDir: "./tests/unit",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
});
```

In `package.json`, replace the `"test"` script and add two more:

```json
    "test": "npm run test:unit && npm run test:e2e",
    "test:unit": "playwright test -c playwright.unit.config.ts",
    "test:e2e": "playwright test",
    "test:ui": "playwright test --ui"
```

- [ ] **Step 2: Write the failing normalizeUrl test**

Create `tests/unit/normalizeUrl.spec.ts`:

```ts
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
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npm run test:unit -- normalizeUrl`
Expected: FAIL — cannot find module `src/lib/audit/normalizeUrl`.

- [ ] **Step 4: Write types.ts**

Create `src/lib/audit/types.ts`:

```ts
export type AuditErrorCode =
  | "url_invalid"
  | "url_blocked"
  | "url_unreachable"
  | "not_html"
  | "too_large"
  | "rate_limited";

export type SafeFetchOk = {
  ok: true;
  finalUrl: string;
  status: number;
  headers: Headers;
  html: string;
  bytes: number;
  redirects: number;
};

export type SafeFetchResult = SafeFetchOk | { ok: false; error: AuditErrorCode };
```

- [ ] **Step 5: Implement normalizeUrl**

Create `src/lib/audit/normalizeUrl.ts`:

```ts
/**
 * Canonical form used as the cache key. Two inputs that describe the same page
 * must produce the same string, so we force https, drop "www.", lowercase the
 * host, and discard query and hash (tracking params are not a different page).
 * Path case is preserved — paths are case-sensitive on most servers.
 *
 * Returns null for anything that is not a plausible http(s) URL.
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Bare hosts ("example.com") are the common user input; assume https.
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // A hostname with no dot is either localhost or a typo; neither is auditable.
  if (!url.hostname.includes(".")) return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "");

  return `https://${host}${path}`;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test:unit -- normalizeUrl`
Expected: PASS (6 tests).

- [ ] **Step 7: Write the failing safeFetch test**

Create `tests/unit/safeFetch.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { safeFetch, isBlockedAddress } from "../../src/lib/audit/safeFetch";

test.describe("isBlockedAddress", () => {
  const blocked = [
    "127.0.0.1",
    "127.53.1.9",
    "0.0.0.0",
    "10.0.0.5",
    "172.16.4.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata — the one that actually gets exploited
    "224.0.0.1",
    "::1",
    "fe80::1",
    "fc00::1",
  ];
  for (const ip of blocked) {
    test(`blocks ${ip}`, () => {
      expect(isBlockedAddress(ip)).toBe(true);
    });
  }

  const allowed = ["8.8.8.8", "1.1.1.1", "172.32.0.1", "11.0.0.1", "2606:4700::1"];
  for (const ip of allowed) {
    test(`allows ${ip}`, () => {
      expect(isBlockedAddress(ip)).toBe(false);
    });
  }
});

test.describe("safeFetch rejects hostile input", () => {
  test("non-http scheme", async () => {
    const r = await safeFetch("file:///etc/passwd");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("url_invalid");
  });

  test("embedded credentials", async () => {
    const r = await safeFetch("https://user:pass@example.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("url_invalid");
  });

  test("loopback host", async () => {
    const r = await safeFetch("http://127.0.0.1:8080/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("url_blocked");
  });

  test("localhost by name", async () => {
    const r = await safeFetch("http://localhost:4321/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("url_blocked");
  });

  test("cloud metadata endpoint", async () => {
    const r = await safeFetch("http://169.254.169.254/latest/meta-data/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("url_blocked");
  });
});
```

- [ ] **Step 8: Run it and confirm it fails**

Run: `npm run test:unit -- safeFetch`
Expected: FAIL — cannot find module `src/lib/audit/safeFetch`.

- [ ] **Step 9: Implement safeFetch**

Create `src/lib/audit/safeFetch.ts`:

```ts
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { SafeFetchResult } from "./types";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const UA =
  "Mozilla/5.0 (compatible; dishape-auditor/1.0; +https://dishape.dev/auditoria)";

/**
 * True when the address belongs to a range that must never be reachable from a
 * user-supplied URL: loopback, RFC1918 private space, link-local (which includes
 * the 169.254.169.254 cloud metadata endpoint), multicast and reserved.
 */
export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);

  if (version === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 127) return true;            // this-network, loopback
    if (a === 10) return true;                         // 10/8
    if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16/12
    if (a === 192 && b === 168) return true;           // 192.168/16
    if (a === 169 && b === 254) return true;           // link-local + metadata
    if (a >= 224) return true;                         // multicast + reserved
    return false;
  }

  if (version === 6) {
    const v6 = ip.toLowerCase();
    if (v6 === "::1" || v6 === "::") return true;
    if (v6.startsWith("fe80")) return true;                       // link-local
    if (/^f[cd]/.test(v6)) return true;                           // unique local
    // IPv4-mapped (::ffff:127.0.0.1) must be judged by its v4 part.
    const mapped = v6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedAddress(mapped[1]);
    return false;
  }

  return true; // not a parseable IP — refuse rather than guess
}

/** Resolve the hostname and refuse if any resolved address is blocked. */
async function assertPublicHost(hostname: string): Promise<boolean> {
  if (isIP(hostname)) return !isBlockedAddress(hostname);
  try {
    const addrs = await lookup(hostname, { all: true });
    if (addrs.length === 0) return false;
    return addrs.every((a) => !isBlockedAddress(a.address));
  } catch {
    return false;
  }
}

function validUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null; // credentials smuggling
  return url;
}

/**
 * Fetch a user-supplied URL with SSRF defenses. Redirects are followed manually
 * so every hop is validated — validating only the first hop is the classic hole:
 * a public host can 302 you straight to 169.254.169.254.
 */
export async function safeFetch(rawUrl: string): Promise<SafeFetchResult> {
  let current = validUrl(rawUrl);
  if (!current) return { ok: false, error: "url_invalid" };

  let redirects = 0;

  while (true) {
    if (!(await assertPublicHost(current.hostname))) {
      return { ok: false, error: "url_blocked" };
    }

    let res: Response;
    try {
      res = await fetch(current.href, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      });
    } catch {
      return { ok: false, error: "url_unreachable" };
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return { ok: false, error: "url_unreachable" };
      if (++redirects > MAX_REDIRECTS) return { ok: false, error: "url_unreachable" };
      const next = validUrl(new URL(location, current).href);
      if (!next) return { ok: false, error: "url_blocked" };
      current = next;
      continue;
    }

    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
      return { ok: false, error: "not_html" };
    }

    // Read by chunk and abort past the cap — content-length is attacker-controlled.
    const reader = res.body?.getReader();
    if (!reader) return { ok: false, error: "url_unreachable" };

    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        return { ok: false, error: "too_large" };
      }
      chunks.push(value);
    }

    return {
      ok: true,
      finalUrl: current.href,
      status: res.status,
      headers: res.headers,
      html: new TextDecoder().decode(await new Blob(chunks).arrayBuffer()),
      bytes,
      redirects,
    };
  }
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npm run test:unit -- safeFetch`
Expected: PASS (22 tests).

- [ ] **Step 11: Commit**

```bash
git add playwright.unit.config.ts package.json src/lib/audit tests/unit
git commit -m "$(cat <<'EOF'
feat(audit): SSRF-guarded fetch and URL normalization

Validates every redirect hop, not just the first — a public host can 302
into 169.254.169.254 otherwise. Adds a webServer-less Playwright config so
pure functions get unit tests without triggering a build.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YBpPyAfPcrMRceggz7pDWi
EOF
)"
```

---

### Task 2: HTML parsing → PageContext

**Files:**
- Create: `src/lib/audit/parse.ts`
- Create: `tests/unit/parse.spec.ts`
- Modify: `package.json` (add `node-html-parser`)
- Modify: `src/lib/audit/types.ts` (add `PageContext`)

**Interfaces:**
- Consumes: `SafeFetchOk` from Task 1.
- Produces: `buildPageContext(res: SafeFetchOk): Promise<PageContext>`, type `PageContext`.

- [ ] **Step 1: Install the parser**

```bash
npm install node-html-parser@^7.0.1
```

Regex over arbitrary HTML breaks on the first unusual site, and these checks are the product's proof of competence. `node-html-parser` is ~50 KB with no transitive dependencies.

- [ ] **Step 2: Add PageContext to types.ts**

Append to `src/lib/audit/types.ts`:

```ts
import type { HTMLElement } from "node-html-parser";

export type PageContext = {
  url: URL;
  status: number;
  headers: Headers;
  html: string;
  bytes: number;
  redirects: number;
  doc: HTMLElement;
  /** null when robots.txt could not be fetched at all. */
  robotsTxt: string | null;
  /** null when we never looked (no candidate URL). */
  sitemapOk: boolean | null;
  /** null when the page declares no og:image. */
  ogImageOk: boolean | null;
  /** true when http:// redirects to https:// for this host. */
  httpRedirectsToHttps: boolean | null;
};
```

- [ ] **Step 3: Write the failing test**

Create `tests/unit/parse.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { parse } from "node-html-parser";
import { extractMeta, extractJsonLd } from "../../src/lib/audit/parse";

test.describe("extractMeta", () => {
  test("reads name= and property= meta tags case-insensitively", () => {
    const doc = parse(`
      <meta name="description" content="una descripcion">
      <meta property="og:title" content="El titulo">
      <meta NAME="Twitter:Card" content="summary">
    `);
    expect(extractMeta(doc, "description")).toBe("una descripcion");
    expect(extractMeta(doc, "og:title")).toBe("El titulo");
    expect(extractMeta(doc, "twitter:card")).toBe("summary");
  });

  test("returns null when absent or empty", () => {
    const doc = parse(`<meta name="description" content="">`);
    expect(extractMeta(doc, "description")).toBeNull();
    expect(extractMeta(doc, "keywords")).toBeNull();
  });
});

test.describe("extractJsonLd", () => {
  test("parses valid ld+json blocks", () => {
    const doc = parse(`
      <script type="application/ld+json">{"@type":"Organization","name":"x"}</script>
    `);
    expect(extractJsonLd(doc)).toEqual([{ "@type": "Organization", name: "x" }]);
  });

  test("skips blocks that do not parse instead of throwing", () => {
    const doc = parse(`
      <script type="application/ld+json">{ broken json,,, }</script>
      <script type="application/ld+json">{"@type":"WebSite"}</script>
    `);
    expect(extractJsonLd(doc)).toEqual([{ "@type": "WebSite" }]);
  });

  test("flattens @graph containers", () => {
    const doc = parse(`
      <script type="application/ld+json">
        {"@graph":[{"@type":"A"},{"@type":"B"}]}
      </script>
    `);
    expect(extractJsonLd(doc)).toEqual([{ "@type": "A" }, { "@type": "B" }]);
  });
});
```

- [ ] **Step 4: Run it and confirm it fails**

Run: `npm run test:unit -- parse`
Expected: FAIL — cannot find module `src/lib/audit/parse`.

- [ ] **Step 5: Implement parse.ts**

Create `src/lib/audit/parse.ts`:

```ts
import { parse, type HTMLElement } from "node-html-parser";
import type { PageContext, SafeFetchOk } from "./types";

/** Read a meta tag by name= or property=, case-insensitively. Empty is null. */
export function extractMeta(doc: HTMLElement, key: string): string | null {
  const wanted = key.toLowerCase();
  for (const el of doc.querySelectorAll("meta")) {
    const id = (el.getAttribute("name") ?? el.getAttribute("property") ?? "").toLowerCase();
    if (id !== wanted) continue;
    const content = (el.getAttribute("content") ?? "").trim();
    return content || null;
  }
  return null;
}

/**
 * All JSON-LD objects on the page. Malformed blocks are skipped rather than
 * thrown — a broken block is itself a finding, not a reason to fail the audit.
 * `@graph` containers are flattened so callers see a flat list of entities.
 */
export function extractJsonLd(doc: HTMLElement): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const el of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown;
    try {
      data = JSON.parse(el.rawText);
    } catch {
      continue;
    }
    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      if (Array.isArray(obj["@graph"])) {
        for (const node of obj["@graph"]) {
          if (node && typeof node === "object") out.push(node as Record<string, unknown>);
        }
      } else {
        out.push(obj);
      }
    }
  }
  return out;
}

/** HEAD a URL and report whether it answered 2xx. Never throws. */
async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5_000),
      redirect: "follow",
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Does http:// for this origin end up on https://? */
async function checkHttpRedirect(origin: string): Promise<boolean | null> {
  try {
    const res = await fetch(origin.replace(/^https:/, "http:"), {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
    if (res.status < 300 || res.status >= 400) return false;
    const loc = res.headers.get("location") ?? "";
    return loc.startsWith("https:");
  } catch {
    return null;
  }
}

/**
 * Turn a fetched page into everything the check functions need. All the network
 * I/O the checks would otherwise want happens here, so every check stays a pure
 * function that can be tested with a fixture and no network.
 */
export async function buildPageContext(res: SafeFetchOk): Promise<PageContext> {
  const url = new URL(res.finalUrl);
  const doc = parse(res.html);
  const origin = url.origin;

  const ogImage = extractMeta(doc, "og:image");
  const ogImageAbsolute = ogImage
    ? (() => {
        try {
          return new URL(ogImage, url).href;
        } catch {
          return null;
        }
      })()
    : null;

  const [robotsTxt, ogImageOk, httpRedirectsToHttps] = await Promise.all([
    fetchText(`${origin}/robots.txt`),
    ogImageAbsolute ? headOk(ogImageAbsolute) : Promise.resolve(null),
    checkHttpRedirect(origin),
  ]);

  // Prefer a sitemap declared in robots.txt; fall back to the conventional path.
  const declared = robotsTxt?.match(/^\s*sitemap:\s*(\S+)/im)?.[1];
  const sitemapUrl = declared ?? `${origin}/sitemap.xml`;
  const sitemapOk = await headOk(sitemapUrl);

  return {
    url,
    status: res.status,
    headers: res.headers,
    html: res.html,
    bytes: res.bytes,
    redirects: res.redirects,
    doc,
    robotsTxt,
    sitemapOk,
    ogImageOk,
    httpRedirectsToHttps,
  };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test:unit -- parse`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/audit tests/unit
git commit -m "$(cat <<'EOF'
feat(audit): parse fetched HTML into a PageContext

All network I/O the checks would need happens here, so every check function
stays pure and testable with a fixture and no network.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YBpPyAfPcrMRceggz7pDWi
EOF
)"
```

---

### Task 3: SEO checks + registry

**Files:**
- Create: `src/lib/audit/checks/seo.ts`
- Create: `src/lib/audit/registry.ts`
- Create: `tests/unit/checks-seo.spec.ts`
- Modify: `src/lib/audit/types.ts` (add check types)

**Interfaces:**
- Consumes: `PageContext` from Task 2.
- Produces: `seoChecks: Check[]`, `registry: Check[]`, `runChecks(ctx: PageContext): CheckResult[]`, types `Check`, `CheckResult`, `CheckStatus`, `CheckCategory`, `Severity`.

- [ ] **Step 1: Add check types to types.ts**

Append to `src/lib/audit/types.ts`:

```ts
export type CheckStatus = "pass" | "warn" | "fail" | "na";
export type CheckCategory = "seo" | "social" | "perf";
export type Severity = "critical" | "important" | "minor";

export type CheckResult = {
  id: string;
  status: CheckStatus;
  /** Values interpolated into the localized "what we found" string. */
  evidence?: Record<string, string | number>;
};

export type Check = {
  id: string;
  category: CheckCategory;
  severity: Severity;
  run: (ctx: PageContext) => CheckResult;
};
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/checks-seo.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { parse } from "node-html-parser";
import { seoChecks } from "../../src/lib/audit/checks/seo";
import type { PageContext } from "../../src/lib/audit/types";

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

const run = (id: string, c: PageContext) => {
  const check = seoChecks.find((x) => x.id === id);
  if (!check) throw new Error(`no such check: ${id}`);
  return check.run(c);
};

test.describe("seo.title", () => {
  test("fails when there is no title", () => {
    expect(run("seo.title.present", ctx("<html><head></head></html>")).status).toBe("fail");
  });

  test("passes with a title", () => {
    expect(run("seo.title.present", ctx("<title>Hola</title>")).status).toBe("pass");
  });

  test("warns when the title is too long and reports the length", () => {
    const long = "a".repeat(87);
    const r = run("seo.title.length", ctx(`<title>${long}</title>`));
    expect(r.status).toBe("warn");
    expect(r.evidence).toMatchObject({ actual: 87, max: 60 });
  });

  test("is not applicable when there is no title to measure", () => {
    expect(run("seo.title.length", ctx("<html></html>")).status).toBe("na");
  });
});

test.describe("seo.h1.unique", () => {
  test("fails with zero h1", () => {
    const r = run("seo.h1.unique", ctx("<h2>x</h2>"));
    expect(r.status).toBe("fail");
    expect(r.evidence).toMatchObject({ actual: 0 });
  });

  test("fails with two h1", () => {
    const r = run("seo.h1.unique", ctx("<h1>a</h1><h1>b</h1>"));
    expect(r.status).toBe("fail");
    expect(r.evidence).toMatchObject({ actual: 2 });
  });

  test("passes with exactly one", () => {
    expect(run("seo.h1.unique", ctx("<h1>a</h1>")).status).toBe("pass");
  });
});

test.describe("seo.headings.hierarchy", () => {
  test("warns when a level is skipped", () => {
    const r = run("seo.headings.hierarchy", ctx("<h1>a</h1><h3>b</h3>"));
    expect(r.status).toBe("warn");
    expect(r.evidence).toMatchObject({ from: "h1", to: "h3" });
  });

  test("passes on a contiguous outline", () => {
    expect(run("seo.headings.hierarchy", ctx("<h1>a</h1><h2>b</h2><h3>c</h3>")).status).toBe("pass");
  });
});

test.describe("seo.canonical", () => {
  test("fails when absent", () => {
    expect(run("seo.canonical", ctx("<html></html>")).status).toBe("fail");
  });

  test("warns when it points at another host", () => {
    const r = run("seo.canonical", ctx('<link rel="canonical" href="https://otro.com/x">'));
    expect(r.status).toBe("warn");
  });

  test("passes on a same-host absolute canonical", () => {
    const html = '<link rel="canonical" href="https://example.com/pagina">';
    expect(run("seo.canonical", ctx(html)).status).toBe("pass");
  });
});

test.describe("seo.noindex", () => {
  test("fails on meta robots noindex", () => {
    expect(run("seo.noindex", ctx('<meta name="robots" content="noindex, follow">')).status).toBe("fail");
  });

  test("fails on the X-Robots-Tag header", () => {
    const c = ctx("<html></html>", { headers: new Headers({ "x-robots-tag": "noindex" }) });
    expect(run("seo.noindex", c).status).toBe("fail");
  });

  test("passes when indexable", () => {
    expect(run("seo.noindex", ctx('<meta name="robots" content="index, follow">')).status).toBe("pass");
  });
});

test.describe("seo.html.lang", () => {
  test("fails when missing", () => {
    expect(run("seo.html.lang", ctx("<html><body>x</body></html>")).status).toBe("fail");
  });

  test("passes when present", () => {
    expect(run("seo.html.lang", ctx('<html lang="es"><body>x</body></html>')).status).toBe("pass");
  });
});

test.describe("seo.hreflang", () => {
  test("is not applicable when the page declares none", () => {
    expect(run("seo.hreflang", ctx("<html></html>")).status).toBe("na");
  });

  test("warns when the set has no self-reference", () => {
    const html = '<link rel="alternate" hreflang="en" href="https://example.com/en/pagina">';
    expect(run("seo.hreflang", ctx(html)).status).toBe("warn");
  });

  test("passes with a self-referencing set", () => {
    const html = `
      <link rel="alternate" hreflang="es" href="https://example.com/pagina">
      <link rel="alternate" hreflang="en" href="https://example.com/en/pagina">
    `;
    expect(run("seo.hreflang", ctx(html)).status).toBe("pass");
  });
});

test.describe("seo.https and redirect", () => {
  test("fails when the final URL is http", () => {
    const c = ctx("<html></html>", { url: new URL("http://example.com/pagina") });
    expect(run("seo.https", c).status).toBe("fail");
  });

  test("fails when http does not redirect to https", () => {
    const c = ctx("<html></html>", { httpRedirectsToHttps: false });
    expect(run("seo.http.redirect", c).status).toBe("fail");
  });
});

test.describe("seo.robots.txt and sitemap", () => {
  test("warns when robots.txt is unreachable", () => {
    expect(run("seo.robots.txt", ctx("<html></html>", { robotsTxt: null })).status).toBe("warn");
  });

  test("fails when no sitemap is reachable", () => {
    expect(run("seo.sitemap", ctx("<html></html>", { sitemapOk: false })).status).toBe("fail");
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npm run test:unit -- checks-seo`
Expected: FAIL — cannot find module `src/lib/audit/checks/seo`.

- [ ] **Step 4: Implement the SEO checks**

Create `src/lib/audit/checks/seo.ts`:

```ts
import { extractMeta } from "../parse";
import type { Check, CheckResult, PageContext } from "../types";

const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESC_MIN = 70;
const DESC_MAX = 160;

const result = (
  id: string,
  status: CheckResult["status"],
  evidence?: CheckResult["evidence"],
): CheckResult => ({ id, status, evidence });

const titleOf = (ctx: PageContext) =>
  ctx.doc.querySelector("title")?.text.trim() || null;

export const seoChecks: Check[] = [
  {
    id: "seo.title.present",
    category: "seo",
    severity: "critical",
    run: (ctx) => {
      const title = titleOf(ctx);
      return title
        ? result("seo.title.present", "pass", { title })
        : result("seo.title.present", "fail");
    },
  },
  {
    id: "seo.title.length",
    category: "seo",
    severity: "minor",
    run: (ctx) => {
      const title = titleOf(ctx);
      if (!title) return result("seo.title.length", "na");
      const actual = title.length;
      const status = actual > TITLE_MAX || actual < TITLE_MIN ? "warn" : "pass";
      return result("seo.title.length", status, { actual, min: TITLE_MIN, max: TITLE_MAX });
    },
  },
  {
    id: "seo.description.present",
    category: "seo",
    severity: "important",
    run: (ctx) => {
      const desc = extractMeta(ctx.doc, "description");
      return desc
        ? result("seo.description.present", "pass")
        : result("seo.description.present", "fail");
    },
  },
  {
    id: "seo.description.length",
    category: "seo",
    severity: "minor",
    run: (ctx) => {
      const desc = extractMeta(ctx.doc, "description");
      if (!desc) return result("seo.description.length", "na");
      const actual = desc.length;
      const status = actual > DESC_MAX || actual < DESC_MIN ? "warn" : "pass";
      return result("seo.description.length", status, { actual, min: DESC_MIN, max: DESC_MAX });
    },
  },
  {
    id: "seo.h1.unique",
    category: "seo",
    severity: "important",
    run: (ctx) => {
      const actual = ctx.doc.querySelectorAll("h1").length;
      return result("seo.h1.unique", actual === 1 ? "pass" : "fail", { actual });
    },
  },
  {
    id: "seo.headings.hierarchy",
    category: "seo",
    severity: "minor",
    run: (ctx) => {
      const levels = ctx.doc
        .querySelectorAll("h1,h2,h3,h4,h5,h6")
        .map((el) => Number(el.tagName[1]));
      if (levels.length === 0) return result("seo.headings.hierarchy", "na");
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] - levels[i - 1] > 1) {
          return result("seo.headings.hierarchy", "warn", {
            from: `h${levels[i - 1]}`,
            to: `h${levels[i]}`,
          });
        }
      }
      return result("seo.headings.hierarchy", "pass");
    },
  },
  {
    id: "seo.canonical",
    category: "seo",
    severity: "important",
    run: (ctx) => {
      const href = ctx.doc.querySelector('link[rel="canonical"]')?.getAttribute("href");
      if (!href) return result("seo.canonical", "fail");
      let resolved: URL;
      try {
        resolved = new URL(href, ctx.url);
      } catch {
        return result("seo.canonical", "fail", { found: href });
      }
      if (resolved.host !== ctx.url.host) {
        return result("seo.canonical", "warn", { found: resolved.href });
      }
      return result("seo.canonical", "pass", { found: resolved.href });
    },
  },
  {
    id: "seo.html.lang",
    category: "seo",
    severity: "important",
    run: (ctx) => {
      const lang = ctx.doc.querySelector("html")?.getAttribute("lang")?.trim();
      return lang
        ? result("seo.html.lang", "pass", { found: lang })
        : result("seo.html.lang", "fail");
    },
  },
  {
    id: "seo.robots.txt",
    category: "seo",
    severity: "minor",
    run: (ctx) =>
      ctx.robotsTxt === null
        ? result("seo.robots.txt", "warn")
        : result("seo.robots.txt", "pass"),
  },
  {
    id: "seo.sitemap",
    category: "seo",
    severity: "important",
    run: (ctx) =>
      ctx.sitemapOk ? result("seo.sitemap", "pass") : result("seo.sitemap", "fail"),
  },
  {
    id: "seo.noindex",
    category: "seo",
    severity: "critical",
    run: (ctx) => {
      const meta = (extractMeta(ctx.doc, "robots") ?? "").toLowerCase();
      const header = (ctx.headers.get("x-robots-tag") ?? "").toLowerCase();
      const blocked = meta.includes("noindex") || header.includes("noindex");
      return blocked
        ? result("seo.noindex", "fail", { source: meta.includes("noindex") ? "meta" : "header" })
        : result("seo.noindex", "pass");
    },
  },
  {
    id: "seo.hreflang",
    category: "seo",
    severity: "minor",
    run: (ctx) => {
      const links = ctx.doc.querySelectorAll('link[rel="alternate"][hreflang]');
      if (links.length === 0) return result("seo.hreflang", "na");

      const entries = links.map((el) => ({
        lang: (el.getAttribute("hreflang") ?? "").toLowerCase(),
        href: el.getAttribute("href") ?? "",
      }));

      const selfRef = entries.some((e) => {
        try {
          return new URL(e.href, ctx.url).href.replace(/\/$/, "") ===
            ctx.url.href.replace(/\/$/, "");
        } catch {
          return false;
        }
      });
      if (!selfRef) {
        return result("seo.hreflang", "warn", { count: entries.length, reason: "no-self" });
      }

      // Valid: a BCP-47-ish code, or the x-default sentinel.
      const invalid = entries.filter(
        (e) => e.lang !== "x-default" && !/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(e.lang),
      );
      if (invalid.length > 0) {
        return result("seo.hreflang", "warn", { count: invalid.length, reason: "invalid-code" });
      }

      return result("seo.hreflang", "pass", { count: entries.length });
    },
  },
  {
    id: "seo.https",
    category: "seo",
    severity: "critical",
    run: (ctx) =>
      ctx.url.protocol === "https:"
        ? result("seo.https", "pass")
        : result("seo.https", "fail"),
  },
  {
    id: "seo.http.redirect",
    category: "seo",
    severity: "important",
    run: (ctx) => {
      if (ctx.httpRedirectsToHttps === null) return result("seo.http.redirect", "na");
      return ctx.httpRedirectsToHttps
        ? result("seo.http.redirect", "pass")
        : result("seo.http.redirect", "fail");
    },
  },
];
```

- [ ] **Step 5: Implement the registry**

Create `src/lib/audit/registry.ts`:

```ts
import { seoChecks } from "./checks/seo";
import type { Check, CheckResult, PageContext } from "./types";

/**
 * The catalog. Adding a check is: append an entry here (via its category file)
 * and add its strings under `audit.checks.<id>` in src/i18n/{es,en}.ts.
 */
export const registry: Check[] = [...seoChecks];

export const checkById = new Map(registry.map((c) => [c.id, c]));

/**
 * Run every check. A check that throws is reported as "na" rather than taking
 * the whole audit down — one bad selector on one weird site must not 500.
 */
export function runChecks(ctx: PageContext): CheckResult[] {
  return registry.map((check) => {
    try {
      return check.run(ctx);
    } catch {
      return { id: check.id, status: "na" as const };
    }
  });
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test:unit -- checks-seo`
Expected: PASS (24 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/audit tests/unit
git commit -m "$(cat <<'EOF'
feat(audit): SEO checks and the check registry

Fourteen pure checks over PageContext. A throwing check degrades to "na"
instead of failing the whole audit — one odd site must not 500 the endpoint.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YBpPyAfPcrMRceggz7pDWi
EOF
)"
```

---

### Task 4: Social / schema checks

**Files:**
- Create: `src/lib/audit/checks/social.ts`
- Create: `tests/unit/checks-social.spec.ts`
- Modify: `src/lib/audit/registry.ts`

**Interfaces:**
- Consumes: `PageContext`, `Check`, `extractMeta`, `extractJsonLd`.
- Produces: `socialChecks: Check[]`, appended to `registry`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/checks-social.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { parse } from "node-html-parser";
import { socialChecks } from "../../src/lib/audit/checks/social";
import type { PageContext } from "../../src/lib/audit/types";

function ctx(html: string, over: Partial<PageContext> = {}): PageContext {
  return {
    url: new URL("https://example.com/pagina"),
    status: 200,
    headers: new Headers(),
    html,
    bytes: html.length,
    redirects: 0,
    doc: parse(html),
    robotsTxt: null,
    sitemapOk: true,
    ogImageOk: true,
    httpRedirectsToHttps: true,
    ...over,
  };
}

const run = (id: string, c: PageContext) => {
  const check = socialChecks.find((x) => x.id === id);
  if (!check) throw new Error(`no such check: ${id}`);
  return check.run(c);
};

test.describe("og tags", () => {
  test("fails when og:title is missing", () => {
    expect(run("social.og.title", ctx("<html></html>")).status).toBe("fail");
  });

  test("passes and reports the value found", () => {
    const r = run("social.og.title", ctx('<meta property="og:title" content="Titulo">'));
    expect(r.status).toBe("pass");
    expect(r.evidence).toMatchObject({ found: "Titulo" });
  });
});

test.describe("social.og.image", () => {
  test("fails when there is no og:image", () => {
    expect(run("social.og.image", ctx("<html></html>")).status).toBe("fail");
  });

  test("fails when the image URL does not resolve to a 2xx", () => {
    const html = '<meta property="og:image" content="https://example.com/no.png">';
    const r = run("social.og.image", ctx(html, { ogImageOk: false }));
    expect(r.status).toBe("fail");
    expect(r.evidence).toMatchObject({ reason: "unreachable" });
  });

  test("warns when the URL is relative", () => {
    const html = '<meta property="og:image" content="/og.png">';
    const r = run("social.og.image", ctx(html));
    expect(r.status).toBe("warn");
    expect(r.evidence).toMatchObject({ reason: "relative" });
  });

  test("passes on an absolute, reachable image", () => {
    const html = '<meta property="og:image" content="https://example.com/og.png">';
    expect(run("social.og.image", ctx(html)).status).toBe("pass");
  });
});

test.describe("social.jsonld", () => {
  test("fails when there is none", () => {
    expect(run("social.jsonld", ctx("<html></html>")).status).toBe("fail");
  });

  test("warns when a block is present but has no @type", () => {
    const html = '<script type="application/ld+json">{"name":"x"}</script>';
    expect(run("social.jsonld", ctx(html)).status).toBe("warn");
  });

  test("passes and lists the types found", () => {
    const html = '<script type="application/ld+json">{"@type":"Organization"}</script>';
    const r = run("social.jsonld", ctx(html));
    expect(r.status).toBe("pass");
    expect(r.evidence).toMatchObject({ types: "Organization" });
  });
});

test.describe("social.favicon", () => {
  test("warns when no icon link is declared", () => {
    expect(run("social.favicon", ctx("<html></html>")).status).toBe("warn");
  });

  test("passes with a rel=icon link", () => {
    expect(run("social.favicon", ctx('<link rel="icon" href="/f.svg">')).status).toBe("pass");
  });
});

test.describe("social.twitter.card", () => {
  test("warns when absent", () => {
    expect(run("social.twitter.card", ctx("<html></html>")).status).toBe("warn");
  });

  test("passes when present", () => {
    const html = '<meta name="twitter:card" content="summary_large_image">';
    expect(run("social.twitter.card", ctx(html)).status).toBe("pass");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run test:unit -- checks-social`
Expected: FAIL — cannot find module `src/lib/audit/checks/social`.

- [ ] **Step 3: Implement the social checks**

Create `src/lib/audit/checks/social.ts`:

```ts
import { extractJsonLd, extractMeta } from "../parse";
import type { Check, CheckResult } from "../types";

const result = (
  id: string,
  status: CheckResult["status"],
  evidence?: CheckResult["evidence"],
): CheckResult => ({ id, status, evidence });

export const socialChecks: Check[] = [
  {
    id: "social.og.title",
    category: "social",
    severity: "important",
    run: (ctx) => {
      const found = extractMeta(ctx.doc, "og:title");
      return found
        ? result("social.og.title", "pass", { found })
        : result("social.og.title", "fail");
    },
  },
  {
    id: "social.og.description",
    category: "social",
    severity: "important",
    run: (ctx) => {
      const found = extractMeta(ctx.doc, "og:description");
      return found
        ? result("social.og.description", "pass", { found })
        : result("social.og.description", "fail");
    },
  },
  {
    id: "social.og.image",
    category: "social",
    severity: "critical",
    run: (ctx) => {
      const raw = extractMeta(ctx.doc, "og:image");
      if (!raw) return result("social.og.image", "fail", { reason: "missing" });

      const isAbsolute = /^https?:\/\//i.test(raw);
      if (ctx.ogImageOk === false) {
        return result("social.og.image", "fail", { reason: "unreachable", found: raw });
      }
      // Some scrapers refuse to resolve relative og:image URLs.
      if (!isAbsolute) {
        return result("social.og.image", "warn", { reason: "relative", found: raw });
      }
      return result("social.og.image", "pass", { found: raw });
    },
  },
  {
    id: "social.twitter.card",
    category: "social",
    severity: "minor",
    run: (ctx) => {
      const found = extractMeta(ctx.doc, "twitter:card");
      return found
        ? result("social.twitter.card", "pass", { found })
        : result("social.twitter.card", "warn");
    },
  },
  {
    id: "social.jsonld",
    category: "social",
    severity: "important",
    run: (ctx) => {
      const hasBlocks =
        ctx.doc.querySelectorAll('script[type="application/ld+json"]').length > 0;
      const items = extractJsonLd(ctx.doc);

      if (!hasBlocks) return result("social.jsonld", "fail", { reason: "missing" });
      if (items.length === 0) return result("social.jsonld", "warn", { reason: "unparseable" });

      const types = items
        .map((i) => i["@type"])
        .filter((t): t is string => typeof t === "string");
      if (types.length === 0) return result("social.jsonld", "warn", { reason: "no-type" });

      return result("social.jsonld", "pass", { types: types.join(", ") });
    },
  },
  {
    id: "social.favicon",
    category: "social",
    severity: "minor",
    run: (ctx) => {
      const icon = ctx.doc.querySelector(
        'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
      );
      return icon ? result("social.favicon", "pass") : result("social.favicon", "warn");
    },
  },
];
```

- [ ] **Step 4: Register them**

In `src/lib/audit/registry.ts`, add the import and extend the array:

```ts
import { seoChecks } from "./checks/seo";
import { socialChecks } from "./checks/social";
```

```ts
export const registry: Check[] = [...seoChecks, ...socialChecks];
```

- [ ] **Step 5: Run the whole unit suite**

Run: `npm run test:unit`
Expected: PASS (all tests from Tasks 1-4).

- [ ] **Step 6: Commit**

```bash
git add src/lib/audit tests/unit
git commit -m "$(cat <<'EOF'
feat(audit): Open Graph, Twitter card and JSON-LD checks

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YBpPyAfPcrMRceggz7pDWi
EOF
)"
```

---

### Task 5: Score aggregation

**Files:**
- Create: `src/lib/audit/score.ts`
- Create: `tests/unit/score.spec.ts`

**Interfaces:**
- Consumes: `CheckResult`, `Check`, `registry`, `Severity`.
- Produces: `scoreCategory(results, category): CategoryScore`, `rankFindings(results): CheckResult[]`, type `CategoryScore`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/score.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run test:unit -- score`
Expected: FAIL — cannot find module `src/lib/audit/score`.

- [ ] **Step 3: Implement score.ts**

Create `src/lib/audit/score.ts`:

```ts
import { checkById } from "./registry";
import type { CheckCategory, CheckResult, Severity } from "./types";

export type CategoryScore = {
  /** Checks that fully passed. */
  passed: number;
  /** Applicable checks — "na" excluded. */
  total: number;
  /** 0-100, warn worth half a pass. */
  percent: number;
};

const WEIGHT: Record<CheckResult["status"], number> = {
  pass: 1,
  warn: 0.5,
  fail: 0,
  na: 0,
};

/**
 * Per-category score. "na" checks leave the denominator — penalizing a site for
 * a check that does not apply to it would be dishonest, and the number is shown
 * next to its raw count so anyone can verify it.
 */
export function scoreCategory(
  results: CheckResult[],
  category: CheckCategory,
): CategoryScore {
  const mine = results.filter((r) => checkById.get(r.id)?.category === category);
  const applicable = mine.filter((r) => r.status !== "na");

  if (applicable.length === 0) return { passed: 0, total: 0, percent: 0 };

  const earned = applicable.reduce((sum, r) => sum + WEIGHT[r.status], 0);
  return {
    passed: applicable.filter((r) => r.status === "pass").length,
    total: applicable.length,
    percent: Math.round((earned / applicable.length) * 100),
  };
}

const STATUS_ORDER: Record<CheckResult["status"], number> = {
  fail: 0,
  warn: 1,
  pass: 2,
  na: 3,
};
const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  important: 1,
  minor: 2,
};

/** Findings sorted the way the report reads them: worst first. "na" is dropped. */
export function rankFindings(results: CheckResult[]): CheckResult[] {
  return results
    .filter((r) => r.status !== "na")
    .sort((a, b) => {
      const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (byStatus !== 0) return byStatus;
      const sa = checkById.get(a.id)?.severity ?? "minor";
      const sb = checkById.get(b.id)?.severity ?? "minor";
      return SEVERITY_ORDER[sa] - SEVERITY_ORDER[sb];
    });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- score`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit/score.ts tests/unit/score.spec.ts
git commit -m "$(cat <<'EOF'
feat(audit): per-category scoring and finding ranking

No invented global score: performance shows Google's number, the other two
show a verifiable pass ratio with the raw count beside it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YBpPyAfPcrMRceggz7pDWi
EOF
)"
```

---

### Task 6: Persistence store

**Files:**
- Create: `src/lib/audit/store.ts`
- Create: `tests/unit/store.spec.ts`
- Modify: `src/lib/audit/types.ts` (add `AuditRecord`)
- Modify: `.env.example`
- Modify: `SETUP.md`

**Interfaces:**
- Consumes: `CheckResult`, `VitalsResult` (declared here, produced in Task 9).
- Produces: `saveAudit`, `getAudit`, `updateAudit`, `findCachedByUrl`, `newAuditId`, type `AuditRecord`.

- [ ] **Step 1: Add AuditRecord and VitalsResult to types.ts**

Append to `src/lib/audit/types.ts`:

```ts
export type VitalsResult = {
  /** Lighthouse performance score, 0-100. */
  score: number | null;
  /** Lab metrics, in ms except cls. INP has no lab equivalent — TBT proxies it. */
  lab: {
    lcp: number | null;
    cls: number | null;
    tbt: number | null;
    fcp: number | null;
  };
  /** Real-user data from CrUX. null when the origin has too little traffic. */
  field: { lcp: number | null; cls: number | null; inp: number | null } | null;
  transferBytes: number | null;
  renderBlockingMs: number | null;
  imageSavingsBytes: number | null;
};

export type AuditRecord = {
  id: string;
  url: string;
  normalizedUrl: string;
  createdAt: string;
  lang: "es" | "en";
  page: {
    status: number;
    finalUrl: string;
    redirects: number;
    bytes: number;
    title: string | null;
  };
  checks: CheckResult[];
  vitals: VitalsResult | null;
  vitalsError: string | null;
};
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/store.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as store from "../../src/lib/audit/store";
import type { AuditRecord } from "../../src/lib/audit/types";

// store.ts reads AUDIT_DATA_DIR at call time rather than at module load, so a
// plain import is enough — each test just repoints the env var at its own
// throwaway directory. (Re-importing per test would not work: Playwright
// caches modules, and a query-string cache-buster does not apply to TS paths.)
async function freshStore() {
  const dir = await mkdtemp(join(tmpdir(), "audit-store-"));
  process.env.AUDIT_DATA_DIR = dir;
  return { dir, ...store };
}

const record = (over: Partial<AuditRecord> = {}): AuditRecord => ({
  id: "abc12345",
  url: "https://example.com/",
  normalizedUrl: "https://example.com",
  createdAt: new Date().toISOString(),
  lang: "es",
  page: { status: 200, finalUrl: "https://example.com/", redirects: 0, bytes: 100, title: "x" },
  checks: [{ id: "seo.title.present", status: "pass" }],
  vitals: null,
  vitalsError: null,
  ...over,
});

// These cases mutate a shared process.env value, so they must not interleave.
test.describe.configure({ mode: "serial" });

test.describe("store", () => {
  test("round-trips a record", async () => {
    const { dir, saveAudit, getAudit } = await freshStore();
    await saveAudit(record());
    expect((await getAudit("abc12345"))?.url).toBe("https://example.com/");
    await rm(dir, { recursive: true, force: true });
  });

  test("returns null for an unknown id", async () => {
    const { dir, getAudit } = await freshStore();
    expect(await getAudit("nope0000")).toBeNull();
    await rm(dir, { recursive: true, force: true });
  });

  test("refuses ids that are not plain alphanumerics (path traversal)", async () => {
    const { dir, getAudit } = await freshStore();
    expect(await getAudit("../../etc/passwd")).toBeNull();
    await rm(dir, { recursive: true, force: true });
  });

  test("finds a cached record by normalized url within the window", async () => {
    const { dir, saveAudit, findCachedByUrl } = await freshStore();
    await saveAudit(record());
    expect(await findCachedByUrl("https://example.com", 60_000)).toBe("abc12345");
    await rm(dir, { recursive: true, force: true });
  });

  test("ignores a cached record older than the window", async () => {
    const { dir, saveAudit, findCachedByUrl } = await freshStore();
    const old = new Date(Date.now() - 48 * 3600_000).toISOString();
    await saveAudit(record({ createdAt: old }));
    expect(await findCachedByUrl("https://example.com", 24 * 3600_000)).toBeNull();
    await rm(dir, { recursive: true, force: true });
  });

  test("merges a patch into an existing record", async () => {
    const { dir, saveAudit, updateAudit, getAudit } = await freshStore();
    await saveAudit(record());
    await updateAudit("abc12345", {
      vitals: {
        score: 88,
        lab: { lcp: 1200, cls: 0.02, tbt: 90, fcp: 900 },
        field: null,
        transferBytes: 500_000,
        renderBlockingMs: 120,
        imageSavingsBytes: 0,
      },
    });
    const after = await getAudit("abc12345");
    expect(after?.vitals?.score).toBe(88);
    expect(after?.url).toBe("https://example.com/"); // untouched
    await rm(dir, { recursive: true, force: true });
  });

  test("newAuditId produces distinct url-safe ids", async () => {
    const { dir, newAuditId } = await freshStore();
    const ids = new Set(Array.from({ length: 200 }, () => newAuditId()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]{8}$/);
    await rm(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npm run test:unit -- store`
Expected: FAIL — cannot find module `src/lib/audit/store`.

- [ ] **Step 4: Implement store.ts**

Create `src/lib/audit/store.ts`:

```ts
import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AuditRecord } from "./types";

const TTL_MS = 30 * 24 * 3600_000; // 30 days
const ID_RE = /^[a-z0-9]{8}$/;

/**
 * Read at call time, not at module load: the value must point OUTSIDE the
 * release directory (the VPS deploy does `git reset --hard`, and /opt/dishape
 * is replaced wholesale), and tests point it at a temp dir per case.
 */
const dataDir = () => process.env.AUDIT_DATA_DIR ?? "/var/lib/dishape/audits";

const recordPath = (id: string) => join(dataDir(), `${id}.json`);

export function newAuditId(): string {
  // 5 bytes → 8 base36 chars. Random, not sequential: the id must not leak volume.
  return randomBytes(5).toString("hex").slice(0, 8).replace(/[^a-z0-9]/g, "0");
}

async function ensureDir(): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
}

export async function saveAudit(record: AuditRecord): Promise<void> {
  await ensureDir();
  await writeFile(recordPath(record.id), JSON.stringify(record), "utf8");
  void sweep(); // fire-and-forget; a failed sweep must never fail a request
}

export async function getAudit(id: string): Promise<AuditRecord | null> {
  // Reject anything that is not a plain id before it reaches the filesystem.
  if (!ID_RE.test(id)) return null;
  try {
    return JSON.parse(await readFile(recordPath(id), "utf8")) as AuditRecord;
  } catch {
    return null;
  }
}

export async function updateAudit(
  id: string,
  patch: Partial<AuditRecord>,
): Promise<AuditRecord | null> {
  const current = await getAudit(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  await writeFile(recordPath(id), JSON.stringify(next), "utf8");
  return next;
}

/** Id of a recent audit for this normalized URL, or null. */
export async function findCachedByUrl(
  normalizedUrl: string,
  maxAgeMs: number,
): Promise<string | null> {
  await ensureDir();
  let files: string[];
  try {
    files = await readdir(dataDir());
  } catch {
    return null;
  }

  const cutoff = Date.now() - maxAgeMs;
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const rec = JSON.parse(
        await readFile(join(dataDir(), file), "utf8"),
      ) as AuditRecord;
      if (rec.normalizedUrl !== normalizedUrl) continue;
      if (Date.parse(rec.createdAt) < cutoff) continue;
      return rec.id;
    } catch {
      continue;
    }
  }
  return null;
}

/** Drop records past the TTL. Lazy — runs after a write, no cron needed. */
async function sweep(): Promise<void> {
  try {
    const files = await readdir(dataDir());
    const cutoff = Date.now() - TTL_MS;
    await Promise.all(
      files.map(async (file) => {
        if (!file.endsWith(".json")) return;
        const path = join(dataDir(), file);
        const info = await stat(path);
        if (info.mtimeMs < cutoff) await rm(path, { force: true });
      }),
    );
  } catch {
    // Sweeping is housekeeping; failing it must not surface to the user.
  }
}
```

Note on `findCachedByUrl`: it scans the directory. At this volume that is fine and it removes a whole class of index-consistency bugs. If the directory ever grows past a few thousand files, add the `index.json` map described in the spec.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:unit -- store`
Expected: PASS (7 tests).

- [ ] **Step 6: Document the new environment variable**

In `.env.example`, add before the `# ── Server` block:

```
# ── Site auditor (/auditoria) ────────────────────────────────────
# Where audit reports are stored as JSON. MUST live outside the release
# directory: the VPS deploy does `git reset --hard` on /opt/dishape.
AUDIT_DATA_DIR=/var/lib/dishape/audits
```

In `SETUP.md`, add a short section explaining that the directory must exist and be writable by the service user:

```bash
sudo mkdir -p /var/lib/dishape/audits
sudo chown dishape:dishape /var/lib/dishape/audits
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/audit tests/unit .env.example SETUP.md
git commit -m "$(cat <<'EOF'
feat(audit): JSON record store with URL cache and TTL sweep

AUDIT_DATA_DIR must sit outside the release dir — the VPS deploy replaces
/opt/dishape wholesale. Ids are validated against a strict pattern before
touching the filesystem.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YBpPyAfPcrMRceggz7pDWi
EOF
)"
```

---

### Task 7: Rate limiting

**Files:**
- Create: `src/lib/audit/rateLimit.ts`
- Create: `tests/unit/rateLimit.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `takeToken(ip: string, now?: number): boolean`, `clientIp(request: Request): string`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/rateLimit.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { takeToken, clientIp, LIMIT, WINDOW_MS } from "../../src/lib/audit/rateLimit";

test.describe("takeToken", () => {
  test("allows up to the limit then refuses", () => {
    const ip = `test-${Math.random()}`;
    for (let i = 0; i < LIMIT; i++) expect(takeToken(ip)).toBe(true);
    expect(takeToken(ip)).toBe(false);
  });

  test("refills once the window has passed", () => {
    const ip = `test-${Math.random()}`;
    const t0 = 1_000_000;
    for (let i = 0; i < LIMIT; i++) expect(takeToken(ip, t0)).toBe(true);
    expect(takeToken(ip, t0)).toBe(false);
    expect(takeToken(ip, t0 + WINDOW_MS + 1)).toBe(true);
  });

  test("tracks each ip separately", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < LIMIT; i++) takeToken(a);
    expect(takeToken(a)).toBe(false);
    expect(takeToken(b)).toBe(true);
  });
});

test.describe("clientIp", () => {
  test("takes the first entry of X-Forwarded-For (nginx sits in front)", () => {
    const req = new Request("https://dishape.dev/api/audit", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("203.0.113.9");
  });

  test("falls back to a constant when the header is absent", () => {
    const req = new Request("https://dishape.dev/api/audit");
    expect(clientIp(req)).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run test:unit -- rateLimit`
Expected: FAIL — cannot find module `src/lib/audit/rateLimit`.

- [ ] **Step 3: Implement rateLimit.ts**

Create `src/lib/audit/rateLimit.ts`:

```ts
export const LIMIT = 5;
export const WINDOW_MS = 15 * 60_000; // 15 minutes

type Bucket = { count: number; resetAt: number };

// In-memory is correct here: the site runs as a single Node process behind
// nginx. If that ever becomes several processes, this needs shared state.
const buckets = new Map<string, Bucket>();

/** Consume one token for this ip. False when the caller is over the limit. */
export function takeToken(ip: string, now = Date.now()): boolean {
  const bucket = buckets.get(ip);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (buckets.size > 10_000) prune(now);
    return true;
  }

  if (bucket.count >= LIMIT) return false;
  bucket.count += 1;
  return true;
}

function prune(now: number): void {
  for (const [ip, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(ip);
  }
}

/**
 * The real client address. nginx proxies to the Node server, so the socket
 * address is always 127.0.0.1 — the first X-Forwarded-For entry is the client.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- rateLimit`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit/rateLimit.ts tests/unit/rateLimit.spec.ts
git commit -m "$(cat <<'EOF'
feat(audit): per-IP token bucket rate limiting

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YBpPyAfPcrMRceggz7pDWi
EOF
)"
```

---

### Task 8: `POST /api/audit`

Wires Tasks 1-7 into the phase-one endpoint. First task with an e2e test.

**Files:**
- Create: `src/pages/api/audit.ts`
- Create: `tests/e2e/audit.spec.ts`

**Interfaces:**
- Consumes: `normalizeUrl`, `safeFetch`, `buildPageContext`, `runChecks`, `saveAudit`, `findCachedByUrl`, `newAuditId`, `takeToken`, `clientIp`.
- Produces: `POST /api/audit` → `{ ok: true, id, cached }` | `{ ok: false, error }`.

- [ ] **Step 1: Write the failing e2e test**

Create `tests/e2e/audit.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// The audit endpoint fetches a user-supplied URL. These tests pin the
// failure modes that matter: bad input must be rejected before any fetch,
// and internal addresses must never be reachable through the tool.
test.describe("POST /api/audit — input rejection", () => {
  const cases: { name: string; url: string; error: string }[] = [
    { name: "empty", url: "", error: "url_invalid" },
    { name: "garbage", url: "not a url", error: "url_invalid" },
    { name: "javascript scheme", url: "javascript:alert(1)", error: "url_invalid" },
    { name: "loopback", url: "http://127.0.0.1:4321/", error: "url_blocked" },
    { name: "localhost", url: "http://localhost:4321/", error: "url_blocked" },
    { name: "cloud metadata", url: "http://169.254.169.254/", error: "url_blocked" },
  ];

  for (const c of cases) {
    test(`rejects ${c.name}`, async ({ request }) => {
      const res = await request.post("/api/audit", {
        data: { url: c.url, lang: "es" },
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe(c.error);
    });
  }

  test("rejects a malformed body", async ({ request }) => {
    const res = await request.post("/api/audit", {
      headers: { "content-type": "application/json" },
      data: "not json at all",
    });
    expect(res.status()).toBe(400);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run test:e2e -- audit`
Expected: FAIL — every case returns 404 (the route does not exist).

- [ ] **Step 3: Implement the endpoint**

Create `src/pages/api/audit.ts`:

```ts
import type { APIRoute } from "astro";
import { normalizeUrl } from "../../lib/audit/normalizeUrl";
import { safeFetch } from "../../lib/audit/safeFetch";
import { buildPageContext } from "../../lib/audit/parse";
import { runChecks } from "../../lib/audit/registry";
import { findCachedByUrl, newAuditId, saveAudit } from "../../lib/audit/store";
import { clientIp, takeToken } from "../../lib/audit/rateLimit";
import type { AuditRecord } from "../../lib/audit/types";

// On-demand (server) route — everything else stays static.
export const prerender = false;

const CACHE_MS = 24 * 3600_000;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "url_invalid" }, 400);
  }

  const raw = String(body.url ?? "").trim();
  const lang = body.lang === "en" ? "en" : "es";

  const normalized = normalizeUrl(raw);
  if (!normalized) return json({ ok: false, error: "url_invalid" }, 400);

  // Serve a recent audit of the same page before spending a token: a repeat
  // visit is not abuse, and it protects the PageSpeed quota.
  const cachedId = await findCachedByUrl(normalized, CACHE_MS);
  if (cachedId) return json({ ok: true, id: cachedId, cached: true });

  if (!takeToken(clientIp(request))) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  const fetched = await safeFetch(normalized);
  if (!fetched.ok) return json({ ok: false, error: fetched.error }, 400);

  const ctx = await buildPageContext(fetched);
  const checks = runChecks(ctx);

  const record: AuditRecord = {
    id: newAuditId(),
    url: raw,
    normalizedUrl: normalized,
    createdAt: new Date().toISOString(),
    lang,
    page: {
      status: ctx.status,
      finalUrl: ctx.url.href,
      redirects: ctx.redirects,
      bytes: ctx.bytes,
      title: ctx.doc.querySelector("title")?.text.trim() || null,
    },
    checks,
    vitals: null,
    vitalsError: null,
  };

  await saveAudit(record);
  return json({ ok: true, id: record.id, cached: false });
};
```

- [ ] **Step 4: Run the e2e test to verify it passes**

Run: `npm run test:e2e -- audit`
Expected: PASS (7 tests).

Note: the Playwright e2e server sets no `AUDIT_DATA_DIR`, so the store defaults to `/var/lib/dishape/audits`, which may not be writable locally. Add the env var to `playwright.config.ts`'s `webServer.env` so tests write to a temp path:

```ts
    env: {
      HOST: "127.0.0.1",
      PORT: String(PORT),
      AUDIT_DATA_DIR: "./test-results/audit-data",
    },
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/audit.ts tests/e2e/audit.spec.ts playwright.config.ts
git commit -m "$(cat <<'EOF'
feat(audit): POST /api/audit runs phase-one checks

Cache lookup happens before the rate-limit token is spent: re-auditing the
same page is not abuse, and it protects the PageSpeed quota downstream.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YBpPyAfPcrMRceggz7pDWi
EOF
)"
```

---

### Task 9: PageSpeed Insights + `GET /api/audit/[id]/vitals`

**Files:**
- Create: `src/lib/audit/checks/vitals.ts`
- Create: `src/pages/api/audit/[id]/vitals.ts`
- Create: `tests/unit/vitals.spec.ts`
- Modify: `tests/e2e/audit.spec.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `getAudit`, `updateAudit`, `VitalsResult`.
- Produces: `mapPsiResponse(json: unknown): VitalsResult`, `fetchVitals(url: string): Promise<VitalsResult>`, route `GET /api/audit/<id>/vitals`.

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/vitals.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { mapPsiResponse } from "../../src/lib/audit/checks/vitals";

const psi = {
  lighthouseResult: {
    categories: { performance: { score: 0.72 } },
    audits: {
      "largest-contentful-paint": { numericValue: 3120.4 },
      "cumulative-layout-shift": { numericValue: 0.134 },
      "total-blocking-time": { numericValue: 410 },
      "first-contentful-paint": { numericValue: 1450 },
      "total-byte-weight": { numericValue: 2_340_000 },
      "render-blocking-resources": { numericValue: 890 },
      "uses-optimized-images": { details: { overallSavingsBytes: 512_000 } },
    },
  },
  loadingExperience: {
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2900 },
      CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 8 },
      INTERACTION_TO_NEXT_PAINT: { percentile: 240 },
    },
  },
};

test.describe("mapPsiResponse", () => {
  test("scales the score to 0-100 and rounds lab metrics", () => {
    const v = mapPsiResponse(psi);
    expect(v.score).toBe(72);
    expect(v.lab.lcp).toBe(3120);
    expect(v.lab.cls).toBe(0.134);
    expect(v.lab.tbt).toBe(410);
    expect(v.lab.fcp).toBe(1450);
  });

  test("reads field data from CrUX, normalizing the CLS percentile", () => {
    const v = mapPsiResponse(psi);
    // CrUX reports CLS as an integer percentile ×100.
    expect(v.field).toEqual({ lcp: 2900, cls: 0.08, inp: 240 });
  });

  test("carries the byte and savings audits through", () => {
    const v = mapPsiResponse(psi);
    expect(v.transferBytes).toBe(2_340_000);
    expect(v.renderBlockingMs).toBe(890);
    expect(v.imageSavingsBytes).toBe(512_000);
  });

  test("returns nulls rather than throwing on a response with no data", () => {
    const v = mapPsiResponse({});
    expect(v.score).toBeNull();
    expect(v.lab.lcp).toBeNull();
    expect(v.field).toBeNull();
  });

  test("field is null when the origin has no CrUX sample", () => {
    const v = mapPsiResponse({ lighthouseResult: psi.lighthouseResult });
    expect(v.field).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run test:unit -- vitals`
Expected: FAIL — cannot find module `src/lib/audit/checks/vitals`.

- [ ] **Step 3: Implement vitals.ts**

Create `src/lib/audit/checks/vitals.ts`:

```ts
import type { VitalsResult } from "../types";

const PSI_ENDPOINT =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const PSI_TIMEOUT_MS = 45_000;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const round = (v: number | null): number | null => (v === null ? null : Math.round(v));

/** Narrow an unknown nested path without hand-rolling guards at every level. */
function at(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Map a PageSpeed Insights v5 response to our shape. Every field is optional in
 * practice — a site with no CrUX sample has no `loadingExperience`, and audits
 * come and go between Lighthouse versions — so nothing here may throw.
 *
 * INP has no lab equivalent; Lighthouse reports TBT as its proxy. Real INP only
 * exists in the CrUX field data, which is why `field` is surfaced separately.
 */
export function mapPsiResponse(json: unknown): VitalsResult {
  const audit = (id: string, key = "numericValue") =>
    num(at(json, `lighthouseResult.audits.${id}.${key}`));

  const score = num(at(json, "lighthouseResult.categories.performance.score"));

  const fieldLcp = num(
    at(json, "loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.percentile"),
  );
  const fieldCls = num(
    at(json, "loadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile"),
  );
  const fieldInp = num(
    at(json, "loadingExperience.metrics.INTERACTION_TO_NEXT_PAINT.percentile"),
  );
  const hasField = fieldLcp !== null || fieldCls !== null || fieldInp !== null;

  return {
    score: score === null ? null : Math.round(score * 100),
    lab: {
      lcp: round(audit("largest-contentful-paint")),
      // CLS is a ratio, not a duration — keep its decimals.
      cls: audit("cumulative-layout-shift"),
      tbt: round(audit("total-blocking-time")),
      fcp: round(audit("first-contentful-paint")),
    },
    field: hasField
      ? {
          lcp: fieldLcp,
          // CrUX reports CLS as an integer ×100.
          cls: fieldCls === null ? null : fieldCls / 100,
          inp: fieldInp,
        }
      : null,
    transferBytes: round(audit("total-byte-weight")),
    renderBlockingMs: round(audit("render-blocking-resources")),
    imageSavingsBytes: round(
      audit("uses-optimized-images", "details.overallSavingsBytes"),
    ),
  };
}

/** Ask Google to measure a URL. Throws on transport failure; callers catch. */
export async function fetchVitals(url: string): Promise<VitalsResult> {
  const params = new URLSearchParams({
    url,
    strategy: "mobile",
    category: "performance",
  });
  const key = process.env.PAGESPEED_API_KEY;
  if (key) params.set("key", key);

  const res = await fetch(`${PSI_ENDPOINT}?${params}`, {
    signal: AbortSignal.timeout(PSI_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`psi_http_${res.status}`);

  return mapPsiResponse(await res.json());
}
```

Note the `at()` helper takes a dotted path, so `audit("uses-optimized-images", "details.overallSavingsBytes")` resolves correctly.

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `npm run test:unit -- vitals`
Expected: PASS (5 tests).

- [ ] **Step 5: Implement the vitals endpoint**

Create `src/pages/api/audit/[id]/vitals.ts`:

```ts
import type { APIRoute } from "astro";
import { fetchVitals } from "../../../../lib/audit/checks/vitals";
import { getAudit, updateAudit } from "../../../../lib/audit/store";
import type { VitalsResult } from "../../../../lib/audit/types";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Two viewers opening the same fresh report must not trigger two PSI runs.
const inFlight = new Map<string, Promise<VitalsResult>>();

export const GET: APIRoute = async ({ params }) => {
  const id = params.id ?? "";
  const record = await getAudit(id);
  if (!record) return json({ ok: false, error: "not_found" }, 404);

  if (record.vitals) {
    return json({ ok: true, status: "ready", vitals: record.vitals });
  }

  let pending = inFlight.get(id);
  if (!pending) {
    pending = fetchVitals(record.page.finalUrl);
    inFlight.set(id, pending);
    pending.finally(() => inFlight.delete(id));
  }

  try {
    const vitals = await pending;
    await updateAudit(id, { vitals, vitalsError: null });
    return json({ ok: true, status: "ready", vitals });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    console.error("[audit] psi failed", id, reason);
    await updateAudit(id, { vitalsError: reason });
    // The report is still valid without this section — never a 5xx.
    return json({ ok: true, status: "unavailable", reason });
  }
};
```

- [ ] **Step 6: Add e2e coverage for the endpoint**

Append to `tests/e2e/audit.spec.ts`:

```ts
test.describe("GET /api/audit/:id/vitals", () => {
  test("404s on an unknown id", async ({ request }) => {
    const res = await request.get("/api/audit/zzzzzzzz/vitals");
    expect(res.status()).toBe(404);
  });

  test("404s on a path-traversal id instead of reading the filesystem", async ({
    request,
  }) => {
    const res = await request.get("/api/audit/..%2F..%2Fetc%2Fpasswd/vitals");
    expect([404, 400]).toContain(res.status());
  });
});
```

- [ ] **Step 7: Run both suites**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Document the API key**

In `.env.example`, under the auditor block added in Task 6:

```
# Optional. PageSpeed Insights works without a key at a low quota; a free key
# raises it. https://developers.google.com/speed/docs/insights/v5/get-started
PAGESPEED_API_KEY=
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/audit src/pages/api tests .env.example
git commit -m "$(cat <<'EOF'
feat(audit): PageSpeed Insights phase and vitals endpoint

Concurrent requests for the same id share one PSI call. A PSI failure
degrades the report rather than 5xx-ing it — the SEO findings still stand.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YBpPyAfPcrMRceggz7pDWi
EOF
)"
```

---

### Task 10: Bilingual copy

All the strings for the landing, the report and the ~20 checks. No UI yet — this task exists on its own because it is bulk copy, and reviewing it separately from layout is far easier.

**Files:**
- Modify: `src/i18n/es.ts`
- Modify: `src/i18n/en.ts`
- Create: `tests/unit/i18n-audit.spec.ts`

**Interfaces:**
- Consumes: check ids from Tasks 3-4.
- Produces: `es.audit` / `en.audit` dictionaries, plus `interpolate(template, evidence)` in `src/lib/audit/copy.ts`.

- [ ] **Step 1: Write the failing parity test**

Create `tests/unit/i18n-audit.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { es } from "../../src/i18n/es";
import { en } from "../../src/i18n/en";
import { registry } from "../../src/lib/audit/registry";
import { interpolate } from "../../src/lib/audit/copy";

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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run test:unit -- i18n-audit`
Expected: FAIL — `es.audit` is undefined and `src/lib/audit/copy` does not exist.

- [ ] **Step 3: Implement the interpolation helper**

Create `src/lib/audit/copy.ts`:

```ts
/**
 * Fill `{placeholders}` in a localized string from a check's evidence. Unknown
 * keys are left as-is: a visible `{foo}` in the report is a bug we want to see,
 * whereas "undefined" reads like a broken product to the visitor.
 */
export function interpolate(
  template: string,
  evidence?: Record<string, string | number>,
): string {
  if (!evidence) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in evidence ? String(evidence[key]) : match,
  );
}
```

- [ ] **Step 4: Add the Spanish dictionary**

In `src/i18n/es.ts`, add a top-level `audit` key. Keep the neutral, diagnostic register of the rest of the file: state the problem and what it costs, never sell.

```ts
  audit: {
    meta: {
      title: "Auditoría web gratis | Analizá tu sitio en segundos | dishape",
      description:
        "Pegá la URL de tu sitio y obtené un diagnóstico técnico: SEO, rendimiento y cómo se ve tu web al compartirla. Gratis y sin registro.",
    },
    hero: {
      eyebrow: "HERRAMIENTA GRATUITA",
      title: "Averiguá qué está frenando a tu sitio.",
      subtitle:
        "Un diagnóstico técnico de tu web en menos de un minuto: qué ve Google, qué tan rápido carga y cómo se ve cuando alguien comparte el link. Sin registro y sin costo.",
      placeholder: "tusitio.com",
      submit: "Analizar mi sitio",
      analyzing: "Analizando…",
      disclaimer: "Analizamos la página que indiques, no todo el sitio.",
    },
    errors: {
      url_invalid: "Esa dirección no parece válida. Probá con algo como tusitio.com",
      url_blocked: "No podemos analizar direcciones internas o privadas.",
      url_unreachable: "No pudimos acceder a esa página. ¿Está en línea?",
      not_html: "Esa dirección no devuelve una página web.",
      too_large: "La página es demasiado pesada para analizarla.",
      rate_limited: "Alcanzaste el límite de análisis. Probá de nuevo en un rato.",
      server: "Algo falló de nuestro lado. Probá de nuevo.",
    },
    report: {
      auditedOn: "Analizado el",
      urgent: "Lo más urgente",
      urgentEmpty: "No encontramos problemas críticos en esta página.",
      categories: {
        seo: "SEO técnico",
        social: "Al compartir",
        perf: "Rendimiento",
      },
      categoryIntro: {
        seo: "Qué encuentra Google cuando entra a esta página.",
        social: "Qué ve alguien cuando comparte el link en WhatsApp o LinkedIn.",
        perf: "Qué tan rápido carga, medido por Google.",
      },
      passedCount: "{passed} de {total} chequeos",
      showPassed: "Ver los {count} chequeos que pasaron",
      hidePassed: "Ocultar los que pasaron",
      status: { pass: "Bien", warn: "A mejorar", fail: "Problema" },
      severity: { critical: "Crítico", important: "Importante", minor: "Menor" },
      found: "Qué encontramos",
      why: "Por qué importa",
      fix: "Cómo se resuelve",
      measuring: "Midiendo el rendimiento con Google…",
      measuringNote: "Esto tarda unos segundos.",
      vitalsUnavailable:
        "No pudimos medir el rendimiento en este momento. El resto del diagnóstico sigue siendo válido.",
      fieldTitle: "Datos de usuarios reales",
      labTitle: "Medición de laboratorio",
      noFieldData:
        "Este sitio no tiene tráfico suficiente para que Google reporte datos de usuarios reales.",
      sharePreview: "Así se ve tu link al compartirlo",
      sharePreviewBroken:
        "Esta página no tiene imagen para compartir, así que el link se ve vacío.",
      copyLink: "Copiar link del reporte",
      copied: "Link copiado",
      reAudit: "Analizar otro sitio",
    },
    cta: {
      title: "Encontramos {count} cosas para resolver en esta página.",
      titleClean: "Esta página está bien resuelta.",
      body:
        "Cada uno de estos puntos tiene una solución concreta. Si querés que los resolvamos, contanos y te decimos qué implica.",
      bodyClean:
        "Si estás por encarar un proyecto nuevo o querés llevar esto más lejos, hablemos.",
      button: "Quiero resolver esto",
    },
    faq: {
      title: "Preguntas frecuentes",
      items: [
        [
          "¿Es realmente gratis?",
          "Sí. No pedimos email ni registro, y el reporte completo se ve al instante.",
        ],
        [
          "¿Qué analiza exactamente?",
          "Alrededor de veinte chequeos técnicos sobre la página que indiques: SEO técnico (qué entiende Google), cómo se ve el link al compartirlo, y rendimiento medido con la API de PageSpeed Insights de Google.",
        ],
        [
          "¿Analiza todo mi sitio?",
          "No. Analiza la URL exacta que ingreses. Si querés revisar varias páginas, corré el análisis una vez por cada una.",
        ],
        [
          "¿Los datos de rendimiento son confiables?",
          "Vienen directo de la API de PageSpeed Insights de Google, la misma que usa PageSpeed. Podés verificar cualquier número corriendo la herramienta oficial.",
        ],
        [
          "¿Guardan mi sitio o mis datos?",
          "Guardamos el reporte por 30 días para que puedas compartir el link. No pedimos datos personales.",
        ],
      ] as [string, string][],
    },
    checks: {
      // …see step 5…
    },
  },
```

- [ ] **Step 5: Add the per-check Spanish copy**

Still in `src/i18n/es.ts`, fill `audit.checks`. Every entry has `name`, `why`, `found` (with `{placeholders}` matching the `evidence` keys emitted in Tasks 3-4) and `fix`.

```ts
    checks: {
      "seo.title.present": {
        name: "Título de la página",
        why: "Es el texto que Google muestra como titular en los resultados de búsqueda. Sin título, el buscador inventa uno con lo que encuentra en la página.",
        found: "La página no tiene etiqueta <title>.",
        fix: "Agregá un <title> descriptivo y único en el <head>, que incluya el término por el que querés que te encuentren.",
      },
      "seo.title.length": {
        name: "Largo del título",
        why: "Google corta los títulos largos y descarta los muy cortos por poco informativos. Entre {min} y {max} caracteres se ve completo.",
        found: "El título tiene {actual} caracteres.",
        fix: "Ajustá el título a un rango de {min} a {max} caracteres, poniendo lo más importante al principio.",
      },
      "seo.description.present": {
        name: "Meta descripción",
        why: "Es el resumen que aparece debajo del título en los resultados. No afecta el posicionamiento, pero sí cuánta gente hace clic.",
        found: "La página no tiene meta descripción.",
        fix: "Agregá <meta name=\"description\" content=\"…\"> con un resumen concreto de lo que ofrece la página.",
      },
      "seo.description.length": {
        name: "Largo de la meta descripción",
        why: "Google trunca las descripciones largas a mitad de frase. Entre {min} y {max} caracteres se muestra entera.",
        found: "La meta descripción tiene {actual} caracteres.",
        fix: "Reescribí la descripción para que entre en {min} a {max} caracteres.",
      },
      "seo.h1.unique": {
        name: "Encabezado principal único",
        why: "El H1 le dice al buscador de qué trata la página. Si hay varios o ninguno, esa señal se diluye.",
        found: "La página tiene {actual} encabezados H1.",
        fix: "Dejá exactamente un H1 por página, con el tema principal. El resto de los títulos van como H2 o H3.",
      },
      "seo.headings.hierarchy": {
        name: "Jerarquía de encabezados",
        why: "Los encabezados forman el índice de la página. Saltear niveles rompe esa estructura para buscadores y lectores de pantalla.",
        found: "Hay un salto de {from} a {to} sin pasar por el nivel intermedio.",
        fix: "Usá los encabezados en orden, sin saltear niveles. Si el salto es por estética, cambiá el tamaño con CSS, no el nivel.",
      },
      "seo.canonical": {
        name: "URL canónica",
        why: "Le dice a Google cuál es la versión oficial de la página. Sin ella, las variantes con parámetros compiten entre sí y reparten la señal.",
        found: "La canónica declarada es {found}.",
        fix: "Agregá <link rel=\"canonical\"> apuntando a la URL absoluta y definitiva de esta misma página.",
      },
      "seo.html.lang": {
        name: "Idioma declarado",
        why: "Sin el atributo lang, los buscadores adivinan el idioma y los lectores de pantalla lo pronuncian mal.",
        found: "El idioma declarado es \"{found}\".",
        fix: "Agregá el atributo lang a la etiqueta <html>, por ejemplo <html lang=\"es\">.",
      },
      "seo.robots.txt": {
        name: "Archivo robots.txt",
        why: "Es lo primero que consulta un buscador al llegar. Sin él no hay bloqueo, pero tampoco forma de indicar dónde está el sitemap.",
        found: "No pudimos acceder a /robots.txt.",
        fix: "Publicá un robots.txt en la raíz del dominio, aunque sea mínimo, y declará ahí la ubicación del sitemap.",
      },
      "seo.sitemap": {
        name: "Sitemap",
        why: "Le da a Google la lista completa de páginas a indexar, en vez de dejar que las descubra siguiendo links.",
        found: "No encontramos un sitemap accesible.",
        fix: "Generá un sitemap.xml y declaralo en robots.txt con la línea Sitemap: https://tudominio.com/sitemap.xml",
      },
      "seo.noindex": {
        name: "Página indexable",
        why: "Una directiva noindex le pide a Google que excluya la página de los resultados. En una página pública casi siempre es un error de configuración.",
        found: "La página se declara noindex ({source}).",
        fix: "Quitá la directiva noindex del meta robots o del encabezado X-Robots-Tag. Suele quedar de un entorno de pruebas.",
      },
      "seo.hreflang": {
        name: "Etiquetas hreflang",
        why: "En un sitio con varios idiomas, indican qué versión mostrar a cada usuario. Un conjunto incompleto hace que Google las ignore por completo.",
        found: "Encontramos {count} etiquetas hreflang con un problema de configuración.",
        fix: "Cada versión debe listar todas las alternativas, incluida ella misma, con códigos de idioma válidos.",
      },
      "seo.https": {
        name: "Conexión segura",
        why: "Los navegadores marcan como \"no seguro\" cualquier sitio sin HTTPS, y Google lo usa como señal de posicionamiento.",
        found: "La página se sirve por HTTP, sin cifrar.",
        fix: "Instalá un certificado TLS. Con Let's Encrypt es gratis y se renueva solo.",
      },
      "seo.http.redirect": {
        name: "Redirección a HTTPS",
        why: "Si la versión HTTP sigue respondiendo, existen dos copias de cada página y el tráfico se reparte entre ambas.",
        found: "http:// no redirige a https://",
        fix: "Configurá una redirección 301 permanente de todo el tráfico HTTP a HTTPS.",
      },
      "social.og.title": {
        name: "Título al compartir",
        why: "Es el titular que aparece cuando alguien pega el link en WhatsApp, LinkedIn o Slack. Sin él, cada plataforma improvisa.",
        found: "No hay etiqueta og:title.",
        fix: "Agregá <meta property=\"og:title\" content=\"…\"> con el título que querés que se vea al compartir.",
      },
      "social.og.description": {
        name: "Descripción al compartir",
        why: "Es el texto debajo del titular en la tarjeta del link. Es lo que decide si alguien hace clic o sigue de largo.",
        found: "No hay etiqueta og:description.",
        fix: "Agregá <meta property=\"og:description\"> con un resumen breve y concreto.",
      },
      "social.og.image": {
        name: "Imagen al compartir",
        why: "Un link sin imagen ocupa una fracción del espacio en el feed y recibe muchos menos clics que uno con tarjeta visual.",
        found: "La imagen para compartir tiene un problema: {reason}.",
        fix: "Publicá una imagen de 1200×630 px y declarala en og:image con la URL absoluta completa, incluido https://",
      },
      "social.twitter.card": {
        name: "Tarjeta de X/Twitter",
        why: "Define el formato de la vista previa en X. Sin ella el link se muestra en el formato más chico disponible.",
        found: "No hay etiqueta twitter:card.",
        fix: "Agregá <meta name=\"twitter:card\" content=\"summary_large_image\">",
      },
      "social.jsonld": {
        name: "Datos estructurados",
        why: "Le explican a Google qué es esta página en un formato que entiende. Habilitan resultados enriquecidos y son cada vez más importantes para que los asistentes de IA citen el sitio.",
        found: "Los datos estructurados tienen un problema: {reason}.",
        fix: "Agregá un bloque JSON-LD con el tipo que corresponda (Organization, Product, Article, LocalBusiness…).",
      },
      "social.favicon": {
        name: "Favicon",
        why: "Es el ícono de la pestaña. Sin él, el sitio se vuelve difícil de encontrar entre veinte pestañas abiertas.",
        found: "No hay ícono declarado.",
        fix: "Agregá <link rel=\"icon\" href=\"/favicon.svg\"> en el <head>.",
      },
    },
```

- [ ] **Step 6: Mirror the whole block in English**

In `src/i18n/en.ts`, add the same `audit` key: same structure, same nesting, every
key present, same `{placeholder}` names (the placeholders are matched against
`evidence` keys, so they must be identical in both languages — translate the prose
around them, never the placeholder itself).

Same register: neutral and diagnostic, no hype. The EN meta title and description
target English queries ("free website audit", "check my site's SEO"), not a literal
translation of the Spanish.

Two strings are asserted verbatim by the e2e tests in Tasks 11-12, so they must
match exactly:

```ts
      "seo.h1.unique": { name: "Single main heading", /* … */ },
```

and the ES counterpart `"Encabezado principal único"`, which is already written in
Step 5.

- [ ] **Step 7: Run the parity test**

Run: `npm run test:unit -- i18n-audit`
Expected: PASS (7 tests). If a check id is missing from either dictionary, the test names it — add it and re-run.

- [ ] **Step 8: Commit**

```bash
git add src/i18n src/lib/audit/copy.ts tests/unit/i18n-audit.spec.ts
git commit -m "$(cat <<'EOF'
feat(audit): bilingual copy for landing, report and every check

A parity test fails the build when a registered check has no copy in either
language, so the catalog and the dictionaries cannot drift.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YBpPyAfPcrMRceggz7pDWi
EOF
)"
```

---

### Task 11: Report page and components

**Files:**
- Create: `src/components/audit/ScoreCards.astro`, `UrgentFindings.astro`, `FindingItem.astro`, `FindingList.astro`, `VitalsPanel.astro`, `SharePreview.astro`, `AuditCta.astro`, `ShareButton.astro`
- Create: `src/pages/auditoria/r/[id].astro`, `src/pages/en/audit/r/[id].astro`
- Create: `src/scripts/audit.ts`
- Modify: `src/components/Seo.astro`, `src/layouts/Base.astro` (add `noindex`)
- Modify: `tests/e2e/audit.spec.ts`

**Interfaces:**
- Consumes: `getAudit`, `scoreCategory`, `rankFindings`, `interpolate`, `checkById`, `getDict`.
- Produces: the two report routes.

- [ ] **Step 1: Add noindex support to the SEO components**

In `src/components/Seo.astro`, add to the `Props` interface and destructuring:

```ts
  /** Report pages are generated per-visitor; index them and you flood Google. */
  noindex?: boolean;
```

```ts
const { title, description, image, alternates: altPaths, ogType = "website", article, noindex = false } = Astro.props;
```

Replace the hardcoded robots meta:

```astro
<meta
  name="robots"
  content={noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}
/>
```

In `src/layouts/Base.astro`, thread the prop through: add `noindex?: boolean;` to `Props`, add `noindex` to the destructuring, and pass `noindex={noindex}` to `<Seo />`.

- [ ] **Step 2: Write the failing e2e test**

Important constraint: **the SSRF guard blocks the test server's own loopback
address**, by design, so the e2e suite cannot audit itself. Report pages are
verified against a fixture record written straight into `AUDIT_DATA_DIR`.

Append to `tests/e2e/audit.spec.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_DIR = "./test-results/audit-data";

/** Write a record straight to the store so the page has something to render. */
async function seedRecord(id: string) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    join(DATA_DIR, `${id}.json`),
    JSON.stringify({
      id,
      url: "https://ejemplo.com/",
      normalizedUrl: "https://ejemplo.com",
      createdAt: new Date().toISOString(),
      lang: "es",
      page: {
        status: 200,
        finalUrl: "https://ejemplo.com/",
        redirects: 0,
        bytes: 12_345,
        title: "Ejemplo",
      },
      checks: [
        { id: "seo.title.present", status: "pass", evidence: { title: "Ejemplo" } },
        { id: "seo.h1.unique", status: "fail", evidence: { actual: 0 } },
        { id: "seo.title.length", status: "warn", evidence: { actual: 87, min: 30, max: 60 } },
        { id: "social.og.image", status: "fail", evidence: { reason: "missing" } },
      ],
      vitals: null,
      vitalsError: null,
    }),
    "utf8",
  );
}

test.describe("report page", () => {
  test("404s on an unknown report id", async ({ request }) => {
    const res = await request.get("/auditoria/r/zzzzzzzz/", { maxRedirects: 0 });
    expect(res.status()).toBe(404);
  });

  test("renders findings and excludes itself from indexing", async ({ page }) => {
    const id = "seedes01";
    await seedRecord(id);
    await page.goto(`/auditoria/r/${id}/`);

    await expect(page.locator("h1")).toContainText("ejemplo.com");
    await expect(page.getByText("Encabezado principal único")).toBeVisible();

    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toBe("noindex, follow");
  });

  test("serves the English report at its own route", async ({ page }) => {
    const id = "seeden01";
    await seedRecord(id);
    await page.goto(`/en/audit/r/${id}/`);
    await expect(page.getByText("Single main heading")).toBeVisible();
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npm run test:e2e -- audit`
Expected: FAIL — the report routes 404.

- [ ] **Step 4: Build ScoreCards.astro**

Create `src/components/audit/ScoreCards.astro`:

```astro
---
import { getLang, getDict } from "../../i18n";
import type { CategoryScore } from "../../lib/audit/score";

interface Props {
  seo: CategoryScore;
  social: CategoryScore;
  perfScore: number | null;
  perfPending: boolean;
}
const { seo, social, perfScore, perfPending } = Astro.props;
const t = getDict(getLang(Astro)).audit.report;

const tone = (n: number | null) =>
  n === null ? "text-faint" : n >= 90 ? "text-accent-light" : n >= 50 ? "text-amber-400" : "text-red-400";
---

<div class="grid gap-4 sm:grid-cols-3">
  <div class="rounded-xl border border-line bg-card p-5">
    <p class="text-xs uppercase tracking-wide text-faint">{t.categories.seo}</p>
    <p class={`mt-2 text-4xl font-semibold ${tone(seo.percent)}`}>{seo.percent}</p>
    <p class="mt-1 text-sm text-muted">
      {t.passedCount.replace("{passed}", String(seo.passed)).replace("{total}", String(seo.total))}
    </p>
  </div>

  <div class="rounded-xl border border-line bg-card p-5">
    <p class="text-xs uppercase tracking-wide text-faint">{t.categories.social}</p>
    <p class={`mt-2 text-4xl font-semibold ${tone(social.percent)}`}>{social.percent}</p>
    <p class="mt-1 text-sm text-muted">
      {t.passedCount.replace("{passed}", String(social.passed)).replace("{total}", String(social.total))}
    </p>
  </div>

  <div class="rounded-xl border border-line bg-card p-5" data-perf-card>
    <p class="text-xs uppercase tracking-wide text-faint">{t.categories.perf}</p>
    <p class={`mt-2 text-4xl font-semibold ${tone(perfScore)}`} data-perf-score>
      {perfPending ? "—" : (perfScore ?? "—")}
    </p>
    <p
      class="mt-1 text-sm text-muted"
      data-perf-note
      data-unavailable={t.vitalsUnavailable}
    >
      {perfPending ? t.measuring : "PageSpeed Insights"}
    </p>
  </div>
</div>
```

- [ ] **Step 5: Build FindingItem.astro and FindingList.astro**

Create `src/components/audit/FindingItem.astro`:

```astro
---
import { getLang, getDict } from "../../i18n";
import { interpolate } from "../../lib/audit/copy";
import { checkById } from "../../lib/audit/registry";
import type { CheckResult } from "../../lib/audit/types";

interface Props {
  result: CheckResult;
}
const { result } = Astro.props;
const lang = getLang(Astro);
const t = getDict(lang).audit;
const copy = t.checks[result.id as keyof typeof t.checks];
const severity = checkById.get(result.id)?.severity ?? "minor";

const badge = {
  fail: "border-red-500/30 bg-red-500/10 text-red-300",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  pass: "border-accent/30 bg-accent/10 text-accent-light",
  na: "border-line bg-elevated text-faint",
}[result.status];
---

{
  copy && (
    <article class="rounded-xl border border-line bg-card p-5">
      <header class="flex flex-wrap items-center gap-3">
        <span class={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge}`}>
          {t.report.status[result.status === "na" ? "pass" : result.status]}
        </span>
        <h3 class="text-base font-semibold text-ink">{copy.name}</h3>
        {result.status === "fail" && severity === "critical" && (
          <span class="text-xs text-faint">{t.report.severity.critical}</span>
        )}
      </header>

      {result.status !== "pass" && (
        <dl class="mt-4 grid gap-3 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-faint">{t.report.found}</dt>
            <dd class="mt-1 text-muted">{interpolate(copy.found, result.evidence)}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-faint">{t.report.why}</dt>
            <dd class="mt-1 text-muted">{interpolate(copy.why, result.evidence)}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-faint">{t.report.fix}</dt>
            <dd class="mt-1 text-muted">{interpolate(copy.fix, result.evidence)}</dd>
          </div>
        </dl>
      )}
    </article>
  )
}
```

Create `src/components/audit/FindingList.astro`:

```astro
---
import FindingItem from "./FindingItem.astro";
import { getLang, getDict } from "../../i18n";
import type { CheckResult } from "../../lib/audit/types";

interface Props {
  title: string;
  intro: string;
  results: CheckResult[];
}
const { title, intro, results } = Astro.props;
const t = getDict(getLang(Astro)).audit.report;

const problems = results.filter((r) => r.status === "fail" || r.status === "warn");
const passed = results.filter((r) => r.status === "pass");
---

<section class="flex flex-col gap-5">
  <header>
    <h2 class="text-2xl font-semibold text-ink">{title}</h2>
    <p class="mt-1 text-muted">{intro}</p>
  </header>

  <div class="grid gap-3">
    {problems.map((r) => <FindingItem result={r} />)}
  </div>

  {
    passed.length > 0 && (
      <details class="rounded-xl border border-line bg-surface p-4">
        <summary class="cursor-pointer text-sm text-muted">
          {t.showPassed.replace("{count}", String(passed.length))}
        </summary>
        <div class="mt-4 grid gap-3">
          {passed.map((r) => <FindingItem result={r} />)}
        </div>
      </details>
    )
  }
</section>
```

- [ ] **Step 6: Build SharePreview.astro and AuditCta.astro**

Create `src/components/audit/SharePreview.astro`:

```astro
---
import { getLang, getDict } from "../../i18n";
import type { CheckResult } from "../../lib/audit/types";

interface Props {
  results: CheckResult[];
  finalUrl: string;
}
const { results, finalUrl } = Astro.props;
const t = getDict(getLang(Astro)).audit.report;

const find = (id: string) => results.find((r) => r.id === id);
const image = find("social.og.image");
const title = find("social.og.title")?.evidence?.found;
const description = find("social.og.description")?.evidence?.found;
const imageUrl = image?.status === "pass" ? String(image.evidence?.found ?? "") : null;
const host = new URL(finalUrl).host;
---

<section class="flex flex-col gap-4">
  <h2 class="text-2xl font-semibold text-ink">{t.sharePreview}</h2>

  <div class="max-w-md overflow-hidden rounded-xl border border-line bg-card">
    {
      imageUrl ? (
        <img src={imageUrl} alt="" class="aspect-[1200/630] w-full object-cover" loading="lazy" />
      ) : (
        <div class="flex aspect-[1200/630] items-center justify-center bg-elevated px-6 text-center text-sm text-faint">
          {t.sharePreviewBroken}
        </div>
      )
    }
    <div class="border-t border-line p-4">
      <p class="text-xs uppercase text-faint">{host}</p>
      <p class="mt-1 truncate font-medium text-ink">{title ?? host}</p>
      {description && <p class="mt-1 line-clamp-2 text-sm text-muted">{description}</p>}
    </div>
  </div>
</section>
```

Create `src/components/audit/AuditCta.astro`:

```astro
---
import { getRelativeLocaleUrl } from "astro:i18n";
import { getLang, getDict } from "../../i18n";

interface Props {
  problemCount: number;
  auditId: string;
  auditedUrl: string;
  location: string;
}
const { problemCount, auditId, auditedUrl, location } = Astro.props;
const lang = getLang(Astro);
const t = getDict(lang).audit.cta;

const params = new URLSearchParams({ ref: "audit", id: auditId, url: auditedUrl });
const href = `${getRelativeLocaleUrl(lang, "")}?${params}#contacto`;
const clean = problemCount === 0;
---

<aside class="rounded-2xl border border-accent/25 bg-accent/[0.06] p-8">
  <h2 class="text-2xl font-semibold text-ink">
    {clean ? t.titleClean : t.title.replace("{count}", String(problemCount))}
  </h2>
  <p class="mt-3 max-w-2xl text-muted">{clean ? t.bodyClean : t.body}</p>
  <a
    href={href}
    data-cta={location}
    class="mt-6 inline-block rounded-lg bg-accent px-6 py-3.5 font-semibold text-white shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5"
  >
    {t.button}
  </a>
</aside>
```

- [ ] **Step 7: Build UrgentFindings.astro, VitalsPanel.astro and ShareButton.astro**

Create `src/components/audit/UrgentFindings.astro` — the top of the report, the part
that has to land in five seconds:

```astro
---
import { getLang, getDict } from "../../i18n";
import { interpolate } from "../../lib/audit/copy";
import { rankFindings } from "../../lib/audit/score";
import type { CheckResult } from "../../lib/audit/types";

interface Props {
  results: CheckResult[];
}
const { results } = Astro.props;
const lang = getLang(Astro);
const t = getDict(lang).audit;

// rankFindings already sorts fail-before-warn and critical-before-minor.
const top = rankFindings(results)
  .filter((r) => r.status === "fail")
  .slice(0, 3);
---

<section class="flex flex-col gap-5">
  <h2 class="text-2xl font-semibold text-ink">{t.report.urgent}</h2>

  {top.length === 0 && <p class="text-muted">{t.report.urgentEmpty}</p>}

  <ol class="grid gap-3">
    {
      top.map((r, i) => {
        const copy = t.checks[r.id as keyof typeof t.checks];
        return (
          copy && (
            <li class="flex gap-4 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-5">
              <span class="text-2xl font-semibold text-red-400/70">{i + 1}</span>
              <div>
                <h3 class="font-semibold text-ink">{copy.name}</h3>
                <p class="mt-1 text-sm text-muted">{interpolate(copy.found, r.evidence)}</p>
                <p class="mt-2 text-sm text-muted">{interpolate(copy.why, r.evidence)}</p>
              </div>
            </li>
          )
        );
      })
    }
  </ol>
</section>
```

Create `src/components/audit/VitalsPanel.astro` — the performance detail. It renders
the "measuring" state server-side and is filled in by `src/scripts/audit.ts`:

```astro
---
import { getLang, getDict } from "../../i18n";
import type { VitalsResult } from "../../lib/audit/types";

interface Props {
  vitals: VitalsResult | null;
  error: string | null;
}
const { vitals, error } = Astro.props;
const t = getDict(getLang(Astro)).audit.report;

const ms = (v: number | null) => (v === null ? "—" : `${(v / 1000).toFixed(2)} s`);
const raw = (v: number | null) => (v === null ? "—" : v.toFixed(3));
const mb = (v: number | null) => (v === null ? "—" : `${(v / 1024 / 1024).toFixed(2)} MB`);
---

<section class="flex flex-col gap-5" data-vitals-panel>
  <header>
    <h2 class="text-2xl font-semibold text-ink">{t.categories.perf}</h2>
    <p class="mt-1 text-muted">{t.categoryIntro.perf}</p>
  </header>

  {
    !vitals && !error && (
      <div class="rounded-xl border border-line bg-card p-6" data-vitals-pending>
        <p class="text-muted">{t.measuring}</p>
        <p class="mt-1 text-sm text-faint">{t.measuringNote}</p>
      </div>
    )
  }

  {error && <p class="rounded-xl border border-line bg-card p-6 text-muted">{t.vitalsUnavailable}</p>}

  {
    vitals && (
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="rounded-xl border border-line bg-card p-5">
          <p class="text-xs uppercase tracking-wide text-faint">{t.labTitle}</p>
          <dl class="mt-3 grid gap-2 text-sm">
            <div class="flex justify-between"><dt class="text-muted">LCP</dt><dd class="text-ink">{ms(vitals.lab.lcp)}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">CLS</dt><dd class="text-ink">{raw(vitals.lab.cls)}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">TBT</dt><dd class="text-ink">{ms(vitals.lab.tbt)}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">FCP</dt><dd class="text-ink">{ms(vitals.lab.fcp)}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">Peso</dt><dd class="text-ink">{mb(vitals.transferBytes)}</dd></div>
          </dl>
        </div>

        <div class="rounded-xl border border-line bg-card p-5">
          <p class="text-xs uppercase tracking-wide text-faint">{t.fieldTitle}</p>
          {vitals.field ? (
            <dl class="mt-3 grid gap-2 text-sm">
              <div class="flex justify-between"><dt class="text-muted">LCP</dt><dd class="text-ink">{ms(vitals.field.lcp)}</dd></div>
              <div class="flex justify-between"><dt class="text-muted">CLS</dt><dd class="text-ink">{raw(vitals.field.cls)}</dd></div>
              <div class="flex justify-between"><dt class="text-muted">INP</dt><dd class="text-ink">{ms(vitals.field.inp)}</dd></div>
            </dl>
          ) : (
            <p class="mt-3 text-sm text-muted">{t.noFieldData}</p>
          )}
        </div>
      </div>
    )
  }
</section>
```

The "Peso" label above must come from the dictionary too — add `t.report.weight`
(`"Peso"` / `"Weight"`) and use it instead of the literal.

Create `src/components/audit/ShareButton.astro`:

```astro
---
import { getLang, getDict } from "../../i18n";

const t = getDict(getLang(Astro)).audit.report;
---

<button
  type="button"
  data-copy-link
  data-copied={t.copied}
  class="self-start rounded-lg border border-line bg-card px-5 py-3 text-sm font-medium text-ink transition-colors hover:border-accent/40"
>
  {t.copyLink}
</button>
```

- [ ] **Step 8: Build the Spanish report page**

Create `src/pages/auditoria/r/[id].astro`:

```astro
---
import Base from "../../../layouts/Base.astro";
import ScoreCards from "../../../components/audit/ScoreCards.astro";
import UrgentFindings from "../../../components/audit/UrgentFindings.astro";
import FindingList from "../../../components/audit/FindingList.astro";
import VitalsPanel from "../../../components/audit/VitalsPanel.astro";
import SharePreview from "../../../components/audit/SharePreview.astro";
import AuditCta from "../../../components/audit/AuditCta.astro";
import ShareButton from "../../../components/audit/ShareButton.astro";
import { getAudit } from "../../../lib/audit/store";
import { scoreCategory, rankFindings } from "../../../lib/audit/score";
import { checkById } from "../../../lib/audit/registry";
import { getDict } from "../../../i18n";

export const prerender = false;

const record = await getAudit(Astro.params.id ?? "");
if (!record) return new Response(null, { status: 404 });

const t = getDict("es").audit;
const byCategory = (cat: "seo" | "social") =>
  rankFindings(record.checks).filter((r) => checkById.get(r.id)?.category === cat);

const seo = scoreCategory(record.checks, "seo");
const social = scoreCategory(record.checks, "social");
const problems = record.checks.filter((r) => r.status === "fail" || r.status === "warn");
const host = new URL(record.page.finalUrl).host;
const audited = new Date(record.createdAt).toLocaleDateString("es-AR");
---

<Base
  title={`Auditoría de ${host} | dishape`}
  description={t.meta.description}
  noindex
>
  <main class="shell flex flex-col gap-16 py-20" data-audit-id={record.id}>
    <header class="flex flex-col gap-6">
      <p class="text-sm text-faint">{t.report.auditedOn} {audited}</p>
      <h1 class="text-4xl font-semibold text-ink">{host}</h1>
      <ScoreCards
        seo={seo}
        social={social}
        perfScore={record.vitals?.score ?? null}
        perfPending={record.vitals === null && record.vitalsError === null}
      />
    </header>

    <UrgentFindings results={record.checks} />

    <AuditCta
      problemCount={problems.length}
      auditId={record.id}
      auditedUrl={record.page.finalUrl}
      location="audit_report_top"
    />

    <FindingList
      title={t.report.categories.seo}
      intro={t.report.categoryIntro.seo}
      results={byCategory("seo")}
    />

    <FindingList
      title={t.report.categories.social}
      intro={t.report.categoryIntro.social}
      results={byCategory("social")}
    />

    <VitalsPanel vitals={record.vitals} error={record.vitalsError} />

    <SharePreview results={record.checks} finalUrl={record.page.finalUrl} />

    <AuditCta
      problemCount={problems.length}
      auditId={record.id}
      auditedUrl={record.page.finalUrl}
      location="audit_report_bottom"
    />

    <ShareButton />
  </main>
</Base>
```

- [ ] **Step 9: Mirror it for English**

Create `src/pages/en/audit/r/[id].astro`: identical, with `getDict("en")`, `toLocaleDateString("en-US")`, the title in English, and import paths one level deeper (`../../../../`).

- [ ] **Step 10: Write the client script**

Create `src/scripts/audit.ts`:

```ts
// Report page: fetch the performance section after render (it takes ~20s, and
// blocking the whole report on it would lose the visitor), plus the share button.

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

const root = document.querySelector<HTMLElement>("[data-audit-id]");

if (root) {
  const id = root.dataset.auditId!;
  const scoreEl = document.querySelector<HTMLElement>("[data-perf-score]");
  const noteEl = document.querySelector<HTMLElement>("[data-perf-note]");
  const pending = scoreEl?.textContent?.trim() === "—" && noteEl?.dataset.done !== "1";

  const panelPending = document.querySelector<HTMLElement>("[data-vitals-pending]");

  const giveUp = () => {
    if (noteEl) noteEl.textContent = noteEl.dataset.unavailable ?? "—";
    if (panelPending) {
      panelPending.textContent = noteEl?.dataset.unavailable ?? "";
    }
  };

  if (pending) {
    fetch(`/api/audit/${id}/vitals`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "ready" || data.vitals?.score === null) {
          giveUp();
          return;
        }
        if (scoreEl) scoreEl.textContent = String(data.vitals.score);
        if (noteEl) noteEl.textContent = "PageSpeed Insights";
        // The detail panel was rendered in its "measuring" state; the numbers
        // only exist now, so reload once to let the server render them. This
        // keeps all the formatting and copy in one place instead of duplicating
        // VitalsPanel's markup in the client bundle.
        if (panelPending) location.reload();

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: "audit_completed", audit_id: id });
      })
      .catch(giveUp);
  }
}

const shareButton = document.querySelector<HTMLButtonElement>("[data-copy-link]");
shareButton?.addEventListener("click", async () => {
  await navigator.clipboard.writeText(location.href);
  const done = shareButton.dataset.copied;
  if (done) {
    const original = shareButton.textContent;
    shareButton.textContent = done;
    setTimeout(() => (shareButton.textContent = original), 2000);
  }
});

export {};
```

Import it from `Base.astro`'s existing bottom `<script>` block alongside `calendly`, `cta` and `motionLoader`:

```ts
      import "../scripts/audit";
```

- [ ] **Step 11: Run the e2e test to verify it passes**

Run: `npm run test:e2e -- audit`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/components/audit src/pages/auditoria src/pages/en/audit src/scripts/audit.ts src/components/Seo.astro src/layouts/Base.astro tests/e2e/audit.spec.ts
git commit -m "$(cat <<'EOF'
feat(audit): shareable report pages in both languages

Report routes are noindex,follow — generated pages must not enter the index,
but the outbound link to the audited site should still carry signal.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YBpPyAfPcrMRceggz7pDWi
EOF
)"
```

---

### Task 12: Landing pages

**Files:**
- Create: `src/components/audit/UrlForm.astro`
- Create: `src/components/audit/AuditLanding.astro`
- Create: `src/pages/auditoria/index.astro`, `src/pages/en/audit/index.astro`
- Modify: `src/scripts/audit.ts` (form submit)
- Modify: `tests/e2e/audit.spec.ts`, `tests/e2e/routes.spec.ts`

**Interfaces:**
- Consumes: `getDict`, `POST /api/audit`.
- Produces: the two landing routes.

- [ ] **Step 1: Write the failing e2e test**

Append to `tests/e2e/audit.spec.ts`:

```ts
test.describe("landing page", () => {
  test("serves 200 in both languages", async ({ request }) => {
    for (const path of ["/auditoria/", "/en/audit/"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(200);
    }
  });

  test("is not swallowed by the [servicio] catch-all", async ({ page }) => {
    await page.goto("/auditoria/");
    await expect(page.locator("[data-audit-form] input[name='url']")).toBeVisible();
  });

  test("is indexable and declares its counterpart", async ({ page }) => {
    await page.goto("/auditoria/");
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toContain("index");
    const alt = page.locator('link[rel="alternate"][hreflang="en"]');
    await expect(alt).toHaveAttribute("href", /\/en\/audit/);
  });

  test("shows an inline error for an invalid URL without leaving the page", async ({ page }) => {
    await page.goto("/auditoria/");
    await page.fill("[data-audit-form] input[name='url']", "no es una url");
    await page.click("[data-audit-form] button[type='submit']");
    await expect(page.locator("[data-audit-error]")).toBeVisible();
    expect(page.url()).toContain("/auditoria");
  });
});
```

Also add `/auditoria/` and `/en/audit/` to the `must200` array in `tests/e2e/routes.spec.ts`.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run test:e2e -- audit`
Expected: FAIL — landing routes 404.

- [ ] **Step 3: Build UrlForm.astro**

Create `src/components/audit/UrlForm.astro`:

```astro
---
import { getLang, getDict } from "../../i18n";

const lang = getLang(Astro);
const t = getDict(lang).audit;
---

<form
  data-audit-form
  data-lang={lang}
  data-analyzing={t.hero.analyzing}
  data-report-base={lang === "en" ? "/en/audit/r/" : "/auditoria/r/"}
  data-errors={JSON.stringify(t.errors)}
  class="flex w-full max-w-xl flex-col gap-3"
>
  <div class="flex flex-col gap-3 sm:flex-row">
    <input
      type="text"
      name="url"
      required
      inputmode="url"
      autocomplete="url"
      placeholder={t.hero.placeholder}
      class="w-full rounded-lg border border-line bg-card px-4 py-3.5 text-sm text-ink placeholder:text-faint transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
    />
    <button
      type="submit"
      data-cta="audit_landing"
      class="shrink-0 rounded-lg bg-accent px-6 py-3.5 font-semibold text-white shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {t.hero.submit}
    </button>
  </div>

  <p data-audit-error role="alert" class="hidden text-sm text-red-400"></p>
  <p class="text-xs text-faint">{t.hero.disclaimer}</p>
</form>
```

- [ ] **Step 4: Build AuditLanding.astro**

Create `src/components/audit/AuditLanding.astro`. It renders the hero with `UrlForm`, a section explaining the three categories (driven by `audit.report.categories` + `categoryIntro`), the FAQ from `audit.faq.items`, and a `FAQPage` + `WebApplication` JSON-LD block:

```astro
---
import UrlForm from "./UrlForm.astro";
import SectionHeader from "../SectionHeader.astro";
import { getLang, getDict } from "../../i18n";
import { SITE } from "../../site";
import { registry } from "../../lib/audit/registry";

const lang = getLang(Astro);
const t = getDict(lang).audit;
const path = lang === "en" ? "/en/audit" : "/auditoria";

const count = registry.length;

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: t.meta.title,
      description: t.meta.description,
      url: `${SITE.url}${path}`,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      provider: { "@type": "Organization", name: SITE.name, url: SITE.url },
    },
    {
      "@type": "FAQPage",
      mainEntity: t.faq.items.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};
---

<main>
  <section class="border-b border-line bg-base">
    <div class="shell flex flex-col gap-8 py-24">
      <p class="text-xs uppercase tracking-[0.2em] text-accent">{t.hero.eyebrow}</p>
      <h1 class="max-w-3xl text-5xl font-semibold leading-tight text-ink">{t.hero.title}</h1>
      <p class="max-w-2xl text-lg leading-relaxed text-muted">{t.hero.subtitle}</p>
      <UrlForm />
    </div>
  </section>

  <section class="border-b border-line bg-surface">
    <div class="shell flex flex-col gap-10 py-20">
      <SectionHeader
        eyebrow={t.whatWeCheck.eyebrow.replace("{count}", String(count))}
        title={t.whatWeCheck.title}
      />
      <div class="grid gap-6 md:grid-cols-3">
        {
          (["seo", "social", "perf"] as const).map((key) => (
            <div class="rounded-xl border border-line bg-card p-6">
              <h2 class="text-lg font-semibold text-ink">{t.report.categories[key]}</h2>
              <p class="mt-2 text-sm leading-relaxed text-muted">{t.report.categoryIntro[key]}</p>
            </div>
          ))
        }
      </div>
    </div>
  </section>

  <section class="bg-base">
    <div class="shell flex flex-col gap-8 py-20">
      <h2 class="text-3xl font-semibold text-ink">{t.faq.title}</h2>
      <div class="grid gap-4">
        {
          t.faq.items.map(([question, answer]) => (
            <details class="rounded-xl border border-line bg-card p-5">
              <summary class="cursor-pointer font-medium text-ink">{question}</summary>
              <p class="mt-3 text-sm leading-relaxed text-muted">{answer}</p>
            </details>
          ))
        }
      </div>
    </div>
  </section>
</main>

<script type="application/ld+json" is:inline set:html={JSON.stringify(jsonLd)} />
```

This needs one more dictionary key. Add to `audit` in both `src/i18n/es.ts` and `src/i18n/en.ts`:

```ts
    whatWeCheck: {
      eyebrow: "{count} CHEQUEOS",          // EN: "{count} CHECKS"
      title: "Qué revisa el análisis.",     // EN: "What the audit looks at."
    },
```

- [ ] **Step 5: Build the two landing pages**

Create `src/pages/auditoria/index.astro`:

```astro
---
import Base from "../../layouts/Base.astro";
import AuditLanding from "../../components/audit/AuditLanding.astro";
import { getDict } from "../../i18n";

export const prerender = true;

const t = getDict("es").audit.meta;
const alternates = { es: "/auditoria", en: "/en/audit" };
---

<Base title={t.title} description={t.description} alternates={alternates}>
  <AuditLanding />
</Base>
```

Create `src/pages/en/audit/index.astro` with `getDict("en")` and paths one level deeper.

- [ ] **Step 6: Add the form handler to the client script**

Prepend to `src/scripts/audit.ts` (before the report-page block):

```ts
const form = document.querySelector<HTMLFormElement>("[data-audit-form]");

if (form) {
  const input = form.querySelector<HTMLInputElement>("input[name='url']")!;
  const button = form.querySelector<HTMLButtonElement>("button[type='submit']")!;
  const errorEl = form.querySelector<HTMLElement>("[data-audit-error]")!;
  const errors: Record<string, string> = JSON.parse(form.dataset.errors ?? "{}");
  const reportBase = form.dataset.reportBase ?? "/auditoria/r/";
  const original = button.textContent ?? "";

  const showError = (code: string) => {
    errorEl.textContent = errors[code] ?? errors.server ?? code;
    errorEl.classList.remove("hidden");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");
    button.disabled = true;
    button.textContent = form.dataset.analyzing ?? original;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "audit_started" });

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input.value, lang: form.dataset.lang ?? "es" }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error);
        return;
      }
      location.href = `${reportBase}${data.id}/`;
    } catch {
      showError("server");
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });
}
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS — including the existing 28 tests, which must not regress.

- [ ] **Step 8: Commit**

```bash
git add src/components/audit src/pages src/scripts/audit.ts tests/e2e
git commit -m "$(cat <<'EOF'
feat(audit): landing pages with FAQ and WebApplication schema

The landing carries real content below the form — a bare input does not
rank. Static routes take priority over [servicio].astro; a test pins it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YBpPyAfPcrMRceggz7pDWi
EOF
)"
```

---

### Task 13: Lead context in the contact form

Makes the audit convert: the CTA carries the audit id, the form pre-fills, and the email arrives with a link to the report.

**Files:**
- Modify: `src/pages/api/contact.ts`
- Modify: `src/components/Contact.astro`
- Modify: `src/scripts/contact.ts`
- Modify: `src/i18n/es.ts`, `src/i18n/en.ts`
- Modify: `tests/e2e/audit.spec.ts`

**Interfaces:**
- Consumes: `getAudit`, the `?ref=audit&id=…&url=…` query from `AuditCta.astro`.
- Produces: `auditId` accepted by `POST /api/contact`.

- [ ] **Step 1: Write the failing e2e test**

Append to `tests/e2e/audit.spec.ts`:

```ts
test.describe("audit → contact handoff", () => {
  test("prefills the contact message from the audit query params", async ({ page }) => {
    await page.goto("/?ref=audit&id=seedes01&url=https%3A%2F%2Fejemplo.com%2F#contacto");
    const message = page.locator("[data-contact-form] textarea[name='message']");
    await expect(message).toHaveValue(/ejemplo\.com/);
    await expect(page.locator("[data-contact-form] input[name='auditId']")).toHaveValue(
      "seedes01",
    );
  });

  test("accepts a submission carrying an auditId", async ({ request }) => {
    const res = await request.post("/api/contact", {
      data: {
        name: "Test",
        email: "test@example.com",
        message: "Vengo de la auditoría",
        auditId: "seedes01",
      },
    });
    // 200 when RESEND_API_KEY is configured, 500 when it is not — either way
    // the request must be accepted as well-formed, never 400.
    expect([200, 500]).toContain(res.status());
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run test:e2e -- audit`
Expected: FAIL — no `auditId` field exists.

- [ ] **Step 3: Add the hidden field to the form**

In `src/components/Contact.astro`, add just before the honeypot input:

```astro
        <input type="hidden" name="auditId" value="" data-audit-id-field />
```

- [ ] **Step 4: Add the prefill copy**

In both `src/i18n/es.ts` and `src/i18n/en.ts`, add to `audit`:

```ts
    prefill: "Hola, hice la auditoría de {url} y quiero resolver lo que encontraron.",
```

English: `"Hi, I ran the audit for {url} and I'd like to fix what it found."`

Expose it to the client by adding a data attribute on the contact form in `Contact.astro`:

```astro
        data-audit-prefill={getDict(lang).audit.prefill}
```

- [ ] **Step 5: Prefill from the query string**

Append to `src/scripts/contact.ts`, inside the `if (form)` block:

```ts
  // Arriving from an audit report: carry the context into the message so the
  // lead reaches us already diagnosed.
  const query = new URLSearchParams(location.search);
  if (query.get("ref") === "audit") {
    const auditId = query.get("id") ?? "";
    const auditedUrl = query.get("url") ?? "";
    const idField = form.querySelector<HTMLInputElement>("[data-audit-id-field]");
    const message = form.querySelector<HTMLTextAreaElement>("textarea[name='message']");
    if (idField) idField.value = auditId;
    if (message && !message.value && auditedUrl) {
      message.value = (form.dataset.auditPrefill ?? "").replace("{url}", auditedUrl);
    }
  }
```

- [ ] **Step 6: Include the report link in the email**

In `src/pages/api/contact.ts`, read and validate the field, then add it to the mail body:

```ts
  const auditId = String(body.auditId ?? "").trim();
```

```ts
  // Only a well-formed id becomes a link — this string goes into an email.
  const auditLink = /^[a-z0-9]{8}$/.test(auditId)
    ? `https://dishape.dev/auditoria/r/${auditId}/`
    : null;
```

Add to the HTML body, after the company line:

```ts
        ${auditLink ? `<p><strong>Auditoría:</strong> <a href="${auditLink}">${auditLink}</a></p>` : ""}
```

and to the text body:

```ts
${auditLink ? `Auditoría: ${auditLink}\n` : ""}
```

Also extend the subject so audit leads are obvious in the inbox:

```ts
      subject: `Nuevo contacto${auditLink ? " (auditoría)" : ""}: ${name}${company ? ` · ${company}` : ""}`,
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/api/contact.ts src/components/Contact.astro src/scripts/contact.ts src/i18n tests/e2e
git commit -m "$(cat <<'EOF'
feat(audit): carry audit context into the contact form and lead email

The audit id is pattern-validated before it becomes a link — that string
ends up in an outbound email.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YBpPyAfPcrMRceggz7pDWi
EOF
)"
```

---

### Task 14: Deploy configuration and final verification

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `SETUP.md`
- Modify: `astro.config.mjs` (sitemap filter)

**Interfaces:**
- Consumes: everything.
- Produces: a deployable branch.

- [ ] **Step 1: Keep report pages out of the sitemap**

In `astro.config.mjs`, extend the sitemap filter — generated report URLs must never be submitted to Google:

```js
      filter: (page) => !page.includes("/lab") && !page.includes("/r/"),
```

- [ ] **Step 2: Provision the data directory on the VPS**

Add to the deploy script in `.github/workflows/deploy.yml`, before `npm ci`:

```yaml
            mkdir -p /var/lib/dishape/audits
```

Document in `SETUP.md` that `AUDIT_DATA_DIR` and `PAGESPEED_API_KEY` must be present in the systemd unit's `EnvironmentFile`, and that the directory must be writable by the service user. Note explicitly that the directory lives outside `/opt/dishape` because the deploy runs `git reset --hard`.

- [ ] **Step 3: Run the complete suite**

Run: `npm test`
Expected: PASS — all unit tests plus all e2e tests, including the 28 that predate this feature.

- [ ] **Step 4: Verify the build output is clean**

Run: `npm run build`
Expected: succeeds. Confirm the API routes and the two `r/[id]` routes are listed as on-demand (server) and the two landings as prerendered.

- [ ] **Step 5: Manual smoke test against a real site**

```bash
AUDIT_DATA_DIR=/tmp/audit-data node ./dist/server/entry.mjs
```

Then in a browser: open `http://127.0.0.1:4321/auditoria/`, audit a real public site (e.g. `example.com`), and confirm:
- findings render within ~2 seconds
- the performance card fills in within ~30 seconds
- the share preview matches what the site actually shows
- the CTA lands on the contact form with the message pre-filled
- the same audit re-run returns the same report id (cache hit)

- [ ] **Step 6: Commit and open the PR**

```bash
git add astro.config.mjs .github/workflows/deploy.yml SETUP.md
git commit -m "$(cat <<'EOF'
chore(audit): provision data dir on deploy, exclude reports from sitemap

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YBpPyAfPcrMRceggz7pDWi
EOF
)"
git push -u origin feat/site-auditor
```

---

## Notes for the implementer

- **The riskiest module is `safeFetch.ts`.** If a change there makes a test fail, the test is almost certainly right. Never relax a blocked-range assertion to make something pass.
- **`na` is not a failure.** A check that does not apply (no hreflang on a monolingual site) must not lower the score. The tests in Task 5 pin this.
- **Copy and catalog cannot drift**: the parity test in Task 10 fails the build if a registered check has no strings. When you add a check, add its copy in the same commit.
- **The e2e suite cannot audit its own test server** — loopback is blocked by design. Report pages are tested against seeded fixture records instead.
