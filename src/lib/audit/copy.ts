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
