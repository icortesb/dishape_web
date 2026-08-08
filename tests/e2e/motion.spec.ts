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

test.describe("motion — a scroll that starts in the frame the bundle refreshes", () => {
  /**
   * ScrollTrigger's global refresh measures every trigger from the top of the
   * page: it writes the scroll to 0 and back (ScrollTrigger.js:502 `obj(0)`,
   * :549 `obj(obj.rec)`). That write cancels whatever scroll the browser is
   * animating. ScrollTrigger's own guard against it (:484) tests
   * `_lastScrollTime`, which is set only by a dispatched `scroll` event
   * (:388) — one frame narrower than "a scroll is animating" — so a scroll
   * that begins in the same frame as the refresh is cancelled before it has
   * moved a pixel, with no `scrollStart` ever dispatched.
   *
   * Both cases below are ordinary visitor behaviour: a click held for a fifth
   * of a second, and a keypress a fifth of a second after the one that woke
   * the bundle. Landing at the top of the page with the contact form thousands
   * of pixels below is the failure this guards.
   *
   * The timings are swept rather than pinned, because where that frame falls
   * depends on how long this machine takes to fetch and evaluate the chunk.
   * The step is smaller than the window measured here (~15ms wide, at a
   * 215-230ms hold on 1280x720), so a window anywhere in the band is hit by at
   * least one sample. The chunk is warmed into the HTTP cache first for the
   * same reason: a cold fetch moves the window out of the band.
   */
  const MOTION_CHUNK = /\/_astro\/motion\.[^/]*\.js(\?|$)/;
  const BAND = [192, 200, 208, 216, 224, 232, 240, 248, 256, 264];

  const formOnScreen = (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const r = document.getElementById("contacto")!.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    });

  const scrollY = (page: import("@playwright/test").Page) =>
    page.evaluate(() => Math.round(window.scrollY));

  const warm = async (page: import("@playwright/test").Page) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    const woken = page.waitForResponse(MOTION_CHUNK);
    await page.keyboard.press("Tab");
    await woken;
  };

  const settle = async (page: import("@playwright/test").Page) =>
    page
      .waitForFunction(
        () => {
          const r = document
            .getElementById("contacto")!
            .getBoundingClientRect();
          return r.top < window.innerHeight && r.bottom > 0;
        },
        undefined,
        { timeout: 3000 },
      )
      .then(() => true)
      .catch(() => false);

  test("a click held while the bundle refreshes still lands on the contact form", async ({
    page,
  }) => {
    test.slow();
    await warm(page);

    const failures: string[] = [];
    for (const hold of BAND) {
      await page.goto("/");
      // Guard the guard: the form has to start off screen, or "it is on
      // screen afterwards" proves nothing.
      expect(await formOnScreen(page), `form already on screen at ${hold}ms`).toBe(
        false,
      );

      const link = page
        .locator('a[href*="#contacto"]')
        .filter({ visible: true })
        .first();
      const box = await link.boundingBox();
      expect(box, "no visible #contacto link on the home page").toBeTruthy();

      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(hold);
      await page.mouse.up();

      if (!(await settle(page)))
        failures.push(`${hold}ms hold → scrollY ${await scrollY(page)}`);
    }

    expect(
      failures,
      "the click's smooth scroll was cancelled, leaving the visitor at the top of the page with the contact form far below",
    ).toEqual([]);
  });

  test("End pressed while the bundle refreshes still reaches the bottom", async ({
    page,
  }) => {
    test.slow();
    await warm(page);

    const failures: string[] = [];
    for (const gap of BAND) {
      await page.goto("/");
      const bottom = await page.evaluate(() =>
        Math.round(document.documentElement.scrollHeight - window.innerHeight),
      );
      expect(bottom, "End only means something on a scrollable page").toBeGreaterThan(
        2000,
      );

      // Tab wakes the bundle and starts no scroll of its own, so the refresh
      // it schedules is already running when End arrives.
      await page.keyboard.press("Tab");
      await page.waitForTimeout(gap);
      await page.keyboard.press("End");

      const reached = await page
        .waitForFunction(
          (target) =>
            Math.round(window.scrollY) >= target,
          bottom - 2,
          { timeout: 3000 },
        )
        .then(() => true)
        .catch(() => false);
      if (!reached)
        failures.push(`${gap}ms gap → scrollY ${await scrollY(page)} of ${bottom}`);
    }

    expect(
      failures,
      "the End keypress never scrolled — its animated scroll was cancelled in the frame the refresh ran",
    ).toEqual([]);
  });
});
