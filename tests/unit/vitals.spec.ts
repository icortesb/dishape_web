import { test, expect } from "@playwright/test";
import { mapPsiResponse } from "../../src/lib/audit/checks/vitals";

const psi = {
  lighthouseResult: {
    categories: { performance: { score: 0.72 } },
    audits: {
      "largest-contentful-paint": { numericValue: 3120.4 },
      "cumulative-layout-shift": { numericValue: 0.134 },
      "total-blocking-time": { numericValue: 410 },
      "first-contentful-paint": { numericValue: 1450 },
      "total-byte-weight": { numericValue: 2_340_000 },
      "render-blocking-resources": { numericValue: 890 },
      "uses-optimized-images": { details: { overallSavingsBytes: 512_000 } },
    },
  },
  loadingExperience: {
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2900 },
      CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 8 },
      INTERACTION_TO_NEXT_PAINT: { percentile: 240 },
    },
  },
};

test.describe("mapPsiResponse", () => {
  test("scales the score to 0-100 and rounds lab metrics", () => {
    const v = mapPsiResponse(psi);
    expect(v.score).toBe(72);
    expect(v.lab.lcp).toBe(3120);
    expect(v.lab.cls).toBe(0.134);
    expect(v.lab.tbt).toBe(410);
    expect(v.lab.fcp).toBe(1450);
  });

  test("reads field data from CrUX, normalizing the CLS percentile", () => {
    const v = mapPsiResponse(psi);
    // CrUX reports CLS as an integer percentile ×100.
    expect(v.field).toEqual({ lcp: 2900, cls: 0.08, inp: 240 });
  });

  test("carries the byte and savings audits through", () => {
    const v = mapPsiResponse(psi);
    expect(v.transferBytes).toBe(2_340_000);
    expect(v.renderBlockingMs).toBe(890);
    expect(v.imageSavingsBytes).toBe(512_000);
  });

  test("returns nulls rather than throwing on a response with no data", () => {
    const v = mapPsiResponse({});
    expect(v.score).toBeNull();
    expect(v.lab.lcp).toBeNull();
    expect(v.field).toBeNull();
  });

  test("field is null when the origin has no CrUX sample", () => {
    const v = mapPsiResponse({ lighthouseResult: psi.lighthouseResult });
    expect(v.field).toBeNull();
  });
});
