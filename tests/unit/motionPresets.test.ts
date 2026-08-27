// What a strip of presets has to be worth looking at.
import { describe, expect, it } from 'vitest'
import { MOTION_COMPONENTS } from '../../src/shared/motion/registry'
import { PRESETS_PER_COMPONENT, presetParams } from '../../src/shared/motion/presets'
import { peakOnScreen } from '../../src/shared/motion/visibility'

describe('presets', () => {
  it('never offers one that shows an empty frame', () => {
    const blank: string[] = []
    for (const component of MOTION_COMPONENTS) {
      for (let i = 0; i < PRESETS_PER_COMPONENT; i++) {
        if (peakOnScreen(component, presetParams(component, i)) < 2) blank.push(`${component.id} ${i}`)
      }
    }
    expect(blank).toEqual([])
  })

  it('gets three cards in shot wherever the arrangement can manage it', () => {
    const sparse: string[] = []
    for (const component of MOTION_COMPONENTS) {
      for (let i = 0; i < PRESETS_PER_COMPONENT; i++) {
        const params = presetParams(component, i)
        const floor = Math.min(3, component.cardCount(params))
        if (peakOnScreen(component, params) < floor) sparse.push(`${component.id} ${i + 1}`)
      }
    }
    expect(sparse).toEqual([])
  })

  it('gives the same numbers every time it is asked', () => {
    const component = MOTION_COMPONENTS[0]
    expect(presetParams(component, 7)).toEqual(presetParams(component, 7))
  })

  it('hands out a copy, so a caller cannot edit the strip for everyone else', () => {
    const component = MOTION_COMPONENTS[0]
    const first = presetParams(component, 3)
    const before = first['cards']
    first['cards'] = -999
    expect(presetParams(component, 3)['cards']).toBe(before)
  })

  it('starts every strip at the component defaults', () => {
    for (const component of MOTION_COMPONENTS) {
      const first = presetParams(component, 0)
      for (const spec of component.schema) expect(first[spec.key]).toEqual(spec.default)
    }
  })

  it('does not give two components the same value for a shared parameter', () => {
    // The bug this replaces: the seed ignored the component, so any parameter
    // named the same and ranged the same in two arrangements drew the
    // identical number at every index. Carousel, Card drop, Elevator and Spin
    // all carry a card scale of 0.1 to 4 defaulting to 1, and all four moved
    // together — pick preset 8 anywhere and the cards were the same size.
    const shared = ['carousel', 'card-drop', 'elevator', 'spin'].map(
      (id) => MOTION_COMPONENTS.find((c) => c.id === id)!
    )
    let identical = 0
    for (let i = 1; i < PRESETS_PER_COMPONENT; i++) {
      const column = shared.map((c) => presetParams(c, i)['cardScale'])
      if (new Set(column).size === 1) identical++
    }
    expect(identical).toBe(0)
  })

  it('keeps every sampled value inside its own slider range', () => {
    for (const component of MOTION_COMPONENTS) {
      for (let i = 0; i < PRESETS_PER_COMPONENT; i++) {
        const params = presetParams(component, i)
        for (const spec of component.schema) {
          if (spec.kind !== 'slider') continue
          expect(params[spec.key]).toBeGreaterThanOrEqual(spec.min)
          expect(params[spec.key]).toBeLessThanOrEqual(spec.max)
        }
      }
    }
  })
})

describe('inShot', () => {
  it('counts a card behind the lens as out of frame', () => {
    const at = (z: number): number =>
      peakOnScreen(
        { ...MOTION_COMPONENTS[0], cardCount: () => 1, layout: () => ({
          x: 0, y: 0, z, rotX: 0, rotY: 0, rotZ: 0, scale: 1, opacity: 1, bend: 0, bendAxis: 'vertical'
        }) },
        {}
      )
    expect(at(0)).toBe(1)
    expect(at(20)).toBe(0)
  })

  it('counts a fully transparent card as out of frame', () => {
    const peak = peakOnScreen(
      { ...MOTION_COMPONENTS[0], cardCount: () => 1, layout: () => ({
        x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1, opacity: 0, bend: 0, bendAxis: 'vertical'
      }) },
      {}
    )
    expect(peak).toBe(0)
  })
})
