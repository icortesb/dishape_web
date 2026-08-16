import { test, expect } from "@playwright/test";
import { parse } from "node-html-parser";
import { socialChecks } from "../../src/lib/audit/checks/social";
import type { PageContext } from "../../src/lib/audit/types";

function ctx(html: string, over: Partial<PageContext> = {}): PageContext {
  return {
    url: new URL("https://example.com/pagina"),
    status: 200,
    headers: new Headers(),
    html,
    bytes: html.length,
    redirects: 0,
    doc: parse(html),
    robotsTxt: null,
    sitemapOk: true,
    ogImageOk: true,
    httpRedirectsToHttps: true,
    ...over,
  };
}

const run = (id: string, c: PageContext) => {
  const check = socialChecks.find((x) => x.id === id);
  if (!check) throw new Error(`no such check: ${id}`);
  return check.run(c);
};

test.describe("social.og.title", () => {
  test("fails when og:title is missing", () => {
    expect(run("social.og.title", ctx("<html></html>")).status).toBe("fail");
  });

  test("passes and reports the value found", () => {
    const r = run("social.og.title", ctx('<meta property="og:title" content="Titulo">'));
    expect(r.status).toBe("pass");
    expect(r.evidence).toMatchObject({ found: "Titulo" });
  });
});

test.describe("social.og.description", () => {
  test("fails when og:description is missing", () => {
    expect(run("social.og.description", ctx("<html></html>")).status).toBe("fail");
  });

  test("passes and reports the value found", () => {
    const r = run("social.og.description", ctx('<meta property="og:description" content="Una descripcion">'));
    expect(r.status).toBe("pass");
    expect(r.evidence).toMatchObject({ found: "Una descripcion" });
  });
});

test.describe("social.og.image", () => {
  test("fails when there is no og:image", () => {
    expect(run("social.og.image", ctx("<html></html>")).status).toBe("fail");
  });

  test("fails when the image URL does not resolve to a 2xx", () => {
    const html = '<meta property="og:image" content="https://example.com/no.png">';
    const r = run("social.og.image", ctx(html, { ogImageOk: false }));
    expect(r.status).toBe("fail");
    expect(r.evidence).toMatchObject({ reason: "unreachable" });
  });

  test("returns na when URL is absolute but reachability probe failed", () => {
    const html = '<meta property="og:image" content="https://example.com/og.png">';
    const r = run("social.og.image", ctx(html, { ogImageOk: null }));
    expect(r.status).toBe("na");
    expect(r.evidence).toMatchObject({ reason: "unverified" });
  });

  test("warns when the URL is relative", () => {
    const html = '<meta property="og:image" content="/og.png">';
    const r = run("social.og.image", ctx(html));
    expect(r.status).toBe("warn");
    expect(r.evidence).toMatchObject({ reason: "relative" });
  });

  test("passes on an absolute, reachable image", () => {
    const html = '<meta property="og:image" content="https://example.com/og.png">';
    expect(run("social.og.image", ctx(html)).status).toBe("pass");
  });
});

test.describe("social.jsonld", () => {
  test("fails when there is none", () => {
    expect(run("social.jsonld", ctx("<html></html>")).status).toBe("fail");
  });

  test("warns when a block is present but has no @type", () => {
    const html = '<script type="application/ld+json">{"name":"x"}</script>';
    const r = run("social.jsonld", ctx(html));
    expect(r.status).toBe("warn");
    expect(r.evidence).toMatchObject({ reason: "no-type" });
  });

  test("warns when a block is present but does not parse", () => {
    const html = '<script type="application/ld+json">{ broken json,,, }</script>';
    const r = run("social.jsonld", ctx(html));
    expect(r.status).toBe("warn");
    expect(r.evidence).toMatchObject({ reason: "unparseable" });
  });

  test("passes and lists the types found", () => {
    const html = '<script type="application/ld+json">{"@type":"Organization"}</script>';
    const r = run("social.jsonld", ctx(html));
    expect(r.status).toBe("pass");
    expect(r.evidence).toMatchObject({ types: "Organization" });
  });
});

test.describe("social.favicon", () => {
  test("warns when no icon link is declared", () => {
    expect(run("social.favicon", ctx("<html></html>")).status).toBe("warn");
  });

  test("passes with a rel=icon link", () => {
    expect(run("social.favicon", ctx('<link rel="icon" href="/f.svg">')).status).toBe("pass");
  });
});

test.describe("social.twitter.card", () => {
  test("warns when absent", () => {
    expect(run("social.twitter.card", ctx("<html></html>")).status).toBe("warn");
  });

  test("passes when present", () => {
    const html = '<meta name="twitter:card" content="summary_large_image">';
    expect(run("social.twitter.card", ctx(html)).status).toBe("pass");
  });
});
