/**
 * The shape of a stored audit id, in one place.
 *
 * `newAuditId()` (store.ts) issues it, `getAudit()` refuses anything else
 * before touching the filesystem, and the contact form interpolates it into a
 * report URL on the client (scripts/contact.ts) and on the server
 * (lib/contactEmail.ts). Three readers, one regex: a second copy is a second
 * thing to forget when the generator changes.
 *
 * Deliberately free of imports — the browser bundle for the contact form
 * pulls this in, and store.ts is node-only.
 */
export const AUDIT_ID_RE = /^[a-z0-9]{8}$/;

/** True only for an id the store could actually have issued. */
export const isAuditId = (value: string): boolean => AUDIT_ID_RE.test(value);
