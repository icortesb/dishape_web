import { test, expect } from "@playwright/test";

// Every public page must serve 200 directly (no redirect hop). Spanish lives at
// "/" (prefixDefaultLocale: false); English under "/en/".
const must200 = [
  "/",
  "/en/",
  "/blog/",
  "/en/blog/",
  // service pages — ES
  "/desarrollo-web/",
  "/tienda-online/",
  "/chatbots-ia/",
  "/automatizacion/",
  // service pages — EN
  "/en/web-development/",
  "/en/online-store/",
  "/en/ai-chatbots/",
  "/en/automation/",
];

// "/es" has no route (Spanish is the root). It must redirect, never 404 — this
// is the exact regression that took the site down (https://dishape.dev/es/ 404).
const mustRedirect = [
  { from: "/es", to: "/" },
  { from: "/es/", to: "/" },
];

const stripOrigin = (loc: string | undefined) =>
  (loc ?? "").replace(/^https?:\/\/[^/]+/, "");

test.describe("routes & redirects", () => {
  for (const path of must200) {
    test(`200 direct: ${path}`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(200);
    });
  }

  for (const { from, to } of mustRedirect) {
    test(`redirect ${from} -> ${to}`, async ({ request }) => {
      const res = await request.get(from, { maxRedirects: 0 });
      expect([301, 302, 307, 308], from).toContain(res.status());
      expect(stripOrigin(res.headers()["location"]), from).toBe(to);
    });
  }

  test("unknown path returns 404", async ({ request }) => {
    const res = await request.get("/definitely-not-a-real-page-zzz", {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(404);
  });
});
