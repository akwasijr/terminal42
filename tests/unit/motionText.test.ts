import { describe, it, expect } from 'vitest'
import { drawOverlay } from '../../src/renderer/src/lib/motion/backdrop'
import { resolvedText, TEXT_DEFAULTS, type TextLayer } from '../../src/shared/motion/types'

// Same reasoning as motionEffects: there is no working 2D canvas under node,
// so drawing is checked against a stand-in that records what it was told to
// do. That is the right level for this anyway — what matters is that a font
// property reaches the context at all, since the failure being guarded
// against is a property that the panel offers and the drawing quietly ignores.
function mul(m: number[], n: number[]): number[] {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5]
  ]
}

class FakeCtx {
  calls: string[] = []
  globalAlpha = 1
  fillStyle = '#000000'
  font = ''
  letterSpacing = '0px'
  textAlign = 'start'
  textBaseline = 'alphabetic'

  // Text is drawn about the origin and placed by the canvas transform, so the
  // stand-in has to keep a real matrix. Recording the raw arguments instead
  // would make every one of these read `0,0` and stop saying anything about
  // where the words actually land.
  private m = [1, 0, 0, 1, 0, 0]
  private stack: number[][] = []

  save(): void { this.calls.push('save'); this.stack.push([...this.m]) }
  restore(): void { this.calls.push('restore'); this.m = this.stack.pop() ?? [1, 0, 0, 1, 0, 0] }

  translate(x: number, y: number): void {
    this.m = mul(this.m, [1, 0, 0, 1, x, y])
  }
  rotate(a: number): void {
    this.m = mul(this.m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0])
  }
  scale(x: number, y: number): void {
    this.m = mul(this.m, [x, 0, 0, y, 0, 0])
  }
  /** Where a point in the current frame of reference lands on the canvas. */
  at(x: number, y: number): { x: number; y: number } {
    const [a, b, c, d, e, f] = this.m
    return { x: a * x + c * y + e, y: b * x + d * y + f }
  }

  fillText(text: string, x: number, y: number): void {
    const p = this.at(x, y)
    this.calls.push(`fillText ${JSON.stringify(text)} ${Math.round(p.x)},${Math.round(p.y)}`)
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    const p = this.at(x, y)
    this.calls.push(`fillRect ${Math.round(p.x)},${Math.round(p.y)},${Math.round(w)},${Math.round(h)}`)
  }
  measureText(text: string): { width: number } {
    // Enough to make alignment arithmetic observable without a real font.
    return { width: text.length * 10 }
  }
}

function draw(layers: TextLayer[], w = 1000, h = 1000): FakeCtx {
  const ctx = new FakeCtx()
  drawOverlay(ctx as unknown as CanvasRenderingContext2D, layers, w, h)
  return ctx
}

const base: TextLayer = { id: 't1', text: 'Hello', size: 10, colour: '#ffffff', x: 50, y: 50 }

describe('text layer defaults', () => {
  it('settles every typographic field a layer leaves out', () => {
    const r = resolvedText(base)
    expect(r.font).toBe(TEXT_DEFAULTS.font)
    expect(r.weight).toBe(TEXT_DEFAULTS.weight)
    expect(r.align).toBe(TEXT_DEFAULTS.align)
    expect(r.lineHeight).toBe(TEXT_DEFAULTS.lineHeight)
    expect(r.tracking).toBe(TEXT_DEFAULTS.tracking)
    expect(r.opacity).toBe(TEXT_DEFAULTS.opacity)
    expect(r.italic).toBe(false)
    expect(r.underline).toBe(false)
    expect(r.caps).toBe(false)
  })

  it('keeps what the layer does say', () => {
    const r = resolvedText({ ...base, font: 'Sora', weight: 800, align: 'left', opacity: 40 })
    expect(r.font).toBe('Sora')
    expect(r.weight).toBe(800)
    expect(r.align).toBe('left')
    expect(r.opacity).toBe(40)
  })

  // A piece saved before any of this existed has none of these fields, and
  // must open looking exactly as it did. That is the whole reason they are
  // optional rather than migrated in.
  it('draws a layer with no typographic fields exactly as it always did', () => {
    const ctx = draw([base])
    expect(ctx.textAlign).toBe('center')
    expect(ctx.globalAlpha).toBe(1)
    expect(ctx.font).toContain('600')
    expect(ctx.font).toContain('100px')
    expect(ctx.font).toContain('DM Sans')
    expect(ctx.calls).toContain('fillText "Hello" 500,500')
  })
})

describe('drawOverlay typography', () => {
  it('puts weight, style and family into the font it sets', () => {
    const ctx = draw([{ ...base, font: 'Sora', weight: 800, italic: true }])
    expect(ctx.font).toMatch(/^italic 800 100px/)
    expect(ctx.font).toContain('Sora')
  })

  it('falls back to a real stack when the family is not one we know', () => {
    const ctx = draw([{ ...base, font: 'Not A Font' }])
    expect(ctx.font).toContain('sans-serif')
  })

  it('carries alignment through to the context', () => {
    expect(draw([{ ...base, align: 'left' }]).textAlign).toBe('left')
    expect(draw([{ ...base, align: 'right' }]).textAlign).toBe('right')
  })

  it('scales tracking with the type, not the frame', () => {
    // 10% of a 100px face is 10px; the same layer in a frame twice as tall has
    // a 200px face and so 20px of tracking. Were tracking a pixel count it
    // would stay at 10 and the words would close up as the frame grew.
    expect(draw([{ ...base, tracking: 10 }], 1000, 1000).letterSpacing).toBe('10px')
    expect(draw([{ ...base, tracking: 10 }], 2000, 2000).letterSpacing).toBe('20px')
  })

  it('fades a layer without touching its colour', () => {
    const ctx = draw([{ ...base, opacity: 25 }])
    expect(ctx.globalAlpha).toBe(0.25)
    expect(ctx.fillStyle).toBe('#ffffff')
  })

  it('draws nothing at all for a fully transparent layer', () => {
    expect(draw([{ ...base, opacity: 0 }]).calls).toHaveLength(0)
  })

  it('draws capitals without rewriting the text the user typed', () => {
    const layer: TextLayer = { ...base, text: 'hello', caps: true }
    expect(draw([layer]).calls).toContain('fillText "HELLO" 500,500')
    expect(layer.text).toBe('hello')
  })
})

describe('drawOverlay multi-line text', () => {
  it('draws one line per newline', () => {
    const ctx = draw([{ ...base, text: 'one\ntwo\nthree' }])
    const drawn = ctx.calls.filter((c) => c.startsWith('fillText'))
    expect(drawn).toHaveLength(3)
  })

  it('centres the block on the anchor rather than hanging it below', () => {
    // Three lines of 100px at 1.2em step 120px apart, centred on y=500, so the
    // middle line sits on the anchor and the outer two straddle it.
    const ctx = draw([{ ...base, text: 'a\nb\nc', lineHeight: 1.2 }])
    expect(ctx.calls).toContain('fillText "a" 500,380')
    expect(ctx.calls).toContain('fillText "b" 500,500')
    expect(ctx.calls).toContain('fillText "c" 500,620')
  })

  it('spaces lines by line height', () => {
    const tight = draw([{ ...base, text: 'a\nb', lineHeight: 1 }])
    const loose = draw([{ ...base, text: 'a\nb', lineHeight: 2 }])
    const gap = (ctx: FakeCtx): number => {
      const ys = ctx.calls.filter((c) => c.startsWith('fillText')).map((c) => Number(c.split(',').pop()))
      return ys[1] - ys[0]
    }
    expect(gap(tight)).toBe(100)
    expect(gap(loose)).toBe(200)
  })

  it('leaves a single line where it was whatever the line height', () => {
    expect(draw([{ ...base, lineHeight: 2.5 }]).calls).toContain('fillText "Hello" 500,500')
  })
})

describe('drawOverlay underline', () => {
  it('draws a rule only when asked', () => {
    expect(draw([base]).calls.some((c) => c.startsWith('fillRect'))).toBe(false)
    expect(draw([{ ...base, underline: true }]).calls.some((c) => c.startsWith('fillRect'))).toBe(true)
  })

  it('puts the rule under the line, not under the block', () => {
    // Two lines, each underlined: two rules at different heights.
    const ctx = draw([{ ...base, text: 'a\nb', underline: true }])
    const rules = ctx.calls.filter((c) => c.startsWith('fillRect'))
    expect(rules).toHaveLength(2)
    expect(rules[0]).not.toBe(rules[1])
  })

  it('follows the alignment of the line it sits under', () => {
    const xOf = (align: 'left' | 'center' | 'right'): number => {
      const ctx = draw([{ ...base, underline: true, align }])
      const rule = ctx.calls.find((c) => c.startsWith('fillRect')) as string
      return Number(rule.split(' ')[1].split(',')[0])
    }
    // "Hello" measures 50 wide in the stand-in, anchored at x=500.
    expect(xOf('left')).toBe(500)
    expect(xOf('center')).toBe(475)
    expect(xOf('right')).toBe(450)
  })

  it('skips the rule on a blank line', () => {
    const ctx = draw([{ ...base, text: 'a\n\nb', underline: true }])
    expect(ctx.calls.filter((c) => c.startsWith('fillRect'))).toHaveLength(2)
  })
})

describe('drawOverlay resolution independence', () => {
  it('places and sizes type as a fraction of the frame', () => {
    const small = draw([{ ...base, size: 10, x: 25, y: 40 }], 1000, 1000)
    const large = draw([{ ...base, size: 10, x: 25, y: 40 }], 4000, 4000)
    expect(small.calls).toContain('fillText "Hello" 250,400')
    expect(large.calls).toContain('fillText "Hello" 1000,1600')
    expect(small.font).toContain('100px')
    expect(large.font).toContain('400px')
  })
})
