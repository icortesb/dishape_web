import type { VitalsResult } from "../types";

const PSI_ENDPOINT =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const PSI_TIMEOUT_MS = 45_000;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const round = (v: number | null): number | null => (v === null ? null : Math.round(v));

/** Narrow an unknown nested path without hand-rolling guards at every level. */
function at(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Map a PageSpeed Insights v5 response to our shape. Every field is optional in
 * practice — a site with no CrUX sample has no `loadingExperience`, and audits
 * come and go between Lighthouse versions — so nothing here may throw.
 *
 * INP has no lab equivalent: Lighthouse reports Total Blocking Time as its
 * proxy. Real INP only exists in CrUX field data, which is why `field` is
 * surfaced separately and is null for a site with too little traffic.
 */
export function mapPsiResponse(json: unknown): VitalsResult {
  const audit = (id: string, key = "numericValue") =>
    num(at(json, `lighthouseResult.audits.${id}.${key}`));

  const score = num(at(json, "lighthouseResult.categories.performance.score"));

  const fieldLcp = num(
    at(json, "loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.percentile"),
  );
  const fieldCls = num(
    at(json, "loadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile"),
  );
  const fieldInp = num(
    at(json, "loadingExperience.metrics.INTERACTION_TO_NEXT_PAINT.percentile"),
  );
  const hasField = fieldLcp !== null || fieldCls !== null || fieldInp !== null;

  return {
    score: score === null ? null : Math.round(score * 100),
    lab: {
      lcp: round(audit("largest-contentful-paint")),
      // CLS is a ratio, not a duration — keep its decimals.
      cls: audit("cumulative-layout-shift"),
      tbt: round(audit("total-blocking-time")),
      fcp: round(audit("first-contentful-paint")),
    },
    field: hasField
      ? {
          lcp: fieldLcp,
          // CrUX reports CLS as an integer ×100.
          cls: fieldCls === null ? null : fieldCls / 100,
          inp: fieldInp,
        }
      : null,
    transferBytes: round(audit("total-byte-weight")),
    renderBlockingMs: round(audit("render-blocking-resources")),
    imageSavingsBytes: round(
      audit("uses-optimized-images", "details.overallSavingsBytes"),
    ),
  };
}

/** Ask Google to measure a URL. Throws on transport failure; callers catch. */
export async function fetchVitals(url: string): Promise<VitalsResult> {
  const params = new URLSearchParams({
    url,
    strategy: "mobile",
    category: "performance",
  });
  const key = process.env.PAGESPEED_API_KEY;
  if (key) params.set("key", key);

  const res = await fetch(`${PSI_ENDPOINT}?${params}`, {
    signal: AbortSignal.timeout(PSI_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`psi_http_${res.status}`);

  return mapPsiResponse(await res.json());
}
