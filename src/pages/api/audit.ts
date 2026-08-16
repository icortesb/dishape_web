import type { APIRoute } from "astro";
import { isDotlessHttpHost, normalizeUrl } from "../../lib/audit/normalizeUrl";
import { safeFetch } from "../../lib/audit/safeFetch";
import { buildPageContext } from "../../lib/audit/parse";
import { runChecks } from "../../lib/audit/registry";
import { findCachedByUrl, newAuditId, saveAudit } from "../../lib/audit/store";
import { clientIp, takeToken } from "../../lib/audit/rateLimit";
import type { AuditRecord } from "../../lib/audit/types";

// On-demand (server) route — everything else stays static.
export const prerender = false;

const CACHE_MS = 24 * 3600_000;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "url_invalid" }, 400);
  }

  const raw = String(body.url ?? "").trim();
  const lang = body.lang === "en" ? "en" : "es";

  const normalized = normalizeUrl(raw);
  if (!normalized) {
    // A dot-less host is a real destination we decline to reach, not a typo.
    // Decided without a network call, so it needs no token.
    return isDotlessHttpHost(raw)
      ? json({ ok: false, error: "url_blocked" }, 400)
      : json({ ok: false, error: "url_invalid" }, 400);
  }

  // Serve a recent audit of the same page before spending a token: a repeat
  // visit is not abuse, and it protects the PageSpeed quota downstream.
  const cachedId = await findCachedByUrl(normalized, CACHE_MS);
  if (cachedId) return json({ ok: true, id: cachedId, cached: true });

  if (!takeToken(clientIp(request))) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  const fetched = await safeFetch(normalized);
  if (!fetched.ok) return json({ ok: false, error: fetched.error }, 400);

  const ctx = await buildPageContext(fetched);
  const checks = runChecks(ctx);

  const record: AuditRecord = {
    id: newAuditId(),
    url: raw,
    normalizedUrl: normalized,
    createdAt: new Date().toISOString(),
    lang,
    page: {
      status: ctx.status,
      finalUrl: ctx.url.href,
      redirects: ctx.redirects,
      bytes: ctx.bytes,
      title: ctx.doc.querySelector("title")?.text.trim() || null,
    },
    checks,
    vitals: null,
    vitalsError: null,
    vitalsErrorAt: null,
  };

  await saveAudit(record);
  return json({ ok: true, id: record.id, cached: false });
};
