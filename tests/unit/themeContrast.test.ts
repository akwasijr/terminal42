import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The theme, measured rather than admired.
 *
 * Every value in here was arrived at by calculation, and every one of them
 * looks fine to the eye at a glance — which is exactly how the light theme
 * ended up with a panel and the page one contrast point apart, and muted
 * text below AA on three of the five surfaces it lands on. A grey nudged by
 * four points is invisible in review and fatal on screen, so the invariants
 * are asserted instead of remembered.
 */

const CSS = readFileSync(
  resolve(__dirname, '../../src/renderer/src/styles/globals.css'),
  'utf8'
)

type RGB = [number, number, number]

/** The tokens declared in one block, so light and dark are read separately. */
function block(selector: string): Map<string, RGB> {
  const start = CSS.indexOf(selector + ' {')
  if (start < 0) throw new Error(`no ${selector} block in globals.css`)
  const end = CSS.indexOf('\n}', start)
  const body = CSS.slice(start, end)
  const out = new Map<string, RGB>()
  for (const m of body.matchAll(/--([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
    out.set(m[1], [Number(m[2]), Number(m[3]), Number(m[4])])
  }
  return out
}

function luminance([r, g, b]: RGB): number {
  const lin = [r, g, b].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

function contrast(a: RGB, b: RGB): number {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** Darkest to lightest in the light theme, and the reverse in the dark one. */
const ORDER = ['sunken', 'bg', 'elevated', 'surface', 'raised'] as const

const THEMES: Array<{ name: string; selector: string; order: readonly string[] }> = [
  { name: 'light', selector: ':root', order: ORDER },
  { name: 'dark', selector: '.dark', order: ['bg', 'sunken', 'surface', 'elevated', 'raised'] }
]

describe.each(THEMES)('$name theme', ({ selector, order }) => {
  const tokens = block(selector)
  const surfaces = order.map((n) => {
    const v = tokens.get(n)
    if (!v) throw new Error(`missing --${n}`)
    return [n, v] as const
  })

  it('declares every surface, text and status token', () => {
    for (const n of [...order, 'text-primary', 'text-secondary', 'text-muted', 'success', 'warning', 'error']) {
      expect(tokens.get(n), `--${n}`).toBeDefined()
    }
  })

  it('orders the surfaces monotonically', () => {
    // Elevated was once darker than the page it sat on, so a lifted row read
    // as a hole. Ordering is the cheapest thing to get wrong and to check.
    const lums = surfaces.map(([, v]) => luminance(v))
    for (let i = 1; i < lums.length; i++) {
      expect(lums[i], `${surfaces[i][0]} vs ${surfaces[i - 1][0]}`).toBeGreaterThan(lums[i - 1])
    }
  })

  it('separates each surface from the one next to it', () => {
    // Below about 1.06 two large flat greys read as a single sheet.
    for (let i = 1; i < surfaces.length; i++) {
      const r = contrast(surfaces[i][1], surfaces[i - 1][1])
      expect(r, `${surfaces[i - 1][0]} vs ${surfaces[i][0]} = ${r.toFixed(3)}`).toBeGreaterThanOrEqual(1.06)
    }
  })

  it('separates a panel from the page behind it', () => {
    const bg = tokens.get('bg')!
    const surface = tokens.get('surface')!
    expect(contrast(bg, surface)).toBeGreaterThanOrEqual(1.1)
  })

  it.each(['text-primary', 'text-secondary', 'text-muted'])(
    'keeps %s above AA on every surface',
    (name) => {
      const fg = tokens.get(name)!
      for (const [sn, s] of surfaces) {
        const r = contrast(fg, s)
        expect(r, `--${name} on --${sn} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  )

  it.each(['success', 'warning', 'error'])('keeps %s readable as text on every surface', (name) => {
    // These are words and glyphs far more often than they are fills, so the
    // text threshold is the one that governs them.
    const fg = tokens.get(name)!
    for (const [sn, s] of surfaces) {
      const r = contrast(fg, s)
      expect(r, `--${name} on --${sn} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('pairs accent with text that can be read on it', () => {
    const accent = tokens.get('accent')!
    const onAccent = tokens.get('accent-text')!
    expect(contrast(accent, onAccent)).toBeGreaterThanOrEqual(4.5)
  })

  it('draws the edge of a field so it is present but never harsh', () => {
    // A field paints its own background at --elevated, so that is the only
    // tone its edge is ever drawn over. It has to be findable at rest
    // without carving the panel into boxes, so the edge is held in a band:
    // below 1.12 it disappears, above 2.2 it reads as a drawn line. The loud
    // state is focus, asserted below.
    const line = tokens.get('field-line')
    expect(line, '--field-line').toBeDefined()
    const r = contrast(line!, tokens.get('elevated')!)
    expect(r, `--field-line on --elevated = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(1.12)
    expect(r, `--field-line on --elevated = ${r.toFixed(2)}`).toBeLessThanOrEqual(2.2)
  })

  it('keeps the focus ring at 3:1 against every surface', () => {
    // WCAG 1.4.11. The resting edge is deliberately quiet, so this is the
    // one that has to carry the requirement.
    const accent = tokens.get('accent')!
    for (const [sn, s] of surfaces) {
      const r = contrast(accent, s)
      expect(r, `--accent on --${sn} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('pairs the action colour with text that can be read on it', () => {
    expect(contrast(tokens.get('action')!, tokens.get('action-text')!)).toBeGreaterThanOrEqual(4.5)
  })
})
