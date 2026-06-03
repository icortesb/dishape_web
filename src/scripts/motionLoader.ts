// Keep GSAP + ScrollTrigger (~114 KB) off the critical path. The animations are
// purely decorative, so we only load them once the visitor actually interacts
// (scroll/pointer/key/touch). The hero intro is CSS-driven (see global.css), so
// the first paint never waits for this bundle and nothing flashes.
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
