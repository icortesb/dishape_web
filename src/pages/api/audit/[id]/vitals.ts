import type { APIRoute } from "astro";
import { resolveVitals } from "../../../../lib/audit/checks/vitals";
import { getAudit, updateAudit } from "../../../../lib/audit/store";
import { clientIp, takeToken } from "../../../../lib/audit/rateLimit";

export const prerender = false;

/**
 * How long a failed measurement is served back before another upstream call is
 * allowed. A success is cached forever (it is written into the record), but a
 * failure used to be written and never read, so every request re-issued a call
 * that can take 45s — unauthenticated, so one report id was enough to drain the
 * quota in a loop. Long enough that looping buys nothing, short enough that a
 * transient outage or a fixed API key recovers on its own.
 */
const RETRY_AFTER_MS = 15 * 60_000;

/**
 * Its own bucket, and a looser one than /api/audit: this route is what the
 * report page calls on load, so a visitor legitimately hits it once per report
 * viewed, while an audit is a much heavier action worth only five.
 */
const VITALS_LIMIT = 30;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const GET: APIRoute = async ({ params, request }) => {
  const id = params.id ?? "";
  const record = await getAudit(id);
  if (!record) return json({ ok: false, error: "not_found" }, 404);

  if (record.vitals) {
    return json({ ok: true, status: "ready", vitals: record.vitals });
  }

  // Serve a recent failure from the record. Checked before the rate limiter so
  // a visitor reloading a report that genuinely cannot be measured is never
  // punished for it — this path costs a file read that already happened.
  if (
    record.vitalsError &&
    // typeof, not `!== null`: records written before this field exists come
    // back as undefined, and `Date.now() - undefined` is NaN, which compares
    // false and would silently mean "retry" for the wrong reason.
    typeof record.vitalsErrorAt === "number" &&
    Date.now() - record.vitalsErrorAt < RETRY_AFTER_MS
  ) {
    return json({ ok: true, status: "unavailable", reason: record.vitalsError });
  }

  // Only an actual upstream call is rate-limited, since that is the cost.
  if (!takeToken(`vitals:${clientIp(request)}`, Date.now(), VITALS_LIMIT)) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  try {
    const vitals = await resolveVitals(id, record.page.finalUrl);
    await updateAudit(id, { vitals, vitalsError: null, vitalsErrorAt: null });
    return json({ ok: true, status: "ready", vitals });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    console.error("[audit] psi failed", id, reason);
    await updateAudit(id, { vitalsError: reason, vitalsErrorAt: Date.now() });
    // The report is still valid without this section — never a 5xx.
    return json({ ok: true, status: "unavailable", reason });
  }
};
