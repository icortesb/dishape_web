// The contact form's client half: async submit, status messages, conversion
// tracking, and the prefill for visitors arriving from an audit report.
//
// JS is required. /api/contact only reads request.json(), so a native form
// POST is answered {"ok":false,"error":"invalid_body"} with a 400 — verified
// against the built server with both an urlencoded and a multipart body.

import { isAuditId } from "../lib/audit/id";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/**
 * The audit report's CTA links here as `/?ref=audit&id=<id>&url=<audited>`.
 * Carry that into the form so the lead arrives diagnosed: the message names
 * the site and links the report, and the id rides along to the mailbox.
 *
 * Every value here comes from the query string, so every value is hostile
 * until proven otherwise. The id must match the shape the store issues before
 * it becomes part of a URL; the audited URL must parse as http(s) and stay
 * within a sane length. Anything else means this is not our link, and the form
 * is left exactly as the server rendered it.
 */
function prefillFromAudit(form: HTMLFormElement) {
  const params = new URLSearchParams(location.search);
  if (params.get("ref") !== "audit") return;

  const id = params.get("id") ?? "";
  if (!isAuditId(id)) return;

  const raw = params.get("url") ?? "";
  // Long enough for a real page URL, short enough that nobody can push a wall
  // of text into a message the visitor is about to send under their own name.
  if (raw.length > 300) return;
  let audited: string;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
    // Normalized: the URL parser strips tabs and newlines, so the message
    // cannot gain lines the visitor did not write.
    audited = parsed.href;
  } catch {
    return;
  }

  const hidden = form.querySelector<HTMLInputElement>("input[name='auditId']");
  if (hidden) hidden.value = id;

  const template = form.dataset.auditPrefill;
  const message = form.querySelector<HTMLTextAreaElement>("textarea[name='message']");
  // Never overwrite words the visitor already has. Chromium restores a typed
  // textarea on back-navigation (verified against the built site), so landing
  // here with the field already full is an ordinary visit, not an edge case.
  // The id above still rides along, so their own message arrives diagnosed.
  if (!template || !message || message.value !== "") return;

  // Same shape as the audit landing's form: the locale prefix is decided in
  // Astro, where `lang` is authoritative, not inferred here (UrlForm.astro
  // and scripts/audit.ts:21 do it the same way).
  const report = `${location.origin}${form.dataset.reportBase ?? "/auditoria/r/"}${id}/`;
  // One pass over the template, not one per placeholder: substituting {url}
  // first would put an attacker-fed URL into the haystack the {report} replace
  // then searches, and the URL parser leaves braces alone in a query or a
  // fragment. A replacer function, not a string, because `$&` and friends
  // inside that URL are substitution patterns to String.replace.
  // Written with .value — never innerHTML — so the URL stays inert text.
  message.value = template.replace(/\{url\}|\{report\}/g, (m) =>
    m === "{url}" ? audited : report,
  );
}

function track(event: string, params: Record<string, unknown> = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

const form = document.querySelector<HTMLFormElement>("[data-contact-form]");
const status = document.querySelector<HTMLParagraphElement>("[data-form-status]");

if (form) {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const msg = {
    sending: form.dataset.sending ?? "Sending…",
    success: form.dataset.success ?? "Sent!",
    error: form.dataset.error ?? "Something went wrong.",
  };

  prefillFromAudit(form);

  const setStatus = (text: string, kind: "ok" | "err" | "pending") => {
    if (!status) return;
    status.textContent = text;
    status.classList.remove("hidden", "text-accent-light", "text-red-400", "text-muted");
    status.classList.add(
      kind === "ok" ? "text-accent-light" : kind === "err" ? "text-red-400" : "text-muted",
    );
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (button) button.disabled = true;
    setStatus(msg.sending, "pending");

    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const res = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setStatus(msg.success, "ok");
      form.reset();
      // A lead that came from the free audit has to be countable on its own,
      // or the tool's whole funnel is unreadable. Carried by `form`, which
      // already varies (contact / whatsapp): a third value costs GTM nothing,
      // where a new parameter would have to be mapped and registered first.
      track("generate_lead", {
        form: data.auditId ? "contact_audit" : "contact",
        method: "form",
      });
    } catch (err) {
      console.error("[contact]", err);
      setStatus(msg.error, "err");
    } finally {
      if (button) button.disabled = false;
    }
  });
}

// Track WhatsApp as a lead conversion too.
document.querySelectorAll<HTMLAnchorElement>("[data-wa-link]").forEach((a) => {
  a.addEventListener("click", () => track("generate_lead", { form: "whatsapp", method: "whatsapp" }));
});

export {};
