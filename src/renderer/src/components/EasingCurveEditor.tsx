import { useEffect, useMemo, useRef, useState } from 'react'
import { bezierPts, isHold, isSpring, springParams, springFn, SPRING_PRESETS, EASING_PRESETS, curveIconPath, easingLabel } from '../lib/easing'
import { type EasingVar, loadEasingVars, saveEasingVar, deleteEasingVar } from '../lib/easingVars'

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
const PAD = 14
const Y_MIN = -0.6
const Y_MAX = 1.6

// Visual easing editor with Curve (cubic-bézier) and Spring tabs, plus clickable
// preset "templates". Drives the live preview + CSS bake through the easing lib.
export function EasingCurveEditor({ value, onChange, size = 150 }: {
  value: string
  onChange: (v: string) => void
  size?: number
}): JSX.Element {
  const SIZE = size
  const spring = isSpring(value)
  const hold = isHold(value)
  const [tab, setTab] = useState<'curve' | 'spring'>(spring ? 'spring' : 'curve')
  useEffect(() => { setTab(spring ? 'spring' : 'curve') }, [spring])

  const gx = (x: number): number => PAD + x * SIZE
  const gy = (y: number): number => PAD + ((Y_MAX - y) / (Y_MAX - Y_MIN)) * SIZE
  const total = SIZE + PAD * 2

  // ── Curve (cubic-bézier) ─────────────────────────────────────────────────────
  const [x1, y1, x2, y2] = bezierPts(value)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<0 | 1 | 2>(0)
  const ptsRef = useRef<[number, number, number, number]>([x1, y1, x2, y2])
  ptsRef.current = [x1, y1, x2, y2]
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const [dragging, setDragging] = useState<0 | 1 | 2>(0)
  const [vars, setVars] = useState<EasingVar[]>(() => loadEasingVars())
  const [naming, setNaming] = useState(false)
  const [varName, setVarName] = useState('')

  const bezierPath = useMemo(() => {
    const out: string[] = []
    for (let i = 0; i <= 48; i++) {
      const t = i / 48
      const mt = 1 - t
      const bxv = 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t
      const byv = 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t
      out.push(`${i === 0 ? 'M' : 'L'}${gx(bxv).toFixed(1)},${gy(byv).toFixed(1)}`)
    }
    return out.join(' ')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x1, y1, x2, y2, SIZE])

  useEffect(() => {
    const move = (e: PointerEvent): void => {
      const which = dragRef.current
      if (!which || !svgRef.current) return
      e.preventDefault()
      const r = svgRef.current.getBoundingClientRect()
      const x = clamp((e.clientX - r.left - PAD) / SIZE, 0, 1)
      const y = clamp(Y_MAX - ((e.clientY - r.top - PAD) / SIZE) * (Y_MAX - Y_MIN), Y_MIN, Y_MAX)
      const [cx1, cy1, cx2, cy2] = ptsRef.current
      const next: [number, number, number, number] = which === 1 ? [+x.toFixed(3), +y.toFixed(3), cx2, cy2] : [cx1, cy1, +x.toFixed(3), +y.toFixed(3)]
      onChangeRef.current(`cubic-bezier(${next.join(',')})`)
    }
    const up = (): void => { if (dragRef.current) { dragRef.current = 0; setDragging(0) } }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [SIZE])

  const start = (which: 1 | 2) => (e: React.PointerEvent): void => { e.stopPropagation(); e.preventDefault(); dragRef.current = which; setDragging(which) }
  const handle = (which: 1 | 2, hx: number, hy: number): JSX.Element => (
    <g onPointerDown={start(which)} style={{ cursor: 'grab', touchAction: 'none' }}>
      <circle cx={gx(hx)} cy={gy(hy)} r={14} fill="transparent" />
      <circle cx={gx(hx)} cy={gy(hy)} r={dragging === which ? 8 : 6.5} fill="rgb(var(--accent,34 197 94))" stroke="#0b0b0c" strokeWidth={1.5} />
    </g>
  )

  // ── Spring ───────────────────────────────────────────────────────────────────
  const sp = springParams(value)
  const springPath = useMemo(() => {
    const fn = springFn(sp.bounce, sp.freq)
    const out: string[] = []
    for (let i = 0; i <= 64; i++) {
      const t = i / 64
      out.push(`${i === 0 ? 'M' : 'L'}${gx(t).toFixed(1)},${gy(fn(t)).toFixed(1)}`)
    }
    return out.join(' ')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.bounce, sp.freq, SIZE])

  const grid = (
    <>
      <rect x={gx(0)} y={gy(1)} width={SIZE} height={gy(0) - gy(1)} fill="none" stroke="currentColor" strokeOpacity={0.14} />
      <line x1={gx(0)} y1={gy(0)} x2={gx(1)} y2={gy(1)} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="3 3" />
    </>
  )

  const setBezier = (v: string): void => onChange(v)
  const setSpring = (bounce: number, freq: number): void => onChange(`spring(${+bounce.toFixed(2)},${+freq.toFixed(1)})`)

  return (
    <div className="flex flex-col gap-2">
      {/* tabs */}
      <div className="flex items-center gap-0.5 self-start rounded-md bg-bg/60 p-0.5 text-[11px]">
        <button type="button" onClick={() => { setTab('curve'); if (spring) onChange('cubic-bezier(0.22,1,0.36,1)') }} className={['rounded px-2 py-0.5', tab === 'curve' ? 'bg-action text-action-text' : 'text-text-secondary hover:text-text-primary'].join(' ')}>Curve</button>
        <button type="button" onClick={() => { setTab('spring'); if (!spring) setSpring(0.5, 6) }} className={['rounded px-2 py-0.5', tab === 'spring' ? 'bg-action text-action-text' : 'text-text-secondary hover:text-text-primary'].join(' ')}>Spring</button>
      </div>

      {tab === 'curve' ? (
        <>
          <svg ref={svgRef} width={total} height={total} className="select-none rounded bg-bg/50" style={{ touchAction: 'none', overflow: 'visible' }}>
            {grid}
            {hold ? (
              <polyline points={`${gx(0)},${gy(0)} ${gx(0)},${gy(1)} ${gx(1)},${gy(1)}`} fill="none" stroke="rgb(var(--accent,34 197 94))" strokeWidth={2} />
            ) : (
              <>
                <line x1={gx(0)} y1={gy(0)} x2={gx(x1)} y2={gy(y1)} stroke="rgb(var(--accent,34 197 94))" strokeOpacity={0.55} />
                <line x1={gx(1)} y1={gy(1)} x2={gx(x2)} y2={gy(y2)} stroke="rgb(var(--accent,34 197 94))" strokeOpacity={0.55} />
                <path d={bezierPath} fill="none" stroke="rgb(var(--accent,34 197 94))" strokeWidth={2.25} />
                <circle cx={gx(0)} cy={gy(0)} r={3} fill="#0b0b0c" stroke="currentColor" strokeOpacity={0.6} />
                <circle cx={gx(1)} cy={gy(1)} r={3} fill="#0b0b0c" stroke="currentColor" strokeOpacity={0.6} />
                {handle(1, x1, y1)}
                {handle(2, x2, y2)}
              </>
            )}
          </svg>
          {/* named presets, each with a little curve icon */}
          <div className="grid grid-cols-2 gap-1">
            {EASING_PRESETS.map((p) => {
              const on = value === p.value
              return (
                <button key={p.id} type="button" onClick={() => setBezier(p.value)} className={['flex items-center gap-1.5 rounded px-1.5 py-1 text-left text-[10.5px]', on ? 'bg-action text-action-text' : 'bg-bg/60 text-text-secondary hover:text-text-primary'].join(' ')}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="shrink-0"><path d={curveIconPath(p.value, 16, 16)} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                  <span className="truncate">{p.label}</span>
                </button>
              )
            })}
          </div>

          {/* saved custom curves (project-wide, reusable) */}
          <div className="flex flex-col gap-1 pt-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-text-muted">Saved curves</span>
              {!naming && (
                <button type="button" onClick={() => { setVarName(easingLabel(value) === 'Custom bezier' ? 'My curve' : easingLabel(value)); setNaming(true) }} className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-text-secondary hover:text-text-primary" title="Save this curve as a reusable variable">
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M7 2v10M2 7h10" /></svg>
                  Save curve
                </button>
              )}
            </div>
            {naming && (
              <div className="flex items-center gap-1">
                <input autoFocus type="text" value={varName} onChange={(e) => setVarName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setVars(saveEasingVar(varName, value)); setNaming(false) } if (e.key === 'Escape') setNaming(false) }} placeholder="Curve name" className="min-w-0 flex-1 rounded t42-field px-1.5 py-1 text-[11px] text-text-primary" />
                <button type="button" onClick={() => { setVars(saveEasingVar(varName, value)); setNaming(false) }} className="rounded bg-action px-2 py-1 text-[10.5px] text-action-text hover:opacity-90">Save</button>
                <button type="button" onClick={() => setNaming(false)} className="rounded px-1.5 py-1 text-[10.5px] text-text-muted hover:text-text-primary">Cancel</button>
              </div>
            )}
            {vars.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {vars.map((v) => {
                  const on = value === v.value
                  return (
                    <span key={v.id} className={['group flex items-center gap-1 rounded py-0.5 pl-1.5 pr-1 text-[10.5px]', on ? 'bg-action text-action-text' : 'bg-bg/60 text-text-secondary'].join(' ')}>
                      <button type="button" onClick={() => setBezier(v.value)} className="flex items-center gap-1 hover:text-text-primary" title={`Apply ${v.name}`}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d={curveIconPath(v.value, 16, 16)} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                        <span className="max-w-[88px] truncate">{v.name}</span>
                      </button>
                      <button type="button" onClick={() => setVars(deleteEasingVar(v.id))} title="Delete saved curve" className="text-text-muted opacity-60 hover:text-error hover:opacity-100"><svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg></button>
                    </span>
                  )
                })}
              </div>
            ) : (
              !naming && <span className="text-[10px] text-text-muted">Save a curve to reuse it across the project.</span>
            )}
          </div>
        </>
      ) : (
        <>
          <svg width={total} height={total} className="select-none rounded bg-bg/50" style={{ overflow: 'visible' }}>
            {grid}
            <line x1={gx(0)} y1={gy(1)} x2={gx(1)} y2={gy(1)} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="2 2" />
            <path d={`${springPath} L${gx(1).toFixed(1)},${gy(0).toFixed(1)} L${gx(0).toFixed(1)},${gy(0).toFixed(1)} Z`} fill="rgb(var(--accent,34 197 94))" fillOpacity={0.12} stroke="none" />
            <path d={springPath} fill="none" stroke="rgb(var(--accent,34 197 94))" strokeWidth={2.5} strokeLinejoin="round" />
          </svg>
          <label className="flex items-center gap-2 text-[11px] text-text-muted">
            <span className="w-12 shrink-0">Bounce</span>
            <input type="range" min={0} max={100} value={Math.round(sp.bounce * 100)} onChange={(e) => setSpring(parseInt(e.target.value) / 100, sp.freq)} className="t42-range min-w-0 flex-1" style={{ background: `linear-gradient(to right, rgb(var(--accent)) ${Math.round(sp.bounce * 100)}%, rgb(var(--border-strong)) ${Math.round(sp.bounce * 100)}%)` }} />
            <span className="w-7 text-right tabular-nums">{Math.round(sp.bounce * 100)}</span>
          </label>
          <label className="flex items-center gap-2 text-[11px] text-text-muted">
            <span className="w-12 shrink-0">Speed</span>
            <input type="range" min={3} max={16} value={sp.freq} onChange={(e) => setSpring(sp.bounce, parseInt(e.target.value))} className="t42-range min-w-0 flex-1" style={{ background: `linear-gradient(to right, rgb(var(--accent)) ${((sp.freq - 3) / 13) * 100}%, rgb(var(--border-strong)) ${((sp.freq - 3) / 13) * 100}%)` }} />
            <span className="w-7 text-right tabular-nums">{Math.round(sp.freq)}</span>
          </label>
          <div className="flex flex-wrap gap-1">
            {SPRING_PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => setSpring(p.bounce, p.freq)} className={['rounded px-1.5 py-0.5 text-[10px]', sp.bounce === p.bounce && sp.freq === p.freq ? 'bg-action text-action-text' : 'bg-bg/60 text-text-secondary hover:text-text-primary'].join(' ')}>{p.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
