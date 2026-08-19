import { useEffect, useMemo, useRef, useState } from 'react'
import {
  generateMotionCss,
  defaultKeyframes,
  EASING_PRESETS,
  isHold,
  type MotionSpec,
  type MotionKeyframe,
} from '../lib/motionCss'

type Playback = 'once' | 'loop' | 'pingpong'
type Frame = { x: number; y: number; scale: number; rotate: number; opacity: number }
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

// ── Easing parsing: CSS timing function → control points + 0..1 fn ─────────────
const NAMED: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
}
function bezierPts(easing: string): [number, number, number, number] {
  const m = easing.match(/cubic-bezier\(([^)]+)\)/)
  if (m) {
    const p = m[1].split(',').map((n) => parseFloat(n.trim()))
    if (p.length === 4 && p.every((n) => Number.isFinite(n))) return [p[0], p[1], p[2], p[3]]
  }
  return NAMED[easing] ?? NAMED.linear
}
function easingFn(easing: string): (t: number) => number {
  const [x1, y1, x2, y2] = bezierPts(easing)
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number): number => ((ay * t + by) * t + cy) * t
  const dX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx
  return (x: number): number => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 6; i++) {
      const d = dX(t) || 1e-6
      t -= (sampleX(t) - x) / d
    }
    return sampleY(t)
  }
}
function segEase(kf: MotionKeyframe | undefined, fallback: string): (t: number) => number {
  const e = kf?.easing ?? fallback
  if (isHold(e)) return () => 1
  return easingFn(e)
}

function sample(spec: MotionSpec, pct: number): Frame {
  const sorted = [...spec.keyframes].sort((a, b) => a.t - b.t)
  if (!sorted.length) return { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }
  if (pct <= sorted[0].t) return sorted[0]
  const last = sorted[sorted.length - 1]
  if (pct >= last.t) return last
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1]
    if (pct >= a.t && pct <= b.t) {
      const f = segEase(a, spec.easing)((pct - a.t) / ((b.t - a.t) || 1))
      return {
        x: a.x + (b.x - a.x) * f,
        y: a.y + (b.y - a.y) * f,
        scale: a.scale + (b.scale - a.scale) * f,
        rotate: a.rotate + (b.rotate - a.rotate) * f,
        opacity: a.opacity + (b.opacity - a.opacity) * f,
      }
    }
  }
  return last
}

// ── Visual cubic-bézier curve editor ───────────────────────────────────────────
const SIZE = 132 // graph px (square, the 0..1 unit region)
const Y_MIN = -0.6
const Y_MAX = 1.6
function EasingCurveEditor({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  const hold = isHold(value)
  const [x1, y1, x2, y2] = bezierPts(value)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<1 | 2 | null>(null)
  const gx = (x: number): number => x * SIZE
  const gy = (y: number): number => ((Y_MAX - y) / (Y_MAX - Y_MIN)) * SIZE
  const fromPx = (px: number, py: number): { x: number; y: number } => ({
    x: clamp(px / SIZE, 0, 1),
    y: Y_MAX - (py / SIZE) * (Y_MAX - Y_MIN),
  })
  // sample the cubic path
  const path = useMemo(() => {
    const pts: string[] = []
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      const mt = 1 - t
      const bxv = 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t
      const byv = 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t
      pts.push(`${i === 0 ? 'M' : 'L'}${gx(bxv).toFixed(1)},${gy(byv).toFixed(1)}`)
    }
    return pts.join(' ')
  }, [x1, y1, x2, y2])

  useEffect(() => {
    const move = (e: PointerEvent): void => {
      const which = dragRef.current
      if (!which || !svgRef.current) return
      const r = svgRef.current.getBoundingClientRect()
      const { x, y } = fromPx(e.clientX - r.left, e.clientY - r.top)
      const nx = +x.toFixed(3), ny = +clamp(y, Y_MIN, Y_MAX).toFixed(3)
      const next: [number, number, number, number] = which === 1 ? [nx, ny, x2, y2] : [x1, y1, nx, ny]
      onChange(`cubic-bezier(${next.join(',')})`)
    }
    const up = (): void => { dragRef.current = null }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [x1, y1, x2, y2, onChange])

  return (
    <svg ref={svgRef} width={SIZE} height={SIZE} className="touch-none select-none rounded bg-bg/50" style={{ overflow: 'visible' }}>
      {/* unit (0..1) region */}
      <rect x={0} y={gy(1)} width={SIZE} height={gy(0) - gy(1)} fill="none" stroke="currentColor" strokeOpacity={0.12} />
      {/* diagonal reference (linear) */}
      <line x1={gx(0)} y1={gy(0)} x2={gx(1)} y2={gy(1)} stroke="currentColor" strokeOpacity={0.18} strokeDasharray="3 3" />
      {hold ? (
        <polyline points={`${gx(0)},${gy(0)} ${gx(0)},${gy(1)} ${gx(1)},${gy(1)}`} fill="none" stroke="rgb(var(--accent,34 197 94))" strokeWidth={2} />
      ) : (
        <>
          {/* handle leashes */}
          <line x1={gx(0)} y1={gy(0)} x2={gx(x1)} y2={gy(y1)} stroke="rgb(var(--accent,34 197 94))" strokeOpacity={0.5} />
          <line x1={gx(1)} y1={gy(1)} x2={gx(x2)} y2={gy(y2)} stroke="rgb(var(--accent,34 197 94))" strokeOpacity={0.5} />
          <path d={path} fill="none" stroke="rgb(var(--accent,34 197 94))" strokeWidth={2} />
          {/* endpoints */}
          <circle cx={gx(0)} cy={gy(0)} r={3} fill="currentColor" opacity={0.5} />
          <circle cx={gx(1)} cy={gy(1)} r={3} fill="currentColor" opacity={0.5} />
          {/* draggable control handles */}
          <circle cx={gx(x1)} cy={gy(y1)} r={6} fill="rgb(var(--accent,34 197 94))" className="cursor-grab" onPointerDown={(e) => { e.stopPropagation(); dragRef.current = 1 }} />
          <circle cx={gx(x2)} cy={gy(y2)} r={6} fill="rgb(var(--accent,34 197 94))" className="cursor-grab" onPointerDown={(e) => { e.stopPropagation(); dragRef.current = 2 }} />
        </>
      )}
    </svg>
  )
}

export function MotionTimeline({ selector, initial, getDoc, onApply, onClose }: {
  selector: string
  initial?: MotionSpec | null
  getDoc: () => Document | null
  onApply: (spec: MotionSpec) => void
  onClose: () => void
}): JSX.Element {
  const [spec, setSpec] = useState<MotionSpec>(
    () => initial ?? { name: 't42motion', duration: 2000, easing: 'cubic-bezier(0.22,1,0.36,1)', keyframes: defaultKeyframes() },
  )
  const [time, setTime] = useState(0)
  const [selKf, setSelKf] = useState<string | null>(spec.keyframes[0]?.id ?? null)
  const [playing, setPlaying] = useState(false)
  const [playback, setPlayback] = useState<Playback>('loop')
  const [unitMs, setUnitMs] = useState(true)
  const rafRef = useRef<number | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragKfRef = useRef<string | null>(null)

  const duration = spec.duration
  const sorted = useMemo(() => [...spec.keyframes].sort((a, b) => a.t - b.t), [spec.keyframes])

  const el = (): HTMLElement | null => {
    try { return (getDoc()?.querySelector(selector) as HTMLElement | null) ?? null } catch { return null }
  }
  const applyFrame = (ms: number): void => {
    const node = el(); if (!node) return
    const pct = duration > 0 ? (ms / duration) * 100 : 0
    const v = sample(spec, pct)
    node.style.transform = `translate3d(${v.x.toFixed(1)}px, ${v.y.toFixed(1)}px, 0) scale(${v.scale.toFixed(3)}) rotate(${v.rotate.toFixed(1)}deg)`
    node.style.opacity = String(clamp(v.opacity, 0, 1))
  }
  const clearInline = (): void => {
    const node = el(); if (node) { node.style.transform = ''; node.style.opacity = '' }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!playing) applyFrame(time) }, [time, spec])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); clearInline() }, [])

  const stop = (): void => {
    setPlaying(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }
  const play = (): void => {
    if (playing) { stop(); return }
    setPlaying(true)
    const start = performance.now()
    const loop = (now: number): void => {
      const elapsed = now - start
      let t = elapsed
      if (playback === 'once') {
        if (elapsed >= duration) { setTime(duration); applyFrame(duration); stop(); return }
      } else if (playback === 'loop') {
        t = elapsed % (duration || 1)
      } else {
        const cycle = (duration || 1) * 2
        const m = elapsed % cycle
        t = m <= duration ? m : cycle - m
      }
      setTime(t)
      applyFrame(t)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }

  const selectedKf = spec.keyframes.find((k) => k.id === selKf) ?? null
  const selIdx = selectedKf ? sorted.findIndex((k) => k.id === selectedKf.id) : -1
  const isLastKf = selIdx === sorted.length - 1
  const segEasing = selectedKf?.easing ?? spec.easing

  const patchKf = (id: string, patch: Partial<MotionKeyframe>): void =>
    setSpec((s) => ({ ...s, keyframes: s.keyframes.map((k) => (k.id === id ? { ...k, ...patch } : k)) }))
  const setSegEasing = (v: string): void => {
    if (!selectedKf) return
    if (isLastKf) return
    patchKf(selectedKf.id, { easing: v })
  }
  const addKf = (): void => {
    const pct = duration > 0 ? Math.round((time / duration) * 100) : 50
    const v = sample(spec, pct)
    const id = `k${Date.now()}`
    setSpec((s) => ({
      ...s,
      keyframes: [...s.keyframes, { id, t: pct, x: Math.round(v.x), y: Math.round(v.y), scale: +v.scale.toFixed(2), rotate: Math.round(v.rotate), opacity: +v.opacity.toFixed(2), easing: s.easing }],
    }))
    setSelKf(id)
  }
  const deleteKf = (id: string): void =>
    setSpec((s) => (s.keyframes.length <= 2 ? s : { ...s, keyframes: s.keyframes.filter((k) => k.id !== id) }))

  const seekFromX = (clientX: number): void => {
    const track = trackRef.current; if (!track) return
    const r = track.getBoundingClientRect()
    const f = clamp((clientX - r.left) / r.width, 0, 1)
    if (dragKfRef.current) patchKf(dragKfRef.current, { t: Math.round(f * 100) })
    else setTime(Math.round(f * duration))
  }
  useEffect(() => {
    const move = (e: MouseEvent): void => { if (dragKfRef.current) seekFromX(e.clientX) }
    const up = (): void => { dragKfRef.current = null }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    // eslint-disable-next-line
  }, [duration])

  const fmt = (ms: number): string => (unitMs ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`)
  const css = generateMotionCss(selector, spec, { playback })
  const copyCss = (): void => { try { void navigator.clipboard.writeText(css) } catch { /* ignore */ } }

  const presetId = EASING_PRESETS.find((p) => p.value === segEasing)?.id ?? 'custom'

  const numInput = (label: string, val: number, step: number, on: (n: number) => void): JSX.Element => (
    <label className="flex items-center gap-1 text-[11px] text-text-muted">
      <span className="w-8 text-right">{label}</span>
      <input
        type="number" value={val} step={step}
        onChange={(e) => on(parseFloat(e.target.value) || 0)}
        className="w-14 rounded bg-bg/60 px-1.5 py-1 text-[11.5px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40"
      />
    </label>
  )

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 flex h-[268px] flex-col bg-elevated/95 backdrop-blur-sm">
      {/* Control bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 text-[11.5px] text-text-secondary">
        <button type="button" onClick={play} title={playing ? 'Pause' : 'Play'} className="grid h-7 w-7 place-items-center rounded-md bg-accent text-accent-text hover:opacity-90">
          {playing
            ? <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1.5" width="3" height="9" rx="1" /><rect x="7" y="1.5" width="3" height="9" rx="1" /></svg>
            : <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor"><path d="M3 1.5l7 4.5-7 4.5z" /></svg>}
        </button>
        <span className="tabular-nums text-text-primary">{fmt(time)}</span>
        <span className="text-text-muted">/</span>
        <label className="flex items-center gap-1">
          <span className="text-text-muted">Duration</span>
          <input type="number" value={duration} step={100} min={100}
            onChange={(e) => setSpec((s) => ({ ...s, duration: Math.max(100, parseInt(e.target.value) || 100) }))}
            className="w-20 rounded bg-bg/60 px-1.5 py-1 text-[11.5px] text-text-primary focus:outline-none" />
          <span className="text-text-muted">ms</span>
        </label>
        <button type="button" onClick={() => setUnitMs((u) => !u)} className="rounded px-1.5 py-0.5 hover:bg-bg/60" title="Toggle time unit">{unitMs ? 'ms' : 's'}</button>
        <button type="button" onClick={() => setPlayback((p) => (p === 'loop' ? 'once' : p === 'once' ? 'pingpong' : 'loop'))} className="rounded px-2 py-0.5 capitalize hover:bg-bg/60" title="Playback mode">{playback}</button>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={copyCss} className="rounded-md px-2 py-1 hover:bg-bg/60" title="Copy the animation as CSS">Copy CSS</button>
          <button type="button" onClick={() => onApply(spec)} className="rounded-md bg-accent px-2.5 py-1 font-medium text-accent-text hover:opacity-90" title="Bake this animation into the design">Apply to design</button>
          <button type="button" onClick={() => { clearInline(); onClose() }} className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-bg/60 hover:text-text-primary" title="Close">
            <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
          </button>
        </div>
      </div>

      {/* Track + ruler */}
      <div className="px-3">
        <div className="mb-1 truncate text-[10.5px] text-text-muted">{selector}</div>
        <div
          ref={trackRef}
          onMouseDown={(e) => { if (!dragKfRef.current) { const r = trackRef.current!.getBoundingClientRect(); setTime(Math.round(clamp((e.clientX - r.left) / r.width, 0, 1) * duration)) } }}
          className="relative h-12 cursor-pointer rounded-md bg-bg/50"
        >
          {/* segments between keyframes (click to select that segment's easing) */}
          {sorted.slice(0, -1).map((k, i) => {
            const next = sorted[i + 1]
            const selectedSeg = selectedKf?.id === k.id
            return (
              <button
                key={`seg-${k.id}`}
                type="button"
                title={`Easing: ${k.easing ?? spec.easing}`}
                onClick={(e) => { e.stopPropagation(); setSelKf(k.id) }}
                style={{ left: `${k.t}%`, width: `${Math.max(0, next.t - k.t)}%` }}
                className="absolute top-1/2 z-0 h-3 -translate-y-1/2"
              >
                <span className={['block h-[3px] w-full translate-y-[5px] rounded-full', selectedSeg ? 'bg-accent' : 'bg-text-muted/30'].join(' ')} />
              </button>
            )
          })}
          {/* keyframes */}
          {sorted.map((k) => (
            <button
              key={k.id}
              type="button"
              onMouseDown={(e) => { e.stopPropagation(); dragKfRef.current = k.id; setSelKf(k.id) }}
              onClick={(e) => { e.stopPropagation(); setSelKf(k.id) }}
              title={`${Math.round((k.t / 100) * duration)}ms`}
              style={{ left: `${k.t}%` }}
              className="absolute top-1/2 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border"
            >
              <span className={['block h-full w-full rounded-[2px] border', selKf === k.id ? 'border-accent bg-accent' : 'bg-elevated'].join(' ')} />
            </button>
          ))}
          {/* playhead */}
          <div className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-accent" style={{ left: `${duration > 0 ? (time / duration) * 100 : 0}%` }}>
            <div className="absolute -left-1 -top-0.5 h-2 w-2 rounded-full bg-accent" />
          </div>
        </div>
      </div>

      {/* Keyframe props + easing editor */}
      <div className="mt-2 flex flex-1 gap-4 overflow-hidden px-3 pb-3">
        {/* left: keyframe values */}
        <div className="flex w-[300px] shrink-0 flex-col gap-2">
          {selectedKf ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-muted">Keyframe @ {Math.round((selectedKf.t / 100) * duration)}ms</span>
                <button type="button" onClick={() => deleteKf(selectedKf.id)} disabled={spec.keyframes.length <= 2} className="rounded px-2 py-0.5 text-[11px] text-text-muted hover:bg-bg/60 hover:text-error disabled:opacity-30">Delete</button>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {numInput('Time%', selectedKf.t, 1, (n) => patchKf(selectedKf.id, { t: clamp(n, 0, 100) }))}
                {numInput('Opacity', selectedKf.opacity, 0.05, (n) => patchKf(selectedKf.id, { opacity: clamp(n, 0, 1) }))}
                {numInput('X', selectedKf.x, 1, (n) => patchKf(selectedKf.id, { x: n }))}
                {numInput('Y', selectedKf.y, 1, (n) => patchKf(selectedKf.id, { y: n }))}
                {numInput('Scale', selectedKf.scale, 0.05, (n) => patchKf(selectedKf.id, { scale: n }))}
                {numInput('Rotate', selectedKf.rotate, 1, (n) => patchKf(selectedKf.id, { rotate: n }))}
              </div>
              <button type="button" onClick={addKf} className="mt-auto w-full rounded-md bg-bg/60 px-2.5 py-1.5 text-[11px] text-text-primary hover:bg-bg" title="Add a keyframe at the playhead">+ Keyframe at playhead</button>
            </>
          ) : (
            <span className="text-[11px] text-text-muted">Select a keyframe to edit its values</span>
          )}
        </div>

        {/* right: easing curve editor for the selected segment */}
        <div className="flex flex-1 items-start gap-3">
          <EasingCurveEditor value={segEasing} onChange={setSegEasing} />
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] text-text-muted">{isLastKf ? 'Final keyframe (no outgoing segment)' : `Segment easing → keyframe ${selIdx + 2}`}</span>
            <select
              value={presetId === 'custom' ? 'custom' : segEasing}
              disabled={isLastKf}
              onChange={(e) => { if (e.target.value !== 'custom') setSegEasing(e.target.value) }}
              className="rounded bg-bg/60 px-1.5 py-1 text-[11.5px] text-text-primary focus:outline-none disabled:opacity-40"
            >
              {EASING_PRESETS.map((p) => <option key={p.id} value={p.value}>{p.label}</option>)}
              <option value="custom">Custom bezier</option>
            </select>
            <label className="flex items-center gap-1 text-[11px] text-text-muted">
              <span>cubic-bezier</span>
            </label>
            <input
              type="text" value={segEasing} disabled={isLastKf || isHold(segEasing)}
              onChange={(e) => setSegEasing(e.target.value)}
              className="w-[180px] rounded bg-bg/60 px-1.5 py-1 font-mono text-[10.5px] text-text-primary focus:outline-none disabled:opacity-40"
            />
            <span className="text-[10px] leading-snug text-text-muted">Drag the two handles. Pull a handle above the box to overshoot (back/bounce).</span>
          </div>
        </div>
      </div>
    </div>
  )
}
