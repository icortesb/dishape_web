// Renders the raster brand assets from their sources in this folder:
//   public/og.png, public/og-en.png  <- design/og.html
//   public/signature-mark.png        <- design/mark.svg (transparent, 176px)
//   public/apple-touch-icon.png      <- design/mark.svg on the canvas grey (180px)
// Run: node design/render-brand.mjs
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const mark = readFileSync(here("./mark.svg"), "utf8");
const b = await chromium.launch();

for (const [lang, out] of [["es", "../public/og.png"], ["en", "../public/og-en.png"]]) {
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto(`file://${here("./og.html")}?lang=${lang}`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: here(out) });
  await p.close();
}

async function icon(size, bg, pad, out) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<body style="margin:0;background:${bg};display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${mark.replace('width="100" height="100"', 'width="100%" height="100%"')}</div></body>`);
  await p.screenshot({ path: here(out), omitBackground: bg === "transparent" });
  await p.close();
}
await icon(176, "transparent", 0, "../public/signature-mark.png");
await icon(180, "#ececec", 26, "../public/apple-touch-icon.png");

// Animated signature marks: the "d" assembles once (disc grows, bar rises),
// then rests. Frame 0 is the finished mark, because Outlook shows only that.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ease = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const frameSvg = (disc, bar) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="176" height="176">
  <mask id="c"><rect width="100" height="100" fill="#fff"/><circle cx="40" cy="62" r="13" fill="#000"/></mask>
  <g mask="url(#c)">
    <circle cx="40" cy="62" r="32" fill="#ff5b1f" opacity="${Math.min(1, disc * 1.6)}" transform="translate(40 62) scale(${0.6 + 0.4 * disc}) translate(-40 -62)"/>
    <rect x="60" y="4" width="20" height="90" rx="10" fill="#c93d0a" opacity="${Math.min(1, bar * 1.6)}" transform="translate(0 94) scale(1 ${0.2 + 0.8 * bar}) translate(0 -94)"/>
  </g></svg>`;

for (const [bg, out] of [["#ffffff", "../public/signature-mark.gif"], ["#0c0c0c", "../public/signature-mark-dark.gif"]]) {
  const dir = mkdtempSync(join(tmpdir(), "sig-"));
  const p = await b.newPage({ viewport: { width: 176, height: 176 } });
  const frames = [[1, 1]];
  const N = 30; // ~1s at 30fps
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    frames.push([ease(Math.min(1, t / 0.8)), ease(Math.max(0, (t - 0.2) / 0.8))]);
  }
  const files = [];
  for (const [k, [d, r]] of frames.entries()) {
    await p.setContent(`<body style="margin:0;background:${bg}">${frameSvg(d, r)}</body>`);
    const f = join(dir, `f${String(k).padStart(3, "0")}.png`);
    await p.screenshot({ path: f });
    files.push(f);
  }
  await p.close();
  // First frame flashes for 1 cs; motion frames ~33 ms; the last frame rests.
  const args = ["-loop", "1", "-delay", "1", files[0], "-delay", "3", ...files.slice(1, -1), "-delay", "1000", files.at(-1), "-layers", "Optimize", here(out)];
  execFileSync("magick", args);
}

await b.close();
