// Calendly popup + conversion tracking.
// Any [data-calendly] trigger (an <a href> to the Calendly URL) opens the
// booking popup. Assets are loaded lazily on first click, so the external
// widget never costs anything until the visitor actually wants to book.
// When a meeting is *scheduled* we push the same `generate_lead` event the
// form and WhatsApp use — so GTM counts it as a conversion with no extra setup.
// Without JS the <a> still opens the Calendly page in a new tab.

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    Calendly?: { initPopupWidget: (opts: { url: string }) => void };
  }
}

const CSS = "https://assets.calendly.com/assets/external/widget.css";
const JS = "https://assets.calendly.com/assets/external/widget.js";

let loading: Promise<void> | null = null;

function loadCalendly(): Promise<void> {
  if (window.Calendly) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Calendly failed to load"));
    document.head.appendChild(script);
  });

  return loading;
}

function track(event: string, params: Record<string, unknown> = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

document.querySelectorAll<HTMLAnchorElement>("[data-calendly]").forEach((el) => {
  el.addEventListener("click", async (e) => {
    const url = el.getAttribute("href") || el.dataset.calendly;
    if (!url) return;
    e.preventDefault();
    try {
      await loadCalendly();
      window.Calendly?.initPopupWidget({ url });
    } catch (err) {
      console.error("[calendly]", err);
      window.open(url, "_blank", "noopener"); // fallback
    }
  });
});

// Conversion fires only when the booking is actually completed.
window.addEventListener("message", (e) => {
  if (e.origin !== "https://calendly.com") return;
  if (e.data?.event === "calendly.event_scheduled") {
    track("generate_lead", { form: "calendly", method: "calendly" });
  }
});

export {};
