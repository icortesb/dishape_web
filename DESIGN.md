---
name: dishape
description: A typographic canvas; borderless white artboards on a grey table, Geist at weight 500, one flat orange shape per sheet, light and dark by system preference.
colors:
  base: "#ececec"
  card: "#ffffff"
  card-hover: "#fafafa"
  elevated: "#f2f2f2"
  line: "#e3e3e3"
  ink: "#111111"
  muted: "#555555"
  faint: "#6b6b6b"
  accent: "#c2410c"
  cube-top: "#ff8a4c"
  cube-left: "#ff5b1f"
  cube-right: "#c93d0a"
  danger: "#b42318"
  warn: "#a15c07"
  base-dark: "#0c0c0c"
  card-dark: "#161616"
  card-hover-dark: "#1b1b1b"
  elevated-dark: "#202020"
  line-dark: "#262626"
  ink-dark: "#ededed"
  muted-dark: "#a6a6a6"
  faint-dark: "#8c8c8c"
  accent-dark: "#ff8a4c"
  cube-top-dark: "#ff6a2b"
  cube-left-dark: "#d9480f"
  cube-right-dark: "#a3360b"
  danger-dark: "#f87171"
  warn-dark: "#fbbf24"
typography:
  display:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.1rem, 5.4vw, 4.4rem)"
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  statement:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.6rem, 3.6vw, 3rem)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3.2vw, 2.5rem)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  numeral:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.05em"
    fontFeature: "tnum"
  title:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.375
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  body-small:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.625
  article:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  board-label:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
  data:
    fontFamily: "Geist Mono Variable, ui-monospace, SFMono-Regular, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  tick: "2px"
  board: "4px"
  field: "6px"
  pill: "999px"
spacing:
  shell-gutter: "16px"
  shell-gutter-md: "32px"
  board-pad: "24px"
  board-pad-sm: "40px"
  board-pad-lg: "56px"
  board-gap: "64px"
  row: "20px"
components:
  artboard:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.board}"
    padding: "56px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "15px 22px"
  button-small:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.pill}"
    padding: "10px 15px"
  link:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  field:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "13px 14px"
  field-focus:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
  nav-link:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
  nav-link-hover:
    textColor: "{colors.ink}"
  status-chip-fail:
    textColor: "{colors.danger}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  status-chip-warn:
    textColor: "{colors.warn}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
---

# Design System: dishape

## Overview

**Creative North Star: "The Artboard Table"**

The site is a grey work table with white sheets laid on it. Each section is one artboard: a borderless sheet with a barely-there 4px corner, no shadow, no outline. Type carries the page: Geist at weight 500 with tight negative tracking, set large and allowed to step in and out across lines like a sentence being spoken. Each sheet gets exactly one colour moment, a flat geometric shape in the brand's orange tones, usually oversized and cropped by the sheet's edge. Everything else is ink on white, or white on graphite in dark mode.

The world follows the visitor's system preference: a light table (#ececec under white) and a dark table (#0c0c0c under graphite #161616), with the orange tones re-tuned per mode. Density is calm: sheets are padded generously (56px at desktop), separated by 64px of bare canvas, held to a 1240px shell. Lists and data read as ruled text, hairline above each row, never as tiles or icon cards.

The mark is a lowercase "d" built from two flat shapes, a disc and a rounded bar, with its counter cut as a true transparent hole so it sits on any ground. The same construction, oversized, is the hero artboard's shape.

**Key Characteristics:**
- Grey canvas, borderless artboards (4px radius), depth by tone only
- Geist Variable at 500 for every heading, tracking between -0.015em and -0.05em
- One flat orange shape per artboard, cropped by the sheet edge
- Ink pill buttons, underlined text links, soft-fill fields
- Tick ruler as position indicator (page scroll in the hero, reel scroll under services)
- Light and dark by `prefers-color-scheme`, no toggle

## Colors

Achromatic ink-and-paper neutrals with a single family of flat oranges reserved for shapes, the mark and a few small signals.

### Primary
- **Ember** (accent): the only orange that touches text. Wordmark period, focus outline (2px, 3px offset), caret colour, article link underlines, the availability dots in the hero and contact. Light #c2410c holds about 5:1 on white; dark switches to the brighter ember from `accent-dark`. `accent-light` is an alias of the same value per mode.
- **Brand shape tones** (cube-top, cube-left, cube-right): the token names say "cube" for continuity; their role is the flat shape palette. Top is the light, airy tone (large discs); left is the vivid core (the mark's disc, mid shapes); right is the deep tone (the mark's bar, squares, pills). In light they are vivid so ink reads across them; in dark they are deeper (`*-dark`) so white type reads across them. Used only as solid fills on shapes and the logo, never on text or UI chrome.

### Neutral
- **Table Grey** (base): the canvas behind everything, the sticky nav at 85% with blur, the footer.
- **Sheet** (card): every artboard, the reel buttons, the focused field, and the text colour of ink pill buttons.
- **Sheet Hover** (card-hover): reserved hover tint for sheets.
- **Soft Fill** (elevated): resting field fill, inline code, the neutral "n/a" status chip, the secondary consent button.
- **Hairline** (line): rule above list rows, process step lines, field hover border.
- **Ink** (ink): headings, primary text, pill button fill, field focus border, selection background.
- **Graphite Text** (muted): body copy, intros, nav links at rest.
- **Pencil** (faint): artboard labels, footer column heads, data labels, ruler ticks (at 50%), placeholders.

### Semantic
- **Danger** and **Warn**: audit-only. Score numerals, failing and warning status chips (border at 30%, fill at 10%), error messages. They do not appear on the marketing surfaces.

### Named Rules
**The One Shape Rule.** Each artboard carries one flat shape in a brand shape tone and no other colour moment. Shapes are solid fills (or one thick ring), never gradients, never outlined.
**The Ink Not Orange Rule.** Actions are ink. Orange never fills a button or colours body copy; it is shape, mark and focus.

## Typography

**Display Font:** Geist Variable (ui-sans-serif, system-ui fallback)
**Body Font:** Geist Variable
**Data Font:** Geist Mono Variable (ui-monospace fallback)

**Character:** One neo-grotesk doing everything, made expressive by size and tracking rather than weight. Medium (500) is the loudest weight; tracking tightens as size grows.

### Hierarchy
- **Display** (500, clamp 2.1–4.4rem, 1.04, -0.04em): the hero sentence only, set as staggered lines with indents of 0 / 1.1 / 0 / 1.1 / 2.2em (0.45em multiplier on mobile).
- **Statement** (500, clamp 1.6–3rem, 1.05, -0.04em): items read as one staggered statement, title large and indented in steps, explanation small beside it in a 17rem column. A smaller variant (clamp 1.2–1.6rem) sits under section headings.
- **Headline** (500, clamp 1.75–2.5rem, 1.08, -0.035em): section h2, max 42rem wide.
- **Numeral** (500, 2.75rem, -0.05em, tabular): process step numbers, followed by a hairline.
- **Title** (500, 17px, -0.015em): list and card h3.
- **Body** (400, 15px, 1.6): intros and copy in muted, capped near 28–36rem. Small body 14px for list explanations.
- **Article** (400, 1.0625rem, 1.75): long-form prose; article h2 1.5rem/500/-0.02em.
- **Label** (400, 13px): nav links, form labels, footer links and column heads. 12px for data-row captions.
- **Artboard label** (400, 11px, faint): a sheet's name or back-link, set on the canvas just above the sheet.
- **Data** (Geist Mono, 11px, faint): source citations under figures.

### Named Rules
**The Medium Ceiling Rule.** Headings top out at 500. Hierarchy comes from size and tracking, not bold.
**The Mono Means Data Rule.** Geist Mono is for sources, figures and code only; never headings, labels or prose.

## Layout

Content sits in a shell (max 1240px, 16px gutters, 32px from 768px). Each section is an artboard inside the shell; artboards stack with 64px of canvas between them, and the footer sits 96px below the last. Artboard padding steps 24 / 40 / 56px across sm and lg. Inside a sheet, two-column splits are asymmetric (1.4fr/1fr, 1fr/1.4fr, 1.5fr/1fr) with 80px gaps at lg. Rows are ruled: a hairline on top, 20–24px vertical padding, 40px column gap.

The hero is one wide artboard at min(78vh, 720px) tall from 640px, content bottom-aligned, the mark cropped off the right and bottom edges; on mobile the mark sits top-right and the sentence is pushed below it. Services break the shell: a horizontal snap reel of 19–21rem × 26rem sheets with side padding aligned to the shell edge, scrollbar hidden, stepped by round arrow buttons around a tick ruler. The nav shows seven links from 1024px; below that, wordmark, language switch and the booking pill.

Breakpoints: 640px, 768px, 1024px.

## Elevation & Depth

Flat. Depth is the tone step from canvas to sheet and nothing else: no borders on artboards, no shadows at rest or on hover. The sticky nav uses the canvas at 85% with a medium backdrop blur. The only shadow in the build is on the floating consent banner (`0 8px 30px rgb(0 0 0 / 0.12)`), a layer that floats over content.

### Named Rules
**The Tone Is The Edge Rule.** A sheet is defined by its fill against the canvas. Don't add a border or shadow to make it read.

## Shapes

Corners are nearly square on surfaces (4px artboards, 6px fields, 2px ruler window) and fully round on anything you press (pill buttons, reel arrows, the WhatsApp button, status chips). The brand shapes are pure geometry: circles, squares, half-discs, quarter-discs, tall pills, one thick ring, all solid, all in brand shape tones, oversized and partly cropped by `overflow: hidden` on the sheet. The logo "d" is a disc (r 32) plus a rounded bar (20×90, rx 10) with a masked transparent counter (r 13), disc in cube-left and bar in cube-right.

## Components

### Buttons
Quiet, solid, pressable.
- **Shape:** full pill (999px).
- **Primary:** ink fill, sheet-coloured text, 500 weight, 15px, 15px × 22px padding.
- **Small:** 13px, 10px × 15px (nav booking, consent).
- **Hover / Active:** lifts 1px on hover, scales to 0.98 on press, eased with expo-out (0.25s). Disabled at 50% opacity.
- **Floating WhatsApp:** the same ink pill, 48px tall, fixed bottom-right, icon plus label from 640px.

### Text Links
- Ink text with a 1px underline at 25% ink, 4px offset; the underline goes full ink on hover. Used as the secondary action beside a pill and for inline cross-links. Inside articles the underline is ember and the text turns ember on hover.

### Cards / Containers (Artboards)
- **Corner Style:** 4px.
- **Background:** sheet (white / graphite).
- **Shadow Strategy:** none.
- **Border:** none.
- **Internal Padding:** 24 / 40 / 56px; compact audit sheets use 20px.
- **Label:** optional 11px faint name or back-link on the canvas above.

### Inputs / Fields
- **Style:** soft fill (elevated), 1px transparent border, 6px radius, 15px text, faint placeholder, 13px muted label above.
- **Hover:** border shows hairline.
- **Focus:** fill becomes sheet, border becomes ink; no glow. Caret is ember.
- **Error:** danger-coloured message text below.

### Navigation
- Sticky, canvas at 85% with blur, 64px tall. Mark (24px) plus wordmark left; 13px muted links turning ink on hover; language switch as a plain 13px text link; small ink pill at right.

### Ruled List
- Title (17px/500) over muted 14px body, hairline above each row, in a 2- or 3-column grid. No icons drawn. Data lists use a 11rem faint term column beside a 17px ink value. Contact rows add a faint arrow-up-right that nudges diagonally and darkens on hover.

### Tick Ruler (signature)
- A row of 1px × 10px ticks in faint at 50%, with a 24px × 16px window (2px radius, ink at 60% border) that slides to show position: page scroll above the hero artboard, reel scroll under the services reel.

### Staggered Lines (signature)
- Hero and statement lines indent in em steps so a sentence reads as a staggered block; entrance is a 14px rise from 6px blur over 0.9s expo-out with 60ms steps, CSS-only for the hero so first paint never waits. The hero mark's disc grows in, then the bar rises. All entrance motion sits behind `prefers-reduced-motion: no-preference`.

### Status Chip (audit)
- Pill, 12px/500, 1px border at 30% of the status colour over a 10% fill: danger for fail, warn for warning, soft fill and faint text for n/a.

## Do's and Don'ts

### Do:
- **Do** put each section on its own borderless artboard (4px radius) over the grey canvas, 64px apart.
- **Do** give each artboard exactly one flat shape in a brand shape tone, oversized and cropped by the sheet edge.
- **Do** set every heading in Geist at 500 with negative tracking that tightens as size grows (-0.015em at 17px to -0.04em at display).
- **Do** use the ink pill for the action and an underlined text link for the alternative beside it.
- **Do** list content as ruled text rows with a hairline above each.
- **Do** tune any new shape tone for both modes: vivid in light so ink reads on it, deeper in dark so white reads on it.
- **Do** keep numerals limited to sequences that are real sequences (the process steps) and to data.

### Don't:
- **Don't** put an eyebrow, kicker or numbered label above a section heading; the heading stands alone, with only an optional artboard name on the canvas above the sheet.
- **Don't** add borders or shadows to artboards, or a second colour moment to a sheet.
- **Don't** fill buttons or colour body text with orange.
- **Don't** set headings bolder than 500.
- **Don't** use Geist Mono outside sources, figures and code.
- **Don't** draw icon tiles or icon-led card grids; icons are small Lucide line SVGs on links and controls only.
- **Don't** use danger or warn outside the audit tool.
