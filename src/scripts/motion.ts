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

    // ---- Scroll reveals for everything below the fold ----
    // Only hide elements still below the fold when GSAP finally loads — anything
    // already on screen stays visible, so late loading never causes a flash.
    const reveals = gsap.utils
      .toArray<HTMLElement>(".reveal")
      .filter(
        (el) =>
          !el.closest("#top") &&
          el.getBoundingClientRect().top > window.innerHeight * 0.85,
      );
    gsap.set(reveals, { autoAlpha: 0, y: 32 });

    ScrollTrigger.batch(reveals, {
      start: "top 85%",
      onEnter: (batch) =>
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          stagger: 0.08,
          overwrite: true,
        }),
    });

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
  },
);
