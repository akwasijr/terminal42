import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { EasingCurveEditor } from './EasingCurveEditor'
import { bezierPts, isHold, isSpring, easingLabel } from '../lib/easing'
import { ANIMATION_PRESETS, PRESET_GROUPS } from '../lib/animationPresets'
import { type FObj } from '../lib/freeformTypes'
import { timelineKeyframeSel } from '../lib/timelineSelection'
import {
  type LayerMotion,
  type LayerState,
  type PropName,
  PROP_ORDER,
  PROP_META,
  baseState,
  sampleTrack,
  styleAt,
  setKey,
  removeKey,
  emptyMotion,
  hasAnyKeys,
} from '../lib/timelineModel'

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
type Playback = 'once' | 'loop' | 'pingpong'
// "Recording" accent shown across the timeline while auto-keyframe is on.
const REC = '#f9603f'

const baseFor = (o: FObj): LayerState =>
  baseState({ opacity: o.opacity, rotate: o.rotation, blur: o.blur ?? 0, brightness: o.brightness ?? 1, glow: o.glow ?? 0 })


const cubicText = (e: string): string => bezierPts(e).map((n) => +n.toFixed(2)).join(', ')
const parseCubic = (s: string): string | null => {
  const p = s.split(',').map((x) => parseFloat(x.trim()))
  return p.length === 4 && p.every((n) => Number.isFinite(n)) ? `cubic-bezier(${p.join(',')})` : null
}
// little S-curve glyph used on timeline segments to indicate (and edit) easing
function EaseGlyph({ active }: { active: boolean }): JSX.Element {
  return (
    <span className={['grid h-3.5 w-3.5 place-items-center rounded-[3px] border', active ? 'border-accent bg-accent/20' : 'bg-elevated'].join(' ')}>
      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke={active ? 'rgb(var(--accent,34 197 94))' : 'currentColor'} strokeWidth="1.5"><path d="M1 11 C5 11, 7 1, 11 1" /></svg>
    </span>
  )
}

// ── Clip (duration-bar) helpers: the active keyframe range of a whole layer ──────
function clipRange(m: LayerMotion | undefined): { min: number; max: number } | null {
  if (!m) return null
  let min = Infinity, max = -Infinity
  for (const p of PROP_ORDER) for (const k of m.tracks[p] ?? []) { min = Math.min(min, k.t); max = Math.max(max, k.t) }
  if (min === Infinity) return null
  return { min, max }
}
function shiftMotion(m: LayerMotion, dt: number, duration: number): LayerMotion {
  const tracks: LayerMotion['tracks'] = {}
  for (const p of PROP_ORDER) { const ks = m.tracks[p]; if (ks) tracks[p] = ks.map((k) => ({ ...k, t: clamp(Math.round(k.t + dt), 0, duration) })).sort((a, b) => a.t - b.t) }
  return { ...m, tracks }
}
function scaleMotion(m: LayerMotion, oldMin: number, oldMax: number, newMin: number, newMax: number, duration: number): LayerMotion {
  const oldRange = Math.max(1, oldMax - oldMin)
  const newRange = Math.max(1, newMax - newMin)
  const tracks: LayerMotion['tracks'] = {}
  for (const p of PROP_ORDER) { const ks = m.tracks[p]; if (ks) tracks[p] = ks.map((k) => ({ ...k, t: clamp(Math.round(newMin + (k.t - oldMin) * (newRange / oldRange)), 0, duration) })).sort((a, b) => a.t - b.t) }
  return { ...m, tracks }
}

export function TimelinePanel({ objects, selIds, onSelect, setMotion, getDoc, onClose, time, setTime, duration, setDuration, autoKey, setAutoKey, onExportVideo }: {
  objects: FObj[]
  selIds: string[]
  onSelect: (id: string) => void
  setMotion: (id: string, m: LayerMotion) => void
  getDoc: () => Document | null
  onClose: () => void
  time: number
  setTime: (t: number) => void
  duration: number
  setDuration: (d: number) => void
  autoKey: boolean
  setAutoKey: (b: boolean) => void
  onExportVideo: () => void
}): JSX.Element {
  const [playing, setPlaying] = useState(false)
  const [playback, setPlayback] = useState<Playback>('loop')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(selIds.slice(0, 1)))
  const [sel, setSel] = useState<{ obj: string; prop: PropName; key: string } | null>(null)
  const [laneW, setLaneW] = useState(800)
  const [zoom, setZoom] = useState(1)
  const [panelH, setPanelH] = useState(() => Math.min(480, Math.max(360, Math.round(window.innerHeight * 0.52))))
  const [collapsed, setCollapsed] = useState(false)
  const rafRef = useRef<number | null>(null)
  const lanesRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ obj: string; prop: PropName; key: string } | null>(null)
  const clipDragRef = useRef<{ obj: string; mode: 'move' | 'trimL' | 'trimR'; min: number; max: number; m: LayerMotion } | null>(null)
  const scrubRef = useRef(false)

  // Drag the top edge to resize the timeline so the keyframe inspector (incl. the
  // spring sliders) always fits — never hidden below the window fold.
  const startResize = (e: React.MouseEvent): void => {
    e.preventDefault()
    const startY = e.clientY
    const startH = panelH
    const onMove = (ev: MouseEvent): void => {
      const next = clamp(startH + (startY - ev.clientY), 240, window.innerHeight - 140)
      setPanelH(next)
    }
    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Measure the visible time-axis width (scroll viewport minus the 220px label
  // gutter) so keyframes/ticks position correctly and zoom can scale from "fit".
  useEffect(() => {
    const el = viewRef.current
    if (!el) return
    const update = (): void => setLaneW(Math.max(200, (el.clientWidth || 1000) - 220))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // keep duration in sync across all motions
  useEffect(() => {
    for (const o of objects) if (o.motion && o.motion.duration !== duration) setMotion(o.id, { ...o.motion, duration })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration])

  // auto-expand the selected layer(s) so their tracks are visible
  useEffect(() => {
    if (selIds.length) setExpanded((s) => { const n = new Set(s); for (const id of selIds) n.add(id); return n })
  }, [selIds])

  const doc = getDoc()
  const nodeOf = (id: string): HTMLElement | null => {
    try { return (doc?.getElementById(id) as HTMLElement | null) ?? null } catch { return null }
  }
  // Accumulated translation a parented object inherits from its ancestors' motion
  // at time t (After Effects-style parent follow, translation only).
  const parentTranslate = (o: FObj, t: number): { x: number; y: number } => {
    const byId = new Map(objects.map((ob) => [ob.id, ob]))
    let px = 0, py = 0, cur = o.parent ? byId.get(o.parent) : undefined, guard = 0
    while (cur && guard++ < 64) {
      if (cur.motion) { px += sampleTrack(cur.motion.tracks.x, t, 0); py += sampleTrack(cur.motion.tracks.y, t, 0) }
      cur = cur.parent ? byId.get(cur.parent) : undefined
    }
    return { x: px, y: py }
  }
  const applyAll = (t: number): void => {
    for (const o of objects) {
      const node = nodeOf(o.id); if (!node) continue
      const pt = parentTranslate(o, t)
      const hasOwn = hasAnyKeys(o.motion)
      if (!hasOwn && pt.x === 0 && pt.y === 0) continue
      const lead = pt.x || pt.y ? `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px) ` : ''
      if (hasOwn) {
        const st = styleAt(o.motion!, t, baseFor(o), o.glowColor ?? '#22d3ee')
        node.style.transform = lead + st.transform
        node.style.opacity = String(st.opacity)
        node.style.filter = st.filter
      } else {
        node.style.transform = lead + (o.rotation ? `rotate(${o.rotation}deg)` : '')
      }
    }
  }
  const clearPreview = (): void => {
    for (const o of objects) {
      const node = nodeOf(o.id); if (!node) continue
      node.style.transform = o.rotation ? `rotate(${o.rotation}deg)` : ''
      node.style.opacity = ''
      node.style.filter = ''
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!playing) applyAll(time) }, [time, objects, playing])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => clearPreview(), [])

  const stop = (): void => { setPlaying(false); if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null }
  const play = (): void => {
    if (playing) { stop(); return }
    setPlaying(true)
    const start = performance.now()
    const loop = (now: number): void => {
      const e = now - start
      let t = e
      if (playback === 'once') { if (e >= duration) { setTime(duration); applyAll(duration); stop(); return } }
      else if (playback === 'loop') t = e % (duration || 1)
      else { const c = (duration || 1) * 2; const m = e % c; t = m <= duration ? m : c - m }
      setTime(t); applyAll(t)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }

  // Spacebar toggles play/pause while the timeline is open (After Effects style).
  // Ignored when typing in a field or on auto-repeat. The canvas suppresses its
  // own hold-space-to-pan while the timeline is open so the two don't clash.
  const playRef = useRef(play)
  playRef.current = play
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code !== 'Space' || e.repeat) return
      const n = e.target as HTMLElement | null
      if (n && (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable)) return
      e.preventDefault()
      playRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const trackW = Math.max(laneW, Math.round(laneW * zoom))
  const xFromT = (t: number): number => (t / (duration || 1)) * trackW
  const tFromClientX = (cx: number): number => {
    const r = lanesRef.current?.getBoundingClientRect()
    if (!r) return 0
    return clamp((cx - r.left) / Math.max(1, r.width), 0, 1) * duration
  }
  useEffect(() => {
    const move = (e: MouseEvent): void => {
      if (dragRef.current) {
        const { obj, prop, key } = dragRef.current
        const o = objects.find((x) => x.id === obj); if (!o?.motion) return
        const t = Math.round(tFromClientX(e.clientX))
        const k = o.motion.tracks[prop]?.find((x) => x.id === key); if (!k) return
        setMotion(obj, { ...o.motion, tracks: { ...o.motion.tracks, [prop]: o.motion.tracks[prop]!.map((x) => (x.id === key ? { ...x, t } : x)).sort((a, b) => a.t - b.t) } })
      } else if (clipDragRef.current) {
        const c = clipDragRef.current
        const t = clamp(Math.round(tFromClientX(e.clientX)), 0, duration)
        if (c.mode === 'move') {
          setMotion(c.obj, shiftMotion(c.m, t - Math.round((c.min + c.max) / 2), duration))
        } else if (c.mode === 'trimL') {
          const newMin = Math.min(t, c.max - 1)
          setMotion(c.obj, scaleMotion(c.m, c.min, c.max, newMin, c.max, duration))
        } else {
          const newMax = Math.max(t, c.min + 1)
          setMotion(c.obj, scaleMotion(c.m, c.min, c.max, c.min, newMax, duration))
        }
      } else if (scrubRef.current) {
        setTime(Math.round(tFromClientX(e.clientX)))
      }
    }
    const up = (): void => { dragRef.current = null; clipDragRef.current = null; scrubRef.current = false }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, duration, trackW])

  // ── keyframe ops ─────────────────────────────────────────────────────────────
  const motionOf = (o: FObj): LayerMotion => o.motion ?? emptyMotion(duration)
  const currentVal = (o: FObj, prop: PropName): number => {
    const m = o.motion
    const b = baseFor(o)
    if (m?.tracks[prop]?.length) return sampleTrack(m.tracks[prop], time, b[prop])
    return b[prop]
  }
  const addKeyAt = (o: FObj, prop: PropName, t = time, v?: number): void => {
    const m = motionOf(o)
    const value = v ?? currentVal(o, prop)
    const next = setKey({ ...m, duration }, prop, Math.round(t), value)
    setMotion(o.id, next)
    const justAdded = next.tracks[prop]!.find((k) => Math.abs(k.t - Math.round(t)) < 1)
    if (justAdded) setSel({ obj: o.id, prop, key: justAdded.id })
  }
  // Which properties are actually animated (have ≥1 keyframe) on a layer.
  const animatedProps = (o: FObj): PropName[] => PROP_ORDER.filter((p) => (o.motion?.tracks[p]?.length ?? 0) > 0)
  const isDisabled = (o: FObj, prop: PropName): boolean => !!o.motion?.disabled?.includes(prop)
  // Hide/disable a single property track (kept, but not applied to the preview/export).
  const toggleDisabled = (o: FObj, prop: PropName): void => {
    const m = motionOf(o)
    const set = new Set(m.disabled ?? [])
    if (set.has(prop)) set.delete(prop); else set.add(prop)
    setMotion(o.id, { ...m, disabled: [...set] })
  }
  const editKeyVal = (o: FObj, prop: PropName, key: string, v: number): void => {
    if (!o.motion) return
    setMotion(o.id, { ...o.motion, tracks: { ...o.motion.tracks, [prop]: o.motion.tracks[prop]!.map((k) => (k.id === key ? { ...k, v } : k)) } })
  }
  const editKeyEasing = (o: FObj, prop: PropName, key: string, easing: string): void => {
    if (!o.motion) return
    setMotion(o.id, { ...o.motion, tracks: { ...o.motion.tracks, [prop]: o.motion.tracks[prop]!.map((k) => (k.id === key ? { ...k, easing } : k)) } })
  }
  const delKey = (o: FObj, prop: PropName, key: string): void => {
    if (!o.motion) return
    setMotion(o.id, removeKey(o.motion, prop, key))
    setSel(null)
  }
  // Remove a whole property track (all of its keyframes).
  const delTrack = (o: FObj, prop: PropName): void => {
    if (!o.motion) return
    const tracks = { ...o.motion.tracks }
    delete tracks[prop]
    const disabled = (o.motion.disabled ?? []).filter((p) => p !== prop)
    setMotion(o.id, { ...o.motion, tracks, disabled })
    setSel(null)
  }

  const selObj = sel ? objects.find((o) => o.id === sel.obj) ?? null : null
  const sortedSelKeys = selObj && sel ? [...(selObj.motion?.tracks[sel.prop] ?? [])].sort((a, b) => a.t - b.t) : []
  const selKey = selObj?.motion?.tracks[sel!.prop]?.find((k) => k.id === sel!.key) ?? null
  const selIdx = selKey ? sortedSelKeys.findIndex((k) => k.id === selKey.id) : -1
  const isLastKey = selIdx === sortedSelKeys.length - 1
  // The key whose easing controls a segment near the selected key: outgoing if it
  // has one, otherwise the incoming segment (the previous key). So easing is always
  // editable when there are ≥2 keys.
  const easeKey = selKey ? (isLastKey ? sortedSelKeys[selIdx - 1] ?? null : selKey) : null
  const hasSegment = !!easeKey

  // Publish the selected keyframe so the canvas's global Delete/Backspace handler
  // removes the keyframe (not the object). Escape still deselects here.
  useEffect(() => {
    timelineKeyframeSel.current = sel && selObj
      ? { delete: () => delKey(selObj, sel.prop, sel.key), deselect: () => setSel(null) }
      : null
    return () => { timelineKeyframeSel.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, selObj])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'Escape' && sel) { setSel(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel])

  const fmtTime = (ms: number): string => `${(ms / 1000).toFixed(2)}s`
  const ticks = useMemo(() => {
    const out: number[] = []
    const stepMs = duration <= 2000 ? 250 : duration <= 6000 ? 500 : 1000
    for (let t = 0; t <= duration; t += stepMs) out.push(t)
    return out
  }, [duration])

  const layers = objects.slice().reverse() // top layer first

  const Diamond = ({ active, left, onDown, onClickKey, onContext }: { active: boolean; left: number; onDown: (e: React.MouseEvent) => void; onClickKey: (e: React.MouseEvent) => void; onContext: (e: React.MouseEvent) => void }): JSX.Element => (
    <button type="button" onMouseDown={onDown} onClick={onClickKey} onContextMenu={onContext} style={{ left }} className="absolute top-1/2 z-10 grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center" title="Drag to move · click to edit easing · right-click to delete">
      <span className={['block h-3 w-3 rotate-45 rounded-[2px] border', active ? 'bg-accent' : 'bg-text-secondary hover:bg-text-primary'].join(' ')} />
    </button>
  )

  const propRow = (o: FObj, prop: PropName): JSX.Element => {
    const meta = PROP_META[prop]
    const keys = [...(o.motion?.tracks[prop] ?? [])].sort((a, b) => a.t - b.t)
    const hasKeys = keys.length > 0
    const val = currentVal(o, prop)
    const prevKey = [...keys].reverse().find((k) => k.t < time - 1)
    const nextKey = keys.find((k) => k.t > time + 1)
    const off = isDisabled(o, prop)
    return (
      <div key={`${o.id}-${prop}`} className={['group flex h-6 items-center', off ? 'opacity-45' : ''].join(' ')}>
        <div className="sticky left-0 z-[6] flex w-[220px] shrink-0 items-center gap-0.5 bg-elevated pl-5 pr-2">
          <button type="button" title="Previous keyframe" disabled={!prevKey} onClick={() => prevKey && (setSel({ obj: o.id, prop, key: prevKey.id }), setTime(prevKey.t))} className="px-0.5 text-[12px] leading-none text-text-muted enabled:hover:text-text-primary disabled:opacity-25">‹</button>
          <button type="button" title={`Toggle keyframe for ${meta.label}`} onClick={() => addKeyAt(o, prop)} className={['grid h-3.5 w-3.5 place-items-center rounded-full', hasKeys ? 't42-dot-on text-accent' : 't42-dot-empty text-text-muted hover:text-text-primary'].join(' ')}>
            <span className="block h-1.5 w-1.5 rotate-45 rounded-[1px]" style={{ background: hasKeys ? 'rgb(var(--accent,34 197 94))' : 'transparent', border: hasKeys ? 'none' : '1px solid currentColor' }} />
          </button>
          <button type="button" title="Next keyframe" disabled={!nextKey} onClick={() => nextKey && (setSel({ obj: o.id, prop, key: nextKey.id }), setTime(nextKey.t))} className="px-0.5 text-[12px] leading-none text-text-muted enabled:hover:text-text-primary disabled:opacity-25">›</button>
          <span className="flex-1 truncate pl-0.5 text-[11px] text-text-secondary">{meta.label}</span>
          <input
            type="number" value={Math.round(val * 100) / 100} step={meta.step}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (Number.isNaN(v)) return
              if (hasKeys) addKeyAt(o, prop, time, v)
              else setMotion(o.id, setKey({ ...motionOf(o), duration }, prop, Math.round(time), v))
            }}
            className="w-14 rounded bg-bg/60 px-1 py-0.5 text-[11px] text-text-primary focus:outline-none"
          />
          <button type="button" onClick={() => toggleDisabled(o, prop)} title={off ? 'Enable this animation' : 'Hide / disable this animation'} className="grid h-4 w-4 shrink-0 place-items-center text-text-muted hover:text-text-primary">
            {off
              ? <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2 2l12 12" /><path d="M6.5 6.6a2 2 0 0 0 2.8 2.8" /><path d="M3 8s2-4 5-4m4.5 2.3C13.5 7 14 8 14 8s-2 4-5 4a4.6 4.6 0 0 1-1.6-.3" /></svg>
              : <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" /><circle cx="8" cy="8" r="1.8" /></svg>}
          </button>
          {hasKeys && (
            <button type="button" onClick={() => delTrack(o, prop)} title="Delete this property track (all its keyframes)" className="grid h-4 w-4 shrink-0 place-items-center text-text-muted opacity-0 hover:text-error group-hover:opacity-100">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3 4.5h10M6.5 4V3h3v1M5 4.5l.6 8h4.8l.6-8" /></svg>
            </button>
          )}
        </div>
        <div
          className="relative h-full shrink-0"
          style={{ width: trackW }}
          title="Double-click to add a keyframe here"
          onDoubleClick={(e) => {
            const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
            const t = clamp((e.clientX - r.left) / r.width, 0, 1) * duration
            addKeyAt(o, prop, t)
          }}
        >
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-text-muted/15" />
          {/* segments: connecting line + clickable easing glyph at the midpoint */}
          {keys.slice(0, -1).map((a, i) => {
            const b = keys[i + 1]
            const x1 = xFromT(a.t)
            const x2 = xFromT(b.t)
            const segSel = sel?.obj === o.id && sel.prop === prop && sel.key === a.id
            return (
              <Fragment key={`seg-${a.id}`}>
                <button type="button" title={`Edit easing for this segment (${isHold(a.easing) ? 'Hold' : a.easing ?? 'default'})`} onClick={(e) => { e.stopPropagation(); setSel({ obj: o.id, prop, key: a.id }) }} style={{ left: x1, width: Math.max(0, x2 - x1) }} className="absolute top-1/2 z-10 h-3 -translate-y-1/2 cursor-pointer">
                  <span className={['absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded', segSel ? 'bg-accent' : 'bg-text-muted/40 group-hover:bg-text-muted'].join(' ')} />
                </button>
                <button type="button" title={`Segment easing: ${isHold(a.easing) ? 'Hold' : a.easing ?? 'default'}`} onClick={(e) => { e.stopPropagation(); setSel({ obj: o.id, prop, key: a.id }) }} style={{ left: (x1 + x2) / 2 }} className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
                  <EaseGlyph active={segSel} />
                </button>
              </Fragment>
            )
          })}
          {keys.map((k) => (
            <Diamond
              key={k.id}
              active={sel?.obj === o.id && sel.prop === prop && sel.key === k.id}
              left={xFromT(k.t)}
              onDown={(e) => { e.stopPropagation(); dragRef.current = { obj: o.id, prop, key: k.id }; setSel({ obj: o.id, prop, key: k.id }) }}
              onClickKey={(e) => { e.stopPropagation(); setSel({ obj: o.id, prop, key: k.id }) }}
              onContext={(e) => { e.preventDefault(); e.stopPropagation(); delKey(o, prop, k.id) }}
            />
          ))}
        </div>
      </div>
    )
  }

  const segEasing = easeKey?.easing ?? 'cubic-bezier(0.22,1,0.36,1)'

  // Playback modes with distinct icons + plain-language descriptions (cycles on click).
  const PB_MODES: Record<Playback, { next: Playback; label: string; desc: string; icon: JSX.Element }> = {
    loop: {
      next: 'pingpong',
      label: 'Loop',
      desc: 'Loop · repeats the animation continuously',
      icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6a5 5 0 0 1 9-1m1-2v3h-3" /><path d="M13 10a5 5 0 0 1-9 1m-1 2v-3h3" /></svg>
    },
    pingpong: {
      next: 'once',
      label: 'Ping-pong',
      desc: 'Ping-pong · plays forward then backward',
      icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4L2 7l3 3" /><path d="M11 12l3-3-3-3" /><path d="M2 7h12" /></svg>
    },
    once: {
      next: 'loop',
      label: 'Play once',
      desc: 'Play once · plays the animation a single time and stops',
      icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3.5l7 4.5-7 4.5z" fill="currentColor" stroke="none" /><path d="M13.5 3v10" /></svg>
    }
  }

  return (
    <div className="flex shrink-0 flex-col bg-elevated/95" style={{ height: collapsed ? 42 : panelH }}>
      {/* drag-to-resize handle */}
      {!collapsed && (
        <div onMouseDown={startResize} title="Drag to resize the timeline" className="group relative h-1.5 shrink-0 cursor-row-resize">
          <div className="absolute inset-x-0 top-1/2 mx-auto h-0.5 w-10 -translate-y-1/2 rounded-full bg-text-muted/30 group-hover:bg-accent" />
        </div>
      )}
      {/* Top bar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] text-text-secondary">
        <button type="button" onClick={play} title={playing ? 'Pause (Space)' : 'Play (Space)'} className="grid h-7 w-7 place-items-center rounded-md bg-accent text-accent-text transition-opacity hover:opacity-90">
          {playing
            ? <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1.5" width="3" height="9" rx="1" /><rect x="7" y="1.5" width="3" height="9" rx="1" /></svg>
            : <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M3 1.5l7 4.5-7 4.5z" /></svg>}
        </button>
        <button type="button" onClick={() => { stop(); setTime(0) }} title="Back to start" className="grid h-7 w-7 place-items-center rounded-md text-text-secondary transition-colors hover:bg-bg/60 hover:text-text-primary">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3v10" /><path d="M13 3.5L6 8l7 4.5z" /></svg>
        </button>
        <button type="button" onClick={() => setAutoKey(!autoKey)} title={autoKey ? 'Auto-keyframe is on — editing a value or moving on the canvas records a keyframe at the playhead. Toggle auto-keyframing (⇧K)' : 'Toggle auto-keyframing (⇧K) — record a keyframe whenever you change a value or move on the canvas'} className={['grid h-7 w-7 place-items-center rounded-md transition-colors', autoKey ? 'bg-[#f9603f] text-white shadow-[0_0_0_2px_rgba(249,96,63,0.25)]' : 'text-text-secondary hover:bg-bg/60 hover:text-text-primary'].join(' ')}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2.4" fill="currentColor" stroke="none" /></svg>
        </button>
        <span className="ml-0.5 tabular-nums text-text-primary">{fmtTime(time)}</span>
        <span className="text-text-muted">/</span>
        <label className="flex items-center gap-1">
          <span className="text-text-muted">Duration</span>
          <input type="number" value={duration} step={100} min={100} onChange={(e) => setDuration(Math.max(100, parseInt(e.target.value) || 100))} className="w-20 rounded bg-bg/60 px-1.5 py-1 text-[11.5px] text-text-primary focus:outline-none" />
          <span className="text-text-muted">ms</span>
        </label>
        <button type="button" onClick={() => setPlayback((p) => PB_MODES[p].next)} className="grid h-7 w-7 place-items-center rounded-md text-text-secondary transition-colors hover:bg-bg/60 hover:text-text-primary" title={PB_MODES[playback].desc}>{PB_MODES[playback].icon}</button>
        <select
          value=""
          title={selIds.length ? 'Apply an animation preset to the selected layer' : 'Select a layer first'}
          disabled={!selIds.length}
          onChange={(e) => {
            const preset = ANIMATION_PRESETS.find((p) => p.id === e.target.value)
            if (preset) for (const obid of selIds) setMotion(obid, preset.build(duration))
            e.target.value = ''
          }}
          className="rounded bg-bg/60 px-1.5 py-1 text-[11px] text-text-primary focus:outline-none disabled:opacity-40"
        >
          <option value="">+ Preset…</option>
          {PRESET_GROUPS.map((g) => (
            <optgroup key={g} label={g}>
              {ANIMATION_PRESETS.filter((p) => p.group === g).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </optgroup>
          ))}
        </select>
        <div className="ml-auto" />
        <label className="flex items-center gap-1.5 text-[10.5px] text-text-muted" title="Zoom the time axis">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="7" r="4.5" /><path d="M11 11l3 3" /></svg>
          <input type="range" min={1} max={8} step={0.25} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="t42-range w-20" style={{ background: `linear-gradient(to right, rgb(var(--accent)) ${((zoom - 1) / 7) * 100}%, rgb(var(--border-strong)) ${((zoom - 1) / 7) * 100}%)` }} />
        </label>
        <button type="button" onClick={() => setCollapsed((c) => !c)} title={collapsed ? 'Expand timeline' : 'Collapse timeline'} className="grid h-7 w-7 place-items-center rounded-md text-text-muted transition-colors hover:bg-bg/60 hover:text-text-primary">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M2 10.5h12" /></svg>
        </button>
        <button type="button" onClick={onExportVideo} title="Record this animation to a video file (MP4/WebM)" className="flex items-center gap-1 rounded-md bg-bg/60 px-2 py-1 text-[11px] text-text-secondary transition-colors hover:text-text-primary" style={{ height: 28 }}>
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="3" width="8" height="8" rx="1.5" /><path d="M10 6l2.5-1.6v5.2L10 8z" /></svg>
          Video
        </button>
        <button type="button" onClick={() => { clearPreview(); onClose() }} className="grid h-7 w-7 place-items-center rounded-md text-text-muted transition-colors hover:bg-bg/60 hover:text-text-primary" title="Close timeline">
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
        </button>
      </div>

      {!collapsed && (
      <div className="flex min-h-0 flex-1">
        {/* layers + tracks: a single scroll viewport (x = time zoom, y = layers) */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={viewRef} className="relative min-h-0 flex-1 overflow-auto">
            <div className="relative min-h-full" style={{ width: 220 + trackW }}>
              {/* ruler (sticky top) */}
              <div className="sticky top-0 z-30 flex h-6 items-stretch bg-elevated">
                <div className="sticky left-0 z-10 w-[220px] shrink-0 bg-elevated px-2 py-1 text-[10px] text-text-muted">Layers</div>
                <div ref={lanesRef} className="relative shrink-0 cursor-pointer" style={{ width: trackW }} onMouseDown={(e) => { scrubRef.current = true; setTime(Math.round(tFromClientX(e.clientX))) }}>
                  {/* auto-keyframe "recording" accent line along the top of the ruler */}
                  {autoKey && <div className="pointer-events-none absolute inset-x-0 top-0 z-40 h-[2px]" style={{ background: REC }} />}
                  {ticks.map((t) => (
                    <div key={t} className="absolute top-0 bottom-0 pl-1 text-[9px] text-text-muted" style={{ left: xFromT(t) }}>{(t / 1000).toFixed(t % 1000 === 0 ? 0 : 2)}s</div>
                  ))}
                  {/* playhead flag */}
                  <div className="absolute top-0 z-40 -translate-x-1/2 cursor-ew-resize px-1" style={{ left: xFromT(time), color: autoKey ? REC : 'rgb(var(--accent))' }} onMouseDown={(e) => { e.stopPropagation(); scrubRef.current = true }} title="Drag to scrub">
                    <svg width="13" height="16" viewBox="0 0 13 16" fill="currentColor"><path d="M1 1.5A1.5 1.5 0 0 1 2.5 0h8A1.5 1.5 0 0 1 12 1.5V9l-5.5 6L1 9z" /></svg>
                  </div>
                </div>
              </div>
              {/* playhead line: spans the full height of the timeline body so it always
                  reaches the bottom edge (never hangs partway in empty space) */}
              <div className={['pointer-events-none absolute bottom-0 top-6 z-20 w-px', autoKey ? '' : 'bg-accent/70'].join(' ')} style={{ left: 220 + xFromT(time), background: autoKey ? REC : undefined }} />
              {layers.map((o) => {
                const open = expanded.has(o.id)
                const animated = hasAnyKeys(o.motion)
                const cr = clipRange(o.motion)
                return (
                  <div key={o.id} className="">
                    {/* layer header row */}
                    <div className={['flex h-7 items-center', selIds.includes(o.id) ? 'bg-accent/10' : ''].join(' ')}>
                      <div className="sticky left-0 z-10 flex w-[220px] shrink-0 items-center gap-1 bg-elevated px-2">
                        <button type="button" onClick={() => setExpanded((s) => { const n = new Set(s); if (n.has(o.id)) n.delete(o.id); else n.add(o.id); return n })} className="grid h-4 w-4 place-items-center text-text-muted hover:text-text-primary">
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" style={{ transform: open ? 'rotate(90deg)' : 'none' }}><path d="M4 2l5 4-5 4z" /></svg>
                        </button>
                        <button type="button" onClick={() => onSelect(o.id)} className="flex-1 truncate text-left text-[12px] text-text-primary">{o.name}</button>
                        <span className={['h-1.5 w-1.5 rounded-full', animated ? 'bg-accent' : 'bg-transparent'].join(' ')} />
                      </div>
                      <div className="relative h-full shrink-0" style={{ width: trackW }}>
                        {/* clip / duration bar: drag the middle to move the whole animation, the ends to trim */}
                        {cr && (
                          <div className="absolute top-1/2 z-10 flex h-3 -translate-y-1/2 items-stretch overflow-hidden rounded" style={{ left: xFromT(cr.min), width: Math.max(8, xFromT(cr.max) - xFromT(cr.min)) }}>
                            <div title="Trim start" onMouseDown={(e) => { e.stopPropagation(); clipDragRef.current = { obj: o.id, mode: 'trimL', min: cr.min, max: cr.max, m: o.motion! } }} className="w-1.5 shrink-0 cursor-ew-resize bg-accent/80 hover:bg-accent" />
                            <div title="Drag to move the whole animation" onMouseDown={(e) => { e.stopPropagation(); clipDragRef.current = { obj: o.id, mode: 'move', min: cr.min, max: cr.max, m: o.motion! } }} className="flex-1 cursor-grab bg-accent/30 hover:bg-accent/45" />
                            <div title="Trim end" onMouseDown={(e) => { e.stopPropagation(); clipDragRef.current = { obj: o.id, mode: 'trimR', min: cr.min, max: cr.max, m: o.motion! } }} className="w-1.5 shrink-0 cursor-ew-resize bg-accent/80 hover:bg-accent" />
                          </div>
                        )}
                        {/* summary keyframes (all props) on the collapsed row */}
                        {!open && o.motion && PROP_ORDER.flatMap((p) => (o.motion!.tracks[p] ?? []).map((k) => (
                          <span key={`${p}-${k.id}`} style={{ left: xFromT(k.t) }} className="pointer-events-none absolute top-1/2 z-20 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] bg-text-primary/70" />
                        )))}
                      </div>
                    </div>
                    {open && (() => {
                      const ap = animatedProps(o)
                      const tp = ap.filter((p) => PROP_META[p].group === 'transform')
                      const ep = ap.filter((p) => PROP_META[p].group === 'effect')
                      const addable = PROP_ORDER.filter((p) => !ap.includes(p))
                      return (
                        <div className="bg-bg/20 py-0.5">
                          {tp.length > 0 && <div className="sticky left-0 z-[6] w-[220px] bg-elevated px-7 pb-0.5 pt-1 text-[9.5px] text-text-muted">Transform</div>}
                          {tp.map((p) => propRow(o, p))}
                          {ep.length > 0 && <div className="sticky left-0 z-[6] w-[220px] bg-elevated px-7 pb-0.5 pt-1.5 text-[9.5px] text-text-muted">Effects</div>}
                          {ep.map((p) => propRow(o, p))}
                          {ap.length === 0 && <div className="sticky left-0 z-[6] w-[220px] bg-elevated px-7 py-1.5 text-[10px] text-text-muted">No animated properties yet.</div>}
                          {addable.length > 0 && (
                            <div className="sticky left-0 z-[6] flex w-[220px] items-center bg-elevated px-5 pb-1 pt-1">
                              <select value="" onChange={(e) => { if (e.target.value) { addKeyAt(o, e.target.value as PropName); e.currentTarget.value = '' } }} className="w-full rounded bg-bg/60 px-1.5 py-1 text-[10.5px] text-text-secondary focus:outline-none">
                                <option value="">+ Add property…</option>
                                {addable.map((p) => <option key={p} value={p}>{PROP_META[p].label}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* selected-keyframe inspector (easing) — only shown while a keyframe is selected */}
        {selObj && selKey && (
        <div className="flex w-[260px] shrink-0 flex-col gap-2 overflow-y-auto p-3">
          <>
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-medium text-text-primary">{PROP_META[sel!.prop].label}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => delKey(selObj, sel!.prop, selKey.id)} title="Delete this keyframe (Delete)" className="text-[11px] text-text-muted hover:text-error">Delete key</button>
                  <button type="button" onClick={() => delTrack(selObj, sel!.prop)} title="Remove every keyframe on this property" className="text-[11px] text-text-muted hover:text-error">Delete track</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-text-muted">
                <label className="flex items-center gap-1">Time<input type="number" value={Math.round(selKey.t)} onChange={(e) => { const t = clamp(parseInt(e.target.value) || 0, 0, duration); setMotion(selObj.id, { ...selObj.motion!, tracks: { ...selObj.motion!.tracks, [sel!.prop]: selObj.motion!.tracks[sel!.prop]!.map((k) => (k.id === selKey.id ? { ...k, t } : k)).sort((a, b) => a.t - b.t) } }) }} className="w-full rounded bg-bg/60 px-1 py-0.5 text-text-primary focus:outline-none" /></label>
                <label className="flex items-center gap-1">Value<input type="number" step={PROP_META[sel!.prop].step} value={Math.round(selKey.v * 100) / 100} onChange={(e) => editKeyVal(selObj, sel!.prop, selKey.id, parseFloat(e.target.value) || 0)} className="w-full rounded bg-bg/60 px-1 py-0.5 text-text-primary focus:outline-none" /></label>
              </div>
              <div className="flex items-center justify-between text-[10.5px] text-text-muted">
                <span>{hasSegment ? (isLastKey ? 'Incoming segment easing' : 'Outgoing segment easing') : 'Add another keyframe to ease between them'}</span>
                {hasSegment && <span className="text-text-secondary">{easingLabel(segEasing)}</span>}
              </div>
              {hasSegment && easeKey && (
                <>
                  <EasingCurveEditor value={segEasing} onChange={(v) => editKeyEasing(selObj, sel!.prop, easeKey.id, v)} size={120} />
                  {!isSpring(segEasing) && !isHold(segEasing) && (
                    <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
                      <span>cubic-bezier</span>
                      <input
                        type="text"
                        defaultValue={cubicText(segEasing)}
                        key={segEasing}
                        onChange={(e) => { const v = parseCubic(e.target.value); if (v) editKeyEasing(selObj, sel!.prop, easeKey.id, v) }}
                        className="w-[150px] rounded bg-bg/60 px-1.5 py-1 font-mono text-[10.5px] text-text-primary focus:outline-none"
                      />
                    </label>
                  )}
                </>
              )}
            </>
        </div>
        )}
      </div>
      )}
    </div>
  )
}
