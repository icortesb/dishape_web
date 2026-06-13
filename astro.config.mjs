// @ts-check
import { defineConfig } from "astro/config";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  site: "https://dishape.dev",
  // Pages are prerendered to static HTML (fast, great for paid traffic).
  // Only routes that opt out with `export const prerender = false`
  // (e.g. /api/contact) run on-demand on the Node server.
  adapter: node({ mode: "standalone" }),
  // Spanish is served at "/" (prefixDefaultLocale: false), so "/es" has no
  // route. Redirect it to its real Spanish URL instead of 404ing.
  redirects: {
    "/es": "/",
    "/es/": "/",
  },
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
        // Bare language codes (not es-AR/en-US) so the sitemap hreflang matches
        // the on-page <link rel="alternate"> codes and targets all Spanish/English
        // regions, not just AR/US. Conflicting codes get ignored by Google.
        locales: { es: "es", en: "en" },
      },
    }),
  ],
});
