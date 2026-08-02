import { test, expect } from "@playwright/test";
import { parse } from "node-html-parser";
import { extractMeta, extractJsonLd, buildPageContext } from "../../src/lib/audit/parse";
import { createSafeProbe, isBlockedAddress } from "../../src/lib/audit/safeFetch";
import { createServer } from "node:http";
import type { SafeFetchOk } from "../../src/lib/audit/types";

test.describe("extractMeta", () => {
  test("reads name= and property= meta tags case-insensitively", () => {
    const doc = parse(`
      <meta name="description" content="una descripcion">
      <meta property="og:title" content="El titulo">
      <meta NAME="Twitter:Card" content="summary">
    `);
    expect(extractMeta(doc, "description")).toBe("una descripcion");
    expect(extractMeta(doc, "og:title")).toBe("El titulo");
    expect(extractMeta(doc, "twitter:card")).toBe("summary");
  });

  test("returns null when absent or empty", () => {
    const doc = parse(`<meta name="description" content="">`);
    expect(extractMeta(doc, "description")).toBeNull();
    expect(extractMeta(doc, "keywords")).toBeNull();
  });
});

test.describe("extractJsonLd", () => {
  test("parses valid ld+json blocks", () => {
    const doc = parse(`
      <script type="application/ld+json">{"@type":"Organization","name":"x"}</script>
    `);
    expect(extractJsonLd(doc)).toEqual([{ "@type": "Organization", name: "x" }]);
  });

  test("skips blocks that do not parse instead of throwing", () => {
    const doc = parse(`
      <script type="application/ld+json">{ broken json,,, }</script>
      <script type="application/ld+json">{"@type":"WebSite"}</script>
    `);
    expect(extractJsonLd(doc)).toEqual([{ "@type": "WebSite" }]);
  });

  test("flattens @graph containers", () => {
    const doc = parse(`
      <script type="application/ld+json">
        {"@graph":[{"@type":"A"},{"@type":"B"}]}
      </script>
    `);
    expect(extractJsonLd(doc)).toEqual([{ "@type": "A" }, { "@type": "B" }]);
  });
});

test.describe("buildPageContext", () => {
  const probeAllowingLoopback = createSafeProbe({
    isBlocked: (ip) => ip !== "127.0.0.1" && ip !== "::1" && isBlockedAddress(ip),
  });

  test("fetches robots.txt, validates sitemap, and validates og:image", async () => {
    const server = createServer((req, res) => {
      if (req.url === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(`<html><head><meta property="og:image" content="/image.png"></head></html>`);
      } else if (req.url === "/robots.txt") {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("User-Agent: *\nSitemap: /sitemap.xml");
      } else if (req.url === "/sitemap.xml") {
        res.writeHead(200, { "content-type": "application/xml" });
        res.end("<?xml version='1.0'?><urlset></urlset>");
      } else if (req.url === "/image.png") {
        res.writeHead(200, { "content-type": "image/png" });
        res.end("fake image");
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as { port: number };

    try {
      const mockFetch: SafeFetchOk = {
        ok: true,
        finalUrl: `http://127.0.0.1:${port}/`,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        html: `<html><head><meta property="og:image" content="http://127.0.0.1:${port}/image.png"></head></html>`,
        bytes: 100,
        redirects: 0,
      };

      const ctx = await buildPageContext(mockFetch, probeAllowingLoopback);
      expect(ctx.robotsTxt).toContain("Sitemap:");
      expect(ctx.sitemapOk).toBe(true);
      expect(ctx.ogImageOk).toBe(true);
    } finally {
      server.close();
    }
  });

  test("returns false for non-2xx sitemap and og:image", async () => {
    const server = createServer((req, res) => {
      if (req.url === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(`<html><head><meta property="og:image" content="/image.png"></head></html>`);
      } else if (req.url === "/robots.txt") {
        res.writeHead(404);
        res.end();
      } else if (req.url === "/image.png") {
        res.writeHead(404);
        res.end();
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as { port: number };

    try {
      const mockFetch: SafeFetchOk = {
        ok: true,
        finalUrl: `http://127.0.0.1:${port}/`,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        html: `<html><head><meta property="og:image" content="http://127.0.0.1:${port}/image.png"></head></html>`,
        bytes: 100,
        redirects: 0,
      };

      const ctx = await buildPageContext(mockFetch, probeAllowingLoopback);
      expect(ctx.robotsTxt).toBeNull();
      expect(ctx.sitemapOk).toBe(false);
      expect(ctx.ogImageOk).toBe(false);
    } finally {
      server.close();
    }
  });

  test("never rejects when all auxiliary requests fail", async () => {
    // Point to a closed port (nothing listening) so all auxiliary requests fail
    const mockFetch: SafeFetchOk = {
      ok: true,
      finalUrl: "http://127.0.0.1:1/",
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      html: "<html></html>",
      bytes: 100,
      redirects: 0,
    };

    const ctx = await buildPageContext(mockFetch, probeAllowingLoopback);
    expect(ctx.robotsTxt).toBeNull();
    expect(ctx.sitemapOk).toBeNull();
    expect(ctx.ogImageOk).toBeNull();
    expect(ctx.httpRedirectsToHttps).toBeNull();
  });

  test("og:image present but unparseable returns false", async () => {
    const mockFetch: SafeFetchOk = {
      ok: true,
      finalUrl: "http://example.com/",
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      html: `<html><head><meta property="og:image" content="ht!tp://[invalid"></head></html>`,
      bytes: 100,
      redirects: 0,
    };

    const ctx = await buildPageContext(mockFetch, probeAllowingLoopback);
    expect(ctx.ogImageOk).toBe(false);
  });

  test("og:image pointing at blocked address is not fetched and returns false", async () => {
    const mockFetch: SafeFetchOk = {
      ok: true,
      finalUrl: "http://example.com/",
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      html: `<html><head><meta property="og:image" content="http://169.254.169.254/image.png"></head></html>`,
      bytes: 100,
      redirects: 0,
    };

    // Use the real safeProbe, not the loopback-allowing one
    const ctx = await buildPageContext(mockFetch);
    // og:image points to blocked address, so probe returns url_blocked error → false
    expect(ctx.ogImageOk).toBe(false);
  });

  test("og:image absent returns null", async () => {
    const mockFetch: SafeFetchOk = {
      ok: true,
      finalUrl: "http://example.com/",
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      html: `<html><head></head></html>`,
      bytes: 100,
      redirects: 0,
    };

    const ctx = await buildPageContext(mockFetch, probeAllowingLoopback);
    expect(ctx.ogImageOk).toBeNull();
  });
});
