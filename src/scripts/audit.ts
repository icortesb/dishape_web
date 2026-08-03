// Report page behaviour: finish the performance section after render, and copy
// the report link. PageSpeed takes ~20s to answer — blocking the whole report
// on it would lose the visitor — so the page ships with the rest of the
// diagnosis and this fills the gap in.

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

const root = document.querySelector<HTMLElement>("[data-audit-id]");
// Rendered only while the measurement is still missing; its absence means the
// server already knows the answer (or that this is not a report page).
const pendingPanel = document.querySelector<HTMLElement>("[data-vitals-pending]");

if (root && pendingPanel) {
  const id = root.dataset.auditId ?? "";
  const scoreEl = document.querySelector<HTMLElement>("[data-perf-score]");
  const noteEl = document.querySelector<HTMLElement>("[data-perf-note]");
  const unavailable = noteEl?.dataset.unavailable ?? "";

  const giveUp = () => {
    if (noteEl) noteEl.textContent = unavailable;
    pendingPanel.textContent = unavailable;
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
