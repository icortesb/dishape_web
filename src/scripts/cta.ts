// CTA engagement tracking. Any element with [data-cta="<location>"] pushes a
// `cta_click` event to the dataLayer when clicked, so GTM/GA4 can attribute
// engagement to a specific button (hero, navbar, floating WhatsApp, …).
// This is *engagement*, not conversion — actual leads still fire `generate_lead`
// from contact.ts / calendly.ts when the action completes.

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

document.querySelectorAll<HTMLElement>("[data-cta]").forEach((el) => {
  el.addEventListener("click", () => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "cta_click",
      cta_location: el.dataset.cta,
      cta_label: (el.textContent ?? "").trim() || undefined,
    });
  });
});

export {};
