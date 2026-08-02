export const LIMIT = 5;
export const WINDOW_MS = 15 * 60_000; // 15 minutes

type Bucket = { count: number; resetAt: number };

// In-memory is correct here: the site runs as a single Node process behind
// nginx. If that ever becomes several processes, this needs shared state.
const buckets = new Map<string, Bucket>();

/** Consume one token for this ip. False when the caller is over the limit. */
export function takeToken(ip: string, now = Date.now()): boolean {
  const bucket = buckets.get(ip);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (buckets.size > 10_000) prune(now);
    return true;
  }

  if (bucket.count >= LIMIT) return false;
  bucket.count += 1;
  return true;
}

function prune(now: number): void {
  for (const [ip, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(ip);
  }
}

/**
 * The real client address. nginx proxies to the Node server, so the socket
 * address is always 127.0.0.1 — the first X-Forwarded-For entry is the client.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
