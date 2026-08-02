/**
 * Parse the loose input a visitor types into a URL, or null if it is not a
 * plausible http(s) address at all. Shared by normalizeUrl and
 * isDotlessHttpHost so the scheme-coercion rules cannot drift between them.
 */
function parseCandidate(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // "example.com:8080/x" is a bare host:port and gets https://. "mailto:x@y"
  // and "tel:123" declare a scheme we cannot audit — reject rather than coerce.
  const opaque = /^([a-z][a-z0-9+.-]*):(?!\/\/)([^/?#]*)/i.exec(trimmed);
  if (opaque && !/^\d+$/.test(opaque[2])) return null;

  // Bare hosts ("example.com") are the common user input; assume https.
  // Require // after the scheme to avoid confusing "example.com:8080" as a scheme.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url;
}

/**
 * Canonical form used as the cache key. Two inputs that describe the same page
 * must produce the same string, so we force https, drop "www.", lowercase the
 * host, and discard query and hash (tracking params are not a different page).
 * Path case is preserved — paths are case-sensitive on most servers.
 * Port is preserved — different ports are different origins.
 *
 * Returns null for anything that is not a plausible http(s) URL.
 */
export function normalizeUrl(input: string): string | null {
  const url = parseCandidate(input);
  if (!url) return null;

  // A hostname with no dot is either localhost or a typo; neither is auditable.
  if (!url.hostname.includes(".")) return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const port = url.port ? `:${url.port}` : "";
  const path = url.pathname.replace(/\/+$/, "");

  return `https://${host}${port}${path}`;
}

/**
 * True when the input names a real but unqualified host — "localhost", a
 * container name, a bracketed IPv6 literal. normalizeUrl rejects these
 * alongside genuine garbage, but they are different in kind: the caller aimed
 * at a host we refuse to reach rather than typing nonsense, and the report
 * should say so. Decided by parsing alone, so it costs nothing and cannot be
 * used to make us touch the network.
 */
export function isDotlessHttpHost(input: string): boolean {
  const url = parseCandidate(input);
  return url !== null && url.hostname.length > 0 && !url.hostname.includes(".");
}
