// The document layer: what survives a save, and what the renderer is handed.
//
// These tests guard the two properties the whole feature leans on — that
// easing cannot break a component's loop, and that a stored document opens
// with usable values however much the code has moved on since.

import { describe, expect, it } from 'vitest'
import {
  computePlacements, cardCountFor, imageAssignment, resolvedParams,
  applyOverride, emptyOverride, overrideIsEmpty
} from '../../src/shared/motion/frame'
import { emptyDoc, hydrateDoc, coerceParam, paramsFor } from '../../src/shared/motion/defaults'
import { presetParams, PRESETS_PER_COMPONENT } from '../../src/shared/motion/presets'
import { MOTION_COMPONENTS, componentFor, hasComponent } from '../../src/shared/motion/registry'
import { exportSize } from '../../src/renderer/src/lib/motion/backdrop'
import type { MotionDoc } from '../../src/shared/motion/types'

describe('document defaults', () => {
  it('opens on something that is actually moving', () => {
    const doc = emptyDoc()
    expect(doc.animationEnabled).toBe(true)
    expect(doc.componentEnabled).toBe(true)
    expect(cardCountFor(doc)).toBeGreaterThan(1)
  })

  it('fills in sections a stored document has never heard of', () => {
    const stored = { version: 1, componentId: 'ring', params: {} }
    const doc = hydrateDoc(stored)
    expect(doc.componentId).toBe('ring')
    expect(doc.frame.aspect).toBe('16:9')
    expect(doc.export.fps).toBe(30)
    expect(doc.visual.images).toEqual([])
  })

  it('survives complete nonsense', () => {
    expect(hydrateDoc(null).componentId).toBe('carousel')
    expect(hydrateDoc('not a document').frame.background).toBeTruthy()
  })

  it('clamps a value the schema has since narrowed', () => {
    const spec = { kind: 'slider', key: 'cards', label: 'Cards', min: 1, max: 20, step: 1, default: 10 } as const
    expect(coerceParam(spec, 900)).toBe(20)
    expect(coerceParam(spec, -5)).toBe(1)
    expect(coerceParam(spec, undefined)).toBe(10)
    expect(coerceParam(spec, 'twelve')).toBe(10)
  })

  it('drops a segmented option that no longer exists', () => {
    const spec = {
      kind: 'segmented', key: 'type', label: 'Type', default: 'continuous',
      options: [{ value: 'continuous', label: 'Continuous' }, { value: 'step', label: 'Step' }]
    } as const
    expect(coerceParam(spec, 'step')).toBe('step')
    expect(coerceParam(spec, 'jazz')).toBe('continuous')
  })
})

describe('registry', () => {
  it('knows every component the type union names', () => {
    expect(MOTION_COMPONENTS).toHaveLength(11)
    for (const c of MOTION_COMPONENTS) expect(componentFor(c.id).id).toBe(c.id)
  })

  it('falls back rather than rendering nothing', () => {
    expect(hasComponent('spin')).toBe(false)
    expect(componentFor('spin').id).toBe('carousel')
  })
})

describe('placements', () => {
  it('closes the loop for every component, easing included', () => {
    for (const component of MOTION_COMPONENTS) {
      const doc: MotionDoc = { ...emptyDoc(component.id), easing: { x1: 0.9, y1: 0, x2: 0.1, y2: 1 } }
      const start = computePlacements(doc, 0)
      const end = computePlacements(doc, 1)
      expect(start).toHaveLength(end.length)
      start.forEach((p, i) => {
        for (const key of ['x', 'y', 'z', 'rotX', 'rotY', 'rotZ', 'scale', 'opacity', 'bend'] as const) {
          expect(Math.abs(p[key] - end[i][key])).toBeLessThan(1e-6)
        }
      })
    }
  })

  it('holds every card still when the animation is switched off', () => {
    const doc = { ...emptyDoc('ring'), animationEnabled: false }
    const a = computePlacements(doc, 0.2)
    const b = computePlacements(doc, 0.8)
    expect(a).toEqual(b)
  })

  it('collapses to the resting placement when the component is hidden', () => {
    const doc = { ...emptyDoc('ring'), componentEnabled: false }
    for (const p of computePlacements(doc, 0.3)) {
      expect([p.x, p.y, p.z]).toEqual([0, 0, 0])
      expect(p.scale).toBe(1)
    }
  })
})

describe('image assignment', () => {
  const withImages = (n: number): MotionDoc => ({
    ...emptyDoc(),
    visual: {
      ...emptyDoc().visual,
      images: Array.from({ length: n }, (_, i) => ({ id: `i${i}`, src: `/tmp/${i}.png`, name: `${i}.png` }))
    }
  })

  it('gives every card the placeholder face when there are no images', () => {
    expect(imageAssignment(emptyDoc(), 5)).toEqual([-1, -1, -1, -1, -1])
  })

  it('deals in order', () => {
    expect(imageAssignment(withImages(3), 5)).toEqual([0, 1, 2, 0, 1])
  })

  it('scatters the same way every time, so a card never flickers', () => {
    const doc: MotionDoc = { ...withImages(4), visual: { ...withImages(4).visual, imageOrder: 'scatter' } }
    const first = imageAssignment(doc, 12)
    expect(imageAssignment(doc, 12)).toEqual(first)
    for (const i of first) expect(i).toBeGreaterThanOrEqual(0)
    for (const i of first) expect(i).toBeLessThan(4)
  })
})

describe('presets', () => {
  it('starts from the component defaults', () => {
    for (const component of MOTION_COMPONENTS) {
      expect(presetParams(component, 0)).toEqual(paramsFor(component.schema, undefined))
    }
  })

  it('stays inside the schema and never changes under the user', () => {
    for (const component of MOTION_COMPONENTS) {
      for (let i = 0; i < PRESETS_PER_COMPONENT; i++) {
        const params = presetParams(component, i)
        expect(presetParams(component, i)).toEqual(params)
        for (const spec of component.schema) {
          const v = params[spec.key]
          if (spec.kind === 'slider') {
            expect(v).toBeGreaterThanOrEqual(spec.min)
            expect(v).toBeLessThanOrEqual(spec.max)
          } else if (spec.kind === 'toggle') {
            expect(typeof v).toBe('boolean')
          } else {
            expect(spec.options.map((o) => o.value)).toContain(v)
          }
        }
      }
    }
  })

  it('produces scenes that render rather than collapse', () => {
    for (const component of MOTION_COMPONENTS) {
      for (let i = 0; i < PRESETS_PER_COMPONENT; i++) {
        const doc: MotionDoc = {
          ...emptyDoc(component.id),
          params: { [component.id]: presetParams(component, i) }
        }
        expect(cardCountFor(doc)).toBeGreaterThan(0)
        for (const p of computePlacements(doc, 0.37)) {
          expect(Number.isFinite(p.x + p.y + p.z + p.scale + p.opacity)).toBe(true)
        }
      }
    }
  })
})

describe('export sizing', () => {
  it('treats the chosen number as the height, the way video tools do', () => {
    expect(exportSize('16:9', 1080)).toEqual({ width: 1920, height: 1080 })
    expect(exportSize('9:16', 1080)).toEqual({ width: 608, height: 1080 })
    expect(exportSize('1:1', 720)).toEqual({ width: 720, height: 720 })
  })

  it('never hands an odd dimension to an H.264 encoder', () => {
    for (const aspect of ['16:9', '4:5', '9:16', '1:1', '4:3'] as const) {
      for (const res of [720, 1080, 1440, 2160]) {
        const { width, height } = exportSize(aspect, res)
        expect(width % 2).toBe(0)
        expect(height % 2).toBe(0)
      }
    }
  })
})

describe('resolved parameters', () => {
  it('prefers what the document stored over the defaults', () => {
    const doc: MotionDoc = { ...emptyDoc('ring'), params: { ring: { cards: 7 } } }
    expect(resolvedParams(doc).cards).toBe(7)
    expect(cardCountFor(doc)).toBe(7)
  })

  it('keeps each set of settings when you switch between components', () => {
    const doc: MotionDoc = {
      ...emptyDoc('ring'),
      params: { ring: { cards: 7 }, carousel: { cards: 30 } }
    }
    expect(resolvedParams(doc).cards).toBe(7)
    expect(resolvedParams({ ...doc, componentId: 'carousel' }).cards).toBe(30)
  })
})

describe('hand edits', () => {
  const moved = (): MotionDoc => ({
    ...emptyDoc('ring'),
    overrides: { '2': { ...emptyOverride(), dx: 1.5, dy: -0.5, drotZ: 0.2, scale: 2 } }
  })

  it('offsets the card the pattern produced rather than replacing it', () => {
    const plain = computePlacements(emptyDoc('ring'), 0.4)
    const edited = computePlacements(moved(), 0.4)
    expect(edited[2].x).toBeCloseTo(plain[2].x + 1.5, 6)
    expect(edited[2].y).toBeCloseTo(plain[2].y - 0.5, 6)
    expect(edited[2].scale).toBeCloseTo(plain[2].scale * 2, 6)
    expect(edited[1]).toEqual(plain[1])
  })

  it('keeps the loop closed, so a moved card does not jump at the seam', () => {
    const doc = moved()
    const a = computePlacements(doc, 0)
    const b = computePlacements(doc, 1)
    expect(a[2].x).toBeCloseTo(b[2].x, 6)
    expect(a[2].rotZ).toBeCloseTo(b[2].rotZ, 6)
  })

  it('travels with the pattern when the numbers change', () => {
    const doc = moved()
    const wider: MotionDoc = { ...doc, params: { ring: { ...resolvedParams(doc), radius: 6 } } }
    const plainWider = computePlacements({ ...wider, overrides: {} }, 0.4)
    expect(computePlacements(wider, 0.4)[2].x).toBeCloseTo(plainWider[2].x + 1.5, 6)
  })

  it('treats a do-nothing override as no override', () => {
    expect(overrideIsEmpty(undefined)).toBe(true)
    expect(overrideIsEmpty(emptyOverride())).toBe(true)
    expect(overrideIsEmpty({ ...emptyOverride(), dx: 0.01 })).toBe(false)
    expect(overrideIsEmpty({ ...emptyOverride(), imageId: 'i1' })).toBe(false)
  })

  it('leaves a placement alone when there is nothing to apply', () => {
    const p = computePlacements(emptyDoc(), 0.1)[0]
    expect(applyOverride(p, undefined)).toBe(p)
  })

  it('repairs an override written by an older version', () => {
    const doc = hydrateDoc({ version: 1, componentId: 'ring', overrides: { '1': { dx: 2 }, '9': 'rubbish' } })
    expect(doc.overrides['1']).toEqual({ ...emptyOverride(), dx: 2 })
    expect(doc.overrides['9']).toBeUndefined()
    for (const p of computePlacements(doc, 0.5)) expect(Number.isFinite(p.x)).toBe(true)
  })

  it('gives a card the picture dropped on it, and leaves the others in order', () => {
    const base = emptyDoc()
    const doc: MotionDoc = {
      ...base,
      visual: {
        ...base.visual,
        images: [
          { id: 'a', src: '/a.png', name: 'a' },
          { id: 'b', src: '/b.png', name: 'b' }
        ]
      },
      overrides: { '0': { ...emptyOverride(), imageId: 'b' } }
    }
    expect(imageAssignment(doc, 4)).toEqual([1, 1, 0, 1])
  })

  it('falls back to the running order when the pinned picture is gone', () => {
    const doc: MotionDoc = {
      ...emptyDoc(),
      visual: { ...emptyDoc().visual, images: [{ id: 'a', src: '/a.png', name: 'a' }] },
      overrides: { '0': { ...emptyOverride(), imageId: 'deleted' } }
    }
    expect(imageAssignment(doc, 2)).toEqual([0, 0])
  })
})
