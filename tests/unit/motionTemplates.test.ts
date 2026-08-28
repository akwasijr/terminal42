// Templates are data, and data rots quietly.
//
// A template names parameters by string and sets them to numbers chosen by
// hand. Nothing stops it naming a parameter that has been renamed, or setting
// a radius above the slider's maximum: the document still opens, it just
// opens wrong, and only in the one template nobody clicked. So the check is
// mechanical. Every template is built and measured against the schema the app
// would show for it, and against the loader that would clean it up.

import { describe, expect, it } from 'vitest'
import { MOTION_TEMPLATES, templateById } from '../../src/shared/motion/templates'
import { componentFor, hasComponent } from '../../src/shared/motion/registry'
import { hydrateDoc } from '../../src/shared/motion/defaults'
import { resolvedText } from '../../src/shared/motion/types'
import type { ImageRef } from '../../src/shared/motion/types'

const IMAGES: ImageRef[] = [
  { id: 'a', src: '/tmp/a.png', name: 'A' },
  { id: 'b', src: '/tmp/b.png', name: 'B' },
  { id: 'c', src: '/tmp/c.png', name: 'C' }
]

describe('motion templates', () => {
  it('offers enough to choose between', () => {
    // Six visual languages, each in the portrait and landscape shapes a piece
    // actually ships in. Deliberately a short list: a gallery of thirty
    // near-identical starting points is harder to choose from than a gallery
    // of twelve that are each obviously a different thing.
    expect(MOTION_TEMPLATES.length).toBeGreaterThanOrEqual(12)
  })

  it('gives every template a distinct id and name', () => {
    expect(new Set(MOTION_TEMPLATES.map((t) => t.id)).size).toBe(MOTION_TEMPLATES.length)
    expect(new Set(MOTION_TEMPLATES.map((t) => t.name)).size).toBe(MOTION_TEMPLATES.length)
  })

  it('finds a template by id, and nothing by a made-up one', () => {
    expect(templateById(MOTION_TEMPLATES[0].id)?.name).toBe(MOTION_TEMPLATES[0].name)
    expect(templateById('no-such-template')).toBeNull()
  })

  for (const t of MOTION_TEMPLATES) {
    describe(t.name, () => {
      const doc = t.build(IMAGES)

      it('names a component that exists', () => {
        expect(hasComponent(doc.componentId)).toBe(true)
      })

      it('sets only parameters the component has, within their ranges', () => {
        const schema = componentFor(doc.componentId).schema
        const params = doc.params[doc.componentId] ?? {}
        for (const [key, value] of Object.entries(params)) {
          const spec = schema.find((s) => s.key === key)
          expect(spec, `${t.id} sets unknown parameter ${key}`).toBeTruthy()
          if (!spec) continue
          if (spec.kind === 'slider') {
            expect(typeof value).toBe('number')
            expect(value as number, `${t.id}.${key}`).toBeGreaterThanOrEqual(spec.min)
            expect(value as number, `${t.id}.${key}`).toBeLessThanOrEqual(spec.max)
          }
          if (spec.kind === 'select') {
            expect(spec.options.map((o) => o.value), `${t.id}.${key}`).toContain(value)
          }
          if (spec.kind === 'toggle') expect(typeof value).toBe('boolean')
        }
      })

      // The loader clamps anything out of range and drops anything it does
      // not recognise. If loading changes a template, the template was wrong
      // and the user would never have seen what it was written to look like.
      it('survives a load unchanged', () => {
        expect(hydrateDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc)
      })

      it('puts its type inside the frame', () => {
        const ids = doc.visual.text.map((l) => l.id)
        expect(new Set(ids).size).toBe(ids.length)
        for (const raw of doc.visual.text) {
          const layer = resolvedText(raw)
          expect(layer.text.trim().length).toBeGreaterThan(0)
          expect(layer.x).toBeGreaterThanOrEqual(0)
          expect(layer.x).toBeLessThanOrEqual(100)
          expect(layer.y).toBeGreaterThanOrEqual(0)
          expect(layer.y).toBeLessThanOrEqual(100)
          expect(layer.size).toBeGreaterThan(0)
          expect(layer.colour).toMatch(/^#[0-9a-f]{6}$/i)
        }
      })

      it('keeps every timed layer inside the loop', () => {
        for (const layer of doc.visual.text) {
          for (const field of ['from', 'to', 'fade'] as const) {
            const v = layer[field]
            if (v === undefined) continue
            expect(v, `${t.id}.${layer.id}.${field}`).toBeGreaterThanOrEqual(0)
            expect(v, `${t.id}.${layer.id}.${field}`).toBeLessThanOrEqual(1)
          }
          // A window needs both ends. One alone reads as a half-written edit
          // rather than a decision, and the drawing would treat it as always.
          expect(layer.from === undefined, `${t.id}.${layer.id} half a window`).toBe(layer.to === undefined)
          if (layer.fade !== undefined) expect(layer.fade).toBeLessThanOrEqual(0.5)
        }
      })

      // The whole point of a template is that it looks finished. These are the
      // cheapest mechanical stand-ins for that: type with a hierarchy rather
      // than one line, and a frame with some depth to it.
      it('sets more than one line of type', () => {
        expect(doc.visual.text.length).toBeGreaterThanOrEqual(2)
        const sizes = doc.visual.text.map((l) => l.size)
        expect(Math.max(...sizes) / Math.min(...sizes)).toBeGreaterThan(1.2)
      })

      it('keeps every block of type inside the frame', () => {
        // A text layer is centred on its y, so a six-line headline set at
        // y: 6 has half of itself above the top edge. Nothing catches that at
        // runtime -- the piece just opens with its first two lines missing --
        // and the template's own thumbnail is drawn from the same frame, so
        // the gallery advertises the fault as if it were the design.
        //
        // Size is a percentage of the frame's height, which makes the block's
        // height exactly computable: the baselines are (lines - 1) steps
        // apart, plus one line of body.
        const doc = t.build(IMAGES)
        for (const raw of doc.visual.text) {
          const layer = resolvedText(raw)
          if (!layer.text.trim()) continue
          const lines = layer.text.split('\n').length
          const height = (lines - 1) * layer.size * layer.lineHeight + layer.size
          // Every y the layer is ever set to, not only the one it starts on.
          const ys = [layer.y]
          for (const [target, track] of Object.entries(doc.keys ?? {})) {
            if (target !== `text:${layer.id}:y`) continue
            for (const key of track.keys) ys.push(key.v)
          }
          for (const y of ys) {
            expect(y - height / 2, `${t.id}.${layer.id} top`).toBeGreaterThanOrEqual(-1)
            expect(y + height / 2, `${t.id}.${layer.id} bottom`).toBeLessThanOrEqual(101)
          }
        }
      })

      it('gives the frame some depth', () => {
        const fx = doc.visual.effects
        const treated =
          fx.dropShadow.enabled || fx.edgeBlur.enabled || fx.edgeShade.enabled || fx.glass.enabled
        const graded =
          fx.grain > 0 || fx.vignette > 0 || fx.tintAmount > 0 || fx.saturation !== 100 || fx.contrast !== 100
        expect(treated || graded, `${t.id} is untreated`).toBe(true)
      })

      // Transform is in scene units, not percentages, and the panel's own
      // sliders are the honest statement of what is on screen. A template
      // that moved the piece by 24 put it outside the frame entirely, and
      // nothing but looking at it would have said so.
      it('keeps the piece inside the frame', () => {
        expect(Math.abs(doc.transform.positionX), `${t.id} moved across`).toBeLessThanOrEqual(8)
        expect(Math.abs(doc.transform.positionY), `${t.id} moved up`).toBeLessThanOrEqual(8)
        expect(doc.transform.scale).toBeGreaterThanOrEqual(0.1)
        expect(doc.transform.scale).toBeLessThanOrEqual(3)
      })

      it('arrives with its pictures on the cards', () => {
        expect(doc.visual.images).toEqual(IMAGES)
      })

      it('starts with the grid off, since a template is meant to look finished', () => {
        expect(doc.frame.gridVisible).toBe(false)
        expect(doc.frame.background).toMatch(/^#[0-9a-f]{6}$/i)
      })

      it('keys only things that exist, inside the loop', () => {
        const schema = componentFor(doc.componentId).schema
        for (const [target, track] of Object.entries(doc.keys ?? {})) {
          if (target.startsWith('param:')) {
            const key = target.slice('param:'.length)
            expect(schema.some((s) => s.key === key), `${t.id} keys unknown ${target}`).toBe(true)
          } else if (target.startsWith('text:')) {
            // A track naming a layer that is not there is a track that does
            // nothing, and a typo in a layer id is invisible on screen.
            const [, layerId, field] = target.split(':')
            expect(doc.visual.text.some((l) => l.id === layerId), `${t.id} keys missing layer ${target}`).toBe(true)
            expect(['size', 'x', 'y', 'opacity', 'tracking'], `${t.id}: ${target}`).toContain(field)
          } else if (target.startsWith('shape:') || target.startsWith('picture:')) {
            // Scenery is keyed by layer id like type is, and carries the same
            // risk: a track naming a panel that was renamed still loads, still
            // shows a row in the timeline, and still does nothing at all.
            const [, layerId, field] = target.split(':')
            const layers = target.startsWith('shape:')
              ? (doc.visual.shapes ?? [])
              : (doc.visual.pictures ?? [])
            expect(layers.some((l) => l.id === layerId), `${t.id} keys missing layer ${target}`).toBe(true)
            expect(
              ['width', 'height', 'x', 'y', 'opacity', 'rotation'],
              `${t.id}: ${target}`
            ).toContain(field)
          } else if (target.startsWith('fx:')) {
            expect(
              ['blur', 'grain', 'vignette', 'shadow', 'brightness', 'contrast', 'saturation', 'tintAmount'],
              `${t.id}: ${target}`
            ).toContain(target.slice('fx:'.length))
          } else {
            expect(target).toMatch(/^pose:tilt[XYZ]$/)
          }
          expect(track.keys.length).toBeGreaterThan(1)
          const ids = track.keys.map((k) => k.id)
          expect(new Set(ids).size).toBe(ids.length)
          for (const k of track.keys) {
            expect(k.t).toBeGreaterThanOrEqual(0)
            expect(k.t).toBeLessThan(1)
          }
        }
      })
    })
  }

  it('builds the same document twice', () => {
    for (const t of MOTION_TEMPLATES) {
      expect(t.build(IMAGES)).toEqual(t.build(IMAGES))
    }
  })

  it('builds without pictures, which is what the gallery previews', () => {
    for (const t of MOTION_TEMPLATES) {
      expect(t.build([]).visual.images).toEqual([])
    }
  })
})
