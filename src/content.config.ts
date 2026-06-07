import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    lang: z.enum(["es", "en"]),
    slug: z.string(),
    /** Shared key that pairs the ES and EN versions of the same article. */
    translationKey: z.string(),
    category: z.string(),
    readingTime: z.string(),
    /** Service page this article links to as the conversion path. */
    relatedService: z.enum(["web", "ecommerce", "ai", "automation"]),
  }),
});

export const collections = { blog };
