// Progressive-enhancement for the contact form: async submit, status messages
// and conversion tracking. Works without JS too (native POST to /api/contact).

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
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
      track("generate_lead", { form: "contact", method: "form" });
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
