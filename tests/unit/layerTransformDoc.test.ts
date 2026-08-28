import { describe, it, expect } from 'vitest'
import { hydrateDoc } from '../../src/shared/motion/defaults'
import { resolvedTextLayers, resolvedLogoLayers } from '../../src/shared/motion/frame'
import type { MotionDoc } from '../../src/shared/motion/types'

const text = { id: 't', text: 'Hi', size: 10, colour: '#fff', x: 50, y: 50 }
const logo = { id: 'l', imageId: 'i' }
const shape = { id: 's', kind: 'rect' }

const load = (visual: Record<string, unknown>): MotionDoc =>
  hydrateDoc({ componentId: 'slider', visual })

describe('the transform survives being written down', () => {
  it('keeps a turn, a scale and an anchor on all four kinds', () => {
    const t = { rotation: 30, scale: 150, anchor: { x: 0, y: 1 } }
    const doc = load({
      text: [{ ...text, ...t }],
      logos: [{ ...logo, ...t }],
      shapes: [{ ...shape, ...t }],
      pictures: [{ id: 'p', imageId: 'i', ...t }]
    })
    for (const layer of [
      doc.visual.text[0], doc.visual.logos[0], doc.visual.shapes![0], doc.visual.pictures![0]
    ]) {
      expect(layer.rotation).toBe(30)
      expect(layer.scale).toBe(150)
      expect(layer.anchor).toEqual({ x: 0, y: 1 })
    }
  })

  it('does not write a transform onto a layer that has none', () => {
    // Absent means untouched, so filling every layer in with rotation: 0
    // would be noise in the file and a lie about what was set.
    const doc = load({ text: [text], logos: [logo] })
    expect('rotation' in doc.visual.text[0]).toBe(false)
    expect('scale' in doc.visual.text[0]).toBe(false)
    expect('anchor' in doc.visual.text[0]).toBe(false)
    expect('scale' in doc.visual.logos[0]).toBe(false)
  })

  it('treats values that mean nothing as nothing', () => {
    const doc = load({ text: [{ ...text, rotation: 0, scale: 100, anchor: { x: 0.5, y: 0.5 } }] })
    expect('rotation' in doc.visual.text[0]).toBe(false)
    expect('scale' in doc.visual.text[0]).toBe(false)
    expect('anchor' in doc.visual.text[0]).toBe(false)
  })

  it('drops half an anchor rather than guessing the other half', () => {
    const doc = load({ text: [{ ...text, anchor: { x: 0 } }] })
    expect(doc.visual.text[0].anchor).toBeUndefined()
  })

  it('clamps what came back wrong instead of drawing NaN', () => {
    const doc = load({
      text: [{ ...text, rotation: 9000, scale: -50, anchor: { x: 4, y: -2 } }]
    })
    expect(doc.visual.text[0].rotation).toBe(360)
    expect(doc.visual.text[0].scale).toBe(0)
    expect(doc.visual.text[0].anchor).toEqual({ x: 1, y: 0 })
  })

  it('ignores a transform that is not numbers at all', () => {
    const doc = load({ text: [{ ...text, rotation: 'sideways', scale: null }] })
    expect('rotation' in doc.visual.text[0]).toBe(false)
    expect('scale' in doc.visual.text[0]).toBe(false)
  })
})

describe('the transform can be keyframed', () => {
  const keyed = (target: string, from: number, to: number): MotionDoc['keys'] => ({
    [target]: {
      keys: [
        { id: 'a', t: 0, v: from },
        { id: 'b', t: 1, v: to }
      ]
    }
  })

  it('turns a text layer that never set a rotation, starting from upright', () => {
    // The track has to have a number to start from, and "unset" is not one.
    const doc = { ...load({ text: [text] }), keys: keyed('text:t:rotation', 0, 90) }
    // Sampled inside the loop rather than at 1, which is the seam and wraps
    // back round to 0.
    expect(resolvedTextLayers(doc, 0)[0].rotation ?? 0).toBe(0)
    expect(resolvedTextLayers(doc, 0.5)[0].rotation).toBeCloseTo(45, 5)
    expect(resolvedTextLayers(doc, 0.75)[0].rotation).toBeCloseTo(67.5, 5)
  })

  it('scales a logo from its natural size when nothing was set', () => {
    const doc = { ...load({ logos: [logo] }), keys: keyed('logo:l:scale', 100, 300) }
    expect(resolvedLogoLayers(doc, 0)[0].scale ?? 100).toBe(100)
    expect(resolvedLogoLayers(doc, 0.5)[0].scale).toBeCloseTo(200, 5)
  })

  it('leaves layers alone when nothing is keyed against them', () => {
    const doc = load({ text: [text], logos: [logo] })
    expect(resolvedTextLayers(doc, 0.5)[0]).toBe(doc.visual.text[0])
    expect(resolvedLogoLayers(doc, 0.5)[0]).toBe(doc.visual.logos[0])
  })
})
