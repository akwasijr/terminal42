# Carbon Design System Elements — Implementable Specification

> **Source packages:** `@carbon/layout@11.23.0`, `@carbon/motion@11.51.0`, `@carbon/themes@11.80.0`  
> **Doc URLs cited per section.** All token values taken directly from package source — not approximated.

---

## Table of Contents

1. [2x Grid](#1-2x-grid)
2. [Color Tokens & Themes](#2-color-tokens--themes)
3. [Motion](#3-motion)
4. [Typography](#4-typography)
5. [Spacing](#5-spacing)
6. [Gap-Analysis Appendix](#6-gap-analysis-appendix)

---

## 1. 2x Grid

> Source: https://carbondesignsystem.com/elements/2x-grid/overview/  
> Source: https://carbondesignsystem.com/elements/2x-grid/usage/

### 1.1 Fundamental Unit

| Concept | Value |
|---------|-------|
| Mini unit (base) | 8 px |
| Padding (all standard breakpoints) | 16 px (fixed) |
| Gutter (wide mode, default) | 32 px total (16 px each side) |
| Gutter (narrow mode) | 32 px — container hangs 16 px into gutter |
| Gutter (condensed mode) | Not stated as a specific pixel value on the overview page |
| Gutterless | 0 px between boxes; outer margin still applies |

### 1.2 Breakpoints

> Source: https://carbondesignsystem.com/elements/2x-grid/overview/#breakpoints

| Breakpoint name | Min width (px) | Min width (rem) | Columns | Col size (%) | Col size (px at min) | Padding | Margin |
|----------------|---------------|-----------------|---------|-------------|----------------------|---------|--------|
| Small          | 320           | 20              | 4       | 25%          | 80 px                | 16 px   | 0      |
| Medium         | 672           | 42              | 8       | 12.5%        | 80 px                | 16 px   | 16 px  |
| Large          | 1056          | 66              | 16      | 6.25%        | 64 px                | 16 px   | 16 px  |
| X-Large        | 1312          | 82              | 16      | 6.25%        | 80 px                | 16 px   | 16 px  |
| Max            | 1584          | 99              | 16      | 6.25%        | 96 px                | 16 px   | 24 px  |

**Key rules:**
- Below Max breakpoint: grid is fluid within columns, margins expand at Max+.
- Above Max breakpoint: margins expand (Editorial model) or columns are added in increments of 2 (High-density model).
- Column count doubles or halves at breakpoint boundaries (4→8→16).
- Padding is always **fixed** at 16 px regardless of breakpoint.

### 1.3 Gutter Modes

| Mode | Description | When to use |
|------|-------------|-------------|
| Wide (default) | 32 px gutter; container does not hang into gutter | Separate content pieces, form fields, text-heavy layouts |
| Narrow | Container hangs 16 px into gutter; type inside aligns with outer type | Most common in product; saves space; improves typographic alignment |
| Condensed | Tightest mode; 1 px borders required on tiles using `$border-subtle` | Dense dashboards, catalog tiles |

**Rule:** Fixed components with labels (inputs, dropdowns) **must** use wide gutter mode. Type never hangs into gutter in any mode.

### 1.4 Fixed Sizing Scale (Mini Unit Multiples)

| Sizing scale (px) | Mini units |
|------------------|------------|
| 8                | 1×         |
| 16               | 2×         |
| 24               | 3×         |
| 32               | 4×         |
| 48               | 6×         |
| 64               | 8×         |
| 80               | 10×        |

### 1.5 Fluid Grid Sizing

- Column width is the base unit for fluid grids.
- Box heights are multiples of column width.
- At breakpoint boundaries, fixed and fluid sizes align.

### 1.6 Aspect Ratios

**Approved aspect ratios:** `1:1`, `2:1`, `2:3`, `3:2`, `4:3`, `16:9`

### 1.7 Grid Influencers

UI elements that reshape the grid when present:

| Type | Behavior |
|------|----------|
| Flexible panel | Collapsed/expanded; expanded is fixed width; content grid condensed or pushed |
| Fixed panel | Static width; outside responsive grid |
| Floating panel | Floats over content; does not affect grid; must be dismissible |

### 1.8 Common UI Scaling Behaviors

| Element | Width | Height |
|---------|-------|--------|
| Header | Fluid (Grid) | Fixed (mini unit) |
| Toolbar | Fluid (Grid) | Fixed (mini unit) |
| Side Panel | Fixed | Fluid (Grid) |
| Menu | Fixed | Fluid (Content) |
| Content | Fixed | Fluid (Content) |
| Data Table | Fluid (Grid) | Fluid (Content) |

### 1.9 Style Models

| Model | Grid behavior | Use cases |
|-------|---------------|-----------|
| Editorial | Centered; margins expand above Max | Marketing pages, IBM.com |
| Product & Docs | Left-aligned; max width maintained | Product UI, documentation |
| High-density interface | Full-width; columns added in increments of 2 above Max | Complex product UIs, catalogs, data viz |

---

## 2. Color Tokens & Themes

> Source: https://carbondesignsystem.com/elements/color/overview/  
> Source: https://carbondesignsystem.com/elements/color/tokens/  
> Source: https://carbondesignsystem.com/elements/color/usage/  
> Source: `@carbon/themes@11.80.0/lib/index.js` (White, G10, G90, G100 exact hex values)

### 2.1 Theme System

| Theme | Background | Color scheme | Primary bg hex |
|-------|-----------|--------------|----------------|
| White | Global Background Light | light | `#ffffff` |
| Gray 10 (G10) | Global Background Light | light | `#f4f4f4` |
| Gray 90 (G90) | Global Background Dark | dark | `#262626` |
| Gray 100 (G100) | Global Background Dark | dark | `#161616` |

### 2.2 Layering Model Rules

**Light themes:**
- White theme: global bg = White → Layer 01 = Gray 10 → Layer 02 = White → Layer 03 = Gray 10
- Gray 10 theme: global bg = Gray 10 → Layer 01 = White → Layer 02 = Gray 10 → Layer 03 = White

**Dark themes:**
- Each added layer is one step lighter.
- Gray 90 theme: bg = Gray 90 (#262626) → Layer 01 = Gray 80 (#393939) → Layer 02 = Gray 70 (#525252) → Layer 03 = Gray 60 (#6f6f6f)
- Gray 100 theme: bg = Gray 100 (#161616) → Layer 01 = Gray 90 (#262626) → Layer 02 = Gray 80 (#393939) → Layer 03 = Gray 70 (#525252)

**Rule:** Never apply components darker than the background unless in high-contrast/inverse mode.

### 2.3 Layering Token Sets

| Set suffix | Used on layer | Example token |
|-----------|--------------|---------------|
| (none / -00) | Base / global background | `$background`, `$border-subtle-00` |
| -01 | First layer above background | `$layer-01`, `$field-01`, `$border-subtle-01` |
| -02 | Second layer | `$layer-02`, `$field-02`, `$border-subtle-02` |
| -03 | Third layer | `$layer-03`, `$field-03`, `$border-subtle-03` |

**Token selection rule:** All tokens used within a single component at the same layer level must be from the same set. Border tokens pair with their same number (e.g., `$border-subtle-01` pairs with `$field-01`).

**Contextual tokens:** Drop the number suffix (e.g., `$layer` instead of `$layer-01`). These auto-resolve based on nesting depth within the `<Layer>` component. Designers use numbered layering tokens in specs; developers may use contextual tokens for reusable components.

### 2.4 Interaction State Token Rules

| State | Token suffix | Color step rule |
|-------|-------------|-----------------|
| Hover | `-hover` | Half-step between two adjacent palette grades; lighter for dark values, darker for light values |
| Active | `-active` | Two full steps lighter (for values 100–70) or two full steps darker (for values 60–10) |
| Selected | `-selected` | One full step lighter (100–70) or one full step darker (60–10) |
| Focus | (none) | Use `$focus` token; 2 px border; 3:1 contrast min |
| Disabled | `-disabled` | De-emphasized; not subject to WCAG contrast; Gray family only |

### 2.5 Core Color Token Groups

Token groups and their applications:

| Group | Applied to |
|-------|-----------|
| Background | Page or primary backgrounds |
| Layer | Stacked backgrounds (layering tokens) |
| Field | Form and input backgrounds (layering tokens) |
| Border | Dividers, rules, borders (layering tokens) |
| Text | Type and type styles |
| Link | Standalone and inline links |
| Icon | Icons and pictograms |
| Support | Notifications and status indicators |
| Focus | Focus states |
| Skeleton | Skeleton loading states |

### 2.6 Background Tokens — All Four Themes

| Token (CSS/JS name) | Role | White | G10 | G90 | G100 |
|--------------------|------|-------|-----|-----|------|
| `background` | Global page background | `#ffffff` | `#f4f4f4` | `#262626` | `#161616` |
| `backgroundInverse` | Inverse/contrast bg | `#393939` | `#393939` | `#f4f4f4` | `#f4f4f4` |
| `backgroundBrand` | Brand-colored bg | `#0f62fe` | `#0f62fe` | `#0f62fe` | `#0f62fe` |
| `backgroundActive` | Active state bg | `rgba(141,141,141,0.5)` | `rgba(141,141,141,0.5)` | `rgba(141,141,141,0.4)` | `rgba(141,141,141,0.4)` |
| `backgroundHover` | Hover state bg | `rgba(141,141,141,0.12)` | `rgba(141,141,141,0.12)` | `rgba(141,141,141,0.16)` | `rgba(141,141,141,0.16)` |
| `backgroundInverseHover` | Inverse hover bg | `#474747` | `#474747` | `#e8e8e8` | `#e8e8e8` |
| `backgroundSelected` | Selected state bg | `rgba(141,141,141,0.2)` | `rgba(141,141,141,0.2)` | `rgba(141,141,141,0.24)` | `rgba(141,141,141,0.24)` |
| `backgroundSelectedHover` | Selected+hover bg | `rgba(141,141,141,0.32)` | `rgba(141,141,141,0.32)` | `rgba(141,141,141,0.32)` | `rgba(141,141,141,0.32)` |

### 2.7 Layer Tokens — All Four Themes

| Token | White | G10 | G90 | G100 |
|-------|-------|-----|-----|------|
| `layer01` | `#f4f4f4` | `#ffffff` | `#393939` | `#262626` |
| `layer02` | `#ffffff` | `#f4f4f4` | `#525252` | `#393939` |
| `layer03` | `#f4f4f4` | `#ffffff` | `#6f6f6f` | `#525252` |
| `layerBackground01` | `#ffffff` | `#f4f4f4` | `#262626` | `#161616` |
| `layerBackground02` | `#f4f4f4` | `#ffffff` | `#393939` | `#262626` |
| `layerBackground03` | `#ffffff` | `#f4f4f4` | `#525252` | `#393939` |
| `layerHover01` | `#e8e8e8` | `#e8e8e8` | `#474747` | `#333333` |
| `layerHover02` | `#e8e8e8` | `#e8e8e8` | `#636363` | `#474747` |
| `layerHover03` | `#e8e8e8` | `#e8e8e8` | `#5e5e5e` | `#636363` |
| `layerActive01` | `#c6c6c6` | `#c6c6c6` | `#6f6f6f` | `#525252` |
| `layerActive02` | `#c6c6c6` | `#c6c6c6` | `#8d8d8d` | `#6f6f6f` |
| `layerActive03` | `#c6c6c6` | `#c6c6c6` | `#393939` | `#8d8d8d` |
| `layerSelected01` | `#e0e0e0` | `#e0e0e0` | `#525252` | `#393939` |
| `layerSelected02` | `#e0e0e0` | `#e0e0e0` | `#6f6f6f` | `#525252` |
| `layerSelected03` | `#e0e0e0` | `#e0e0e0` | `#525252` | `#6f6f6f` |
| `layerSelectedHover01` | `#d1d1d1` | `#d1d1d1` | `#636363` | `#474747` |
| `layerSelectedHover02` | `#d1d1d1` | `#d1d1d1` | `#5e5e5e` | `#636363` |
| `layerSelectedHover03` | `#d1d1d1` | `#d1d1d1` | `#636363` | `#5e5e5e` |
| `layerSelectedInverse` | `#161616` | `#161616` | `#f4f4f4` | `#f4f4f4` |
| `layerSelectedDisabled` | `#8d8d8d` | `#8d8d8d` | `#a8a8a8` | `#a8a8a8` |
| `layerAccent01` | `#e0e0e0` | `#e0e0e0` | `#525252` | `#393939` |
| `layerAccent02` | `#e0e0e0` | `#e0e0e0` | `#6f6f6f` | `#525252` |
| `layerAccent03` | `#e0e0e0` | `#e0e0e0` | `#8d8d8d` | `#6f6f6f` |
| `layerAccentHover01` | `#d1d1d1` | `#d1d1d1` | `#636363` | `#474747` |
| `layerAccentHover02` | `#d1d1d1` | `#d1d1d1` | `#5e5e5e` | `#636363` |
| `layerAccentHover03` | `#d1d1d1` | `#d1d1d1` | `#7a7a7a` | `#5e5e5e` |
| `layerAccentActive01` | `#a8a8a8` | `#a8a8a8` | `#8d8d8d` | `#6f6f6f` |
| `layerAccentActive02` | `#a8a8a8` | `#a8a8a8` | `#393939` | `#8d8d8d` |
| `layerAccentActive03` | `#a8a8a8` | `#a8a8a8` | `#525252` | `#393939` |

### 2.8 Field Tokens — All Four Themes

| Token | White | G10 | G90 | G100 |
|-------|-------|-----|-----|------|
| `field01` | `#f4f4f4` | `#ffffff` | `#393939` | `#262626` |
| `field02` | `#ffffff` | `#f4f4f4` | `#525252` | `#393939` |
| `field03` | `#f4f4f4` | `#ffffff` | `#6f6f6f` | `#525252` |
| `fieldHover01` | `#e8e8e8` | `#e8e8e8` | `#474747` | `#333333` |
| `fieldHover02` | `#e8e8e8` | `#e8e8e8` | `#636363` | `#474747` |
| `fieldHover03` | `#e8e8e8` | `#e8e8e8` | `#5e5e5e` | `#636363` |

### 2.9 Border Tokens — All Four Themes

| Token | White | G10 | G90 | G100 |
|-------|-------|-----|-----|------|
| `borderSubtle00` | `#e0e0e0` | `#c6c6c6` | `#525252` | `#393939` |
| `borderSubtle01` | `#c6c6c6` | `#e0e0e0` | `#6f6f6f` | `#525252` |
| `borderSubtle02` | `#e0e0e0` | `#c6c6c6` | `#8d8d8d` | `#6f6f6f` |
| `borderSubtle03` | `#c6c6c6` | `#e0e0e0` | `#8d8d8d` | `#6f6f6f` |
| `borderSubtleSelected01` | `#c6c6c6` | `#c6c6c6` | `#8d8d8d` | `#6f6f6f` |
| `borderSubtleSelected02` | `#c6c6c6` | `#c6c6c6` | `#a8a8a8` | `#8d8d8d` |
| `borderSubtleSelected03` | `#c6c6c6` | `#c6c6c6` | `#a8a8a8` | `#8d8d8d` |
| `borderStrong01` | `#8d8d8d` | `#8d8d8d` | `#8d8d8d` | `#6f6f6f` |
| `borderStrong02` | `#8d8d8d` | `#8d8d8d` | `#a8a8a8` | `#8d8d8d` |
| `borderStrong03` | `#8d8d8d` | `#8d8d8d` | `#c6c6c6` | `#a8a8a8` |
| `borderTile01` | `#c6c6c6` | `#a8a8a8` | `#6f6f6f` | `#525252` |
| `borderTile02` | `#a8a8a8` | `#c6c6c6` | `#8d8d8d` | `#6f6f6f` |
| `borderTile03` | `#c6c6c6` | `#a8a8a8` | `#a8a8a8` | `#8d8d8d` |
| `borderInverse` | `#161616` | `#161616` | `#f4f4f4` | `#f4f4f4` |
| `borderInteractive` | `#0f62fe` | `#0f62fe` | `#4589ff` | `#4589ff` |
| `borderDisabled` | `#c6c6c6` | `#c6c6c6` | `rgba(141,141,141,0.5)` | `rgba(141,141,141,0.5)` |

### 2.10 Text Tokens — All Four Themes

| Token | White | G10 | G90 | G100 |
|-------|-------|-----|-----|------|
| `textPrimary` | `#161616` | `#161616` | `#f4f4f4` | `#f4f4f4` |
| `textSecondary` | `#525252` | `#525252` | `#c6c6c6` | `#c6c6c6` |
| `textPlaceholder` | `rgba(22,22,22,0.4)` | `rgba(22,22,22,0.4)` | `rgba(244,244,244,0.4)` | `rgba(244,244,244,0.4)` |
| `textHelper` | `#6f6f6f` | `#6f6f6f` | `#c6c6c6` | `#a8a8a8` |
| `textError` | `#da1e28` | `#da1e28` | `#ffb3b8` | `#ff8389` |
| `textInverse` | `#ffffff` | `#ffffff` | `#161616` | `#161616` |
| `textOnColor` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` |
| `textOnColorDisabled` | `#8d8d8d` | `#8d8d8d` | `rgba(255,255,255,0.25)` | `rgba(255,255,255,0.25)` |
| `textDisabled` | `rgba(22,22,22,0.25)` | `rgba(22,22,22,0.25)` | `rgba(244,244,244,0.25)` | `rgba(244,244,244,0.25)` |

### 2.11 Link Tokens — All Four Themes

| Token | White | G10 | G90 | G100 |
|-------|-------|-----|-----|------|
| `linkPrimary` | `#0f62fe` | `#0f62fe` | `#78a9ff` | `#78a9ff` |
| `linkPrimaryHover` | `#0043ce` | `#0043ce` | `#a6c8ff` | `#a6c8ff` |
| `linkSecondary` | `#0043ce` | `#0043ce` | `#a6c8ff` | `#a6c8ff` |
| `linkInverse` | `#78a9ff` | `#78a9ff` | `#0f62fe` | `#0f62fe` |
| `linkVisited` | `#8a3ffc` | `#8a3ffc` | `#be95ff` | `#be95ff` |
| `linkInverseVisited` | `#be95ff` | `#be95ff` | `#8a3ffc` | `#8a3ffc` |
| `linkInverseActive` | `#f4f4f4` | `#f4f4f4` | `#161616` | `#161616` |
| `linkInverseHover` | `#a6c8ff` | `#a6c8ff` | `#0043ce` | `#0043ce` |

### 2.12 Icon Tokens — All Four Themes

| Token | White | G10 | G90 | G100 |
|-------|-------|-----|-----|------|
| `iconPrimary` | `#161616` | `#161616` | `#f4f4f4` | `#f4f4f4` |
| `iconSecondary` | `#525252` | `#525252` | `#c6c6c6` | `#c6c6c6` |
| `iconInverse` | `#ffffff` | `#ffffff` | `#161616` | `#161616` |
| `iconOnColor` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` |
| `iconOnColorDisabled` | `#8d8d8d` | `#8d8d8d` | `rgba(255,255,255,0.25)` | `rgba(255,255,255,0.25)` |
| `iconDisabled` | `rgba(22,22,22,0.25)` | `rgba(22,22,22,0.25)` | `rgba(244,244,244,0.25)` | `rgba(244,244,244,0.25)` |
| `iconInteractive` | `#0f62fe` | `#0f62fe` | `#ffffff` | `#ffffff` |

### 2.13 Support Tokens — All Four Themes

| Token | White | G10 | G90 | G100 |
|-------|-------|-----|-----|------|
| `supportError` | `#da1e28` | `#da1e28` | `#ff8389` | `#fa4d56` |
| `supportSuccess` | `#24a148` | `#24a148` | `#42be65` | `#42be65` |
| `supportWarning` | `#f1c21b` | `#f1c21b` | `#f1c21b` | `#f1c21b` |
| `supportInfo` | `#0043ce` | `#0043ce` | `#4589ff` | `#4589ff` |
| `supportErrorInverse` | `#fa4d56` | `#fa4d56` | `#da1e28` | `#da1e28` |
| `supportSuccessInverse` | `#42be65` | `#42be65` | `#24a148` | `#24a148` |
| `supportWarningInverse` | `#f1c21b` | `#f1c21b` | `#f1c21b` | `#f1c21b` |
| `supportInfoInverse` | `#4589ff` | `#4589ff` | `#0043ce` | `#0043ce` |
| `supportCautionMinor` | `#f1c21b` | `#f1c21b` | `#f1c21b` | `#f1c21b` |
| `supportCautionMajor` | `#ff832b` | `#ff832b` | `#ff832b` | `#ff832b` |
| `supportCautionUndefined` | `#8a3ffc` | `#8a3ffc` | `#a56eff` | `#a56eff` |

### 2.14 Focus & Interactive Tokens — All Four Themes

| Token | White | G10 | G90 | G100 |
|-------|-------|-----|-----|------|
| `focus` | `#0f62fe` | `#0f62fe` | `#ffffff` | `#ffffff` |
| `focusInset` | `#ffffff` | `#ffffff` | `#161616` | `#161616` |
| `focusInverse` | `#ffffff` | `#ffffff` | `#0f62fe` | `#0f62fe` |
| `interactive` | `#0f62fe` | `#0f62fe` | `#4589ff` | `#4589ff` |
| `highlight` | `#d0e2ff` | `#d0e2ff` | `#002d9c` | `#001d6c` |
| `overlay` | `rgba(0,0,0,0.6)` | `rgba(0,0,0,0.6)` | `rgba(0,0,0,0.6)` | `rgba(0,0,0,0.6)` |
| `toggleOff` | `#8d8d8d` | `#8d8d8d` | `#8d8d8d` | `#6f6f6f` |
| `shadow` | `rgba(0,0,0,0.3)` | `rgba(0,0,0,0.3)` | `rgba(0,0,0,0.8)` | `rgba(0,0,0,0.8)` |

### 2.15 Skeleton Tokens — All Four Themes

| Token | White | G10 | G90 | G100 |
|-------|-------|-----|-----|------|
| `skeletonBackground` | `#e8e8e8` | `#e8e8e8` | `#333333` | `#292929` |
| `skeletonElement` | `#c6c6c6` | `#c6c6c6` | `#525252` | `#393939` |

### 2.16 Inline Theming Rules

- Use inline theming only for **major** contrast shifts (e.g., dark UI Shell on a light page).
- Do NOT inline White→Gray 10 or Gray 90→Gray 100 — too subtle, handled within the theme by layering.
- Implement via the `<Theme>` component wrapping the target section.
- Inverse component tokens (e.g., tooltip) remain high-contrast when mode switches.

### 2.17 Light/Dark Mode Rules

- User must have a visible mode control (typically in user profile/settings).
- All colors must use tokens — hard-coded values will not update on mode switch.
- Illustrations: swap assets or use transparent backgrounds between modes.
- Inline themes with modes: e.g., dark side panel stays dark in light mode but may merge with page in dark mode.

---

## 3. Motion

> Source: https://carbondesignsystem.com/elements/motion/overview/  
> Source: `@carbon/motion@11.51.0/scss/generated/_tokens.scss`

### 3.1 Duration Tokens

| Token (v11) | Deprecated alias | ms value | Usage |
|-------------|-----------------|----------|-------|
| `$duration-fast-01` | `$fast-01` | **70 ms** | Micro-interactions: button, toggle — instant user feedback |
| `$duration-fast-02` | `$fast-02` | **110 ms** | Micro-interactions: fade in/out — subtle entrance or exit of small UI elements |
| `$duration-moderate-01` | `$moderate-01` | **150 ms** | Micro-interactions, small expansion, short-distance movements — default transition speed |
| `$duration-moderate-02` | `$moderate-02` | **240 ms** | Expansion, system communication, toast — slightly longer with more visual weight |
| `$duration-slow-01` | `$slow-01` | **400 ms** | Large expansion, important system notifications — deliberate, prominent transitions |
| `$duration-slow-02` | `$slow-02` | **700 ms** | Background dimming, large hero transitions — slow, immersive motion for maximum emphasis |

**Note:** The v10 short names (`$fast-01`, etc.) are deprecated in v11. Use `$duration-*` names. Duration should be **dynamic** based on animation distance/size when possible; use the IBM Motion Generator (https://ibm.github.io/motion/) for custom durations.

### 3.2 Easing Curves

> Source: `@carbon/motion@11.51.0/scss/generated/_tokens.scss`

| Easing type | Productive (CSS) | Expressive (CSS) |
|------------|-----------------|-----------------|
| **Standard** (element visible start→end) | `cubic-bezier(0.2, 0, 0.38, 0.9)` | `cubic-bezier(0.4, 0.14, 0.3, 1)` |
| **Entrance** (element enters view) | `cubic-bezier(0, 0, 0.38, 0.9)` | `cubic-bezier(0, 0, 0.3, 1)` |
| **Exit** (element leaves view permanently) | `cubic-bezier(0.2, 0, 1, 0.9)` | `cubic-bezier(0.4, 0.14, 1, 1)` |

**IBM motion package function syntax:**

| Easing type | Productive | Expressive |
|------------|-----------|-----------|
| Standard | `motion(standard, productive)` | `motion(standard, expressive)` |
| Entrance | `motion(entrance, productive)` | `motion(entrance, expressive)` |
| Exit | `motion(exit, productive)` | `motion(exit, expressive)` |

**After Effects equivalents:**

| Easing type | Productive | Expressive |
|------------|-----------|-----------|
| Standard | outgoing 20%, incoming 62% | outgoing 40%, incoming 70% |
| Entrance | outgoing 0%, incoming 62% | outgoing 0%, incoming 70% |
| Exit | outgoing 20%, incoming 0% | outgoing 40%, incoming 0% |

### 3.3 Productive vs. Expressive Motion

| Dimension | Productive | Expressive |
|-----------|-----------|-----------|
| Character | Efficient, subtle, responsive | Enthusiastic, vibrant, highly visible |
| When to use | Task-focused moments; most UI interactions | Significant moments: new page, primary action, meaning-conveying motion |
| Examples | Button states, dropdowns, data tables, micro-interactions | Opening pages, primary button clicks, notifications, toasts |
| Speed | Significantly faster | Slower, more dramatic |

**Rule:** Reserve expressive motion for occasional, important moments to capture attention and provide rhythmic breaks. Overuse of expressive motion is an anti-pattern.

### 3.4 Easing Curve Selection Rules

| When to use | Easing type |
|-------------|------------|
| Element visible from start to end of animation (e.g., expanding tile, sorting rows) | Standard |
| Element appears/enters view (modal, toaster, dropdown opening, toggle) | Entrance |
| Element permanently disappears (modal close, notification dismiss) | Exit |
| Element leaves but stays nearby (e.g., side panel sliding off-screen, ready to return) | **Standard** (not Exit) — implies it rests just off-screen |

**Prohibited easing:** Bounce, stretch, or sudden stops. Linear is also unnatural.

### 3.5 Motion Accessibility

- Always provide non-motion alternatives for state transitions.
- Consider reduced/simplified motion for mobile and tablet.
- Respect `prefers-reduced-motion` OS setting.

---

## 4. Typography

> Source: https://carbondesignsystem.com/elements/typography/overview/  
> Source: https://carbondesignsystem.com/elements/typography/type-sets/

### 4.1 Typefaces

| Family | CSS font-family stack | Usage |
|--------|----------------------|-------|
| IBM Plex Sans | `'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif` | Primary — UI and body |
| IBM Plex Serif | `'IBM Plex Serif', 'Georgia', Times, serif` | Expressive — quotations |
| IBM Plex Mono | `'IBM Plex Mono', 'Menlo', 'DejaVu Sans Mono', 'Bitstream Vera Sans Mono', Courier, monospace` | Code |

### 4.2 Font Weight Usage

| Weight | Name | Use |
|--------|------|-----|
| 300 | Light | Large display headings only (heading-06, 07, expressive display) |
| 400 | Regular | Body text, most headings |
| 600 | SemiBold | Section headers, compact headings; not for long text |

Each weight has an italic style — use italics only to emphasize specific words (titles, technical terms, device names, captions).

### 4.3 Type Scale (IBM Plex)

> Formula: Xn = Xn-1 + {INT[(n-2)/4] + 1} × 2; y₀ = 12px

| rem | px |
|-----|-----|
| 0.75 | 12 |
| 0.875 | 14 |
| 1 | 16 |
| 1.125 | 18 |
| 1.25 | 20 |
| 1.5 | 24 |
| 1.75 | 28 |
| 2 | 32 |
| 2.25 | 36 |
| 2.625 | 42 |
| 3 | 48 |
| 3.375 | 54 |
| 3.75 | 60 |
| 4.25 | 68 |
| 4.75 | 76 |
| 5.25 | 84 |
| 5.75 | 92 |

### 4.4 Type Sets Overview

| Set | Base size | Heading type | Usage |
|-----|-----------|--------------|-------|
| Productive | 14 px | Fixed (non-responsive) | Product UIs, task-focused screens, dense layouts |
| Expressive | 16 px | Fluid (responsive at breakpoints) for headings 03+ | Editorial, marketing, long-form reading |

**Naming convention:**
- Productive body/utility suffix: `-01` (e.g., `body-compact-01`)
- Expressive body/utility suffix: `-02` (e.g., `body-compact-02`)
- Productive headings: `heading-01` through `heading-07` (fixed)
- Expressive headings: `heading-compact-02`, `fluid-heading-03` through `fluid-heading-06` (fluid), plus display and callout styles

### 4.5 Utility / Supporting Styles

> Source: https://carbondesignsystem.com/elements/typography/type-sets/

| Token | Typeface | Size (px/rem) | Line height (px/rem) | Weight | Letter spacing | Set |
|-------|----------|--------------|----------------------|--------|----------------|-----|
| `code-01` | IBM Plex Mono | 12 / 0.75rem | 16 / 1rem | 400 Regular | 0.32 px | Productive |
| `code-02` | IBM Plex Mono | 14 / 0.875rem | 20 / 1.25rem | 400 Regular | 0.32 px | Expressive |
| `label-01` | IBM Plex Sans | 12 / 0.75rem | 16 / 1rem | 400 Regular | 0.32 px | Productive |
| `label-02` | IBM Plex Sans | 14 / 0.875rem | 18 / 1.125rem | 400 Regular | 0.16 px | Expressive |
| `helper-text-01` | IBM Plex Sans | 12 / 0.75rem | 16 / 1rem | 400 Regular | 0.32 px | Productive |
| `helper-text-02` | IBM Plex Sans | 14 / 0.875rem | 18 / 1.125rem | 400 Regular | 0.16 px | Expressive |
| `legal-01` | IBM Plex Sans | 12 / 0.75rem | 16 / 1rem | 400 Regular | 0.32 px | Productive |
| `legal-02` | IBM Plex Sans | 14 / 0.875rem | 18 / 1.125rem | 400 Regular | 0.16 px | Expressive |

### 4.6 Body Styles

| Token | Typeface | Size (px/rem) | Line height (px/rem) | Weight | Letter spacing | Set | Usage |
|-------|----------|--------------|----------------------|--------|----------------|-----|-------|
| `body-compact-01` | IBM Plex Sans | 14 / 0.875rem | 18 / 1.125rem | 400 Regular | 0.16 px | Productive | Short paragraphs (≤4 lines); components |
| `body-compact-02` | IBM Plex Sans | 16 / 1rem | 22 / 1.375rem | 400 Regular | 0 px | Expressive | Short paragraphs (≤4 lines); expressive components |
| `body-01` | IBM Plex Sans | 14 / 0.875rem | 20 / 1.25rem | 400 Regular | 0.16 px | Productive | Long paragraphs (>4 lines); accordion, structured list; always left-aligned |
| `body-02` | IBM Plex Sans | 16 / 1rem | 24 / 1.5rem | 400 Regular | 0 px | Expressive | Long paragraphs (>4 lines) in expressive layouts; always left-aligned |

### 4.7 Productive Fixed Heading Styles

| Token | Typeface | Size (px/rem) | Line height (px/rem) | Weight | Letter spacing | Notes |
|-------|----------|--------------|----------------------|--------|----------------|-------|
| `heading-compact-01` | IBM Plex Sans | 14 / 0.875rem | 18 / 1.125rem | 600 SemiBold | 0.16 px | Component/layout headings; pairs with `body-compact-01` |
| `heading-compact-02` | IBM Plex Sans | 16 / 1rem | 22 / 1.375rem | 600 SemiBold | 0 px | Smaller layout headings; pairs with `body-compact-02` |
| `heading-01` | IBM Plex Sans | 14 / 0.875rem | 20 / 1.25rem | 600 SemiBold | 0.16 px | Component/layout headings; pairs with `body-01` |
| `heading-02` | IBM Plex Sans | 16 / 1rem | 24 / 1.5rem | 600 SemiBold | 0 px | Smaller layout headings; pairs with `body-02` |
| `heading-03` | IBM Plex Sans | 20 / 1.25rem | 28 / 1.75rem | 400 Regular | 0 px | Component and layout headings |
| `heading-04` | IBM Plex Sans | 28 / 1.75rem | 36 / 2.25rem | 400 Regular | 0 px | Layout headings |
| `heading-05` | IBM Plex Sans | 32 / 2rem | 40 / 2.5rem | 400 Regular | 0 px | Layout headings |
| `heading-06` | IBM Plex Sans | 42 / 2.625rem | 50 / 3.125rem | 300 Light | 0 px | Layout headings |
| `heading-07` | IBM Plex Sans | 54 / 3.375rem | 64 / 4rem | 300 Light | 0 px | Layout headings |

### 4.8 Expressive Fluid Heading Styles

> These are responsive — type size changes at breakpoints. Do NOT use inside containers.

| Token | Typeface | Base size (px/rem) | Base line-height (px/rem) | Weight | Letter spacing | Notes |
|-------|----------|-------------------|--------------------------|--------|----------------|-------|
| `fluid-heading-03` | IBM Plex Sans | 20 / 1.25rem | 28 / 1.75rem | 400 Regular | 0 px | Component/layout headings |
| `fluid-heading-04` | IBM Plex Sans | 28 / 1.75rem | 36 / 2.25rem | 400 Regular | 0 px | Layout headings |
| `fluid-heading-05` | IBM Plex Sans | 42 / 2.625rem | 50 / 3.125rem | 300 Light | 0 px | Layout headings |
| `fluid-heading-06` | IBM Plex Sans | 42 / 2.625rem | 50 / 3.125rem | 600 SemiBold | 0 px | Layout headings |

**Note:** Fluid sizes above are the base (small breakpoint). Sizes step up incrementally across breakpoints. Exact intermediate values per breakpoint are not stated on the overview/type-sets pages.

### 4.9 Expressive Callout and Display Styles

| Token | Typeface | Base size (px/rem) | Base line-height (px/rem) | Weight | Letter spacing | Notes |
|-------|----------|-------------------|--------------------------|--------|----------------|-------|
| `fluid-paragraph-01` | IBM Plex Sans | 28 / 1.75rem | 36 / 2.25rem | 300 Light | 0 px | Large paragraphs, 3+ lines |
| `fluid-quotation-01` | IBM Plex Serif | 24 / 1.5rem | 30 / 1.875rem | 400 Regular | 0 px | Quotations |
| `fluid-quotation-02` | IBM Plex Serif | 42 / 2.625rem | 50 / 3.125rem | 300 Light | 0 px | Large quotations |
| `fluid-display-01` | IBM Plex Sans | 54 / 3.375rem | 64 / 4rem | 300 Light | 0 px | Display |
| `fluid-display-02` | IBM Plex Sans | 54 / 3.375rem | 64 / 4rem | 600 SemiBold | 0 px | Display |
| `fluid-display-03` | IBM Plex Sans | 60 / 3.75rem | 70 / 4.375rem | 300 Light | -0.64 px | Display |
| `fluid-display-04` | IBM Plex Sans | 92 / 5.75rem | 102 / 6.375rem | 300 Light | -0.64 px | Maximum display |

### 4.10 Typography Rules

1. **Productive vs. Expressive:** Expressive (larger, fluid) styles are for editorial/web pages; productive (smaller, fixed) for product/task UIs.
2. **Inside containers:** Always use fixed (productive) headings. Fluid headings are only for text outside containers.
3. **`body-01` can be used for productive moments within expressive experiences** — it bridges both contexts.
4. **Type color:** Keep body text neutral. Use `$linkPrimary` (`$text-primary` equivalent) for links. Gray 100 / Icons for secondary actions.
5. **Alignment:** Body styles `body-01` and `body-02` are always left-aligned.

---

## 5. Spacing

> Source: https://carbondesignsystem.com/elements/spacing/overview/  
> Source: `@carbon/layout@11.23.0/scss/generated/_spacing.scss`  
> Source: `@carbon/layout@11.23.0/scss/generated/_layout.scss`  
> Source: `@carbon/layout@11.23.0/scss/generated/_fluid-spacing.scss`

### 5.1 Spacing Scale (Component-level)

Used **inside** components. Applied to `margin` and `padding`.

| Token | rem | px |
|-------|-----|----|
| `$spacing-01` | 0.125rem | 2 px |
| `$spacing-02` | 0.25rem | 4 px |
| `$spacing-03` | 0.5rem | 8 px |
| `$spacing-04` | 0.75rem | 12 px |
| `$spacing-05` | 1rem | 16 px |
| `$spacing-06` | 1.5rem | 24 px |
| `$spacing-07` | 2rem | 32 px |
| `$spacing-08` | 2.5rem | 40 px |
| `$spacing-09` | 3rem | 48 px |
| `$spacing-10` | 4rem | 64 px |
| `$spacing-11` | 5rem | 80 px |
| `$spacing-12` | 6rem | 96 px |
| `$spacing-13` | 10rem | 160 px |

**Valid CSS usages:**
```scss
margin: $spacing-03 $spacing-01;
margin: $spacing-07 0 $spacing-04 0;
margin-right: $spacing-05;
padding: $spacing-05 $spacing-03;
padding: $spacing-07 $spacing-04 0 $spacing-04;
```

### 5.2 Layout Scale (Section/page-level spacing)

Used for **between-section** vertical spacing on pages.

| Token | rem | px |
|-------|-----|----|
| `$layout-01` | 1rem | 16 px |
| `$layout-02` | 1.5rem | 24 px |
| `$layout-03` | 2rem | 32 px |
| `$layout-04` | 3rem | 48 px |
| `$layout-05` | 4rem | 64 px |
| `$layout-06` | 6rem | 96 px |
| `$layout-07` | 10rem | 160 px |

### 5.3 Fluid Spacing Scale

Fluid spacing uses viewport-relative units. Used for contextual, fluid spatial relationships.

| Token | Value |
|-------|-------|
| `$fluid-spacing-01` | `0` |
| `$fluid-spacing-02` | `2vw` |
| `$fluid-spacing-03` | `5vw` |
| `$fluid-spacing-04` | `10vw` |

### 5.4 Non-Token Spacing Methods

| Method | Purpose |
|--------|---------|
| `auto` margin | Fluidly center an element between two edges |
| `auto` on one side | Asymmetrical fluid spacing — undefined space grows/shrinks with screen |
| Column gutters | Space items between grid columns |
| `Stack` component | Equal distance between grouped components; supports horizontal and vertical |

### 5.5 Spacing Rules

1. **Component spacing** → use `$spacing-*` scale.
2. **Layout/section spacing** → use `$layout-*` scale.
3. **Fluid/viewport-relative** → use `$fluid-spacing-*`.
4. **Tokens are not responsive** — they do not change value at breakpoints.
5. At breakpoints, you may **jump steps** on the spacing scale (e.g., `$spacing-05` at 1440px → `$spacing-03` at 768px).
6. Deviating from the scale should be avoided; use `auto` or `Stack` instead of arbitrary values.
7. Percentages (50%, 33%) are acceptable for dividing a page or controlling max/min widths — not for component-level spacing.

---

## 6. Gap-Analysis Appendix

### 6.1 Grid — Common Gaps in Naive Systems

| Gap | Description |
|-----|-------------|
| **Single breakpoint assumption** | Most naive systems define breakpoints as hard cutoffs. Carbon's grid is fluid *within* breakpoints — columns are percentages, not fixed widths, between breakpoints. |
| **Missing gutter modes** | Wide / Narrow / Condensed gutter modes are rarely modeled. They change whether *containers* hang into the gutter (not the type). A single `gap` CSS property will not reproduce all three modes. |
| **Grid influencers not tracked** | Side panels and left navigation *shrink the grid column count* when open, they don't just push content. Systems that use absolute left positioning miss this. |
| **Aspect ratio enforcement** | Carbon prescribes exactly 6 approved aspect ratios. Most token systems have no concept of approved ratios. |
| **Mini unit vs. fluid grid distinction** | Naive systems use a single spacing system. Carbon uses mini-unit fixed spacing *inside* containers and fluid column multiples *for* containers. |

### 6.2 Color — Common Gaps in Naive Systems

| Gap | Description |
|-----|-------------|
| **No layering model** | Most systems define tokens by component, not by layer depth. Without layer-set tokens (-00, -01, -02, -03), building nested components that remain correct across layer depths is impossible. |
| **Missing contextual tokens** | Contextual tokens (no number suffix) auto-resolve based on nesting — most token systems have no equivalent. |
| **Hover is a half-step, not a step** | Hover colors sit *between* standard IBM palette grades (e.g., Gray 10 hover is Gray 15, not Gray 20). These are non-standard values that can't be computed from the palette alone. |
| **Interaction states not complete** | Active = 2 full steps; selected = 1 full step; hover = ½ step. A naive system often only has hover. |
| **No `$focus-inset` / `$focus-inverse`** | Focus requires both the ring color and an inset color (for the gap between ring and element). Omitting this breaks accessibility. |
| **Inline theming architecture** | Nested themes (e.g., Gray 100 panel inside a White page) require a `<Theme>` component wrapper, not just different CSS variables. Most systems have no concept of runtime inline theme switching. |

### 6.3 Motion — Common Gaps in Naive Systems

| Gap | Description |
|-----|-------------|
| **Only one easing curve** | Most design systems define one `ease-in-out`. Carbon defines 6 curves: 3 types × 2 styles. |
| **No productive/expressive distinction** | The distinction governs curve choice and duration choice simultaneously — these are linked. |
| **Static durations only** | Carbon's ideal is dynamic duration based on animation distance/size. Static tokens are a fallback, not the ideal. |
| **Exit easing misuse** | Side panels that slide off-screen should use **standard** easing (not exit), because they'll return. Naive systems treat all element removals identically. |
| **No reduced-motion strategy** | `prefers-reduced-motion` handling is not optional — Carbon explicitly calls for motion-free alternatives. |

### 6.4 Typography — Common Gaps in Naive Systems

| Gap | Description |
|-----|-------------|
| **No productive/expressive split** | Most systems have one type scale. Carbon's two scales have different base sizes (14 px vs. 16 px) and different heading behaviors (fixed vs. fluid). |
| **Fluid headings not implemented** | `fluid-heading-03` through `fluid-display-04` change size at breakpoints and interpolate between them (not just snap). This requires fluid type implementation, not just breakpoint-specific classes. |
| **Missing `body-01` vs. `body-compact-01` distinction** | `body-compact-01` (18px line-height) is for short paragraphs in components; `body-01` (20px line-height) is for long-form text. The distinction is about line-height for readability at length, not a stylistic preference. |
| **Letter spacing omitted** | Small text uses 0.32 px tracking; medium uses 0.16 px; large and display use 0 or −0.64 px. Token systems that don't include letter spacing produce incorrect text rendering. |
| **No type pairing rules** | Carbon documents explicit heading+body pairings (e.g., `heading-compact-01` pairs with `body-compact-01`). Naive systems leave pairings to developer discretion. |

### 6.5 Spacing — Common Gaps in Naive Systems

| Gap | Description |
|-----|-------------|
| **Single scale for everything** | Carbon distinguishes component-level (`$spacing-*`) from layout/section-level (`$layout-*`) from fluid/viewport-relative (`$fluid-spacing-*`). Mixing these contexts produces inconsistent density. |
| **Tokens as responsive values** | Carbon spacing tokens are **not** responsive — the token value doesn't change at breakpoints. Responsive spacing is implemented by using *different tokens* at different breakpoints. |
| **No `Stack` / layout component concept** | Components should not apply their own external margin. Spacing between components is delegated to parent layout utilities (`Stack`). Systems where every component manages its own margin create tight coupling. |
| **`$fluid-spacing` concept missing** | Viewport-relative spacing (`2vw`, `5vw`, `10vw`) for layout-scale fluid spacing is absent from most token systems, which use only fixed rem values. |
| **Layout scale vs. spacing scale conflation** | Using `$spacing-13` (160px) inside a component is wrong — that scale value is meant for section separation. Most token systems don't encode this semantic difference. |
```

---

