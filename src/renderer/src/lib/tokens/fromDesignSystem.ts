// A token library from a design system.
//
// The wizard already asks every question a library needs answered — the three
// brand colours, the two typefaces, the corner, the density, the scale, the
// lift — and then throws the answers into a shape only the design system
// screen can read. Which means a team that has made a design system still has
// no library, and the design system cannot be enforced, exported, bound to a
// form, or given to a chat turn. This is the bridge that stops that.
//
// It is not a re-ask. Everything the system actually decided is carried over
// literally; the scaffold only supplies the things a design system never had
// an opinion about, which is mainly the ramps between the colours it named.

import { ramp, studioFromFeel, type Feel } from '../../../../shared/tokens/scaffold'
import type { Token, TokenStudio } from '../../../../shared/tokens/types'
import type { DesignSystem } from '../designSystem'

/** The scaffold has no squircle, and a squircle is a curve with a flourish. */
function corner(ds: DesignSystem): Feel['corner'] {
  const c = ds.cornerStyle
  if (!c) return 'rounded'
  return c === 'squircle' ? 'curved' : c
}

function set(tokens: Token[], path: string, value: Token['value']): Token[] {
  return tokens.map((t) => (t.path === path ? { ...t, value } : t))
}

/**
 * Re-run one primitive ramp through a colour the system actually chose.
 *
 * Only the steps that already exist are touched, so a five-step family stays
 * five steps and an eleven-step one stays eleven.
 */
function reramp(tokens: Token[], family: string, hex: string): Token[] {
  const r = ramp(hex)
  const at = new RegExp(`^palette\\.${family}\\.(\\d+)$`)
  return tokens.map((t) => {
    const m = at.exec(t.path)
    if (!m) return t
    const next = r[Number(m[1])]
    return next ? { ...t, value: next } : t
  })
}

/** The four numbers in `cubic-bezier(a, b, c, d)`, or null if it is a keyword. */
export function parseEasing(easing: string): { x1: number; y1: number; x2: number; y2: number } | null {
  const m = /cubic-bezier\(([^)]+)\)/.exec(easing)
  if (!m) return null
  const n = m[1].split(',').map((s) => Number(s.trim()))
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) return null
  return { x1: n[0], y1: n[1], x2: n[2], y2: n[3] }
}

export function feelFromDesignSystem(ds: DesignSystem): Feel {
  return {
    name: ds.name,
    primary: ds.colors.primary,
    secondary: ds.colors.secondary,
    tertiary: ds.colors.tertiary,
    headingFont: ds.font.heading,
    bodyFont: ds.font.family,
    corner: corner(ds),
    density: ds.density ?? 'comfortable',
    scale: 'balanced',
    elevation: ds.shadow === 'off' ? 'flat' : ds.shadow === 'strong' ? 'elevated' : ds.shadow === 'medium' ? 'elevated' : 'subtle'
  }
}

export function studioFromDesignSystem(ds: DesignSystem): TokenStudio {
  const studio = studioFromFeel(ds.name, feelFromDesignSystem(ds))

  const sets = studio.sets.map((s) => {
    if (s.name !== 'Palette') return s
    let t = s.tokens

    // The status colours the system picked, not the generic ones the scaffold
    // falls back to. Semantics stay aliases, so putting the real hue here is
    // what makes `colour.danger.fill` mean this system's red.
    t = reramp(t, 'accent', ds.colors.secondary)
    t = reramp(t, 'success', ds.colors.success)
    t = reramp(t, 'warning', ds.colors.warning)
    t = reramp(t, 'danger', ds.colors.error)
    t = reramp(t, 'info', ds.colors.info)

    // The type scale is a decision the system made in pixels. Deriving it
    // again from a ratio would quietly disagree with every component the
    // system has already drawn.
    const sizes: Array<[string, number]> = [
      ['size.xs', ds.type.xs],
      ['size.sm', ds.type.sm],
      ['size.md', ds.type.base],
      ['size.lg', ds.type.md],
      ['size.xl', ds.type.lg],
      ['size.2xl', ds.type.xl],
      ['size.3xl', ds.type.xxl],
      ['size.4xl', ds.type.xxxl]
    ]
    for (const [path, px] of sizes) t = set(t, path, px)

    for (const [name, w] of Object.entries(ds.weights)) t = set(t, `weight.${name}`, w)

    t = set(t, 'radius.sm', ds.radii.sm)
    t = set(t, 'radius.md', ds.radii.md)
    t = set(t, 'radius.lg', ds.radii.lg)
    t = set(t, 'radius.full', ds.radii.pill)

    t = set(t, 'time.fast', ds.motion.fast)
    t = set(t, 'time.normal', ds.motion.normal)
    t = set(t, 'time.slow', ds.motion.slow)
    const curve = parseEasing(ds.motion.easing)
    if (curve) t = set(t, 'ease.standard', curve)

    return { ...s, tokens: t }
  })

  // The theme the system was drawn in is the theme the library opens in,
  // because otherwise the first thing a person sees is their system inverted.
  return { ...studio, sets, activeTheme: ds.base === 'dark' ? 'dark' : 'light' }
}
