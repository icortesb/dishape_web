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

import type { HTMLElement } from "node-html-parser";

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
  /** null when we never looked (no candidate URL). */
  sitemapOk: boolean | null;
  /** null when the page declares no og:image. */
  ogImageOk: boolean | null;
  /** true when http:// redirects to https:// for this host. */
  httpRedirectsToHttps: boolean | null;
};
