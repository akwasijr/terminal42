// A new Motion document, and how an old one is made safe to load.
//
// Defaults are deliberately not "everything at zero". A document that opens
// showing a still, flat, centred grid of nothing teaches you nothing about
// what the controls do. It opens as a slowly turning carousel because that is
// the fastest way to understand the tool: move a slider, watch what changes.

import type {
  AnimationState, CardOverride, ComponentId, DropShadowFx, EdgeAmounts, EdgeBlurFx, EdgeFalloff,
  EdgeShadeFx, EffectScope, EffectsState, EntranceShape, EntranceSpec, GlassFx, LogoLayer,
  MotionDoc, ParamSpec, ParamValue, PictureLayer, ShapeKind, ShapeLayer, TextLayer, Wave
} from './types'
import { SHAPE_KINDS } from './types'
import { defaultEntrance, ENTRANCE_SHAPES } from './entrance'
import { wrap01 } from './math'

export function defaultParams(schema: ParamSpec[]): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  for (const spec of schema) out[spec.key] = spec.default
  return out
}

/** Freshly built animation state: every switch present, all off by default. */
export function defaultAnimation(): AnimationState {
  return {
    componentIn: defaultEntrance('in'),
    componentOut: defaultEntrance('out'),
    textIn: defaultEntrance('in'),
    textOut: defaultEntrance('out'),
    replayEvery: 5
  }
}

export function emptyDoc(componentId: ComponentId = 'carousel'): MotionDoc {
  return {
    version: 1,
    componentId,
    params: {},
    componentEnabled: true,
    animationEnabled: true,
    pose: { tiltX: 12, tiltY: 0, tiltZ: 0 },
    cardTilt: { tiltX: 0, tiltY: 0, tiltZ: 0, stagger: false },
    displacement: {
      displaceZ: 0, displaceY: 0, speed: 1, offset: 0.4,
      freeOrbit: 0, panX: 0, panZ: 0, panSpeed: 1,
      wave: { depth: 0, frequency: 1, speed: 1, style: 'wave', direction: 'horizontal' }
    },
    transform: { positionX: 0, positionY: 0, scale: 1 },
    easing: { x1: 0.25, y1: 0, x2: 0, y2: 1 },
    overrides: {},
    animation: defaultAnimation(),
    visual: {
      card: {
        aspect: '4:5',
        corner: 10,
        gradient: true,
        gradientOpacity: 20,
        gradientSide: 'both',
        backOpacity: 20,
        borderWidth: 0,
        borderColour: '#ffffff',
        borderOpacity: 100
      },
      images: [],
      imageOrder: 'in-order',
      text: [],
      logos: [],
      effects: defaultEffects()
    },
    frame: {
      aspect: '16:9',
      corners: 12,
      background: '#0a0a0a',
      gridVisible: true,
      gridColumns: 12,
      gridRows: 12,
      gridColour: '#3a3a38',
      gridInExport: false,
      gap: 0
    },
    export: {
      resolution: 1080,
      format: 'mp4',
      fps: 30,
      durationSec: 5,
      seamlessLoop: true,
      gridBehindComponent: false,
      stillFormat: 'png',
      stillScale: 2,
      transparentBackground: false
    }
  }
}

/**
 * Reconcile a stored document with the current shape of the code.
 *
 * Documents outlive the parameters they were saved with: a slider gets a new
 * range, a component gains an option. Merging against fresh defaults means an
 * old document opens with sensible values for anything it has never heard of,
 * instead of rendering a scene full of `undefined` and looking broken.
 */
export function hydrateDoc(raw: unknown): MotionDoc {
  const base = emptyDoc()
  if (!raw || typeof raw !== 'object') return base
  const doc = raw as Partial<MotionDoc>
  return {
    ...base,
    ...doc,
    version: 1,
    params: { ...(doc.params ?? {}) },
    pose: { ...base.pose, ...(doc.pose ?? {}) },
    cardTilt: { ...base.cardTilt, ...(doc.cardTilt ?? {}) },
    displacement: {
      ...base.displacement,
      ...(doc.displacement ?? {}),
      wave: hydrateWave((doc.displacement as { wave?: unknown } | undefined)?.wave, base.displacement.wave)
    },
    transform: { ...base.transform, ...(doc.transform ?? {}) },
    easing: { ...base.easing, ...(doc.easing ?? {}) },
    overrides: hydrateOverrides(doc.overrides),
    animation: hydrateAnimation(doc.animation),
    visual: {
      ...base.visual,
      ...(doc.visual ?? {}),
      card: { ...base.visual.card, ...(doc.visual?.card ?? {}) },
      images: doc.visual?.images ?? [],
      text: hydrateTextSpans(doc.visual?.text),
      logos: hydrateLogos(doc.visual?.logos),
      shapes: hydrateShapes(doc.visual?.shapes),
      pictures: hydratePictures(doc.visual?.pictures),
      effects: hydrateEffects(doc.visual?.effects)
    },
    frame: { ...base.frame, ...(doc.frame ?? {}) },
    export: { ...base.export, ...(doc.export ?? {}) },
    keys: hydrateKeys(doc.keys)
  }
}

/**
 * Keyframe tracks, with anything malformed dropped.
 *
 * A document is a file on disk that a person can edit, and a track holding a
 * key with no time would divide by nothing halfway through a render. Bad keys
 * are discarded rather than repaired, because there is no honest guess at
 * where a key without a time was meant to go.
 */
function hydrateKeys(raw: MotionDoc['keys']): MotionDoc['keys'] {
  if (!raw || typeof raw !== 'object') return undefined
  const out: NonNullable<MotionDoc['keys']> = {}
  for (const [target, track] of Object.entries(raw)) {
    if (!track || !Array.isArray(track.keys)) continue
    const keys = track.keys
      .filter((k) => k && typeof k.t === 'number' && Number.isFinite(k.t) && typeof k.v === 'number' && Number.isFinite(k.v))
      .map((k, i) => ({ ...k, id: k.id || `k${i}`, t: wrap01(k.t) }))
      .sort((a, b) => a.t - b.t)
    if (keys.length > 0) out[target] = { ...track, keys }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Rebuild the hand edits, filling in any field a stored override predates.
 *
 * A half-written override would put `undefined` into an addition and turn a
 * card's position into NaN, which reads on screen as the card vanishing.
 */
function hydrateOverrides(raw: unknown): Record<string, CardOverride> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, CardOverride> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const o = value as Partial<CardOverride>
    out[key] = {
      dx: num(o.dx), dy: num(o.dy), dz: num(o.dz),
      drotX: num(o.drotX), drotY: num(o.drotY), drotZ: num(o.drotZ),
      scale: Number.isFinite(o.scale) && (o.scale as number) > 0 ? (o.scale as number) : 1,
      ...(typeof o.imageId === 'string' ? { imageId: o.imageId } : {})
    }
  }
  return out
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/**
 * Rebuild the animation switches, repairing anything a stored document has
 * corrupted or predates.
 *
 * Same reasoning as `hydrateOverrides`: a bad `duration` of `"1s"` or a shape
 * the current code no longer knows must not survive into a live document, or
 * `cardProgress` and `applyEntrance` would be handed NaN and every card would
 * either vanish or freeze.
 */
function hydrateAnimation(raw: unknown): AnimationState {
  const base = defaultAnimation()
  if (!raw || typeof raw !== 'object') return base
  const a = raw as Partial<AnimationState>
  return {
    componentIn: hydrateEntrance(a.componentIn, base.componentIn),
    componentOut: hydrateEntrance(a.componentOut, base.componentOut),
    textIn: hydrateEntrance(a.textIn, base.textIn),
    textOut: hydrateEntrance(a.textOut, base.textOut),
    replayEvery: Number.isFinite(a.replayEvery) && (a.replayEvery as number) > 0 ? (a.replayEvery as number) : base.replayEvery
  }
}

function hydrateEntrance(raw: unknown, fallback: EntranceSpec): EntranceSpec {
  if (!raw || typeof raw !== 'object') return fallback
  const s = raw as Partial<EntranceSpec>
  const shape = ENTRANCE_SHAPES.some((e) => e.id === s.shape) ? (s.shape as EntranceShape) : fallback.shape
  return {
    enabled: typeof s.enabled === 'boolean' ? s.enabled : fallback.enabled,
    shape,
    // Clamped to something sane rather than merely finite: a stored duration
    // of 0 or of 500 would either divide by zero downstream or make Play look
    // like it never started.
    duration: Number.isFinite(s.duration) ? Math.min(10, Math.max(0.05, s.duration as number)) : fallback.duration,
    stagger: Number.isFinite(s.stagger) ? Math.min(2, Math.max(0, s.stagger as number)) : fallback.stagger,
    easing: {
      x1: num2(s.easing?.x1, fallback.easing.x1),
      y1: num2(s.easing?.y1, fallback.easing.y1),
      x2: num2(s.easing?.x2, fallback.easing.x2),
      y2: num2(s.easing?.y2, fallback.easing.y2)
    }
  }
}

function num2(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** Clamp a stored value into what the schema currently allows. */
export function coerceParam(spec: ParamSpec, value: ParamValue | undefined): ParamValue {
  if (value === undefined) return spec.default
  if (spec.kind === 'slider') {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(n)) return spec.default
    return Math.min(spec.max, Math.max(spec.min, n))
  }
  if (spec.kind === 'toggle') return typeof value === 'boolean' ? value : spec.default
  return spec.options.some((o) => o.value === value) ? value : spec.default
}

export function paramsFor(
  schema: ParamSpec[],
  stored: Record<string, ParamValue> | undefined
): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  for (const spec of schema) out[spec.key] = coerceParam(spec, stored?.[spec.key])
  return out
}

export function defaultEffects(): EffectsState {
  return {
    blur: 0,
    grain: 0,
    vignette: 0,
    shadow: 0,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    tint: '#000000',
    tintAmount: 0,
    dropShadow: { enabled: false, angle: 0, distance: 30, blur: 20, density: 45, colour: '#000000' },
    // The edges start with a reach rather than at zero so that switching one
    // of these on does something. A switch that appears to do nothing reads
    // as broken, and nobody goes looking for the second setting that would
    // have made the first one work.
    edgeBlur: { enabled: false, falloff: 'soft', edges: evenEdges(35), amount: 30, softness: 50, over: 'everything' },
    edgeShade: { enabled: false, mode: 'dark', colour: '#000000', falloff: 'linear', edges: evenEdges(35), softness: 55, over: 'everything' },
    glass: { enabled: false, edges: 'all', per: evenEdges(100), width: 12, refraction: 45, curve: 2 }
  }
}

/**
 * Every edge at zero.
 *
 * A treatment that arrived reaching in from all four edges would change how
 * a piece looks the moment it was switched on, before the user had said
 * where they wanted it. Starting at nothing means turning it on shows
 * nothing, and every edge that appears is one the user asked for.
 */
function evenEdges(n: number): EdgeAmounts {
  return { top: n, bottom: n, left: n, right: n }
}

/**
 * Effects are all numbers with a neutral value, so a stored piece missing the
 * section, or holding a half-written one, opens looking exactly as it did
 * before effects existed.
 */
function hydrateEffects(raw: unknown): EffectsState {
  const base = defaultEffects()
  if (!raw || typeof raw !== 'object') return base
  const given = raw as Partial<Record<keyof EffectsState, unknown>>
  const num = (key: keyof EffectsState, lo: number, hi: number): number => {
    const v = given[key]
    return typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : (base[key] as number)
  }
  return {
    blur: num('blur', 0, 40),
    grain: num('grain', 0, 100),
    vignette: num('vignette', 0, 100),
    shadow: num('shadow', 0, 100),
    brightness: num('brightness', 0, 200),
    contrast: num('contrast', 0, 200),
    saturation: num('saturation', 0, 200),
    tint: hexOr(given.tint, base.tint),
    tintAmount: num('tintAmount', 0, 100),
    dropShadow: hydrateDropShadow(given.dropShadow, base.dropShadow),
    edgeBlur: hydrateEdgeBlur(given.edgeBlur, base.edgeBlur),
    edgeShade: hydrateEdgeShade(given.edgeShade, base.edgeShade),
    glass: hydrateGlass(given.glass, base.glass)
  }
}

function hydrateWave(raw: unknown, base: Wave): Wave {
  if (!raw || typeof raw !== 'object') return { ...base }
  const w = raw as Partial<Record<keyof Wave, unknown>>
  return {
    depth: numOr(w.depth, base.depth, -20, 20),
    frequency: numOr(w.frequency, base.frequency, 0, 12),
    speed: numOr(w.speed, base.speed, 0, 8),
    style: oneOf(w.style, ['wave', 'ripple'] as const, base.style),
    direction: oneOf(w.direction, ['horizontal', 'vertical'] as const, base.direction)
  }
}

function hexOr(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback
}

function boolOr(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function numOr(v: unknown, fallback: number, lo: number, hi: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback
}

function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback
}

function hydrateEdges(raw: unknown, fallback: EdgeAmounts): EdgeAmounts {
  if (!raw || typeof raw !== 'object') return { ...fallback }
  const g = raw as Partial<Record<keyof EdgeAmounts, unknown>>
  return {
    top: numOr(g.top, fallback.top, 0, 100),
    bottom: numOr(g.bottom, fallback.bottom, 0, 100),
    left: numOr(g.left, fallback.left, 0, 100),
    right: numOr(g.right, fallback.right, 0, 100)
  }
}

const FALLOFFS: readonly EdgeFalloff[] = ['linear', 'soft']
const SCOPES: readonly EffectScope[] = ['component', 'everything']

function hydrateDropShadow(raw: unknown, base: DropShadowFx): DropShadowFx {
  if (!raw || typeof raw !== 'object') return { ...base }
  const g = raw as Partial<Record<keyof DropShadowFx, unknown>>
  return {
    enabled: boolOr(g.enabled, base.enabled),
    // Wrapped rather than clamped: an angle is a direction, and 370 degrees
    // is a direction rather than an out-of-range number.
    angle: typeof g.angle === 'number' && Number.isFinite(g.angle) ? ((g.angle % 360) + 360) % 360 : base.angle,
    distance: numOr(g.distance, base.distance, 0, 100),
    blur: numOr(g.blur, base.blur, 0, 100),
    density: numOr(g.density, base.density, 0, 100),
    colour: hexOr(g.colour, base.colour)
  }
}

function hydrateEdgeBlur(raw: unknown, base: EdgeBlurFx): EdgeBlurFx {
  if (!raw || typeof raw !== 'object') return { ...base, edges: { ...base.edges } }
  const g = raw as Partial<Record<keyof EdgeBlurFx, unknown>>
  return {
    enabled: boolOr(g.enabled, base.enabled),
    falloff: oneOf(g.falloff, FALLOFFS, base.falloff),
    edges: hydrateEdges(g.edges, base.edges),
    amount: numOr(g.amount, base.amount, 0, 100),
    softness: numOr(g.softness, base.softness, 0, 100),
    over: oneOf(g.over, SCOPES, base.over)
  }
}

function hydrateEdgeShade(raw: unknown, base: EdgeShadeFx): EdgeShadeFx {
  if (!raw || typeof raw !== 'object') return { ...base, edges: { ...base.edges } }
  const g = raw as Partial<Record<keyof EdgeShadeFx, unknown>>
  return {
    enabled: boolOr(g.enabled, base.enabled),
    mode: oneOf(g.mode, ['dark', 'light'] as const, base.mode),
    colour: hexOr(g.colour, base.colour),
    falloff: oneOf(g.falloff, FALLOFFS, base.falloff),
    edges: hydrateEdges(g.edges, base.edges),
    softness: numOr(g.softness, base.softness, 0, 100),
    over: oneOf(g.over, SCOPES, base.over)
  }
}

function hydrateGlass(raw: unknown, base: GlassFx): GlassFx {
  if (!raw || typeof raw !== 'object') return { ...base, per: { ...base.per } }
  const g = raw as Partial<Record<keyof GlassFx, unknown>>
  return {
    enabled: boolOr(g.enabled, base.enabled),
    edges: oneOf(g.edges, ['all', 'per-edge'] as const, base.edges),
    per: hydrateEdges(g.per, base.per),
    width: numOr(g.width, base.width, 0, 100),
    refraction: numOr(g.refraction, base.refraction, 0, 100),
    // An exponent, not a percentage. Below one the bend would grow towards
    // the middle instead of the lip, and at zero it would not bend at all,
    // so the range starts where the effect starts meaning something.
    curve: numOr(g.curve, base.curve, 1, 4)
  }
}

/**
 * The window a layer is on screen for, if it has one.
 *
 * Left absent rather than filled in with nought and one, because absent is
 * what the rest of the code reads as "the whole loop" — writing the bounds
 * out would make every layer look as though someone had set its timing.
 */
/**
 * A layer's timing, and the eye.
 *
 * The eye is carried here with the timing because both are read off the layer
 * as one shape, but they mean different things: `from`/`to`/`fade` are part of
 * the piece, and `hidden` is the person working saying "not while I deal with
 * what is behind you". It is kept rather than dropped on load, because coming
 * back to a piece with a layer you had put away already back on would be a
 * surprise.
 *
 * A window whose ends are equal is repaired to no window at all. It has no
 * width, so `layerVisibility` reads it as off for the whole loop, and the
 * layer sits in the timeline with nothing on screen — the fault this file
 * already says is the hardest kind to look at and understand. Nobody set one
 * deliberately: it needs two floats to land exactly equal, which does not
 * happen by hand. It came from dragging a bar whose end was 1, because the
 * end wrapped round to 0 and shut the window on what was meant to be a click.
 * That is fixed where it happened, but documents saved in the meantime carry
 * the damage, and this is where they are read.
 */
/**
 * Text layers, with their timing repaired.
 *
 * Unlike the other three kinds, text is otherwise taken as it was written:
 * every field on it is typographic and a wrong one shows up as type that
 * looks wrong rather than as nothing at all, so there is nothing here worth
 * clamping. The span is the exception, because a span can be shut, and a shut
 * layer is invisible with nothing to say why.
 */
function hydrateTextSpans(raw: unknown): TextLayer[] {
  if (!Array.isArray(raw)) return []
  return (raw as TextLayer[]).map((layer) => {
    if (!layer || typeof layer !== 'object') return layer
    const { from: _f, to: _t, fade: _d, hidden: _h, ...rest } = layer
    return { ...rest, ...hydrateSpan(layer) }
  })
}

function hydrateSpan(raw: Partial<Record<'from' | 'to' | 'fade' | 'hidden', unknown>>): {
  from?: number
  to?: number
  fade?: number
  hidden?: boolean
} {
  const unit = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : undefined
  const span: { from?: number; to?: number; fade?: number; hidden?: boolean } = {}
  const from = unit(raw.from)
  const to = unit(raw.to)
  const fade = unit(raw.fade)
  const shut = from !== undefined && to !== undefined && from === to
  if (from !== undefined && !shut) span.from = from
  if (to !== undefined && !shut) span.to = to
  if (fade !== undefined) span.fade = Math.min(0.5, fade)
  if (raw.hidden === true) span.hidden = true
  return span
}

/**
 * Blocks of colour, with anything unusable dropped.
 *
 * A shape whose width did not survive being written to disk would come back
 * as NaN, and a NaN width is a path the canvas silently declines to draw --
 * the layer is listed in the timeline but nothing appears, which is the
 * hardest kind of fault to look at and understand. Clamped instead.
 *
 * Absent rather than empty when there is nothing, so a piece made before
 * scenery existed keeps saying so instead of gaining two empty arrays.
 */
function hydrateShapes(raw: unknown): ShapeLayer[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: ShapeLayer[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const l = item as Partial<Record<keyof ShapeLayer, unknown>>
    if (typeof l.id !== 'string') continue
    out.push({
      id: l.id,
      kind: SHAPE_KINDS.includes(l.kind as ShapeKind) ? (l.kind as ShapeKind) : 'rect',
      ...hydrateGeometry(l),
      colour: typeof l.colour === 'string' ? l.colour : '#d8d3c8',
      ...(typeof l.corner === 'number' && Number.isFinite(l.corner)
        ? { corner: Math.min(50, Math.max(0, l.corner)) }
        : {}),
      ...hydrateSpan(l)
    })
  }
  return out.length > 0 ? out : undefined
}

/** Pictures cut to a shape, with anything unusable dropped. See hydrateShapes. */
function hydratePictures(raw: unknown): PictureLayer[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: PictureLayer[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const l = item as Partial<Record<keyof PictureLayer, unknown>>
    if (typeof l.id !== 'string') continue
    out.push({
      id: l.id,
      // An unreadable image id becomes an empty slot rather than a broken
      // reference, so the frame says what is missing instead of going blank.
      ...(typeof l.imageId === 'string' && l.imageId ? { imageId: l.imageId } : {}),
      mask: SHAPE_KINDS.includes(l.mask as ShapeKind) ? (l.mask as ShapeKind) : 'rect',
      ...hydrateGeometry(l),
      fit: l.fit === 'contain' ? 'contain' : 'cover',
      ...(typeof l.corner === 'number' && Number.isFinite(l.corner)
        ? { corner: Math.min(50, Math.max(0, l.corner)) }
        : {}),
      ...(typeof l.placeholder === 'string' ? { placeholder: l.placeholder } : {}),
      ...hydrateSpan(l)
    })
  }
  return out.length > 0 ? out : undefined
}

/** The box the two scenery layers share, clamped to something drawable. */
function hydrateGeometry(l: Partial<Record<string, unknown>>): {
  width: number; height: number; x: number; y: number; rotation: number; opacity: number
} {
  const num = (v: unknown, fallback: number, lo: number, hi: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback
  return {
    width: num(l.width, 40, 0, 400),
    height: num(l.height, 30, 0, 400),
    // Beyond the frame is allowed, because a panel sliding in from off-screen
    // spends most of its time out there.
    x: num(l.x, 50, -200, 300),
    y: num(l.y, 50, -200, 300),
    rotation: num(l.rotation, 0, -360, 360),
    opacity: num(l.opacity, 100, 0, 100)
  }
}

function hydrateLogos(raw: unknown): LogoLayer[] {
  if (!Array.isArray(raw)) return []
  const out: LogoLayer[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const l = item as Partial<Record<keyof LogoLayer, unknown>>
    if (typeof l.id !== 'string' || typeof l.imageId !== 'string') continue
    const num = (v: unknown, fallback: number, lo: number, hi: number): number =>
      typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback
    out.push({
      id: l.id,
      imageId: l.imageId,
      size: num(l.size, 20, 1, 100),
      opacity: num(l.opacity, 100, 0, 100),
      x: num(l.x, 50, 0, 100),
      y: num(l.y, 50, 0, 100),
      ...hydrateSpan(l)
    })
  }
  return out
}
