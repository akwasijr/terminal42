import { describe, it, expect } from 'vitest'
import { makeObject, type FObj, objectFillCss, borderCss, objectBoxShadow, staticFilter, backdropFilterCss } from '../../src/renderer/src/lib/freeformTypes'

function obj(over: Partial<FObj>): FObj {
  return { ...makeObject('rect', 0, 0), ...over }
}

describe('effect helpers', () => {
  it('emits a gradient midpoint hint only when mid differs from 0.5', () => {
    const noHint = objectFillCss(obj({ fillMode: 'gradient', gradientAngle: 90, gradientStops: [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 1 }] }))
    expect(noHint).toBe('linear-gradient(90deg, #000000 0%, #ffffff 100%)')
    const withHint = objectFillCss(obj({ fillMode: 'gradient', gradientAngle: 90, gradientStops: [{ color: '#000000', pos: 0, mid: 0.25 }, { color: '#ffffff', pos: 1 }] }))
    expect(withHint).toContain('#000000 0%')
    expect(withHint).toContain(', 25%,')
    expect(withHint).toContain('#ffffff 100%')
  })

  it('builds a border, honouring sides and style', () => {
    expect(borderCss(obj({ borderEnabled: true, borderWidth: 2, borderColor: '#ff0000', borderStyle: 'dashed', borderSides: 'all' }))).toBe('border:2px dashed #ff0000;')
    expect(borderCss(obj({ borderEnabled: true, borderWidth: 1, borderColor: '#000000', borderSides: 'top' }))).toBe('borderTop:1px solid #000000;')
    expect(borderCss(obj({ borderEnabled: true, borderHidden: true }))).toBe('')
    expect(borderCss(obj({ borderEnabled: false }))).toBe('')
  })

  it('composes drop + inner shadow with hex+opacity', () => {
    const o = obj({ shadow: true, shadowColor: '#000000', shadowOpacity: 0.2, shadowX: 0, shadowY: 2, shadowBlur: 3, shadowSpread: 0, innerShadow: true, innerShadowColor: '#ffffff', innerShadowOpacity: 0.5, innerShadowX: 0, innerShadowY: 2, innerShadowBlur: 3, innerShadowSpread: 0 })
    const bs = objectBoxShadow(o)!
    expect(bs).toContain('0px 2px 3px 0px rgba(0,0,0,0.2)')
    expect(bs).toContain('inset 0px 2px 3px 0px rgba(255,255,255,0.5)')
  })

  it('routes a drop-shadow-kind shadow through the filter', () => {
    const f = staticFilter(obj({ shadow: true, shadowDrop: true, shadowColor: '#000000', shadowOpacity: 0.3, shadowX: 1, shadowY: 1, shadowBlur: 4 }), false)
    expect(f).toContain('drop-shadow(1px 1px 4px rgba(0,0,0,0.3))')
    // when shadowDrop, box-shadow omits the drop part
    expect(objectBoxShadow(obj({ shadow: true, shadowDrop: true }))).toBeUndefined()
  })

  it('builds layer and backdrop filter strings from the list', () => {
    const o = obj({ filters: [{ type: 'blur', value: 4 }, { type: 'brightness', value: 120 }, { type: 'backdrop-blur', value: 8 }, { type: 'grayscale', value: 50, hidden: true }] })
    expect(staticFilter(o, false)).toContain('blur(4px) brightness(120%)')
    expect(staticFilter(o, false)).not.toContain('grayscale')
    expect(backdropFilterCss(o)).toBe('blur(8px)')
  })
})
