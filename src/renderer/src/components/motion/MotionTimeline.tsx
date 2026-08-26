// The keyframe timeline: the whole time axis of a piece in one place.
//
// The loop scrubber is part of this component rather than a separate footer
// above it. Two elements measuring the same loop in two containers would be
// aligned only by coincidence, and the moment a label column changed width a
// key would stop sitting under the playhead that produced it. Here the ruler
// and every lane are the same three columns, so they line up by construction.
//
// A lane runs the whole way round: the segment after the last key wraps back
// to the first, so there is no dead space at the right-hand end and no way to
// read the track as ending.
//
// It is set apart by a step in tone with a gutter around it, not by a rule —
// nothing in this app is divided by a line.

import { useCallback, useRef, useState } from 'react'
import type { MotionDoc } from '../../../../shared/motion/types'
import { componentFor } from '../../../../shared/motion/registry'
import {
  keyedTargets, moveKey, removeKey, removeTrack, sampleTrack, setKey, setMuted,
  type Keyframes, type TrackTarget
} from '../../../../shared/motion/keyframes'

/** The three columns every row shares. Changing one here moves all of them. */
const LABEL_W = 'w-[104px]'
const TAIL_W = 'w-9'

export function MotionTimeline({
  doc, phase, onPhase, onChange
}: {
  doc: MotionDoc
  phase: number
  onPhase: (p: number) => void
  onChange: (patch: Partial<MotionDoc>) => void
}): React.JSX.Element {
  const targets = keyedTargets(doc.keys)
  const keys: Keyframes = doc.keys ?? {}

  return (
    <div className="mx-3 mb-2 flex shrink-0 flex-col gap-1 rounded-panel bg-elevated p-2">
      <div className="flex items-center gap-2">
        <span className={`${LABEL_W} shrink-0 px-1 text-[10.5px] text-text-secondary`}>Loop</span>
        <input
          type="range"
          min={0}
          max={0.999}
          step={0.001}
          value={phase}
          aria-label="Position in the loop"
          onChange={(e) => onPhase(Number(e.target.value))}
          className="motion-slider flex-1"
        />
        <span className={`${TAIL_W} shrink-0 text-right font-mono text-[10.5px] text-text-muted`}>
          {Math.round(phase * 100)}%
        </span>
      </div>

      {targets.length > 0 ? (
        <>
          {targets.map((target) => (
            <TrackRow
              key={target}
              label={trackLabel(doc, target)}
              target={target}
              keys={keys}
              phase={phase}
              onPhase={onPhase}
              onKeys={(next) => onChange({ keys: next })}
            />
          ))}
          <div className="flex items-center gap-2">
            <span className={`${LABEL_W} shrink-0 px-1 text-[10px] text-text-muted`}>
              {targets.length === 1 ? '1 animated value' : `${targets.length} animated values`}
            </span>
            <span className="flex-1 text-[10px] text-text-muted">
              Drag a key to move it, right-click to remove it, double-click a lane to add one.
            </span>
            <button
              type="button"
              onClick={() => onChange({ keys: {} })}
              className={`${TAIL_W} shrink-0 rounded-sm py-0.5 text-[10px] text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60`}
            >
              Clear
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}

function TrackRow({
  label, target, keys, phase, onPhase, onKeys
}: {
  label: string
  target: TrackTarget
  keys: Keyframes
  phase: number
  onPhase: (p: number) => void
  onKeys: (k: Keyframes) => void
}): React.JSX.Element {
  const track = keys[target]
  const lane = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; moved: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)

  /** Where along the lane a pointer is, as a fraction of the loop. */
  const tAt = useCallback((clientX: number): number => {
    const box = lane.current?.getBoundingClientRect()
    if (!box || box.width === 0) return 0
    return Math.min(1, Math.max(0, (clientX - box.left) / box.width))
  }, [])

  const down = (e: React.PointerEvent<HTMLButtonElement>, id: string): void => {
    e.stopPropagation()
    drag.current = { id, moved: false }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const move = (e: React.PointerEvent<HTMLButtonElement>): void => {
    const d = drag.current
    if (!d) return
    d.moved = true
    onKeys(moveKey(keys, target, d.id, tAt(e.clientX)))
  }

  const up = (e: React.PointerEvent<HTMLButtonElement>, t: number): void => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    // A press that never moved is a request to go to that key, not a nudge of
    // it back to where it already was.
    if (d && !d.moved) onPhase(t)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onKeys(setMuted(keys, target, !track?.muted))}
        title={track?.muted ? `Let ${label} animate again` : `Stop ${label} animating, keeping its keys`}
        className={`${LABEL_W} shrink-0 truncate rounded-sm px-1 py-0.5 text-left text-[10.5px] hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
          track?.muted ? 'text-text-muted line-through' : 'text-text-secondary'
        }`}
      >
        {label}
      </button>
      <div
        ref={lane}
        className="relative h-5 flex-1 rounded-sm bg-sunken"
        onDoubleClick={(e) => {
          // Adds a control point without changing the shape: the new key takes
          // the value the track already has there, so the animation is
          // untouched until the key is dragged.
          const t = tAt(e.clientX)
          onKeys(setKey(keys, target, t, sampleTrack(track, t, 0)))
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 h-full w-px bg-accent/70"
          style={{ left: `${phase * 100}%` }}
        />
        {(track?.keys ?? []).map((k) => (
          <button
            key={k.id}
            type="button"
            aria-label={`${label} key at ${Math.round(k.t * 100)} percent`}
            onPointerDown={(e) => down(e, k.id)}
            onPointerMove={move}
            onPointerUp={(e) => up(e, k.t)}
            onPointerCancel={(e) => up(e, k.t)}
            onContextMenu={(e) => { e.preventDefault(); onKeys(removeKey(keys, target, k.id)) }}
            title={`${Math.round(k.t * 100)}% — ${round(k.v)}. Drag to move, right-click to remove.`}
            className={`absolute top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
              dragging ? 'cursor-grabbing' : 'cursor-grab'
            } ${track?.muted ? 'bg-text-muted' : 'bg-accent'}`}
            style={{ left: `${k.t * 100}%` }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => onKeys(removeTrack(keys, target))}
        aria-label={`Stop animating ${label}`}
        title={`Stop animating ${label}`}
        className={`${TAIL_W} shrink-0 rounded-sm text-[12px] leading-none text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60`}
      >
        ×
      </button>
    </div>
  )
}

function round(v: number): string {
  return String(Number(v.toFixed(2)))
}

/**
 * A track's name in the words the panel uses for it.
 *
 * Falls back to the raw target so a document keyed against a parameter this
 * build does not have still shows a row that can be deleted, rather than
 * a track that is invisible but keeps applying.
 */
export function trackLabel(doc: MotionDoc, target: TrackTarget): string {
  const [kind, rest] = splitOnce(target)
  if (kind === 'param') {
    const spec = componentFor(doc.componentId).schema.find((s) => s.key === rest)
    return spec ? spec.label : rest
  }
  if (kind === 'pose') return POSE_LABELS[rest] ?? `Pose ${rest}`
  return target
}

const POSE_LABELS: Record<string, string> = {
  tiltX: 'Pose tilt X',
  tiltY: 'Pose tilt Y',
  tiltZ: 'Pose tilt Z'
}

function splitOnce(target: string): [string, string] {
  const i = target.indexOf(':')
  return i === -1 ? [target, ''] : [target.slice(0, i), target.slice(i + 1)]
}
