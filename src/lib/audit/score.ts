import { checkById } from "./registry";
import type { CheckCategory, CheckResult, Severity } from "./types";

export type CategoryScore = {
  /** Checks that fully passed. */
  passed: number;
  /** Applicable checks — "na" excluded. */
  total: number;
  /** 0-100, warn worth half a pass. */
  percent: number;
};

const WEIGHT: Record<CheckResult["status"], number> = {
  pass: 1,
  warn: 0.5,
  fail: 0,
  na: 0,
};

/**
 * Per-category score. "na" checks leave the denominator — penalizing a site for
 * a check that does not apply to it would be dishonest, and the number is shown
 * next to its raw count so anyone can verify it.
 */
export function scoreCategory(
  results: CheckResult[],
  category: CheckCategory,
): CategoryScore {
  const mine = results.filter((r) => checkById.get(r.id)?.category === category);
  const applicable = mine.filter((r) => r.status !== "na");

  if (applicable.length === 0) return { passed: 0, total: 0, percent: 0 };

  const earned = applicable.reduce((sum, r) => sum + WEIGHT[r.status], 0);
  return {
    passed: applicable.filter((r) => r.status === "pass").length,
    total: applicable.length,
    percent: Math.round((earned / applicable.length) * 100),
  };
}

const STATUS_ORDER: Record<CheckResult["status"], number> = {
  fail: 0,
  warn: 1,
  pass: 2,
  na: 3,
};
const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  important: 1,
  minor: 2,
};

/** Findings sorted the way the report reads them: worst first. "na" is dropped. */
export function rankFindings(results: CheckResult[]): CheckResult[] {
  return results
    .filter((r) => r.status !== "na")
    .sort((a, b) => {
      const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (byStatus !== 0) return byStatus;
      const sa = checkById.get(a.id)?.severity ?? "minor";
      const sb = checkById.get(b.id)?.severity ?? "minor";
      return SEVERITY_ORDER[sa] - SEVERITY_ORDER[sb];
    });
}
