import { test, expect } from "@playwright/test";

// One representative page per template, per language.
const pages = [
  { path: "/", lang: "es" },
  { path: "/en/", lang: "en" },
  { path: "/blog/", lang: "es" },
  { path: "/en/blog/", lang: "en" },
  { path: "/desarrollo-web/", lang: "es" },
  { path: "/en/web-development/", lang: "en" },
];

test.describe("i18n integrity", () => {
  for (const { path, lang } of pages) {
    test(`${path}: lang=${lang} + complete hreflang set`, async ({ page }) => {
      await page.goto(path);

      await expect(page.locator("html")).toHaveAttribute("lang", lang);

      const es = page.locator('link[rel="alternate"][hreflang="es"]');
      const en = page.locator('link[rel="alternate"][hreflang="en"]');
      const xDefault = page.locator(
        'link[rel="alternate"][hreflang="x-default"]',
      );

      // Exactly one of each — duplicates or a missing alternate breaks SEO and
      // the toggle's reciprocity.
      await expect(es).toHaveCount(1);
      await expect(en).toHaveCount(1);
      await expect(xDefault).toHaveCount(1);

      const esHref = await es.getAttribute("href");
      const enHref = await en.getAttribute("href");

      // Alternates must be absolute prod URLs and point at the right locale tree.
      expect(esHref).toMatch(/^https:\/\/dishape\.dev\//);
      expect(enHref).toMatch(/^https:\/\/dishape\.dev\/en\//);
      // x-default mirrors the Spanish (default-locale) URL.
      expect(await xDefault.getAttribute("href")).toBe(esHref);
    });
  }
});
