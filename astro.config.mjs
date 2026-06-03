// @ts-check
import { defineConfig } from "astro/config";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  site: "https://dishape.com.ar",
  // Pages are prerendered to static HTML (fast, great for paid traffic).
  // Only routes that opt out with `export const prerender = false`
  // (e.g. /api/contact) run on-demand on the Node server.
  adapter: node({ mode: "standalone" }),
  i18n: {
    locales: ["es", "en"],
    defaultLocale: "es",
    routing: {
      prefixDefaultLocale: false, // es at "/", en at "/en/"
    },
  },
  integrations: [
    icon(),
    sitemap({
      filter: (page) => !page.includes("/lab"),
      i18n: {
        defaultLocale: "es",
        locales: { es: "es-AR", en: "en-US" },
      },
    }),
  ],
});
