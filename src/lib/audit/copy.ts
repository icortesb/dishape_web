import { getDict, type Lang } from "../../i18n";

/** The localized strings a single check contributes to the report. */
export type CheckCopy = {
  name: string;
  why: string;
  found: string;
  fix: string;
  /** Sentence used when the evidence cannot fill `found` — see resolveFound. */
  foundEmpty?: string;
  /**
   * Sentence used when `found`'s single placeholder is the number 1 — see
   * resolveFound. Only needed by checks whose `found` counts something and
   * whose count can actually be 1 on a branch the report displays.
   */
  foundOne?: string;
  /**
   * Localized labels for the internal enum tokens this check puts in its
   * evidence ("missing", "no-type", "header"…). Without them the token itself
   * lands in the sentence, in English, in the middle of Spanish prose.
   */
  evidenceLabels?: Record<string, string>;
};

/**
 * Evidence keys that carry an internal enum token rather than data read off the
 * audited page. Only these are translated: everything else — a title, a URL, a
 * count — is the visitor's own content and must render verbatim, even when it
 * happens to read like one of our tokens.
 */
export const LOCALIZED_EVIDENCE_KEYS = ["reason", "source"] as const;

/** A check's copy in one language, or undefined for an unknown id. */
export function checkCopy(lang: Lang, id: string): CheckCopy | undefined {
  return (getDict(lang).audit.checks as Record<string, CheckCopy>)[id];
}

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
 * The same problem in its other shape: a `found` that counts something reads
 * "1 chequeos" / "1 checks" the moment the count is 1, and Spanish gets the
 * article wrong on top of the noun. `foundOne` is the sentence for exactly
 * that case, picked when the template holds exactly one placeholder
 * occurrence and the evidence hands it the number 1. It is deliberately
 * narrow — a template with two placeholders has no obvious "the count", and
 * no check needs one today. Occurrences, not distinct names: `"{n} de {n}"`
 * is refused too, which is stricter than it needs to be and costs nothing
 * while no template repeats a placeholder.
 *
 * If neither `foundEmpty` nor `foundOne` is defined, this behaves exactly like
 * `interpolate`: most checks have exactly one shape of evidence on every
 * branch that displays them, and never need a fallback.
 */
export function resolveFound(
  copy: { found: string; foundEmpty?: string; foundOne?: string },
  evidence?: Record<string, string | number>,
): string {
  const keys = placeholdersOf(copy.found);
  const satisfied = keys.every((key) => evidence != null && key in evidence);
  if (!satisfied && copy.foundEmpty) return copy.foundEmpty;
  // Strictly the number 1, never the string "1": every other placeholder in a
  // `found` template carries the visitor's own content, which must never be
  // coerced into picking our copy for them.
  if (copy.foundOne && satisfied && keys.length === 1 && evidence![keys[0]] === 1) {
    return interpolate(copy.foundOne, evidence);
  }
  return interpolate(copy.found, evidence);
}

/** Swap this check's enum tokens for their localized labels. */
function localizeEvidence(
  evidence: Record<string, string | number> | undefined,
  labels: Record<string, string> | undefined,
): Record<string, string | number> | undefined {
  if (!evidence || !labels) return evidence;
  const out = { ...evidence };
  for (const key of LOCALIZED_EVIDENCE_KEYS) {
    const token = out[key];
    if (typeof token === "string" && token in labels) out[key] = labels[token];
  }
  return out;
}

/**
 * The three sentences the report shows for one check result. This is the only
 * supported way to render them: `found` needs resolveFound rather than a bare
 * interpolate (or a check with no evidence prints a literal `{placeholder}`),
 * and all three need the evidence localized first.
 */
export function checkText(
  copy: CheckCopy,
  evidence?: Record<string, string | number>,
): { found: string; why: string; fix: string } {
  const local = localizeEvidence(evidence, copy.evidenceLabels);
  return {
    found: resolveFound(copy, local),
    why: interpolate(copy.why, local),
    fix: interpolate(copy.fix, local),
  };
}
