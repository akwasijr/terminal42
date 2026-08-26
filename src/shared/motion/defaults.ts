// A new Motion document, and how an old one is made safe to load.
//
// Defaults are deliberately not "everything at zero". A document that opens
// showing a still, flat, centred grid of nothing teaches you nothing about
// what the controls do. It opens as a slowly turning carousel because that is
// the fastest way to understand the tool: move a slider, watch what changes.

import type {
  AnimationState, CardOverride, ComponentId, EffectsState, EntranceShape, EntranceSpec, LogoLayer,
  MotionDoc, ParamSpec, ParamValue
} from './types'
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
      freeOrbit: 0, panX: 0, panZ: 0, panSpeed: 1
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
        backOpacity: 20
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
    displacement: { ...base.displacement, ...(doc.displacement ?? {}) },
    transform: { ...base.transform, ...(doc.transform ?? {}) },
    easing: { ...base.easing, ...(doc.easing ?? {}) },
    overrides: hydrateOverrides(doc.overrides),
    animation: hydrateAnimation(doc.animation),
    visual: {
      ...base.visual,
      ...(doc.visual ?? {}),
      card: { ...base.visual.card, ...(doc.visual?.card ?? {}) },
      images: doc.visual?.images ?? [],
      text: doc.visual?.text ?? [],
      logos: hydrateLogos(doc.visual?.logos),
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
    tintAmount: 0
  }
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
    tint: typeof given.tint === 'string' && /^#[0-9a-f]{6}$/i.test(given.tint) ? given.tint : base.tint,
    tintAmount: num('tintAmount', 0, 100)
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
      y: num(l.y, 50, 0, 100)
    })
  }
  return out
}
