import { describe, it, expect } from 'vitest'
import { composeArtboardSvg } from '../../src/renderer/src/lib/svgExport'
import { makeObject, type FObj } from '../../src/renderer/src/lib/freeformTypes'

const art = { w: 400, h: 300, bg: '#ffffff' }
const obj = (type: Parameters<typeof makeObject>[0], over: Partial<FObj>): FObj => ({ ...makeObject(type, over.x ?? 0, over.y ?? 0), ...over })

describe('composeArtboardSvg', () => {
  it('wraps the artboard in an svg with the background', () => {
    const svg = composeArtboardSvg(art, [])
    expect(svg).toContain('<svg')
    expect(svg).toContain('width="400"')
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).toContain('viewBox="0 0 400 300"')
  })
  it('renders rect, ellipse, polygon and text', () => {
    const svg = composeArtboardSvg(art, [
      obj('rect', { id: 'r', x: 10, y: 10, w: 50, h: 40, fill: '#ff0000', radius: 6 }),
      obj('ellipse', { id: 'e', x: 80, y: 10, w: 40, h: 40, fill: '#00ff00' }),
      obj('polygon', { id: 'p', x: 130, y: 10, w: 40, h: 40, sides: 3, fill: '#0000ff' }),
      obj('text', { id: 't', x: 10, y: 80, text: 'Hi <there>', fontSize: 20 }),
    ])
    expect(svg).toContain('<rect x="10" y="10" width="50" height="40" rx="6" fill="#ff0000"')
    expect(svg).toContain('<ellipse')
    expect(svg).toContain('<polygon points="')
    expect(svg).toContain('<text')
    expect(svg).toContain('Hi &lt;there&gt;')
  })
  it('skips hidden objects', () => {
    const svg = composeArtboardSvg(art, [obj('rect', { id: 'hidden', visible: false })])
    expect(svg).not.toContain('id="hidden"')
  })
})
