# dishape.dev — setup & operations

## Architecture

- **Astro 6**, mostly **static** (pages prerendered to HTML).
- Only `/api/contact` runs **on-demand** on a Node server (`@astrojs/node`, standalone).
- **Tailwind v4** runs via `@tailwindcss/postcss` (`postcss.config.mjs`), **not**
  the `@tailwindcss/vite` plugin — the Vite plugin is currently incompatible with
  Astro 6's rolldown-based Vite. Don't switch it back.
- **i18n:** Spanish at `/`, English at `/en/`. Copy lives in `src/i18n/{es,en}.ts`.
  Components read the active locale via `getLang(Astro)` — no per-component config.

## Environment variables

Copy `.env.example` → `.env` and fill it in:

| Var | Purpose |
|-----|---------|
| `RESEND_API_KEY` | Contact form email (https://resend.com/api-keys) |
| `CONTACT_FROM` | Verified sender, e.g. `dishape <no-reply@dishape.dev>` |
| `CONTACT_TO` | Inbox for submissions (`dishape.dev@gmail.com`) |
| `PUBLIC_GTM_ID` | GTM container `GTM-XXXXXXX`. Blank = no analytics injected. |
| `HOST` / `PORT` | Node server bind (default `0.0.0.0:4321`) |

`PUBLIC_*` vars are baked in at **build time** — rebuild after changing them.
The rest are read at **runtime**.

## Email (Resend)

1. Add domain `dishape.dev` in Resend → add the DKIM/SPF DNS records → wait for verified.
2. Set `CONTACT_FROM` to an address on that domain.
3. Before the domain is verified you can test with `onboarding@resend.dev`.

The form degrades gracefully: it posts via JS (`fetch`), but also works as a
native POST. A honeypot (`website` field) silently drops bots.

## Analytics — one GTM container

`PUBLIC_GTM_ID` injects GTM + **Google Consent Mode v2**. Consent defaults to
**granted** everywhere, then **denied for EEA/UK/CH** until the visitor accepts
the banner (banner only shows to European visitors — LATAM sees nothing).

Configure these **tags inside GTM** (no code changes needed):

1. **GA4 Configuration** — your `G-XXXXXXX` measurement ID.
2. **Microsoft Clarity** — Clarity tracking tag (heatmaps + session recordings).
3. **Meta Pixel** — base code + a **Lead** event.

**Conversion trigger:** the site pushes `generate_lead` to the dataLayer on
contact-form success and on WhatsApp click. In GTM create a *Custom Event*
trigger on `generate_lead` and fire GA4 `generate_lead` + Meta `Lead` from it.
Mark `generate_lead` as a key event/conversion in GA4 and in Google/Meta Ads.

## Still TODO before launch

- [ ] **`public/og.png`** — add a 1200×630 social share image (referenced by OG/Twitter tags).
- [ ] `trust.metrics` currently shows **sourced industry benchmarks** (Google/Deloitte/BrightEdge),
      not dishape's own results. Swap for real client numbers once you have them.

## Deploy on the VPS

```bash
npm ci
npm run build
# serve. RESEND_*/CONTACT_* are read at RUNTIME, so the env must be loaded
# into the Node process — --env-file does that (Node 20.6+).
node --env-file=.env ./dist/server/entry.mjs
```

> `PUBLIC_*` vars (e.g. `PUBLIC_GTM_ID`) are compiled in at **build** time →
> set them before `npm run build`. `RESEND_*` / `CONTACT_*` / `HOST` / `PORT`
> are **runtime** → they just need to be in the process env (via `--env-file`,
> `export`, pm2 `env`, or a systemd `EnvironmentFile`).

Put Nginx/Caddy in front for TLS and proxy to the Node port.
