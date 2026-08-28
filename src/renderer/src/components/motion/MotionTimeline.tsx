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

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import type {
  LogoLayer, MotionDoc, PictureLayer, ShapeLayer, TextLayer
} from '../../../../shared/motion/types'
import { FRAME_RATES, SHAPE_LABELS } from '../../../../shared/motion/types'
import { componentFor } from '../../../../shared/motion/registry'
import { layerVisibility } from '../../../../shared/motion/frame'
import {
  keyedTargets, moveKey, nudgeKeyTime, removeKey, removeTrack, sampleTrack, setKey, setKeyEasing,
  setKeyValue, setMuted, snapKeyTime,
  type Keyframes, type TrackTarget
} from '../../../../shared/motion/keyframes'
import { EasingEditor } from './EasingEditor'
import type { Easing } from '../../../../shared/motion/types'
import { Hint } from '../Hint'
import { samePick, type Pick } from '../../lib/motion/overlayPick'

/** The three columns every row shares. Changing one here moves all of them. */
const LABEL_W = 'w-[132px]'
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
  // The grid a key lands on. A loop is a whole number of frames, and a key
  // between two of them renders on one of them regardless, so this is what
  // every lane snaps and nudges by.
  const frames = Math.max(1, Math.round(doc.export.durationSec * doc.export.fps))
  const [open, setOpen] = useState(false)
  // Selecting a caption on the frame and finding the layer list still closed
  // would leave the app quietly disagreeing with itself about what is in hand.
  useEffect(() => {
    if (selected && selected.kind !== 'card') setOpen(true)
  }, [selected])

  const text = doc.visual.text
  const logos = doc.visual.logos
  const shapes = doc.visual.shapes ?? []
  const pictures = doc.visual.pictures ?? []
  const layerCount = text.length + logos.length + shapes.length + pictures.length + targets.length + 1

  // A track belongs to the layer it drives. Any left over drives a layer that
  // has since been deleted — it still applies, so it still has to be listed.
  const owners: Record<string, ReadonlyArray<{ id: string }>> = {
    text, logo: logos, shape: shapes, picture: pictures
  }
  const orphans = targets.filter((t) => {
    const [kind, rest] = splitOnce(t)
    const list = owners[kind]
    if (!list) return kind !== 'param' && kind !== 'pose' && kind !== 'fx'
    const [id] = splitOnce(rest)
    return !list.some((l) => l.id === id)
  })

  const setText = (id: string, patch: Partial<TextLayer>): void =>
    onChange({ visual: { ...doc.visual, text: text.map((t) => (t.id === id ? { ...t, ...patch } : t)) } })
  const setLogo = (id: string, patch: Partial<LogoLayer>): void =>
    onChange({ visual: { ...doc.visual, logos: logos.map((l) => (l.id === id ? { ...l, ...patch } : l)) } })
  const setShape = (id: string, patch: Partial<ShapeLayer>): void =>
    onChange({ visual: { ...doc.visual, shapes: shapes.map((l) => (l.id === id ? { ...l, ...patch } : l)) } })
  const setPicture = (id: string, patch: Partial<PictureLayer>): void =>
    onChange({ visual: { ...doc.visual, pictures: pictures.map((l) => (l.id === id ? { ...l, ...patch } : l)) } })

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
          style={{ left: `calc(140px + (100% - 216px) * ${phase})` }}
          className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-accent/40"
        />
        <Ruler doc={doc} phase={phase} onPhase={onPhase} />

        {open ? (
        <>
          <GroupLabel>Scene</GroupLabel>
          <ComponentRow doc={doc} phase={phase} />
          {tracksOf(targets, 'scene').map((target) => (
            <TrackRow
              key={target}
              label={fieldLabel(doc, target)}
              target={target}
              keys={keys}
              phase={phase}
              onPhase={onPhase}
              onKeys={(next) => onChange({ keys: next })}
              frames={frames}
              nested
            />
          ))}

          {shapes.length + pictures.length > 0 ? <GroupLabel>Scenery</GroupLabel> : null}
          {shapes.map((sh) => (
            <Fragment key={sh.id}>
              <LayerRow
                label={SHAPE_LABELS[sh.kind]}
                kind="Shape"
                span={sh}
                phase={phase}
                onSpan={(patch) => setShape(sh.id, patch)}
                selected={samePick(selected, { kind: 'shape', id: sh.id })}
                onSelect={onSelect ? () => onSelect({ kind: 'shape', id: sh.id }) : undefined}
                onRemove={onRemove ? () => onRemove({ kind: 'shape', id: sh.id }) : undefined}
              />
              {tracksOf(targets, `shape:${sh.id}`).map((target) => (
                <TrackRow
                  key={target}
                  label={fieldLabel(doc, target)}
                  target={target}
                  keys={keys}
                  phase={phase}
                  onPhase={onPhase}
                  onKeys={(next) => onChange({ keys: next })}
                  frames={frames}
                  nested
                />
              ))}
            </Fragment>
          ))}
          {pictures.map((pic) => (
            <Fragment key={pic.id}>
              <LayerRow
                label={pic.imageId ? 'Picture' : `${pic.placeholder ?? 'Picture'} (empty)`}
                kind="Picture"
                span={pic}
                phase={phase}
                onSpan={(patch) => setPicture(pic.id, patch)}
                selected={samePick(selected, { kind: 'picture', id: pic.id })}
                onSelect={onSelect ? () => onSelect({ kind: 'picture', id: pic.id }) : undefined}
                onRemove={onRemove ? () => onRemove({ kind: 'picture', id: pic.id }) : undefined}
              />
              {tracksOf(targets, `picture:${pic.id}`).map((target) => (
                <TrackRow
                  key={target}
                  label={fieldLabel(doc, target)}
                  target={target}
                  keys={keys}
                  phase={phase}
                  onPhase={onPhase}
                  onKeys={(next) => onChange({ keys: next })}
                  frames={frames}
                  nested
                />
              ))}
            </Fragment>
          ))}

          {text.length > 0 ? <GroupLabel>Type</GroupLabel> : null}
          {text.map((t) => (
            <Fragment key={t.id}>
              <LayerRow
                label={t.text.trim().split('\n')[0] || 'Text'}
                kind="Text"
                span={t}
                phase={phase}
                onSpan={(patch) => setText(t.id, patch)}
                selected={samePick(selected, { kind: 'text', id: t.id })}
                onSelect={onSelect ? () => onSelect({ kind: 'text', id: t.id }) : undefined}
                onRemove={onRemove ? () => onRemove({ kind: 'text', id: t.id }) : undefined}
              />
              {tracksOf(targets, `text:${t.id}`).map((target) => (
                <TrackRow
                  key={target}
                  label={fieldLabel(doc, target)}
                  target={target}
                  keys={keys}
                  phase={phase}
                  onPhase={onPhase}
                  onKeys={(next) => onChange({ keys: next })}
                  frames={frames}
                  nested
                />
              ))}
            </Fragment>
          ))}

          {logos.length > 0 ? <GroupLabel>Marks</GroupLabel> : null}
          {logos.map((l, i) => (
            <Fragment key={l.id}>
              <LayerRow
                label={`Logo ${i + 1}`}
                kind="Logo"
                span={l}
                phase={phase}
                onSpan={(patch) => setLogo(l.id, patch)}
                selected={samePick(selected, { kind: 'logo', id: l.id })}
                onSelect={onSelect ? () => onSelect({ kind: 'logo', id: l.id }) : undefined}
                onRemove={onRemove ? () => onRemove({ kind: 'logo', id: l.id }) : undefined}
              />
              {tracksOf(targets, `logo:${l.id}`).map((target) => (
                <TrackRow
                  key={target}
                  label={fieldLabel(doc, target)}
                  target={target}
                  keys={keys}
                  phase={phase}
                  onPhase={onPhase}
                  onKeys={(next) => onChange({ keys: next })}
                  frames={frames}
                  nested
                />
              ))}
            </Fragment>
          ))}

          {/* Tracks whose layer is gone. They keep applying, so they have to
              stay reachable — but they belong under nothing, and saying so is
              better than filing them beside tracks that do have a layer. */}
          {orphans.length > 0 ? (
            <>
              <GroupLabel>No longer attached to a layer</GroupLabel>
              {orphans.map((target) => (
                <TrackRow
                  key={target}
                  label={trackLabel(doc, target)}
                  target={target}
                  keys={keys}
                  phase={phase}
                  onPhase={onPhase}
                  onKeys={(next) => onChange({ keys: next })}
                  frames={frames}
                />
              ))}
            </>
          ) : null}
        </>
      ) : (
        // Closed, the layers are put away but the animation is not: the keys
        // are the part you come back to adjust, so they stay on show.
        targets.map((target) => (
          <TrackRow
            key={target}
            label={trackLabel(doc, target)}
            target={target}
            keys={keys}
            phase={phase}
            onPhase={onPhase}
            onKeys={(next) => onChange({ keys: next })}
            frames={frames}
          />
        ))
      )}

      {targets.length > 0 ? (
        <div className="flex items-center gap-2">
          <span className={`${LABEL_W} shrink-0 px-1 text-[10px] text-text-muted`}>
            {targets.length === 1 ? '1 animated value' : `${targets.length} animated values`}
          </span>
          <span className="flex flex-1 items-center">
            <Hint label="Double-click a lane to add a key. Click a key to set its time, value and easing; drag to move it, arrows to nudge it a frame at a time, Delete to remove it. Keys land on frames — hold Alt to place one between two. \u2318Z undoes." />
          </span>
          <button
            type="button"
            onClick={() => onChange({ keys: {} })}
            className={`${TAIL_W} shrink-0 rounded-sm py-0.5 text-[10px] text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60`}
          >
            Clear
          </button>
        </div>
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
        title={playing ? 'Pause (Space)' : 'Play (Space)'}
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
          className={`absolute inset-y-[3px] left-0 right-0 rounded-[3px] ${enabled ? 'bg-text-muted/35' : 'bg-text-muted/15'}`}
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
  label, target, keys, phase, onPhase, onKeys, frames, nested = false
}: {
  label: string
  target: TrackTarget
  keys: Keyframes
  phase: number
  onPhase: (p: number) => void
  onKeys: (k: Keyframes) => void
  /** How many frames the loop is, which is the grid a key snaps to. */
  frames: number
  /** Whether it hangs under a layer row, which is where the indent comes from. */
  nested?: boolean
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
    // A key lands on a frame, or on a neighbour within six pixels of the
    // pointer — six pixels being a little wider than the key itself, so the
    // pull is felt just before the two would overlap. Alt drags free.
    const width = lane.current?.getBoundingClientRect().width ?? 0
    const magnet = width > 0 ? 6 / width : 0
    const others = (track?.keys ?? []).filter((k) => k.id !== d.id).map((k) => k.t)
    onKeys(moveKey(keys, target, d.id, snapKeyTime(tAt(e.clientX), frames, others, magnet, e.altKey)))
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
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { setShaping(null); return }
      const el = document.activeElement
      const typing = !!el && /^(INPUT|TEXTAREA)$/.test(el.tagName)
      // Arrows walk the open key along the frame grid, which is how you place
      // a key exactly rather than by aiming a pointer at nine pixels. Shift
      // takes ten frames at a time, the way a nudge does everywhere else.
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (typing) return
        e.preventDefault()
        const k = (keys[target]?.keys ?? []).find((x) => x.id === shaping)
        if (!k) return
        const steps = (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1)
        const next = nudgeKeyTime(k.t, frames, steps)
        onKeys(moveKey(keys, target, shaping, next))
        onPhase(next)
        return
      }
      // Delete removes the selected key, which is what the key does to a
      // selected thing everywhere else. Typing in the inspector's own fields
      // is excluded: there, Backspace means the character behind the caret.
      if (e.key !== 'Backspace' && e.key !== 'Delete') return
      if (typing) return
      e.preventDefault()
      setShaping(null)
      onKeys(removeKey(keys, target, shaping))
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [shaping, keys, target, onKeys, frames, onPhase])

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onKeys(setMuted(keys, target, !track?.muted))}
        title={track?.muted ? `Let ${label} animate again` : `Stop ${label} animating, keeping its keys`}
        className={`${LABEL_W} shrink-0 truncate rounded-sm py-0.5 text-left text-[10px] hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
          nested ? 'pl-4 pr-1' : 'px-1'
        } ${track?.muted ? 'text-text-muted line-through' : 'text-text-muted'}`}
      >
        {label}
      </button>
      <div
        ref={lane}
        className="relative h-4 flex-1 rounded-sm bg-sunken"
        onDoubleClick={(e) => {
          // Adds a control point without changing the shape: the new key takes
          // the value the track already has there, so the animation is
          // untouched until the key is dragged.
          const t = snapKeyTime(tAt(e.clientX), frames, [], 0, e.altKey)
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
            title={`${Math.round(k.t * 100)}% — ${round(k.v)}. Click to open it, drag to move (Alt to ignore the frame grid), arrows to nudge, Delete or right-click to remove.`}
            className={`absolute top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
              dragging ? 'cursor-grabbing' : 'cursor-grab'
            } ${track?.muted ? 'bg-text-muted' : 'bg-accent'} ${
              shaping === k.id ? 'ring-2 ring-accent ring-offset-1 ring-offset-sunken' : ''
            } ${k.easing && shaping !== k.id ? 'ring-1 ring-accent/50 ring-offset-1 ring-offset-sunken' : ''}`}
            style={{ left: `${k.t * 100}%` }}
          />
        ))}
        {shapingKey ? (
          <KeyInspector
            at={shapingKey.t}
            value={shapingKey.v}
            easing={shapingKey.easing}
            onTime={(t) => onKeys(moveKey(keys, target, shapingKey.id, t))}
            onValue={(v) => onKeys(setKeyValue(keys, target, shapingKey.id, v))}
            onEasing={(e) => onKeys(setKeyEasing(keys, target, shapingKey.id, e))}
            onDelete={() => { setShaping(null); onKeys(removeKey(keys, target, shapingKey.id)) }}
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
/**
 * The selected key, and everything you can do to it.
 *
 * This used to be an easing shaper and nothing else, which left the timeline
 * able to say *how* a value travels between two keys but not *what* either key
 * holds. The only way to change a value was to scrub to the key, find the
 * slider it belongs to and drag it, hoping to land back on the same phase —
 * every other animation tool lets you select the key and type the number.
 *
 * Time is here for the same reason. Dragging is the fast way and stays the
 * usual one; a field is the way to put a key exactly on the half.
 */
function KeyInspector({
  at, value, easing, onTime, onValue, onEasing, onDelete, onClose
}: {
  /** Where in the loop the key sits, so the panel opens next to it. */
  at: number
  value: number
  easing: Easing | undefined
  onTime: (t: number) => void
  onValue: (v: number) => void
  onEasing: (e: Easing | undefined) => void
  onDelete: () => void
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
        <span className="text-[10.5px] text-text-secondary">This key</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the key"
          className="rounded-sm px-1 text-[12px] leading-none text-text-muted hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          ×
        </button>
      </div>

      <div className="flex gap-1.5 pb-1.5">
        <NumField
          label="At"
          suffix="%"
          value={Number((at * 100).toFixed(1))}
          onChange={(n) => onTime(Math.min(100, Math.max(0, n)) / 100)}
        />
        <NumField label="Value" value={Number(value.toFixed(3))} onChange={onValue} />
      </div>

      <span className="block pb-1 text-[10.5px] text-text-secondary">The segment after it</span>
      <EasingEditor easing={easing ?? LINEAR} onChange={onEasing} />
      <button
        type="button"
        onClick={() => onEasing(undefined)}
        disabled={!easing}
        className="mt-1.5 w-full rounded-sm py-1 text-[10.5px] text-text-muted hover:bg-elevated hover:text-text-primary disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        Straight line
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="mt-1 w-full rounded-sm py-1 text-[10.5px] text-text-muted hover:bg-elevated hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        Delete key <span className="text-text-disabled">⌫</span>
      </button>
    </div>
  )
}

/**
 * A number you can type.
 *
 * Local text state rather than the number straight from the document: typing
 * "0.5" means passing through "0." and "0", and a field that rewrote itself
 * from the document on every keystroke would fight the person using it.
 */
function NumField({
  label, value, suffix, onChange
}: {
  label: string
  value: number
  suffix?: string
  onChange: (n: number) => void
}): React.JSX.Element {
  const [text, setText] = useState(String(value))
  const [editing, setEditing] = useState(false)
  useEffect(() => { if (!editing) setText(String(value)) }, [value, editing])

  const commitText = (): void => {
    setEditing(false)
    const n = Number(text)
    if (Number.isFinite(n)) onChange(n)
    else setText(String(value))
  }

  return (
    <label className="min-w-0 flex-1">
      <span className="block pb-0.5 text-[10px] text-text-muted">{label}</span>
      <span className="flex items-center rounded-sm bg-elevated px-1.5">
        <input
          value={text}
          inputMode="decimal"
          onChange={(e) => { setEditing(true); setText(e.target.value) }}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.currentTarget.blur() }
            if (e.key === 'Escape') { setEditing(false); setText(String(value)); e.currentTarget.blur() }
            // The lane listens for Backspace to delete the selected key. In
            // here it means the character behind the caret.
            e.stopPropagation()
          }}
          aria-label={label}
          className="min-w-0 flex-1 bg-transparent py-1 font-mono text-[11px] text-text-primary focus-visible:outline-none"
        />
        {suffix ? <span className="pl-0.5 font-mono text-[10px] text-text-muted">{suffix}</span> : null}
      </span>
    </label>
  )
}

const LINEAR: Easing = { x1: 0, y1: 0, x2: 1, y2: 1 }

function round(v: number): string {
  return String(Number(v.toFixed(2)))
}

/**
 * The tracks belonging to one owner.
 *
 * A property track used to be filed in a flat list under "Animated values",
 * so a track reading "a film in six tracki…" sat three rows away from the
 * layer it drives with nothing to say they were related. Nesting each track
 * under its layer is how the Form timeline has always done it, and it is the
 * only arrangement in which the label can be short enough to read.
 */
function tracksOf(targets: readonly TrackTarget[], owner: string): TrackTarget[] {
  if (owner === 'scene') {
    return targets.filter((t) => {
      const [kind] = splitOnce(t)
      return kind === 'param' || kind === 'pose' || kind === 'fx'
    })
  }
  return targets.filter((t) => t.startsWith(`${owner}:`))
}

/**
 * What a track drives, without repeating the layer it hangs under.
 *
 * The layer's name is already on the row above, so saying it again costs the
 * width that made these labels truncate in the first place.
 */
function fieldLabel(doc: MotionDoc, target: TrackTarget): string {
  const [kind, rest] = splitOnce(target)
  if (kind === 'text' || kind === 'logo' || kind === 'shape' || kind === 'picture') {
    const [, field] = splitOnce(rest)
    const name = FIELD_LABELS[field] ?? field
    return name.charAt(0).toUpperCase() + name.slice(1)
  }
  return trackLabel(doc, target)
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
  if (kind === 'text' || kind === 'logo' || kind === 'shape' || kind === 'picture') {
    const [id, field] = splitOnce(rest)
    const name = kind === 'text'
      ? doc.visual.text.find((t) => t.id === id)?.text.trim().split('\n')[0]
      : kind === 'shape'
        ? (() => {
            const sh = (doc.visual.shapes ?? []).find((l) => l.id === id)
            return sh ? SHAPE_LABELS[sh.kind] : undefined
          })()
        : kind === 'picture'
          ? 'Picture'
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
  size: 'size', x: 'across', y: 'down', opacity: 'opacity', tracking: 'tracking',
  width: 'width', height: 'height', rotation: 'turn', scale: 'scale'
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
type LayerSpan = { from?: number; to?: number; fade?: number; hidden?: boolean }

/**
 * The same eye Form draws in its layer list, at the same size.
 *
 * Copied rather than shared because it is nine path commands and importing it
 * across two canvases that have nothing else in common would be the more
 * expensive of the two. It has to be the same shape, though: the eye is the
 * one control a person looks for without reading, and two different eyes in
 * one app would mean two different things.
 */
function EyeGlyph({ on }: { on: boolean }): React.JSX.Element {
  return on ? (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 3l18 18" /><path d="M10.6 6.1A10.8 10.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.8M6.2 6.3A17 17 0 0 0 2 12s3.5 6 10 6a10 10 0 0 0 3.3-.5" /></svg>
  )
}

/**
 * One layer, and when it is on screen.
 *
 * The bar starts full width because that is what a layer with no timing
 * means, and dragging an edge of it is how a window gets made — there is no
 * separate step for turning timing on. A layer whose window wraps through the
 * seam draws as two pieces of one bar rather than as two bars, because it is
 * one span and reading it as two would suggest it could be moved apart.
 *
 * Every bar is the same colour. It used to be white when the layer ran the
 * whole loop and green when it had a window, which put two unrelated meanings
 * into a colour with nothing to read them by — and green is also selection,
 * the playhead and every key, so it was saying four things at once. Now the
 * length of the bar carries the window, tone carries whether the layer is on
 * screen at the playhead, and accent is kept for the one thing in hand.
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
      // A bar with no window covers the whole loop, and there is nowhere for
      // "always" to be dragged to. Letting it move looked harmless and was
      // not: it turned a layer with no timing into one with timing, on the
      // strength of a click that was meant to select.
      if (!bounded) return
      // The body keeps its width, so moving it never also resizes it. Both
      // ends wrap, which is what lets a window be dragged over the seam
      // instead of stopping dead at the end of the loop. The end wraps with
      // wrapEnd, not wrapUnit: the end of the loop has to stay the end, or a
      // span reaching 1 would come back as 0 and the window would collapse to
      // nothing — a layer gone for good, with nothing on screen to say why.
      const shift = t - d.grabbed
      onSpan({ from: wrapUnit(d.from + shift), to: wrapEnd(d.to + shift) })
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
      {/* The eye and the name share the label column, so the lanes below a
          layer still start where the layer's own lane starts. */}
      <div className={`${LABEL_W} flex shrink-0 items-center gap-1`}>
        <button
          type="button"
          onClick={() => onSpan({ hidden: !span.hidden })}
          aria-pressed={!span.hidden}
          aria-label={span.hidden ? `Show ${label}` : `Hide ${label}`}
          title={span.hidden ? `Show ${label}` : `Hide ${label}, without changing the piece`}
          className={`grid h-4 w-4 shrink-0 place-items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
            span.hidden ? 'text-text-muted hover:text-text-primary' : 'text-text-secondary hover:bg-raised hover:text-text-primary'
          }`}
        >
          <EyeGlyph on={!span.hidden} />
        </button>
        <button
          type="button"
          onClick={onSelect}
          disabled={!onSelect}
          aria-pressed={selected}
          title={`${kind}: ${label}`}
          className={`min-w-0 flex-1 truncate rounded-sm px-1 text-left text-[10.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
            selected
              ? 'bg-accent/15 text-accent'
              : `${on ? 'text-text-secondary' : 'text-text-muted'} enabled:hover:bg-raised enabled:hover:text-text-primary`
          } ${span.hidden ? 'opacity-60' : ''}`}
        >
          {label}
        </button>
      </div>
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
              selected ? 'bg-accent/45' : on ? 'bg-text-muted/35' : 'bg-text-muted/15'
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
        {/* A window's controls appear only once it has a window. Three greyed
            glyphs on every row taught nothing except that most of the tail is
            unavailable, and left the one live glyph looking like an error. */}
        {bounded ? (
          <>
            <button
              type="button"
              onClick={() => onSpan({ fade: span.fade ? undefined : 0.15 })}
              aria-pressed={Boolean(span.fade)}
              aria-label={`Soften the ends of ${label}`}
              title={span.fade ? 'Cut the ends sharp again' : 'Soften the ends, so it comes and goes'}
              className={`rounded-sm px-0.5 py-0.5 leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                span.fade ? 'text-accent' : 'text-text-muted hover:bg-raised hover:text-text-primary'
              }`}
            >
              <FadeGlyph />
            </button>
            <button
              type="button"
              onClick={() => onSpan({ from: undefined, to: undefined, fade: undefined })}
              aria-label={`Show ${label} for the whole loop`}
              title={`Show ${label} for the whole loop`}
              className="rounded-sm px-1 text-[12px] leading-none text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              ×
            </button>
          </>
        ) : null}
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
