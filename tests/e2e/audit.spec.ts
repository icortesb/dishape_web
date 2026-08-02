import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

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

  // Playwright's request fixture sends no X-Forwarded-For, so every case
  // would otherwise collide on the single clientIp() bucket "unknown" and
  // spuriously rate-limit each other under fullyParallel. Give each case its
  // own synthetic client address, matching how nginx gives each real visitor
  // a distinct one in production.
  cases.forEach((c, i) => {
    test(`rejects ${c.name}`, async ({ request }) => {
      const res = await request.post("/api/audit", {
        headers: { "x-forwarded-for": `203.0.113.${i + 10}` },
        data: { url: c.url, lang: "es" },
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe(c.error);
    });
  });

  test("rejects a malformed body", async ({ request }) => {
    const res = await request.post("/api/audit", {
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `203.0.113.${cases.length + 10}`,
      },
      data: "not json at all",
    });
    expect(res.status()).toBe(400);
  });
});

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

// The SSRF guard blocks the test server's own loopback address, by design, so
// the suite cannot audit itself. Report pages are verified against fixture
// records written straight into AUDIT_DATA_DIR.
const DATA_DIR = "./test-results/audit-data";

const BASE_CHECKS = [
  { id: "seo.title.present", status: "pass" },
  { id: "seo.h1.unique", status: "fail", evidence: { actual: 0 } },
  // No evidence at all: `found` names {actual}, so the report has to fall back
  // to foundEmpty instead of printing a literal placeholder.
  { id: "seo.title.length", status: "fail" },
  // The evidence is an internal enum token, not prose.
  { id: "social.og.image", status: "fail", evidence: { reason: "missing" } },
  { id: "social.og.title", status: "pass", evidence: { found: "Ejemplo Inc." } },
  // "na" means we could not determine this — not that it is broken.
  { id: "social.jsonld", status: "na" },
];

/** Write a record straight to the store so the page has something to render. */
async function seedRecord(id: string, over: Record<string, unknown> = {}) {
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
      checks: BASE_CHECKS,
      vitals: null,
      // Set by default so the page renders its final state and the client
      // script never fires a live PageSpeed request from the test suite.
      vitalsError: "seeded",
      ...over,
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
    await expect(page.getByText("Encabezado principal único").first()).toBeVisible();

    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toBe("noindex, follow");
  });

  test("never prints a raw placeholder or an internal enum token (es)", async ({
    page,
  }) => {
    const id = "seedes02";
    await seedRecord(id);
    await page.goto(`/auditoria/r/${id}/`);
    const text = (await page.locator("main").textContent()) ?? "";

    // A check with no evidence must fall back to its foundEmpty sentence.
    expect(text).toContain("Esta página no tiene título, así que no hay longitud que medir.");
    expect(text).not.toMatch(/\{\w+\}/);

    // The og:image reason is an internal token; the visitor must read Spanish.
    expect(text).not.toContain("problema: missing");
    expect(text).toContain("no hay ninguna declarada");
  });

  test("never prints a raw placeholder or an internal enum token (en)", async ({
    page,
  }) => {
    const id = "seeden02";
    await seedRecord(id);
    await page.goto(`/en/audit/r/${id}/`);
    const text = (await page.locator("main").textContent()) ?? "";

    expect(text).toContain("This page has no title, so there's no length to measure.");
    expect(text).not.toMatch(/\{\w+\}/);
    expect(text).not.toContain("problem: missing");
    expect(text).toContain("the page declares none");
  });

  test("an undetermined check is never reported as a defect", async ({ page }) => {
    const id = "seedes03";
    await seedRecord(id);
    await page.goto(`/auditoria/r/${id}/`);
    const text = (await page.locator("main").textContent()) ?? "";

    // social.jsonld is "na": we could not determine it. Accusing the site of a
    // defect we never observed is the one thing this report cannot do.
    expect(text).not.toContain("Datos estructurados");
    // …and it must not sit in the denominator either: social has 2 applicable
    // checks (og:image fail, og:title pass), not 3.
    expect(text).toContain("1 de 2 chequeos");
  });

  test.describe("share button", () => {
    // Chromium only resolves clipboard.writeText with the permission granted;
    // a real visitor on HTTPS has it by default for a click-initiated write.
    test.use({ permissions: ["clipboard-read", "clipboard-write"] });

    test("copies the report link and says so, without console noise", async ({
      page,
    }) => {
      const id = "seedes06";
      await seedRecord(id);

      const noise: string[] = [];
      page.on("console", (m) => noise.push(`${m.type()}: ${m.text()}`));
      page.on("pageerror", (e) => noise.push(`pageerror: ${e.message}`));

      await page.goto(`/auditoria/r/${id}/`);
      const button = page.locator("[data-copy-link]");
      await button.click();

      await expect(button).toHaveText("Link copiado");
      expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
        `/auditoria/r/${id}/`,
      );
      expect(noise).toEqual([]);
    });
  });

  test("serves the English report at its own route", async ({ page }) => {
    const id = "seeden01";
    await seedRecord(id);
    await page.goto(`/en/audit/r/${id}/`);
    await expect(page.getByText("Single main heading").first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  // Fetched without a browser on purpose: the client script must not fire a
  // live PageSpeed request from the test suite.
  test("renders the measuring state while performance is still unknown", async ({
    request,
  }) => {
    const id = "seedes05";
    await seedRecord(id, { vitals: null, vitalsError: null });
    const html = await (await request.get(`/auditoria/r/${id}/`)).text();

    expect(html).toContain("data-vitals-pending");
    expect(html).toContain("Midiendo el rendimiento con Google");
  });

  test("renders performance numbers when the audit already has them", async ({
    page,
  }) => {
    const id = "seedes04";
    await seedRecord(id, {
      vitalsError: null,
      vitals: {
        score: 72,
        lab: { lcp: 2500, cls: 0.05, tbt: 300, fcp: 1200 },
        field: null,
        transferBytes: 2 * 1024 * 1024,
        renderBlockingMs: 120,
        imageSavingsBytes: null,
      },
    });
    await page.goto(`/auditoria/r/${id}/`);
    const text = (await page.locator("main").textContent()) ?? "";

    expect(text).toContain("72");
    expect(text).toContain("2.50 s");
    expect(text).toContain("2.00 MB");
    expect(text).toContain("tráfico suficiente");
  });
});
