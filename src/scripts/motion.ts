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
 * Nothing below may measure a position while a scroll is in flight, and
 * ScrollTrigger.refresh() saves and restores the scroll position, which
 * cancels an animated scroll that has not finished. A fragment navigation is
 * both of those at once: global.css gives it `scroll-behavior: smooth`, and
 * the first frame of that scroll is what wakes this bundle, since
 * motionLoader.ts listens for `scroll`.
 *
 * `timeout` is a ceiling, not a promise the scroll has ended: a visitor who
 * keeps scrolling never settles, and they still need the reveals armed.
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
      // Only hide elements still below the fold when GSAP finally loads —
      // anything already on screen stays visible, so late loading never causes
      // a flash. Nothing inside the fragment's target is hidden either: that
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
      // A page can legitimately have none — the audit report is all
      // above-the-fold diagnosis — and GSAP logs "target not found" when
      // handed an empty set.
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
      ScrollTrigger.refresh();
    };

    // A fragment navigation is still animating when this bundle wakes up, so
    // hold everything until it lands — see whenScrollSettles. ctx.add keeps
    // the deferred animations inside this matchMedia context. Without a
    // fragment there is no scroll going anywhere in particular and measuring
    // now is correct.
    if (target) whenScrollSettles(() => ctx.add(setup), 4000);
    else setup();
  },
);
