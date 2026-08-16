import { test, expect } from "@playwright/test";
import { isDotlessHttpHost, normalizeUrl } from "../../src/lib/audit/normalizeUrl";

test.describe("normalizeUrl", () => {
  test("lowercases the host but keeps the scheme and the www the user gave", () => {
    expect(normalizeUrl("http://WWW.Example.COM")).toBe("http://www.example.com");
  });

  // This string is what safeFetch actually requests, so rewriting the host is
  // rewriting the destination. Plenty of real sites answer on www and have no
  // A record on the apex at all (cetys.mx, measured), and stripping www turned
  // those into "url_unreachable" — the auditor telling a visitor their working
  // site does not exist.
  test("does not strip www, which can be the only host that resolves", () => {
    expect(normalizeUrl("https://www.cetys.mx")).toBe("https://www.cetys.mx");
  });

  // Forcing https meant ctx.url.protocol was https by construction, so the
  // seo.https check — severity critical — could never report fail.
  test("does not force https, so an http-only site can still be judged", () => {
    expect(normalizeUrl("http://example.com/a")).toBe("http://example.com/a");
  });

  test("scheme and www are part of the cache key, because they change the result", () => {
    expect(normalizeUrl("https://example.com")).not.toBe(normalizeUrl("http://example.com"));
    expect(normalizeUrl("https://www.example.com")).not.toBe(
      normalizeUrl("https://example.com"),
    );
  });

  test("adds a scheme when the user omits it", () => {
    expect(normalizeUrl("example.com/precios")).toBe("https://example.com/precios");
  });

  test("drops trailing slash, query and hash", () => {
    expect(normalizeUrl("https://example.com/a/?utm_source=x#top")).toBe(
      "https://example.com/a",
    );
  });

  test("keeps the root path as bare origin", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com");
  });

  test("preserves path case (paths are case-sensitive)", () => {
    expect(normalizeUrl("https://example.com/MiPagina")).toBe(
      "https://example.com/MiPagina",
    );
  });

  test("rejects junk", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
    expect(normalizeUrl("not a url at all")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
  });

  test("preserves port in normalized URL", () => {
    expect(normalizeUrl("https://example.com:8443/a")).toBe("https://example.com:8443/a");
  });

  test("port differentiates origins from default port", () => {
    expect(normalizeUrl("https://example.com:8443/a")).not.toBe(
      normalizeUrl("https://example.com/a"),
    );
  });

  test("adds scheme when user omits it with a port", () => {
    expect(normalizeUrl("example.com:8080/precios")).toBe(
      "https://example.com:8080/precios",
    );
  });

  test("rejects opaque schemes (mailto)", () => {
    expect(normalizeUrl("mailto:test@example.com")).toBeNull();
  });

  test("rejects opaque schemes (tel)", () => {
    expect(normalizeUrl("tel:+541155555555")).toBeNull();
  });

  test("rejects opaque schemes (urn)", () => {
    expect(normalizeUrl("urn:isbn:0451450523")).toBeNull();
  });
});

test.describe("isDotlessHttpHost", () => {
  test("flags a bare unqualified host", () => {
    expect(isDotlessHttpHost("localhost")).toBe(true);
  });

  test("flags an unqualified host with scheme and port", () => {
    expect(isDotlessHttpHost("http://localhost:4321/")).toBe(true);
  });

  test("flags a bracketed IPv6 literal", () => {
    expect(isDotlessHttpHost("http://[::1]/")).toBe(true);
  });

  test("does not flag a qualified domain", () => {
    expect(isDotlessHttpHost("example.com")).toBe(false);
  });

  test("does not flag a qualified domain with scheme and path", () => {
    expect(isDotlessHttpHost("https://example.com/a")).toBe(false);
  });

  test("does not flag empty input", () => {
    expect(isDotlessHttpHost("")).toBe(false);
  });

  test("does not flag garbage", () => {
    expect(isDotlessHttpHost("not a url")).toBe(false);
  });

  test("does not flag a javascript scheme", () => {
    expect(isDotlessHttpHost("javascript:alert(1)")).toBe(false);
  });

  test("does not flag an opaque mailto scheme", () => {
    expect(isDotlessHttpHost("mailto:x@y.com")).toBe(false);
  });
});
