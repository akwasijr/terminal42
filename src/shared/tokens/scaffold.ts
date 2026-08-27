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

const SHADE_STEPS = ['none', 'sm', 'md', 'lg', 'xl'] as const

/** The five steps a ramp gets when it is a supporting colour, not a lead. */
const SHORT = [100, 300, 500, 700, 900] as const

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

/**
 * The primitive tier: every raw value, named after what it is, not what it does.
 *
 * The shape of this shelf is a judgement about where stepping actually helps.
 * Neutral and brand get the full eleven, because those are the two you truly
 * walk up and down: a neutral does the page, the panel, the border and the
 * muted label, and a brand needs a rest, a hover, an active and a tint, in
 * both a light and a dark theme, from one hue. Everything else gets five.
 * An eleven-step ramp of a third brand colour is the sort of thing a
 * generator produces and nobody ever names.
 */
function palette(feel: Feel): Token[] {
  const out: Token[] = []

  for (const [name, hex] of [['neutral', '#71717a'], ['brand', feel.primary]] as const) {
    const r = ramp(hex)
    for (const step of RAMP) out.push(tok(`palette.${name}.${step}`, 'color', 'primitive', r[step]))
  }
  for (const [name, hex] of [
    ['accent', feel.secondary],
    ['success', '#16a34a'],
    ['warning', '#d97706'],
    ['danger', '#dc2626'],
    ['info', '#2563eb']
  ] as const) {
    const r = ramp(hex)
    for (const step of SHORT) out.push(tok(`palette.${name}.${step}`, 'color', 'primitive', r[step]))
  }
  out.push(tok('palette.white', 'color', 'primitive', '#ffffff'))
  out.push(tok('palette.black', 'color', 'primitive', '#09090b'))

  // The gaps in the sequence are the scale working: there is no 7 because
  // nothing should ever be seven steps of anything.
  const step = DENSITY_STEP[feel.density]
  for (const n of [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]) {
    out.push(tok(`space.${n}`, 'dimension', 'primitive', n * step))
  }

  const base = CORNER_BASE[feel.corner]
  out.push(tok('radius.none', 'dimension', 'primitive', 0))
  out.push(tok('radius.sm', 'dimension', 'primitive', Math.round(base * 0.5)))
  out.push(tok('radius.md', 'dimension', 'primitive', base))
  out.push(tok('radius.lg', 'dimension', 'primitive', Math.round(base * 1.5)))
  out.push(tok('radius.xl', 'dimension', 'primitive', Math.round(base * 2.25)))
  out.push(tok('radius.full', 'dimension', 'primitive', 9999))

  out.push(tok('stroke.none', 'dimension', 'primitive', 0))
  out.push(tok('stroke.hairline', 'dimension', 'primitive', 1))
  out.push(tok('stroke.thick', 'dimension', 'primitive', 2))

  const ratio = SCALE_RATIO[feel.scale]
  const sizes = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl']
  sizes.forEach((name, i) => {
    const px = 16 * Math.pow(ratio, i - 2)
    out.push(tok(`size.${name}`, 'fontSize', 'primitive', Math.round(px * 2) / 2))
  })

  out.push(tok('family.sans', 'fontFamily', 'primitive', feel.bodyFont))
  out.push(tok('family.display', 'fontFamily', 'primitive', feel.headingFont))
  out.push(tok('family.mono', 'fontFamily', 'primitive', 'ui-monospace, SFMono-Regular, Menlo, monospace'))
  for (const [name, w] of [['regular', 400], ['medium', 500], ['semibold', 600], ['bold', 700]] as const) {
    out.push(tok(`weight.${name}`, 'fontWeight', 'primitive', w))
  }
  for (const [name, lh] of [['tight', 1.2], ['snug', 1.35], ['normal', 1.5], ['relaxed', 1.7]] as const) {
    out.push(tok(`leading.${name}`, 'lineHeight', 'primitive', lh))
  }
  for (const [name, ls] of [['tight', '-0.01em'], ['normal', '0em'], ['wide', '0.02em']] as const) {
    out.push(tok(`tracking.${name}`, 'letterSpacing', 'primitive', ls))
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

  // Carbon's ladder, because a three-step one cannot tell a button's
  // acknowledgement (70ms) from a panel's arrival (240ms) and so gives both
  // the same 200 and makes one feel sluggish and the other abrupt.
  for (const [name, ms] of [
    ['instant', 0],
    ['fast', 70],
    ['quick', 110],
    ['normal', 150],
    ['moderate', 240],
    ['slow', 400],
    ['deliberate', 700]
  ] as const) {
    out.push(tok(`time.${name}`, 'duration', 'primitive', ms))
  }
  // Motion without easings is half a system: a duration says how long, and
  // only the curve says whether it felt right.
  //
  // Two families, not one. A curve that is right for a dropdown is wrong for
  // a page arriving, and a system with a single `ease-in-out` has no way to
  // say which moment it is in. Productive is the everyday one; expressive is
  // for the few moments meant to be noticed.
  for (const [name, c] of [
    ['standard', [0.2, 0, 0.38, 0.9]],
    ['entrance', [0, 0, 0.38, 0.9]],
    ['exit', [0.2, 0, 1, 0.9]],
    ['expressive.standard', [0.4, 0.14, 0.3, 1]],
    ['expressive.entrance', [0, 0, 0.3, 1]],
    ['expressive.exit', [0.4, 0.14, 1, 1]]
  ] as const) {
    out.push(tok(`ease.${name}`, 'cubicBezier', 'primitive', { x1: c[0], y1: c[1], x2: c[2], y2: c[3] }))
  }

  return out
}

/**
 * The colour semantics of one theme. Nothing here holds a literal.
 *
 * These are the only tokens that differ between light and dark, which is why
 * they are their own set: swapping the theme swaps this and nothing else.
 */
function colours(dark: boolean): Token[] {
  const p = (target: string): string => `{palette.${target}}`
  const step = dark ? '400' : '600'
  const tint = dark ? '900' : '100'
  const on = dark ? '900' : '100'

  const pairs: Array<[string, string]> = [
    // Surfaces, deepest first. A raised surface sits above a plain one, a
    // sunken one below it, and the overlay is the scrim behind a dialog.
    ['colour.bg.canvas', dark ? 'neutral.950' : 'neutral.50'],
    ['colour.bg.surface', dark ? 'neutral.900' : 'white'],
    ['colour.bg.raised', dark ? 'neutral.800' : 'white'],
    ['colour.bg.sunken', dark ? 'black' : 'neutral.100'],
    ['colour.bg.overlay', dark ? 'neutral.950' : 'neutral.900'],

    ['colour.brand.rest', `brand.${step}`],
    ['colour.brand.hover', dark ? 'brand.300' : 'brand.700'],
    ['colour.brand.active', dark ? 'brand.200' : 'brand.800'],
    ['colour.brand.subtle', dark ? 'brand.900' : 'brand.100'],
    ['colour.brand.on', dark ? 'neutral.950' : 'white'],

    ['colour.accent.rest', `accent.${dark ? '300' : '700'}`],
    ['colour.accent.subtle', `accent.${dark ? '900' : '100'}`],

    ['colour.text.primary', dark ? 'neutral.50' : 'neutral.950'],
    ['colour.text.secondary', dark ? 'neutral.300' : 'neutral.700'],
    ['colour.text.muted', dark ? 'neutral.500' : 'neutral.500'],
    ['colour.text.disabled', dark ? 'neutral.700' : 'neutral.300'],
    ['colour.text.link', `brand.${step}`],

    ['colour.border.subtle', dark ? 'neutral.900' : 'neutral.100'],
    ['colour.border.default', dark ? 'neutral.800' : 'neutral.200'],
    ['colour.border.strong', dark ? 'neutral.700' : 'neutral.300'],
    ['colour.border.focus', `brand.${step}`],

    // Layers, which are what a surface token cannot say on its own. A card in
    // a panel in a page is three depths, and with one `surface` they are all
    // the same colour and the nesting disappears. Each step moves away from
    // the canvas: lighter in the dark, darker in the light.
    ['colour.layer.01', dark ? 'neutral.900' : 'white'],
    ['colour.layer.02', dark ? 'neutral.800' : 'neutral.50'],
    ['colour.layer.03', dark ? 'neutral.700' : 'neutral.100'],
    ['colour.layer.hover', dark ? 'neutral.800' : 'neutral.100'],
    ['colour.layer.active', dark ? 'neutral.700' : 'neutral.200'],

    // A field is not a layer. An input has to stay legible as a place you can
    // type on whichever depth it lands, so it steps with the layers it sits on.
    ['colour.field.01', dark ? 'neutral.800' : 'neutral.100'],
    ['colour.field.02', dark ? 'neutral.700' : 'white'],
    ['colour.field.hover', dark ? 'neutral.700' : 'neutral.200'],

    // Focus needs two colours, not one: the ring, and the hairline inside it
    // that keeps the ring readable when the element it surrounds is the same
    // colour as the ring.
    ['colour.focus.ring', `brand.${step}`],
    ['colour.focus.inset', dark ? 'neutral.950' : 'white'],
    ['colour.focus.inverse', dark ? 'neutral.950' : 'white'],

    // Icons carry their own strengths because an icon at 16px reads lighter
    // than text at 16px, and reusing the text tokens makes every icon faint.
    ['colour.icon.primary', dark ? 'neutral.50' : 'neutral.950'],
    ['colour.icon.secondary', dark ? 'neutral.300' : 'neutral.700'],
    ['colour.icon.disabled', dark ? 'neutral.700' : 'neutral.300'],
    ['colour.icon.on', dark ? 'neutral.950' : 'white'],

    ['colour.link.rest', `brand.${step}`],
    ['colour.link.hover', dark ? 'brand.300' : 'brand.700'],
    ['colour.link.visited', `accent.${dark ? '300' : '700'}`],
    ['colour.link.inverse', dark ? 'brand.700' : 'brand.300'],

    // The inverse surface: a tooltip or a toast is deliberately the opposite
    // of the page so it reads as being on top of it rather than in it.
    ['colour.inverse.bg', dark ? 'neutral.50' : 'neutral.900'],
    ['colour.inverse.text', dark ? 'neutral.950' : 'neutral.50'],
    ['colour.inverse.link', dark ? 'brand.700' : 'brand.300'],

    // A skeleton is two colours: the ground it occupies and the shimmer that
    // says it is loading rather than empty.
    ['colour.skeleton.bg', dark ? 'neutral.800' : 'neutral.100'],
    ['colour.skeleton.element', dark ? 'neutral.700' : 'neutral.200']
  ]

  // Each status is a small family rather than one colour, because that is the
  // shape a component actually consumes: a tint to sit on, a solid to fill
  // with, a text strength and a border.
  for (const name of ['success', 'warning', 'danger', 'info'] as const) {
    pairs.push([`colour.${name}.fill`, `${name}.${dark ? '300' : '700'}`])
    pairs.push([`colour.${name}.subtle`, `${name}.${tint}`])
    pairs.push([`colour.${name}.text`, `${name}.${dark ? '300' : '700'}`])
    pairs.push([`colour.${name}.border`, `${name}.${dark ? '700' : '300'}`])
    pairs.push([`colour.${name}.on`, `neutral.${on === '900' ? '950' : '50'}`])
  }

  return pairs.map(([path, target]) => tok(path, 'color', 'semantic', p(target)))
}

/**
 * The semantics that do not change with the theme.
 *
 * Type is the interesting part. A size of 20 and a weight of 600 scattered
 * across two tokens is six numbers a person has to reassemble in their head;
 * one `type.heading` that carries family, size, weight, leading and tracking
 * is a thing they can point at, show as a specimen, and export as a usable
 * style.
 */
function shape(): Token[] {
  const out: Token[] = []

  const text = (
    path: string,
    family: 'sans' | 'display' | 'mono',
    size: string,
    weight: string,
    leading: string,
    tracking: string
  ): void => {
    out.push(
      tok(path, 'typography', 'semantic', {
        fontFamily: `{family.${family}}`,
        fontSize: `{size.${size}}`,
        fontWeight: `{weight.${weight}}`,
        lineHeight: `{leading.${leading}}`,
        letterSpacing: `{tracking.${tracking}}`
      })
    )
  }
  text('type.display', 'display', '4xl', 'bold', 'tight', 'tight')
  text('type.title', 'display', '3xl', 'semibold', 'tight', 'tight')
  text('type.heading', 'display', 'xl', 'semibold', 'snug', 'normal')
  text('type.subheading', 'sans', 'lg', 'medium', 'snug', 'normal')
  text('type.body', 'sans', 'md', 'regular', 'normal', 'normal')
  // Long prose wants air between lines; a line of text inside a control wants
  // none. One body style asked to do both makes buttons tall and paragraphs
  // tight, which is why the compact one is a style rather than an override.
  text('type.bodyCompact', 'sans', 'md', 'regular', 'snug', 'normal')
  text('type.bodyStrong', 'sans', 'md', 'semibold', 'normal', 'normal')
  text('type.caption', 'sans', 'sm', 'regular', 'normal', 'wide')
  text('type.code', 'mono', 'sm', 'regular', 'normal', 'normal')

  const sizes = [['xs', 1], ['sm', 2], ['md', 4], ['lg', 6], ['xl', 10]] as const
  for (const [name, from] of sizes) out.push(tok(`gap.${name}`, 'dimension', 'semantic', `{space.${from}}`))
  for (const [name, from] of sizes) out.push(tok(`pad.${name}`, 'dimension', 'semantic', `{space.${from}}`))

  out.push(tok('corner.control', 'dimension', 'semantic', '{radius.md}'))
  out.push(tok('corner.surface', 'dimension', 'semantic', '{radius.lg}'))
  out.push(tok('corner.pill', 'dimension', 'semantic', '{radius.full}'))

  out.push(tok('lift.resting', 'shadow', 'semantic', '{shade.sm}'))
  out.push(tok('lift.raised', 'shadow', 'semantic', '{shade.md}'))
  out.push(tok('lift.overlay', 'shadow', 'semantic', '{shade.xl}'))

  out.push(tok('motion.fast', 'duration', 'semantic', '{time.fast}'))
  out.push(tok('motion.normal', 'duration', 'semantic', '{time.normal}'))
  out.push(tok('motion.slow', 'duration', 'semantic', '{time.moderate}'))
  out.push(tok('motion.deliberate', 'duration', 'semantic', '{time.slow}'))
  out.push(tok('motion.enter', 'cubicBezier', 'semantic', '{ease.entrance}'))
  out.push(tok('motion.exit', 'cubicBezier', 'semantic', '{ease.exit}'))
  out.push(tok('motion.move', 'cubicBezier', 'semantic', '{ease.standard}'))
  // The expressive pair sits beside the productive one rather than replacing
  // it, so choosing between them is a choice somebody makes on purpose.
  out.push(tok('motion.expressive.enter', 'cubicBezier', 'semantic', '{ease.expressive.entrance}'))
  out.push(tok('motion.expressive.exit', 'cubicBezier', 'semantic', '{ease.expressive.exit}'))
  out.push(tok('motion.expressive.move', 'cubicBezier', 'semantic', '{ease.expressive.standard}'))

  // Space between sections is not space inside a component, and one scale
  // asked to do both ends up either cramping the page or bloating the card.
  for (const [name, from] of [['xs', 4], ['sm', 6], ['md', 8], ['lg', 12], ['xl', 16], ['2xl', 24]] as const) {
    out.push(tok(`layout.${name}`, 'dimension', 'semantic', `{space.${from}}`))
  }

  // The grid, which is the one part of a library that is about the page
  // rather than anything drawn on it.
  for (const [name, px] of [
    ['sm', 320],
    ['md', 672],
    ['lg', 1056],
    ['xl', 1312],
    ['2xl', 1584]
  ] as const) {
    out.push(tok(`breakpoint.${name}`, 'dimension', 'primitive', px))
  }
  for (const [name, cols] of [['sm', 4], ['md', 8], ['lg', 16], ['xl', 16], ['2xl', 16]] as const) {
    out.push(tok(`column.${name}`, 'number', 'primitive', cols))
  }
  out.push(tok('gutter.wide', 'dimension', 'semantic', '{space.4}'))
  out.push(tok('gutter.narrow', 'dimension', 'semantic', '{space.2}'))
  out.push(tok('gutter.condensed', 'dimension', 'semantic', '{space.0}'))

  return out
}

/**
 * The component tier: the four parts every screen is actually built from.
 *
 * It stops at four on purpose. A component tier is where token sets start to
 * sprawl, and a table, a tooltip and a dialog that nobody asked for are the
 * tokens that get abandoned first and then quietly contradict the semantics.
 */
function components(): Token[] {
  const out: Token[] = []
  const add = (path: string, type: Token['type'], target: string): void => {
    out.push(tok(path, type, 'component', `{${target}}`))
  }

  add('button.primary.bg', 'color', 'colour.brand.rest')
  add('button.primary.bgHover', 'color', 'colour.brand.hover')
  add('button.primary.text', 'color', 'colour.brand.on')
  add('button.secondary.bg', 'color', 'colour.bg.surface')
  add('button.secondary.border', 'color', 'colour.border.default')
  add('button.secondary.text', 'color', 'colour.text.primary')
  add('button.ghost.text', 'color', 'colour.text.secondary')
  add('button.ghost.bgHover', 'color', 'colour.bg.sunken')
  add('button.radius', 'dimension', 'corner.control')
  add('button.padX', 'dimension', 'pad.md')
  add('button.padY', 'dimension', 'pad.sm')
  add('button.type', 'typography', 'type.bodyStrong')

  add('input.bg', 'color', 'colour.bg.surface')
  add('input.border', 'color', 'colour.border.default')
  add('input.borderFocus', 'color', 'colour.border.focus')
  add('input.text', 'color', 'colour.text.primary')
  add('input.placeholder', 'color', 'colour.text.muted')
  add('input.radius', 'dimension', 'corner.control')
  add('input.pad', 'dimension', 'pad.sm')
  add('input.stroke', 'dimension', 'stroke.hairline')

  add('card.bg', 'color', 'colour.bg.surface')
  add('card.border', 'color', 'colour.border.subtle')
  add('card.radius', 'dimension', 'corner.surface')
  add('card.pad', 'dimension', 'pad.lg')
  add('card.shadow', 'shadow', 'lift.resting')

  add('badge.bg', 'color', 'colour.bg.sunken')
  add('badge.text', 'color', 'colour.text.secondary')
  add('badge.radius', 'dimension', 'corner.pill')
  add('badge.type', 'typography', 'type.caption')

  return out
}

/**
 * A whole studio from one feel.
 *
 * Four sets rather than two, because only colour actually changes with the
 * theme. Type, spacing, corners, lift and motion sit in one set that is on in
 * every theme, so a change to the type scale does not have to be made twice
 * and cannot drift between light and dark.
 */
export function studioFromFeel(name: string, feel: Feel): TokenStudio {
  const paletteId = id('s')
  const shapeId = id('s')
  const lightId = id('s')
  const darkId = id('s')
  const partsId = id('s')

  const sets: TokenSet[] = [
    { id: paletteId, name: 'Palette', order: 0, tokens: palette(feel) },
    { id: shapeId, name: 'Shape', order: 1, tokens: shape() },
    { id: lightId, name: 'Light', order: 2, tokens: colours(false) },
    { id: darkId, name: 'Dark', order: 3, tokens: colours(true) },
    { id: partsId, name: 'Parts', order: 4, tokens: components() }
  ]

  const themes: Theme[] = [
    {
      id: 'light',
      name: 'Light',
      sets: {
        [paletteId]: 'source',
        [shapeId]: 'enabled',
        [lightId]: 'enabled',
        [darkId]: 'off',
        [partsId]: 'enabled'
      }
    },
    {
      id: 'dark',
      name: 'Dark',
      sets: {
        [paletteId]: 'source',
        [shapeId]: 'enabled',
        [lightId]: 'off',
        [darkId]: 'enabled',
        [partsId]: 'enabled'
      }
    }
  ]

  // New libraries start at the bottom of the ladder; a team opts up when it
  // decides it wants to.
  return { id: id('ts'), name, sets, themes, activeTheme: 'light', enforcement: 'advise' }
}

/**
 * The same shape, with nothing decided yet.
 *
 * Some teams already know their tokens and want somewhere to put them rather
 * than a palette to argue with. They still get the five sets and the two
 * themes, because the structure is the part that is hard to invent and the
 * part everything else in the app reads; only the tokens are missing.
 */
export function emptyStudio(name: string): TokenStudio {
  const scaffold = studioFromFeel(name, {
    name,
    primary: '#000000',
    secondary: '#000000',
    tertiary: '#000000',
    headingFont: 'inherit',
    bodyFont: 'inherit',
    corner: 'slight',
    density: 'cozy',
    scale: 'balanced',
    elevation: 'flat'
  })
  return { ...scaffold, sets: scaffold.sets.map((s) => ({ ...s, tokens: [] })) }
}

/**
 * A copy that shares nothing with the original.
 *
 * Cloning is how most libraries actually start: a team likes one that exists
 * and wants to move away from it a little. Set ids are regenerated and the
 * themes are pointed at the new ids, so editing the copy cannot reach back
 * into the library it came from.
 */
export function cloneStudio(studio: TokenStudio, name: string): TokenStudio {
  const remap = new Map<string, string>()
  const sets: TokenSet[] = studio.sets.map((s) => {
    const next = id('s')
    remap.set(s.id, next)
    return { ...s, id: next, tokens: s.tokens.map((t) => ({ ...t })) }
  })
  const themes: Theme[] = studio.themes.map((t) => ({
    ...t,
    sets: Object.fromEntries(
      Object.entries(t.sets).map(([setId, state]) => [remap.get(setId) ?? setId, state])
    )
  }))
  return { ...studio, id: id('ts'), name, sets, themes }
}
