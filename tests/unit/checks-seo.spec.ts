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

test.describe("seo.description", () => {
  test("fails when description is absent", () => {
    expect(run("seo.description.present", ctx("<html></html>")).status).toBe("fail");
  });

  test("passes when description is present", () => {
    expect(run("seo.description.present", ctx('<meta name="description" content="Hello world">')).status).toBe("pass");
  });

  test("is not applicable when there is no description to measure", () => {
    expect(run("seo.description.length", ctx("<html></html>")).status).toBe("na");
  });

  test("warns when the description is too long and reports the length", () => {
    const long = "a".repeat(175);
    const r = run("seo.description.length", ctx(`<meta name="description" content="${long}">`));
    expect(r.status).toBe("warn");
    expect(r.evidence).toMatchObject({ actual: 175, max: 160 });
  });

  test("warns when the description is too short", () => {
    const short = "a".repeat(50);
    const r = run("seo.description.length", ctx(`<meta name="description" content="${short}">`));
    expect(r.status).toBe("warn");
    expect(r.evidence).toMatchObject({ actual: 50, min: 70 });
  });

  test("passes when description is within the ideal range", () => {
    const ideal = "a".repeat(100);
    expect(run("seo.description.length", ctx(`<meta name="description" content="${ideal}">`)).status).toBe("pass");
  });
});

test.describe("seo.robots.txt and sitemap", () => {
  test("warns when robots.txt is unreachable", () => {
    expect(run("seo.robots.txt", ctx("<html></html>", { robotsTxt: null })).status).toBe("warn");
  });

  test("passes when robots.txt is reachable", () => {
    expect(run("seo.robots.txt", ctx("<html></html>", { robotsTxt: "User-agent: *\nAllow: /" })).status).toBe("pass");
  });

  test("fails when no sitemap is reachable", () => {
    expect(run("seo.sitemap", ctx("<html></html>", { sitemapOk: false })).status).toBe("fail");
  });

  test("passes when sitemap is reachable", () => {
    expect(run("seo.sitemap", ctx("<html></html>", { sitemapOk: true })).status).toBe("pass");
  });

  test("is not applicable when sitemap check could not be determined", () => {
    expect(run("seo.sitemap", ctx("<html></html>", { sitemapOk: null })).status).toBe("na");
  });
});

test.describe("seo.https", () => {
  test("passes when the URL is https", () => {
    const c = ctx("<html></html>", { url: new URL("https://example.com/pagina") });
    expect(run("seo.https", c).status).toBe("pass");
  });

  test("fails when the final URL is http", () => {
    const c = ctx("<html></html>", { url: new URL("http://example.com/pagina") });
    expect(run("seo.https", c).status).toBe("fail");
  });
});

test.describe("seo.http.redirect", () => {
  test("passes when http redirects to https", () => {
    const c = ctx("<html></html>", { httpRedirectsToHttps: true });
    expect(run("seo.http.redirect", c).status).toBe("pass");
  });

  test("fails when http does not redirect to https", () => {
    const c = ctx("<html></html>", { httpRedirectsToHttps: false });
    expect(run("seo.http.redirect", c).status).toBe("fail");
  });

  test("is not applicable when the check could not be determined", () => {
    const c = ctx("<html></html>", { httpRedirectsToHttps: null });
    expect(run("seo.http.redirect", c).status).toBe("na");
  });
});

test.describe("seo.hreflang", () => {
  test("warns when hreflang set has invalid language codes", () => {
    const html = `
      <link rel="alternate" hreflang="es" href="https://example.com/pagina">
      <link rel="alternate" hreflang="invalid!!!" href="https://example.com/en/pagina">
    `;
    const r = run("seo.hreflang", ctx(html));
    expect(r.status).toBe("warn");
    expect(r.evidence).toMatchObject({ reason: "invalid-code" });
  });
});
