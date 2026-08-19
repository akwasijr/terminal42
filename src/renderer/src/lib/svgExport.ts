import { type FObj, fontByLabel, objectTextColorCss } from './freeformTypes'
import { baseState, sampleLayer, hasAnyKeys, sampleTrack } from './timelineModel'

// Compose the artboard into a static SVG (shapes, text, images). Used for SVG
// download and as the source for PNG rasterization. Effects (blur/shadow) are
// intentionally omitted to keep the SVG clean and canvas-rasterizable.

export type ArtboardSpec = { w: number; h: number; bg: string }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function polyPoints(o: FObj): string {
  const cx = o.x + o.w / 2
  const cy = o.y + o.h / 2
  const rx = o.w / 2
  const ry = o.h / 2
  const out: string[] = []
  if (o.type === 'polygon') {
    const n = Math.max(3, Math.round(o.sides ?? 3))
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
      out.push(`${(cx + rx * Math.cos(a)).toFixed(1)},${(cy + ry * Math.sin(a)).toFixed(1)}`)
    }
  } else {
    const n = Math.max(3, Math.round(o.points ?? 5))
    const inner = Math.max(0.1, Math.min(0.9, o.innerRatio ?? 0.45))
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 === 0 ? 1 : inner
      const a = -Math.PI / 2 + (i * Math.PI) / n
      out.push(`${(cx + rx * r * Math.cos(a)).toFixed(1)},${(cy + ry * r * Math.sin(a)).toFixed(1)}`)
    }
  }
  return out.join(' ')
}

function transform(o: FObj): string {
  return o.rotation ? ` transform="rotate(${o.rotation} ${(o.x + o.w / 2).toFixed(1)} ${(o.y + o.h / 2).toFixed(1)})"` : ''
}

function stroke(o: FObj): string {
  return o.strokeEnabled && o.strokeWidth > 0 ? ` stroke="${o.stroke}" stroke-width="${o.strokeWidth}"` : ''
}

function node(o: FObj): string {
  if (!o.visible) return ''
  const op = o.opacity !== 1 ? ` opacity="${o.opacity}"` : ''
  const tf = transform(o)
  if (o.type === 'text') {
    const font = fontByLabel(o.fontFamily)
    const anchor = o.align === 'center' ? 'middle' : o.align === 'right' ? 'end' : 'start'
    const ax = o.align === 'center' ? o.x + o.w / 2 : o.align === 'right' ? o.x + o.w : o.x
    const lh = o.fontSize * o.lineHeight
    const lines = String(o.text).split('\n')
    const spans = lines
      .map((ln, i) => `<tspan x="${ax}" dy="${i === 0 ? o.fontSize : lh}">${esc(ln)}</tspan>`)
      .join('')
    return `<text x="${ax}" y="${o.y}" fill="${objectTextColorCss(o)}" font-family="${esc(font.stack)}" font-size="${o.fontSize}" font-weight="${o.fontWeight}" font-style="${o.italic ? 'italic' : 'normal'}" ${o.underline ? 'text-decoration="underline" ' : ''}letter-spacing="${o.letterSpacing}" text-anchor="${anchor}"${op}${tf}>${spans}</text>`
  }
  if (o.type === 'image' && o.src) {
    return `<image x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" href="${o.src}" preserveAspectRatio="xMidYMid slice"${op}${tf} />`
  }
  if (o.type === 'ellipse') {
    const fill = o.fillEnabled ? o.fill : 'none'
    return `<ellipse cx="${o.x + o.w / 2}" cy="${o.y + o.h / 2}" rx="${o.w / 2}" ry="${o.h / 2}" fill="${fill}"${stroke(o)}${op}${tf} />`
  }
  if (o.type === 'polygon' || o.type === 'star') {
    return `<polygon points="${polyPoints(o)}" fill="${o.fill}"${op}${tf} />`
  }
  if (o.type === 'line') {
    const cy = o.y + o.h / 2
    return `<line x1="${o.x}" y1="${cy}" x2="${o.x + o.w}" y2="${cy}" stroke="${o.stroke}" stroke-width="${Math.max(1, o.h)}"${op}${tf} />`
  }
  if (o.type === 'arrow') {
    const cy = o.y + o.h / 2
    const head = Math.max(6, o.strokeWidth * 3)
    return `<g${op}${tf}><line x1="${o.x}" y1="${cy}" x2="${o.x + o.w - head}" y2="${cy}" stroke="${o.stroke}" stroke-width="${o.strokeWidth}" /><polygon points="${o.x + o.w - head},${cy - head} ${o.x + o.w},${cy} ${o.x + o.w - head},${cy + head}" fill="${o.stroke}" /></g>`
  }
  if (o.type === 'path') {
    const sw = Math.max(0.5, o.strokeWidth)
    const strokeC = o.strokeEnabled ? o.stroke : 'none'
    return `<g${op}${tf}><svg x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" viewBox="0 0 1 1" preserveAspectRatio="none" overflow="visible"><path d="${o.path ?? ''}" fill="none" stroke="${strokeC}" stroke-width="${sw}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" /></svg></g>`
  }
  // rect / frame / image-without-src
  const fill = o.fillEnabled || o.type === 'image' ? o.fill : 'none'
  const rx = o.radius ? ` rx="${o.radius}"` : ''
  return `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}"${rx} fill="${fill}"${stroke(o)}${op}${tf} />`
}

export function composeArtboardSvg(art: ArtboardSpec, objects: FObj[]): string {
  const body = objects.map(node).filter(Boolean).join('\n  ')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${art.w}" height="${art.h}" viewBox="0 0 ${art.w} ${art.h}">
  <rect x="0" y="0" width="${art.w}" height="${art.h}" fill="${art.bg}" />
  ${body}
</svg>`
}

/** An object's geometry at animation time `t` (ms): applies the translate/scale/
 * rotate/opacity from its motion (plus any inherited parent translation) so a
 * static SVG frame can be composed. Effects are not rendered in SVG frames. */
function objAtTime(o: FObj, t: number, pdx = 0, pdy = 0): FObj {
  if (!hasAnyKeys(o.motion)) return pdx || pdy ? { ...o, x: o.x + pdx, y: o.y + pdy } : o
  const base = baseState({ opacity: o.opacity, rotate: o.rotation, blur: o.blur ?? 0, brightness: o.brightness ?? 1, glow: o.glow ?? 0 })
  const s = sampleLayer(o.motion!, t, base)
  const w = o.w * s.scale
  const h = o.h * s.scale
  return {
    ...o,
    x: o.x + s.x + pdx - (w - o.w) / 2,
    y: o.y + s.y + pdy - (h - o.h) / 2,
    w,
    h,
    rotation: s.rotate,
    opacity: Math.max(0, Math.min(1, s.opacity)),
  }
}

/** Accumulated translation an object inherits from parented ancestors at time t. */
function inheritedTranslate(o: FObj, byId: Map<string, FObj>, t: number): { x: number; y: number } {
  let px = 0, py = 0, cur = o.parent ? byId.get(o.parent) : undefined, guard = 0
  while (cur && guard++ < 64) {
    if (cur.motion) { px += sampleTrack(cur.motion.tracks.x, t, 0); py += sampleTrack(cur.motion.tracks.y, t, 0) }
    cur = cur.parent ? byId.get(cur.parent) : undefined
  }
  return { x: px, y: py }
}

/** Compose a single animation frame (the artboard at time `t`) as a flat SVG. */
export function frameSvg(art: ArtboardSpec, objects: FObj[], t: number): string {
  const byId = new Map(objects.map((o) => [o.id, o]))
  return composeArtboardSvg(art, objects.map((o) => { const p = inheritedTranslate(o, byId, t); return objAtTime(o, t, p.x, p.y) }))
}
