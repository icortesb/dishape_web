import { test, expect } from "@playwright/test";
import { parse } from "node-html-parser";
import { extractMeta, extractJsonLd } from "../../src/lib/audit/parse";

test.describe("extractMeta", () => {
  test("reads name= and property= meta tags case-insensitively", () => {
    const doc = parse(`
      <meta name="description" content="una descripcion">
      <meta property="og:title" content="El titulo">
      <meta NAME="Twitter:Card" content="summary">
    `);
    expect(extractMeta(doc, "description")).toBe("una descripcion");
    expect(extractMeta(doc, "og:title")).toBe("El titulo");
    expect(extractMeta(doc, "twitter:card")).toBe("summary");
  });

  test("returns null when absent or empty", () => {
    const doc = parse(`<meta name="description" content="">`);
    expect(extractMeta(doc, "description")).toBeNull();
    expect(extractMeta(doc, "keywords")).toBeNull();
  });
});

test.describe("extractJsonLd", () => {
  test("parses valid ld+json blocks", () => {
    const doc = parse(`
      <script type="application/ld+json">{"@type":"Organization","name":"x"}</script>
    `);
    expect(extractJsonLd(doc)).toEqual([{ "@type": "Organization", name: "x" }]);
  });

  test("skips blocks that do not parse instead of throwing", () => {
    const doc = parse(`
      <script type="application/ld+json">{ broken json,,, }</script>
      <script type="application/ld+json">{"@type":"WebSite"}</script>
    `);
    expect(extractJsonLd(doc)).toEqual([{ "@type": "WebSite" }]);
  });

  test("flattens @graph containers", () => {
    const doc = parse(`
      <script type="application/ld+json">
        {"@graph":[{"@type":"A"},{"@type":"B"}]}
      </script>
    `);
    expect(extractJsonLd(doc)).toEqual([{ "@type": "A" }, { "@type": "B" }]);
  });
});
