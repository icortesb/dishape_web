import { extractJsonLd, extractMeta } from "../parse";
import type { Check, CheckResult } from "../types";

const result = (
  id: string,
  status: CheckResult["status"],
  evidence?: CheckResult["evidence"],
): CheckResult => ({ id, status, evidence });

export const socialChecks: Check[] = [
  {
    id: "social.og.title",
    category: "social",
    severity: "important",
    run: (ctx) => {
      const found = extractMeta(ctx.doc, "og:title");
      return found
        ? result("social.og.title", "pass", { found })
        : result("social.og.title", "fail");
    },
  },
  {
    id: "social.og.description",
    category: "social",
    severity: "important",
    run: (ctx) => {
      const found = extractMeta(ctx.doc, "og:description");
      return found
        ? result("social.og.description", "pass", { found })
        : result("social.og.description", "fail");
    },
  },
  {
    id: "social.og.image",
    category: "social",
    severity: "critical",
    run: (ctx) => {
      const raw = extractMeta(ctx.doc, "og:image");
      if (!raw) return result("social.og.image", "fail", { reason: "missing" });

      const isAbsolute = /^https?:\/\//i.test(raw);

      // When og:image is present and absolute but reachability probe failed,
      // we cannot confirm the image is accessible. Return na to indicate
      // this state was not actually verified, rather than falling through to pass.
      if (isAbsolute && ctx.ogImageOk === null) {
        return result("social.og.image", "na", { reason: "unverified" });
      }

      // If we have reachability data, use it. Probe failed to reach the URL.
      if (ctx.ogImageOk === false) {
        return result("social.og.image", "fail", { reason: "unreachable", found: raw });
      }

      // Some scrapers refuse to resolve relative og:image URLs.
      if (!isAbsolute) {
        return result("social.og.image", "warn", { reason: "relative", found: raw });
      }

      // Absolute URL and reachable (ogImageOk === true).
      return result("social.og.image", "pass", { found: raw });
    },
  },
  {
    id: "social.twitter.card",
    category: "social",
    severity: "minor",
    run: (ctx) => {
      const found = extractMeta(ctx.doc, "twitter:card");
      return found
        ? result("social.twitter.card", "pass", { found })
        : result("social.twitter.card", "warn");
    },
  },
  {
    id: "social.jsonld",
    category: "social",
    severity: "important",
    run: (ctx) => {
      const hasBlocks =
        ctx.doc.querySelectorAll('script[type="application/ld+json"]').length > 0;
      const items = extractJsonLd(ctx.doc);

      if (!hasBlocks) return result("social.jsonld", "fail", { reason: "missing" });
      if (items.length === 0) return result("social.jsonld", "warn", { reason: "unparseable" });

      const types = items
        .map((i) => i["@type"])
        .filter((t): t is string => typeof t === "string");
      if (types.length === 0) return result("social.jsonld", "warn", { reason: "no-type" });

      return result("social.jsonld", "pass", { types: types.join(", ") });
    },
  },
  {
    id: "social.favicon",
    category: "social",
    severity: "minor",
    run: (ctx) => {
      const icon = ctx.doc.querySelector(
        'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
      );
      return icon ? result("social.favicon", "pass") : result("social.favicon", "warn");
    },
  },
];
