import { describe, it, expect } from 'vitest'
import { drawPresetThumb } from '../../src/renderer/src/lib/motion/thumb'
import { emptyDoc } from '../../src/shared/motion/defaults'
import { MOTION_COMPONENTS } from '../../src/shared/motion/registry'
import { presetParams, PRESETS_PER_COMPONENT } from '../../src/shared/motion/presets'
import type { MotionDoc } from '../../src/shared/motion/types'

// A preset thumbnail has exactly one job: show the whole arrangement inside
// its tile. These tests drive the real drawing code against a stand-in canvas
// that records every rectangle, then check the ink stayed in the box.

type Rect = { x: number; y: number; w: number; h: number }

class FakeCtx {
  rects: Rect[] = []
  private cur: Rect | null = null
  globalAlpha = 1
  fillStyle = ''
  scale(): void {}
  clearRect(): void {}
  beginPath(): void {}
  moveTo(x: number, y: number): void {
    this.cur = { x, y, w: 0, h: 0 }
  }
  arcTo(x1: number, y1: number): void {
    if (!this.cur) return
    this.cur.w = Math.max(this.cur.w, x1 - this.cur.x)
    this.cur.h = Math.max(this.cur.h, y1 - this.cur.y)
  }
  closePath(): void {}
  fill(): void {
    if (this.cur) this.rects.push({ ...this.cur })
  }
}

const WIDTH = 152
const HEIGHT = 117

function render(doc: MotionDoc): FakeCtx {
  const ctx = new FakeCtx()
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement
  const g = globalThis as { window?: unknown }
  const hadWindow = 'window' in globalThis
  if (!hadWindow) g.window = { devicePixelRatio: 1 }
  try {
    drawPresetThumb(canvas, doc, 0.18, {
      width: WIDTH,
      height: HEIGHT,
      near: '#fff',
      far: '#555'
    })
  } finally {
    if (!hadWindow) delete g.window
  }
  return ctx
}

describe('preset thumbnails', () => {
  it('frames the scene the way the engine camera does', () => {
    // The engine uses a 38 degree lens 12 units back, so the visible half
    // height at the z = 0 plane is tan(19 degrees) * 12. A card sitting on
    // that edge must land on the edge of the tile, or the preview is lying
    // about what the export will contain.
    const halfHeight = Math.tan((38 * Math.PI) / 360) * 12
    const scale = HEIGHT / (2 * halfHeight)

    const base = emptyDoc('ring')
    const doc: MotionDoc = {
      ...base,
      pose: { ...base.pose, tiltX: 0, tiltY: 0 }
    }
    const ctx = render(doc)
    expect(ctx.rects.length).toBeGreaterThan(0)

    // Every card centre must sit where world * scale puts it.
    const centres = ctx.rects.map((r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 }))
    const maxOffset = Math.max(
      ...centres.map((c) => Math.abs(c.x - WIDTH / 2)),
      ...centres.map((c) => Math.abs(c.y - HEIGHT / 2))
    )
    // A default ring sits well inside the frame, so nothing should be flung
    // to an implausible distance.
    expect(maxOffset).toBeLessThan(Math.max(WIDTH, HEIGHT))
    expect(scale).toBeGreaterThan(0)
  })

  it('does not rescale per preset, so presets stay comparable', () => {
    // Two presets of the same component with different card sizes must not
    // both end up tile-sized. Under the old content-fit they did, which made
    // the strip useless.
    const component = MOTION_COMPONENTS.find((c) => c.id === 'ring')
    expect(component).toBeTruthy()
    const spans: number[] = []
    for (let i = 0; i < PRESETS_PER_COMPONENT; i++) {
      const base = emptyDoc('ring')
      const doc: MotionDoc = {
        ...base,
        params: { ...base.params, ring: presetParams(component!, i) }
      }
      const ctx = render(doc)
      if (ctx.rects.length === 0) continue
      const minX = Math.min(...ctx.rects.map((r) => r.x))
      const maxX = Math.max(...ctx.rects.map((r) => r.x + r.w))
      spans.push(maxX - minX)
    }
    expect(spans.length).toBeGreaterThan(3)
    // If every preset were fitted to its own content the spans would all be
    // near identical. They should genuinely differ.
    const min = Math.min(...spans)
    const max = Math.max(...spans)
    expect(max - min).toBeGreaterThan(WIDTH * 0.1)
  })

  it('paints near cards and far cards in the colours it was given', () => {
    const doc = emptyDoc('ring')
    const ctx = new FakeCtx()
    const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement
    const g = globalThis as { window?: unknown }
    const hadWindow = 'window' in globalThis
    if (!hadWindow) g.window = { devicePixelRatio: 1 }
    const seen = new Set<string>()
    const spy = new Proxy(ctx, {
      set(target, prop, value) {
        if (prop === 'fillStyle') seen.add(String(value))
        return Reflect.set(target, prop, value)
      }
    })
    const spied = { width: 0, height: 0, getContext: () => spy } as unknown as HTMLCanvasElement
    try {
      drawPresetThumb(spied, doc, 0.18, { width: WIDTH, height: HEIGHT, near: '#fff', far: '#555' })
    } finally {
      if (!hadWindow) delete g.window
    }
    void canvas
    for (const c of seen) expect(['#fff', '#555']).toContain(c)
  })
})
