---
version: alpha
name: lights-out-league-design
description: A Formula 1 fantasy league app whose surfaces read as **broadcast timing-screen meets pit-wall telemetry**. The canvas is near-black (`#0A0A0A`) carrying a single brand voltage — Rosso Corsa (`#DA291C`) — used scarcely on primary actions, section icons, and the Grand Prix scoring category. Everything is a **translucent tile on dark**: `bg-accent-gray/40` with a hairline white border and a backdrop blur, never an opaque card. Type is **Exo 2**, and headings are the app's loudest signature — `font-black uppercase italic` with wide tracking, the visual register of a race broadcast lower-third. Every figure a reader compares vertically is rendered in tabular monospace numerals. Four scoring categories (Grand Prix red, Qualifying blue, Sprint yellow, Fastest Lap purple) carry fixed colors across every surface; that mapping is the system's single most load-bearing convention.

colors:
  primary: "#DA291C"
  canvas: "#0A0A0A"
  surface-card: "#2C2C2C"
  ink: "#FFFFFF"
  body: "#F5F5F5"
  muted: "#C0C0C0"
  on-primary: "#FFFFFF"
  category-gp: "#DA291C"
  category-quali: "var(--color-blue-500)"
  category-sprint: "var(--color-yellow-500)"
  category-fl: "var(--color-purple-500)"
  semantic-success: "var(--color-green-400)"
  semantic-warning: "var(--color-amber-400)"
  semantic-danger: "#DA291C"
  semantic-info: "var(--color-indigo-300)"
  hairline: "rgba(255,255,255,0.10)"
  hairline-hover: "rgba(255,255,255,0.25)"
  staging-badge: "#facc15"

typography:
  page-title:
    fontFamily: "'Exo 2', sans-serif"
    fontSize: "24px / 30px (md)"
    fontWeight: 900
    textTransform: uppercase
    fontStyle: italic
    letterSpacing: wider
  section-title:
    fontFamily: "'Exo 2', sans-serif"
    fontSize: "18px / 20px (md)"
    fontWeight: 900
    textTransform: uppercase
    fontStyle: italic
    letterSpacing: wide
  stat-value:
    fontFamily: "ui-monospace, tabular-nums"
    fontSize: "30px / 36px (md)"
    fontWeight: 900
    lineHeight: 1.0
  body-md:
    fontFamily: "'Exo 2', sans-serif"
    fontSize: 14px
    fontWeight: 400
  micro-label:
    fontFamily: "'Exo 2', sans-serif"
    fontSize: 10px
    fontWeight: 700
    textTransform: uppercase
    letterSpacing: wider
  chip:
    fontSize: "10px (sm) / 9px (xs)"
    fontWeight: 700
    textTransform: uppercase
    letterSpacing: wider
  numeric:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontVariantNumeric: tabular-nums

rounded:
  sm: 6px      # rounded-md — chips
  lg: 8px      # rounded-lg — buttons, inputs, textareas
  xl: 12px     # rounded-xl — every tile (dominant)
  full: 9999px # meters, icon plates, environment badge

spacing:
  tile-sm: 12px            # p-3
  tile-md: 16px / 20px     # p-4 md:p-5 — default
  tile-lg: 24px / 32px     # p-6 md:p-8
  gutter: 16px / 24px      # px-4 md:px-6
  container-max: 1280px    # max-w-7xl
  bottom-nav-clearance: 96px  # pb-24

components:
  tile:
    backgroundColor: "{colors.surface-card} @ 40%"
    border: "1px {colors.hairline}"
    rounded: "{rounded.xl}"
    backdropFilter: blur
    padding: "{spacing.tile-md}"
  stat-tile:
    typography: "{typography.stat-value}"
    label: "{typography.micro-label}"
  data-table-header:
    backgroundColor: "{colors.canvas} @ 95%"
    typography: "{typography.micro-label}"
    padding: "12px 10px"
    position: sticky
  chip:
    rounded: "{rounded.sm}"
    typography: "{typography.chip}"
    padding: "8px 4px (sm) / 6px 2px (xs)"
  meter:
    track: "{colors.canvas} @ 80%"
    rounded: "{rounded.full}"
    height: "4px (sm) / 6px (md)"
---

# Lights Out League — DESIGN.md

> **This file is the narrative layer, not a source of truth for values.**
> Hex values live in [`styles/theme.css`](styles/theme.css) (`@theme` block) and class recipes live in
> [`components/ui/tokens.ts`](components/ui/tokens.ts). This document explains *why* and *when*.
> **Never change a color here and expect it to take effect — change it in `theme.css`.**
> If a value here disagrees with those two files, those two files are right and this file is stale.

## Overview

The app is a Formula 1 fantasy league: players submit picks per session, an admin enters results, and a
scoring engine ranks everyone. Every screen is therefore some flavor of **standings, timing, or entry
form**. The design language borrows from race broadcast graphics — dark canvas, one hot accent, dense
tabular data, aggressive uppercase-italic headings — rather than from generic SaaS dashboards.

Three rules carry most of the weight:

1. **One accent.** Rosso Corsa `#DA291C` is the only saturated brand color. It marks primary actions,
   section icons, danger states, and the Grand Prix category. Everything else is white at an opacity.
2. **Everything is a translucent tile.** No opaque cards, no drop-shadow tiers. Depth comes from
   `bg-accent-gray/40` + `backdrop-blur` + a hairline border over a near-black canvas.
3. **Comparable numbers are monospace.** Any figure a reader scans down a column uses `NUMERIC`.

## Color

### Themes

The app ships two themes. **Dark is the default and the design's home** — every value in this
document is its dark value, and an absent preference resolves to dark, never to the OS setting.
Light is opt-in, per device, from the sun/moon toggle in the app header (mobile), the profile
page header (desktop), or the sliding switch under the last item in the desktop SideNav.

The mechanism is one indirection. Tailwind v4 compiles `bg-carbon-black` to
`background-color: var(--color-carbon-black)`, so `styles/theme.css` redefines the brand tokens
under `:root[data-theme="light"]` and every token class in the app follows without a component
change.

**The token names describe roles, not literal colors.** This is a deliberate compromise: honest
names (`--color-ink`, `--color-canvas`) would have meant rewriting ~1,800 usages. Read them as:

| Token | Role | Dark | Light |
|---|---|---|---|
| `--color-carbon-black` | canvas | `#0A0A0A` | `#F7F7F5` |
| `--color-accent-gray` | surface (always `/40`) | `#2C2C2C` | `#D9D9D4` |
| `--color-pure-white` | ink, and hairlines at low opacity | `#FFFFFF` | `#0A0A0A` |
| `--color-ghost-white` | body copy | `#F5F5F5` | `#1C1C1C` |
| `--color-highlight-silver` | muted / micro-labels | `#C0C0C0` | `#56565A` |
| `--color-primary-red` | brand, CTAs, danger | `#DA291C` | `#C41E12` |

So in light mode `text-pure-white` renders near-black. That reads wrong and is worth knowing
before you edit anything.

Three consequences you must design around:

1. **The light canvas is `#F7F7F5`, not white**, so the surface token can sit *darker* than it.
   `bg-accent-gray/40` needs room in both directions to still read as a lifted surface.
2. **`--color-on-primary` (`#FFFFFF`) is the one ink that never flips.** A red, green or blue
   button is the same color in both themes, so its label stays white. Use it — not
   `text-pure-white` — for any text on a saturated fill, or it will render black-on-red.
3. **A subtree can opt out entirely** with `data-theme="dark"` on its root element, which
   re-declares the dark palette for everything inside it. `RedFlagScreen`, `EasterEgg` and
   `Toast` use this: they are full-bleed set pieces and overlays where dark is correct in any
   theme. A white red-flag screen would be wrong.

Light-mode values are chosen to clear WCAG AA (4.5:1) against the light canvas, which is why
several sit a step or two darker than their dark-mode counterparts — see the notes under
Scoring Categories and Semantic Tones.

### Brand Surfaces

| Token | Value | Use |
|---|---|---|
| `--color-carbon-black` | `#0A0A0A` | Page canvas, sticky table headers, meter tracks |
| `--color-accent-gray` | `#2C2C2C` | Tile fill (always at `/40`, never solid) |
| `--color-primary-red` | `#DA291C` | Primary CTAs, section icons, danger, GP category, focus ring |
| `--color-pure-white` | `#FFFFFF` | Headings, stat values, hairline borders at low opacity |
| `--color-ghost-white` | `#F5F5F5` | Table body text, long-form copy |
| `--color-highlight-silver` | `#C0C0C0` | Micro-labels, secondary/meta text, neutral tone |

The canvas is **near-black, not pure black** (`#0A0A0A`). Pure black is reserved for the checkered-flag
texture. The tile fill is **never opaque** — `bg-accent-gray/40` over the canvas is what produces the
app's characteristic smoked-glass surface.

Values above are the dark theme. See **Themes** for what each token becomes on light.

There is also an elevation ramp (`--color-elev-0`..`-3`) and two neutral fallbacks
(`--color-neutral-fill` / `-edge`, for a constructor whose brand color is missing). These exist so
nothing has to hardcode a hex; the ramp inverts on light, where elevation reads as *lighter*.

### Scoring Categories — the load-bearing convention

Four categories carry fixed colors on **every** surface that mentions them: the leaderboard, Scoring
Rules cards, Insights superlatives, the Schedule, and admin Scoring Settings.

| Category | Token | Dark | Light | Label |
|---|---|---|---|---|
| Grand Prix | `--color-category-gp` | Rosso Corsa `#DA291C` | `#C41E12` | "Grand Prix" |
| Qualifying | `--color-category-quali` | `blue-500` | `blue-600` `#2563EB` | "Qualifying" |
| Sprint | `--color-category-sprint` | `yellow-500` | `yellow-700` `#A16207` | "Sprint" |
| Fastest Lap | `--color-category-fl` | `purple-500` | `purple-600` `#9333EA` | "Fastest Lap" |

**On light, these shift luminance — never hue.** The convention this section protects is the
*mapping* (GP red, Quali blue, Sprint yellow, FL purple), and that is unchanged. But `yellow-500`
reaches only 1.9:1 against the light canvas and `blue-500` 3.3:1; text in them would be unreadable.
Each light value is the lightest step of the same hue that clears AA, which is why sprint drops two
steps rather than one — `yellow-600` still only reaches 2.7:1.

**Always consume these through `CATEGORY_THEME` in `tokens.ts`**, which supplies matched `text`,
`border`, `bg`, `ring`, `from`, and `css` variants plus the canonical label. Do not hand-write
`text-blue-500` for a qualifying surface — that is exactly how the mapping drifts, and since
theming it is also how a surface misses the light-mode value entirely. `CATEGORY_THEME` itself
named Tailwind steps directly until the theme work; the tokens above were consumed by nothing.

> **Known trap, already hit once:** use `CATEGORY_THEME[x].css` (a CSS value) when painting a border,
> not `.border` (a class). `TILE_BASE` already sets a border-color class, and two competing classes tie —
> whichever Tailwind emits last wins, which silently rendered the red and blue accents gray.

### Semantic Tones

Consumed through `TONE_THEME` in `tokens.ts`. Each tone is a matched triple of text / border / bg.

| Tone | Text (dark) | Text (light) | Meaning in this app |
|---|---|---|---|
| `neutral` | `highlight-silver` | flips with the token | Default chip, inert metadata |
| `success` | `green-400` | `green-700` | Dues paid, picks submitted, session complete |
| `warning` | `amber-400` | `amber-700` | Sprint weekend, deadline approaching |
| `danger` | `primary-red` | flips with the token | Locked, error, penalty applied |
| `info` | `indigo-300` | `indigo-600` | Advisory notices |

The text colors go through `--color-tone-*` so they can drop steps on light: `green-400` and
`amber-400` were picked against near-black and reach about 1.5:1 on the light canvas. The `/40`
borders and `/10` fills stay as Tailwind steps — at those opacities they are tints and read on
either canvas.

### Constructor Colors

Team colors are **data, not tokens** — they come from the Firestore constructor row, falling back to the
static `CONSTRUCTORS` grid via `teamColor()`. Because they arrive as hex at runtime, tint them with
`withAlpha(hex, a)` rather than Tailwind opacity utilities. Convention in `Chip` and `Tile`: border at
`0.5` alpha, background at `0.12`.

## Typography

**Exo 2** (Google Fonts, weights 400 / 600 / 700 / 900) is the only display face — a squarish techno
sans that reads as motorsport without being a novelty font. Numerals switch to the system monospace
stack via `NUMERIC`.

### The heading signature

Both heading levels are `font-black uppercase italic` with wide tracking. This is the app's most
recognizable typographic move and should not be softened:

- **Page title** (`PageHeader`) — `text-2xl md:text-3xl font-black uppercase italic tracking-wider text-pure-white`
- **Section title** (`SectionHeader`) — `text-lg md:text-xl font-black uppercase italic tracking-wide text-pure-white`

### The micro-label

A single recipe covers every small label — stat tile captions, table headers, chips, meter labels:

```
text-[10px] font-bold uppercase tracking-wider text-highlight-silver
```

It appears in `StatTile`, `DataTable`, `Meter`, and `Chip` independently. Reuse it verbatim.

### Numerals

`NUMERIC` (`font-mono tabular-nums`) is **mandatory** for any figure a reader compares down a column:
points, positions, gaps, dues, percentages, countdowns. Tabular numerals keep digits from shifting
column width row-to-row — the whole reason a timing screen is legible. Prose numbers ("Round 4") stay
in Exo 2.

## Layout

### Container

`PageShell` is the only page wrapper: `w-full max-w-7xl mx-auto px-4 md:px-6`.

- **Default mode** adds `pb-24` — clearance for the mobile bottom nav.
- **`locked` mode** (`flex flex-col h-full min-h-0 overflow-hidden`) makes the page fill the viewport and
  moves scrolling *inside* a child `DataTable`. Use it for standings-style screens where the header
  should stay put and the table scrolls under it.

### Spacing

Tile padding is a named four-step scale in `Tile` — do not hand-roll padding on a tile:

| `padding` | Classes | Use |
|---|---|---|
| `none` | — | Tile wraps a table or media edge-to-edge |
| `sm` | `p-3` | Dense list rows |
| `md` | `p-4 md:p-5` | **Default** |
| `lg` | `p-6 md:p-8` | Hero / feature tiles |

### Safe area

`.pb-safe` (`env(safe-area-inset-bottom)`) exists for the mobile bottom nav. This is an installable PWA;
anything fixed to the bottom needs it.

## Elevation & Depth

There is **no drop-shadow ladder**. Depth is translucency + blur + hairline borders.

| Level | Treatment | Use |
|---|---|---|
| Canvas | `carbon-black` `#0A0A0A` | Page background |
| Tile | `bg-accent-gray/40` + `backdrop-blur-sm` + 1px `white/10` | Every card |
| Tile (hover) | border → `white/25`, bg → `accent-gray/60`, `active:scale-[0.99]` | Interactive tiles only |
| Accent edge | `border-l-4` in the category/team color | Categorized tiles |
| Sticky header | `bg-carbon-black/95` + `backdrop-blur-sm` | `DataTable` thead |
| Glow | `shadow-[0_0_30px_rgba(218,41,28,0.18)]` | Rare — a single hero/winner tile |

The two canonical recipes live in `tokens.ts` as `TILE_BASE` and `TILE_INTERACTIVE`. Compose them via the
`Tile` component rather than re-typing the class list.

### Textures

Three decorative treatments in [`styles/base.css`](styles/base.css):

- **`.bg-carbon-fiber`** — 20px 45° weave on `#111`. Modal and drawer backgrounds.
- **`.bg-checkered-flag`** — 80px checks, `#e0e0e0` / `#050505`. Race-completion and celebration moments only.
- **`.sheen-sweep`** — a skewed white gradient that sweeps across on hover or via `.animate-flare`.

## Shapes

| Token | Value | Use |
|---|---|---|
| `rounded-md` | 6px | Chips |
| `rounded-lg` | 8px | Buttons, inputs, textareas |
| `rounded-xl` | 12px | **Every tile — the dominant radius** |
| `rounded-full` | 9999px | Meter tracks, icon plates, environment badge |

Unlike Ferrari's sharp-cornered marketing surfaces, this is a **soft-cornered product UI**. `rounded-xl`
on tiles is the default; do not introduce sharp 0px cards.

## Components

All primitives live in [`components/ui/`](components/ui/) and re-export from `index.ts`. **Check that
directory before building anything new** — 17 primitives already exist.

### `Tile`
The universal surface. Props: `padding`, `accent` (a `Category` key *or* a hex team color), `accentEdge`
(renders `border-l-4`), `glow`, `onClick` (adds `TILE_INTERACTIVE`).

### `StatTile`
A `Tile` plus the standard metric layout: micro-label + optional icon on top, then value in
`text-3xl md:text-4xl font-black leading-none` with `NUMERIC`, optional unit / secondary / delta /
sparkline beneath. Delta colors itself — `green-400` up, `primary-red` down, `highlight-silver` flat.
**Use this for any single headline number.**

### `DataTable`
The standings/timing workhorse. Sticky `thead` at `bg-carbon-black/95 backdrop-blur-sm`; header cells
`px-3 py-2.5` in the micro-label recipe with a `border-b border-pure-white/10`; body cells
`px-3 py-2.5 text-sm text-ghost-white`. Pair with `PageShell locked` so the table scrolls, not the page.

### `Chip`
Small uppercase status pill, `rounded-md`. Two sizes: `sm` (`text-[10px] px-2 py-1`) and `xs`
(`text-[9px] px-1.5 py-0.5`). Takes either a `tone` (from `TONE_THEME`) or an explicit hex `color` for
constructor branding — the hex path applies border at `0.5` and background at `0.12` alpha.

### `Meter`
Thin progress bar. Track `bg-carbon-black/80 rounded-full`, `h-1` (sm) or `h-1.5` (md). Label and value
in the micro-label recipe. Turns `primary-red` when exhausted.

### `PageHeader` / `SectionHeader`
The two heading levels. `PageHeader` centers a title with an optional icon in a red plate
(`p-2 bg-primary-red/10 rounded-full border border-primary-red/20` + soft red glow) and left/right slots.
`SectionHeader` is a left-aligned row with a `primary-red` icon and an optional action on the right.

### Others
`Banner`, `BrandMark`, `Countdown`, `Drawer`, `EmptyState`, `EventSelector`, `Modal`, `SegmentedControl`,
`Sheet`, `PageShell`.

### Note on buttons
There is **no `Button` primitive** — buttons are written inline. The recurring recipe is
`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider`, filled `bg-primary-red text-pure-white`
for primary and `border border-pure-white/15 text-highlight-silver` for secondary, both with
`disabled:opacity-40`. Follow it exactly, or extract a real primitive — do not invent a third variant.

## Branding

League identity is centralized in [`brand.ts`](brand.ts) — `BRAND.name`, `shortName`, `wordmark`,
`tagline`, `themeColor`. **Never hardcode the league name in a component.** The name is currently a
placeholder pending a rename, which is the entire reason that module exists.

Two touchpoints deliberately sit outside it: email templates in `functions/index.js`, and the `LOL-`
invitation-code prefix in `services/firestoreService.ts`.

Note on terminology: *"lights out"* is the F1 term for a race start. Its use on the Schedule page and in
the easter egg's start sequence is domain vocabulary, **not branding**, and survives any rename.

## Motion

Animations are declared as `--animate-*` tokens in the `@theme` block of `theme.css`: `fade-in-up`,
`fade-in-down`, `drive-in`, `peek-up`, `flag-left` / `flag-right`, `spin-fast`, `spin-1s`, `flare-sweep`,
`victory-lap`, `wiggle`, `progress-fill`, plus `.animate-pulse-red` in `base.css`.

**All motion is decorative.** Nothing in this app communicates state *only* through movement, which is
what makes the global `prefers-reduced-motion` collapse in `base.css` safe. Keep it that way: if you add
an animation that carries meaning, add a static affordance alongside it.

## Accessibility

- **Focus:** a global `:focus-visible` fallback paints `2px solid var(--color-primary-red)` at 2px offset,
  so controls that only style `focus:*` are still keyboard-navigable. Don't remove outlines without a
  visible replacement.
- **Reduced motion:** globally handled (see above).
- **Contrast:** `highlight-silver` `#C0C0C0` on `carbon-black` passes comfortably; it is the floor. Do not
  go dimmer than it for text that must be read — use it, not an ad-hoc `white/40`.
- **Tabular numerals** are an accessibility feature here, not just an aesthetic one.

## Do's and Don'ts

### Do
- Compose surfaces from `Tile` / `StatTile` rather than re-typing `TILE_BASE`.
- Pull category colors from `CATEGORY_THEME` and tones from `TONE_THEME`.
- Apply `NUMERIC` to every figure compared down a column.
- Keep headings `font-black uppercase italic` with tracking.
- Use `CATEGORY_THEME[x].css` for border colors, never `.border`.
- Read the league name from `BRAND`.
- Use `Tile`'s named `padding` steps.
- Check `components/ui/index.ts` before writing a new primitive.

### Don't
- Don't introduce a second saturated brand color. Rosso Corsa is the only voltage.
- Don't make tiles opaque or add a drop-shadow ladder — translucency plus hairline borders *is* the depth.
- Don't use pure black as a surface; the canvas is `#0A0A0A`.
- Don't hand-write category colors like `text-blue-500` on a qualifying surface.
- Don't put proportional numerals in a comparison column.
- Don't add a hex value here without adding it to `theme.css` first.
- Don't hardcode the league name.
- Don't rely on animation alone to convey state.
- Don't invent a fourth button style.

## Responsive Behavior

The app is **mobile-first and installable as a PWA** — the mobile layout is the primary one, not a
fallback. Tailwind defaults apply; `md` (768px) is the only breakpoint most components use.

| Name | Width | Key changes |
|---|---|---|
| Mobile | < 768px | Bottom nav (needs `pb-24` + `.pb-safe`); `PageHeader` stacks; tile padding drops a step; page title 24px |
| Desktop | ≥ 768px | `PageHeader` becomes a 3-column grid; gutters 16→24px; tile padding steps up; page title 30px |
| Wide | > 1280px | Content caps at `max-w-7xl` |

`overscroll-behavior-y: none` is set on `body` to suppress iOS elastic bounce for a native feel.

## Environment Badge

`.environment-badge` pins a `#facc15` monospace pill to the bottom-right on non-production builds
(above the bottom nav on mobile, at the corner on desktop). It is `pointer-events: none` at `z-index:
10000`. If you see yellow in a screenshot, that build is **not production**.

## Known Gaps

- **No `Button` primitive.** The recipe is documented above but not enforced in code; extracting one is
  the obvious next consolidation.
- **Two token sources.** `theme.css` holds CSS custom properties; `tokens.ts` holds Tailwind class
  recipes. They agree today and are documented as agreeing, but nothing mechanically enforces it.
- **Category tokens are declared but under-consumed.** The `--color-category-*` variables exist in
  `theme.css`; several surfaces still reach for `CATEGORY_THEME` classes instead. Both routes are
  correct today.
- **Form validation states** beyond focus are not systematized.
- **Light mode does not exist** and is not planned. This is a dark-only product.
- **`components/showcase/`** (`BattleRadar`, `GapLadder`, `PerformanceRadar`, `CategoryBreakdown`) holds
  bespoke data-viz that predates this document and is not fully described by these tokens.
