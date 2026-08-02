import { test, expect } from "@playwright/test";
import { mapPsiResponse, createVitalsResolver } from "../../src/lib/audit/checks/vitals";

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

const stubVitals = (score: number) => ({
  score,
  lab: { lcp: null, cls: null, tbt: null, fcp: null },
  field: null,
  transferBytes: null,
  renderBlockingMs: null,
  imageSavingsBytes: null,
});

test.describe("createVitalsResolver", () => {
  test("concurrent calls for the same id share one upstream call", async () => {
    let calls = 0;
    const value = stubVitals(90);
    const resolver = createVitalsResolver(async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 0));
      return value;
    });

    const [a, b] = await Promise.all([
      resolver("id-concurrent", "https://example.com"),
      resolver("id-concurrent", "https://example.com"),
    ]);

    expect(a).toBe(value);
    expect(b).toBe(value);
    expect(calls).toBe(1);
  });

  test("a failure cleans up so a later call for the same id retries", async () => {
    let calls = 0;
    const resolver = createVitalsResolver(async () => {
      calls++;
      if (calls === 1) throw new Error("first attempt fails");
      return stubVitals(50);
    });

    await expect(
      resolver("id-retry", "https://example.com"),
    ).rejects.toThrow("first attempt fails");

    // If the in-flight entry weren't removed on failure, this would resolve
    // (or reject) with the same cached promise instead of calling again.
    const second = await resolver("id-retry", "https://example.com");
    expect(second.score).toBe(50);
    expect(calls).toBe(2);
  });

  test("a rejection produces no unhandled rejection", async () => {
    const resolver = createVitalsResolver(async () => {
      throw new Error("boom");
    });

    let unhandled: unknown = null;
    const onUnhandledRejection = (reason: unknown) => {
      unhandled = reason;
    };
    process.on("unhandledRejection", onUnhandledRejection);

    try {
      await expect(
        resolver("id-unhandled", "https://example.com"),
      ).rejects.toThrow("boom");
      // Let the microtask queue (and the check phase, where Node reports
      // unhandled rejections) drain before asserting nothing fired.
      await new Promise((resolve) => setImmediate(resolve));
      expect(unhandled).toBeNull();
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });
});
