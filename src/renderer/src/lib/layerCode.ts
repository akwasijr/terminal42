import { type FObj, objectFillCss, objectTextColorCss, outlineCss, borderCss, staticBoxShadow, fontByLabel } from './freeformTypes'
import { effectsBoxShadow, effectsFilter, effectsBackdrop } from './effects'
import { parseAnyColor } from './color'

// "Copy as" formats for a canvas layer: the CSS a developer would write, and the
// nearest Tailwind utilities. Both are pure so they can be unit tested and reused
// by the context menu, the assistant and the exporter.

/** The layer's paint and box as plain CSS declarations, in a stable order. */
export function cssDeclarations(o: FObj): [string, string][] {
  const out: [string, string][] = []
  out.push(['width', `${Math.round(o.w)}px`])
  out.push(['height', `${Math.round(o.h)}px`])
  if (o.type === 'text') {
    const f = fontByLabel(o.fontFamily ?? '')
    if (f?.stack) out.push(['font-family', f.stack])
    if (o.fontSize) out.push(['font-size', `${Math.round(o.fontSize)}px`])
    if (o.fontWeight) out.push(['font-weight', String(o.fontWeight)])
    if (o.lineHeight) out.push(['line-height', String(o.lineHeight)])
    if (o.letterSpacing) out.push(['letter-spacing', `${o.letterSpacing}px`])
    if (o.align) out.push(['text-align', o.align])
    out.push(['color', objectTextColorCss(o)])
  } else if (o.fillEnabled && !o.fillHidden) {
    const fill = objectFillCss(o)
    if (fill) out.push([(o.fillMode ?? 'solid') === 'solid' ? 'background-color' : 'background', fill])
  }
  if (o.radius) out.push(['border-radius', `${Math.round(o.radius)}px`])
  const border = borderCss(o)
  if (border) out.push(['border', border])
  const outline = outlineCss(o)
  if (outline) out.push(['outline', outline])
  const shadow = [staticBoxShadow(o), effectsBoxShadow(o)].filter(Boolean).join(', ')
  if (shadow) out.push(['box-shadow', shadow])
  const filter = effectsFilter(o).trim()
  if (filter) out.push(['filter', filter])
  const backdrop = effectsBackdrop(o).trim()
  if (backdrop) out.push(['backdrop-filter', backdrop])
  if (o.opacity < 1) out.push(['opacity', String(Number(o.opacity.toFixed(3)))])
  if (o.blendMode && o.blendMode !== 'normal') out.push(['mix-blend-mode', o.blendMode])
  if (o.rotation) out.push(['transform', `rotate(${o.rotation}deg)`])
  return out
}

/** A React `style` object literal, ready to paste into JSX. */
export function toReactCss(o: FObj): string {
  const camel = (p: string): string => p.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
  const body = cssDeclarations(o)
    .map(([p, v]) => `  ${camel(p)}: '${v.replace(/'/g, "\\'")}',`)
    .join('\n')
  return `{\n${body}\n}`
}

/** Nearest Tailwind utilities. Values Tailwind has no scale step for become
 * arbitrary values in square brackets, which is what Tailwind itself suggests. */
export function toTailwind(o: FObj): string {
  const cls: string[] = []
  const px = (n: number): string => `${Math.round(n)}px`
  cls.push(`w-[${px(o.w)}]`, `h-[${px(o.h)}]`)

  if (o.type === 'text') {
    if (o.fontSize) cls.push(`text-[${px(o.fontSize)}]`)
    const weight: Record<number, string> = { 100: 'font-thin', 200: 'font-extralight', 300: 'font-light', 400: 'font-normal', 500: 'font-medium', 600: 'font-semibold', 700: 'font-bold', 800: 'font-extrabold', 900: 'font-black' }
    if (o.fontWeight && weight[o.fontWeight]) cls.push(weight[o.fontWeight])
    if (o.lineHeight) cls.push(`leading-[${o.lineHeight}]`)
    if (o.letterSpacing) cls.push(`tracking-[${o.letterSpacing}px]`)
    if (o.align && o.align !== 'left') cls.push(`text-${o.align}`)
    const c = hexOf(objectTextColorCss(o))
    if (c) cls.push(`text-[${c}]`)
  } else if (o.fillEnabled && !o.fillHidden) {
    const fill = objectFillCss(o)
    const c = hexOf(fill)
    if (c) cls.push(`bg-[${c}]`)
    else if (fill) cls.push(`bg-[${fill.replace(/\s+/g, '_')}]`)
  }

  if (o.radius) {
    const step: Record<number, string> = { 2: 'rounded-sm', 4: 'rounded', 6: 'rounded-md', 8: 'rounded-lg', 12: 'rounded-xl', 16: 'rounded-2xl', 24: 'rounded-3xl' }
    cls.push(step[Math.round(o.radius)] ?? `rounded-[${px(o.radius)}]`)
  }
  if (o.borderEnabled && !o.borderHidden) {
    const w = Math.round(o.borderWidth ?? 1)
    cls.push(w === 1 ? 'border' : `border-[${w}px]`)
    const c = hexOf(o.borderColor ?? '')
    if (c) cls.push(`border-[${c}]`)
    if (o.borderStyle && o.borderStyle !== 'solid') cls.push(`border-${o.borderStyle}`)
  }
  const shadow = [staticBoxShadow(o), effectsBoxShadow(o)].filter(Boolean).join(', ')
  if (shadow) cls.push(`shadow-[${shadow.replace(/\s+/g, '_')}]`)
  if (o.opacity < 1) cls.push(`opacity-[${Number(o.opacity.toFixed(2))}]`)
  if (o.blendMode && o.blendMode !== 'normal') cls.push(`mix-blend-${o.blendMode}`)
  if (o.rotation) cls.push(`rotate-[${o.rotation}deg]`)
  return cls.join(' ')
}

/** A hex string for a plain solid colour, or null for gradients and images. */
function hexOf(css: string): string | null {
  const v = (css ?? '').trim()
  if (!v || v.includes('gradient') || v.includes('url(')) return null
  const c = parseAnyColor(v)
  return c ? c.hex : null
}
