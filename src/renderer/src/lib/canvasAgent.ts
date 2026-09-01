import { type FObj, type Shape, makeObject } from './freeformTypes'
import { type LayerMotion, type PropName, type TKey, newKeyId } from './timelineModel'
import { ICON_PATHS, ICON_NAMES, resolveIcon } from './icons24'
import { deviceFromArtboard, pickGoldenExamples, formatGoldenForPrompt } from './goldenExamples'

// ── Structured actions the canvas assistant can return ───────────────────────────
// The assistant either asks a clarifying QUESTION, or proposes one or more concrete
// build actions (create objects / animate a layer). Everything is plain JSON so it
// can be produced by an LLM and validated/applied deterministically here.

export interface AgentQuestion {
  kind: 'question'
  /** the clarifying question to show the user */
  text: string
  /** optional quick-reply chips to speed up the answer */
  options?: string[]
}

/** A loose object spec — any subset of FObj fields. `type` is required. Geometry is
 * in artboard-local coordinates (0,0 = top-left of the active artboard).
 * `ref` is a temporary handle (e.g. "card1") the AI assigns so other objects can set
 * `parent: "card1"` and be grouped under it; `icon` names a UI icon from the library. */
export type ObjectSpec = Partial<Omit<FObj, 'id' | 'motion'>> & { type: Shape; ref?: string; icon?: string; component?: string; props?: Record<string, unknown>; accent?: string }

export interface AgentCreate {
  kind: 'create'
  /** short human summary of what was added */
  summary: string
  objects: ObjectSpec[]
}

export interface AgentAnimate {
  kind: 'animate'
  summary: string
  /** which layer to animate: 'selected', 'last' (most recently created), or a layer name */
  target?: string
  motion: LayerMotion
}

/** Change properties of an existing layer. */
export interface AgentEdit {
  kind: 'edit'
  summary: string
  /** 'selected', 'last', or a layer name */
  target: string
  patch: Partial<ObjectSpec>
}

/** Remove an existing layer. */
export interface AgentDelete {
  kind: 'delete'
  summary: string
  target: string
}

/** Create a new artboard (e.g. a phone/tablet/desktop frame) and make it active so
 * subsequent objects land on it. Used when the user wants a screen at a device size. */
export interface AgentArtboard {
  kind: 'artboard'
  summary: string
  w: number
  h: number
  name?: string
}

/** Build a whole screen from a semantic auto-layout TREE (containers + kit
 * components + content). The renderer computes all geometry, so the model never
 * guesses coordinates. `tree` is a UINode (see uiTree.ts); kept as unknown here to
 * avoid a circular import and validated when compiled. */
export interface AgentScreen {
  kind: 'screen'
  summary: string
  accent?: string
  tree: unknown
}

export type AgentAction = AgentQuestion | AgentCreate | AgentAnimate | AgentEdit | AgentDelete | AgentArtboard | AgentScreen
export interface AgentReply { actions: AgentAction[]; reply?: string }

// ── Validation / normalisation ───────────────────────────────────────────────────
const SHAPES: Shape[] = ['frame', 'rect', 'ellipse', 'line', 'arrow', 'polygon', 'star', 'text', 'image', 'path']
const PROPS: PropName[] = ['opacity', 'x', 'y', 'scale', 'rotate', 'blur', 'brightness', 'glow']
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d)

/** Turn an ObjectSpec into a complete FObj placed at (offsetX, offsetY) origin
 * (artboard absolute coords). Unknown/invalid fields fall back to makeObject's
 * sensible defaults so a partial spec always yields a valid object. */
export function buildObject(spec: ObjectSpec, offsetX: number, offsetY: number): FObj {
  // A named icon forces a stroked vector path regardless of the declared type.
  const iconKey = resolveIcon(spec.icon)
  const iconPath = iconKey ? ICON_PATHS[iconKey] : ''
  const type: Shape = iconPath ? 'path' : (SHAPES.includes(spec.type) ? spec.type : 'rect')
  const base = makeObject(type, offsetX + num(spec.x, 0), offsetY + num(spec.y, 0))
  const o: FObj = { ...base }
  // geometry
  o.w = Math.max(1, num(spec.w, type === 'text' ? base.w : 120))
  o.h = Math.max(1, num(spec.h, base.h))
  o.rotation = num(spec.rotation, 0)
  o.opacity = Math.max(0, Math.min(1, num(spec.opacity, 1)))
  o.radius = Math.max(0, num(spec.radius, base.radius))
  // paint
  if (typeof spec.fill === 'string') o.fill = spec.fill
  if (typeof spec.fillEnabled === 'boolean') o.fillEnabled = spec.fillEnabled
  if (spec.fillMode === 'solid' || spec.fillMode === 'gradient' || spec.fillMode === 'image') o.fillMode = spec.fillMode
  if (typeof spec.gradientFrom === 'string') o.gradientFrom = spec.gradientFrom
  if (typeof spec.gradientTo === 'string') o.gradientTo = spec.gradientTo
  if (typeof spec.gradientAngle === 'number') o.gradientAngle = spec.gradientAngle
  if (spec.gradientType === 'linear' || spec.gradientType === 'radial' || spec.gradientType === 'conic') o.gradientType = spec.gradientType
  if (Array.isArray(spec.gradientStops)) o.gradientStops = spec.gradientStops
  if (typeof spec.fillImage === 'string') o.fillImage = spec.fillImage
  if (typeof spec.fillOpacity === 'number') o.fillOpacity = Math.max(0, Math.min(1, spec.fillOpacity))
  if (typeof spec.blendMode === 'string') o.blendMode = spec.blendMode
  if (typeof spec.stroke === 'string') o.stroke = spec.stroke
  if (typeof spec.strokeEnabled === 'boolean') o.strokeEnabled = spec.strokeEnabled
  if (typeof spec.strokeWidth === 'number') o.strokeWidth = spec.strokeWidth
  if (typeof spec.strokeOffset === 'number') o.strokeOffset = spec.strokeOffset
  if (spec.strokeStyle === 'solid' || spec.strokeStyle === 'dashed') o.strokeStyle = spec.strokeStyle
  // text
  if (type === 'text') {
    o.text = str(spec.text, 'Text')
    o.color = str(spec.color, o.color)
    o.fontSize = Math.max(4, num(spec.fontSize, o.fontSize))
    o.fontWeight = num(spec.fontWeight, o.fontWeight)
    if (typeof spec.fontFamily === 'string') o.fontFamily = spec.fontFamily
    if (spec.align === 'left' || spec.align === 'center' || spec.align === 'right') o.align = spec.align
    if (typeof spec.italic === 'boolean') o.italic = spec.italic
    if (typeof spec.lineHeight === 'number') o.lineHeight = spec.lineHeight
    if (typeof spec.letterSpacing === 'number') o.letterSpacing = spec.letterSpacing
  }
  // polygon / star
  if (type === 'polygon' && typeof spec.sides === 'number') o.sides = Math.max(3, Math.round(spec.sides))
  if (type === 'star') {
    if (typeof spec.points === 'number') o.points = Math.max(3, Math.round(spec.points))
    if (typeof spec.innerRatio === 'number') o.innerRatio = Math.max(0.1, Math.min(0.9, spec.innerRatio))
  }
  // effects
  if (typeof spec.blur === 'number') o.blur = Math.max(0, spec.blur)
  if (typeof spec.brightness === 'number') o.brightness = Math.max(0, spec.brightness)
  if (typeof spec.glow === 'number') o.glow = Math.max(0, spec.glow)
  if (typeof spec.glowColor === 'string') o.glowColor = spec.glowColor
  if (typeof spec.parent === 'string') o.parent = spec.parent
  if (spec.layoutMode === 'none' || spec.layoutMode === 'horizontal' || spec.layoutMode === 'vertical' || spec.layoutMode === 'grid') o.layoutMode = spec.layoutMode
  if (typeof spec.layoutGap === 'number') o.layoutGap = Math.max(0, spec.layoutGap)
  if (typeof spec.layoutPadding === 'number') o.layoutPadding = Math.max(0, spec.layoutPadding)
  if (typeof spec.layoutPadX === 'number') o.layoutPadX = Math.max(0, spec.layoutPadX)
  if (typeof spec.layoutPadY === 'number') o.layoutPadY = Math.max(0, spec.layoutPadY)
  if (typeof spec.layoutCols === 'number') o.layoutCols = Math.max(1, Math.round(spec.layoutCols))
  if (typeof spec.layoutWrap === 'boolean') o.layoutWrap = spec.layoutWrap
  if (spec.layoutJustify === 'start' || spec.layoutJustify === 'center' || spec.layoutJustify === 'end' || spec.layoutJustify === 'space-between') o.layoutJustify = spec.layoutJustify
  if (spec.layoutAlign === 'start' || spec.layoutAlign === 'center' || spec.layoutAlign === 'end' || spec.layoutAlign === 'baseline') o.layoutAlign = spec.layoutAlign
  if (spec.widthMode === 'fixed' || spec.widthMode === 'fit' || spec.widthMode === 'fill') o.widthMode = spec.widthMode
  if (spec.heightMode === 'fixed' || spec.heightMode === 'fit' || spec.heightMode === 'fill') o.heightMode = spec.heightMode
  if (typeof spec.componentName === 'string') o.componentName = spec.componentName
  if (typeof spec.componentSource === 'string') o.componentSource = spec.componentSource
  if (typeof spec.componentVariant === 'string') o.componentVariant = spec.componentVariant
  if (typeof spec.componentSlot === 'string') o.componentSlot = spec.componentSlot
  if (spec.componentProps && typeof spec.componentProps === 'object') o.componentProps = spec.componentProps as Record<string, string | number | boolean>
  // shadow
  if (typeof spec.shadow === 'boolean') o.shadow = spec.shadow
  if (typeof spec.shadowColor === 'string') o.shadowColor = spec.shadowColor
  if (typeof spec.shadowX === 'number') o.shadowX = spec.shadowX
  if (typeof spec.shadowY === 'number') o.shadowY = spec.shadowY
  if (typeof spec.shadowBlur === 'number') o.shadowBlur = spec.shadowBlur
  if (typeof spec.shadowSpread === 'number') o.shadowSpread = spec.shadowSpread
  if (typeof spec.shadowOpacity === 'number') o.shadowOpacity = spec.shadowOpacity
  // vector path / named icon
  if (iconPath) {
    o.path = iconPath
    o.pathViewBox = '0 0 24 24'
    o.fillEnabled = false
    o.strokeEnabled = true
    if (typeof spec.stroke === 'string') o.stroke = spec.stroke
    else if (typeof spec.color === 'string') o.stroke = spec.color
    o.strokeWidth = typeof spec.strokeWidth === 'number' ? spec.strokeWidth : 1.8
    if (!spec.w) o.w = 24
    if (!spec.h) o.h = 24
  } else {
    if (typeof spec.path === 'string') o.path = spec.path
    if (typeof spec.pathViewBox === 'string') o.pathViewBox = spec.pathViewBox
  }
  if (typeof spec.name === 'string' && spec.name.trim()) o.name = spec.name.trim()
  return o
}

/** Validate a partial spec into a safe Partial<FObj> for editing an existing
 * object. x/y are artboard-local (the caller adds the artboard offset). */
export function sanitizeObjectPatch(spec: Partial<ObjectSpec>): Partial<FObj> {
  const p: Partial<FObj> = {}
  if (typeof spec.x === 'number') p.x = spec.x
  if (typeof spec.y === 'number') p.y = spec.y
  if (typeof spec.w === 'number') p.w = Math.max(1, spec.w)
  if (typeof spec.h === 'number') p.h = Math.max(1, spec.h)
  if (typeof spec.rotation === 'number') p.rotation = spec.rotation
  if (typeof spec.opacity === 'number') p.opacity = Math.max(0, Math.min(1, spec.opacity))
  if (typeof spec.radius === 'number') p.radius = Math.max(0, spec.radius)
  if (typeof spec.fill === 'string') p.fill = spec.fill
  if (typeof spec.fillEnabled === 'boolean') p.fillEnabled = spec.fillEnabled
  if (spec.fillMode === 'solid' || spec.fillMode === 'gradient' || spec.fillMode === 'image') p.fillMode = spec.fillMode
  if (typeof spec.gradientFrom === 'string') p.gradientFrom = spec.gradientFrom
  if (typeof spec.gradientTo === 'string') p.gradientTo = spec.gradientTo
  if (typeof spec.gradientAngle === 'number') p.gradientAngle = spec.gradientAngle
  if (spec.gradientType === 'linear' || spec.gradientType === 'radial' || spec.gradientType === 'conic') p.gradientType = spec.gradientType
  if (Array.isArray(spec.gradientStops)) p.gradientStops = spec.gradientStops
  if (typeof spec.fillImage === 'string') p.fillImage = spec.fillImage
  if (typeof spec.fillOpacity === 'number') p.fillOpacity = Math.max(0, Math.min(1, spec.fillOpacity))
  if (typeof spec.blendMode === 'string') p.blendMode = spec.blendMode
  if (typeof spec.stroke === 'string') p.stroke = spec.stroke
  if (typeof spec.strokeEnabled === 'boolean') p.strokeEnabled = spec.strokeEnabled
  if (typeof spec.strokeWidth === 'number') p.strokeWidth = spec.strokeWidth
  if (typeof spec.strokeOffset === 'number') p.strokeOffset = spec.strokeOffset
  if (spec.strokeStyle === 'solid' || spec.strokeStyle === 'dashed') p.strokeStyle = spec.strokeStyle
  if (typeof spec.text === 'string') p.text = spec.text
  if (typeof spec.color === 'string') p.color = spec.color
  if (typeof spec.fontSize === 'number') p.fontSize = Math.max(4, spec.fontSize)
  if (typeof spec.fontWeight === 'number') p.fontWeight = spec.fontWeight
  if (typeof spec.fontFamily === 'string') p.fontFamily = spec.fontFamily
  if (spec.align === 'left' || spec.align === 'center' || spec.align === 'right') p.align = spec.align
  if (typeof spec.blur === 'number') p.blur = Math.max(0, spec.blur)
  if (typeof spec.brightness === 'number') p.brightness = Math.max(0, spec.brightness)
  if (typeof spec.glow === 'number') p.glow = Math.max(0, spec.glow)
  if (typeof spec.glowColor === 'string') p.glowColor = spec.glowColor
  if (typeof spec.path === 'string') p.path = spec.path
  if (typeof spec.parent === 'string') p.parent = spec.parent
  if (spec.layoutMode === 'none' || spec.layoutMode === 'horizontal' || spec.layoutMode === 'vertical') p.layoutMode = spec.layoutMode
  if (typeof spec.layoutGap === 'number') p.layoutGap = Math.max(0, spec.layoutGap)
  if (typeof spec.layoutPadding === 'number') p.layoutPadding = Math.max(0, spec.layoutPadding)
  if (typeof spec.componentName === 'string') p.componentName = spec.componentName
  if (typeof spec.componentSource === 'string') p.componentSource = spec.componentSource
  if (typeof spec.componentVariant === 'string') p.componentVariant = spec.componentVariant
  if (typeof spec.componentSlot === 'string') p.componentSlot = spec.componentSlot
  if (spec.componentProps && typeof spec.componentProps === 'object') p.componentProps = spec.componentProps as Record<string, string | number | boolean>
  if (typeof spec.sides === 'number') p.sides = Math.max(3, Math.round(spec.sides))
  if (typeof spec.points === 'number') p.points = Math.max(3, Math.round(spec.points))
  if (typeof spec.name === 'string' && spec.name.trim()) p.name = spec.name.trim()
  return p
}
export function normalizeMotion(m: unknown): LayerMotion | null {
  if (!m || typeof m !== 'object') return null
  const obj = m as { duration?: unknown; tracks?: unknown }
  const duration = Math.max(100, num(obj.duration, 1000))
  const tracksIn = (obj.tracks && typeof obj.tracks === 'object' ? obj.tracks : {}) as Record<string, unknown>
  const tracks: LayerMotion['tracks'] = {}
  for (const prop of PROPS) {
    const raw = tracksIn[prop]
    if (!Array.isArray(raw)) continue
    const keys: TKey[] = raw
      .filter((k): k is { t?: unknown; v?: unknown; easing?: unknown } => !!k && typeof k === 'object')
      .map((k) => ({ id: newKeyId(), t: Math.max(0, Math.min(duration, num(k.t, 0))), v: num(k.v, 0), ...(typeof k.easing === 'string' ? { easing: k.easing } : {}) }))
      .sort((a, b) => a.t - b.t)
    if (keys.length >= 1) tracks[prop] = keys
  }
  if (Object.keys(tracks).length === 0) return null
  return { duration, tracks }
}

/** Best-effort parse of the model's reply into structured actions. Accepts a raw
 * string (may be wrapped in markdown/code fences or prose) and extracts the JSON. */
export function parseAgentReply(raw: string): AgentReply {
  const json = extractJson(raw)
  if (!json) return { actions: [], reply: raw.trim() }
  const out: AgentAction[] = []
  const list = Array.isArray(json.actions) ? json.actions : []
  for (const a of list) {
    if (!a || typeof a !== 'object') continue
    const kind = (a as { kind?: string }).kind
    if (kind === 'question') {
      const q = a as AgentQuestion
      if (typeof q.text === 'string') out.push({ kind: 'question', text: q.text, options: Array.isArray(q.options) ? q.options.filter((o) => typeof o === 'string').slice(0, 6) : undefined })
    } else if (kind === 'create') {
      const c = a as AgentCreate
      const objs = Array.isArray(c.objects) ? c.objects.filter((o) => o && typeof o === 'object' && typeof (o as ObjectSpec).type === 'string') : []
      if (objs.length) out.push({ kind: 'create', summary: str(c.summary, 'Added elements'), objects: objs })
    } else if (kind === 'animate') {
      const an = a as AgentAnimate
      const motion = normalizeMotion(an.motion)
      if (motion) out.push({ kind: 'animate', summary: str(an.summary, 'Added animation'), target: typeof an.target === 'string' ? an.target : undefined, motion })
    } else if (kind === 'edit') {
      const ed = a as AgentEdit
      if (ed.patch && typeof ed.patch === 'object') out.push({ kind: 'edit', summary: str(ed.summary, 'Updated layer'), target: str(ed.target, 'selected'), patch: ed.patch })
    } else if (kind === 'delete') {
      const de = a as AgentDelete
      out.push({ kind: 'delete', summary: str(de.summary, 'Deleted layer'), target: str(de.target, 'selected') })
    } else if (kind === 'artboard') {
      const ar = a as AgentArtboard
      out.push({ kind: 'artboard', summary: str(ar.summary, 'Added artboard'), w: Math.max(120, num(ar.w, 1280)), h: Math.max(120, num(ar.h, 800)), name: typeof ar.name === 'string' ? ar.name : undefined })
    } else if (kind === 'screen') {
      const sc = a as AgentScreen
      if (sc.tree && typeof sc.tree === 'object') out.push({ kind: 'screen', summary: str(sc.summary, 'Built screen'), accent: typeof sc.accent === 'string' ? sc.accent : undefined, tree: sc.tree })
    }
  }
  return { actions: out, reply: typeof json.reply === 'string' ? json.reply : undefined }
}

/** Pull the first balanced JSON object out of a string (handles code fences/prose). */
function extractJson(raw: string): { actions?: unknown; reply?: unknown } | null {
  let s = raw.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) s = fence[1].trim()
  const start = s.indexOf('{')
  if (start < 0) return null
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(s.slice(start, i + 1)) } catch { return null } } }
  }
  return null
}

// ── Prompt construction ──────────────────────────────────────────────────────────
export interface CanvasContext {
  artboard: { w: number; h: number; bg: string }
  layers: { name: string; type: string }[]
  selection: string[]
  designSystem?: string
  brain?: string
}
export interface ChatTurn { role: 'user' | 'assistant'; content: string }

const SYSTEM = `You are the design assistant inside a freeform design canvas (like Figma). You help the user build UI elements and animate them by returning STRUCTURED JSON only.

OUTPUT CONTRACT — reply with ONE JSON object and nothing else:
{ "actions": [ ...one or more actions... ], "reply": "one short sentence to the user" }

Each action is one of:
1. { "kind": "question", "text": "<a single clarifying question>", "options": ["short option", ...] }
   Use this when the request is ambiguous or under-specified. Ask ONE focused question at a time. options is optional quick-replies.
2. { "kind": "create", "summary": "<what you added>", "objects": [ <ObjectSpec>, ... ] }
3. { "kind": "animate", "summary": "<the motion>", "target": "selected" | "last" | "<layer name>", "motion": <Motion> }
4. { "kind": "edit", "summary": "<what changed>", "target": "selected" | "last" | "<layer name>", "patch": <partial ObjectSpec> }
   Change properties of an EXISTING layer (e.g. recolor, resize, move, rename, edit text). Only include the fields that change.
5. { "kind": "delete", "summary": "<what removed>", "target": "selected" | "last" | "<layer name>" }
6. { "kind": "artboard", "summary": "<which device>", "w": <px>, "h": <px>, "name": "<the app/screen name, e.g. 'Now playing', 'New expense' — NOT 'Phone' or 'Artboard 1'>" }
   Create a fresh device-sized artboard and make it active. Sizes: Phone 390x844, Tablet 834x1194, Desktop 1440x900.
7. { "kind": "screen", "summary": "<what>", "accent": "#hex", "tree": <UINode> }
   BEST way to build a full app screen. You describe INTENT as a layout tree and we compute every pixel — never guess coordinates. Emit an artboard action first, then this.
   UINode is one of:
     container: { "stack":"y"|"x"|"grid", "gap":<px>, "pad":<px>, "cols":<n for grid>, "bg":"<role|hex>", "radius":<px>, "children":[ <UINode>, ... ] }
     component: { "component":"<name>", "props":{...}, ... }   // see COMPONENT KIT names below
     text:      { "text":"...", "fontSize":<px>, "fontWeight":<400-800>, "color":"<role|hex>", "align":"left|center|right" }
     spacer:    { "h":<px> }
   Colour roles: accent, ink, muted, faint, surface, border, bg. Set ONE accent at the top. Build screens as a vertical stack of components; use grid/row for tiles and quick-action bars.

You can return SEVERAL actions in one reply (e.g. create a card then animate it, or edit two layers). Use the existing-layers list to target edits/deletes by name. Prefer editing an existing layer over recreating it.

INTENT IS LAW: anything the user explicitly specifies — exact colours, copy, fonts, sizes, layout, which component, device — is locked. Honour it precisely and never replace it with a "better" default. Defaults only fill the gaps the user left open.

INTAKE (don't overwhelm): ask at most 1–2 short questions, and ONLY about essentials the user hasn't given. NEVER ask about screen size/device — infer it (see TARGET DEVICE) and just build. The only thing worth asking about is one look anchor, and only when the request gives no styling cue at all: if a design system is active, "Use the active design system"; otherwise a vibe like "Minimal", "Bold", "Playful" (the user may also attach a reference image). If the request is specific enough, skip questions entirely and build.

BE HEAVILY CONTROLLED: if the user request is vague (missing copy, colors, count, layout, or which element to animate), return a "question" action FIRST instead of guessing. Only act once the intent is clear. A reasonable, specific request can be built directly. For a multi-part UI (card, form, hero, navbar), create all the pieces as separate well-laid-out objects (a container frame plus text/buttons), not one block.

TARGET DEVICE: never ask which screen size — just choose one and build; the user can resize the artboard on the canvas. Infer the device from the request (mentions of "app", "mobile", "iOS/Android" → Phone 390x844; "tablet"/"iPad" → Tablet 834x1194; "website", "landing", "dashboard", "web app", or anything unspecified → Desktop 1440x900). If the active artboard already implies a size, reuse it. Emit an "artboard" action sized to the chosen device (unless reusing the current one), THEN a "create" action whose root frame fills it (x:0,y:0,w:artboard.w,h:artboard.h). Never float a small centred card in a sea of empty space; center content within a full-bleed background, not a tiny island.

ObjectSpec (all in artboard-local px; 0,0 = top-left of the artboard; omit fields to use defaults):
  type: "frame"|"rect"|"ellipse"|"line"|"arrow"|"polygon"|"star"|"text"|"image"|"path" (required)
  ref: "<short id you invent, e.g. card>" — so other objects can set parent:"card" to GROUP under this one
  parent: "<ref of a sibling frame or an existing layer name>" — nest this inside that frame
  name, x, y, w, h, rotation, opacity(0..1)
  fill (hex), fillEnabled(bool), stroke(hex), strokeEnabled(bool), strokeWidth, radius
  layoutMode("horizontal"|"vertical"), layoutGap, layoutPadding — turns a frame into an auto-layout group that stacks its children
  text, color(hex), fontSize, fontWeight(400|500|600|700|800), align("left"|"center"|"right")
  icon: "<name>" — drops in a clean vector icon (sets type=path). Names: ${ICON_NAMES.join(', ')}
  sides (polygon), points/innerRatio (star)
  shadow(bool), shadowColor; blur, brightness(1=normal), glow, glowColor

GROUPING — never emit a pile of loose layers. Wrap each logical block in a frame and give it a ref; parent every child to that ref (the form gets one frame, each card gets one frame). Use a vertical/horizontal layoutMode + layoutGap + layoutPadding on frames so content auto-stacks. Nest: section frame > card frames > rows > label/value/icon.

COLOR — pick ONE cohesive palette: a page bg, a surface (card) bg, a border, text (primary + muted), and ONE accent for primary actions. Reuse those few colors everywhere; primary buttons use the accent, everything else stays neutral. Strong contrast, no rainbow.

SPACING — multiples of 8px (8/12/16/24/32). Pad cards ~24, gap rows ~12-16, button height ~44. Don't crowd; don't leave one giant empty column.

ICONS — add a relevant icon to nav items, buttons, list rows, stats and empty states. ALWAYS use the named library via icon:"<name>" from the list above (16-24px, w==h). NEVER hand-write SVG path data for an icon and NEVER build an icon out of several lines/circles/rects — hand-drawn icons come out wonky and skewed. If the exact icon you want isn't listed, pick the closest name (e.g. cart->bag, gear->settings, magnifier->search); the resolver maps synonyms automatically. Never emoji.

COMPONENT KIT — for app/mobile screens, COMPOSE from these polished components instead of drawing boxes by hand. Emit one object per component: { "type":"frame", "component":"<name>", "x":<px>, "y":<px>, "w":<px>, "accent":"<hex>", "props":{...} }. We render a pixel-perfect version. Stack them top-to-bottom with the y values; set the SAME accent hex on each.
  • statusBar — props: {}. Put at the very top of a mobile screen (h44).
  • navBar — props:{ title, back?:true, action?:"<icon>" } (h52).
  • heroAmount — props:{ value:"$48.50", label? } — big centered number with an accent underline (h118).
  • listRow — props:{ icon?, label, value?, chevron?:true, divider?:true } — borderless row with a hairline divider (h64). Use for Category/Date/settings rows. NEVER wrap these in a bordered card.
  • inputRow — props:{ icon?, placeholder, divider? } (h64).
  • primaryButton — props:{ label, icon? } — full-width accent pill with shadow (h56). This is the ONLY big block of accent colour.
  • homeIndicator — props:{} — the iOS handle at the bottom.
  • MEDIA/PLAYER: albumArt — props:{ size? } — centred square artwork placeholder; trackInfo — props:{ title, artist } — centred title + artist; scrubber — props:{ value, max, leftLabel, rightLabel } — progress slider with a thumb + time labels (e.g. value:84,max:243,leftLabel:"1:24",rightLabel:"4:03"); transport — props:{ playing? } — the full shuffle·previous·PLAY(accent circle)·next·repeat control row (the play button is the ONLY accent here); volumeRow — props:{ value, queue? } — volume icon + slider + up-next icon. Compose a music screen as statusBar, navBar, albumArt, trackInfo, scrubber, transport, volumeRow, homeIndicator — never hand-place these.
  • DASHBOARD/DESKTOP: sidebar — props:{ brand, brandIcon, h, items:[{icon,label,active}] and optionally {section:"Main"} rows that head a group }; topBar — props:{ title, subtitle, action?, h }; statTile — props:{ label, value, delta?, icon }; barChart — props:{ title?, values:[..], labels:[..], h }; tabBar — props:{ items:[{icon,label?,active}] }; progressRing — props:{ value, max, label?, size }; avatar — props:{ initials, size }; table — props:{ title?, columns:["Date","Usage","Status"], rows:[["12 Aug","18 kWh","Paid"], ..] } for any history, log or list of records (status words like Paid/Pending/Overdue are drawn as badges automatically).
  • GENERIC ATOMS — for ANYTHING not covered above, COMPOSE from these instead of hand-drawing; a new kind of screen needs no special component: slider — props:{ value, max, label? } (any track: volume, brightness, price, rating); iconButton — props:{ icon, filled?, size? } (any tap target / FAB / play); field — props:{ label?, placeholder, icon?, value? } (any labelled input); chip — props:{ label, icon?, active? } (filter/tag); badge — props:{ label, tone:"success|warning|error|info|neutral" } (status pill); divider — props:{}. Build a never-seen screen as containers + these atoms; let the compiler place everything.
  For a desktop dashboard use {stack:"x"} with a sidebar (set that node's "w":240) beside a {stack:"y"} main column that fills the rest; place 2-4 statTiles in a {stack:"x"} row, and the chart + a list side by side in another {stack:"x"}.
For anything not covered, fall back to raw frames/text/icons, but keep the same restraint: borderless rows + dividers over boxes.

ACCENT & RESTRAINT — choose ONE confident, SATURATED accent hex (a considered blue/teal/green/amber — NOT grey/black, NOT indigo/violet/purple). Apply it ONLY to the primary button and the small hero underline / active states. Everything else is neutral (ink #111827, muted #6b7280, border #e5e7eb, surface #f9fafb, white bg). The primary button is filled with the accent — never grey or black. Never colour a whole card or the amount block in the accent.

COMPONENT PATTERNS (when building blocks by hand): app bar, card, list row (icon + label + right value/chevron + divider), stat tile, form field, primary/secondary button, chip, badge, empty state. Reuse exact paddings/radii/heights across same-type blocks.

Motion = { "duration": <ms>, "tracks": { <prop>: [ {"t": <ms>, "v": <number>, "easing": "<easing>"}, ... ] } }
  props: x,y (translate OFFSET in px, rest=0), scale (rest=1), rotate (degrees, rest=0), opacity (0..1), blur(px), brightness(1), glow(px)
  Each track needs >=2 keys. Entrances must END at rest (x:0,y:0,scale:1,opacity:1,rotate:0). t goes 0..duration.
  easing: "cubic-bezier(a,b,c,d)", or "spring(bounce,freq)" (bounce 0..1, freq 3..16), or "linear". Put easing on the key that STARTS a segment.
  Example fade-in-up over 700ms: {"duration":700,"tracks":{"opacity":[{"t":0,"v":0,"easing":"cubic-bezier(0,0,0.58,1)"},{"t":700,"v":1}],"y":[{"t":0,"v":24,"easing":"cubic-bezier(0,0,0.58,1)"},{"t":700,"v":0}]}}

DESIGN RULES: real icons (never emoji); no gradients, solid colors only; no all-caps labels; no decorative blobs; subtle shadows; clear visual hierarchy (one heading, supporting copy, metadata); modern sans fonts; specific copy, never lorem ipsum. NEVER put a border/outline on a container, card, group or section frame — separate cards with a subtle fill or soft shadow + whitespace, never strokes (only a single hairline divider between list rows, or an input/unselected-toggle border, is allowed). Use the full toolset — frames, auto-layout, icons, the palette — to make a real, grouped, polished component, not a flat stack of rectangles.

Return ONLY the JSON object. No markdown, no commentary outside the JSON.`

export function buildAssistantPrompt(ctx: CanvasContext, history: ChatTurn[], userText: string, quality = true, extra = '', includeGolden = true): string {
  const layers = ctx.layers.length ? ctx.layers.map((l) => `- ${l.name} (${l.type})`).join('\n') : '(none yet)'
  const sel = ctx.selection.length ? ctx.selection.join(', ') : '(nothing selected)'
  const convo = history.slice(-8).map((t) => `${t.role === 'user' ? 'USER' : 'ASSISTANT'}: ${t.content}`).join('\n')
  const modeNote = quality
    ? '\nMODE: Quality. Work like a senior product designer — establish layout, hierarchy and spacing first, group everything into frames, use icons and a consistent palette, and make it genuinely polished.'
    : '\nMODE: Fast. Produce a clean, correct result with minimal back-and-forth; skip non-essential questions.'
  const device = deviceFromArtboard(ctx.artboard.w, ctx.artboard.h)
  const golden = includeGolden ? formatGoldenForPrompt(pickGoldenExamples(userText, device, 1)) : ''
  return [
    SYSTEM,
    modeNote,
    `\nCURRENT CANVAS:\nArtboard: ${ctx.artboard.w}x${ctx.artboard.h}px, background ${ctx.artboard.bg}`,
    `Existing layers (front to back):\n${layers}`,
    `Selected: ${sel}`,
    ctx.designSystem ? `\nACTIVE DESIGN SYSTEM:\n${ctx.designSystem}\nUse these tokens and components when the user asks for UI. Do not invent new colors, radii, fonts, or outlines unless the user asks.` : '\nPALETTE: no design system is active. Use ONE confident, saturated accent (default #0f766e teal) on the primary button + small highlights only; everything else neutral (ink #111827, muted #6b7280, border #e5e7eb, surface #f9fafb, white bg). The primary button MUST be the accent colour — never grey or black. Avoid indigo/violet/purple.',
    ctx.brain ? `\n${ctx.brain}` : '',
    golden ? `\n${golden}` : '',
    convo ? `\nCONVERSATION SO FAR:\n${convo}` : '',
    `\nUSER: ${userText}`,
    extra ? `\n${extra}` : '',
    `\nReturn the JSON object now.`,
  ].filter(Boolean).join('\n')
}

// ── Multi-pass pipeline directives (Quality mode) ────────────────────────────────
// Each stage is the SAME base prompt plus one of these, so the model keeps full
// context while focusing on one job. Stages return a full "create" so we can apply
// the latest result without fragile incremental edits.
export const STRUCTURE_DIRECTIVE =
  'STAGE 1 of 3 — STRUCTURE. Design the low-fidelity LAYOUT only: the artboard (device) plus a full-bleed root frame and the section/card/row frames inside it, grouped with refs/parent and auto-layout, on an 8px rhythm. Use neutral greys for fills and short real labels for text. Establish clear hierarchy and spacing. Do NOT worry about final colours or icons yet. Return one artboard action (if a new screen) + one create action. For a phone/app screen you may instead return an artboard + a {kind:"screen"} tree of containers + kit components — that is preferred because we lay it out perfectly.'
export function visualDirective(structureJson: string): string {
  return `STAGE 2 of 3 — VISUAL DESIGN. Here is the approved STRUCTURE you produced:\n${structureJson}\nNow return the FULL result again (same artboard + layout) but apply real visual design: a single cohesive palette (page bg, surface, border, text primary/muted, ONE accent for primary actions), the type scale, real icons on actionable items, consistent radii/padding, subtle elevation, and specific copy. Prefer the {kind:"screen"} tree with kit components if this is an app screen. Keep the structure and spacing; only elevate the visuals. Honour anything the user explicitly asked for.`
}
export function critiqueDirective(designJson: string): string {
  return `STAGE 3 of 3 — CRITIQUE & FIX. Here is the current design:\n${designJson}\nReview it as a senior designer against: clear hierarchy, 8px spacing rhythm, alignment, WCAG-AA text contrast, consistent radii/type, icons present, ONE accent used with restraint (primary button + small highlights only, never a whole card, never a grey primary), borderless rows + dividers over boxes, and NO AI defaults (no generic hero, no emoji, no rainbow colours, no all-caps, no tiny card floating in whitespace). Then return the corrected FULL result (same action shape — create or screen tree). Do not change anything the user explicitly specified.`
}
export function variantDirective(structureJson: string, n: number): string {
  const dirs = ['a calmer, more minimal treatment', 'a bolder, more expressive treatment with stronger accent use', 'a denser, information-rich treatment']
  return `VARIANT ${n}. Using the same content and a NEW artboard of the same device size, return an artboard action + a full create that reinterprets this structure with ${dirs[(n - 2) % dirs.length]}. Keep it polished and on-brief.\nSTRUCTURE:\n${structureJson}`
}
export const VISION_BRIEF_DIRECTIVE =
  'Look at the attached reference image(s). Extract a short STYLE BRIEF for recreating this look: dominant palette (hex), layout structure & density, corner radius feel, typography vibe, and overall mood. Reply with 4-8 concise lines of plain text (no JSON).'
