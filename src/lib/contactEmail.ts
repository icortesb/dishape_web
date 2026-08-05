import { isAuditId } from "./audit/id";
import { SITE } from "../site";

export interface ContactFields {
  name: string;
  email: string;
  company: string;
  message: string;
  /** Set when the visitor arrived from an audit report. */
  auditId?: string;
}

export interface ContactEmail {
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/**
 * The report the lead is about, or null.
 *
 * The id is interpolated straight into a URL, so nothing that is not the
 * store's own 8-char shape may get there — a rejected id has no report behind
 * it anyway. `[a-z0-9]{8}` also leaves no character that could break out of an
 * href, which is why the link below is not escaped.
 *
 * The Spanish route: the mail is Spanish and only the owner reads it. Both
 * locales render the same record.
 */
function reportUrl(auditId: string | undefined): string | null {
  const id = (auditId ?? "").trim();
  return isAuditId(id) ? `${SITE.url}/auditoria/r/${id}/` : null;
}

/**
 * The notification mail for one contact submission.
 *
 * Both bodies carry the report link: some clients render only text/plain, and
 * a link that reaches half the readers is a link the owner cannot rely on.
 * With no audit id the output is byte-for-byte the mail this site sent before
 * the audit existed — hence the two report lines are appended INSIDE their
 * conditional, newline and indentation included, instead of sitting on their
 * own line in the template.
 */
export function buildContactEmail(f: ContactFields): ContactEmail {
  const { name, email, company, message } = f;
  const report = reportUrl(f.auditId);

  return {
    subject: `Nuevo contacto: ${name}${company ? ` · ${company}` : ""}`,
    html: `
        <h2>Nuevo mensaje desde dishape.dev</h2>
        <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        ${company ? `<p><strong>Empresa:</strong> ${escapeHtml(company)}</p>` : ""}${report ? `\n        <p><strong>Reporte de la auditoría:</strong> <a href="${report}">${report}</a></p>` : ""}
        <p><strong>Mensaje:</strong></p>
        <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
      `,
    text: `Nombre: ${name}\nEmail: ${email}\n${company ? `Empresa: ${company}\n` : ""}${report ? `Reporte: ${report}\n` : ""}\n${message}`,
  };
}
