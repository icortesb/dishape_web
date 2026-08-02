/**
 * Canonical form used as the cache key. Two inputs that describe the same page
 * must produce the same string, so we force https, drop "www.", lowercase the
 * host, and discard query and hash (tracking params are not a different page).
 * Path case is preserved — paths are case-sensitive on most servers.
 *
 * Returns null for anything that is not a plausible http(s) URL.
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Bare hosts ("example.com") are the common user input; assume https.
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // A hostname with no dot is either localhost or a typo; neither is auditable.
  if (!url.hostname.includes(".")) return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "");

  return `https://${host}${path}`;
}
