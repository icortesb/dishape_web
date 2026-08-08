// Keep GSAP + ScrollTrigger (~114 KB) off the critical path. The animations are
// purely decorative, so we only load them once the visitor actually interacts
// (scroll/pointer/key/touch). The hero intro is CSS-driven (see global.css), so
// the first paint never waits for this bundle and the hero never flashes.
// Everything else this bundle can hide it picks from what sits below the fold
// when it wakes — with one measured exception in the last 15% of the viewport,
// documented at the hide filter in motion.ts.
let loaded = false;
const evts = ["scroll", "pointerdown", "keydown", "touchstart"] as const;

function cleanup() {
  evts.forEach((e) => window.removeEventListener(e, load));
}

function load() {
  if (loaded) return;
  loaded = true;
  cleanup();
  import("./motion");
}

evts.forEach((e) => window.addEventListener(e, load, { passive: true }));

export {};
