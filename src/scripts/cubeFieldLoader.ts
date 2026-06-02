// Lazy-load the Three.js cube field only when its section is near the viewport,
// and never when the user prefers reduced motion. Keeps Three.js out of the
// initial page weight.
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.querySelector<HTMLCanvasElement>("[data-cube-field]");

if (canvas && !reduce) {
  const io = new IntersectionObserver(
    (entries, obs) => {
      if (entries.some((e) => e.isIntersecting)) {
        obs.disconnect();
        import("./cubeField").then((m) => m.initCubeField(canvas));
      }
    },
    { rootMargin: "300px" },
  );
  io.observe(canvas);
}
