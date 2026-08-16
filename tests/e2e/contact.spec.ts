import { test, expect } from "@playwright/test";

// The report CTA sends the visitor to /?ref=audit&id=…&url=…#contacto . These
// tests pin the loop that closes there: the visitor arrives with the audited
// URL and the report link already in the message, and the id rides along to
// the mailbox. Everything in that query string is attacker-controllable, so
// the hostile cases matter as much as the happy one.

const AUDITED = "https://ejemplo.com/planes?a=1";
const ID = "abcd1234";
const auditLink = (base: string) =>
  `${base}?ref=audit&id=${ID}&url=${encodeURIComponent(AUDITED)}#contacto`;

const box = "[data-contact-form] textarea[name='message']";
const hidden = "[data-contact-form] input[name='auditId']";

// The contact form sits below the fold, where motion.ts hides every .reveal
// with GSAP (autoAlpha 0) until a ScrollTrigger fires, and the GSAP bundle is
// only imported on the first pointerdown/scroll (motionLoader.ts), so it lands
// mid-test. Under prefers-reduced-motion the same script paints everything at
// once (motion.ts:86), which is a real visitor preference and takes the
// animation out of tests that are about the prefilled text. The default
// branch is covered on its own further down this file. Emulated per page
// rather than through
// `test.use({ reducedMotion })`, which was verified NOT to reach matchMedia
// here — a probe reading matchMedia in the page got `reduce: false` under
// `test.use`, and `true` with the call below.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test.describe("contact form — arriving from an audit report", () => {
  test("prefills the audited URL and the report link, in Spanish", async ({ page }) => {
    await page.goto(auditLink("/"));
    const origin = new URL(page.url()).origin;

    await expect(page.locator(box)).toHaveValue(
      `Hice la auditoría de ${AUDITED} y quiero hablar de lo que salió en el reporte:\n` +
        `${origin}/auditoria/r/${ID}/\n\n`,
    );
    await expect(page.locator(hidden)).toHaveValue(ID);
  });

  test("prefills in English, pointing at the English report", async ({ page }) => {
    await page.goto(auditLink("/en/"));
    const origin = new URL(page.url()).origin;

    await expect(page.locator(box)).toHaveValue(
      `I ran the audit on ${AUDITED} and I'd like to talk about what the report says:\n` +
        `${origin}/en/audit/r/${ID}/\n\n`,
    );
    await expect(page.locator(hidden)).toHaveValue(ID);
  });

  test("leaves the form untouched for a visitor who arrives normally", async ({
    page,
  }) => {
    await page.goto("/#contacto");
    await expect(page.locator(box)).toHaveValue("");
    await expect(page.locator(hidden)).toHaveValue("");
  });

  test("never overwrites a message the visitor already has", async ({ page }) => {
    // A textarea can already hold text when the page loads — session restore
    // and back-navigation both do it. Rewriting the served HTML reproduces
    // exactly that state: non-empty at the moment the script runs.
    const typed = "Ya tenía esto escrito.";
    await page.route(
      (url) => url.pathname === "/",
      async (route) => {
        const res = await route.fetch();
        const html = await res.text();
        const patched = html.replace(
          /(<textarea[^>]*name="message"[^>]*>)/,
          `$1${typed}`,
        );
        expect(patched, "the textarea markup moved — this test is not testing anything").not.toBe(
          html,
        );
        await route.fulfill({ response: res, body: patched });
      },
    );

    await page.goto(auditLink("/"));
    await expect(page.locator(box)).toHaveValue(typed);
    // The id still rides along: the visitor's own words plus the diagnosis.
    await expect(page.locator(hidden)).toHaveValue(ID);
  });

  const hostile = [
    { name: "no ref", query: `?id=${ID}&url=${encodeURIComponent(AUDITED)}` },
    { name: "a short id", query: `?ref=audit&id=abc&url=${encodeURIComponent(AUDITED)}` },
    {
      name: "an id shaped like a path",
      query: `?ref=audit&id=${encodeURIComponent("../../etc/passwd")}&url=${encodeURIComponent(AUDITED)}`,
    },
    { name: "no url", query: `?ref=audit&id=${ID}` },
    {
      name: "a javascript: url",
      query: `?ref=audit&id=${ID}&url=${encodeURIComponent("javascript:alert(1)")}`,
    },
    {
      name: "a url that is not a url",
      query: `?ref=audit&id=${ID}&url=${encodeURIComponent("no es una url")}`,
    },
    {
      name: "an enormous url",
      query: `?ref=audit&id=${ID}&url=${encodeURIComponent(`https://ejemplo.com/${"a".repeat(400)}`)}`,
    },
  ];

  for (const { name, query } of hostile) {
    test(`writes nothing when the link carries ${name}`, async ({ page }) => {
      await page.goto(`/${query}#contacto`);
      await expect(page.locator(box)).toHaveValue("");
    });
  }

  test("a url carrying a placeholder does not swallow the report link", async ({
    page,
  }) => {
    // The audited URL is substituted into the message before the report link
    // is, so it joins the haystack. The URL parser percent-encodes braces in a
    // path but leaves them alone in a query or a fragment, which is how a
    // hand-crafted link reaches this: a first-match replace would inject the
    // report inside the audited URL and leave the visitor's own message
    // ending in a raw {report}.
    const nasty = "https://ejemplo.com/?x={report}#{url}";
    await page.goto(`/?ref=audit&id=${ID}&url=${encodeURIComponent(nasty)}#contacto`);
    const origin = new URL(page.url()).origin;

    await expect(page.locator(box)).toHaveValue(
      `Hice la auditoría de ${nasty} y quiero hablar de lo que salió en el reporte:\n` +
        `${origin}/auditoria/r/${ID}/\n\n`,
    );
  });

  test("a url carrying markup lands as inert text", async ({ page }) => {
    // Two payloads in one link. The raw markup is percent-encoded by the URL
    // parser on the way in; the HTML entities are the discriminating half,
    // because the parser leaves them alone — innerHTML would decode "&lt;"
    // into a real "<", .value keeps the seven characters the visitor sees.
    const nasty = 'https://ejemplo.com/</textarea><img src="x">?q=&lt;script&gt;';
    await page.goto(`/?ref=audit&id=${ID}&url=${encodeURIComponent(nasty)}#contacto`);

    const value = await page.locator(box).inputValue();
    expect(value).toContain("ejemplo.com");
    expect(value).toContain("%3Cimg%20src=%22x%22%3E");
    expect(value).toContain("&lt;script&gt;");
    expect(value).not.toContain("<img");
    await expect(page.locator("img[src='x']")).toHaveCount(0);
    // The field itself survived: nothing broke out of it.
    await expect(page.locator(box)).toHaveCount(1);
  });
});

// Everything above runs under prefers-reduced-motion. That is a real visitor
// configuration, but it is also the one branch where neither half of the
// reveal machinery runs: motion.ts:86 paints every .reveal at once, and
// global.css:198 turns the fragment scroll into an instant jump. The tests
// below take the default branch — smooth fragment scroll, GSAP hiding
// everything below the fold — which is what most visitors get.
test.describe("contact form — reaching it with motion on", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
  });

  const form = "[data-contact-form]";

  test("a #contacto navigation lands on a form the visitor can see", async ({
    page,
  }) => {
    // Seven links across the site point at #contacto; they all produce this
    // navigation. It is the site's only conversion surface, so landing
    // anywhere else — or on a hidden form — is a total failure of the click.
    await page.goto("/#contacto");

    // The fragment scroll is animated and motion.ts decides what to hide once
    // it settles, so judge the end state. An assertion that fires mid-flight
    // can pass on a form that is hidden, or scrolled away from, a frame later.
    await expect(page.locator(form)).toBeInViewport();
    await page.waitForTimeout(500);
    await expect(page.locator(form)).toBeInViewport();
    await expect(page.locator(form)).toBeVisible();
  });

  test("a scroll that overshoots the reveal trigger still reveals the form", async ({
    page,
  }) => {
    // Restored positions, scrollIntoView and a visitor's own fast flick all
    // arrive as one instant jump, landing past `start: "top 85%"` instead of
    // crossing it. Everything below the fold enters in a single batch, and
    // the form is near the end of it.
    await page.goto("/");
    // How a visitor wakes the GSAP bundle: motionLoader.ts imports it on the
    // first scroll. Everything below the fold is hidden from here on.
    await page.mouse.wheel(0, 20);
    await expect(page.locator(form)).toBeHidden();

    await page.evaluate(() => {
      const el = document.querySelector("[data-contact-form]")!;
      window.scrollTo({
        top: window.scrollY + el.getBoundingClientRect().top - 27,
        behavior: "instant",
      });
    });

    // Tight on purpose: a reveal the visitor has to wait seconds for is the
    // defect, not the fix. Anything that reveals the form at all eventually
    // passes a default timeout.
    await expect(page.locator(form)).toBeVisible({ timeout: 2000 });
  });
});

/**
 * The lead events, reduced to the three keys we own. GTM stamps its own
 * `gtm.uniqueEventId` on every dataLayer entry it processes, so an exact
 * comparison has to drop it — while still failing if `form` drifts.
 */
async function leadEvents(page: import("@playwright/test").Page) {
  return page.evaluate(() =>
    (
      (window as unknown as { dataLayer?: Record<string, unknown>[] }).dataLayer ?? []
    )
      .filter((e) => e.event === "generate_lead")
      .map((e) => ({ event: e.event, form: e.form, method: e.method })),
  );
}

test.describe("contact form — submitting an audit-sourced lead", () => {
  test("sends the audit id in the request body and marks the lead as audit-sourced", async ({
    page,
  }) => {
    let body: Record<string, unknown> | null = null;
    await page.route("**/api/contact", async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto(auditLink("/"));
    await page.fill("[data-contact-form] input[name='name']", "Ana");
    await page.fill("[data-contact-form] input[name='email']", "ana@ejemplo.com");
    await page.click("[data-contact-form] button[type='submit']");

    await expect(page.locator("[data-form-status]")).toBeVisible();
    expect(body).not.toBeNull();
    expect(body!.auditId).toBe(ID);
    expect(String(body!.message)).toContain(AUDITED);

    expect(await leadEvents(page)).toEqual([
      { event: "generate_lead", form: "contact_audit", method: "form" },
    ]);
  });

  test("a cold lead is still reported as a cold lead", async ({ page }) => {
    await page.route("**/api/contact", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      }),
    );

    await page.goto("/#contacto");
    await page.fill("[data-contact-form] input[name='name']", "Ana");
    await page.fill("[data-contact-form] input[name='email']", "ana@ejemplo.com");
    await page.fill(box, "Hola, quiero una web.");
    await page.click("[data-contact-form] button[type='submit']");

    await expect(page.locator("[data-form-status]")).toBeVisible();
    expect(await leadEvents(page)).toEqual([
      { event: "generate_lead", form: "contact", method: "form" },
    ]);
  });
});
