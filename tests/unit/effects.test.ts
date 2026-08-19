import { describe, it, expect } from 'vitest'
import { makeObject, type FObj } from '../../src/renderer/src/lib/freeformTypes'
import { makeEffect, effectsBoxShadow, effectsFilter, effectsBackdrop, effectsOverlays, migrateEffects, effectsTextureFilters, effectsTextureFilterCss, effectsClipsShape } from '../../src/renderer/src/lib/effects'

const obj = (over: Partial<FObj>): FObj => ({ ...makeObject('rect', 0, 0), ...over })

describe('effects engine', () => {
  it('builds default effects per type', () => {
    expect(makeEffect('drop-shadow').type).toBe('drop-shadow')
    expect(makeEffect('layer-blur').amount).toBe(4)
    expect(makeEffect('noise').noiseMode).toBe('mono')
    expect(makeEffect('glass').refraction).toBe(80)
  })

  it('composes inner + drop shadow into box-shadow', () => {
    const o = obj({ effects: [
      { id: 'a', type: 'drop-shadow', x: 0, y: 4, blur: 4, spread: 0, color: '#000000', opacity: 0.25 },
      { id: 'b', type: 'inner-shadow', x: 0, y: 2, blur: 3, spread: 0, color: '#ffffff', opacity: 0.5 },
    ] })
    const bs = effectsBoxShadow(o)!
    expect(bs).toContain('0px 4px 4px 0px rgba(0,0,0,0.25)')
    expect(bs).toContain('inset 0px 2px 3px 0px rgba(255,255,255,0.5)')
  })

  it('composes layer and background blur', () => {
    expect(effectsFilter(obj({ effects: [{ id: 'a', type: 'layer-blur', amount: 6 }] }))).toBe('blur(6px)')
    expect(effectsBackdrop(obj({ effects: [{ id: 'a', type: 'background-blur', amount: 8 }] }))).toBe('blur(8px)')
    expect(effectsBackdrop(obj({ effects: [{ id: 'g', type: 'glass', frost: 5, dispersion: 50 }] }))).toContain('blur(5px)')
  })

  it('emits noise overlays (mono grain, duo two layers, multi background)', () => {
    const mono = effectsOverlays(obj({ effects: [{ id: 'n', type: 'noise', noiseMode: 'mono', color: '#000000', opacity: 0.3 }] }))
    expect(mono).toHaveLength(1)
    // grain is baked into the image (not a flat rgba wash) so it actually renders
    expect(mono[0].background).toContain('data:image/svg+xml')
    expect(mono[0].backgroundRepeat).toBe('repeat')
    expect(effectsOverlays(obj({ effects: [{ id: 'n', type: 'noise', noiseMode: 'duo' }] }))).toHaveLength(2)
    const multi = effectsOverlays(obj({ effects: [{ id: 'n', type: 'noise', noiseMode: 'multi' }] }))
    expect(multi).toHaveLength(1)
    expect(multi[0].background).toContain('data:image/svg+xml')
  })

  it('builds texture displacement filters with clip flag', () => {
    const o = obj({ effects: [{ id: 't', type: 'texture', sizeX: 4, sizeY: 4, radius: 8, clipShape: true }] })
    const f = effectsTextureFilters(o)
    expect(f).toHaveLength(1)
    expect(f[0].id).toContain('-t')
    expect(f[0].scale).toBe(8)
    expect(effectsTextureFilterCss(o)).toBe(`url(#${f[0].id})`)
    expect(effectsClipsShape(o)).toBe(true)
    // texture does not add overlay spans
    expect(effectsOverlays(o)).toHaveLength(0)
  })

  it('emits glass overlays (tint + sheen + bevel) and a backdrop blur', () => {
    const o = obj({ effects: [{ id: 'g', type: 'glass', frost: 6, intensity: 80, depth: 20, refraction: 80, dispersion: 50 }] })
    expect(effectsOverlays(o).length).toBeGreaterThanOrEqual(3)
    expect(effectsBackdrop(o)).toContain('blur(6px)')
  })

  it('skips hidden effects', () => {
    expect(effectsFilter(obj({ effects: [{ id: 'a', type: 'layer-blur', amount: 6, hidden: true }] }))).toBe('')
  })

  it('migrates legacy shadow + filters into the effects array', () => {
    const o = obj({ shadow: true, shadowColor: '#000000', shadowOpacity: 0.2, shadowX: 0, shadowY: 2, shadowBlur: 3, innerShadow: true, filters: [{ type: 'blur', value: 5 }, { type: 'brightness', value: 120 }] })
    const p = migrateEffects(o)!
    expect(p.shadow).toBe(false)
    expect(p.innerShadow).toBe(false)
    const types = (p.effects ?? []).map((e) => e.type)
    expect(types).toContain('drop-shadow')
    expect(types).toContain('inner-shadow')
    expect(types).toContain('layer-blur')
    // non-blur filters stay
    expect(p.filters).toEqual([{ type: 'brightness', value: 120 }])
    // already-migrated object returns null
    expect(migrateEffects(obj({ effects: [{ id: 'a', type: 'drop-shadow' }] }))).toBeNull()
  })
})
