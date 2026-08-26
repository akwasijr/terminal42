// From a document and a phase to a set of card placements.
//
// This is the one function the on-screen renderer, the scrubber and the
// exporter all call. Sharing it is what guarantees that an exported frame is
// the frame the user approved rather than a very similar one: there is no
// second code path that could drift.

import type { CardOverride, CardPlacement, MotionDoc, ParamValue, Pose, Wave } from './types'
import { componentFor } from './registry'
import { paramsFor } from './defaults'
import { valueAt } from './keyframes'
import { cubicBezier, restingPlacement, TAU, wrap01 } from './math'

/**
 * The component's settings, at a point in the loop.
 *
 * Without a phase this is what the panel says, which is what the panel itself
 * and anything phase-independent wants. With one, keyed parameters are
 * overlaid, which is what actually draws a frame.
 *
 * Only numbers are overlaid. A keyframe interpolates, and there is no halfway
 * between "forward" and "reverse".
 */
export function resolvedParams(doc: MotionDoc, phase?: number): Record<string, ParamValue> {
  const component = componentFor(doc.componentId)
  const base = paramsFor(component.schema, doc.params[doc.componentId])
  if (phase === undefined || !doc.keys) return base
  const out = { ...base }
  for (const spec of component.schema) {
    if (spec.kind !== 'slider') continue
    const current = out[spec.key]
    if (typeof current !== 'number') continue
    out[spec.key] = valueAt(doc.keys, `param:${spec.key}`, phase, current)
  }
  return out
}

/**
 * The pose, at a point in the loop.
 *
 * Kept beside the parameters rather than in the engine so that the screen and
 * the exporter cannot disagree about where the camera was looking.
 */
export function resolvedPose(doc: MotionDoc, phase?: number): Pose {
  if (phase === undefined || !doc.keys) return doc.pose
  const at = (field: keyof Pose): number => {
    const v = doc.pose[field]
    return typeof v === 'number' ? valueAt(doc.keys, `pose:${field}`, phase, v) : (v as number)
  }
  const out = { ...doc.pose }
  for (const field of Object.keys(doc.pose) as Array<keyof Pose>) {
    if (typeof doc.pose[field] === 'number') (out[field] as number) = at(field)
  }
  return out
}

export function cardCountFor(doc: MotionDoc): number {
  const component = componentFor(doc.componentId)
  return Math.max(0, Math.round(component.cardCount(resolvedParams(doc))))
}

/**
 * Every card's placement at one instant.
 *
 * Easing is applied to phase rather than inside components, so a component
 * stays a description of a path and easing stays a description of how time is
 * spent along it. Because a cubic Bézier through (0,0) and (1,1) maps 0 to 0
 * and 1 to 1, easing can never break a component's loop closure.
 */
export function computePlacements(doc: MotionDoc, phase: number): CardPlacement[] {
  const component = componentFor(doc.componentId)
  const e = doc.easing
  const p = doc.animationEnabled
    ? wrap01(cubicBezier(e.x1, e.y1, e.x2, e.y2, wrap01(phase)))
    : 0
  // Keyed values are read at the loop position, not the eased one.
  //
  // Easing describes how a component travels its own path; a keyframe is the
  // user pointing at a place on the scrubber and saying "here". Sampling
  // tracks through the easing curve would move the key away from the mark it
  // was set against, make parameter tracks disagree with pose tracks (which
  // are read in the engine at the raw phase), and silence every track when
  // the piece's own animation is switched off. Keys carry their own easing
  // per segment, which is where that belongs.
  const params = resolvedParams(doc, wrap01(phase))
  // The count is deliberately taken from the unkeyed settings. The engine
  // allocates one mesh per card once, and a count that changed across the
  // loop would mean cards appearing and vanishing at the seam. The panel
  // therefore refuses to key any parameter the count depends on; this is the
  // second lock, for documents that were edited by hand.
  const count = Math.max(0, Math.round(component.cardCount(resolvedParams(doc))))
  const out: CardPlacement[] = []
  for (let i = 0; i < count; i++) {
    const base = doc.componentEnabled ? component.layout(p, i, count, params) : restingPlacement()
    out.push(applyOverride(base, doc.overrides?.[String(i)]))
  }
  return out
}

/**
 * Whether the card count depends on a parameter.
 *
 * Asked rather than tabulated: every component declares how many cards it
 * wants as a function, so the honest way to find out which settings feed it
 * is to move one and see whether the answer changes. A table would need
 * updating each time a component was added and would be wrong silently.
 */
export function paramAffectsCount(
  component: { cardCount: (p: Record<string, ParamValue>) => number },
  params: Record<string, ParamValue>,
  key: string
): boolean {
  const current = params[key]
  if (typeof current !== 'number') return false
  const base = component.cardCount(params)
  for (const probe of [current + 1, current + 3, Math.max(0, current - 1)]) {
    if (probe === current) continue
    if (component.cardCount({ ...params, [key]: probe }) !== base) return true
  }
  return false
}

/**
 * Fold a hand edit into a generated placement.
 *
 * Applied after the component and after easing, so a moved card keeps moving
 * with the pattern rather than freezing where it was dropped. Because the
 * offset is constant across the loop it cannot break loop closure: whatever
 * the component does at phase 0 and phase 1, the same amount is added to both.
 */
export function applyOverride(base: CardPlacement, o: CardOverride | undefined): CardPlacement {
  if (!o) return base
  return {
    ...base,
    x: base.x + o.dx,
    y: base.y + o.dy,
    z: base.z + o.dz,
    rotX: base.rotX + o.drotX,
    rotY: base.rotY + o.drotY,
    rotZ: base.rotZ + o.drotZ,
    scale: base.scale * (o.scale || 1)
  }
}

/** An override that changes nothing — the shape a fresh hand edit starts from. */
export function emptyOverride(): CardOverride {
  return { dx: 0, dy: 0, dz: 0, drotX: 0, drotY: 0, drotZ: 0, scale: 1 }
}

/** Whether an override still says anything, i.e. whether it is worth storing. */
export function overrideIsEmpty(o: CardOverride | undefined): boolean {
  if (!o) return true
  return (
    o.dx === 0 && o.dy === 0 && o.dz === 0 &&
    o.drotX === 0 && o.drotY === 0 && o.drotZ === 0 &&
    (o.scale === 1 || !o.scale) && !o.imageId
  )
}

/**
 * Which image each card wears.
 *
 * Kept here rather than in the engine because the preset thumbnails and the
 * exporter need the same answer, and because "scatter" must be a stable
 * shuffle — a card that changed picture every frame would flicker.
 */
export function imageAssignment(doc: MotionDoc, count: number): number[] {
  const n = doc.visual.images.length
  if (n === 0) return new Array(count).fill(-1)
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    // A picture dropped onto a card wins over the running order, so dropping
    // one image somewhere does not renumber every other card.
    const pinned = doc.overrides?.[String(i)]?.imageId
    const pin = pinned ? doc.visual.images.findIndex((img) => img.id === pinned) : -1
    if (pin >= 0) { out.push(pin); continue }
    out.push(doc.visual.imageOrder === 'scatter' ? scatterPick(i, n) : i % n)
  }
  return out
}

function scatterPick(index: number, n: number): number {
  // A hash rather than Math.random: the same card must get the same picture
  // every frame, in every process, or an export would not match the screen.
  const x = Math.sin(index * 127.1 + 311.7) * 43758.5453
  return Math.floor((x - Math.floor(x)) * n) % n
}

/**
 * How far a wave pushes a card at this point in the loop.
 *
 * The phase is the card's own position plus the time, so two cards at
 * different places are at different points in the wave — which is the whole
 * difference between a wave and the drift above it, where every card moves
 * together. Time enters in whole passes per loop so the wave is exactly
 * where it started when the loop comes round, and the seam does not jump.
 */
export function waveAt(w: Wave, x: number, y: number, p: number): number {
  if (w.depth === 0 || w.frequency === 0) return 0
  // Divided by a nominal arrangement size so `frequency` means crests across
  // the piece rather than crests per scene unit, which would depend on how
  // big the component happens to be.
  const SPAN = 8
  const along = w.style === 'ripple'
    ? Math.hypot(x, y) / SPAN
    : (w.direction === 'vertical' ? y : x) / SPAN
  const travel = p * Math.round(w.speed)
  return Math.sin((along * w.frequency + travel) * TAU) * w.depth
}
