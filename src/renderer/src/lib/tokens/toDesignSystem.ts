// A design system reading its values back out of its token library.
//
// The two used to hold the same colours, the same fonts, the same radii and
// the same durations, in two shapes, in two stores. Nothing kept them in
// step, so a team could change their blue in the library and watch every
// component in the system stay the old blue — and there was no way to tell
// which of the two was wrong, because both were saved and both looked
// deliberate.
//
// This makes the library the answer and the system the reader. The system
// still carries the values, because every component preview, canvas and kit
// reads them directly and always has; they are now a copy taken from the
// library rather than a second original. `studioFromDesignSystem` builds the
// library from the system once, when it is first made. After that the traffic
// runs this way only.

import { resolveAll } from '../../../../shared/tokens/resolve'
import type { TokenStudio, TokenValue } from '../../../../shared/tokens/types'
import type { DesignSystem } from '../designSystem'

/** A resolved value, but only if it is the kind of value being asked for. */
function pick(
  map: Map<string, { value: TokenValue }>,
  path: string
): TokenValue | undefined {
  return map.get(path)?.value
}

function hex(map: Map<string, { value: TokenValue }>, path: string, fallback: string): string {
  const v = pick(map, path)
  return typeof v === 'string' && v.startsWith('#') ? v : fallback
}

function px(map: Map<string, { value: TokenValue }>, path: string, fallback: number): number {
  const v = pick(map, path)
  if (typeof v === 'number') return v
  // A dimension may arrive as `16px` or as a bare `16`; a `65ch` measure is
  // not a pixel value and must not be read as 65.
  if (typeof v === 'string') {
    const m = /^(-?[\d.]+)px$/.exec(v.trim())
    if (m) return Number(m[1])
    if (/^-?[\d.]+$/.test(v.trim())) return Number(v)
  }
  return fallback
}

// Two vocabularies, one reader.
//
// Libraries have been written by more than one hand. The scaffold names a
// brand colour `colour.brand.rest`, because it also has a hover and an active
// and wanted them to sit together; libraries written the other way name it
// plainly `colour.brand` and hang `colour.brand.hover` off the same stem.
// Neither is wrong and both are saved, so a reader that knows only one name
// silently keeps the system's own colour and the link to the library looks
// broken. These take a list of names and answer with the first that resolves.

function hexAny(
  map: Map<string, { value: TokenValue }>,
  paths: readonly string[],
  fallback: string
): string {
  for (const path of paths) {
    const v = pick(map, path)
    if (typeof v === 'string' && v.startsWith('#')) return v
  }
  return fallback
}

function textAny(
  map: Map<string, { value: TokenValue }>,
  paths: readonly string[],
  fallback: string
): string {
  for (const path of paths) {
    const v = pick(map, path)
    if (typeof v === 'string' && v.length > 0) return v
  }
  return fallback
}

/** `cubic-bezier(...)` from the four numbers a token stores, or a keyword. */
function easing(map: Map<string, { value: TokenValue }>, fallback: string): string {
  const v = pick(map, 'ease.standard')
  if (v && typeof v === 'object' && 'x1' in v) {
    const c = v as { x1: number; y1: number; x2: number; y2: number }
    return `cubic-bezier(${c.x1}, ${c.y1}, ${c.x2}, ${c.y2})`
  }
  return typeof v === 'string' && v.length > 0 ? v : fallback
}

/**
 * The shadow setting a library implies.
 *
 * A library says how far things lift in pixels; a system says it in one of
 * four words. Reading the blur of the resting elevation back into a word is
 * lossy in principle and exact in practice, because the scaffold only ever
 * emits four of them.
 */
function shadowOf(map: Map<string, { value: TokenValue }>, fallback: DesignSystem['shadow']): DesignSystem['shadow'] {
  const v = pick(map, 'shade.md')
  if (v === undefined) return fallback
  const s = JSON.stringify(v)
  if (s === 'null' || s === '"none"') return 'off'
  return fallback
}

/**
 * A design system with its values taken from a token library.
 *
 * Everything the library has an opinion about is overwritten. Everything it
 * does not — the name, the brief, the docs, the rules, the components — is
 * left exactly as it was, because those are the parts that make it a design
 * system rather than a second copy of the palette.
 */
export function applyStudioToSystem(
  ds: DesignSystem,
  studio: TokenStudio,
  themeId?: string | null
): DesignSystem {
  const theme = themeId ?? studio.activeTheme
  const map = resolveAll(studio, theme)
  if (map.size === 0) return ds

  const base: DesignSystem['base'] =
    studio.themes.find((t) => t.id === theme)?.name.toLowerCase() === 'dark' ? 'dark' : ds.base

  return {
    ...ds,
    base,
    colors: {
      primary: hexAny(map, ['colour.brand.rest', 'colour.brand'], ds.colors.primary),
      secondary: hexAny(map, ['colour.accent.rest', 'colour.accent'], ds.colors.secondary),
      tertiary: hexAny(
        map,
        ['colour.support', 'palette.support.600', 'palette.info.600'],
        ds.colors.tertiary
      ),
      bg: hexAny(map, ['colour.bg.canvas', 'colour.background'], ds.colors.bg),
      surface: hexAny(map, ['colour.bg.surface', 'colour.surface'], ds.colors.surface),
      text: hex(map, 'colour.text.primary', ds.colors.text),
      textMuted: hex(map, 'colour.text.muted', ds.colors.textMuted),
      border: hexAny(map, ['colour.border.default', 'colour.border'], ds.colors.border),
      success: hexAny(map, ['colour.success.fill', 'colour.positive'], ds.colors.success),
      warning: hexAny(map, ['colour.warning.fill', 'colour.caution'], ds.colors.warning),
      error: hexAny(map, ['colour.danger.fill', 'colour.critical'], ds.colors.error),
      info: hexAny(map, ['colour.info.fill', 'colour.info'], ds.colors.info)
    },
    font: {
      family: textAny(map, ['family.sans', 'family.body'], ds.font.family),
      heading: textAny(map, ['family.display', 'family.heading'], ds.font.heading)
    },
    type: {
      xs: px(map, 'size.xs', ds.type.xs),
      sm: px(map, 'size.sm', ds.type.sm),
      base: px(map, 'size.md', ds.type.base),
      md: px(map, 'size.lg', ds.type.md),
      lg: px(map, 'size.xl', ds.type.lg),
      xl: px(map, 'size.2xl', ds.type.xl),
      xxl: px(map, 'size.3xl', ds.type.xxl),
      xxxl: px(map, 'size.4xl', ds.type.xxxl)
    },
    weights: {
      regular: px(map, 'weight.regular', ds.weights.regular),
      medium: px(map, 'weight.medium', ds.weights.medium),
      semibold: px(map, 'weight.semibold', ds.weights.semibold),
      bold: px(map, 'weight.bold', ds.weights.bold)
    },
    spacing: ds.spacing.map((v, i) => px(map, `space.${i}`, v)),
    radii: {
      sm: px(map, 'radius.sm', ds.radii.sm),
      md: px(map, 'radius.md', ds.radii.md),
      lg: px(map, 'radius.lg', ds.radii.lg),
      pill: px(map, 'radius.full', ds.radii.pill)
    },
    shadow: shadowOf(map, ds.shadow),
    motion: {
      fast: px(map, 'time.fast', ds.motion.fast),
      normal: px(map, 'time.normal', ds.motion.normal),
      slow: px(map, 'time.slow', ds.motion.slow),
      easing: easing(map, ds.motion.easing)
    }
  }
}
