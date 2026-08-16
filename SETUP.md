# dishape.dev — setup & operations

## Architecture

- **Astro 6**, mostly **static** (pages prerendered to HTML).
- Only `/api/contact` runs **on-demand** on a Node server (`@astrojs/node`, standalone).
- **Tailwind v4** runs via `@tailwindcss/postcss` (`postcss.config.mjs`), **not**
  the `@tailwindcss/vite` plugin — the Vite plugin is currently incompatible with
  Astro 6's rolldown-based Vite. Don't switch it back.
- **i18n:** Spanish at `/`, English at `/en/`. Copy lives in `src/i18n/{es,en}.ts`.
  Components read the active locale via `getLang(Astro)` — no per-component config.

## Type checking

`npm run check` runs `astro check` (types across `.ts` **and** `.astro`). The build
does **not** type-check — it strips types — so this is the only thing that catches
type errors.

It is **not wired into CI yet**, because 5 errors predate it and one is deliberate:

| Where | Error | Status |
|---|---|---|
| `src/layouts/Base.astro:2-3` | `@fontsource-variable/*` side-effect imports have no type declarations | noise; needs a `.d.ts` shim |
| `src/pages/[servicio].astro:26`, `src/pages/en/[service].astro:26` | `ServicePageData` union is invariant over `slug`, so the per-slug object literals don't unify | real modelling wart |
| `src/lib/audit/safeFetch.ts:109` | `pinnedLookup` isn't assignable to `LookupFunction` | **deliberate.** The hook handles both the `string` and the `{ all: true }` array shape and calls back with one argument on error; Node's declared type covers neither. Type-only — do not "fix" it by changing what the callback passes. |

Clear the first two rows and then add `npm run check` to `.github/workflows/deploy.yml`.

## Environment variables

Copy `.env.example` → `.env` and fill it in:

| Var | Purpose |
|-----|---------|
| `RESEND_API_KEY` | Contact form email (https://resend.com/api-keys) |
| `CONTACT_FROM` | Verified sender, e.g. `dishape <no-reply@dishape.dev>` |
| `CONTACT_TO` | Inbox for submissions (`dishape.dev@gmail.com`) |
| `PUBLIC_GTM_ID` | GTM container `GTM-XXXXXXX`. Blank = no analytics injected. |
| `AUDIT_DATA_DIR` | Where audit reports are stored (must be **outside** the release dir, see below). Optional — defaults to `/var/lib/dishape/audits`. |
| `PAGESPEED_API_KEY` | **Set this.** Optional in code, but without it the performance card never fills in — see below. |
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

## Site auditor data directory

Audit reports are stored as JSON files in `AUDIT_DATA_DIR` (default
`/var/lib/dishape/audits`, see `src/lib/audit/store.ts`). **This directory must
live outside the release directory** — the VPS deploy does `git reset --hard` on
`/opt/dishape`, so persistent data would be wiped on every deploy.

`.github/workflows/deploy.yml` runs `mkdir -p /var/lib/dishape/audits` before
`npm ci`, so a fresh VPS provisions itself. That line hardcodes the default path:
if you point `AUDIT_DATA_DIR` somewhere else, change it there too.

The service currently runs as **root** (`dishape.service` sets no `User=`), so the
directory needs no extra ownership. If you ever move it to a dedicated user, create
it with that owner instead:

```bash
sudo mkdir -p /var/lib/dishape/audits
sudo chown dishape:dishape /var/lib/dishape/audits
```

### `PAGESPEED_API_KEY` — optional in code, required in practice

The performance card asks Google's PageSpeed Insights API. Without a key the
request goes out unauthenticated, and Google bills that against **one shared
anonymous project** whose daily quota is routinely already spent: measured
2026-08-16, the keyless endpoint answered `429 Quota exceeded … for consumer
'project_number:583797351490'` on the first call of the day. The report degrades
correctly when that happens — the card reads "No se pudo medir" and the rest of
the diagnosis still renders — but the card is effectively dead until a key is set.

Get a free key at
https://developers.google.com/speed/docs/insights/v5/get-started, put
`PAGESPEED_API_KEY=…` in `/opt/dishape/.env`, and `systemctl restart dishape`.
It is read at runtime, so no rebuild is needed.

Runtime vars reach the process through `--env-file=/opt/dishape/.env` in the
`ExecStart` line of `dishape.service` — **not** a systemd `EnvironmentFile`. Add
new runtime vars to that `.env` and `systemctl restart dishape`.

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
