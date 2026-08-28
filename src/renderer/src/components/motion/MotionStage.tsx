// The frame: backdrop, WebGL canvas, and the clock that drives them.
//
// Two stacked canvases rather than one. The backdrop is 2D and the piece is
// WebGL, and keeping them apart means the exporter can composite exactly what
// is on screen, in the same order, using the same drawing code — including
// the case where the user wants the piece exported without the grid they were
// working against.

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import type { CardOverride, MotionDoc } from '../../../../shared/motion/types'
import {
  cardCountFor, emptyOverride, hasEffectKeys, hasLayerKeys, layerVisibility,
  resolvedEffects, resolvedLogoLayers, resolvedPictureLayers, resolvedShapeLayers, resolvedTextLayers
} from '../../../../shared/motion/frame'
import { placementsAt, totalDuration } from '../../../../shared/motion/entrance'
import type { FrameFit } from './FrameToolbar'
import { MotionEngine } from '../../lib/motion/engine'
import {
  drawBackdrop, drawLogos, drawOverlay, drawPictures, drawShapes, FRAME_ASPECT_RATIO
} from '../../lib/motion/backdrop'
import { beforeCardsFilter, drawEffects } from '../../lib/motion/effects'
import { composeFrame, releaseComposeScratch } from '../../lib/motion/compose'
import { needsPixelPass, releaseFxScratches } from '../../lib/motion/frameFx'
import { ensureTextFonts } from '../../lib/motion/fonts'
import { boxFor, drawPickOutline, pickOverlay, samePick, type Pick } from '../../lib/motion/overlayPick'

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
  /** What the user is working on: a card, a text layer, a logo, or nothing. */
  selected: Pick | null
  onSelect: (pick: Pick | null) => void
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
  // Only used when an effect needs the pixels rather than the numbers. The
  // three stacked canvases below cannot express "blur what is underneath
  // you", because in the DOM nothing can reach the layer it is sitting on.
  const fxRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<MotionEngine | null>(null)
  const docRef = useRef(doc)
  const phaseRef = useRef(phase)
  const playingRef = useRef(playing)
  const exportingRef = useRef(exporting)
  const [error, setError] = useState<string | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  /** Bumped when the engine finishes booting, so sizing can run again. */
  const [ready, setReady] = useState(0)
  /** Bumped when a webfont the type asks for has finished loading. */
  const [fontTick, setFontTick] = useState(0)
  // Whether the pixel pass is currently drawing. Held as a ref for the render
  // loop and as state for the one style that depends on it.
  const [fxLive, setFxLive] = useState(false)
  const fxLiveRef = useRef(false)
  // Type and logos sit on a layer redrawn only when the document changes,
  // which was true until a layer could come and go over the loop. Rather than
  // give that up and pay for grain every frame, the loop watches for the
  // moment a layer's visibility actually changes and asks for one redraw.
  const [visTick, setVisTick] = useState(0)
  // The marquee is drawn on a canvas, which cannot read a CSS variable, so the
  // accent is fetched once and kept. A ref rather than state because nothing
  // should re-render when the theme changes; the next paint simply uses it.
  const accentRef = useRef('rgb(14 165 233)')
  useEffect(() => {
    const read = (): void => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
      if (v) accentRef.current = `rgb(${v})`
    }
    read()
    const mo = new MutationObserver(read)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => mo.disconnect()
  }, [])
  const visRef = useRef('')
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
      if (!gl) return null
      const ratio = FRAME_ASPECT_RATIO[doc.frame.aspect] ?? 16 / 9
      const w = Math.round(maxWidth)
      const h = Math.round(maxWidth / ratio)
      const out = document.createElement('canvas')
      out.width = w
      out.height = h
      const ctx = out.getContext('2d')
      if (!ctx) return null
      composeFrame(ctx, doc, gl, w, h, { showGrid: doc.frame.gridVisible, images, phase: phaseRef.current })
      return out.toDataURL('image/jpeg', 0.7)
    }
  }), [doc.frame, doc.visual.text, doc.visual.logos, doc.visual.effects, images, size])

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
        // three.js arrives after the first layout has already been measured,
        // so the sizing effect has run and quietly done nothing. Announcing
        // the engine makes it run again — without this the renderer keeps its
        // default 300x150 buffer and every card is a soft upscale of it.
        setReady((n) => n + 1)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String((e as Error)?.message ?? e))
      })
    return () => {
      cancelled = true
      engineRef.current?.dispose()
      engineRef.current = null
      releaseComposeScratch()
      releaseFxScratches()
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
      if (ctx) {
        drawBackdrop(ctx, doc.frame, back.width, back.height)
        // Scenery goes on the backdrop, below the WebGL canvas, because a
        // block of colour is the thing cards and type sit on. Drawn on the
        // overlay it would cover the very things it was put there to back.
        const bp = phaseRef.current
        drawShapes(ctx, resolvedShapeLayers(doc, bp), back.width, back.height, bp)
        drawPictures(ctx, resolvedPictureLayers(doc, bp), images, back.width, back.height, bp)
      }
    }
    const fx = fxRef.current
    if (fx && size.width > 0) {
      fx.width = Math.round(size.width * dpr)
      fx.height = Math.round(size.height * dpr)
    }
    const over = overRef.current
    if (over && size.width > 0) {
      over.width = Math.round(size.width * dpr)
      over.height = Math.round(size.height * dpr)
      const ctx = over.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, over.width, over.height)
        const p = phaseRef.current
        drawEffects(ctx, resolvedEffects(doc, p), over.width, over.height)
        drawLogos(ctx, resolvedLogoLayers(doc, p), images, over.width, over.height, p)
        drawOverlay(ctx, resolvedTextLayers(doc, p), over.width, over.height, p)
        // The marquee is painted here rather than in the DOM because the layer
        // it surrounds is canvas: an HTML box over the top would need the same
        // measurements anyway, and would lag the frame by a render.
        const box = boxFor(ctx, doc, images, over.width, over.height, p, selected)
        if (box) drawPickOutline(ctx, box, accentRef.current)
      }
    }
  }, [size, ready, fontTick, visTick, selected, doc.frame, doc.visual.text, doc.visual.logos,
      doc.visual.shapes, doc.visual.pictures, doc.visual.effects, images])

  // A webfont arrives after the frame it was first asked for has been painted,
  // and a canvas does not re-render itself the way the DOM does. Bumping this
  // once the faces are ready repaints the overlay with the real type instead of
  // leaving the fallback that was drawn while it loaded.
  useEffect(() => {
    let alive = true
    void ensureTextFonts(doc.visual.text).then(() => {
      if (alive) setFontTick((n) => n + 1)
    })
    return () => {
      alive = false
    }
  }, [doc.visual.text])

  useEffect(() => {
    engineRef.current?.setImages(images)
  }, [images])

  useEffect(() => {
    engineRef.current?.setSelected(selected?.kind === 'card' ? selected.index : null)
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

  /** Where the pointer is on the overlay canvas, in its own pixels. */
  const overlayPoint = (
    e: { clientX: number; clientY: number }, el: HTMLElement
  ): { x: number; y: number; ctx: CanvasRenderingContext2D } | null => {
    const over = overRef.current
    const ctx = over?.getContext('2d')
    if (!over || !ctx) return null
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return null
    return { x: ((e.clientX - r.left) / r.width) * over.width, y: ((e.clientY - r.top) / r.height) * over.height, ctx }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const engine = engineRef.current
    if (!engine) return
    const at = ndc(e, e.currentTarget)
    // Flat layers are asked first. They are painted over everything else, so
    // the thing the user can see at that point is the thing they mean; a card
    // behind a caption is still reachable by clicking anywhere else on it.
    const over = overlayPoint(e, e.currentTarget)
    const flat = !poseRef.current && over && !e.shiftKey && !e.metaKey && !e.ctrlKey
      ? pickOverlay(over.ctx, docRef.current, images, over.ctx.canvas.width, over.ctx.canvas.height, phaseRef.current, over.x, over.y)
      : null
    if (flat) {
      const d0 = docRef.current
      const src = flat.kind === 'text' ? d0.visual.text.find((l) => l.id === flat.id)
        : flat.kind === 'logo' ? d0.visual.logos.find((l) => l.id === flat.id)
        : flat.kind === 'shape' ? (d0.visual.shapes ?? []).find((l) => l.id === flat.id)
        : flat.kind === 'picture' ? (d0.visual.pictures ?? []).find((l) => l.id === flat.id)
        : undefined
      if (src) {
        dragRef.current = {
          mode: 'layer',
          index: null,
          layer: { pick: flat, x: src.x, y: src.y },
          from: at,
          last: at,
          startX: e.clientX,
          startPhase: phaseRef.current,
          rotate: false,
          moved: false,
          basePose: { ...d0.pose },
          baseTransform: { ...d0.transform },
          baseOverride: emptyOverride(),
          acc: { x: 0, y: 0, z: 0, rx: 0, ry: 0 }
        }
        if (!samePick(selected, flat)) onSelect(flat)
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* still draggable */ }
        setHint(flat.kind === 'text' ? 'Moving this text' : 'Moving this logo')
        return
      }
    }
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
    if (mode === 'card' && hit !== null) onSelect({ kind: 'card', index: hit })
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

    if (drag.mode === 'layer' && drag.layer) {
      // Moved in the frame's own percentages rather than in pixels, so a layer
      // dragged on a small preview lands in the same place in a 4K export.
      const dx = ((at[0] - drag.from[0]) / 2) * 100
      const dy = (-(at[1] - drag.from[1]) / 2) * 100
      const x = clamp(drag.layer.x + dx, -20, 120)
      const y = clamp(drag.layer.y + dy, -20, 120)
      const pick = drag.layer.pick
      if (pick.kind === 'text') {
        onPatch({ visual: { ...d.visual, text: d.visual.text.map((l) => (l.id === pick.id ? { ...l, x, y } : l)) } })
      } else if (pick.kind === 'logo') {
        onPatch({ visual: { ...d.visual, logos: d.visual.logos.map((l) => (l.id === pick.id ? { ...l, x, y } : l)) } })
      } else if (pick.kind === 'shape') {
        onPatch({ visual: { ...d.visual, shapes: (d.visual.shapes ?? []).map((l) => (l.id === pick.id ? { ...l, x, y } : l)) } })
      } else if (pick.kind === 'picture') {
        onPatch({ visual: { ...d.visual, pictures: (d.visual.pictures ?? []).map((l) => (l.id === pick.id ? { ...l, x, y } : l)) } })
      }
    } else if (drag.mode === 'scrub') {
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
    if (drag && !drag.moved && drag.mode !== 'scrub' && drag.mode !== 'layer' && drag.index === null) onSelect(null)
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

      // The pixel pass is opaque and covers the backdrop and the cards, so
      // turning it off is a matter of not drawing it: the layers underneath
      // are still there, still correct, and cost nothing extra.
      const fxCanvas = fxRef.current
      const gl = glRef.current
      const wants = needsPixelPass(d.visual.effects)
      if (fxCanvas && gl && fxCanvas.width > 0) {
        const fctx = fxCanvas.getContext('2d')
        if (fctx) {
          if (wants) {
            composeFrame(fctx, d, gl, fxCanvas.width, fxCanvas.height, {
              showGrid: d.frame.gridVisible,
              // Grain, logos and type live on the static layer above, which
              // is redrawn only when the document changes. Reading back every
              // pixel for a texture that never moves would cost more each
              // frame than everything else here together.
              skipStatic: true,
              phase: phaseRef.current
            })
          } else if (fxLiveRef.current) {
            fctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height)
          }
        }
      }
      if (fxLiveRef.current !== wants) {
        fxLiveRef.current = wants
        setFxLive(wants)
      }

      // A keyed effect changes the cheap path's filter, which lives in the
      // markup and so would otherwise hold still for the whole loop.
      if (gl && hasEffectKeys(d)) {
        gl.style.filter = beforeCardsFilter(resolvedEffects(d, phaseRef.current), gl.clientHeight || 1080)
      }

      const vis = staticSignature(d, phaseRef.current)
      if (vis !== visRef.current) {
        visRef.current = vis
        setVisTick((n) => n + 1)
      }
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
          style={{ filter: beforeCardsFilter(doc.visual.effects, size.height || 1080) }}
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
        <canvas
          ref={fxRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ display: fxLive ? 'block' : 'none' }}
          aria-hidden="true"
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
  mode: 'orbit' | 'card' | 'scrub' | 'scale' | 'move' | 'layer'
  index: number | null
  /** The flat layer being dragged, and where it started, in percentages. */
  layer?: { pick: Pick; x: number; y: number }
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

/**
 * Which layers are on screen right now, as a string that changes when that
 * changes and not otherwise.
 *
 * Rounded, because a fade is a continuous number and comparing it exactly
 * would mean a redraw on every frame of every fade — which is the cost this
 * exists to avoid. Two decimal places is finer than the eye reads on an
 * opacity ramp and coarse enough to hold still.
 */
function staticSignature(doc: MotionDoc, phase: number): string {
  let out = ''
  for (const t of doc.visual.text) {
    if (t.from === undefined && t.to === undefined) continue
    out += `t${t.id}:${layerVisibility(t, phase).toFixed(2)};`
  }
  for (const l of doc.visual.logos) {
    if (l.from === undefined && l.to === undefined) continue
    out += `l${l.id}:${layerVisibility(l, phase).toFixed(2)};`
  }
  // Shapes and pictures live on the backdrop, which is redrawn from this
  // signature too. A shape whose width is keyed changes every frame, so its
  // whole geometry goes in rather than only its visibility.
  for (const sh of resolvedShapeLayers(doc, phase)) {
    out += `s${sh.id}:${layerVisibility(sh, phase).toFixed(2)},${sh.width.toFixed(2)},${sh.height.toFixed(2)},${sh.x.toFixed(2)},${sh.y.toFixed(2)},${sh.opacity.toFixed(1)},${sh.rotation.toFixed(1)};`
  }
  for (const pic of resolvedPictureLayers(doc, phase)) {
    out += `p${pic.id}:${layerVisibility(pic, phase).toFixed(2)},${pic.width.toFixed(2)},${pic.height.toFixed(2)},${pic.x.toFixed(2)},${pic.y.toFixed(2)},${pic.opacity.toFixed(1)},${pic.rotation.toFixed(1)};`
  }
  // Keyed type, marks and grain live on the same rarely-drawn layer, so the
  // signature has to speak for them too or a keyed heading would sit still.
  if (hasLayerKeys(doc)) {
    for (const t of resolvedTextLayers(doc, phase)) {
      out += `T${t.id}:${t.size.toFixed(2)},${t.x.toFixed(2)},${t.y.toFixed(2)},${(t.opacity ?? 100).toFixed(1)},${(t.tracking ?? 0).toFixed(1)};`
    }
    for (const l of resolvedLogoLayers(doc, phase)) {
      out += `L${l.id}:${l.size.toFixed(2)},${l.x.toFixed(2)},${l.y.toFixed(2)},${l.opacity.toFixed(1)};`
    }
  }
  if (hasEffectKeys(doc)) {
    const fx = resolvedEffects(doc, phase)
    out += `F${fx.grain.toFixed(1)},${fx.vignette.toFixed(1)},${fx.shadow.toFixed(1)},${fx.tintAmount.toFixed(1)};`
  }
  return out
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** Keep a tilt in -180…180 so the slider that also edits it stays in range. */
function clampAngle(v: number): number {
  return clamp(v, -180, 180)
}
