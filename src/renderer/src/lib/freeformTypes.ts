import { type LayerMotion, type AnimSpec } from './timelineModel'

// Canonical object model for the freeform canvas, shared by the editor and the
// HTML exporter so they never drift. Objects are flat (no nesting) absolutely
// positioned primitives on an artboard.

export type Shape = 'frame' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'polygon' | 'star' | 'text' | 'image' | 'path'
export type TextAlign = 'left' | 'center' | 'right'

/** A single gradient colour stop. `pos` is 0..1 along the gradient, `opacity` 0..1.
 * `id` is a stable handle so the editor can track a stop across reordering.
 * `mid` (0..1, default 0.5) is the interpolation midpoint toward the NEXT stop. */
export interface GradientStop {
  id?: string
  color: string
  pos: number
  opacity?: number
  mid?: number
}

export type FilterType = 'blur' | 'brightness' | 'contrast' | 'grayscale' | 'hue-rotate' | 'invert' | 'saturate' | 'sepia' | 'backdrop-blur' | 'backdrop-brightness' | 'backdrop-contrast' | 'backdrop-grayscale'
export interface FilterEntry { id?: string; type: FilterType; value: number; hidden?: boolean }

// ── Unified layer effects (one floating "Effects" panel) ────────────────────────
export type EffectType = 'inner-shadow' | 'drop-shadow' | 'layer-blur' | 'background-blur' | 'noise' | 'texture' | 'glass' | 'shader'
export interface Effect {
  id?: string
  type: EffectType
  hidden?: boolean
  blend?: string
  // shadows (inner / drop)
  x?: number; y?: number; blur?: number; spread?: number; color?: string; opacity?: number
  // blur (layer / background)
  progressive?: boolean; amount?: number; start?: number; end?: number
  // noise / texture
  noiseMode?: 'mono' | 'duo' | 'multi'; sizeX?: number; sizeY?: number; density?: number; color2?: string; opacity2?: number
  radius?: number; clipShape?: boolean
  // glass
  angle?: number; intensity?: number; refraction?: number; depth?: number; dispersion?: number; frost?: number; splay?: number
  // shader (paper-design/shaders): which shader + its numeric params + colour stops
  shaderId?: string
  shaderParams?: Record<string, number>
  shaderColors?: string[]
}

let effectCounter = 0
export function newEffectId(): string {
  return `fx${Date.now().toString(36)}${(effectCounter++).toString(36)}`
}

let stopCounter = 0
export function newStopId(): string {
  return `gs${Date.now().toString(36)}${(stopCounter++).toString(36)}`
}

export interface FObj {
  id: string
  type: Shape
  name: string
  x: number
  y: number
  w: number
  h: number
  rotation: number
  // transform anchor (transform-origin) as a 0..1 fraction of the box; default centre.
  anchor?: { x: number; y: number }
  opacity: number
  visible: boolean
  locked: boolean
  // fill (shapes) / text color is `color`
  fill: string
  fillEnabled: boolean
  // eye toggle: the fill exists but its view is turned off (distinct from removed)
  fillHidden?: boolean
  fillMode?: 'solid' | 'gradient' | 'image'
  // legacy 2-stop gradient (kept for back-compat / SVG fallback)
  gradientFrom?: string
  gradientTo?: string
  gradientAngle?: number
  // multi-stop gradient
  gradientType?: 'linear' | 'radial' | 'conic'
  gradientStops?: GradientStop[]
  gradientInterpolation?: 'linear' | 'average'
  fillImage?: string
  fillOpacity?: number
  blendMode?: string
  // stroke / outline / line color
  stroke: string
  strokeWidth: number
  strokeEnabled: boolean
  // eye toggle for the outline (exists but view turned off)
  strokeHidden?: boolean
  // outline position: 0 sits on the shape edge, negative draws inside, positive outside (px)
  strokeOffset?: number
  strokeStyle?: 'solid' | 'dashed' | 'dotted'
  // Outline / stroke paint (mirrors fill: solid colour, multi-stop gradient, or image)
  strokeMode?: 'solid' | 'gradient' | 'image'
  strokeGradientStops?: GradientStop[]
  strokeGradientType?: 'linear' | 'radial' | 'conic'
  strokeGradientAngle?: number
  strokeGradientInterpolation?: 'linear' | 'average'
  strokeImage?: string
  strokeOpacity?: number
  radius: number
  // Border (CSS box border, per-side; distinct from the offsetable Outline above)
  borderEnabled?: boolean
  borderHidden?: boolean
  borderWidth?: number
  borderColor?: string
  borderOpacity?: number
  borderSides?: 'all' | 'top' | 'right' | 'bottom' | 'left'
  borderStyle?: 'solid' | 'dashed' | 'dotted'
  // Border paint (mirrors fill: solid, gradient, image)
  borderMode?: 'solid' | 'gradient' | 'image'
  borderGradientStops?: GradientStop[]
  borderGradientType?: 'linear' | 'radial' | 'conic'
  borderGradientAngle?: number
  borderGradientInterpolation?: 'linear' | 'average'
  borderImage?: string
  // shadow (drop)
  shadow: boolean
  shadowColor: string
  shadowX: number
  shadowY: number
  shadowBlur: number
  shadowSpread: number
  shadowHidden?: boolean
  shadowOpacity?: number
  shadowDrop?: boolean
  // inner shadow
  innerShadow?: boolean
  innerShadowHidden?: boolean
  innerShadowColor?: string
  innerShadowOpacity?: number
  innerShadowX?: number
  innerShadowY?: number
  innerShadowBlur?: number
  innerShadowSpread?: number
  // CSS filter list (layer + backdrop)
  filters?: FilterEntry[]
  // unified layer effects (shadows / blurs / noise / texture / glass / shader)
  effects?: Effect[]
  // text
  text: string
  color: string
  fontSize: number
  fontFamily: string
  fontWeight: number
  italic: boolean
  underline: boolean
  align: TextAlign
  lineHeight: number
  letterSpacing: number
  // image
  src?: string
  // polygon / star
  sides?: number
  points?: number
  innerRatio?: number
  // freehand path (pencil): SVG path `d` normalised to a 0..1 box, drawn with the
  // object's stroke; scales to w/h via a unit viewBox.
  path?: string
  // Coordinate space for `path`. Pencil drawings use the default unit box
  // ('0 0 1 1', stretched). Named icons use their source viewBox (e.g. '0 0 24 24')
  // so standard icon path data renders correctly with aspect preserved.
  pathViewBox?: string
  // effects (static; also animatable via the timeline)
  blur?: number
  brightness?: number
  glow?: number
  glowColor?: string
  motion?: LayerMotion
  // high-level animations authored from the inspector Animations panel
  anims?: AnimSpec[]
  // parenting: this object follows its parent's motion (translation) — like After
  // Effects' parent column. Stored as the parent object's id.
  parent?: string
  // Lightweight Figma-like layout/component metadata. Objects remain flat on the
  // canvas, but frames can represent groups, auto-layout containers and component
  // instances.
  layoutMode?: 'none' | 'horizontal' | 'vertical' | 'grid'
  layoutGap?: number
  layoutPadding?: number
  // Flex / auto-layout (Figma-style). Padding can be split per axis; alignment is a
  // main-axis (justify) × cross-axis (align) pair. Sizing per axis: fixed/fit/fill.
  layoutPadX?: number
  layoutPadY?: number
  // wrap children to a new line when they overflow the main axis (horizontal/vertical)
  layoutWrap?: boolean
  // grid column count (layoutMode 'grid'); when omitted a square-ish count is derived
  layoutCols?: number
  layoutJustify?: 'start' | 'center' | 'end' | 'space-between'
  layoutAlign?: 'start' | 'center' | 'end' | 'baseline'
  widthMode?: 'fixed' | 'fit' | 'fill'
  heightMode?: 'fixed' | 'fit' | 'fill'
  clipContent?: boolean
  componentName?: string
  componentSource?: string
  componentVariant?: string
  componentSlot?: string
  componentProps?: Record<string, string | number | boolean>
  // Design-variable bindings: field name (e.g. 'fill', 'radius') → variable id.
  // Resolved at render time; the inspector shows the variable name when bound.
  bindings?: Record<string, string>
  // Applied style ids (color fill / text / effect). Set when a document style is
  // applied; used to show "using style X" and to re-sync objects when the style
  // is edited. One slot per style type.
  styleRefs?: { fill?: string; text?: string; effect?: string }
  // Per-frame variable mode overrides: collectionId → modeId. A frame can pin a
  // collection to a specific mode (e.g. Dark); descendants inherit it unless they
  // set their own override. When unset, the collection's default mode applies.
  varModes?: Record<string, string>
}

export interface FontDef {
  label: string
  stack: string
  // Google Fonts family spec (after `family=`), or null for system fonts.
  google: string | null
}

// Sans-first selection. Serif/mono are available but never the default, matching
// the project rule of defaulting against AI serif fonts while letting the user pick.
export const FONTS: FontDef[] = [
  { label: 'System sans', stack: 'system-ui, -apple-system, "Segoe UI", sans-serif', google: null },
  { label: 'Inter', stack: '"Inter", system-ui, sans-serif', google: 'Inter:wght@400;500;600;700;800' },
  { label: 'DM Sans', stack: '"DM Sans", system-ui, sans-serif', google: 'DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700' },
  { label: 'Plus Jakarta Sans', stack: '"Plus Jakarta Sans", system-ui, sans-serif', google: 'Plus+Jakarta+Sans:wght@400;500;600;700;800' },
  { label: 'Space Grotesk', stack: '"Space Grotesk", system-ui, sans-serif', google: 'Space+Grotesk:wght@400;500;600;700' },
  { label: 'Sora', stack: '"Sora", system-ui, sans-serif', google: 'Sora:wght@400;500;600;700;800' },
  { label: 'Manrope', stack: '"Manrope", system-ui, sans-serif', google: 'Manrope:wght@400;500;600;700;800' },
  { label: 'Outfit', stack: '"Outfit", system-ui, sans-serif', google: 'Outfit:wght@400;500;600;700' },
  { label: 'Archivo', stack: '"Archivo", system-ui, sans-serif', google: 'Archivo:wght@400;500;600;700;800' },
  { label: 'Figtree', stack: '"Figtree", system-ui, sans-serif', google: 'Figtree:wght@400;500;600;700' },
  { label: 'Playfair Display', stack: '"Playfair Display", Georgia, serif', google: 'Playfair+Display:wght@400;500;600;700' },
  { label: 'Fraunces', stack: '"Fraunces", Georgia, serif', google: 'Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600' },
  { label: 'Lora', stack: '"Lora", Georgia, serif', google: 'Lora:wght@400;500;600;700' },
  { label: 'JetBrains Mono', stack: '"JetBrains Mono", ui-monospace, monospace', google: 'JetBrains+Mono:wght@400;500;700' },
]

export const WEIGHTS = [
  { label: 'Regular', value: 400 },
  { label: 'Medium', value: 500 },
  { label: 'SemiBold', value: 600 },
  { label: 'Bold', value: 700 },
  { label: 'ExtraBold', value: 800 },
]

export const ARTBOARD_PRESETS = [
  { label: 'Desktop', w: 1440, h: 1024 },
  { label: 'Laptop', w: 1280, h: 800 },
  { label: 'Tablet', w: 834, h: 1112 },
  { label: 'Phone', w: 390, h: 844 },
  { label: 'Square', w: 1080, h: 1080 },
  { label: 'Social', w: 1200, h: 630 },
]

export function fontByLabel(label: string): FontDef {
  return FONTS.find((f) => f.label === label) ?? FONTS[0]
}

// Build the Google Fonts stylesheet href for the families actually in use.
export function googleFontsHref(labels: string[]): string | null {
  const specs = Array.from(new Set(labels))
    .map((l) => fontByLabel(l).google)
    .filter((g): g is string => !!g)
  if (specs.length === 0) return null
  return `https://fonts.googleapis.com/css2?${specs.map((s) => `family=${s}`).join('&')}&display=swap`
}

let counter = 0
export function newId(): string {
  return `fobj${Date.now().toString(36)}${(counter++).toString(36)}`
}

let filterCounter = 0
export function newFilterId(): string {
  return `flt${Date.now().toString(36)}${(filterCounter++).toString(36)}`
}

const TYPE_LABEL: Record<Shape, string> = {
  frame: 'Frame',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
  arrow: 'Arrow',
  polygon: 'Polygon',
  star: 'Star',
  text: 'Text',
  image: 'Image',
  path: 'Drawing',
}

let nameCounts: Record<string, number> = {}
export function resetNameCounts(): void {
  nameCounts = {}
}

export function makeObject(type: Shape, x: number, y: number): FObj {
  const n = (nameCounts[type] = (nameCounts[type] ?? 0) + 1)
  const base: FObj = {
    id: newId(),
    type,
    name: `${TYPE_LABEL[type]} ${n}`,
    x,
    y,
    w: 1,
    h: 1,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fill: '#e5e7eb',
    fillEnabled: true,
    fillMode: 'solid',
    gradientFrom: '#ff0000',
    gradientTo: '#16c7e8',
    gradientAngle: 90,
    gradientType: 'linear',
    fillOpacity: 1,
    blendMode: 'normal',
    stroke: '#111827',
    strokeWidth: 1,
    strokeEnabled: false,
    strokeOffset: 0,
    radius: 0,
    borderColor: '#000000',
    borderOpacity: 1,
    borderSides: 'all',
    borderStyle: 'solid',
    borderWidth: 1,
    shadow: false,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowX: 0,
    shadowY: 2,
    shadowBlur: 3,
    shadowSpread: 0,
    innerShadowColor: '#000000',
    innerShadowOpacity: 0.2,
    innerShadowX: 0,
    innerShadowY: 2,
    innerShadowBlur: 3,
    innerShadowSpread: 0,
    text: '',
    color: '#111111',
    fontSize: 28,
    fontFamily: 'System sans',
    fontWeight: 500,
    italic: false,
    underline: false,
    align: 'left',
    lineHeight: 1.3,
    letterSpacing: 0,
    blur: 0,
    brightness: 1,
    glow: 0,
    glowColor: '#22d3ee',
  }
  if (type === 'frame') return { ...base, fill: '#ffffff', strokeEnabled: true, stroke: '#d1d5db', strokeWidth: 1, w: 320, h: 240, radius: 0 }
  if (type === 'rect') return { ...base, radius: 8 }
  if (type === 'ellipse') return { ...base, fill: '#c7d2fe' }
  if (type === 'line') return { ...base, h: 2, strokeEnabled: true, fillEnabled: false, stroke: '#111827', strokeWidth: 2 }
  if (type === 'arrow') return { ...base, h: 2, fillEnabled: false, strokeEnabled: true, stroke: '#111827', strokeWidth: 2 }
  if (type === 'polygon') return { ...base, fill: '#fcd34d', sides: 3 }
  if (type === 'star') return { ...base, fill: '#fca5a5', points: 5, innerRatio: 0.45 }
  if (type === 'text') return { ...base, w: 240, h: 44, fillEnabled: false, text: 'Text' }
  if (type === 'image') return { ...base, w: 320, h: 200, fill: '#0b0b0c', radius: 8 }
  if (type === 'path') return { ...base, fillEnabled: false, strokeEnabled: true, stroke: '#111827', strokeWidth: 2, path: '' }
  return base
}

/** A reusable "paint" descriptor pointing at the FObj fields that hold a given
 * paint's mode / colour / gradient / image. Lets the Fill, Outline/Stroke and
 * Border all share one editor + one renderer (Solid / Gradient / Image). */
export interface PaintCfg {
  mode: 'fillMode' | 'strokeMode' | 'borderMode'
  color: 'fill' | 'stroke' | 'borderColor' | 'color'
  hidden: 'fillHidden' | 'strokeHidden' | 'borderHidden'
  enabled: 'fillEnabled' | 'strokeEnabled' | 'borderEnabled'
  opacity: 'fillOpacity' | 'strokeOpacity' | 'borderOpacity'
  stops: 'gradientStops' | 'strokeGradientStops' | 'borderGradientStops'
  gtype: 'gradientType' | 'strokeGradientType' | 'borderGradientType'
  gangle: 'gradientAngle' | 'strokeGradientAngle' | 'borderGradientAngle'
  ginterp: 'gradientInterpolation' | 'strokeGradientInterpolation' | 'borderGradientInterpolation'
  image: 'fillImage' | 'strokeImage' | 'borderImage'
  allowImage: boolean
  defaultColor: string
}

export const FILL_PAINT: PaintCfg = { mode: 'fillMode', color: 'fill', hidden: 'fillHidden', enabled: 'fillEnabled', opacity: 'fillOpacity', stops: 'gradientStops', gtype: 'gradientType', gangle: 'gradientAngle', ginterp: 'gradientInterpolation', image: 'fillImage', allowImage: true, defaultColor: '#7a7a7a' }
export const STROKE_PAINT: PaintCfg = { mode: 'strokeMode', color: 'stroke', hidden: 'strokeHidden', enabled: 'strokeEnabled', opacity: 'strokeOpacity', stops: 'strokeGradientStops', gtype: 'strokeGradientType', gangle: 'strokeGradientAngle', ginterp: 'strokeGradientInterpolation', image: 'strokeImage', allowImage: true, defaultColor: '#111827' }
export const BORDER_PAINT: PaintCfg = { mode: 'borderMode', color: 'borderColor', hidden: 'borderHidden', enabled: 'borderEnabled', opacity: 'borderOpacity', stops: 'borderGradientStops', gtype: 'borderGradientType', gangle: 'borderGradientAngle', ginterp: 'borderGradientInterpolation', image: 'borderImage', allowImage: true, defaultColor: '#000000' }

/** Effective gradient stops for any paint: the multi-stop array if present, else a
 * sensible 2-stop pair seeded from the paint's solid colour. */
export function paintStopsOf(o: FObj, cfg: PaintCfg): GradientStop[] {
  const st = o[cfg.stops] as GradientStop[] | undefined
  if (st && st.length >= 2) return [...st].sort((a, b) => a.pos - b.pos)
  const base = (o[cfg.color] as string | undefined) ?? cfg.defaultColor
  return [{ color: base, pos: 0, opacity: 1 }, { color: '#A4A4A4', pos: 1, opacity: 1 }]
}

/** Effective gradient stops for an object's FILL (back-compat shim). */
export function effectiveStops(o: FObj): GradientStop[] {
  if (o.gradientStops && o.gradientStops.length >= 2) {
    return [...o.gradientStops].sort((a, b) => a.pos - b.pos)
  }
  return [
    { color: o.gradientFrom ?? o.fill, pos: 0, opacity: 1 },
    { color: o.gradientTo ?? '#16c7e8', pos: 1, opacity: 1 },
  ]
}

/** CSS background/colour string for any paint (Solid / Gradient / Image). Used as a
 * `background` for boxes and lines; SVG strokes use {@link svgPaintRef} instead. */
export function paintCssOf(o: FObj, cfg: PaintCfg): string {
  const base = Math.max(0, Math.min(1, (o[cfg.opacity] as number | undefined) ?? 1))
  const withAlpha = (c: string, extra = 1): string => {
    const op = base * Math.max(0, Math.min(1, extra))
    const m = /^#?([0-9a-f]{6})$/i.exec(c)
    if (!m) return c
    if (op >= 1) return c.startsWith('#') ? c : `#${c}`
    const n = parseInt(m[1], 16)
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${op})`
  }
  const mode = (o[cfg.mode] as string | undefined) ?? 'solid'
  if (mode === 'gradient') {
    const stops = paintStopsOf(o, cfg)
    const seg: string[] = []
    stops.forEach((s, i) => {
      seg.push(`${withAlpha(s.color, s.opacity ?? 1)} ${Math.round(Math.max(0, Math.min(1, s.pos)) * 100)}%`)
      if (i < stops.length - 1) {
        const mid = Math.max(0.02, Math.min(0.98, s.mid ?? 0.5))
        const next = stops[i + 1]
        if (mid !== 0.5) {
          const hint = s.pos + mid * (next.pos - s.pos)
          seg.push(`${Math.round(Math.max(0, Math.min(1, hint)) * 100)}%`)
        }
      }
    })
    const parts = seg.join(', ')
    const type = (o[cfg.gtype] as string | undefined) ?? 'linear'
    const angle = (o[cfg.gangle] as number | undefined)
    if (type === 'radial') return `radial-gradient(circle at center, ${parts})`
    if (type === 'conic') return `conic-gradient(from ${angle ?? 0}deg at center, ${parts})`
    return `linear-gradient(${angle ?? 90}deg, ${parts})`
  }
  const img = o[cfg.image] as string | undefined
  if (mode === 'image' && img) return `url("${img}") center / cover no-repeat`
  return withAlpha((o[cfg.color] as string | undefined) ?? cfg.defaultColor)
}

export function objectFillCss(o: FObj): string {
  return paintCssOf(o, FILL_PAINT)
}

/** CSS transform-origin for an object's anchor (0..1 box fraction), or undefined for
 * the default centre. Applied to both the static render and animated transforms so
 * rotation/scale pivot around the chosen point. */
export function transformOriginCss(o: FObj): string | undefined {
  if (!o.anchor) return undefined
  const x = Math.max(0, Math.min(1, o.anchor.x))
  const y = Math.max(0, Math.min(1, o.anchor.y))
  return `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`
}

/** SVG `objectBoundingBox` linear-gradient axis for a CSS angle (0deg = to top). */
export function svgLinearCoords(angle: number): { x1: number; y1: number; x2: number; y2: number } {
  const a = (angle * Math.PI) / 180
  const s = Math.sin(a), c = Math.cos(a)
  return { x1: 0.5 - 0.5 * s, y1: 0.5 + 0.5 * c, x2: 0.5 + 0.5 * s, y2: 0.5 - 0.5 * c }
}

/** True when a paint is set to a gradient or image (i.e. cannot be a plain colour). */
export function paintIsRich(o: FObj, cfg: PaintCfg): boolean {
  const mode = (o[cfg.mode] as string | undefined) ?? 'solid'
  return mode === 'gradient' || (mode === 'image' && !!o[cfg.image])
}

export function objectTextColorCss(o: FObj): string {
  const opacity = Math.max(0, Math.min(1, o.fillOpacity ?? 1))
  const m = /^#?([0-9a-f]{6})$/i.exec(o.color)
  if (!m || opacity >= 1) return o.color
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${opacity})`
}

/** CSS `outline` declaration for an object's stroke, honouring the position offset
 * (0 = on the edge, negative = inside, positive = outside). Empty when disabled. */
export function outlineCss(o: FObj): string {
  if (!(o.strokeEnabled && o.strokeWidth > 0) || o.strokeHidden) return ''
  const style = o.strokeStyle === 'dashed' ? 'dashed' : o.strokeStyle === 'dotted' ? 'dotted' : 'solid'
  return `outline:${o.strokeWidth}px ${style} ${o.stroke};outline-offset:${o.strokeOffset ?? 0}px;`
}

/** Apply an alpha to a #rrggbb colour; legacy rgba()/named colours pass through. */
export function rgbaFrom(color: string, opacity = 1): string {
  const op = Math.max(0, Math.min(1, opacity))
  const m = /^#?([0-9a-f]{6})$/i.exec(color)
  if (!m) return color
  const n = parseInt(m[1], 16)
  return op >= 1 ? `#${m[1]}` : `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${op})`
}

/** CSS `border` (or per-side border) for an object, or '' when disabled. */
export function borderCss(o: FObj): string {
  if (!o.borderEnabled || o.borderHidden || (o.borderWidth ?? 0) <= 0) return ''
  const w = o.borderWidth ?? 1
  const style = o.borderStyle ?? 'solid'
  const c = rgbaFrom(o.borderColor ?? '#000000', o.borderOpacity ?? 1)
  const sides = o.borderSides ?? 'all'
  if (sides === 'all') return `border:${w}px ${style} ${c};`
  const side = sides.charAt(0).toUpperCase() + sides.slice(1)
  return `border${side}:${w}px ${style} ${c};`
}

/** Combined box-shadow (drop + inner) using hex+opacity, or undefined. The drop
 * shadow is omitted here when it should render as a CSS filter drop-shadow. */
export function objectBoxShadow(o: FObj): string | undefined {
  const parts: string[] = []
  if (o.shadow && !o.shadowHidden && !o.shadowDrop) parts.push(`${o.shadowX}px ${o.shadowY}px ${o.shadowBlur}px ${o.shadowSpread}px ${rgbaFrom(o.shadowColor, o.shadowOpacity ?? 1)}`)
  if (o.innerShadow && !o.innerShadowHidden) parts.push(`inset ${o.innerShadowX ?? 0}px ${o.innerShadowY ?? 2}px ${o.innerShadowBlur ?? 3}px ${o.innerShadowSpread ?? 0}px ${rgbaFrom(o.innerShadowColor ?? '#000000', o.innerShadowOpacity ?? 1)}`)
  return parts.length ? parts.join(', ') : undefined
}

const LAYER_FILTER_UNIT: Record<string, (v: number) => string> = {
  blur: (v) => `blur(${v}px)`,
  brightness: (v) => `brightness(${v}%)`,
  contrast: (v) => `contrast(${v}%)`,
  grayscale: (v) => `grayscale(${v}%)`,
  'hue-rotate': (v) => `hue-rotate(${v}deg)`,
  invert: (v) => `invert(${v}%)`,
  saturate: (v) => `saturate(${v}%)`,
  sepia: (v) => `sepia(${v}%)`,
}

/** Build the `filter` value from the object's filter list (layer filters only). */
export function filterListCss(o: FObj): string {
  return (o.filters ?? [])
    .filter((f) => !f.hidden && !f.type.startsWith('backdrop-') && LAYER_FILTER_UNIT[f.type])
    .map((f) => LAYER_FILTER_UNIT[f.type](f.value))
    .join(' ')
}

/** Build the `backdrop-filter` value from the object's backdrop filter entries. */
export function backdropFilterCss(o: FObj): string {
  return (o.filters ?? [])
    .filter((f) => !f.hidden && f.type.startsWith('backdrop-'))
    .map((f) => {
      const base = f.type.replace('backdrop-', '')
      return LAYER_FILTER_UNIT[base] ? LAYER_FILTER_UNIT[base](f.value) : ''
    })
    .filter(Boolean)
    .join(' ')
}

// ── Shape geometry: clip-path polygons for polygon + star (pure, reusable) ──────
/** Points for a regular N-gon inscribed in the unit box, as percentages. */
export function polygonPoints(sides: number): string {
  const n = Math.max(3, Math.round(sides))
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    const px = 50 + 50 * Math.cos(a)
    const py = 50 + 50 * Math.sin(a)
    pts.push(`${px.toFixed(2)}% ${py.toFixed(2)}%`)
  }
  return pts.join(', ')
}

/** Points for an N-point star with a given inner radius ratio, as percentages. */
export function starPoints(points: number, innerRatio: number): string {
  const n = Math.max(3, Math.round(points))
  const inner = Math.max(0.1, Math.min(0.9, innerRatio))
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? 50 : 50 * inner
    const a = -Math.PI / 2 + (i * Math.PI) / n
    const px = 50 + r * Math.cos(a)
    const py = 50 + r * Math.sin(a)
    pts.push(`${px.toFixed(2)}% ${py.toFixed(2)}%`)
  }
  return pts.join(', ')
}

/** CSS clip-path value for polygon/star objects, or undefined for others. */
export function shapeClipPath(o: FObj): string | undefined {
  if (o.type === 'polygon') return `polygon(${polygonPoints(o.sides ?? 3)})`
  if (o.type === 'star') return `polygon(${starPoints(o.points ?? 5, o.innerRatio ?? 0.45)})`
  return undefined
}

/** Build a smoothed SVG path `d` (quadratic curves through midpoints) from raw
 * freehand points, normalised into a 0..1 box, plus the bounding box in the
 * original coordinate space. Returns null for fewer than 2 points. */
export function pathFromPoints(pts: { x: number; y: number }[], strokeWidth = 2): { d: string; x: number; y: number; w: number; h: number } | null {
  if (pts.length < 2) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y) }
  const pad = Math.max(2, strokeWidth)
  minX -= pad; minY -= pad; maxX += pad; maxY += pad
  const w = Math.max(1, maxX - minX)
  const h = Math.max(1, maxY - minY)
  const f = (n: number): number => +n.toFixed(4)
  const nx = (p: { x: number; y: number }): number => f((p.x - minX) / w)
  const ny = (p: { x: number; y: number }): number => f((p.y - minY) / h)
  let d = `M${nx(pts[0])},${ny(pts[0])}`
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = f((((pts[i].x - minX) / w) + ((pts[i + 1].x - minX) / w)) / 2)
    const my = f((((pts[i].y - minY) / h) + ((pts[i + 1].y - minY) / h)) / 2)
    d += ` Q${nx(pts[i])},${ny(pts[i])} ${mx},${my}`
  }
  const last = pts[pts.length - 1]
  d += ` L${nx(last)},${ny(last)}`
  return { d, x: minX, y: minY, w, h }
}

/** Combined CSS `filter` for an object's static effects. `clipped` shapes also
 * route their drop-shadow through the filter (box-shadow can't follow clip-path). */
export function staticFilter(o: FObj, clipped: boolean): string {
  const parts: string[] = []
  if (o.blur && o.blur > 0) parts.push(`blur(${o.blur}px)`)
  if (o.brightness !== undefined && o.brightness !== 1) parts.push(`brightness(${o.brightness})`)
  if (o.glow && o.glow > 0) parts.push(`drop-shadow(0 0 ${o.glow}px ${o.glowColor ?? '#22d3ee'})`)
  const list = filterListCss(o)
  if (list) parts.push(list)
  if (o.shadow && !o.shadowHidden && (clipped || o.shadowDrop)) parts.push(`drop-shadow(${o.shadowX}px ${o.shadowY}px ${o.shadowBlur}px ${rgbaFrom(o.shadowColor, o.shadowOpacity ?? 1)})`)
  return parts.join(' ')
}

/** Box-shadow for an object's static drop + inner shadow when it isn't clipped. */
export function staticBoxShadow(o: FObj): string | undefined {
  return objectBoxShadow(o)
}
