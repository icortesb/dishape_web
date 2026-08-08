import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Animated counters (e.g. +40%, −55%, 95+). When `immediate` is true we skip
 * the count-up entirely (reduced-motion path).
 */
function runCounters(immediate: boolean) {
  gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
    const target = parseFloat(el.dataset.count || "0");
    const prefix = el.dataset.prefix ?? "";
    const suffix = el.dataset.suffix ?? "";
    const render = (n: number) => (el.textContent = `${prefix}${n}${suffix}`);

    if (immediate) {
      render(target);
      return;
    }

    const obj = { v: 0 };
    gsap.to(obj, {
      v: target,
      duration: 1.4,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
      onUpdate: () => render(Math.round(obj.v)),
      onComplete: () => render(target),
    });
  });
}

/** The element the URL fragment points at, if there is one. */
function hashTarget(): HTMLElement | null {
  const raw = location.hash.slice(1);
  if (!raw) return null;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // A malformed escape sequence is not something to decode — try it as written.
  }
  return document.getElementById(id);
}

/**
 * Run `fn` once the page has held still for a few frames.
 *
 * A fragment navigation is an animated scroll — global.css gives the page
 * `scroll-behavior: smooth` — and its first frame is what wakes this bundle,
 * since motionLoader.ts listens for `scroll`. Measuring positions then reads
 * the page the visitor is leaving, not the one they asked for, and hides the
 * section they are on their way to.
 *
 * `timeout` is a ceiling, not a promise the scroll has ended. Measured against
 * a scroll that never stops: the ceiling fires with the page wherever that
 * scroll has reached, and if nothing there sits below the 85% line then
 * `reveals` is empty, no batch is armed, and none is armed later either. That
 * costs nothing visible — an unarmed reveal is a reveal that was never hidden.
 */
function whenScrollSettles(fn: () => void, timeout: number) {
  const STILL_FRAMES = 5;
  let last = -1;
  let still = 0;
  const deadline = performance.now() + timeout;
  const tick = () => {
    still = window.scrollY === last ? still + 1 : 0;
    last = window.scrollY;
    if (still >= STILL_FRAMES || performance.now() >= deadline) fn();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const mm = gsap.matchMedia();

mm.add(
  {
    reduce: "(prefers-reduced-motion: reduce)",
    ok: "(prefers-reduced-motion: no-preference)",
  },
  (ctx) => {
    const reduce = ctx.conditions?.reduce;

    // ---- Reduced motion: everything visible, no movement ----
    if (reduce) {
      gsap.set(".reveal", { autoAlpha: 1, y: 0 });
      runCounters(true);
      return;
    }

    gsap.defaults({ ease: "power3.out", duration: 0.7 });

    // Hero intro is handled in CSS (global.css) so the first paint never waits
    // for this lazily-loaded bundle.

    const target = hashTarget();

    const setup = () => {
      // ---- Scroll reveals for everything below the fold ----
      // Only hide what is below the line when GSAP finally loads, so late
      // loading does not take away what the visitor is already reading. The
      // line is at 85% of the viewport, not at its bottom edge, so an element
      // in that last 15% is on screen and gets hidden anyway: reloading the
      // home page part-way down leaves one such element hidden at top 657 of a
      // 720px viewport until the visitor scrolls it back across the line.
      // Approved design, measured identical before and after this file learned
      // to defer. Nothing inside the fragment's target is hidden either: that
      // is the element the visitor asked to be looking at, so it must survive
      // this filter however the scroll that carries them there behaves.
      const reveals = gsap.utils
        .toArray<HTMLElement>(".reveal")
        .filter(
          (el) =>
            !el.closest("#top") &&
            !target?.contains(el) &&
            el.getBoundingClientRect().top > window.innerHeight * 0.85,
        );
      // A page can legitimately have none — the audit report and the blog
      // posts carry no .reveal at all — and GSAP warns "target not found" when
      // handed an empty set (gsap-core.js:3181).
      if (reveals.length > 0) {
        gsap.set(reveals, { autoAlpha: 0, y: 32 });

        ScrollTrigger.batch(reveals, {
          start: "top 85%",
          onEnter: (batch) =>
            gsap.to(batch, {
              autoAlpha: 1,
              y: 0,
              // A scroll that lands past the start line instead of crossing it
              // — a restored position, scrollIntoView, a fast flick — enters
              // everything below in a single batch. Measured at 47 elements on
              // the home page, which at a flat 0.08s each leaves the last one
              // waiting 3.7s, so cap the window the whole batch spans. Batches
              // of six or fewer keep the 0.08s spacing exactly.
              stagger: Math.min(0.08, 0.4 / Math.max(batch.length - 1, 1)),
              overwrite: true,
            }),
        });
      }

      // ---- Subtle blueprint-grid parallax ----
      gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
        const depth = parseFloat(el.dataset.parallax || "0.1");
        gsap.to(el, {
          yPercent: depth * 100,
          ease: "none",
          scrollTrigger: {
            trigger: el.closest("section") || el,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      });

      runCounters(false);
      // A plain ScrollTrigger.refresh() saves and restores the scroll
      // position, which cancels an animated scroll that has not finished — and
      // this bundle wakes on the visitor's first scroll or keypress, which are
      // the events that start one. `true` asks for the safe refresh instead:
      // ScrollTrigger runs it 0.2s later, and later still if a scroll is in
      // progress, on its own scrollEnd. Observed on an End keypress, which is
      // both the wake and a smooth scroll to the foot of the page: the plain
      // call refreshed at y=0 mid-flight and the scroll died at 1311 of 6696;
      // this one refreshed 4ms after scrollEnd, at 6696.
      ScrollTrigger.refresh(true);
    };

    // A scroll can already be animating when this bundle wakes, for reasons
    // nothing here can see: a fragment, End, PageDown, Space, an arrow key. So
    // no line above may cancel one — that is what refresh(true) is for, and it
    // holds whatever started the scroll. The fragment is the one case worth
    // waiting out, because it is the one whose destination is in the URL and
    // the one where measuring early hides the very element the visitor named;
    // every other scroll is measured immediately, as an ordinary wheel scroll
    // always has been. ctx.add keeps the deferred animations inside this
    // matchMedia context.
    if (target) whenScrollSettles(() => ctx.add(setup), 4000);
    else setup();
  },
);
