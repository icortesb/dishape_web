import { parse, type HTMLElement } from "node-html-parser";
import type { PageContext, SafeFetchOk } from "./types";

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

/** HEAD a URL and report whether it answered 2xx. Never throws. */
async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5_000),
      redirect: "follow",
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Does http:// for this origin end up on https://? */
async function checkHttpRedirect(origin: string): Promise<boolean | null> {
  try {
    const res = await fetch(origin.replace(/^https:/, "http:"), {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
    if (res.status < 300 || res.status >= 400) return false;
    const loc = res.headers.get("location") ?? "";
    return loc.startsWith("https:");
  } catch {
    return null;
  }
}

/**
 * Turn a fetched page into everything the check functions need. All the network
 * I/O the checks would otherwise want happens here, so every check stays a pure
 * function that can be tested with a fixture and no network.
 */
export async function buildPageContext(res: SafeFetchOk): Promise<PageContext> {
  const url = new URL(res.finalUrl);
  const doc = parse(res.html);
  const origin = url.origin;

  const ogImage = extractMeta(doc, "og:image");
  const ogImageAbsolute = ogImage
    ? (() => {
        try {
          return new URL(ogImage, url).href;
        } catch {
          return null;
        }
      })()
    : null;

  const [robotsTxt, ogImageOk, httpRedirectsToHttps] = await Promise.all([
    fetchText(`${origin}/robots.txt`),
    ogImageAbsolute ? headOk(ogImageAbsolute) : Promise.resolve(null),
    checkHttpRedirect(origin),
  ]);

  // Prefer a sitemap declared in robots.txt; fall back to the conventional path.
  const declared = robotsTxt?.match(/^\s*sitemap:\s*(\S+)/im)?.[1];
  const sitemapUrl = declared ?? `${origin}/sitemap.xml`;
  const sitemapOk = await headOk(sitemapUrl);

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
