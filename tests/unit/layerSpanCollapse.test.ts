import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { layerVisibility } from '../../src/shared/motion/frame'
import { hydrateDoc } from '../../src/shared/motion/defaults'

const timeline = readFileSync(
  join(__dirname, '../../src/renderer/src/components/motion/MotionTimeline.tsx'),
  'utf8'
)

/**
 * The bug that made layers disappear on a click.
 *
 * A layer with no timing draws its bar full width, so its end is 1. Dragging
 * the bar wrapped both ends with `wrapUnit`, and `wrapUnit(1)` is 0 — so the
 * moment the bar was touched, `from` and `to` both became 0, the window had no
 * width, and `layerVisibility` returned 0 for the whole loop. The layer was
 * gone from the stage, the export and the hit test at once, with nothing on
 * screen to explain it. It took a click, not a drag: the shift was zero and
 * the collapse happened anyway.
 *
 * Two things stop it, and both are worth holding: the end wraps as an end,
 * and a window that covers everything cannot be moved anywhere.
 */
describe('a layer does not vanish when its bar is clicked', () => {
  it('wraps the end of a moved window with wrapEnd, not wrapUnit', () => {
    expect(timeline).toContain('to: wrapEnd(d.to + shift)')
    expect(timeline).not.toContain('to: wrapUnit(d.to + shift)')
  })

  it('refuses to move a bar that has no window', () => {
    // "Always" has nowhere to be dragged to, and letting it move gave a
    // layer timing it never had on the strength of a stray click.
    expect(timeline).toMatch(/if \(!bounded\) return/)
  })

  it('keeps the end of the loop as the end', () => {
    // The helper that was not being used, and the reason it exists.
    expect(timeline).toContain('function wrapEnd')
  })
})

describe('a shut window is repaired where documents are read', () => {
  const shut = { id: 't', text: 'Hi', size: 10, colour: '#fff', x: 50, y: 50 }

  it('drops both ends of a window that has none', () => {
    const doc = hydrateDoc({ componentId: 'slider', visual: { text: [{ ...shut, from: 0, to: 0 }] } })
    const t = doc.visual.text[0]
    expect(t.from).toBeUndefined()
    expect(t.to).toBeUndefined()
    // And so it is on again, everywhere that asks.
    expect(layerVisibility(t, 0)).toBe(1)
    expect(layerVisibility(t, 0.5)).toBe(1)
  })

  it('repairs the exact shape the wrap bug left behind', () => {
    const wrapped = 0.9997735507246377
    const doc = hydrateDoc({
      componentId: 'slider',
      visual: { text: [{ ...shut, from: wrapped, to: wrapped }] }
    })
    expect(doc.visual.text[0].from).toBeUndefined()
    expect(layerVisibility(doc.visual.text[0], 0)).toBe(1)
  })

  it('repairs the other three kinds too, through the one span reader', () => {
    const doc = hydrateDoc({
      componentId: 'slider',
      visual: {
        logos: [{ id: 'l', imageId: 'i', from: 0, to: 0 }],
        shapes: [{ id: 's', kind: 'rect', from: 0.4, to: 0.4 }],
        pictures: [{ id: 'p', imageId: 'i', from: 0.4, to: 0.4 }]
      }
    })
    expect(doc.visual.logos[0].from).toBeUndefined()
    expect(doc.visual.shapes?.[0].from).toBeUndefined()
    expect(doc.visual.pictures?.[0].from).toBeUndefined()
  })

  it('leaves a window that has width exactly as it was', () => {
    const doc = hydrateDoc({
      componentId: 'slider',
      visual: { text: [{ ...shut, from: 0.2, to: 0.8, fade: 0.1 }] }
    })
    expect(doc.visual.text[0]).toMatchObject({ from: 0.2, to: 0.8, fade: 0.1 })
  })

  it('keeps the eye shut across a save and a load', () => {
    // The eye is working state, but it is state: a layer put away has to
    // still be away when the piece is opened again.
    const doc = hydrateDoc({
      componentId: 'slider',
      visual: {
        text: [{ ...shut, hidden: true }],
        logos: [{ id: 'l', imageId: 'i', hidden: true }]
      }
    })
    expect(doc.visual.text[0].hidden).toBe(true)
    expect(doc.visual.logos[0].hidden).toBe(true)
    expect(layerVisibility(doc.visual.text[0], 0.5)).toBe(0)
  })

  it('does not invent an eye for a layer that never had one', () => {
    const doc = hydrateDoc({ componentId: 'slider', visual: { text: [shut] } })
    expect('hidden' in doc.visual.text[0]).toBe(false)
  })
})

describe('a window with no width is still off once loaded', () => {
  it('reads a shut window as shut, which is why it gets repaired on load', () => {
    // layerVisibility keeps its meaning: no width means no time on screen.
    // Repairing the data rather than re-reading it is what keeps that true.
    expect(layerVisibility({ from: 0.3, to: 0.3 }, 0.3)).toBe(0)
  })
})
