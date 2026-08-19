import { layerToCss, baseState, hasAnyKeys } from './timelineModel'
import { type FObj, fontByLabel, googleFontsHref, objectFillCss, objectTextColorCss, outlineCss, borderCss, backdropFilterCss, shapeClipPath, staticFilter, staticBoxShadow, paintCssOf, STROKE_PAINT, transformOriginCss } from './freeformTypes'
import { effectsBoxShadow, effectsFilter, effectsBackdrop, effectsOverlays } from './effects'

// Pure composition of the freeform artboard into a self-contained HTML document,
// so the export logic (and the motion CSS it embeds) can be unit-tested.

export type ArtboardSpec = { w: number; h: number; bg: string }
export type CanvasObject = FObj

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function effectCss(o: FObj, clipped: boolean): string {
  const bs = clipped ? undefined : [staticBoxShadow(o), effectsBoxShadow(o)].filter(Boolean).join(', ') || undefined
  const f = [staticFilter(o, clipped), effectsFilter(o)].filter(Boolean).join(' ')
  const bd = [backdropFilterCss(o), effectsBackdrop(o)].filter(Boolean).join(' ')
  return `${bs ? `box-shadow:${bs};` : ''}${f ? `filter:${f};` : ''}${bd ? `backdrop-filter:${bd};-webkit-backdrop-filter:${bd};` : ''}`
}

/** Absolutely-positioned overlay child divs for noise / glass effects. */
function overlayHtml(o: FObj): string {
  return effectsOverlays(o).map((ov) => {
    const s = `position:absolute;inset:0;border-radius:inherit;pointer-events:none;` +
      (ov.background ? `background:${ov.background};` : '') +
      (ov.backgroundRepeat ? `background-repeat:${ov.backgroundRepeat};` : '') +
      (ov.backgroundSize ? `background-size:${ov.backgroundSize};` : '') +
      (ov.boxShadow ? `box-shadow:${ov.boxShadow};` : '') +
      (ov.opacity != null ? `opacity:${ov.opacity};` : '') +
      (ov.blend ? `mix-blend-mode:${ov.blend};` : '')
    return `<span style="${s}"></span>`
  }).join('')
}

function strokeCss(o: FObj): string {
  return outlineCss(o) + borderCss(o)
}

function transformCss(o: FObj): string {
  const origin = transformOriginCss(o)
  const ori = origin ? `transform-origin:${origin};` : ''
  return (o.rotation ? `transform:rotate(${o.rotation}deg);` : '') + ori
}

function arrowSvg(o: FObj): string {
  const head = Math.max(6, o.strokeWidth * 3)
  const cy = o.h / 2
  return `<svg width="${o.w}" height="${o.h}" style="position:absolute;left:${o.x}px;top:${o.y}px;overflow:visible;${o.opacity !== 1 ? `opacity:${o.opacity};` : ''}${transformCss(o)}">` +
    `<line x1="0" y1="${cy}" x2="${o.w - head}" y2="${cy}" stroke="${o.stroke}" stroke-width="${o.strokeWidth}" />` +
    `<polygon points="${o.w - head},${cy - head} ${o.w},${cy} ${o.w - head},${cy + head}" fill="${o.stroke}" />` +
    `</svg>`
}

function nodeHtml(o: FObj): string {
  const box = `position:absolute;left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;`
  const vis = o.visible ? '' : 'display:none;'
  if (!o.visible) return `<div id="${o.id}" style="display:none"></div>`
  if (o.type === 'arrow') return arrowSvg(o).replace('<svg ', `<svg id="${o.id}" `)
  const clip = shapeClipPath(o)
  const common = `${box}opacity:${o.opacity};${transformCss(o)}${effectCss(o, !!clip)}`
  const blend = o.blendMode && o.blendMode !== 'normal' ? `mix-blend-mode:${o.blendMode};` : ''
  if (o.type === 'text') {
    const font = fontByLabel(o.fontFamily)
    const grad = o.fillMode === 'gradient'
    const paint = o.fillHidden
      ? 'color:transparent;'
      : grad
        ? `color:transparent;background-image:${objectFillCss(o)};-webkit-background-clip:text;background-clip:text;`
        : `color:${objectTextColorCss(o)};`
    const style =
      `${common}${blend}${vis}${paint}font-size:${o.fontSize}px;font-weight:${o.fontWeight};` +
      `font-style:${o.italic ? 'italic' : 'normal'};text-decoration:${o.underline ? 'underline' : 'none'};` +
      `text-align:${o.align};line-height:${o.lineHeight};letter-spacing:${o.letterSpacing}px;` +
      `font-family:${font.stack};white-space:pre-wrap;overflow-wrap:break-word;`
    return `<div id="${o.id}" style="${style}">${esc(o.text)}</div>`
  }
  if (o.type === 'image') {
    const radius = `border-radius:${o.radius}px;`
    if (o.src) {
      return `<img id="${o.id}" src="${o.src}" alt="${esc(o.name)}" style="${common}${blend}${vis}${radius}${strokeCss(o)}object-fit:cover;" />`
    }
    return `<div id="${o.id}" style="${common}${blend}${vis}${radius}${strokeCss(o)}background:${objectFillCss(o)};"></div>`
  }
  if (o.type === 'line') {
    return `<div id="${o.id}" style="${common}${blend}${vis}background:${paintCssOf(o, STROKE_PAINT)};border-radius:${o.strokeWidth}px;"></div>`
  }
  if (o.type === 'path') {
    const sw = Math.max(0.5, o.strokeWidth)
    const strokeC = o.strokeEnabled ? o.stroke : 'none'
    return `<div id="${o.id}" style="${common}${blend}${vis}"><svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none" style="overflow:visible;display:block"><path d="${o.path ?? ''}" fill="none" stroke="${strokeC}" stroke-width="${sw}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" /></svg></div>`
  }
  if (o.type === 'polygon' || o.type === 'star') {
    const fill = o.fillEnabled && !o.fillHidden ? objectFillCss(o) : 'transparent'
    return `<div id="${o.id}" style="${common}${blend}${vis}background:${fill};clip-path:${clip};">${overlayHtml(o)}</div>`
  }
  // frame / rect / ellipse
  const fill = o.fillEnabled && !o.fillHidden ? `background:${objectFillCss(o)};` : ''
  const radius = o.type === 'ellipse' ? 'border-radius:50%;' : `border-radius:${o.radius}px;`
  return `<div id="${o.id}" style="${common}${blend}${vis}${fill}${radius}${strokeCss(o)}">${overlayHtml(o)}</div>`
}

export function composeArtboardHtml(title: string, art: ArtboardSpec, objects: CanvasObject[]): string {
  const motionCss = objects
    .filter((o) => hasAnyKeys(o.motion))
    .map((o) => layerToCss(
      `#${o.id}`,
      `m_${o.id}`,
      o.motion!,
      baseState({ opacity: o.opacity, rotate: o.rotation, blur: o.blur ?? 0, brightness: o.brightness ?? 1, glow: o.glow ?? 0 }),
      o.glowColor ?? '#22d3ee',
      { playback: 'once' },
    ))
    .join('\n')
  const nodes = objects.map(nodeHtml).join('\n    ')
  const fontHref = googleFontsHref(objects.filter((o) => o.type === 'text').map((o) => o.fontFamily))
  const fontLink = fontHref
    ? `<link rel="preconnect" href="https://fonts.googleapis.com" />\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n<link rel="stylesheet" href="${fontHref}" />`
    : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title || 'Canvas')}</title>
${fontLink}
<style>
  *,*::before,*::after{box-sizing:border-box}body{margin:0;background:#f3f4f6;min-height:100dvh;display:grid;place-items:center}
  .artboard{position:relative;width:${art.w}px;height:${art.h}px;background:${art.bg};overflow:hidden}
  ${motionCss}
</style>
</head>
<body>
  <div class="artboard">
    ${nodes}
  </div>
</body>
</html>`
}
