# Frontend Visual Design Implementation Rules

When generating, modifying, or reviewing any frontend code that produces visual UI,
ALWAYS follow these rules. This covers HTML, CSS, React, Vue, Svelte, or any web framework.

---

# 🚫 ANTI-AI FRONTEND DEFAULTS

AI-generated frontend code has well-documented failure patterns. You MUST actively avoid all of them.

## 1. No Div Soup
- **NEVER** use `<div>` when a semantic element exists.
- **NEVER** nest more than 3 `<div>`s without a semantic element in between.
- Use these instead:

| Instead of `<div>`            | Use                          |
|-------------------------------|------------------------------|
| Page wrapper                  | `<main>`                     |
| Navigation                    | `<nav>`                      |
| Page top section              | `<header>`                   |
| Page bottom section           | `<footer>`                   |
| Content block                 | `<section>` with heading     |
| Independent content           | `<article>`                  |
| Side content                  | `<aside>`                    |
| Image with caption            | `<figure>` + `<figcaption>`  |
| Clickable action              | `<button>` (NEVER `<div onClick>`) |
| List of items                 | `<ul>` / `<ol>` + `<li>`    |

## 2. No Inline Styles
- **NEVER** use `style={{}}` or `style=""` for visual styling in production code.
- Inline styles cannot use `:hover`, `:focus`, media queries, or CSS variables.
- **Exception**: Dynamic values only (e.g., `style={{ width: `${progress}%` }}`).
- Use CSS classes, Tailwind utilities, CSS Modules, or styled-components instead.

## 3. No Missing Interactive States
Every interactive element MUST have ALL of these states defined:
- **Default** — resting appearance
- **Hover** — mouse over (`:hover`)
- **Focus** — keyboard focus (`:focus-visible`) — NEVER `outline: none` without replacement
- **Active** — being pressed (`:active`)
- **Disabled** — non-interactive (`[disabled]` or `[aria-disabled="true"]`)

If using Tailwind:
```html
<button class="bg-blue-600 hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
  Save changes
</button>
```

## 4. No Fixed Pixel Widths on Containers
- **NEVER** set `width: 800px` on a container, card, or section.
- Use `max-width` with responsive units: `max-width: 1280px; width: 100%;`
- Cards: Use grid/flex with `min-width` and `1fr`, never fixed `width`.
- **Exception**: Icons, avatars, and tiny elements with known dimensions.

## 5. No Layout Mixing
- **NEVER** mix `position: absolute` with flexbox/grid to position main layout elements.
- Pick ONE layout strategy per container:
  - **Flexbox** for 1D layout (rows or columns)
  - **CSS Grid** for 2D layout (rows AND columns)
  - **Position** only for overlays, tooltips, dropdowns, floating elements
- **NEVER** use `float` for layout. It's 2026.

## 6. No Orphaned Elements
- **NEVER** leave elements without proper spacing context (random margins).
- Every element should get its spacing from a parent's `gap`, `padding`, or a consistent margin pattern.
- Use `gap` on flex/grid containers — not margins on children.

## 7. No Hardcoded Colors/Sizes
- **NEVER** write raw hex (`#3b82f6`), rgb, or pixel values in component files.
- Always reference design tokens via CSS variables or Tailwind theme values.
- ❌ `color: #3b82f6; padding: 17px; font-size: 15px;`
- ✅ `color: var(--color-primary); padding: var(--space-4); font-size: var(--font-size-base);`

---

# 🏗️ HTML Structure Rules

## Semantic Document Structure
Every page MUST have this landmark structure:

```html
<body>
  <header>         <!-- Logo, global nav, user menu -->
    <nav>          <!-- Primary navigation -->
  </header>
  <main>           <!-- Primary page content (ONE per page) -->
    <section>      <!-- Logical content groups -->
    <article>      <!-- Self-contained content -->
  </main>
  <aside>          <!-- Sidebar if needed -->
  <footer>         <!-- Site footer, legal, links -->
</body>
```

## Heading Hierarchy
- Every page has exactly ONE `<h1>`.
- Headings follow strict order: `h1 → h2 → h3 → h4`. Never skip levels.
- Use headings for structure, not styling. Style with classes.

## Forms
```html
<!-- ALWAYS pair labels with inputs -->
<label for="email">Email address</label>
<input type="email" id="email" name="email" required autocomplete="email" />

<!-- NEVER use placeholder as the only label -->
<!-- NEVER use <div> as a button in forms -->
<button type="submit">Create account</button>
```

## Links vs Buttons
- `<a href>` — navigates to a URL or anchor
- `<button>` — triggers an action (submit, toggle, open modal)
- **NEVER** use `<a>` without `href`. **NEVER** use `<div onClick>` as a button.

## Images
```html
<!-- ALWAYS include alt, width, height, loading -->
<img
  src="/hero.webp"
  alt="Team collaborating around a whiteboard"
  width="1200"
  height="600"
  loading="lazy"
  decoding="async"
/>

<!-- Decorative images get empty alt -->
<img src="/pattern.svg" alt="" role="presentation" />
```

---

# 🎨 CSS Architecture Rules

## File Organization
```
styles/
├── tokens.css          /* CSS custom properties (design tokens) */
├── reset.css           /* Minimal reset (box-sizing, margins) */
├── base.css            /* Typography, body defaults */
├── layouts/            /* Page layout patterns */
│   ├── sidebar.css
│   └── grid.css
├── components/         /* Component-specific styles */
│   ├── button.css
│   ├── card.css
│   └── modal.css
└── utilities.css       /* Helper classes (sr-only, truncate, etc.) */
```

## CSS Reset (Minimal, Modern)
```css
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; padding: 0; }
html { -moz-text-size-adjust: none; text-size-adjust: none; }
body { min-height: 100dvh; line-height: 1.5; -webkit-font-smoothing: antialiased; }
img, picture, video, canvas, svg { display: block; max-width: 100%; }
input, button, textarea, select { font: inherit; }
p, h1, h2, h3, h4, h5, h6 { overflow-wrap: break-word; }
```

## Modern CSS Features to USE
```css
/* Container queries — component-level responsiveness */
.card-container { container-type: inline-size; }
@container (min-width: 400px) {
  .card { flex-direction: row; }
}

/* CSS nesting — no preprocessor needed */
.card {
  padding: var(--space-5);

  & h2 { font-size: var(--font-size-xl); }
  &:hover { box-shadow: var(--shadow-md); }

  @media (width > 768px) { padding: var(--space-6); }
}

/* Fluid typography with clamp() */
h1 { font-size: clamp(1.75rem, 3vw + 1rem, 2.5rem); }

/* text-wrap: balance for headings */
h1, h2, h3 { text-wrap: balance; }

/* :has() parent selector */
.form-group:has(:invalid) { border-color: var(--color-error); }
.card:has(img) { padding-top: 0; }

/* Scroll-driven animations (progressive enhancement) */
@supports (animation-timeline: scroll()) {
  .fade-in {
    animation: fade-in linear;
    animation-timeline: scroll();
  }
}
```

## Cascade Layers
```css
/* Define layer order — prevents specificity wars */
@layer reset, base, tokens, layouts, components, utilities;

@layer tokens { :root { --color-primary: #6366F1; } }
@layer components { .btn { /* ... */ } }
@layer utilities { .sr-only { /* ... */ } }
```

---

# 📐 Layout Patterns

## Flexbox Patterns
```css
/* Centered content (both axes) */
.center { display: flex; align-items: center; justify-content: center; }

/* Space between with wrapping */
.row { display: flex; flex-wrap: wrap; gap: var(--space-4); }

/* Sidebar + main content */
.layout {
  display: flex;
  gap: var(--space-6);
  & .sidebar { flex: 0 0 280px; }
  & .content { flex: 1; min-width: 0; } /* min-width: 0 prevents overflow */
}
```

## Grid Patterns
```css
/* Auto-fit responsive cards (no media queries needed) */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: var(--space-5);
}

/* Dashboard layout */
.dashboard {
  display: grid;
  grid-template-columns: 260px 1fr;
  grid-template-rows: auto 1fr;
  min-height: 100dvh;
}

/* KPI row — equal width columns */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}
```

## Responsive Strategy
```css
/* Mobile-first breakpoints */
/* Base styles = mobile */

@media (min-width: 640px)  { /* sm — large phones */ }
@media (min-width: 768px)  { /* md — tablets */ }
@media (min-width: 1024px) { /* lg — laptops */ }
@media (min-width: 1280px) { /* xl — desktops */ }
@media (min-width: 1536px) { /* 2xl — large screens */ }

/* Max content width — NEVER stretch full width on large screens */
.page-content {
  width: 100%;
  max-width: 1280px;
  margin-inline: auto;
  padding-inline: var(--space-4);

  @media (min-width: 768px) { padding-inline: var(--space-6); }
  @media (min-width: 1280px) { padding-inline: var(--space-8); }
}
```

---

# 🧩 Component Implementation Rules

## Buttons
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  min-height: 40px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background-color 150ms ease, box-shadow 150ms ease;
  user-select: none;

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
}

/* Sizes */
.btn-sm { min-height: 32px; padding: var(--space-1) var(--space-3); font-size: var(--font-size-sm); }
.btn-lg { min-height: 48px; padding: var(--space-3) var(--space-6); font-size: var(--font-size-md); }
```

## Cards
```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);

  /* Internal spacing via flex */
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
```

## Inputs
```css
.input {
  width: 100%;
  height: 40px;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: border-color 150ms ease, box-shadow 150ms ease;

  &::placeholder { color: var(--color-text-disabled); }
  &:hover { border-color: var(--color-border-strong); }
  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
  }
  &[aria-invalid="true"] { border-color: var(--color-error); }
}
```

## Modals / Dialogs
```html
<!-- Use native <dialog> element -->
<dialog id="confirm-dialog" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm action</h2>
  <p>Are you sure you want to delete this project?</p>
  <div class="dialog-actions">
    <button type="button" data-close>Cancel</button>
    <button type="button" class="btn-danger">Delete project</button>
  </div>
</dialog>
```
```css
dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-lg);
  max-width: min(480px, 90vw);

  &::backdrop {
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
  }
}
```

---

# 🖼️ Image & Media Rules

## Image Optimization
- **Format priority**: AVIF → WebP → PNG/JPEG (use `<picture>` for fallbacks).
- **Always set `width` and `height`** to prevent layout shift (CLS).
- **Always use `loading="lazy"`** for below-the-fold images.
- **Use `srcset`** for responsive images:

```html
<picture>
  <source srcset="/hero.avif" type="image/avif" />
  <source srcset="/hero.webp" type="image/webp" />
  <img src="/hero.jpg" alt="..." width="1200" height="600" loading="lazy" />
</picture>
```

## Icon System
- Use a proper icon library: **Lucide React** (default), Phosphor, or Heroicons.
- Import icons as components, never as image files or emoji.
- Standard sizes: 16px (inline), 20px (default), 24px (prominent).
- Icons in buttons always get `aria-hidden="true"`, with button text providing the label.

```jsx
import { Plus } from 'lucide-react';

<button>
  <Plus size={20} aria-hidden="true" />
  Create project
</button>
```

For icon-only buttons, add `aria-label`:
```jsx
<button aria-label="Close dialog">
  <X size={20} aria-hidden="true" />
</button>
```

---

# ♿ Frontend Accessibility Checklist

## Keyboard Navigation
```css
/* NEVER remove focus outlines globally */
/* ❌ *:focus { outline: none; } */

/* ✅ Use focus-visible for keyboard-only focus rings */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Hide focus ring for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}
```

## Skip Link (EVERY page needs this)
```html
<a href="#main-content" class="skip-link">Skip to content</a>
<!-- ... nav ... -->
<main id="main-content">
```
```css
.skip-link {
  position: absolute;
  top: -100%;
  left: var(--space-4);
  padding: var(--space-2) var(--space-4);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  z-index: 9999;

  &:focus { top: var(--space-4); }
}
```

## Screen Reader Utilities
```css
/* Visually hidden but accessible to screen readers */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

## ARIA Rules
- **Don't over-ARIA**: If a semantic HTML element works, DON'T add ARIA.
- `<button>` is better than `<div role="button" tabindex="0">`.
- Use `aria-label` only when there's no visible text label.
- Use `aria-live="polite"` for dynamic content updates (toasts, form errors).
- Use `aria-expanded` on toggles/accordions.
- Use `aria-current="page"` on active nav links.

---

# ⚡ Performance Rules

## Critical Rendering
- Inline critical CSS in `<head>` for above-the-fold content.
- Load non-critical CSS with `media="print" onload="this.media='all'"` pattern.
- Preload critical fonts: `<link rel="preload" href="/fonts/inter.woff2" as="font" crossorigin>`

## Font Loading
```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-variable.woff2') format('woff2');
  font-display: swap;          /* Show fallback immediately */
  font-weight: 100 900;
  font-style: normal;
  unicode-range: U+0000-00FF;  /* Latin only — load other ranges separately */
}
```

## Component Lazy Loading (React)
```jsx
import { lazy, Suspense } from 'react';

const HeavyChart = lazy(() => import('./components/HeavyChart'));

function Dashboard() {
  return (
    <Suspense fallback={<div class="skeleton" />}>
      <HeavyChart />
    </Suspense>
  );
}
```

## Core Web Vitals Targets
| Metric | Target   | What It Measures                  |
|--------|----------|-----------------------------------|
| LCP    | ≤ 2.5s   | Largest visible content painted   |
| INP    | ≤ 200ms  | Responsiveness to interaction     |
| CLS    | ≤ 0.1    | Visual stability (no layout shift)|

---

# 🌗 Dark Mode Implementation

```css
/* Light mode tokens (default) */
:root {
  --color-bg: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-text-primary: #0F172A;
  --color-text-secondary: #334155;
  --color-border: #E2E8F0;
  --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.05);
}

/* Dark mode tokens */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0F172A;
    --color-surface: #1E293B;
    --color-text-primary: #F1F5F9;
    --color-text-secondary: #CBD5E1;
    --color-border: #334155;
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
}

/* Manual toggle support */
[data-theme="dark"] {
  --color-bg: #0F172A;
  --color-surface: #1E293B;
  /* ... same dark tokens ... */
}
```

### Dark Mode Rules
- **NEVER** invert colors manually — swap CSS variables.
- Reduce shadow intensity in dark mode (or replace with borders).
- Reduce image brightness: `img { filter: brightness(0.9); }` in dark mode.
- Test ALL components in both modes before shipping.
- Use `color-scheme: light dark;` on `:root` to hint to browser.

---

# 🔍 View Transitions (Progressive Enhancement)

```css
/* Smooth page transitions */
@view-transition { navigation: auto; }

::view-transition-old(root) {
  animation: fade-out 150ms ease-out;
}
::view-transition-new(root) {
  animation: fade-in 200ms ease-in;
}

@keyframes fade-out { to { opacity: 0; } }
@keyframes fade-in { from { opacity: 0; } }
```

```js
// SPA view transitions
document.startViewTransition(() => {
  // Update DOM here
  updateContent(newPage);
});
```

---

# ✅ Frontend Visual QA Checklist

### Before every PR/deploy, verify:

**Structure**
- [ ] Semantic HTML used throughout (no div soup)
- [ ] Heading hierarchy is correct (h1 → h2 → h3, no skips)
- [ ] All forms have labels, all images have alt text

**Styling**
- [ ] No inline styles (except dynamic values)
- [ ] No hardcoded color/size values — all from tokens
- [ ] All spacing follows 4px grid
- [ ] Dark mode works correctly

**Interactivity**
- [ ] Every button/link has hover, focus, active, disabled states
- [ ] Focus indicators visible on keyboard navigation
- [ ] Skip link present and functional
- [ ] Tab order is logical

**Responsive**
- [ ] Works at 320px width (smallest phone)
- [ ] Works at 768px (tablet)
- [ ] Works at 1280px+ (desktop)
- [ ] No horizontal scroll at any width
- [ ] Touch targets ≥ 44×44px

**Performance**
- [ ] Images use lazy loading + explicit dimensions
- [ ] Fonts use `font-display: swap`
- [ ] No layout shift on load (CLS < 0.1)
- [ ] Heavy components are lazy-loaded

**Accessibility**
- [ ] Color contrast passes WCAG AA (4.5:1 text, 3:1 UI)
- [ ] Screen reader announces all elements correctly
- [ ] ARIA used only when semantic HTML isn't sufficient
- [ ] `prefers-reduced-motion` is respected
