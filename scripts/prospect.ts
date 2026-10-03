/**
 * Outbound prospecting: audit a list of business sites with the same engine as
 * /auditoria, store each result as a real report, and draft a first message.
 *
 *   npx tsx scripts/prospect.ts prospects/leads.csv
 *
 * leads.csv columns: name,url,contact   (header row required; contact optional)
 *
 * Writes records to prospects/audits/ (sync them to the VPS store so the links
 * resolve) and the drafts to prospects/out.md. Nothing is sent from here.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";

process.env.AUDIT_DATA_DIR ??= "prospects/audits";

const { normalizeUrl } = await import("../src/lib/audit/normalizeUrl");
const { safeFetch } = await import("../src/lib/audit/safeFetch");
const { buildPageContext } = await import("../src/lib/audit/parse");
const { runChecks } = await import("../src/lib/audit/registry");
const { fetchVitals } = await import("../src/lib/audit/checks/vitals");
const { newAuditId, saveAudit } = await import("../src/lib/audit/store");
type AuditRecord = import("../src/lib/audit/types").AuditRecord;
type VitalsResult = import("../src/lib/audit/types").VitalsResult;

const SITE = "https://dishape.dev";

/**
 * The report speaks to a technical reader; a cold message speaks to the owner.
 * Only the checks an owner would care about get a line here, ordered by how
 * much they hurt — the message quotes the first two that failed.
 */
const PLAIN: Record<string, string> = {
  "seo.noindex": "la página le pide a Google que no la muestre en los resultados",
  "seo.https": "el sitio no usa conexión segura (el navegador lo marca como «No seguro»)",
  "seo.title.present": "la página no tiene título, que es lo que Google muestra como enlace",
  "seo.http.redirect": "la versión sin https no redirige a la segura",
  "seo.description.present": "falta la descripción que Google muestra debajo del enlace",
  "seo.sitemap": "no hay sitemap, así que Google descubre las páginas más lento",
  "social.og.image": "al compartir el link por WhatsApp o redes no aparece ninguna imagen",
  "seo.h1.unique": "la página no tiene un encabezado principal claro para Google",
  "social.jsonld": "faltan los datos estructurados que usa Google para mostrar dirección, horario y reseñas",
};

type Lead = { name: string; url: string; contact: string };

function parseCsv(text: string): Lead[] {
  const [, ...rows] = text.trim().split(/\r?\n/);
  return rows
    .map((row) => row.split(",").map((c) => c.trim()))
    .filter(([, url]) => url)
    .map(([name, url, contact = ""]) => ({ name, url, contact }));
}

/** Ways to reach the business, read off its own page: WhatsApp first, it gets answered. */
function contactsIn(html: string): string {
  const uniq = (xs: string[]) => [...new Set(xs)].slice(0, 2);
  const wa = uniq(
    [...html.matchAll(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)\+?(\d{8,15})/g)].map((m) => `wa.me/${m[1]}`),
  );
  const mail = uniq(
    [...html.matchAll(/mailto:([^"'?\s>]+@[^"'?\s>]+)/gi)].map((m) => decodeURIComponent(m[1]).toLowerCase()),
  );
  const tel = uniq([...html.matchAll(/tel:([+\d\s().-]{8,20})/gi)].map((m) => m[1].trim()));
  return [...wa, ...mail, ...tel].join(" · ");
}

const secs =(ms: number | null) => (ms === null ? null : (ms / 1000).toFixed(1));

function draft(lead: Lead, record: AuditRecord, problems: string[]): string {
  const v = record.vitals;
  const link = `${SITE}/auditoria/r/${record.id}`;
  const lines = [`Hola, ¿qué tal? Revisé la web de ${lead.name} y encontré algunas cosas que hoy le pueden estar costando clientes:`, ""];

  if (v?.score != null && v.score < 70) {
    const lcp = secs(v.lab.lcp);
    lines.push(
      `- En celular saca ${v.score}/100 de velocidad según Google` +
        (lcp ? ` y el contenido principal tarda ${lcp} s en aparecer. Más de la mitad de la gente abandona un sitio que tarda más de 3 s.` : "."),
    );
  }
  for (const p of problems.slice(0, 2)) lines.push(`- ${p.charAt(0).toUpperCase()}${p.slice(1)}.`);

  lines.push(
    "",
    `Dejé el reporte completo acá, con qué corregir en cada caso: ${link}`,
    "",
    "Son cosas que se resuelven sin rehacer todo el sitio. Si sirve, lo repasamos en una llamada de 15 minutos.",
    "",
    "Iván — dishape.dev",
  );
  return lines.join("\n");
}

const file = process.argv[2];
if (!file) {
  console.error("usage: npx tsx scripts/prospect.ts <leads.csv>");
  process.exit(1);
}

const leads = parseCsv(await readFile(file, "utf8"));
await mkdir("prospects", { recursive: true });
const out: string[] = [`# Prospectos — ${new Date().toISOString().slice(0, 10)}`, ""];
const skipped: string[] = [];

for (const lead of leads) {
  const normalized = normalizeUrl(lead.url);
  const fetched = normalized ? await safeFetch(normalized) : null;
  if (!normalized || !fetched?.ok) {
    skipped.push(`${lead.name} (${lead.url}): ${fetched && !fetched.ok ? fetched.error : "url_invalid"}`);
    continue;
  }

  const ctx = await buildPageContext(fetched);
  const checks = runChecks(ctx);
  let vitals: VitalsResult | null = null;
  let vitalsError: string | null = null;
  try {
    vitals = await fetchVitals(ctx.url.href);
  } catch (err) {
    vitalsError = err instanceof Error ? err.message : "unknown";
  }

  const record: AuditRecord = {
    id: newAuditId(),
    url: lead.url,
    normalizedUrl: normalized,
    createdAt: new Date().toISOString(),
    lang: "es",
    page: {
      status: ctx.status,
      finalUrl: ctx.url.href,
      redirects: ctx.redirects,
      bytes: ctx.bytes,
      title: ctx.doc.querySelector("title")?.text.trim() || null,
    },
    checks,
    vitals,
    vitalsError,
    vitalsErrorAt: vitalsError ? Date.now() : null,
  };
  await saveAudit(record);

  const failed = new Set(checks.filter((c) => c.status === "fail").map((c) => c.id));
  const problems = Object.keys(PLAIN).filter((id) => failed.has(id)).map((id) => PLAIN[id]);
  const slow = vitals?.score != null && vitals.score < 70;
  // Worth a message only if there is something concrete to say.
  const pitch = slow || problems.length > 0;

  console.log(`${pitch ? "✓" : "·"} ${lead.name}  score=${vitals?.score ?? "?"}  fails=${failed.size}`);
  if (!pitch) continue;

  out.push(
    `## ${lead.name}`,
    `${lead.url} · contacto: ${lead.contact || contactsIn(fetched.html) || "—"} · velocidad móvil: ${vitals?.score ?? "s/d"} · fallas: ${failed.size}`,
    "",
    "```",
    draft(lead, record, problems),
    "```",
    "",
  );
}

if (skipped.length) out.push("## No se pudieron auditar", ...skipped.map((s) => `- ${s}`), "");
await writeFile("prospects/out.md", out.join("\n"), "utf8");
console.log(`\n→ prospects/out.md  (records in ${process.env.AUDIT_DATA_DIR})`);
