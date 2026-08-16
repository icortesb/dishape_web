import type { APIRoute } from "astro";
import { resolveVitals } from "../../../../lib/audit/checks/vitals";
import { getAudit, updateAudit } from "../../../../lib/audit/store";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const GET: APIRoute = async ({ params }) => {
  const id = params.id ?? "";
  const record = await getAudit(id);
  if (!record) return json({ ok: false, error: "not_found" }, 404);

  if (record.vitals) {
    return json({ ok: true, status: "ready", vitals: record.vitals });
  }

  try {
    const vitals = await resolveVitals(id, record.page.finalUrl);
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
