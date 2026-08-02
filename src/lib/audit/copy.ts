/**
 * Fill `{placeholders}` in a localized string from a check's evidence. Unknown
 * keys are left as-is: a visible `{foo}` in the report is a bug we want to see,
 * whereas "undefined" reads like a broken product to the visitor.
 */
export function interpolate(
  template: string,
  evidence?: Record<string, string | number>,
): string {
  if (!evidence) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in evidence ? String(evidence[key]) : match,
  );
}

/** The `{placeholder}` names a template refers to, in order of appearance. */
function placeholdersOf(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

/**
 * Resolve a check's "found" text for a given result's evidence. A single
 * `found` template can't describe every branch of a check: some branches
 * (typically "nothing was declared at all") supply no evidence, and no
 * amount of clever wording makes one sentence true for both "here's the
 * value we found" and "there is no value". Rather than asserting something
 * the evidence never confirmed — or leaving a stray `{placeholder}` visible —
 * fall back to `foundEmpty`, the sentence that's true precisely when the
 * evidence needed to fill `found` isn't there.
 *
 * If `foundEmpty` isn't defined, this behaves exactly like `interpolate`:
 * most checks have exactly one shape of evidence on every branch that
 * displays them, and never need the fallback.
 */
export function resolveFound(
  copy: { found: string; foundEmpty?: string },
  evidence?: Record<string, string | number>,
): string {
  const satisfied = placeholdersOf(copy.found).every(
    (key) => evidence != null && key in evidence,
  );
  if (!satisfied && copy.foundEmpty) return copy.foundEmpty;
  return interpolate(copy.found, evidence);
}
