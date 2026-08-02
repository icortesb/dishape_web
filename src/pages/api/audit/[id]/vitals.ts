import type { APIRoute } from "astro";
import { fetchVitals } from "../../../../lib/audit/checks/vitals";
import { getAudit, updateAudit } from "../../../../lib/audit/store";
import type { VitalsResult } from "../../../../lib/audit/types";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Two viewers opening the same fresh report must not trigger two PSI runs.
const inFlight = new Map<string, Promise<VitalsResult>>();

export const GET: APIRoute = async ({ params }) => {
  const id = params.id ?? "";
  const record = await getAudit(id);
  if (!record) return json({ ok: false, error: "not_found" }, 404);

  if (record.vitals) {
    return json({ ok: true, status: "ready", vitals: record.vitals });
  }

  let pending = inFlight.get(id);
  if (!pending) {
    pending = fetchVitals(record.page.finalUrl);
    inFlight.set(id, pending);
    pending.finally(() => inFlight.delete(id));
  }

  try {
    const vitals = await pending;
    await updateAudit(id, { vitals, vitalsError: null });
    return json({ ok: true, status: "ready", vitals });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    console.error("[audit] psi failed", id, reason);
    await updateAudit(id, { vitalsError: reason });
    // The report is still valid without this section — never a 5xx.
    return json({ ok: true, status: "unavailable", reason });
  }
};
