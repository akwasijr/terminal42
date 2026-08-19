import { type FObj, type Effect, type EffectType, rgbaFrom, newEffectId } from './freeformTypes'
import { parseAnyColor } from './color'

// Unified layer-effects engine: the floating "Effects" panel writes Effect[] and
// these pure helpers compose them into CSS (box-shadow / filter / backdrop-filter)
// plus overlay specs for noise / texture / glass. Shared by the canvas + exporter.

export const EFFECT_LABEL: Record<EffectType, string> = {
  'inner-shadow': 'Inner shadow',
  'drop-shadow': 'Drop shadow',
  'layer-blur': 'Layer blur',
  'background-blur': 'Background blur',
  noise: 'Noise',
  texture: 'Texture',
  glass: 'Glass',
  shader: 'Shader',
}

export const EFFECT_ORDER: EffectType[] = ['inner-shadow', 'drop-shadow', 'layer-blur', 'background-blur', 'noise', 'texture', 'glass', 'shader']

export function makeEffect(type: EffectType): Effect {
  const id = newEffectId()
  switch (type) {
    case 'inner-shadow':
    case 'drop-shadow':
      return { id, type, x: 0, y: 4, blur: 4, spread: 0, color: '#000000', opacity: 0.25, blend: 'normal' }
    case 'layer-blur':
    case 'background-blur':
      return { id, type, progressive: false, amount: 4, start: 0, end: 4 }
    case 'noise':
      return { id, type, noiseMode: 'mono', sizeX: 2.5, sizeY: 1.9, density: 100, color: '#7a0303', opacity: 0.25, color2: '#ffffff', opacity2: 0.25, blend: 'normal' }
    case 'texture':
      return { id, type, sizeX: 4, sizeY: 4, radius: 6, clipShape: false }
    case 'glass':
      return { id, type, angle: -45, intensity: 80, refraction: 80, depth: 20, dispersion: 50, frost: 8, splay: 0 }
    case 'shader':
      return { id, type }
  }
}

const shown = (e: Effect): boolean => !e.hidden

/** Combined box-shadow contributed by inner + drop shadow effects, or undefined. */
export function effectsBoxShadow(o: FObj): string | undefined {
  const parts: string[] = []
  for (const e of o.effects ?? []) {
    if (!shown(e)) continue
    if (e.type === 'inner-shadow') parts.push(`inset ${e.x ?? 0}px ${e.y ?? 4}px ${e.blur ?? 4}px ${e.spread ?? 0}px ${rgbaFrom(e.color ?? '#000000', e.opacity ?? 1)}`)
    else if (e.type === 'drop-shadow') parts.push(`${e.x ?? 0}px ${e.y ?? 4}px ${e.blur ?? 4}px ${e.spread ?? 0}px ${rgbaFrom(e.color ?? '#000000', e.opacity ?? 1)}`)
  }
  return parts.length ? parts.join(', ') : undefined
}

/** Layer-blur `filter` string from layer-blur effects (progressive uses end). */
export function effectsFilter(o: FObj): string {
  const parts: string[] = []
  for (const e of o.effects ?? []) {
    if (!shown(e)) continue
    if (e.type === 'layer-blur') parts.push(`blur(${Math.max(0, e.progressive ? (e.end ?? 4) : (e.amount ?? 4))}px)`)
  }
  return parts.join(' ')
}

/** Backdrop-filter from background-blur + glass effects. */
export function effectsBackdrop(o: FObj): string {
  const parts: string[] = []
  for (const e of o.effects ?? []) {
    if (!shown(e)) continue
    if (e.type === 'background-blur') parts.push(`blur(${Math.max(0, e.progressive ? (e.end ?? 4) : (e.amount ?? 4))}px)`)
    else if (e.type === 'glass') {
      const frost = Math.max(0, e.frost ?? 8)
      const sat = Math.round(100 + (e.dispersion ?? 0) * 0.6)
      const bright = Math.round(100 + (e.intensity ?? 80) * 0.06)
      parts.push(`blur(${Math.max(2, frost)}px) saturate(${sat}%) brightness(${bright}%)`)
    }
  }
  return parts.join(' ')
}

/** True when any effect needs an absolutely-positioned overlay child. */
export function hasEffectOverlays(o: FObj): boolean {
  return (o.effects ?? []).some((e) => shown(e) && (e.type === 'noise' || e.type === 'glass'))
}

export interface OverlaySpec {
  key: string
  background?: string
  backgroundSize?: string
  backgroundRepeat?: string
  boxShadow?: string
  opacity?: number
  blend?: string
}

/** A self-contained, tileable grain tile whose ALPHA carries the noise, tinted with
 * `color`. Used directly as a `background` (no CSS mask), so the grain is actually
 * visible — the previous mask approach produced a flat wash because the mask image
 * was fully opaque. */
function grainUrl(color: string, sizeX: number, sizeY: number, density: number, seed: number): string {
  const sx = Math.max(0.05, sizeX), sy = Math.max(0.05, sizeY)
  const fx = (0.7 / sx).toFixed(3)
  const fy = (0.7 / sy).toFixed(3)
  const oct = Math.max(1, Math.min(5, Math.round((density / 100) * 3) + 1))
  const slope = (0.5 + (density / 100) * 1.7).toFixed(2)
  const tile = 220
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}">` +
    `<filter id="g" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${fx} ${fy}" numOctaves="${oct}" seed="${seed}" stitchTiles="stitch" result="t"/>` +
    `<feColorMatrix in="t" type="luminanceToAlpha" result="a"/>` +
    `<feComponentTransfer in="a" result="a2"><feFuncA type="linear" slope="${slope}" intercept="-0.15"/></feComponentTransfer>` +
    `<feFlood flood-color="${color}" result="c"/>` +
    `<feComposite in="c" in2="a2" operator="in"/>` +
    `</filter>` +
    `<rect width="100%" height="100%" filter="url(#g)"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** A multicolour grain tile (the turbulence RGB shows through, alpha boosted). */
function grainUrlMulti(sizeX: number, sizeY: number, density: number, seed: number): string {
  const sx = Math.max(0.05, sizeX), sy = Math.max(0.05, sizeY)
  const fx = (0.7 / sx).toFixed(3)
  const fy = (0.7 / sy).toFixed(3)
  const oct = Math.max(1, Math.min(5, Math.round((density / 100) * 3) + 1))
  const slope = (0.8 + (density / 100) * 1.2).toFixed(2)
  const tile = 220
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}">` +
    `<filter id="g" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${fx} ${fy}" numOctaves="${oct}" seed="${seed}" stitchTiles="stitch" result="t"/>` +
    `<feComponentTransfer in="t"><feFuncA type="linear" slope="${slope}" intercept="-0.2"/></feComponentTransfer>` +
    `</filter>` +
    `<rect width="100%" height="100%" filter="url(#g)"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** Overlay child specs for noise / glass effects (texture uses an SVG filter). */
export function effectsOverlays(o: FObj): OverlaySpec[] {
  const out: OverlaySpec[] = []
  for (const e of o.effects ?? []) {
    if (!shown(e) || !e.id) continue
    if (e.type === 'noise') {
      const sx = e.sizeX ?? 2.5, sy = e.sizeY ?? 1.9, d = e.density ?? 100
      const repeat = 'repeat'
      if (e.noiseMode === 'multi') {
        out.push({ key: e.id, background: `url("${grainUrlMulti(sx, sy, d, 3)}")`, backgroundRepeat: repeat, opacity: e.opacity ?? 0.25, blend: e.blend ?? 'normal' })
      } else {
        out.push({ key: e.id + 'a', background: `url("${grainUrl(e.color ?? '#000000', sx, sy, d, 1)}")`, backgroundRepeat: repeat, opacity: e.opacity ?? 0.25, blend: e.blend ?? 'normal' })
        if (e.noiseMode === 'duo') out.push({ key: e.id + 'b', background: `url("${grainUrl(e.color2 ?? '#ffffff', sx, sy, d, 2)}")`, backgroundRepeat: repeat, opacity: e.opacity2 ?? 0.25, blend: e.blend ?? 'normal' })
      }
    } else if (e.type === 'glass') {
      const a = (e.angle ?? -45) + 90
      const intensity = (e.intensity ?? 80) / 100
      const hl = Math.max(0, Math.min(0.65, intensity * 0.6))
      const depth = (e.depth ?? 20) / 100
      const refraction = (e.refraction ?? 80) / 100
      // a faint tint keeps the panel readable even with nothing behind it
      out.push({ key: e.id + 'tint', background: `rgba(255,255,255,${(0.04 + depth * 0.06).toFixed(3)})`, opacity: 1, blend: 'normal' })
      // specular sheen from the light direction
      out.push({ key: e.id + 'g', background: `linear-gradient(${a}deg, rgba(255,255,255,${hl}) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,${(hl * 0.4).toFixed(3)}) 100%)`, opacity: 1, blend: 'soft-light' })
      // depth bevel: bright top-left edge + dark bottom-right edge (inset)
      const edge = Math.round(1 + refraction * 3)
      out.push({ key: e.id + 'edge', boxShadow: `inset ${edge}px ${edge}px ${edge * 2}px rgba(255,255,255,${(0.25 * intensity).toFixed(3)}), inset -${edge}px -${edge}px ${edge * 2}px rgba(0,0,0,${(0.18 * intensity).toFixed(3)})`, opacity: 1, blend: 'normal' })
    }
  }
  return out
}

/** A texture (edge-roughening) displacement filter for each texture effect. The
 * canvas renders these as `<filter>` defs and references them from the element's
 * CSS `filter`, so the shape's outline gets a rough, distressed edge. */
export interface TextureFilter { id: string; fx: number; fy: number; scale: number; octaves: number; seed: number; clip: boolean }
export function effectsTextureFilters(o: FObj): TextureFilter[] {
  const out: TextureFilter[] = []
  for (const e of o.effects ?? []) {
    if (!shown(e) || !e.id || e.type !== 'texture') continue
    const sx = Math.max(0.05, e.sizeX ?? 4), sy = Math.max(0.05, e.sizeY ?? 4)
    out.push({ id: `tex-${o.id}-${e.id}`, fx: +(0.9 / sx).toFixed(3), fy: +(0.9 / sy).toFixed(3), scale: e.radius ?? 6, octaves: 2, seed: 4, clip: !!e.clipShape })
  }
  return out
}
export function effectsTextureFilterCss(o: FObj): string {
  return effectsTextureFilters(o).map((f) => `url(#${f.id})`).join(' ')
}
export function effectsClipsShape(o: FObj): boolean {
  return effectsTextureFilters(o).some((f) => f.clip)
}

/** Lazily convert legacy shadow / inner-shadow / blur fields into the effects
 * array (and clear them) so old designs render through the unified pipeline.
 * Returns a patch, or null when nothing to migrate. */
export function migrateEffects(o: FObj): Partial<FObj> | null {
  if (o.effects && o.effects.length) return null
  const fx: Effect[] = []
  if (o.shadow) {
    const { hex, alpha } = parseAnyColor(o.shadowColor || '#000000')
    fx.push({ id: newEffectId(), type: 'drop-shadow', x: o.shadowX, y: o.shadowY, blur: o.shadowBlur, spread: o.shadowSpread, color: hex, opacity: o.shadowOpacity ?? alpha, hidden: o.shadowHidden, blend: 'normal' })
  }
  if (o.innerShadow) {
    const { hex, alpha } = parseAnyColor(o.innerShadowColor || '#000000')
    fx.push({ id: newEffectId(), type: 'inner-shadow', x: o.innerShadowX ?? 0, y: o.innerShadowY ?? 4, blur: o.innerShadowBlur ?? 4, spread: o.innerShadowSpread ?? 0, color: hex, opacity: o.innerShadowOpacity ?? alpha, hidden: o.innerShadowHidden, blend: 'normal' })
  }
  const rest: NonNullable<FObj['filters']> = []
  for (const f of o.filters ?? []) {
    if (f.type === 'blur') fx.push({ id: newEffectId(), type: 'layer-blur', amount: f.value, hidden: f.hidden, progressive: false })
    else if (f.type === 'backdrop-blur') fx.push({ id: newEffectId(), type: 'background-blur', amount: f.value, hidden: f.hidden, progressive: false })
    else rest.push(f)
  }
  if (o.blur && o.blur > 0) fx.push({ id: newEffectId(), type: 'layer-blur', amount: o.blur, progressive: false })
  if (!fx.length) return null
  return { effects: fx, shadow: false, innerShadow: false, filters: rest, blur: 0 }
}
