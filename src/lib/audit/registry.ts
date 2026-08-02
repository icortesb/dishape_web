import { seoChecks } from "./checks/seo";
import type { Check, CheckResult, PageContext } from "./types";

/**
 * The catalog. Adding a check is: append an entry here (via its category file)
 * and add its strings under `audit.checks.<id>` in src/i18n/{es,en}.ts.
 */
export const registry: Check[] = [...seoChecks];

export const checkById = new Map(registry.map((c) => [c.id, c]));

/**
 * Run every check. A check that throws is reported as "na" rather than taking
 * the whole audit down — one bad selector on one weird site must not 500.
 */
export function runChecks(ctx: PageContext): CheckResult[] {
  return registry.map((check) => {
    try {
      return check.run(ctx);
    } catch {
      return { id: check.id, status: "na" as const };
    }
  });
}
