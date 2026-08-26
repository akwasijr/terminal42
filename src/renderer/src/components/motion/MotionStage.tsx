// The frame: backdrop, WebGL canvas, and the clock that drives them.
//
// Two stacked canvases rather than one. The backdrop is 2D and the piece is
// WebGL, and keeping them apart means the exporter can composite exactly what
// is on screen, in the same order, using the same drawing code — including
// the case where the user wants the piece exported without the grid they were
// working against.

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import type { CardOverride, MotionDoc } from '../../../../shared/motion/types'
import { cardCountFor, emptyOverride } from '../../../../shared/motion/frame'
import { placementsAt, totalDuration } from '../../../../shared/motion/entrance'
import type { FrameFit } from './FrameToolbar'
import { MotionEngine } from '../../lib/motion/engine'
import { drawBackdrop, drawOverlay, FRAME_ASPECT_RATIO } from '../../lib/motion/backdrop'

export type StageHandle = {
  engine: () => MotionEngine | null
  /** Put the renderer back to its on-screen size after an export borrowed it. */
  restore: () => void
  /** A still of exactly what is on screen, for list thumbnails. */
  snapshot: (maxWidth: number) => string | null
}

export function MotionStage({
  doc,
  images,
  playing,
  exporting = false,
  phase,
  onPhase,
  handleRef,
  selected,
  onSelect,
  onPatch,
  onDropFiles,
  poseMode = false,
  fit = 'contain',
  replayToken = 0,
  replayLooping = false
}: {
  doc: MotionDoc
  images: Map<string, HTMLImageElement>
  playing: boolean
  /** While true the stage stops drawing, so the exporter owns the renderer. */
  exporting?: boolean
  phase: number
  onPhase: (p: number) => void
  handleRef?: Ref<StageHandle>
  /** Index of the card the user is working on, or null. */
  selected: number | null
  onSelect: (index: number | null) => void
  onPatch: (patch: Partial<MotionDoc>) => void
  /** Pictures dragged in from the desktop, with the card they landed on. */
  onDropFiles: (files: File[], cardIndex: number | null) => void
  /** While true a drag poses the whole piece instead of picking up a card. */
  poseMode?: boolean
  /** 'edge' lets the frame fill the panel instead of sitting inside it. */
  fit?: FrameFit
  /** Bumped to replay the entrance; the value itself means nothing. */
  replayToken?: number
  replayLooping?: boolean
}): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const glRef = useRef<HTMLCanvasElement | null>(null)
  const backRef = useRef<HTMLCanvasElement | null>(null)
  const overRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<MotionEngine | null>(null)
  const docRef = useRef(doc)
  const phaseRef = useRef(phase)
  const playingRef = useRef(playing)
  const exportingRef = useRef(exporting)
  const [error, setError] = useState<string | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hint, setHint] = useState<string | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const sizeRef = useRef(size)
  sizeRef.current = size
  const poseRef = useRef(poseMode)
  poseRef.current = poseMode
  // When the entrance started, in rAF time. Null means the piece is settled
  // and only its own loop is running.
  const replayRef = useRef<number | null>(null)
  const replayLoopRef = useRef(replayLooping)
  replayLoopRef.current = replayLooping

  docRef.current = doc
  playingRef.current = playing
  exportingRef.current = exporting
  if (!playing) phaseRef.current = phase

  useImperativeHandle(handleRef, () => ({
    engine: () => engineRef.current,
    restore: () => {
      engineRef.current?.setSize(size.width, size.height, Math.min(2, window.devicePixelRatio || 1))
    },
    snapshot: (maxWidth: number) => {
      const gl = glRef.current
      const back = backRef.current
      if (!gl || !back) return null
      const ratio = FRAME_ASPECT_RATIO[doc.frame.aspect] ?? 16 / 9
      const w = Math.round(maxWidth)
      const h = Math.round(maxWidth / ratio)
      const out = document.createElement('canvas')
      out.width = w
      out.height = h
      const ctx = out.getContext('2d')
      if (!ctx) return null
      drawBackdrop(ctx, doc.frame, w, h, { showGrid: doc.frame.gridVisible })
      ctx.drawImage(gl, 0, 0, w, h)
      drawOverlay(ctx, doc.visual.text, w, h)
      return out.toDataURL('image/jpeg', 0.7)
    }
  }), [doc.frame, doc.visual.text, size])

  // Boot the engine once. three.js is imported here rather than at module
  // scope so opening the Motion list does not pay for the 3D renderer; only
  // opening a piece does.
  useEffect(() => {
    let cancelled = false
    const canvas = glRef.current
    if (!canvas) return
    void import('three')
      .then((three) => {
        if (cancelled) return
        engineRef.current = new MotionEngine(three, canvas)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String((e as Error)?.message ?? e))
      })
    return () => {
      cancelled = true
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [])

  // Size the frame to the largest rectangle of the chosen aspect that fits.
  //
  // Edge-to-edge is the same rectangle grown until it touches the panel on
  // both sides — the aspect never changes, because the aspect is what will be
  // exported. All the toolbar's second button does is take the margin away.
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const ratio = FRAME_ASPECT_RATIO[doc.frame.aspect] ?? 16 / 9
    const measure = (): void => {
      const rect = host.getBoundingClientRect()
      const pad = fit === 'edge' ? 0 : 32
      const w = Math.max(0, rect.width - pad)
      const h = Math.max(0, rect.height - pad)
      const width = Math.max(0, Math.min(w, h * ratio))
      setSize({ width: Math.round(width), height: Math.round(width / ratio) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(host)
    return () => ro.disconnect()
  }, [doc.frame.aspect, fit])

  useEffect(() => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    engineRef.current?.setSize(size.width, size.height, dpr)
    const back = backRef.current
    if (back && size.width > 0) {
      back.width = Math.round(size.width * dpr)
      back.height = Math.round(size.height * dpr)
      const ctx = back.getContext('2d')
      if (ctx) drawBackdrop(ctx, doc.frame, back.width, back.height)
    }
    const over = overRef.current
    if (over && size.width > 0) {
      over.width = Math.round(size.width * dpr)
      over.height = Math.round(size.height * dpr)
      const ctx = over.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, over.width, over.height)
        drawOverlay(ctx, doc.visual.text, over.width, over.height)
      }
    }
  }, [size, doc.frame, doc.visual.text])

  useEffect(() => {
    engineRef.current?.setImages(images)
  }, [images])

  useEffect(() => {
    engineRef.current?.setSelected(selected)
  }, [selected])

  // Play means "show me the entrance again". The token is a counter rather
  // than a boolean because pressing the same button twice has to fire twice.
  useEffect(() => {
    if (replayToken === 0) return
    replayRef.current = performance.now()
  }, [replayToken])

  useEffect(() => {
    if (!replayLooping) replayRef.current = null
  }, [replayLooping])

  // ── Working in the frame ──────────────────────────────────────────────
  //
  // The canvas is the tool, not a preview of one, so the pointer has to mean
  // something everywhere in it. Which card is under the cursor decides what a
  // drag does: on a card it moves that card, on the backdrop it turns the
  // whole piece. Holding a modifier overrides that, because a card can end up
  // covering the whole frame and would otherwise leave nowhere to grab.

  const ndc = (e: { clientX: number; clientY: number }, el: HTMLElement): [number, number] => {
    const r = el.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)]
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const engine = engineRef.current
    if (!engine) return
    const at = ndc(e, e.currentTarget)
    const hit = engine.pick(at[0], at[1])
    // Pose is a mode because there is nowhere else to put it: the same drag
    // has to mean "turn the piece" and "pick up that card", and a modifier
    // cannot carry both without one of them fighting the other.
    const mode: DragState['mode'] = poseRef.current
      ? e.shiftKey ? 'scale' : e.metaKey || e.ctrlKey ? 'move' : 'orbit'
      : e.shiftKey ? 'scrub' : hit !== null && !e.metaKey && !e.ctrlKey ? 'card' : 'orbit'
    const d = docRef.current
    dragRef.current = {
      mode,
      index: hit,
      from: at,
      last: at,
      startX: e.clientX,
      startPhase: phaseRef.current,
      rotate: e.altKey,
      moved: false,
      // A drag accumulates against what it started from rather than against
      // the live document. Several pointer moves can arrive between renders,
      // and reading the document each time would apply them all to the same
      // stale value — a fast drag would move the card a fraction of the way
      // the pointer went.
      basePose: { ...d.pose },
      baseTransform: { ...d.transform },
      baseOverride: { ...(d.overrides[String(hit)] ?? emptyOverride()) },
      acc: { x: 0, y: 0, z: 0, rx: 0, ry: 0 }
    }
    if (mode === 'card' && hit !== null) onSelect(hit)
    // Capture keeps a fast drag from escaping the frame. It throws if the
    // pointer has already gone, which is not a reason to lose the drag.
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* no capture, still draggable */ }
    setHint(
      mode === 'scrub' ? 'Scrubbing the loop'
        : mode === 'scale' ? 'Scaling the piece'
          : mode === 'move' ? 'Moving the piece'
            : mode === 'card' ? (e.altKey ? 'Turning this card' : 'Moving this card')
              : 'Turning the piece'
    )
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const drag = dragRef.current
    const engine = engineRef.current
    if (!drag || !engine) return
    const at = ndc(e, e.currentTarget)
    const dxNdc = at[0] - drag.last[0]
    const dyNdc = at[1] - drag.last[1]
    if (Math.abs(dxNdc) + Math.abs(dyNdc) > 0.0005) drag.moved = true
    const d = docRef.current

    if (drag.mode === 'scrub') {
      const width = Math.max(1, sizeRef.current.width)
      const next = (((drag.startPhase + (e.clientX - drag.startX) / width) % 1) + 1) % 1
      phaseRef.current = next
      onPhase(next)
    } else if (drag.mode === 'scale') {
      // Up is bigger, which is the way every other scale handle in the app
      // works, and the accumulator keeps a fast drag honest.
      drag.acc.y += dyNdc
      onPatch({
        transform: {
          ...d.transform,
          scale: clamp(drag.baseTransform.scale * Math.exp(drag.acc.y * 1.4), 0.1, 4)
        }
      })
    } else if (drag.mode === 'move') {
      drag.acc.x += dxNdc
      drag.acc.y += dyNdc
      onPatch({
        transform: {
          ...d.transform,
          positionX: clamp(drag.baseTransform.positionX + drag.acc.x * 50, -100, 100),
          positionY: clamp(drag.baseTransform.positionY + drag.acc.y * 50, -100, 100)
        }
      })
    } else if (drag.mode === 'orbit') {
      // Dragging right turns the piece to the right, which means rotating
      // about Y; up and down leans it towards you.
      drag.acc.rx += dyNdc * 90
      drag.acc.ry += dxNdc * 90
      onPatch({
        pose: {
          ...d.pose,
          tiltY: clampAngle(drag.basePose.tiltY + drag.acc.ry),
          tiltX: clampAngle(drag.basePose.tiltX + drag.acc.rx)
        }
      })
    } else if (drag.index !== null) {
      const key = String(drag.index)
      const base = drag.baseOverride
      if (drag.rotate) {
        drag.acc.ry += dxNdc * 3
        drag.acc.rx -= dyNdc * 3
        onPatch({
          overrides: {
            ...d.overrides,
            [key]: { ...base, drotY: base.drotY + drag.acc.ry, drotX: base.drotX + drag.acc.rx }
          }
        })
      } else {
        const delta = engine.dragDelta(drag.index, drag.last, at)
        if (delta) {
          drag.acc.x += delta.x
          drag.acc.y += delta.y
          drag.acc.z += delta.z
          onPatch({
            overrides: {
              ...d.overrides,
              [key]: { ...base, dx: base.dx + drag.acc.x, dy: base.dy + drag.acc.y, dz: base.dz + drag.acc.z }
            }
          })
        }
      }
    }
    drag.last = at
  }

  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const drag = dragRef.current
    dragRef.current = null
    setHint(null)
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    } catch { /* nothing to release */ }
    // A click that went nowhere is a click, and clicking the backdrop is how
    // you put a card down.
    if (drag && !drag.moved && drag.mode !== 'scrub' && drag.index === null) onSelect(null)
  }

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>): void => {
    const d = docRef.current
    const factor = Math.exp(-e.deltaY * 0.0015)
    onPatch({ transform: { ...d.transform, scale: clamp(d.transform.scale * factor, 0.1, 4) } })
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setHint(null)
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    const canvas = glRef.current
    const engine = engineRef.current
    let card: number | null = null
    if (canvas && engine) {
      const at = ndc(e, canvas)
      card = engine.pick(at[0], at[1])
    }
    onDropFiles(files, card)
  }

  // One animation frame loop for the life of the stage. It reads the latest
  // document from a ref rather than closing over it, because re-creating the
  // loop on every keystroke would restart the animation each time a slider
  // moved.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number): void => {
      raf = requestAnimationFrame(tick)
      const d = docRef.current
      const engine = engineRef.current
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (!engine || exportingRef.current) return
      if (playingRef.current && d.animationEnabled) {
        const duration = Math.max(0.1, d.export.durationSec)
        phaseRef.current = (phaseRef.current + dt / duration) % 1
        onPhase(phaseRef.current)
      }
      const count = cardCountFor(d)
      engine.setDoc(d, count)

      // The entrance plays over the top of the loop rather than instead of
      // it: the cards arrive into wherever the pattern has got to, which is
      // why there is no jump when the entrance hands over.
      let anim: { kind: 'in'; elapsedSec: number } | null = null
      const started = replayRef.current
      if (started !== null) {
        const spec = d.animation.componentIn
        const span = totalDuration(spec, count)
        const elapsed = (now - started) / 1000
        if (elapsed <= span) {
          anim = { kind: 'in', elapsedSec: elapsed }
        } else if (replayLoopRef.current) {
          const gap = Math.max(0.5, d.animation.replayEvery)
          if (elapsed >= span + gap) replayRef.current = now
        } else {
          replayRef.current = null
        }
      }
      engine.render(phaseRef.current, placementsAt(d, phaseRef.current, anim))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [onPhase])

  return (
    <div ref={hostRef} className="flex h-full w-full items-center justify-center overflow-hidden">
      {error ? (
        <p className="max-w-sm text-center text-[12px] text-error" role="alert">
          The 3D renderer could not start: {error}
        </p>
      ) : null}
      <div
        className="relative shrink-0 overflow-hidden"
        style={{ width: size.width || 1, height: size.height || 1, borderRadius: doc.frame.corners }}
        onDragOver={(e) => { e.preventDefault(); setHint('Drop to put this picture on a card') }}
        onDragLeave={() => setHint(null)}
        onDrop={onDrop}
      >
        <canvas ref={backRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
        <canvas
          ref={glRef}
          className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
          role="img"
          aria-label={
            poseMode
              ? `${doc.componentId} motion piece. Posing: drag to turn it, Shift+drag to scale, Cmd+drag to move.`
              : `${doc.componentId} motion piece. Drag to turn it, drag a card to move it, scroll to zoom.`
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={onWheel}
        />
        <canvas ref={overRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
        {hint ? (
          <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-sm bg-bg/80 px-2 py-1 text-[11px] text-text-secondary" role="status">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  )
}

type DragState = {
  mode: 'orbit' | 'card' | 'scrub' | 'scale' | 'move'
  index: number | null
  from: [number, number]
  last: [number, number]
  startX: number
  startPhase: number
  rotate: boolean
  moved: boolean
  basePose: MotionDoc['pose']
  baseTransform: MotionDoc['transform']
  baseOverride: CardOverride
  /** How far this drag has gone so far, in scene units and degrees. */
  acc: { x: number; y: number; z: number; rx: number; ry: number }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** Keep a tilt in -180…180 so the slider that also edits it stays in range. */
function clampAngle(v: number): number {
  return clamp(v, -180, 180)
}
