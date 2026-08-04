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
  // Records are swept after 30 days, so the one URL this feature exists to have
  // forwarded outlives its record. It must read as expired, not as broken.
  test("an expired report link explains itself in Spanish", async ({ request }) => {
    const res = await request.get("/auditoria/r/zzzzzzzz/", { maxRedirects: 0 });
    expect(res.status()).toBe(404);

    const html = await res.text();
    expect(html).toContain("Este reporte ya no está disponible");
    expect(html).toContain('href="/auditoria/"');
  });

  test("an expired report link explains itself in English", async ({ request }) => {
    const res = await request.get("/en/audit/r/zzzzzzzz/", { maxRedirects: 0 });
    expect(res.status()).toBe(404);

    const html = await res.text();
    expect(html).toContain("This report is no longer available");
    expect(html).toContain('href="/en/audit/"');
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
    expect(text).toContain("Esta página no declara una imagen para compartir.");
    expect(text).not.toContain("tiene un problema");
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
    expect(text).toContain("This page declares no share image.");
    expect(text).not.toContain("has a problem");
  });

  test("an unverified share image is not framed as a defect", async ({ page }) => {
    const id = "seedes07";
    // Absolute og:image whose reachability probe never resolved: a live
    // production state, and the one place an "na" result still reaches the
    // visitor. Saying it "has a problem" asserts a defect we never observed.
    await seedRecord(id, {
      checks: [{ id: "social.og.image", status: "na", evidence: { reason: "unverified" } }],
    });
    await page.goto(`/auditoria/r/${id}/`);
    const text = (await page.locator("main").textContent()) ?? "";

    expect(text).not.toContain("tiene un problema");
    expect(text).toContain("No pudimos confirmar que la imagen declarada responda.");
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

  test("says performance could not be measured instead of naming the source", async ({
    page,
  }) => {
    const id = "seedes08";
    await seedRecord(id); // vitalsError is set: the measurement already failed.
    await page.goto(`/auditoria/r/${id}/`);

    // The card cannot caption an em dash with "PageSpeed Insights" while the
    // panel below says the measurement failed.
    await expect(page.locator("[data-perf-note]")).toHaveText("No se pudo medir");
  });

  test("points hreflang at the same report, not at the homepages", async ({ page }) => {
    const id = "seedes09";
    await seedRecord(id);
    await page.goto(`/auditoria/r/${id}/`);

    const href = (hreflang: string) =>
      page.locator(`link[rel="alternate"][hreflang="${hreflang}"]`).getAttribute("href");
    expect(await href("es")).toBe(`https://dishape.dev/auditoria/r/${id}/`);
    expect(await href("en")).toBe(`https://dishape.dev/en/audit/r/${id}/`);
  });

  test("each element falls back to its own copy when the measurement fails", async ({
    page,
  }) => {
    const id = "seedes11";
    await seedRecord(id, { vitals: null, vitalsError: null });
    await page.route(`**/api/audit/${id}/vitals`, (route) =>
      route.fulfill({ json: { ok: true, status: "unavailable", reason: "seeded" } }),
    );

    await page.goto(`/auditoria/r/${id}/`);

    // The score card has room for a caption; the panel it belongs to has room
    // for the explanation. Sharing one string collapses the panel to four words.
    await expect(page.locator("[data-perf-note]")).toHaveText("No se pudo medir");
    await expect(page.locator("[data-vitals-pending]")).toHaveText(
      "No pudimos medir el rendimiento en este momento. El resto del diagnóstico sigue siendo válido.",
    );
  });

  test("the completion event survives the reload that follows it", async ({ page }) => {
    const id = "seedes10";
    await seedRecord(id, { vitals: null, vitalsError: null });

    // Model GTM the way it actually behaves: dataLayer.push only appends, a tag
    // fires on a later tick, and eventCallback runs once it has. Anything that
    // navigates away in the same tick as the push destroys the event.
    await page.addInitScript(() => {
      const loads = Number(sessionStorage.getItem("loads") ?? "0") + 1;
      sessionStorage.setItem("loads", String(loads));
      (window as unknown as { dataLayer: unknown }).dataLayer = {
        push: (event: { event: string; eventCallback?: () => void }) => {
          setTimeout(() => {
            const fired = JSON.parse(sessionStorage.getItem("fired") ?? "[]");
            sessionStorage.setItem("fired", JSON.stringify([...fired, event.event]));
            event.eventCallback?.();
          }, 30);
        },
      };
    });

    // Ready once, then unavailable: the reloaded page must settle instead of
    // looping. In production the endpoint persists the vitals, so the second
    // load renders them server-side and never asks again.
    let calls = 0;
    await page.route(`**/api/audit/${id}/vitals`, async (route) => {
      calls += 1;
      await route.fulfill({
        json:
          calls === 1
            ? { ok: true, status: "ready", vitals: { score: 88 } }
            : { ok: true, status: "unavailable", reason: "seeded" },
      });
    });

    await page.goto(`/auditoria/r/${id}/`);

    // The reload tears down the execution context, so a read can land mid
    // navigation; polling through that is expected, an empty result is not.
    const read = (key: string) =>
      page.evaluate((k) => sessionStorage.getItem(k) ?? "", key).catch(() => "");

    await expect.poll(() => read("fired")).toContain("audit_completed");
    await expect.poll(() => read("loads")).toBe("2");
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

  // A report is the artifact a stranger receives by link. Without the site's
  // own navigation the diagnosis is orphaned: nothing on the page says who
  // produced it or where else to go.
  test("carries the site's navigation without displacing the diagnosis", async ({
    page,
  }) => {
    const id = "seedes12";
    await seedRecord(id);
    await page.goto(`/auditoria/r/${id}/`);

    await expect(page.locator("body > header nav a[href='/']").first()).toBeVisible();
    await expect(page.locator("body > footer")).toBeVisible();
    // The lowest-friction exit on a page a stranger reached by forwarded link.
    await expect(page.locator("a[data-cta='whatsapp_fab']")).toBeVisible();

    // The chrome contributes no heading: the audited host is still the page's
    // one and only h1.
    const h1 = page.locator("h1");
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText("ejemplo.com");

    // "Above the fold" means the diagnosis, not just its heading: a report
    // whose h1 fits but whose three scores are pushed under the fold has still
    // been displaced by the navbar. Measured on a phone, because a report is
    // usually opened from a link someone was sent.
    await page.setViewportSize({ width: 375, height: 667 });
    const cards = page.locator("[data-score-cards]");
    await expect(cards).toBeVisible();
    const box = (await cards.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(
      box.y + box.height,
      "the score cards fell below the fold",
    ).toBeLessThanOrEqual(viewport.height);

    // Reports are generated per visitor; navigation must not make them indexable.
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toBe("noindex, follow");
  });

  test("an expired report still offers the site's navigation", async ({ page }) => {
    await page.goto("/auditoria/r/zzzzzzzz/");
    await expect(page.locator("body > header nav a[href='/']").first()).toBeVisible();
    await expect(page.locator("body > footer")).toBeVisible();
    await expect(page.locator("main h1")).toHaveText(
      "Este reporte ya no está disponible.",
    );
  });
});

test.describe("landing page", () => {
  // Unlinked from the site, the tool depends entirely on search for traffic —
  // and every existing visitor, the ones already convinced enough to be on the
  // site, never learns it exists.
  const entryPoints = [
    { home: "/", audit: "/auditoria/" },
    { home: "/en/", audit: "/en/audit/" },
  ];
  for (const { home, audit } of entryPoints) {
    test(`${home} links to the audit from the navbar and the footer`, async ({
      page,
    }) => {
      await page.goto(home);
      await expect(page.locator(`body > header nav a[href='${audit}']`)).toHaveCount(1);
      await expect(page.locator(`body > footer a[href='${audit}']`)).toHaveCount(1);
    });
  }

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

  // The landings are the tool's only organic distribution channel, so the
  // robots value is pinned EXACTLY: "noindex, follow" contains the substring
  // "index", so a toContain("index") check passes against the precise
  // regression it exists to catch.
  const landings = [
    { path: "/auditoria/", counterpart: "en", href: /\/en\/audit\/$/ },
    { path: "/en/audit/", counterpart: "es", href: /dishape\.dev\/auditoria\/$/ },
  ];
  for (const { path, counterpart, href } of landings) {
    test(`${path} is indexable and declares its counterpart`, async ({ page }) => {
      await page.goto(path);
      const robots = await page.locator('meta[name="robots"]').getAttribute("content");
      expect(robots).toBe("index, follow, max-image-preview:large");
      const alt = page.locator(`link[rel="alternate"][hreflang="${counterpart}"]`);
      await expect(alt).toHaveAttribute("href", href);
    });
  }

  test("shows an inline error for an invalid URL without leaving the page", async ({
    page,
  }) => {
    await page.goto("/auditoria/");
    await page.fill("[data-audit-form] input[name='url']", "no es una url");
    await page.click("[data-audit-form] button[type='submit']");
    await expect(page.locator("[data-audit-error]")).toBeVisible();
    await expect(page.locator("[data-audit-error]")).toHaveText(
      "Esa dirección no parece válida. Probá con algo como tusitio.com",
    );
    expect(page.url()).toContain("/auditoria");
  });

  // role="alert" on a display:none node announces nothing: the live region has
  // to be in the accessibility tree before its text arrives. Order is what is
  // observable here, and it is exactly what was wrong.
  test("reveals the inline error before it writes the text into it", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { __alertMutations: string[] }).__alertMutations = [];
      const attach = () => {
        const el = document.querySelector("[data-audit-error]");
        if (!el) return;
        new MutationObserver((records) => {
          for (const r of records) {
            (window as unknown as { __alertMutations: string[] }).__alertMutations.push(
              r.type === "attributes" ? "class" : "text",
            );
          }
        }).observe(el, {
          attributes: true,
          attributeFilter: ["class"],
          childList: true,
          characterData: true,
          subtree: true,
        });
      };
      document.addEventListener("DOMContentLoaded", attach);
    });

    await page.goto("/auditoria/");
    await page.fill("[data-audit-form] input[name='url']", "no es una url");
    await page.click("[data-audit-form] button[type='submit']");
    await expect(page.locator("[data-audit-error]")).toHaveText(
      "Esa dirección no parece válida. Probá con algo como tusitio.com",
    );

    const kinds = await page.evaluate(
      () => (window as unknown as { __alertMutations: string[] }).__alertMutations,
    );
    // The handler hides the node on submit, so there are two class mutations:
    // the hide, then the reveal. The reveal must precede the text.
    expect(kinds, "the alert text never landed").toContain("text");
    expect(
      kinds.lastIndexOf("class"),
      "the alert was populated while still display:none — a screen reader announces nothing",
    ).toBeLessThan(kinds.indexOf("text"));
  });

  // audit_started fires on the click, so a rejected URL leaves the funnel with
  // a start and no matching outcome. Without audit_failed the top of the
  // funnel absorbs every rejection and the conversion rate is unreadable.
  test("records a failed attempt with its reason", async ({ page }) => {
    await page.goto("/auditoria/");
    await page.fill("[data-audit-form] input[name='url']", "no es una url");
    await page.click("[data-audit-form] button[type='submit']");
    await expect(page.locator("[data-audit-error]")).toBeVisible();

    const events = await page.evaluate(() =>
      (
        (window as unknown as { dataLayer?: Record<string, unknown>[] }).dataLayer ?? []
      ).map((e) => ({ event: e.event, audit_error: e.audit_error })),
    );
    expect(events).toContainEqual({ event: "audit_started", audit_error: undefined });
    expect(events).toContainEqual({
      event: "audit_failed",
      audit_error: "url_invalid",
    });
  });

  test("renders every placeholder it prints", async ({ page }) => {
    await page.goto("/auditoria/");
    const text = (await page.locator("main").textContent()) ?? "";
    // The check count comes from the registry, not from a hand-typed number —
    // and the registry excludes performance, so the eyebrow has to say so
    // rather than appear to count the third card in the grid below it.
    expect(text).toMatch(/\d+ CHEQUEOS \+ RENDIMIENTO/);
    expect(text).not.toMatch(/\{\w+\}/);
  });

  // Schema that describes something other than the visible page is exactly the
  // defect this tool reports on other sites. Run over BOTH languages: the FAQ
  // arrays are separate per dictionary, so one language can drift out of step
  // with its own markup while the other stays correct.
  const schemaPages = [
    { path: "/auditoria/", lang: "es", appName: "Auditoría web dishape" },
    { path: "/en/audit/", lang: "en", appName: "dishape Website Audit" },
  ];
  for (const { path, lang, appName } of schemaPages) {
    test(`${path}: the structured data describes the page a visitor actually sees`, async ({
      page,
    }) => {
      await page.goto(path);

      const graph = (
        await page.locator('script[type="application/ld+json"]').allTextContents()
      )
        .map((raw) => JSON.parse(raw))
        .flatMap((doc) => doc["@graph"] ?? [doc]);

      const rendered = await page
        .locator("main details")
        .evaluateAll((els) =>
          els.map((el) => ({
            name: el.querySelector("summary")?.textContent?.trim() ?? "",
            text: el.querySelector("p")?.textContent?.trim() ?? "",
          })),
        );
      expect(rendered.length, "no FAQ rendered").toBeGreaterThan(3);

      const faq = graph.find((n) => n["@type"] === "FAQPage");
      expect(faq, "no FAQPage schema").toBeTruthy();
      expect(faq.inLanguage).toBe(lang);
      expect(
        faq.mainEntity.map((q: Record<string, any>) => ({
          name: q.name,
          text: q.acceptedAnswer.text,
        })),
      ).toEqual(rendered);

      const app = graph.find((n) => n["@type"] === "WebApplication");
      expect(app, "no WebApplication schema").toBeTruthy();
      // A product name, not the pipe-delimited SERP title.
      expect(app.name).toBe(appName);
      expect(app.name, "the schema name is the SEO title").not.toContain("|");
      // The declared URL is the page's own canonical, not a guess.
      expect(app.url).toBe(
        await page.locator('link[rel="canonical"]').getAttribute("href"),
      );
      // It is free and ungated: the schema says so because the page does.
      expect(app.offers).toMatchObject({ price: "0" });
    });
  }

  // The report's category intros say "this page", meaning the page that was
  // audited. On the landing nothing has been audited, so reusing them points
  // the reader at a referent that does not exist.
  const cardCopy = [
    {
      path: "/auditoria/",
      present: "lo que Google necesita para entender una página",
      orphaned: "Qué encuentra Google cuando entra a esta página",
    },
    {
      path: "/en/audit/",
      present: "what Google needs in order to understand a page",
      orphaned: "What Google finds when it visits this page",
    },
  ];
  for (const { path, present, orphaned } of cardCopy) {
    test(`${path}: the category cards speak to a visitor with no report yet`, async ({
      page,
    }) => {
      await page.goto(path);
      const text = (await page.locator("main").textContent()) ?? "";
      expect(text).toContain(present);
      expect(text, "the landing reuses the report's deictic copy").not.toContain(
        orphaned,
      );
    });
  }

  test("serves its own copy in English", async ({ page }) => {
    await page.goto("/en/audit/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("main h1")).toHaveText(
      "Find out what's slowing your site down.",
    );
    await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveAttribute(
      "href",
      "https://dishape.dev/auditoria/",
    );
    const text = (await page.locator("main").textContent()) ?? "";
    expect(text).toMatch(/\d+ CHECKS \+ PERFORMANCE/);
    expect(text).not.toMatch(/\{\w+\}/);
  });
});
