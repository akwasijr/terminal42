import { describe, it, expect } from 'vitest'
import { composeArtboardHtml } from '../../src/renderer/src/lib/freeformExport'
import { makeObject, type FObj } from '../../src/renderer/src/lib/freeformTypes'

const art = { w: 1280, h: 800, bg: '#ffffff' }

function obj(type: Parameters<typeof makeObject>[0], over: Partial<FObj>): FObj {
  return { ...makeObject(type, over.x ?? 0, over.y ?? 0), ...over }
}

describe('composeArtboardHtml', () => {
  it('produces a self-contained HTML doc with a sized artboard', () => {
    const html = composeArtboardHtml('My canvas', art, [])
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('class="artboard"')
    expect(html).toContain('width:1280px')
    expect(html).toContain('background:#ffffff')
  })

  it('renders a rectangle with fill, radius and position', () => {
    const html = composeArtboardHtml('x', art, [obj('rect', { id: 'r1', x: 10, y: 20, w: 100, h: 60, fill: '#ff0000', radius: 12 })])
    expect(html).toContain('id="r1"')
    expect(html).toContain('left:10px;top:20px;width:100px;height:60px')
    expect(html).toContain('background:#ff0000;')
    expect(html).toContain('border-radius:12px;')
  })

  it('renders an ellipse as a 50% radius element', () => {
    const html = composeArtboardHtml('x', art, [obj('ellipse', { id: 'e1', fill: '#00ff00' })])
    expect(html).toContain('id="e1"')
    expect(html).toContain('border-radius:50%;')
  })

  it('renders rich text styling and escapes content', () => {
    const html = composeArtboardHtml('x', art, [obj('text', { id: 't1', text: 'Hi <there>', fontSize: 28, fontWeight: 700, italic: true, align: 'center', color: '#222222', fontFamily: 'Inter' })])
    expect(html).toContain('id="t1"')
    expect(html).toContain('font-size:28px')
    expect(html).toContain('font-weight:700')
    expect(html).toContain('font-style:italic')
    expect(html).toContain('text-align:center')
    expect(html).toContain('Hi &lt;there&gt;')
  })

  it('emits a Google Fonts link only when a non-system font is used', () => {
    const withFont = composeArtboardHtml('x', art, [obj('text', { id: 't', fontFamily: 'Inter' })])
    expect(withFont).toContain('fonts.googleapis.com/css2?family=Inter')
    const system = composeArtboardHtml('x', art, [obj('text', { id: 't', fontFamily: 'System sans' })])
    expect(system).not.toContain('fonts.googleapis.com')
  })

  it('renders an uploaded image with its src and object-fit', () => {
    const html = composeArtboardHtml('x', art, [obj('image', { id: 'i1', src: 'data:image/png;base64,AAAA', radius: 8 })])
    expect(html).toContain('<img id="i1"')
    expect(html).toContain('src="data:image/png;base64,AAAA"')
    expect(html).toContain('object-fit:cover')
  })

  it('renders a polygon/star with a clip-path', () => {
    const poly = composeArtboardHtml('x', art, [obj('polygon', { id: 'p1', sides: 5, fill: '#fcd34d' })])
    expect(poly).toContain('id="p1"')
    expect(poly).toContain('clip-path:polygon(')
    expect(poly).toContain('background:#fcd34d')
    const star = composeArtboardHtml('x', art, [obj('star', { id: 'st1', points: 6 })])
    expect(star).toContain('clip-path:polygon(')
  })

  it('renders an arrow as an SVG with a shaft line and arrowhead', () => {
    const html = composeArtboardHtml('x', art, [obj('arrow', { id: 'a1', w: 200, h: 2, stroke: '#111827', strokeWidth: 2 })])
    expect(html).toContain('<svg id="a1"')
    expect(html).toContain('<line')
    expect(html).toContain('<polygon')
    expect(html).toContain('stroke="#111827"')
  })

  it('applies opacity, rotation, stroke and shadow', () => {
    const html = composeArtboardHtml('x', art, [obj('rect', { id: 's1', opacity: 0.5, rotation: 30, strokeEnabled: true, strokeWidth: 2, stroke: '#000000', shadow: true, shadowX: 0, shadowY: 8, shadowBlur: 24, shadowSpread: 0, shadowColor: 'rgba(0,0,0,0.2)' })])
    expect(html).toContain('opacity:0.5')
    expect(html).toContain('transform:rotate(30deg)')
    expect(html).toContain('outline:2px solid #000000')
    expect(html).toContain('outline-offset:0px')
    expect(html).toContain('box-shadow:0px 8px 24px 0px rgba(0,0,0,0.2)')
  })

  it('honours the outline position offset', () => {
    const html = composeArtboardHtml('x', art, [obj('rect', { id: 's2', strokeEnabled: true, strokeWidth: 1, stroke: '#000000', strokeOffset: -1 })])
    expect(html).toContain('outline:1px solid #000000')
    expect(html).toContain('outline-offset:-1px')
  })

  it('renders a multi-stop gradient fill', () => {
    const html = composeArtboardHtml('x', art, [obj('rect', { id: 'g1', fillEnabled: true, fillMode: 'gradient', gradientAngle: 90, gradientStops: [{ color: '#db0004', pos: 0 }, { color: '#888888', pos: 0.5 }, { color: '#a4a4a4', pos: 1 }] })])
    expect(html).toContain('linear-gradient(90deg')
    expect(html).toContain('#db0004 0%')
    expect(html).toContain('#888888 50%')
    expect(html).toContain('#a4a4a4 100%')
  })

  it('embeds baked motion CSS for animated objects', () => {
    const html = composeArtboardHtml('x', art, [obj('rect', { id: 'm1', motion: { duration: 500, tracks: { opacity: [{ id: 'a', t: 0, v: 0, easing: 'linear' }, { id: 'b', t: 500, v: 1 }] } } })])
    expect(html).toContain('@keyframes m_m1')
    expect(html).toContain('#m1 { animation: m_m1 500ms linear')
    expect(html).toContain('prefers-reduced-motion')
  })

  it('bakes effect tracks into the animation filter', () => {
    const html = composeArtboardHtml('x', art, [obj('ellipse', { id: 'fx1', glowColor: '#00ffaa', motion: { duration: 400, tracks: { blur: [{ id: 'a', t: 0, v: 0, easing: 'linear' }, { id: 'b', t: 400, v: 8 }] } } })])
    expect(html).toContain('@keyframes m_fx1')
    expect(html).toContain('filter: blur(')
  })

  it('renders a static blur via a CSS filter', () => {
    const html = composeArtboardHtml('x', art, [obj('rect', { id: 'b1', blur: 6 })])
    expect(html).toContain('filter:blur(6px)')
  })
})
