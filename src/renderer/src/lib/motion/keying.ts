// Turning a panel control into a keyable one.
//
// The panels know a value and how to change it; the keyframe model knows
// tracks and instants. This is the small piece of glue between them, kept out
// of the panels so that adding a keyable control is one prop rather than a
// paragraph of track handling.

import type { KeyframeHandle } from '../../components/motion/controls'
import type { MotionDoc } from '../../../../shared/motion/types'
import { removeKey, setKey, type Keyframes, type TrackTarget } from '../../../../shared/motion/keyframes'

/**
 * Keys are only ever placed at a scrubber position, and the scrubber moves in
 * fixed steps, so a key that was set at the instant showing now is at exactly
 * that number. Matching loosely would let the diamond claim a key is here
 * while `setKey` — which uses this same tolerance — decided it was a different
 * instant and added a second one a thousandth away.
 */
const SAME_INSTANT = 1e-6

export type Keyer = (target: TrackTarget, value: number) => KeyframeHandle

/**
 * Build the handler for one document at one instant.
 *
 * Takes the whole `onChange` patch function rather than a keys setter so that
 * callers do not have to know that keys live on the document at all.
 */
export function makeKeyer(
  doc: MotionDoc,
  phase: number,
  onChange: (patch: Partial<MotionDoc>) => void
): Keyer {
  return (target, value) => {
    const keys: Keyframes = doc.keys ?? {}
    const track = keys[target]
    const at = track?.keys.find((k) => Math.abs(k.t - phase) < SAME_INSTANT)
    return {
      keyed: track !== undefined && track.keys.length > 0,
      here: at !== undefined,
      onToggle: () => {
        onChange({ keys: at ? removeKey(keys, target, at.id) : setKey(keys, target, phase, value) })
      }
    }
  }
}
