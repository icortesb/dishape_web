import type { HTMLElement } from "node-html-parser";

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

export type PageContext = {
  url: URL;
  status: number;
  headers: Headers;
  html: string;
  bytes: number;
  redirects: number;
  doc: HTMLElement;
  /** null when robots.txt could not be fetched at all. */
  robotsTxt: string | null;
  /** null when could not determine (network error, timeout, or invalid URL).
   *  true if we got a 2xx. false if we got another status or the URL was blocked. */
  sitemapOk: boolean | null;
  /** null when the page declares no og:image. false if present but unreachable or unparseable.
   *  true if we got a 2xx. */
  ogImageOk: boolean | null;
  /** null when http:// check fails (network error, timeout).
   *  true when http:// redirects to https:// for this host.
   *  false otherwise. */
  httpRedirectsToHttps: boolean | null;
};

export type CheckStatus = "pass" | "warn" | "fail" | "na";
export type CheckCategory = "seo" | "social" | "perf";
export type Severity = "critical" | "important" | "minor";

export type CheckResult = {
  id: string;
  status: CheckStatus;
  /** Values interpolated into the localized "what we found" string. */
  evidence?: Record<string, string | number>;
};

export type Check = {
  id: string;
  category: CheckCategory;
  severity: Severity;
  run: (ctx: PageContext) => CheckResult;
};
