# Auditor de sitios — diseño

Fecha: 2026-08-01
Estado: aprobado

## Objetivo

Herramienta gratuita en dishape.dev que audita un sitio a partir de su URL.
Doble función: imán de tráfico orgánico (rankea, se comparte, genera backlinks) y
generador de leads calificados (el reporte *es* el pitch — autoridad por diagnóstico,
consistente con `docs/voice.md`).

Decisiones tomadas con el usuario:

- Reporte **completo y gratis**, sin gate de email. El objetivo primario es tráfico;
  un gate mata el compartido y los backlinks.
- Sin Chrome headless en el VPS. Fetch propio + PageSpeed Insights API.
- Resultado persistido en **URL compartible**.
- **Bilingüe desde el arranque** (es + en).
- Categorías MVP: SEO técnico, Rendimiento, Compartir/Schema. Accesibilidad queda fuera.

## Rutas

| Ruta | Render | Indexable |
|---|---|---|
| `/auditoria` | prerenderizada | sí — target SEO |
| `/en/audit` | prerenderizada | sí |
| `/auditoria/r/<id>` | on-demand | `noindex, follow` |
| `/en/audit/r/<id>` | on-demand | `noindex, follow` |
| `POST /api/audit` | on-demand | — |
| `GET /api/audit/<id>/vitals` | on-demand | — |

`/auditoria` convive con el catch-all `src/pages/[servicio].astro`. Astro prioriza
rutas estáticas sobre dinámicas, así que la nueva gana. Cubierto por test e2e para
que no se rompa en silencio.

## Flujo en dos fases

PageSpeed tarda 15-25 s; un spinner de esa duración pierde usuarios. Se parte en dos:

```
1. POST /api/audit { url, lang }
2. Servidor: safeFetch + parseo + checks estáticos   (~1 s)
   → persiste el registro → { id }
3. Cliente navega a /auditoria/r/<id>
   → SEO y Compartir ya visibles
4. La sección Rendimiento arranca en estado "midiendo…"
   → GET /api/audit/<id>/vitals                       (~20 s)
   → merge en el registro persistido + render progresivo
```

Sin cola, sin workers, sin Redis. Un solo proceso Node.

## Contratos de API

### `POST /api/audit`

```ts
// request
{ url: string; lang: "es" | "en" }

// 200
{ ok: true; id: string; cached: boolean }

// 400 — url_invalid | url_blocked | url_unreachable | not_html | too_large
// 429 — rate_limited
{ ok: false; error: string }
```

`id`: 8 chars base36 desde `crypto.randomBytes`. No secuencial (no filtra volumen).

### `GET /api/audit/<id>/vitals`

```ts
// 200 — listo (recién medido o ya persistido)
{ ok: true; status: "ready"; vitals: VitalsResult }

// 200 — PSI falló; el reporte sigue siendo válido sin esta sección
{ ok: true; status: "unavailable"; reason: string }

// 404 — id inexistente o expirado
```

Idempotente: si el registro ya tiene `vitals`, los devuelve sin volver a llamar a PSI.
Llamadas concurrentes al mismo `id` se colapsan con un mapa de promesas en memoria.

## Modelo de datos

Un archivo JSON por auditoría en `AUDIT_DATA_DIR`.

```ts
type AuditRecord = {
  id: string;
  url: string;            // URL final, tras redirecciones
  normalizedUrl: string;  // clave de caché
  createdAt: string;      // ISO
  lang: "es" | "en";      // idioma de origen; el reporte se puede ver en ambos
  page: {
    status: number;
    finalUrl: string;
    redirects: number;
    bytes: number;
    title: string | null;
  };
  checks: CheckResult[];
  vitals: VitalsResult | null;      // null hasta la fase 2
  vitalsError: string | null;
};
```

**Ubicación**: `AUDIT_DATA_DIR` debe apuntar **fuera del directorio de release**
(p. ej. `/var/lib/dishape/audits`). El deploy por SSH reemplaza el release; si los
datos viven adentro, cada deploy los borra.

**Índice de caché**: `<AUDIT_DATA_DIR>/index.json`, mapa `normalizedUrl → { id, createdAt }`.
Se carga en memoria al arrancar y se reescribe en cada alta. A este volumen alcanza;
si algún día no alcanza, migrar a `node:sqlite`.

**Normalización de URL** (clave de caché): minúsculas en host, se descarta `www.`,
se fuerza `https`, se quita trailing slash, se descartan query y hash.

**Caché**: si existe un registro de la misma `normalizedUrl` con menos de **24 h**,
`POST /api/audit` devuelve ese `id` con `cached: true` en vez de re-auditar.

**TTL**: 30 días. Limpieza perezosa — al escribir un registro nuevo se barre el
directorio y se borran los `mtime` vencidos. Sin cron.

## Seguridad: SSRF

Hacer `fetch()` de una URL provista por un desconocido es SSRF de manual. Todo
aislado en `src/lib/audit/safeFetch.ts`, que es el único módulo peligroso del sistema
y lleva su propia batería de tests.

Reglas, aplicadas **en cada salto de redirección**, no solo en el primero:

- Solo esquemas `http:` y `https:`
- Sin credenciales embebidas (`user:pass@`)
- Resolver DNS y rechazar el destino si la IP cae en: loopback (`127.0.0.0/8`, `::1`),
  privadas (`10/8`, `172.16/12`, `192.168/16`, `fc00::/7`), link-local
  (`169.254.0.0/16` — metadata de cloud, `fe80::/10`), `0.0.0.0/8`, multicast
- Máximo 3 redirecciones (`redirect: "manual"`, se sigue a mano para poder validar
  cada salto)
- Timeout 10 s (`AbortSignal.timeout`)
- Cap de 2 MB — se lee por stream y se aborta al superarlo, no se confía en
  `content-length`
- Solo `content-type: text/html` (o `application/xhtml+xml`)

**Rate limit** (`src/lib/audit/rateLimit.ts`): token bucket en memoria por IP,
5 auditorías / 15 min. Un solo proceso Node, en memoria alcanza. La IP se lee de
`X-Forwarded-For` (primer valor) porque nginx está adelante. El caché por URL absorbe
el caso repetido legítimo.

## Motor de chequeos

Cada chequeo es una **función pura** sin I/O — el fetch ya ocurrió, el HTML ya está
parseado. Esto los hace testeables con fixtures y sin red.

```ts
type PageContext = {
  url: URL;              // URL final
  status: number;
  headers: Headers;
  html: string;
  doc: HTMLElement;      // node-html-parser
  robotsTxt: string | null;   // fetch best-effort, null si falla
  sitemapOk: boolean | null;  // HEAD best-effort
  ogImageOk: boolean | null;  // HEAD sobre og:image, null si no hay
};

type CheckResult = {
  id: string;                                  // "seo.title.length"
  status: "pass" | "warn" | "fail" | "na";
  evidence?: Record<string, string | number>;  // { actual: 87, max: 60 }
};

type Check = {
  id: string;
  category: "seo" | "social" | "perf";
  severity: "critical" | "important" | "minor";
  run: (ctx: PageContext) => CheckResult;
};
```

El catálogo vive en `src/lib/audit/registry.ts` como array de `Check`. Agregar un
chequeo = agregar una entrada + sus strings en i18n. Nada más.

### Catálogo MVP

**SEO técnico** (`seo.*`)

| id | falla si | severidad |
|---|---|---|
| `seo.title.present` | no hay `<title>` o está vacío | critical |
| `seo.title.length` | fuera de 30-60 chars (warn) | minor |
| `seo.description.present` | no hay meta description | important |
| `seo.description.length` | fuera de 70-160 chars (warn) | minor |
| `seo.h1.unique` | 0 o >1 `<h1>` | important |
| `seo.headings.hierarchy` | salta niveles (h1→h3) | minor |
| `seo.canonical` | ausente, relativa, o apunta a otro host | important |
| `seo.html.lang` | falta `lang` en `<html>` | important |
| `seo.robots.txt` | 404 o error | minor |
| `seo.sitemap` | no declarado en robots.txt ni en `/sitemap.xml` | important |
| `seo.noindex` | `noindex` en meta robots o header `X-Robots-Tag` | critical |
| `seo.hreflang` | hay hreflang pero sin autorreferencia, o códigos inválidos; `na` si no hay | minor |
| `seo.https` | la URL final no es https | critical |
| `seo.http.redirect` | `http://` no redirige a `https://` | important |

**Compartir / Schema** (`social.*`)

| id | falla si | severidad |
|---|---|---|
| `social.og.title` | falta `og:title` | important |
| `social.og.description` | falta `og:description` | important |
| `social.og.image` | falta, es relativa, o el HEAD no devuelve 2xx | critical |
| `social.twitter.card` | falta `twitter:card` | minor |
| `social.jsonld` | no hay JSON-LD, no parsea, o no tiene `@type` | important |
| `social.favicon` | no hay `<link rel="icon">` ni `/favicon.ico` | minor |

**Rendimiento** (`perf.*`) — derivados de la respuesta de PSI, no son funciones puras
sobre `PageContext` sino un mapeo en `checks/vitals.ts`:

score de PageSpeed, LCP, CLS, INP (lab de Lighthouse + campo CrUX si hay datos),
peso transferido, recursos que bloquean el render, imágenes sin optimizar.

Umbrales: los oficiales de Google (LCP ≤2.5s bien / ≤4s a mejorar; CLS ≤0.1 / ≤0.25;
INP ≤200ms / ≤500ms).

### PageSpeed Insights

`GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed`
con `strategy=mobile`, `category=performance`, y `key=PAGESPEED_API_KEY` si está.
Anda sin key con cuota baja; la key es gratis y conviene en producción.

Timeout 45 s. Si falla, el reporte se muestra igual sin la sección de rendimiento
(`vitalsError` poblado) — nunca rompe la página.

## Puntaje

Tres puntajes por categoría, **sin número global**:

- **Rendimiento**: el score de Google tal cual, verificable por cualquiera.
- **SEO técnico** y **Compartir**: porcentaje de chequeos pasados, con el conteo a la
  vista (`8/11`). `warn` cuenta como medio punto; `na` se excluye del denominador.

Un compuesto global sería más compartible pero es inventado: en cuanto no coincide
con PageSpeed, se cae la credibilidad — que es exactamente el activo que la
herramienta existe para construir.

## Reporte — estructura de página

```
┌─ URL auditada · fecha · 3 puntajes
├─ LO MÁS URGENTE — top 3 hallazgos por severidad, con el costo en lenguaje de negocio
├─ [CTA contextual]
├─ Detalle por categoría — cada hallazgo con evidencia real del sitio
├─ Preview del link compartido (cómo se ve su OG actual en WhatsApp/LinkedIn)
├─ [CTA de cierre]
└─ Copiar link del reporte
```

Orden de los hallazgos: `fail` antes que `warn` antes que `pass`; dentro de cada uno,
por severidad. Los `pass` van colapsados — sirven de prueba de rigor sin ocupar la
pantalla.

El **preview de OG** es barato de construir y es lo más compartible del reporte:
muchos sitios se ven rotos ahí y su dueño nunca lo vio.

Meta: `noindex, follow` en `/r/<id>`. `follow` para que el link al sitio auditado
transmita señal, `noindex` para no llenar el índice de Google de páginas generadas.

## Conversión

Los CTA llevan a `/#contacto?ref=audit&id=<id>` con el mensaje del form **pre-llenado**
con los hallazgos principales y la URL auditada.

`POST /api/contact` acepta un campo opcional `auditId`; si viene, el mail incluye el
link al reporte. El lead llega diagnosticado: sabés qué le pasa al sitio antes de
responder.

Tracking GA4, consistente con la convención existente (`cta_location`, `cta_label`):
`audit_started`, `audit_completed`, `audit_cta_click`.

## i18n

El copy **no vive en el chequeo**. En `src/i18n/{es,en}.ts`, bajo `audit`:

```ts
audit: {
  // ...copy de la landing y del reporte...
  checks: {
    "seo.title.length": {
      name: "Largo del título",
      why: "…por qué le importa al negocio…",
      found: "El título tiene {actual} caracteres; el máximo recomendado es {max}.",
      fix: "…qué hacer…",
    },
    // …una entrada por chequeo…
  },
}
```

Interpolación simple `{clave}` sobre `evidence`. El motor no sabe de idiomas; sumar
un idioma es solo copy.

## Landing `/auditoria`

No puede ser solo un input — necesita contenido real debajo para rankear: qué revisa
(las tres categorías desplegadas), qué significa cada métrica, FAQ.

JSON-LD `WebApplication` + `FAQPage`. Queries objetivo: "auditoría web gratis",
"analizar mi sitio web", "test SEO gratis", "por qué mi web carga lento".

## Archivos

```
src/lib/audit/
  safeFetch.ts          · validación de URL + fetch defendido
  parse.ts              · HTML → PageContext
  registry.ts           · catálogo de chequeos
  checks/seo.ts
  checks/social.ts
  checks/vitals.ts      · llamada a PSI + mapeo
  store.ts              · persistencia JSON + índice de caché + TTL
  rateLimit.ts
  score.ts              · agregación de puntajes
src/pages/api/audit.ts
src/pages/api/audit/[id]/vitals.ts
src/pages/auditoria/index.astro
src/pages/auditoria/r/[id].astro
src/pages/en/audit/index.astro
src/pages/en/audit/r/[id].astro
src/components/audit/
  UrlForm.astro
  ScoreCards.astro
  FindingList.astro
  FindingItem.astro
  SharePreview.astro
```

Las páginas `/en/*` reusan los mismos componentes; solo cambia el diccionario.

## Testing

**`node --test`** (cero dependencias nuevas):

- Cada chequeo contra fixtures de HTML — casos pass, warn, fail y na
- `score.ts` — agregación, exclusión de `na`, `warn` como medio punto
- Normalización de URL
- **`safeFetch`**: rechaza `localhost`, `127.0.0.1`, `10.x`, `192.168.x`,
  `169.254.169.254`, `file://`, credenciales en la URL, y **redirección hacia una IP
  privada**. Este es el módulo crítico.

**Playwright e2e**:

- El form valida y rechaza input vacío / URL inválida
- Auditoría real contra dishape.dev → reporte renderiza con las tres secciones
- `/auditoria` no lo captura `[servicio].astro`
- Ambos idiomas responden 200 y muestran su copy
- `/auditoria/r/<id>` emite `noindex`
- Rate limit devuelve 429 al superar el cupo
- `/auditoria/r/<id>` inexistente devuelve 404

## Dependencias y configuración

Nueva dependencia: **`node-html-parser`** (~50 KB, sin deps transitivas). Regex sobre
HTML arbitrario se rompe con el primer sitio raro, y estos chequeos tienen que ser
confiables: el reporte es la demostración de competencia técnica.

Nuevas variables de entorno:

| var | requerida | descripción |
|---|---|---|
| `AUDIT_DATA_DIR` | sí | ruta absoluta fuera del release, p. ej. `/var/lib/dishape/audits` |
| `PAGESPEED_API_KEY` | no | cuota más alta en PSI; sin ella funciona con cuota baja |

Documentar ambas en `.env.example` y `SETUP.md`.

## Fuera de alcance (MVP)

- Accesibilidad (necesita render real para contraste)
- Exportación a PDF
- Auditoría de múltiples páginas por sitio (solo la URL provista)
- Cuentas de usuario o historial
- Comparación contra competidores
