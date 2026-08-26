import { describe, expect, it } from 'vitest'
import { emptyDoc } from '../../src/shared/motion/defaults'
import {
  hasEffectKeys, hasLayerKeys, resolvedEffects, resolvedLogoLayers, resolvedTextLayers
} from '../../src/shared/motion/frame'
import type { MotionDoc } from '../../src/shared/motion/types'

function docWith(patch: (d: MotionDoc) => MotionDoc): MotionDoc {
  return patch(emptyDoc('grid'))
}

const layer = { id: 't1', text: 'Hello', size: 8, colour: '#fff', x: 50, y: 50 }

function twoKeys(a: number, b: number): { keys: Array<{ id: string; t: number; v: number }> } {
  return { keys: [{ id: 'k1', t: 0, v: a }, { id: 'k2', t: 0.5, v: b }] }
}

describe('keyed text layers', () => {
  it('returns the layers untouched when nothing is keyed', () => {
    const doc = docWith((d) => ({ ...d, visual: { ...d.visual, text: [layer] } }))
    expect(resolvedTextLayers(doc, 0.3)).toBe(doc.visual.text)
    expect(hasLayerKeys(doc)).toBe(false)
  })

  it('moves a keyed field and leaves the rest of the layer alone', () => {
    const doc = docWith((d) => ({
      ...d,
      visual: { ...d.visual, text: [layer] },
      keys: { 'text:t1:y': twoKeys(20, 80) }
    }))
    expect(hasLayerKeys(doc)).toBe(true)
    expect(resolvedTextLayers(doc, 0)[0].y).toBe(20)
    expect(resolvedTextLayers(doc, 0.25)[0].y).toBeCloseTo(50, 5)
    expect(resolvedTextLayers(doc, 0.5)[0].y).toBe(80)
    expect(resolvedTextLayers(doc, 0.25)[0].x).toBe(50)
    expect(resolvedTextLayers(doc, 0.25)[0].text).toBe('Hello')
  })

  it('leaves a layer that has no track of its own alone', () => {
    const other = { ...layer, id: 't2' }
    const doc = docWith((d) => ({
      ...d,
      visual: { ...d.visual, text: [layer, other] },
      keys: { 'text:t1:size': twoKeys(4, 12) }
    }))
    const out = resolvedTextLayers(doc, 0.25)
    expect(out[0].size).toBeCloseTo(8, 5)
    expect(out[1]).toBe(other)
  })

  it('keys a field the layer left unset, starting from the default', () => {
    const doc = docWith((d) => ({
      ...d,
      visual: { ...d.visual, text: [layer] },
      keys: { 'text:t1:opacity': twoKeys(0, 100) }
    }))
    expect(resolvedTextLayers(doc, 0)[0].opacity).toBe(0)
    expect(resolvedTextLayers(doc, 0.5)[0].opacity).toBe(100)
  })
})

describe('keyed logo layers', () => {
  const logo = { id: 'l1', imageId: 'i1', size: 20, opacity: 100, x: 50, y: 50 }

  it('moves a keyed mark', () => {
    const doc = docWith((d) => ({
      ...d,
      visual: { ...d.visual, logos: [logo] },
      keys: { 'logo:l1:x': twoKeys(10, 90) }
    }))
    expect(resolvedLogoLayers(doc, 0)[0].x).toBe(10)
    expect(resolvedLogoLayers(doc, 0.5)[0].x).toBe(90)
    expect(resolvedLogoLayers(doc, 0.5)[0].y).toBe(50)
  })
})

describe('keyed effects', () => {
  it('returns the same object when nothing is keyed', () => {
    const doc = emptyDoc('grid')
    expect(resolvedEffects(doc, 0.4)).toBe(doc.visual.effects)
    expect(hasEffectKeys(doc)).toBe(false)
  })

  it('moves a keyed effect', () => {
    const doc = docWith((d) => ({ ...d, keys: { 'fx:vignette': twoKeys(0, 60) } }))
    expect(hasEffectKeys(doc)).toBe(true)
    expect(resolvedEffects(doc, 0).vignette).toBe(0)
    expect(resolvedEffects(doc, 0.5).vignette).toBe(60)
    expect(resolvedEffects(doc, 0.5).grain).toBe(doc.visual.effects.grain)
  })

  it('leaves the grouped treatments alone, since they are not keyable', () => {
    const doc = docWith((d) => ({ ...d, keys: { 'fx:grain': twoKeys(0, 40) } }))
    expect(resolvedEffects(doc, 0.5).glass).toBe(doc.visual.effects.glass)
    expect(resolvedEffects(doc, 0.5).dropShadow).toBe(doc.visual.effects.dropShadow)
  })
})
