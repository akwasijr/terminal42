// Where the camera is, and what that means for whether a card is in shot.
//
// The camera lives here rather than in the engine because the engine is not
// the only thing that needs to know it. Deciding whether a preset shows
// anything is a question about framing, and asking it in the renderer would
// mean it could not be asked before a canvas exists — which is exactly when
// presets are generated.

import type { CardPlacement, MotionComponent, ParamValue } from './types'

/** The frame's camera. The engine builds its own from these numbers. */
export const CAMERA = { fov: 38, z: 12, near: 0.1, far: 200 } as const

/** A card's aspect, in world units, before its own scale. */
const CARD_ASPECT = 16 / 9

/**
 * Roughly, is this card in shot?
 *
 * Deliberately generous and deliberately ignoring rotation: a card turned
 * edge-on is still in shot, and the only question being asked is whether the
 * frame is empty. Tilt is ignored for the same reason — the pose is the user's
 * to change, and a preset should not be judged against one particular one.
 */
export function inShot(p: CardPlacement, aspect = 16 / 9): boolean {
  if (p.opacity <= 0.02 || p.scale <= 0.001) return false
  // Behind the lens.
  if (p.z >= CAMERA.z - 0.2) return false
  const halfH = Math.tan((CAMERA.fov * Math.PI) / 360) * (CAMERA.z - p.z)
  const halfW = halfH * aspect
  return Math.abs(p.x) - (CARD_ASPECT * p.scale) / 2 < halfW &&
    Math.abs(p.y) - p.scale / 2 < halfH
}

/**
 * The most cards this arrangement ever gets on screen at once.
 *
 * Sampled around the loop rather than at phase 0, because plenty of
 * arrangements start empty and fill — judging one by its first frame would
 * throw away the good ones along with the blank.
 */
export function peakOnScreen(component: MotionComponent, params: Record<string, ParamValue>): number {
  const total = component.cardCount(params)
  let peak = 0
  for (let s = 0; s < 24; s++) {
    let seen = 0
    for (let i = 0; i < total; i++) {
      if (inShot(component.layout(s / 24, i, total, params))) seen++
    }
    if (seen > peak) peak = seen
  }
  return peak
}
