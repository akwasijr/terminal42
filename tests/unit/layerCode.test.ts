import { describe, it, expect } from 'vitest'
import { makeObject } from '../../src/renderer/src/lib/freeformTypes'
import { cssDeclarations, toReactCss, toTailwind } from '../../src/renderer/src/lib/layerCode'

const decl = (o: Parameters<typeof cssDeclarations>[0]): Record<string, string> =>
  Object.fromEntries(cssDeclarations(o))

describe('layer code', () => {
  it('states the box, the paint and the corner', () => {
    const o = { ...makeObject('rect', 0, 0), w: 150, h: 124, radius: 8, fill: '#dddddd', fillEnabled: true }
    const d = decl(o)
    expect(d.width).toBe('150px')
    expect(d.height).toBe('124px')
    expect(d['border-radius']).toBe('8px')
    expect(d['background-color']).toContain('dddddd')
  })

  it('leaves out what the layer does not have', () => {
    const o = { ...makeObject('rect', 0, 0), fillEnabled: false, radius: 0, opacity: 1, rotation: 0 }
    const d = decl(o)
    expect(d['background-color']).toBeUndefined()
    expect(d['border-radius']).toBeUndefined()
    expect(d.opacity).toBeUndefined()
    expect(d.transform).toBeUndefined()
  })

  it('carries opacity, blend mode and rotation once they are set', () => {
    const o = { ...makeObject('rect', 0, 0), opacity: 0.5, blendMode: 'multiply', rotation: 45 }
    const d = decl(o)
    expect(d.opacity).toBe('0.5')
    expect(d['mix-blend-mode']).toBe('multiply')
    expect(d.transform).toBe('rotate(45deg)')
  })

  it('writes text properties for a text layer, not a background', () => {
    const o = { ...makeObject('text', 0, 0), fontSize: 18, fontWeight: 600, color: '#111111' }
    const d = decl(o)
    expect(d['font-size']).toBe('18px')
    expect(d['font-weight']).toBe('600')
    expect(d.color).toContain('111111')
    expect(d['background-color']).toBeUndefined()
  })

  it('gives React a camel-cased style object', () => {
    const o = { ...makeObject('rect', 0, 0), w: 10, h: 10, radius: 4 }
    const css = toReactCss(o)
    expect(css.startsWith('{')).toBe(true)
    expect(css).toContain("borderRadius: '4px'")
    expect(css).not.toContain('border-radius')
  })

  it('maps Tailwind scale steps and falls back to arbitrary values', () => {
    const o = { ...makeObject('rect', 0, 0), w: 150, h: 124, radius: 8, fill: '#dddddd', fillEnabled: true }
    const tw = toTailwind(o)
    expect(tw).toContain('w-[150px]')
    expect(tw).toContain('rounded-lg')
    expect(tw).toContain('bg-[#dddddd]')
    expect(toTailwind({ ...o, radius: 7 })).toContain('rounded-[7px]')
  })

  it('never leaves a space inside a Tailwind arbitrary value', () => {
    const o = { ...makeObject('rect', 0, 0), shadow: true, shadowColor: '#000000', shadowX: 0, shadowY: 2, shadowBlur: 3, shadowSpread: 0 }
    for (const c of toTailwind(o).split(' ')) expect(c.includes(' ')).toBe(false)
  })

  it('names the font weight Tailwind knows', () => {
    const o = { ...makeObject('text', 0, 0), fontWeight: 700 }
    expect(toTailwind(o)).toContain('font-bold')
  })
})
