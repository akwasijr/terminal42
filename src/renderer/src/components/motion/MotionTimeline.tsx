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

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LogoLayer, MotionDoc, TextLayer } from '../../../../shared/motion/types'
import { FRAME_RATES } from '../../../../shared/motion/types'
import { componentFor } from '../../../../shared/motion/registry'
import { layerVisibility } from '../../../../shared/motion/frame'
import {
  keyedTargets, moveKey, removeKey, removeTrack, sampleTrack, setKey, setKeyEasing, setMuted,
  type Keyframes, type TrackTarget
} from '../../../../shared/motion/keyframes'
import { EasingEditor } from './EasingEditor'
import type { Easing } from '../../../../shared/motion/types'
import { Hint } from '../Hint'
import { samePick, type Pick } from '../../lib/motion/overlayPick'

/** The three columns every row shares. Changing one here moves all of them. */
const LABEL_W = 'w-[104px]'
const TAIL_W = 'w-[68px]'

export function MotionTimeline({
  doc, phase, onPhase, onChange, selected = null, onSelect, onRemove, playing = false, onTogglePlaying
}: {
  doc: MotionDoc
  phase: number
  onPhase: (p: number) => void
  onChange: (patch: Partial<MotionDoc>) => void
  /** What is selected on the frame, so the list can say which row that is. */
  selected?: Pick | null
  onSelect?: (pick: Pick | null) => void
  onRemove?: (pick: Pick) => void
  /** Whether the piece is running, so the transport can say so and stop it. */
  playing?: boolean
  onTogglePlaying?: () => void
}): React.JSX.Element {
  const targets = keyedTargets(doc.keys)
  const keys: Keyframes = doc.keys ?? {}
  const [open, setOpen] = useState(false)
  // Selecting a caption on the frame and finding the layer list still closed
  // would leave the app quietly disagreeing with itself about what is in hand.
  useEffect(() => {
    if (selected && selected.kind !== 'card') setOpen(true)
  }, [selected])

  const text = doc.visual.text
  const logos = doc.visual.logos
  const layerCount = text.length + logos.length + targets.length + 1

  const setText = (id: string, patch: Partial<TextLayer>): void =>
    onChange({ visual: { ...doc.visual, text: text.map((t) => (t.id === id ? { ...t, ...patch } : t)) } })
  const setLogo = (id: string, patch: Partial<LogoLayer>): void =>
    onChange({ visual: { ...doc.visual, logos: logos.map((l) => (l.id === id ? { ...l, ...patch } : l)) } })

  return (
    <div className="mx-3 mb-2 flex shrink-0 flex-col gap-1 rounded-panel bg-elevated p-2">
      <Transport
        doc={doc}
        phase={phase}
        onPhase={onPhase}
        onChange={onChange}
        playing={playing}
        onTogglePlaying={onTogglePlaying}
        open={open}
        onOpen={() => setOpen((v) => !v)}
        layerCount={layerCount}
      />

      <div className="relative flex flex-col gap-1">
        {/* One playhead down every lane, so a key either is or is not under
            the moment on screen. Inset by the label and tail columns so it
            tracks the same span the lanes use. */}
        <span
          aria-hidden="true"
          style={{ left: `calc(112px + (100% - 188px) * ${phase})` }}
          className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-accent/40"
        />
        <Ruler doc={doc} phase={phase} onPhase={onPhase} />

        {open ? (
        <>
          <GroupLabel>Scene</GroupLabel>
          <ComponentRow doc={doc} phase={phase} />
          {text.map((t) => (
            <LayerRow
              key={t.id}
              label={t.text.trim().split('\n')[0] || 'Text'}
              kind="Text"
              span={t}
              phase={phase}
              onSpan={(patch) => setText(t.id, patch)}
              selected={samePick(selected, { kind: 'text', id: t.id })}
              onSelect={onSelect ? () => onSelect({ kind: 'text', id: t.id }) : undefined}
              onRemove={onRemove ? () => onRemove({ kind: 'text', id: t.id }) : undefined}
            />
          ))}
          {logos.map((l, i) => (
            <LayerRow
              key={l.id}
              label={`Logo ${i + 1}`}
              kind="Logo"
              span={l}
              phase={phase}
              onSpan={(patch) => setLogo(l.id, patch)}
              selected={samePick(selected, { kind: 'logo', id: l.id })}
              onSelect={onSelect ? () => onSelect({ kind: 'logo', id: l.id }) : undefined}
              onRemove={onRemove ? () => onRemove({ kind: 'logo', id: l.id }) : undefined}
            />
          ))}
        </>
      ) : null}

      {targets.length > 0 ? (
        <>
          {open ? <GroupLabel>Animated values</GroupLabel> : null}
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
            <span className="flex flex-1 items-center">
              <Hint label="Click a key to shape the segment after it, drag to move, right-click to remove, double-click a lane to add one." />
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
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="px-1 pt-1 text-[10px] text-text-muted">{children}</p>
}

function Chevron(): React.JSX.Element {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
      <path d="M2.5 1.5 5.5 4l-3 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The transport: what is playing, where it is, and how long it runs.
 *
 * This used to be a bare range slider with a percentage beside it, which is
 * the one reading nobody wants — a loop is judged in seconds and frames, and
 * you cannot judge it at all without being able to start it. Play lived two
 * components away in the frame toolbar, so the timeline could show you a
 * position but not move it.
 *
 * Length and rate stay here rather than in the Export panel. A loop is
 * judged by watching it, and its length is the first thing you want to
 * change while you are watching.
 */
function Transport({
  doc, phase, onPhase, onChange, playing, onTogglePlaying, open, onOpen, layerCount
}: {
  doc: MotionDoc
  phase: number
  onPhase: (p: number) => void
  onChange: (patch: Partial<MotionDoc>) => void
  playing: boolean
  onTogglePlaying?: () => void
  open: boolean
  onOpen: () => void
  layerCount: number
}): React.JSX.Element {
  const { durationSec, fps } = doc.export
  const frames = Math.max(1, Math.round(durationSec * fps))
  // Counted from one, because that is how every other tool counts frames and
  // how anyone reading it back will say it.
  const frame = Math.min(frames, Math.floor(phase * frames) + 1)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={onTogglePlaying}
        disabled={!onTogglePlaying}
        title={playing ? 'Pause' : 'Play'}
        aria-label={playing ? 'Pause' : 'Play'}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-action text-action-text transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-40"
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <rect x="2" y="1.5" width="3" height="9" rx="1" />
            <rect x="7" y="1.5" width="3" height="9" rx="1" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <path d="M3 1.5l7 4.5-7 4.5z" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={() => onPhase(0)}
        title="Back to start"
        aria-label="Back to start"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-secondary transition-colors hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 3v10" />
          <path d="M13 3.5L6 8l7 4.5z" />
        </svg>
      </button>
      <span className="ml-0.5 shrink-0 font-mono text-[10.5px] tabular-nums text-text-primary">
        {(phase * durationSec).toFixed(2)}s
      </span>
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-muted">
        frame {frame} of {frames}
      </span>

      <div className="ml-auto flex items-center gap-1">
        <label className="text-[10px] text-text-muted" htmlFor="motion-loop-length">Length</label>
        <input
          id="motion-loop-length"
          type="number"
          min={0.5}
          max={60}
          step={0.5}
          value={durationSec}
          aria-label="Loop length in seconds"
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) {
              onChange({ export: { ...doc.export, durationSec: Math.min(60, Math.max(0.5, n)) } })
            }
          }}
          className="w-14 rounded-sm bg-sunken px-1.5 py-0.5 text-right font-mono text-[10px] tabular-nums text-text-primary [appearance:textfield] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-[10px] text-text-muted">s</span>
        <label className="ml-1 text-[10px] text-text-muted" htmlFor="motion-loop-fps">Rate</label>
        <select
          id="motion-loop-fps"
          value={fps}
          aria-label="Frames per second"
          onChange={(e) => onChange({ export: { ...doc.export, fps: Number(e.target.value) as typeof fps } })}
          className="rounded-sm bg-sunken px-1 py-0.5 font-mono text-[10px] tabular-nums text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {FRAME_RATES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={open}
          title={open ? 'Hide the layers' : 'Show every layer'}
          className="ml-1 flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10.5px] text-text-secondary hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <span className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>
            <Chevron />
          </span>
          Layers
          <span className="pl-0.5 text-[10px] tabular-nums text-text-muted">{layerCount}</span>
        </button>
      </div>
    </div>
  )
}

/**
 * The time axis, labelled, with the playhead on it.
 *
 * A percentage told you where you were in something whose length you had to
 * remember. Seconds on the ruler mean the position, the keys under it and
 * the length field all read in the same unit.
 *
 * The label column and tail are the same widths the lanes use, so a tick and
 * the key beneath it line up by construction rather than by coincidence.
 */
function Ruler({
  doc, phase, onPhase
}: {
  doc: MotionDoc
  phase: number
  onPhase: (p: number) => void
}): React.JSX.Element {
  const durationSec = doc.export.durationSec
  const track = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const seek = useCallback(
    (clientX: number): void => {
      const el = track.current
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.width <= 0) return
      onPhase(Math.min(0.999, Math.max(0, (clientX - r.left) / r.width)))
    },
    [onPhase]
  )

  useEffect(() => {
    if (!dragging) return
    const move = (e: MouseEvent): void => seek(e.clientX)
    const up = (): void => setDragging(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [dragging, seek])

  // Enough ticks to read, few enough to stay legible at this width. The step
  // is chosen from a round set so the labels are numbers a person would say.
  const step = tickStep(durationSec)
  const ticks: number[] = []
  for (let t = 0; t <= durationSec + 1e-6; t += step) ticks.push(Number(t.toFixed(4)))

  return (
    <div className="flex items-stretch gap-2">
      <span className={`${LABEL_W} shrink-0`} />
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Position in the loop"
        aria-valuemin={0}
        aria-valuemax={durationSec}
        aria-valuenow={Number((phase * durationSec).toFixed(2))}
        aria-valuetext={`${(phase * durationSec).toFixed(2)} seconds`}
        onMouseDown={(e) => { setDragging(true); seek(e.clientX) }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); onPhase(Math.max(0, phase - 0.01)) }
          if (e.key === 'ArrowRight') { e.preventDefault(); onPhase(Math.min(0.999, phase + 0.01)) }
          if (e.key === 'Home') { e.preventDefault(); onPhase(0) }
        }}
        className="relative h-5 min-w-0 flex-1 cursor-ew-resize select-none rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {ticks.map((t) => (
          <span
            key={t}
            style={{ left: `${(t / durationSec) * 100}%` }}
            className="pointer-events-none absolute bottom-0 top-0 flex flex-col items-start"
          >
            <span className="pl-1 text-[9.5px] tabular-nums text-text-muted">{tickLabel(t)}</span>
            <span className="mt-auto h-1.5 w-px bg-text-muted/40" />
          </span>
        ))}
        <span
          style={{ left: `${phase * 100}%` }}
          className="pointer-events-none absolute bottom-0 top-0 w-px bg-accent"
        >
          <span className="absolute -left-[3px] top-0 h-1.5 w-[7px] rounded-[1px] bg-accent" />
        </span>
      </div>
      <span className={`${TAIL_W} shrink-0`} />
    </div>
  )
}

/** A tick spacing a person would choose, for a loop of this length. */
function tickStep(durationSec: number): number {
  const target = durationSec / 8
  for (const s of [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10]) if (s >= target) return s
  return 10
}

function tickLabel(t: number): string {
  if (t === 0) return '0s'
  return `${Number(t.toFixed(2))}s`
}

/**
 * The component's own row: when the entrance is still running.
 *
 * Not draggable, because the entrance is shaped by its own settings rather
 * than by where it sits — it always begins at the start. It is here so the
 * scene reads as a whole rather than as the layers plus something unspoken.
 */
function ComponentRow({ doc, phase }: { doc: MotionDoc; phase: number }): React.JSX.Element {
  const enabled = doc.componentEnabled
  return (
    <div className="flex items-center gap-2">
      <span className={`${LABEL_W} shrink-0 truncate px-1 text-[10.5px] ${enabled ? 'text-text-secondary' : 'text-text-muted line-through'}`}>
        {componentFor(doc.componentId).label}
      </span>
      <div className="relative h-5 flex-1 overflow-hidden rounded-sm bg-sunken">
        <span
          aria-hidden
          className={`absolute inset-y-[3px] left-0 right-0 rounded-[3px] ${enabled ? 'bg-raised' : 'bg-raised/40'}`}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 h-full w-px bg-accent/70"
          style={{ left: `${phase * 100}%` }}
        />
      </div>
      <span className={`${TAIL_W} shrink-0`} />
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
  // Which key's segment is being shaped. One at a time, and never while
  // dragging, so a nudge along the lane cannot open a panel over the lane.
  const [shaping, setShaping] = useState<string | null>(null)

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
    if (d && !d.moved) {
      onPhase(t)
      setShaping((cur) => (cur === d.id ? null : d.id))
    }
  }

  const shapingKey = (track?.keys ?? []).find((k) => k.id === shaping) ?? null

  // The panel is over the work, so anywhere else is a way out of it.
  useEffect(() => {
    if (!shaping) return
    const onDown = (e: MouseEvent): void => {
      // A key of this lane is left alone so that pressing the open one can
      // close it, rather than closing and reopening in the same gesture.
      if (!(e.target as HTMLElement).closest('[data-segment-shape],[data-lane-key]')) setShaping(null)
    }
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setShaping(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [shaping])

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
            data-lane-key
            aria-label={`${label} key at ${Math.round(k.t * 100)} percent`}
            onPointerDown={(e) => down(e, k.id)}
            onPointerMove={move}
            onPointerUp={(e) => up(e, k.t)}
            onPointerCancel={(e) => up(e, k.t)}
            onContextMenu={(e) => { e.preventDefault(); setShaping(null); onKeys(removeKey(keys, target, k.id)) }}
            title={`${Math.round(k.t * 100)}% — ${round(k.v)}. Click to shape the segment after it, drag to move, right-click to remove.`}
            className={`absolute top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
              dragging ? 'cursor-grabbing' : 'cursor-grab'
            } ${track?.muted ? 'bg-text-muted' : 'bg-accent'} ${
              shaping === k.id ? 'ring-2 ring-accent ring-offset-1 ring-offset-sunken' : ''
            } ${k.easing && shaping !== k.id ? 'ring-1 ring-accent/50 ring-offset-1 ring-offset-sunken' : ''}`}
            style={{ left: `${k.t * 100}%` }}
          />
        ))}
        {shapingKey ? (
          <SegmentShape
            at={shapingKey.t}
            easing={shapingKey.easing}
            onChange={(e) => onKeys(setKeyEasing(keys, target, shapingKey.id, e))}
            onClose={() => setShaping(null)}
          />
        ) : null}
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

/**
 * The curve one segment is travelled on, over the lane it belongs to.
 *
 * It is the same editor the whole loop uses, because a segment's easing is the
 * same kind of thing as the loop's and learning two of them would be a tax.
 * It opens upward: the timeline sits at the foot of the window and a panel
 * dropping down would be off-screen.
 */
function SegmentShape({
  at, easing, onChange, onClose
}: {
  /** Where in the loop the key sits, so the panel opens next to it. */
  at: number
  easing: Easing | undefined
  onChange: (e: Easing | undefined) => void
  onClose: () => void
}): React.JSX.Element {
  // Held away from the ends so a key at 0 or 1 does not push the panel out of
  // the window; it still reads as belonging to the key it came from.
  const left = Math.min(88, Math.max(12, at * 100))
  return (
    <div
      data-segment-shape
      style={{ left: `${left}%` }}
      className="t42-menu t42-menu-up absolute bottom-full z-30 mb-1.5 w-56 -translate-x-1/2 rounded-panel bg-raised p-2 shadow-overlay"
    >
      <div className="flex items-center justify-between pb-1">
        <span className="text-[10.5px] text-text-secondary">This segment</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the segment shape"
          className="rounded-sm px-1 text-[12px] leading-none text-text-muted hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          ×
        </button>
      </div>
      <EasingEditor easing={easing ?? LINEAR} onChange={onChange} />
      <button
        type="button"
        onClick={() => onChange(undefined)}
        disabled={!easing}
        className="mt-1.5 w-full rounded-sm py-1 text-[10.5px] text-text-muted hover:bg-elevated hover:text-text-primary disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        Straight line
      </button>
    </div>
  )
}

const LINEAR: Easing = { x1: 0, y1: 0, x2: 1, y2: 1 }

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
  if (kind === 'fx') return FX_LABELS[rest] ?? rest
  if (kind === 'text' || kind === 'logo') {
    const [id, field] = splitOnce(rest)
    const name = kind === 'text'
      ? doc.visual.text.find((t) => t.id === id)?.text.trim().split('\n')[0]
      : `Logo ${doc.visual.logos.findIndex((l) => l.id === id) + 1}`
    // The layer's own words are the best name it has; the field is what
    // tells two tracks on the same layer apart.
    return `${(name || 'Layer').slice(0, 14)} ${FIELD_LABELS[field] ?? field}`
  }
  return target
}

const FX_LABELS: Record<string, string> = {
  blur: 'Blur', grain: 'Grain', vignette: 'Vignette', shadow: 'Edge shadow',
  brightness: 'Brightness', contrast: 'Contrast', saturation: 'Saturation',
  tintAmount: 'Tint amount'
}

const FIELD_LABELS: Record<string, string> = {
  size: 'size', x: 'across', y: 'down', opacity: 'opacity', tracking: 'tracking'
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

/** The timing a layer carries, which is all this row cares about. */
type LayerSpan = { from?: number; to?: number; fade?: number }

/**
 * One layer, and when it is on screen.
 *
 * The bar starts full width because that is what a layer with no timing
 * means, and dragging an edge of it is how a window gets made — there is no
 * separate step for turning timing on. A layer whose window wraps through the
 * seam draws as two pieces of one bar rather than as two bars, because it is
 * one span and reading it as two would suggest it could be moved apart.
 */
function LayerRow({
  label, kind, span, phase, onSpan, selected = false, onSelect, onRemove
}: {
  label: string
  kind: string
  span: LayerSpan
  phase: number
  onSpan: (patch: LayerSpan) => void
  selected?: boolean
  onSelect?: () => void
  onRemove?: () => void
}): React.JSX.Element {
  const lane = useRef<HTMLDivElement>(null)
  const drag = useRef<{ edge: 'from' | 'to' | 'body'; grabbed: number; from: number; to: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const bounded = span.from !== undefined || span.to !== undefined
  const from = wrapUnit(span.from ?? 0)
  const to = wrapEnd(span.to ?? 1)
  const on = layerVisibility(span, phase) > 0

  const tAt = (clientX: number): number => {
    const box = lane.current?.getBoundingClientRect()
    if (!box || box.width === 0) return 0
    return Math.min(1, Math.max(0, (clientX - box.left) / box.width))
  }

  const down = (e: React.PointerEvent<HTMLElement>, edge: 'from' | 'to' | 'body'): void => {
    e.stopPropagation()
    e.preventDefault()
    drag.current = { edge, grabbed: tAt(e.clientX), from, to }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const move = (e: React.PointerEvent<HTMLElement>): void => {
    const d = drag.current
    if (!d) return
    const t = tAt(e.clientX)
    if (d.edge === 'from') onSpan({ from: t, to: d.to })
    else if (d.edge === 'to') onSpan({ from: d.from, to: t })
    else {
      // The body keeps its width, so moving it never also resizes it. Both
      // ends wrap, which is what lets a window be dragged over the seam
      // instead of stopping dead at the end of the loop.
      const shift = t - d.grabbed
      onSpan({ from: wrapUnit(d.from + shift), to: wrapUnit(d.to + shift) })
    }
  }

  const up = (e: React.PointerEvent<HTMLElement>): void => {
    drag.current = null
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  // A window that wraps is drawn as the piece at the end plus the piece at
  // the start, which together are the one span.
  const pieces = to >= from
    ? [{ left: from, width: to - from }]
    : [{ left: from, width: 1 - from }, { left: 0, width: to }]

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onSelect}
        disabled={!onSelect}
        aria-pressed={selected}
        title={`${kind}: ${label}`}
        className={`${LABEL_W} shrink-0 truncate rounded-sm px-1 text-left text-[10.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
          selected
            ? 'bg-accent/15 text-accent'
            : `${on ? 'text-text-secondary' : 'text-text-muted'} enabled:hover:bg-raised enabled:hover:text-text-primary`
        }`}
      >
        {label}
      </button>
      <div ref={lane} className="relative h-5 flex-1 overflow-hidden rounded-sm bg-sunken">
        {pieces.map((p, i) => (
          <span
            key={i}
            aria-hidden
            onPointerDown={(e) => down(e, 'body')}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            className={`absolute inset-y-[3px] rounded-[3px] ${dragging ? 'cursor-grabbing' : 'cursor-grab'} ${
              bounded ? 'bg-accent/25' : 'bg-raised'
            }`}
            style={{ left: `${p.left * 100}%`, width: `${Math.max(0, p.width) * 100}%` }}
          />
        ))}
        <Handle t={from} label={`Start of ${label}`} onDown={(e) => down(e, 'from')} onMove={move} onUp={up} />
        <Handle t={to} label={`End of ${label}`} onDown={(e) => down(e, 'to')} onMove={move} onUp={up} />
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 h-full w-px bg-accent/70"
          style={{ left: `${phase * 100}%` }}
        />
      </div>
      <div className={`${TAIL_W} flex shrink-0 items-center justify-end gap-0.5`}>
        <button
          type="button"
          onClick={() => onSpan({ fade: span.fade ? undefined : 0.15 })}
          aria-pressed={Boolean(span.fade)}
          // Softening the ends of a window that has no ends would do nothing
          // at all, so it is shut off rather than left to be pressed in vain.
          disabled={!bounded}
          aria-label={`Soften the ends of ${label}`}
          title={
            !bounded
              ? 'Give it a window first, then its ends can be softened'
              : span.fade
                ? 'Cut the ends sharp again'
                : 'Soften the ends, so it comes and goes'
          }
          className={`rounded-sm px-0.5 py-0.5 leading-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
            span.fade ? 'text-accent' : 'text-text-muted enabled:hover:bg-raised enabled:hover:text-text-primary'
          }`}
        >
          <FadeGlyph />
        </button>
        <button
          type="button"
          onClick={() => onSpan({ from: undefined, to: undefined, fade: undefined })}
          disabled={!bounded && !span.fade}
          aria-label={`Show ${label} for the whole loop`}
          title={bounded ? `Show ${label} for the whole loop` : `${label} already runs the whole loop`}
          className="rounded-sm px-1 text-[12px] leading-none text-text-muted enabled:hover:bg-raised enabled:hover:text-text-primary disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          ×
        </button>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Delete ${label}`}
            title={`Delete ${label}`}
            className="rounded-sm px-0.5 py-0.5 leading-none text-text-muted hover:bg-raised hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <BinGlyph />
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** A bin, drawn small enough to sit in a lane's tail beside the other two. */
function BinGlyph(): React.JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2.5 3.5h7M5 3.5V2.5h2v1M3.5 3.5l.4 6a1 1 0 0 0 1 .9h2.2a1 1 0 0 0 1-.9l.4-6"
        stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Handle({
  t, label, onDown, onMove, onUp
}: {
  t: number
  label: string
  onDown: (e: React.PointerEvent<HTMLElement>) => void
  onMove: (e: React.PointerEvent<HTMLElement>) => void
  onUp: (e: React.PointerEvent<HTMLElement>) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={`${label} — drag to move it`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      // Wider than it looks, because a two pixel target is not a target. The
      // visible mark is the inner span; the button around it is the grab.
      className="absolute inset-y-0 w-2.5 cursor-ew-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      // Held inside the lane rather than centred on the position, because the
      // lane clips what overhangs it and a handle at either end would then be
      // half gone — and the half that is gone is the half you reach for.
      style={{ left: `clamp(0px, calc(${t * 100}% - 5px), calc(100% - 10px))` }}
    >
      <span aria-hidden className="absolute inset-y-[3px] left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-accent" />
    </button>
  )
}

/** A ramp up and down, which is what softened ends do. */
function FadeGlyph(): React.JSX.Element {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
      <path d="M1 7 3.2 1.6h3.6L9 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Keep a position inside the loop, so dragging past an end comes round. */
function wrapUnit(v: number): number {
  return ((v % 1) + 1) % 1
}

/** As above, but the end of the loop stays the end rather than becoming the start. */
function wrapEnd(v: number): number {
  const w = wrapUnit(v)
  return w === 0 && v !== 0 ? 1 : w
}
