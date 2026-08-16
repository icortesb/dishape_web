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
 * a scroll that never stops — six seconds of oscillating wheel input from
 * /#servicios — the ceiling fires with the page wherever that scroll has
 * reached and the setup runs there: 27 of the page's 52 reveals were hidden
 * and the batch armed normally, 3/3. What keeps that correct is not the
 * ceiling but the hash-target exclusion in the hide filter below, which holds
 * whether the setup runs early or late.
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
      // home page at y=3000 left one such element hidden at top 677, against
      // an 85% line of 612 on a 720px viewport, until the visitor scrolled it
      // back across the line. Not on every reload — it depends on where the
      // page has settled when the bundle wakes.
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
      // Re-measure every trigger without moving the page. ScrollTrigger's
      // global refresh measures from the top instead: it writes the scroll to
      // 0 and back (ScrollTrigger.js:504 `obj(0)`, :551 `obj(obj.rec)`), and
      // that write cancels whatever scroll the browser is animating — while
      // this bundle wakes on the visitor's first scroll, pointer or key event,
      // the events that start one. On an End keypress, which is both the wake
      // and a smooth scroll to the foot of the page, the global refresh left
      // the scroll dead at 222/488/275/311/268 of 6696.
      //
      // Its `safe` form only narrows that: it defers to a 0.2s delayedCall and
      // an unforced refresh, whose guard (:484) tests `_lastScrollTime`, which
      // is set only by a dispatched `scroll` event (:388). That is one frame
      // narrower than "a scroll is animating", so a scroll starting in the
      // frame the refresh runs in is killed before it moves a pixel, with no
      // `scrollStart` ever dispatched — measured as an ordinary click held
      // 215-230ms landing at y=0 with the contact form 6013px below.
      //
      // Refreshing each trigger touches no scroll position, so there is no
      // such frame. The global path needs the page at the top because pinned
      // elements move with the scroll; nothing here pins, and a trigger with
      // no pin measures itself from wherever the page happens to be. A trigger
      // only self-updates on its FIRST refresh (:1606) and these already had
      // one when they were created, so the update is what applies the new
      // measurements — the same order the global refresh ends in.
      ScrollTrigger.getAll().forEach((t) => t.refresh());
      ScrollTrigger.update();
    };

    // A scroll can already be animating when this bundle wakes, or start one
    // frame later, for reasons nothing here can see: a fragment, End, PageDown,
    // Space, an arrow key, a click on an anchor. So no line above may write the
    // scroll position — see the refresh above, which is the only line that
    // ever wanted to. The fragment is the one case worth waiting out, because
    // it is the one whose destination is in the URL and the one where
    // measuring early hides the very element the visitor named; every other
    // scroll is measured immediately, as an ordinary wheel scroll always has
    // been. ctx.add keeps the deferred animations inside this matchMedia
    // context.
    if (target) whenScrollSettles(() => ctx.add(setup), 4000);
    else setup();
  },
);
