import { test, expect } from "@playwright/test";

// Crawl every internal link on the key entry pages and assert none 404/500.
// This is the broad safety net: a nav item, toggle, or content link pointing at
// a dead route fails here regardless of which template introduced it.
const seeds = ["/", "/en/", "/blog/", "/en/blog/"];
const ORIGIN = "http://127.0.0.1:4321";

test.describe("no broken internal links", () => {
  for (const seed of seeds) {
    test(`internal links on ${seed} resolve`, async ({ page, request }) => {
      await page.goto(seed);

      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((as) =>
          as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""),
        );

      const internal = [...new Set(hrefs)]
        .map((h) => {
          if (!h || h.startsWith("#") || h.startsWith("mailto:") || h.startsWith("tel:")) {
            return null;
          }
          try {
            const u = new URL(h, ORIGIN);
            return u.host === "127.0.0.1:4321" ? u.pathname + u.search : null;
          } catch {
            return null;
          }
        })
        .filter((h): h is string => h !== null);

      const broken: string[] = [];
      for (const path of internal) {
        const res = await request.get(path, { maxRedirects: 0 });
        if (res.status() >= 400) broken.push(`${path} -> ${res.status()}`);
      }

      expect(broken, `broken links found on ${seed}`).toEqual([]);
    });
  }
});
