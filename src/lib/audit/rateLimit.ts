export const LIMIT = 5;
export const WINDOW_MS = 15 * 60_000; // 15 minutes

type Bucket = { count: number; resetAt: number };

// In-memory is correct here: the site runs as a single Node process behind
// nginx. If that ever becomes several processes, this needs shared state.
const buckets = new Map<string, Bucket>();

/**
 * Consume one token for this key. False when the caller is over the limit.
 *
 * The key is usually an ip, but callers may namespace it ("vitals:1.2.3.4") to
 * get an independent bucket. Without that, reading the performance panel would
 * spend the same five tokens as running an audit, and an ordinary visitor who
 * audited five sites could not see any of their scores.
 */
export function takeToken(ip: string, now = Date.now(), limit = LIMIT): boolean {
  const bucket = buckets.get(ip);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (buckets.size > 10_000) prune(now);
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

function prune(now: number): void {
  // Clean up expired buckets when the map grows large. This runs opportunistically
  // at 10,000 entries but is not a hard cap — a burst of distinct IPs within one
  // window can exceed it before any buckets expire.
  for (const [ip, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(ip);
  }
}

/**
 * The real client address. nginx proxies to the Node server, so the socket
 * address is always 127.0.0.1 and X-Forwarded-For carries the client.
 *
 * We take the LAST entry, not the first: nginx appends the real peer to
 * whatever the client sent, so everything before it is caller-supplied and
 * forgeable. Bucketing on a forgeable value means an attacker gets a fresh
 * bucket per request and is never limited. This assumes exactly one trusted
 * proxy — if a CDN is ever put in front of nginx, this index has to change.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",");
    const last = hops[hops.length - 1].trim();
    if (last) return last;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
