export type AuditErrorCode =
  | "url_invalid"
  | "url_blocked"
  | "url_unreachable"
  | "not_html"
  | "too_large"
  | "rate_limited";

export type SafeFetchOk = {
  ok: true;
  finalUrl: string;
  status: number;
  headers: Headers;
  html: string;
  bytes: number;
  redirects: number;
};

export type SafeFetchResult = SafeFetchOk | { ok: false; error: AuditErrorCode };
