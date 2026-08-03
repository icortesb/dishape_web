// Audit tool behaviour. Two independent blocks, one per page of the tool:
// the landing's URL form, and the report page — where the performance section
// is finished after render (PageSpeed takes ~20s to answer, and blocking the
// whole report on it would lose the visitor) and the link can be copied.

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

const form = document.querySelector<HTMLFormElement>("[data-audit-form]");

if (form) {
  const input = form.querySelector<HTMLInputElement>("input[name='url']")!;
  const button = form.querySelector<HTMLButtonElement>("button[type='submit']")!;
  const errorEl = form.querySelector<HTMLElement>("[data-audit-error]")!;
  // The API answers with error codes; the sentences live in the dictionary and
  // travel on the form, so this file never holds a word of Spanish or English.
  const errors: Record<string, string> = JSON.parse(form.dataset.errors ?? "{}");
  const reportBase = form.dataset.reportBase ?? "/auditoria/r/";
  const original = button.textContent ?? "";

  const showError = (code: string) => {
    errorEl.textContent = errors[code] ?? errors.server ?? code;
    errorEl.classList.remove("hidden");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");
    button.disabled = true;
    button.textContent = form.dataset.analyzing ?? original;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "audit_started" });

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input.value, lang: form.dataset.lang ?? "es" }),
      });
      const data = await res.json();
      if (data.ok) {
        // Leave the button in its "analyzing" state: the report is one
        // navigation away, and resetting it mid-flight reads as if the click
        // had done nothing.
        location.href = `${reportBase}${data.id}/`;
        return;
      }
      showError(data.error);
    } catch {
      showError("server");
    }
    button.disabled = false;
    button.textContent = original;
  });
}

const root = document.querySelector<HTMLElement>("[data-audit-id]");
// Rendered only while the measurement is still missing; its absence means the
// server already knows the answer (or that this is not a report page).
const pendingPanel = document.querySelector<HTMLElement>("[data-vitals-pending]");

if (root && pendingPanel) {
  const id = root.dataset.auditId ?? "";
  const scoreEl = document.querySelector<HTMLElement>("[data-perf-score]");
  const noteEl = document.querySelector<HTMLElement>("[data-perf-note]");

  /**
   * Swap an element for the fallback sentence it carries itself: the score card
   * has room for a caption, the panel it belongs to has room for the
   * explanation, and sharing one string would collapse the panel to four words.
   * The text goes into the element's own paragraph where it has one, so the
   * panel keeps its card chrome instead of flattening to a bare text node.
   */
  const showUnavailable = (el: HTMLElement | null) => {
    if (!el) return;
    const paragraphs = el.querySelectorAll("p");
    (paragraphs[0] ?? el).textContent = el.dataset.unavailable ?? "";
    // Whatever followed was about the measurement in progress ("this takes a
    // few seconds"), which is no longer true.
    paragraphs.forEach((p, i) => i > 0 && p.remove());
  };

  const giveUp = () => {
    showUnavailable(noteEl);
    showUnavailable(pendingPanel);
  };

  fetch(`/api/audit/${id}/vitals`)
    .then((res) => res.json())
    .then((data) => {
      if (data.status !== "ready" || data.vitals?.score === null) {
        giveUp();
        return;
      }
      if (scoreEl) scoreEl.textContent = String(data.vitals.score);
      if (noteEl) noteEl.textContent = "PageSpeed Insights";

      // The detail panel was rendered in its "measuring" state and the numbers
      // only exist now. Reloading lets the server render them, instead of
      // shipping a second copy of VitalsPanel's markup and formatting rules in
      // the client bundle.
      let reloaded = false;
      const reloadOnce = () => {
        if (reloaded) return;
        reloaded = true;
        location.reload();
      };

      window.dataLayer = window.dataLayer || [];
      // dataLayer.push only appends — GTM drains it later. Reloading in the
      // same tick would destroy the event before any tag fired, and the
      // pending path is the normal path for a fresh audit, so that would mean
      // recording no completions at all. eventCallback holds the reload until
      // the queue has drained; the timeout covers a GTM that is absent,
      // blocked, or declined at the consent banner and would never call back.
      window.dataLayer.push({
        event: "audit_completed",
        audit_id: id,
        eventCallback: reloadOnce,
        eventTimeout: 2000,
      });
      setTimeout(reloadOnce, 2000);
    })
    .catch(giveUp);
}

const shareButton = document.querySelector<HTMLButtonElement>("[data-copy-link]");
shareButton?.addEventListener("click", async () => {
  const done = shareButton.dataset.copied;
  const original = shareButton.textContent;
  try {
    await navigator.clipboard.writeText(location.href);
  } catch {
    return; // Denied clipboard permission: leave the button as it was.
  }
  if (!done) return;
  shareButton.textContent = done;
  setTimeout(() => (shareButton.textContent = original), 2000);
});

export {};
