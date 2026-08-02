import { extractMeta } from "../parse";
import type { Check, CheckResult, PageContext } from "../types";

const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESC_MIN = 70;
const DESC_MAX = 160;

const result = (
  id: string,
  status: CheckResult["status"],
  evidence?: CheckResult["evidence"],
): CheckResult => ({ id, status, evidence });

const titleOf = (ctx: PageContext) =>
  ctx.doc.querySelector("title")?.text.trim() || null;

export const seoChecks: Check[] = [
  {
    id: "seo.title.present",
    category: "seo",
    severity: "critical",
    run: (ctx) => {
      const title = titleOf(ctx);
      return title
        ? result("seo.title.present", "pass", { title })
        : result("seo.title.present", "fail");
    },
  },
  {
    id: "seo.title.length",
    category: "seo",
    severity: "minor",
    run: (ctx) => {
      const title = titleOf(ctx);
      if (!title) return result("seo.title.length", "na");
      const actual = title.length;
      const status = actual > TITLE_MAX || actual < TITLE_MIN ? "warn" : "pass";
      return result("seo.title.length", status, { actual, min: TITLE_MIN, max: TITLE_MAX });
    },
  },
  {
    id: "seo.description.present",
    category: "seo",
    severity: "important",
    run: (ctx) => {
      const desc = extractMeta(ctx.doc, "description");
      return desc
        ? result("seo.description.present", "pass")
        : result("seo.description.present", "fail");
    },
  },
  {
    id: "seo.description.length",
    category: "seo",
    severity: "minor",
    run: (ctx) => {
      const desc = extractMeta(ctx.doc, "description");
      if (!desc) return result("seo.description.length", "na");
      const actual = desc.length;
      const status = actual > DESC_MAX || actual < DESC_MIN ? "warn" : "pass";
      return result("seo.description.length", status, { actual, min: DESC_MIN, max: DESC_MAX });
    },
  },
  {
    id: "seo.h1.unique",
    category: "seo",
    severity: "important",
    run: (ctx) => {
      const actual = ctx.doc.querySelectorAll("h1").length;
      return result("seo.h1.unique", actual === 1 ? "pass" : "fail", { actual });
    },
  },
  {
    id: "seo.headings.hierarchy",
    category: "seo",
    severity: "minor",
    run: (ctx) => {
      const levels = ctx.doc
        .querySelectorAll("h1,h2,h3,h4,h5,h6")
        .map((el) => Number(el.tagName[1]));
      if (levels.length === 0) return result("seo.headings.hierarchy", "na");
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] - levels[i - 1] > 1) {
          return result("seo.headings.hierarchy", "warn", {
            from: `h${levels[i - 1]}`,
            to: `h${levels[i]}`,
          });
        }
      }
      return result("seo.headings.hierarchy", "pass");
    },
  },
  {
    id: "seo.canonical",
    category: "seo",
    severity: "important",
    run: (ctx) => {
      const href = ctx.doc.querySelector('link[rel="canonical"]')?.getAttribute("href");
      if (!href) return result("seo.canonical", "fail");
      let resolved: URL;
      try {
        resolved = new URL(href, ctx.url);
      } catch {
        return result("seo.canonical", "fail", { found: href });
      }
      if (resolved.host !== ctx.url.host) {
        return result("seo.canonical", "warn", { found: resolved.href });
      }
      return result("seo.canonical", "pass", { found: resolved.href });
    },
  },
  {
    id: "seo.html.lang",
    category: "seo",
    severity: "important",
    run: (ctx) => {
      const lang = ctx.doc.querySelector("html")?.getAttribute("lang")?.trim();
      return lang
        ? result("seo.html.lang", "pass", { found: lang })
        : result("seo.html.lang", "fail");
    },
  },
  {
    id: "seo.robots.txt",
    category: "seo",
    severity: "minor",
    run: (ctx) =>
      ctx.robotsTxt === null
        ? result("seo.robots.txt", "warn")
        : result("seo.robots.txt", "pass"),
  },
  {
    id: "seo.sitemap",
    category: "seo",
    severity: "important",
    run: (ctx) => {
      // null means the probe itself failed, not that the sitemap is missing —
      // reporting that as a defect would accuse the site of a problem we never
      // actually observed.
      if (ctx.sitemapOk === null) return result("seo.sitemap", "na");
      return ctx.sitemapOk
        ? result("seo.sitemap", "pass")
        : result("seo.sitemap", "fail");
    },
  },
  {
    id: "seo.noindex",
    category: "seo",
    severity: "critical",
    run: (ctx) => {
      const meta = (extractMeta(ctx.doc, "robots") ?? "").toLowerCase();
      const header = (ctx.headers.get("x-robots-tag") ?? "").toLowerCase();
      const blocked = meta.includes("noindex") || header.includes("noindex");
      return blocked
        ? result("seo.noindex", "fail", { source: meta.includes("noindex") ? "meta" : "header" })
        : result("seo.noindex", "pass");
    },
  },
  {
    id: "seo.hreflang",
    category: "seo",
    severity: "minor",
    run: (ctx) => {
      const links = ctx.doc.querySelectorAll('link[rel="alternate"][hreflang]');
      if (links.length === 0) return result("seo.hreflang", "na");

      const entries = links.map((el) => ({
        lang: (el.getAttribute("hreflang") ?? "").toLowerCase(),
        href: el.getAttribute("href") ?? "",
      }));

      const selfRef = entries.some((e) => {
        try {
          return new URL(e.href, ctx.url).href.replace(/\/$/, "") ===
            ctx.url.href.replace(/\/$/, "");
        } catch {
          return false;
        }
      });
      if (!selfRef) {
        return result("seo.hreflang", "warn", { count: entries.length, reason: "no-self" });
      }

      // Valid: a BCP-47-ish code, or the x-default sentinel.
      const invalid = entries.filter(
        (e) => e.lang !== "x-default" && !/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(e.lang),
      );
      if (invalid.length > 0) {
        return result("seo.hreflang", "warn", { count: invalid.length, reason: "invalid-code" });
      }

      return result("seo.hreflang", "pass", { count: entries.length });
    },
  },
  {
    id: "seo.https",
    category: "seo",
    severity: "critical",
    run: (ctx) =>
      ctx.url.protocol === "https:"
        ? result("seo.https", "pass")
        : result("seo.https", "fail"),
  },
  {
    id: "seo.http.redirect",
    category: "seo",
    severity: "important",
    run: (ctx) => {
      if (ctx.httpRedirectsToHttps === null) return result("seo.http.redirect", "na");
      return ctx.httpRedirectsToHttps
        ? result("seo.http.redirect", "pass")
        : result("seo.http.redirect", "fail");
    },
  },
];
