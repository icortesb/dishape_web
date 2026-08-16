import { parse, type HTMLElement } from "node-html-parser";
import type { PageContext, SafeFetchOk } from "./types";
import { safeProbe, createSafeProbe } from "./safeFetch";

/** Read a meta tag by name= or property=, case-insensitively. Empty is null. */
export function extractMeta(doc: HTMLElement, key: string): string | null {
  const wanted = key.toLowerCase();
  for (const el of doc.querySelectorAll("meta")) {
    const id = (el.getAttribute("name") ?? el.getAttribute("property") ?? "").toLowerCase();
    if (id !== wanted) continue;
    const content = (el.getAttribute("content") ?? "").trim();
    return content || null;
  }
  return null;
}

/**
 * All JSON-LD objects on the page. Malformed blocks are skipped rather than
 * thrown — a broken block is itself a finding, not a reason to fail the audit.
 * `@graph` containers are flattened so callers see a flat list of entities.
 */
export function extractJsonLd(doc: HTMLElement): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const el of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown;
    try {
      data = JSON.parse(el.rawText);
    } catch {
      continue;
    }
    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      if (Array.isArray(obj["@graph"])) {
        for (const node of obj["@graph"]) {
          if (node && typeof node === "object") out.push(node as Record<string, unknown>);
        }
      } else {
        out.push(obj);
      }
    }
  }
  return out;
}

export type Probe = ReturnType<typeof createSafeProbe>;

/**
 * Turn a fetched page into everything the check functions need. All the network
 * I/O the checks would otherwise want happens here, so every check stays a pure
 * function that can be tested with a fixture and no network.
 */
export async function buildPageContext(
  res: SafeFetchOk,
  probe: Probe = safeProbe,
): Promise<PageContext> {
  const url = new URL(res.finalUrl);
  const doc = parse(res.html);
  const origin = url.origin;

  const ogImage = extractMeta(doc, "og:image");
  // og:image might be relative; resolve it or mark as unparseable.
  let ogImageAbsolute: string | null = null;
  if (ogImage) {
    try {
      ogImageAbsolute = new URL(ogImage, url).href;
    } catch {
      // Present but unparseable — this is a finding (false, not null).
      ogImageAbsolute = null;
    }
  }

  // Three auxiliary fetches, with tri-state results:
  // - transport failure → null
  // - url_blocked or url_invalid → false
  // - HTTP response: 2xx → true, else → false
  const robotsTxtResult = await probe(`${origin}/robots.txt`, {
    method: "GET",
    maxBytes: 256 * 1024,
  });
  const robotsTxt: string | null = robotsTxtResult.ok
    ? robotsTxtResult.status >= 200 && robotsTxtResult.status < 300
      ? robotsTxtResult.text
      : null
    : null;

  // og:image: null means no tag, false means present but broken/unreachable
  let ogImageOk: boolean | null = null;
  if (ogImage && !ogImageAbsolute) {
    // og:image present but unparseable
    ogImageOk = false;
  } else if (ogImageAbsolute) {
    const ogImageResult = await probe(ogImageAbsolute, { method: "HEAD" });
    if (ogImageResult.ok) {
      ogImageOk = ogImageResult.status >= 200 && ogImageResult.status < 300;
    } else {
      ogImageOk = ogImageResult.error === "url_blocked" || ogImageResult.error === "url_invalid"
        ? false
        : null;
    }
  }

  // http → https check: does the http:// version redirect to https://?
  const httpOrigin = origin.replace(/^https:/, "http:");
  const httpRedirectResult = await probe(httpOrigin, { method: "HEAD" });
  let httpRedirectsToHttps: boolean | null = null;
  if (httpRedirectResult.ok) {
    // Check if the final URL (after following redirects) is https.
    httpRedirectsToHttps = (httpRedirectResult.finalUrl ?? "").startsWith("https:");
  } else if (
    httpRedirectResult.error === "url_blocked" ||
    httpRedirectResult.error === "url_invalid"
  ) {
    httpRedirectsToHttps = false; // Blocked or invalid, so no
  }
  // else: null — couldn't determine due to transport error

  // Prefer a sitemap declared in robots.txt; fall back to the conventional path.
  let sitemapUrl = `${origin}/sitemap.xml`;
  const declared = robotsTxt?.match(/^\s*sitemap:\s*(\S+)/im)?.[1];
  if (declared) {
    // Declared URL might be relative; make it absolute.
    try {
      sitemapUrl = new URL(declared, origin).href;
    } catch {
      // If it can't be parsed, stick with the default
    }
  }
  const sitemapResult = await probe(sitemapUrl, { method: "HEAD" });
  let sitemapOk: boolean | null = null;
  if (sitemapResult.ok) {
    sitemapOk = sitemapResult.status >= 200 && sitemapResult.status < 300;
  } else {
    sitemapOk = sitemapResult.error === "url_blocked" || sitemapResult.error === "url_invalid"
      ? false
      : null;
  }

  return {
    url,
    status: res.status,
    headers: res.headers,
    html: res.html,
    bytes: res.bytes,
    redirects: res.redirects,
    doc,
    robotsTxt,
    sitemapOk,
    ogImageOk,
    httpRedirectsToHttps,
  };
}
