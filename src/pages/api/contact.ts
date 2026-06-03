import type { APIRoute } from "astro";
import { Resend } from "resend";

// On-demand (server) route — everything else stays static.
export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_body" }, 400);
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const company = String(body.company ?? "").trim();
  const message = String(body.message ?? "").trim();
  const honeypot = String(body.website ?? "").trim();

  // Bot caught by honeypot — pretend success, send nothing.
  if (honeypot) return json({ ok: true });

  if (!name || name.length > 120) return json({ ok: false, error: "name" }, 400);
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: "email" }, 400);
  if (!message || message.length > 5000)
    return json({ ok: false, error: "message" }, 400);

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO ?? "dishape.dev@gmail.com";
  const from = process.env.CONTACT_FROM ?? "dishape <onboarding@resend.dev>";

  if (!apiKey) {
    console.error("[contact] RESEND_API_KEY not set");
    return json({ ok: false, error: "server" }, 500);
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: email,
      subject: `Nuevo contacto: ${name}${company ? ` · ${company}` : ""}`,
      html: `
        <h2>Nuevo mensaje desde dishape.com.ar</h2>
        <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        ${company ? `<p><strong>Empresa:</strong> ${escapeHtml(company)}</p>` : ""}
        <p><strong>Mensaje:</strong></p>
        <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
      `,
      text: `Nombre: ${name}\nEmail: ${email}\n${company ? `Empresa: ${company}\n` : ""}\n${message}`,
    });

    if (error) {
      console.error("[contact] resend error", error);
      return json({ ok: false, error: "send" }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("[contact] unexpected", err);
    return json({ ok: false, error: "server" }, 500);
  }
};
