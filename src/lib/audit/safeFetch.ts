import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { SafeFetchResult } from "./types";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const UA =
  "Mozilla/5.0 (compatible; dishape-auditor/1.0; +https://dishape.dev/auditoria)";

/**
 * True when the address belongs to a range that must never be reachable from a
 * user-supplied URL: loopback, RFC1918 private space, link-local (which includes
 * the 169.254.169.254 cloud metadata endpoint), multicast and reserved.
 */
export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);

  if (version === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 127) return true;            // this-network, loopback
    if (a === 10) return true;                         // 10/8
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

/** Resolve the hostname and refuse if any resolved address is blocked. */
async function assertPublicHost(hostname: string): Promise<boolean> {
  if (isIP(hostname)) return !isBlockedAddress(hostname);
  try {
    const addrs = await lookup(hostname, { all: true });
    if (addrs.length === 0) return false;
    return addrs.every((a) => !isBlockedAddress(a.address));
  } catch {
    return false;
  }
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
 * Fetch a user-supplied URL with SSRF defenses. Redirects are followed manually
 * so every hop is validated — validating only the first hop is the classic hole:
 * a public host can 302 you straight to 169.254.169.254.
 */
export async function safeFetch(rawUrl: string): Promise<SafeFetchResult> {
  let current = validUrl(rawUrl);
  if (!current) return { ok: false, error: "url_invalid" };

  let redirects = 0;

  while (true) {
    if (!(await assertPublicHost(current.hostname))) {
      return { ok: false, error: "url_blocked" };
    }

    let res: Response;
    try {
      res = await fetch(current.href, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      });
    } catch {
      return { ok: false, error: "url_unreachable" };
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return { ok: false, error: "url_unreachable" };
      if (++redirects > MAX_REDIRECTS) return { ok: false, error: "url_unreachable" };
      const next = validUrl(new URL(location, current).href);
      if (!next) return { ok: false, error: "url_blocked" };
      current = next;
      continue;
    }

    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
      return { ok: false, error: "not_html" };
    }

    // Read by chunk and abort past the cap — content-length is attacker-controlled.
    const reader = res.body?.getReader();
    if (!reader) return { ok: false, error: "url_unreachable" };

    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        return { ok: false, error: "too_large" };
      }
      chunks.push(value);
    }

    return {
      ok: true,
      finalUrl: current.href,
      status: res.status,
      headers: res.headers,
      html: new TextDecoder().decode(await new Blob(chunks).arrayBuffer()),
      bytes,
      redirects,
    };
  }
}
