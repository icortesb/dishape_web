import { expect, test } from "@playwright/test";

/**
 * The GSAP bundle is lazily imported on the first scroll/pointerdown/keydown/
 * touchstart (motionLoader.ts). Everything here takes the default-motion
 * branch, because that is the only branch where motion.ts hides anything:
 * under prefers-reduced-motion it paints every .reveal at once (motion.ts:86)
 * and global.css:198 turns every scroll into an instant jump.
 *
 * test.use({ reducedMotion: … }) silently does not apply in this project, so
 * the preference is set with page.emulateMedia().
 */
test.describe("motion — keyboard scrolling", () => {
  /**
   * `html { scroll-behavior: smooth }` (global.css:39) is not only for
   * fragments: in Chrome it also makes End, PageDown, Space, Home and the
   * arrow keys animated scrolls. motionLoader.ts listens for `keydown`, so a
   * visitor's first keypress starts an animated scroll and loads motion.ts in
   * the same moment — and nothing motion.ts does may cancel that scroll.
   *
   * Keyboard scrolling is how keyboard-only and many low-vision visitors move
   * through the page, and on the home page it is how they reach the contact
   * form.
   *
   * Both tests wait for the motion chunk's own response, so a run where the
   * keypress failed to wake the bundle fails instead of passing vacuously.
   */
  const MOTION_CHUNK = /\/_astro\/motion\.[^/]*\.js(\?|$)/;

  const scrollY = (page: import("@playwright/test").Page) =>
    page.evaluate(() => Math.round(window.scrollY));

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
  });

  test("End reaches the bottom of the page on the keypress that wakes the bundle", async ({
    page,
  }) => {
    await page.goto("/");
    const bottom = await page.evaluate(() =>
      Math.round(document.documentElement.scrollHeight - window.innerHeight),
    );
    // Guard the guard: End only means something on a page taller than the
    // viewport. Measured at 6696 on the 1280x720 desktop project.
    expect(bottom).toBeGreaterThan(2000);

    const woken = page.waitForResponse(MOTION_CHUNK);
    await page.keyboard.press("End");
    await woken;

    await expect
      .poll(() => scrollY(page), {
        timeout: 5000,
        message:
          "End never reached the bottom — the animated scroll it started was cancelled",
      })
      .toBeGreaterThanOrEqual(bottom - 2);

    // …and it has to stay there. A cancellation that arrives after the scroll
    // lands would yank the visitor back, and an assertion taken mid-flight
    // would not see it.
    await page.waitForTimeout(1000);
    expect(await scrollY(page)).toBeGreaterThanOrEqual(bottom - 2);
  });

  test("PageDown advances a page on the keypress that wakes the bundle", async ({
    page,
  }) => {
    await page.goto("/");
    const viewport = await page.evaluate(() => window.innerHeight);

    const woken = page.waitForResponse(MOTION_CHUNK);
    await page.keyboard.press("PageDown");
    await woken;

    // Chrome moves 87.5% of the viewport per PageDown — 630 of 720 here,
    // measured with the motion chunk blocked. Asserting 80% keeps Chrome's
    // exact fraction out of the test while still separating a real page turn
    // from the cancelled scroll, which never got past 130px.
    const expected = Math.round(viewport * 0.8);
    await expect
      .poll(() => scrollY(page), {
        timeout: 5000,
        message:
          "PageDown never advanced a page — the animated scroll it started was cancelled",
      })
      .toBeGreaterThanOrEqual(expected);

    await page.waitForTimeout(1000);
    expect(await scrollY(page)).toBeGreaterThanOrEqual(expected);
  });
});

test.describe("motion — reveals on a fragment navigation", () => {
  /**
   * motion.ts hides every .reveal that sits below 85% of the viewport when the
   * bundle finally loads, and excludes anything inside the element the URL
   * fragment names — that section is what the visitor asked to look at.
   *
   * /#servicios is a section taller than the viewport, so four of its eight
   * .reveal elements land below the 85% line once the scroll settles: with the
   * exclusion they are never hidden, without it they are hidden and stay that
   * way until the visitor scrolls past them.
   */
  test("nothing inside the section the fragment names is hidden", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/#servicios");

    const counts = () =>
      page.evaluate(() => {
        const all = [...document.querySelectorAll<HTMLElement>(".reveal")];
        const hidden = all.filter(
          (el) => getComputedStyle(el).visibility === "hidden",
        );
        const section = document.getElementById("servicios")!;
        return {
          inside: all.filter((el) => section.contains(el)).length,
          hidden: hidden.length,
          hiddenInside: hidden.filter((el) => section.contains(el)).length,
        };
      });

    // The reveal setup is deferred until the animated fragment scroll settles,
    // so wait for it to have run at all — otherwise a build that hides nothing
    // would pass this test for the wrong reason.
    await expect
      .poll(async () => (await counts()).hidden, {
        timeout: 8000,
        message: "motion.ts never hid anything, so this test proves nothing",
      })
      .toBeGreaterThan(0);
    await page.waitForTimeout(1000);

    const { inside, hidden, hiddenInside } = await counts();
    expect(inside).toBeGreaterThan(0);
    expect(hidden).toBeGreaterThan(0);
    expect(
      hiddenInside,
      "elements inside the section the visitor navigated to were hidden",
    ).toBe(0);
  });
});
