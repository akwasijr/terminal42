// From a document and a phase to a set of card placements.
//
// This is the one function the on-screen renderer, the scrubber and the
// exporter all call. Sharing it is what guarantees that an exported frame is
// the frame the user approved rather than a very similar one: there is no
// second code path that could drift.

import type { CardOverride, CardPlacement, MotionDoc, ParamValue } from './types'
import { componentFor } from './registry'
import { paramsFor } from './defaults'
import { cubicBezier, restingPlacement, wrap01 } from './math'

export function resolvedParams(doc: MotionDoc): Record<string, ParamValue> {
  const component = componentFor(doc.componentId)
  return paramsFor(component.schema, doc.params[doc.componentId])
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
  const params = resolvedParams(doc)
  const count = Math.max(0, Math.round(component.cardCount(params)))
  const e = doc.easing
  const p = doc.animationEnabled
    ? wrap01(cubicBezier(e.x1, e.y1, e.x2, e.y2, wrap01(phase)))
    : 0
  const out: CardPlacement[] = []
  for (let i = 0; i < count; i++) {
    const base = doc.componentEnabled ? component.layout(p, i, count, params) : restingPlacement()
    out.push(applyOverride(base, doc.overrides?.[String(i)]))
  }
  return out
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
