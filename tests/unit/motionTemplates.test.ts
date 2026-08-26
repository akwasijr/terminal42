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
    expect(MOTION_TEMPLATES.length).toBeGreaterThanOrEqual(15)
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
