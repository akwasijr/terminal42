import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { canvasPaint, isGradient, linearGradient } from '../../src/renderer/src/lib/motion/paint'

const toolbar = readFileSync(
  join(__dirname, '../../src/renderer/src/components/motion/FrameToolbar.tsx'),
  'utf8'
)
const backdrop = readFileSync(
  join(__dirname, '../../src/renderer/src/lib/motion/backdrop.ts'),
  'utf8'
)

/** Just enough of a 2D context to record what a gradient was asked to be. */
function fakeCtx(): CanvasRenderingContext2D {
  return {
    createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
      const stops: Array<[number, string]> = []
      return { x0, y0, x1, y1, stops, addColorStop: (o: number, c: string) => { stops.push([o, c]) } }
    }
  } as unknown as CanvasRenderingContext2D
}

describe('a background is one string whether it is flat or a run', () => {
  it('tells the two apart', () => {
    expect(isGradient('linear-gradient(180deg, #000000, #ffffff)')).toBe(true)
    expect(isGradient('#ff0000')).toBe(false)
    expect(isGradient('')).toBe(false)
  })

  it('spells a gradient one way, so the parser and the callers agree', () => {
    expect(linearGradient(180, '#000000', '#ffffff'))
      .toBe('linear-gradient(180deg, #000000, #ffffff)')
    expect(isGradient(linearGradient(45, '#123456', '#abcdef'))).toBe(true)
  })

  it('hands a flat colour straight through', () => {
    expect(canvasPaint(fakeCtx(), '#ff0000', 100, 100)).toBe('#ff0000')
  })

  it('builds a canvas gradient with both stops in order', () => {
    const g = canvasPaint(fakeCtx(), linearGradient(180, '#000000', '#ffffff'), 100, 100) as never
    expect((g as { stops: Array<[number, string]> }).stops)
      .toEqual([[0, '#000000'], [1, '#ffffff']])
  })

  it('runs top to bottom for 180deg, the way CSS does', () => {
    const g = canvasPaint(fakeCtx(), linearGradient(180, '#000000', '#ffffff'), 100, 200) as never
    const { x0, y0, x1, y1 } = g as { x0: number; y0: number; x1: number; y1: number }
    expect(x0).toBeCloseTo(50)
    expect(x1).toBeCloseTo(50)
    expect(y0).toBeCloseTo(0)
    expect(y1).toBeCloseTo(200)
  })

  it('runs left to right for 90deg', () => {
    const g = canvasPaint(fakeCtx(), linearGradient(90, '#000000', '#ffffff'), 200, 100) as never
    const { x0, x1, y0, y1 } = g as { x0: number; x1: number; y0: number; y1: number }
    expect(x0).toBeCloseTo(0)
    expect(x1).toBeCloseTo(200)
    expect(y0).toBeCloseTo(50)
    expect(y1).toBeCloseTo(50)
  })

  it('falls back rather than throwing on something it cannot read', () => {
    // A frame that will not paint is worse than one painted the old way.
    expect(canvasPaint(fakeCtx(), 'radial-gradient(red, blue)', 10, 10))
      .toBe('radial-gradient(red, blue)')
    expect(canvasPaint(fakeCtx(), 'linear-gradient(90deg, red)', 10, 10))
      .toBe('linear-gradient(90deg, red)')
  })

  it('is what the backdrop actually paints with', () => {
    expect(backdrop).toContain('canvasPaint(ctx, frame.background, width, height)')
  })
})

describe('the palette opens under the dot, not along the toolbar', () => {
  it('is a panel of its own rather than more buttons in the row', () => {
    expect(toolbar).toContain("aria-label=\"Choose a background\"")
    expect(toolbar).toMatch(/absolute left-1\/2 top-full[^"]*z-30/)
  })

  it('lays the colours out as a grid', () => {
    expect(toolbar).toContain('grid grid-cols-6')
  })

  it('offers runs between colours as well as flat ones', () => {
    expect(toolbar).toContain('linearGradient(')
    expect(toolbar).toMatch(/>Gradient<\/p>/)
  })

  it('builds the runs from the brand where it can', () => {
    expect(toolbar).toMatch(/brand\.length > 1 \? \[linearGradient\(160, brand\[0\], brand\[1\]\)\]/)
  })

  it('closes once you have chosen, and on Escape', () => {
    expect(toolbar).toMatch(/onChange\(hex\); setOpen\(false\)/)
    expect(toolbar).toMatch(/e\.key === 'Escape'.*setOpen\(false\)/)
  })

  it('does not set its headings in spaced capitals', () => {
    expect(toolbar).not.toMatch(/uppercase tracking-wide[^"]*">Colour/)
  })
})
