import { test, expect } from "@playwright/test";

// The language toggle is the part that broke in production. The nginx edge
// redirect sends a bare "/" request to the visitor's `lang` cookie language.
// So the toggle MUST update that cookie *before* the browser navigates,
// otherwise the request for "/" still carries the old language and nginx
// bounces the visitor right back (EN->ES never reaches Spanish).
//
// CI has no nginx, so these tests verify the two things the app is responsible
// for: (1) the toggle lands on the right localized page, and (2) the cookie is
// written synchronously on click — the invariant nginx relies on.

const langCookie = async (context: import("@playwright/test").BrowserContext) =>
  (await context.cookies()).find((c) => c.name === "lang")?.value;

test.describe("language toggle", () => {
  test("EN -> ES lands on Spanish and persists lang=es", async ({
    page,
    context,
  }) => {
    await page.goto("/en/");
    await page.locator('a[data-set-lang="es"]').click();

    await page.waitForURL("http://127.0.0.1:4321/");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    expect(await langCookie(context)).toBe("es");
  });

  test("ES -> EN lands on English and persists lang=en", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.locator('a[data-set-lang="en"]').click();

    await page.waitForURL("**/en/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(await langCookie(context)).toBe("en");
  });

  // The core invariant: the cookie write happens during the click handler,
  // before any navigation. We dispatch an (untrusted, non-navigating) click and
  // read the cookie in the same synchronous turn.
  test("toggle writes lang cookie synchronously on click", async ({ page }) => {
    await page.goto("/en/"); // page script sets lang=en first
    const cookieAfterClick = await page.evaluate(() => {
      const a = document.querySelector('a[data-set-lang="es"]');
      a?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return document.cookie;
    });
    expect(cookieAfterClick).toContain("lang=es");
  });
});
