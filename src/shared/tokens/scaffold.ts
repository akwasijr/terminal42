// Building a full studio out of a handful of decisions.
//
// A blank token studio is a cruel thing to hand someone: the whole difficulty
// of tokens is not typing them, it is knowing which ones there should be. So
// a new studio arrives already three tiers deep and already correct, built
// from the same nine feels the design system wizard uses, and the work is
// then editing rather than inventing.
//
// Everything here is deterministic. The same feel gives the same studio every
// time, which is what makes it testable and what makes the model's job small:
// the model only has to choose the feel and the few colours, not emit two
// hundred tokens and get every alias right.

import type { Theme, Token, TokenSet, TokenStudio } from './types'

/** The few decisions a whole studio can be derived from. */
export type Feel = {
  name: string
  primary: string
  secondary: string
  tertiary: string
  headingFont: string
  bodyFont: string
  /** How round things are, from square to a full pill. */
  corner: 'angular' | 'slight' | 'rounded' | 'curved' | 'full'
  /** How much air there is between things. */
  density: 'compact' | 'cozy' | 'comfortable' | 'spacious'
  /** How far apart the type sizes are. */
  scale: 'compact' | 'balanced' | 'expressive'
  /** Whether anything lifts off the page. */
  elevation: 'flat' | 'subtle' | 'elevated'
}

const RAMP = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

/** Where on the ramp the given colour sits, so the ramp passes through it. */
const ANCHOR = 600

const CORNER_BASE: Record<Feel['corner'], number> = {
  angular: 0,
  slight: 4,
  rounded: 8,
  curved: 14,
  full: 20
}

const DENSITY_STEP: Record<Feel['density'], number> = {
  compact: 3,
  cozy: 4,
  comfortable: 4,
  spacious: 5
}

const SCALE_RATIO: Record<Feel['scale'], number> = {
  compact: 1.15,
  balanced: 1.2,
  expressive: 1.28
}

const SHADE_STEPS = ['none', 'sm', 'md', 'lg'] as const

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6).padEnd(6, '0')
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0
  ]
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((c) => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, '0')).join('')}`
}

/**
 * Mix towards white or black by a fraction.
 *
 * Done on the square of each channel rather than the channel itself, because
 * mixing sRGB values directly darkens the middle of a ramp in a way the eye
 * reads as muddy.
 */
function mix(rgb: [number, number, number], towards: 0 | 255, amount: number): [number, number, number] {
  const t = clamp(amount, 0, 1)
  return rgb.map((c) => Math.sqrt(c * c * (1 - t) + towards * towards * t)) as [number, number, number]
}

/** Eleven shades of one colour, passing exactly through the one given. */
export function ramp(hex: string): Record<number, string> {
  const base = parseHex(hex)
  const out: Record<number, string> = {}
  for (const step of RAMP) {
    if (step === ANCHOR) {
      out[step] = toHex(base)
      continue
    }
    if (step < ANCHOR) {
      // 50 is nearly white, 500 is barely lighter than the base.
      const t = (ANCHOR - step) / (ANCHOR - 25)
      out[step] = toHex(mix(base, 255, Math.pow(t, 0.85) * 0.97))
    } else {
      const t = (step - ANCHOR) / (1000 - ANCHOR)
      out[step] = toHex(mix(base, 0, Math.pow(t, 0.9) * 0.86))
    }
  }
  return out
}

/** Whether text on this colour should be light, by the usual luminance test. */
export function prefersLightText(hex: string): boolean {
  const [r, g, b] = parseHex(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.4
}

function tok(path: string, type: Token['type'], tier: Token['tier'], value: Token['value']): Token {
  // The path is already unique in a scaffolded studio, so it doubles as the id.
  return { id: path, path, type, tier, value }
}

function id(prefix: string): string {
  return `${prefix}${Math.random().toString(36).slice(2, 9)}`
}

/** The primitive tier: every raw value, named after what it is, not what it does. */
function palette(feel: Feel): Token[] {
  const out: Token[] = []

  const ramps: Array<[string, string]> = [
    ['brand', feel.primary],
    ['accent', feel.secondary],
    ['support', feel.tertiary],
    ['neutral', '#71717a'],
    ['positive', '#16a34a'],
    ['caution', '#d97706'],
    ['critical', '#dc2626']
  ]
  for (const [name, hex] of ramps) {
    const r = ramp(hex)
    for (const step of RAMP) out.push(tok(`palette.${name}.${step}`, 'color', 'primitive', r[step]))
  }
  out.push(tok('palette.white', 'color', 'primitive', '#ffffff'))
  out.push(tok('palette.black', 'color', 'primitive', '#09090b'))

  const step = DENSITY_STEP[feel.density]
  const spaces = [0, 1, 2, 3, 4, 6, 8, 12, 16, 24]
  for (const n of spaces) out.push(tok(`space.${n}`, 'dimension', 'primitive', n * step))

  const base = CORNER_BASE[feel.corner]
  out.push(tok('radius.none', 'dimension', 'primitive', 0))
  out.push(tok('radius.sm', 'dimension', 'primitive', Math.round(base * 0.5)))
  out.push(tok('radius.md', 'dimension', 'primitive', base))
  out.push(tok('radius.lg', 'dimension', 'primitive', Math.round(base * 1.75)))
  out.push(tok('radius.full', 'dimension', 'primitive', 9999))

  const ratio = SCALE_RATIO[feel.scale]
  const sizes = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl']
  sizes.forEach((name, i) => {
    const px = 16 * Math.pow(ratio, i - 2)
    out.push(tok(`size.${name}`, 'fontSize', 'primitive', Math.round(px * 2) / 2))
  })

  out.push(tok('family.heading', 'fontFamily', 'primitive', feel.headingFont))
  out.push(tok('family.body', 'fontFamily', 'primitive', feel.bodyFont))
  for (const [name, w] of [['regular', 400], ['medium', 500], ['semibold', 600], ['bold', 700]] as const) {
    out.push(tok(`weight.${name}`, 'fontWeight', 'primitive', w))
  }
  for (const [name, lh] of [['tight', 1.2], ['normal', 1.5], ['loose', 1.7]] as const) {
    out.push(tok(`leading.${name}`, 'lineHeight', 'primitive', lh))
  }

  const lift = feel.elevation === 'flat' ? 0 : feel.elevation === 'subtle' ? 1 : 1.6
  SHADE_STEPS.forEach((name, i) => {
    if (i === 0) {
      out.push(tok('shade.none', 'shadow', 'primitive', { x: 0, y: 0, blur: 0, spread: 0, color: 'rgba(0,0,0,0)' }))
      return
    }
    out.push(
      tok(`shade.${name}`, 'shadow', 'primitive', {
        x: 0,
        y: Math.round(i * lift),
        blur: Math.round(i * 3 * Math.max(lift, 0.6)),
        spread: 0,
        color: `rgba(9,9,11,${(0.03 + i * 0.02).toFixed(2)})`
      })
    )
  })

  for (const [name, ms] of [['fast', 120], ['normal', 200], ['slow', 320]] as const) {
    out.push(tok(`time.${name}`, 'duration', 'primitive', ms))
  }

  return out
}

/**
 * The semantic tier: what a value is for.
 *
 * Nothing here holds a literal. That is the rule the whole scheme rests on,
 * and it is the reason a theme can be swapped by replacing one set.
 */
function semantics(dark: boolean): Token[] {
  const bg = dark ? 'neutral.950' : 'white'
  const surface = dark ? 'neutral.900' : 'white'
  const raised = dark ? 'neutral.800' : 'neutral.50'
  const textPrimary = dark ? 'neutral.50' : 'neutral.950'
  const textSecondary = dark ? 'neutral.300' : 'neutral.700'
  const textMuted = dark ? 'neutral.500' : 'neutral.500'
  const border = dark ? 'neutral.800' : 'neutral.200'
  const brandStep = dark ? '400' : '600'

  const pairs: Array<[string, string]> = [
    ['colour.background', bg],
    ['colour.surface', surface],
    ['colour.raised', raised],
    ['colour.border', border],
    ['colour.text.primary', textPrimary],
    ['colour.text.secondary', textSecondary],
    ['colour.text.muted', textMuted],
    ['colour.text.onBrand', dark ? 'neutral.950' : 'white'],
    ['colour.brand', `brand.${brandStep}`],
    ['colour.brand.hover', dark ? 'brand.300' : 'brand.700'],
    ['colour.accent', `accent.${brandStep}`],
    ['colour.support', `support.${brandStep}`],
    ['colour.positive', `positive.${brandStep}`],
    ['colour.caution', `caution.${brandStep}`],
    ['colour.critical', `critical.${brandStep}`]
  ]

  const out: Token[] = pairs.map(([path, target]) =>
    tok(path, 'color', 'semantic', `{palette.${target}}`)
  )

  for (const [name, from] of [['tight', 1], ['snug', 2], ['base', 3], ['loose', 4], ['wide', 6], ['section', 12]] as const) {
    out.push(tok(`gap.${name}`, 'dimension', 'semantic', `{space.${from}}`))
  }
  for (const [name, from] of [['compact', 2], ['control', 3], ['panel', 4], ['page', 8]] as const) {
    out.push(tok(`pad.${name}`, 'dimension', 'semantic', `{space.${from}}`))
  }
  out.push(tok('corner.control', 'dimension', 'semantic', '{radius.md}'))
  out.push(tok('corner.panel', 'dimension', 'semantic', '{radius.lg}'))
  out.push(tok('corner.pill', 'dimension', 'semantic', '{radius.full}'))

  out.push(tok('type.display', 'fontSize', 'semantic', '{size.4xl}'))
  out.push(tok('type.title', 'fontSize', 'semantic', '{size.2xl}'))
  out.push(tok('type.heading', 'fontSize', 'semantic', '{size.lg}'))
  out.push(tok('type.body', 'fontSize', 'semantic', '{size.md}'))
  out.push(tok('type.caption', 'fontSize', 'semantic', '{size.sm}'))
  out.push(tok('type.headingFamily', 'fontFamily', 'semantic', '{family.heading}'))
  out.push(tok('type.bodyFamily', 'fontFamily', 'semantic', '{family.body}'))
  out.push(tok('type.headingWeight', 'fontWeight', 'semantic', '{weight.semibold}'))
  out.push(tok('type.bodyWeight', 'fontWeight', 'semantic', '{weight.regular}'))

  out.push(tok('lift.resting', 'shadow', 'semantic', '{shade.sm}'))
  out.push(tok('lift.raised', 'shadow', 'semantic', '{shade.md}'))
  out.push(tok('lift.floating', 'shadow', 'semantic', '{shade.lg}'))
  out.push(tok('motion.quick', 'duration', 'semantic', '{time.fast}'))
  out.push(tok('motion.normal', 'duration', 'semantic', '{time.normal}'))

  return out
}

/** The component tier: the handful of parts everything is actually built from. */
function components(): Token[] {
  const out: Token[] = []
  const add = (path: string, type: Token['type'], target: string): void => {
    out.push(tok(path, type, 'component', `{${target}}`))
  }

  add('button.background', 'color', 'colour.brand')
  add('button.backgroundHover', 'color', 'colour.brand.hover')
  add('button.text', 'color', 'colour.text.onBrand')
  add('button.radius', 'dimension', 'corner.control')
  add('button.padX', 'dimension', 'pad.panel')
  add('button.padY', 'dimension', 'pad.compact')
  add('button.size', 'fontSize', 'type.body')
  add('button.weight', 'fontWeight', 'type.headingWeight')

  add('card.background', 'color', 'colour.surface')
  add('card.border', 'color', 'colour.border')
  add('card.radius', 'dimension', 'corner.panel')
  add('card.pad', 'dimension', 'pad.panel')
  add('card.shadow', 'shadow', 'lift.resting')

  add('input.background', 'color', 'colour.surface')
  add('input.border', 'color', 'colour.border')
  add('input.borderFocus', 'color', 'colour.brand')
  add('input.text', 'color', 'colour.text.primary')
  add('input.radius', 'dimension', 'corner.control')
  add('input.pad', 'dimension', 'pad.control')

  add('badge.background', 'color', 'colour.raised')
  add('badge.text', 'color', 'colour.text.secondary')
  add('badge.radius', 'dimension', 'corner.pill')
  add('badge.size', 'fontSize', 'type.caption')

  return out
}

/**
 * A whole studio from one feel.
 *
 * Two themes are built rather than one, because the second is what proves the
 * semantic tier is doing its job: light and dark differ only in which of two
 * semantic sets is switched on, and no other token moves.
 */
export function studioFromFeel(name: string, feel: Feel): TokenStudio {
  const paletteId = id('s')
  const lightId = id('s')
  const darkId = id('s')
  const partsId = id('s')

  const sets: TokenSet[] = [
    { id: paletteId, name: 'Palette', order: 0, tokens: palette(feel) },
    { id: lightId, name: 'Light', order: 1, tokens: semantics(false) },
    { id: darkId, name: 'Dark', order: 2, tokens: semantics(true) },
    { id: partsId, name: 'Parts', order: 3, tokens: components() }
  ]

  const themes: Theme[] = [
    {
      id: 'light',
      name: 'Light',
      sets: { [paletteId]: 'source', [lightId]: 'enabled', [darkId]: 'off', [partsId]: 'enabled' }
    },
    {
      id: 'dark',
      name: 'Dark',
      sets: { [paletteId]: 'source', [lightId]: 'off', [darkId]: 'enabled', [partsId]: 'enabled' }
    }
  ]

  return { id: id('ts'), name, sets, themes, activeTheme: 'light' }
}
