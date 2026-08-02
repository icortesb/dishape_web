import { lookup as dnsLookup } from "node:dns";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import type { SafeFetchResult } from "./types";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const UA =
  "Mozilla/5.0 (compatible; dishape-auditor/1.0; +https://dishape.dev/auditoria)";

const BLOCKED_ADDRESS = "ERR_BLOCKED_ADDRESS";

/**
 * True when the address belongs to a range that must never be reachable from a
 * user-supplied URL: loopback, RFC1918 private space, link-local (which includes
 * the 169.254.169.254 cloud metadata endpoint), multicast and reserved, and
 * Shared Address Space (CGNAT).
 */
export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);

  if (version === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 127) return true;            // this-network, loopback
    if (a === 10) return true;                         // 10/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10, CGNAT
    if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16/12
    if (a === 192 && b === 168) return true;           // 192.168/16
    if (a === 169 && b === 254) return true;           // link-local + metadata
    if (a >= 224) return true;                         // multicast + reserved
    return false;
  }

  if (version === 6) {
    const v6 = ip.toLowerCase();
    if (v6 === "::1" || v6 === "::") return true;
    if (v6.startsWith("fe80")) return true;                       // link-local
    if (/^f[cd]/.test(v6)) return true;                           // unique local
    // IPv4-mapped (::ffff:127.0.0.1) must be judged by its v4 part.
    const mapped = v6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedAddress(mapped[1]);
    return false;
  }

  return true; // not a parseable IP — refuse rather than guess
}

function validUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null; // credentials smuggling
  return url;
}

/**
 * Resolve and validate in one step, then hand the connection the very address
 * we approved. Validating with a separate dns.lookup() and letting the client
 * resolve again leaves a window for DNS rebinding: the attacker's nameserver
 * answers with a public IP for our check and a private one for the connection.
 */
function pinnedLookup(deps: SafeFetchDeps) {
  return (
    hostname: string,
    options: unknown,
    callback: (err: Error | null, address?: unknown, family?: number) => void,
  ) => {
    dnsLookup(hostname, options as never, (err, address, family) => {
      if (err) return callback(err);

      // Node calls this hook with { all: true } whenever autoSelectFamily is
      // on (the default since Node 20), and then `address` is an array of
      // { address, family } rather than a string. Both shapes must be handled,
      // and every candidate address checked — one bad entry taints the set.
      const candidates = Array.isArray(address)
        ? address.map((entry) => entry.address)
        : [address as string];

      if (candidates.some((ip) => deps.isBlocked(ip))) {
        return callback(Object.assign(new Error("blocked"), { code: BLOCKED_ADDRESS }));
      }

      callback(null, address, family as number);
    });
  };
}

type RawResponse = { status: number; headers: Headers; body: IncomingMessage };

function requestOnce(
  url: URL,
  method: "GET" | "HEAD",
  accept: string,
  timeoutMs: number,
  deps: SafeFetchDeps,
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const send = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = send(
      url,
      {
        method,
        lookup: pinnedLookup(deps),
        headers: { "User-Agent": UA, Accept: accept },
        timeout: timeoutMs,
      },
      (res) => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(res.headers)) {
          if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
          else if (value !== undefined) headers.set(key, value);
        }
        resolve({ status: res.statusCode ?? 0, headers, body: res });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

/** Read the body, aborting past the cap — content-length is attacker-controlled. */
async function readCapped(
  body: IncomingMessage,
  maxBytes: number,
): Promise<{ ok: true; text: string; bytes: number } | { ok: false }> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of body) {
    const buf = chunk as Buffer;
    bytes += buf.length;
    if (bytes > maxBytes) {
      body.destroy();
      return { ok: false };
    }
    chunks.push(buf);
  }
  return { ok: true, text: Buffer.concat(chunks).toString("utf8"), bytes };
}

/** Seam so tests can drive the redirect loop with a controlled address policy. */
export type SafeFetchDeps = { isBlocked: (ip: string) => boolean };

type GuardedOk = {
  ok: true;
  finalUrl: string;
  status: number;
  headers: Headers;
  body: IncomingMessage;
  redirects: number;
};
type GuardedResult = GuardedOk | { ok: false; error: AuditErrorCode };

type GuardedInit = {
  method: "GET" | "HEAD";
  accept: string;
  /** false stops at the first 3xx and returns it — used to observe a redirect
   *  rather than follow it. */
  followRedirects?: boolean;
};

/**
 * The common redirect-validating loop used by both safeFetch and safeProbe.
 * Holds all SSRF defenses: URL validation, literal IP checking, per-hop
 * re-validation, and redirect limits.
 */
async function guardedRequest(
  rawUrl: string,
  deps: SafeFetchDeps,
  init: GuardedInit,
): Promise<GuardedResult> {
  let current = validUrl(rawUrl);
  if (!current) return { ok: false, error: "url_invalid" };

  // One budget for the whole chain: a per-hop timeout lets three slow
  // redirects stretch a 10s bound to 40s.
  const deadline = Date.now() + TIMEOUT_MS;
  let redirects = 0;

  while (true) {
    // URL.hostname keeps the brackets on IPv6 literals; isIP() rejects that
    // form, and Node's client never calls the lookup hook for a literal —
    // so without stripping them the address is never checked at all.
    const literal = current.hostname.replace(/^\[|\]$/g, "");
    if (isIP(literal) && deps.isBlocked(literal)) {
      return { ok: false, error: "url_blocked" };
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) return { ok: false, error: "url_unreachable" };

    let res: RawResponse;
    try {
      res = await requestOnce(current, init.method, init.accept, remaining, deps);
    } catch (err) {
      const blocked = (err as { code?: string })?.code === BLOCKED_ADDRESS;
      return { ok: false, error: blocked ? "url_blocked" : "url_unreachable" };
    }

    if (res.status >= 300 && res.status < 400) {
      res.body.resume(); // drain, or the socket leaks
      const shouldFollow = init.followRedirects ?? true;
      if (!shouldFollow) {
        // Caller requested to stop here without following
        return {
          ok: true,
          finalUrl: current.href,
          status: res.status,
          headers: res.headers,
          body: res.body,
          redirects,
        };
      }
      const location = res.headers.get("location");
      if (!location) return { ok: false, error: "url_unreachable" };
      if (++redirects > MAX_REDIRECTS) return { ok: false, error: "url_unreachable" };
      const next = validUrl(new URL(location, current).href);
      if (!next) return { ok: false, error: "url_blocked" };
      current = next;
      continue;
    }

    return {
      ok: true,
      finalUrl: current.href,
      status: res.status,
      headers: res.headers,
      body: res.body,
      redirects,
    };
  }
}

export function createSafeFetch(
  deps: SafeFetchDeps = { isBlocked: isBlockedAddress },
) {
  return async function safeFetch(rawUrl: string): Promise<SafeFetchResult> {
    const res = await guardedRequest(rawUrl, deps, {
      method: "GET",
      accept: "text/html,application/xhtml+xml",
    });
    if (!res.ok) return res;

    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
      res.body.resume();
      return { ok: false, error: "not_html" };
    }

    const read = await readCapped(res.body, MAX_BYTES);
    if (!read.ok) return { ok: false, error: "too_large" };

    return {
      ok: true,
      finalUrl: res.finalUrl,
      status: res.status,
      headers: res.headers,
      html: read.text,
      bytes: read.bytes,
      redirects: res.redirects,
    };
  };
}

export const safeFetch = createSafeFetch();

export type ProbeResult =
  | { ok: true; status: number; text: string; finalUrl?: string }
  | { ok: false; error: AuditErrorCode };

/**
 * Same SSRF guard as safeFetch, for the auxiliary URLs an audit has to touch
 * (robots.txt, sitemap, og:image). Those come from the audited site's own
 * markup, so they are exactly as untrusted as the URL the visitor typed —
 * and they are not HTML, so safeFetch's content-type gate cannot serve them.
 */
export function createSafeProbe(
  deps: SafeFetchDeps = { isBlocked: isBlockedAddress },
) {
  return async function safeProbe(
    rawUrl: string,
    options: {
      method?: "GET" | "HEAD";
      maxBytes?: number;
      followRedirects?: boolean;
    } = {},
  ): Promise<ProbeResult> {
    const { method = "HEAD", maxBytes = 256 * 1024, followRedirects = true } =
      options;
    const res = await guardedRequest(rawUrl, deps, {
      method,
      accept: "*/*",
      followRedirects,
    });
    if (!res.ok) return res;

    if (method === "HEAD") {
      res.body.resume();
      return { ok: true, status: res.status, text: "", finalUrl: res.finalUrl };
    }

    const read = await readCapped(res.body, maxBytes);
    if (!read.ok) return { ok: false, error: "too_large" };
    return { ok: true, status: res.status, text: read.text, finalUrl: res.finalUrl };
  };
}

export const safeProbe = createSafeProbe();
