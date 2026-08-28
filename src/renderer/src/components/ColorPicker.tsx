import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  type RGB, type HSV, parseHex, toHex, rgbToHsv, hsvToRgb, rgbToHsl, hslToRgb, rgbToLch, lchToRgb, clamp,
} from '../lib/color'

export interface PickerRequest {
  value: string
  opacity: number
  showAlpha?: boolean
  /** anchor rect (the swatch) used to place the window beside the inspector */
  anchor: { left: number; top: number; right: number; bottom: number }
  onChange: (hex: string, opacity: number) => void
  onClose: () => void
  /** Optional: existing color variables that can be applied to this field. */
  colorVars?: { id: string; name: string; hex: string }[]
  /** Optional: bind the field to an existing color variable (id). */
  onBindVar?: (id: string) => void
  /** Optional: create a new color variable from the current color and bind it. */
  onCreateVar?: (hex: string) => void
  /**
   * Optional: the token library's named colours, offered wherever a colour is
   * chosen. Applied as a value, not bound — see `useTokenSwatches`.
   */
  tokenSwatches?: { id: string; name: string; hex: string }[]
}

type HueMode = 'closest' | 'chroma' | 'lightness'
const HUE_MODES: { id: HueMode; label: string }[] = [
  { id: 'closest', label: 'Find closest color' },
  { id: 'chroma', label: 'Maintain chroma' },
  { id: 'lightness', label: 'Maintain lightness' },
]

const WIDTH = 268

function usePointerTrack(onMove: (e: PointerEvent) => void): (e: React.PointerEvent) => void {
  const moveRef = useRef(onMove)
  moveRef.current = onMove
  return useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const move = (ev: PointerEvent): void => moveRef.current(ev)
    const up = (): void => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    moveRef.current(e.nativeEvent)
  }, [])
}

/** Floating, draggable colour picker. Edits a hex colour + opacity and reports
 * every change live via `req.onChange`. Placed to the left of the inspector. */
export function ColorPicker({ req }: { req: PickerRequest }): JSX.Element {
  const { showAlpha = true } = req
  const [hsv, setHsv] = useState<HSV>(() => rgbToHsv(parseHex(req.value) ?? { r: 0, g: 0, b: 0 }))
  const [alpha, setAlpha] = useState(req.opacity)
  const [hueMode, setHueMode] = useState<HueMode>('closest')
  const [menuOpen, setMenuOpen] = useState(false)
  const selfHex = useRef(req.value)

  // Re-sync when the target colour changes from outside (e.g. selection switch).
  useEffect(() => {
    if (req.value !== selfHex.current) {
      setHsv(rgbToHsv(parseHex(req.value) ?? { r: 0, g: 0, b: 0 }))
      selfHex.current = req.value
    }
  }, [req.value])
  useEffect(() => { setAlpha(req.opacity) }, [req.opacity])

  const rgb = hsvToRgb(hsv)
  const hex = toHex(rgb)
  const emit = useCallback((nextRgb: RGB, nextAlpha: number) => {
    const h = toHex(nextRgb)
    selfHex.current = h
    req.onChange(h, nextAlpha)
  }, [req])
  const setFromRgb = (next: RGB, a = alpha): void => { const keepHue = rgbToHsv(next); if (next.r === next.g && next.g === next.b) keepHue.h = hsv.h; setHsv(keepHue); setAlpha(a); emit(next, a) }
  const setHsvAnd = (next: HSV, a = alpha): void => { setHsv(next); setAlpha(a); emit(hsvToRgb(next), a) }

  // ── Window position (draggable) ──────────────────────────────────────────────
  const [pos, setPos] = useState(() => {
    const w = WIDTH
    let left = req.anchor.left - w - 12
    if (left < 8) left = Math.min(window.innerWidth - w - 8, req.anchor.right + 12)
    const top = clamp(req.anchor.top - 8, 8, Math.max(8, window.innerHeight - 420))
    return { left, top }
  })
  const dragWin = usePointerTrack((e) => setPos((p) => ({ left: clamp(p.left + e.movementX, 0, window.innerWidth - 80), top: clamp(p.top + e.movementY, 0, window.innerHeight - 40) })))
  // Nudge fully on-screen once mounted, using the picker's measured height.
  const winRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = winRef.current
    if (!el) return
    const w = el.offsetWidth, h = el.offsetHeight, pad = 8
    setPos((p) => {
      const left = Math.max(pad, Math.min(p.left, window.innerWidth - w - pad))
      const top = Math.max(pad, Math.min(p.top, window.innerHeight - h - pad))
      return left === p.left && top === p.top ? p : { left, top }
    })
  }, [])

  // ── SV field + sliders ───────────────────────────────────────────────────────
  const fieldRef = useRef<HTMLDivElement>(null)
  const onField = usePointerTrack((e) => {
    const r = fieldRef.current?.getBoundingClientRect(); if (!r) return
    const s = clamp((e.clientX - r.left) / r.width, 0, 1)
    const v = clamp(1 - (e.clientY - r.top) / r.height, 0, 1)
    setHsvAnd({ h: hsv.h, s, v })
  })
  const hueRef = useRef<HTMLDivElement>(null)
  const onHue = usePointerTrack((e) => {
    const r = hueRef.current?.getBoundingClientRect(); if (!r) return
    const h = clamp((e.clientY - r.top) / r.height, 0, 1) * 360
    if (hueMode === 'lightness') { const hsl = rgbToHsl(rgb); setFromRgb(hslToRgb({ h, s: hsl.s, l: hsl.l })) }
    else if (hueMode === 'chroma') { const lch = rgbToLch(rgb); setFromRgb(lchToRgb({ l: lch.l, c: lch.c, h })) }
    else setHsvAnd({ ...hsv, h })
  })
  const alphaRef = useRef<HTMLDivElement>(null)
  const onAlpha = usePointerTrack((e) => {
    const r = alphaRef.current?.getBoundingClientRect(); if (!r) return
    const a = clamp(1 - (e.clientY - r.top) / r.height, 0, 1)
    setAlpha(a); emit(rgb, a)
  })

  const hueColor = toHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }))
  const hsl = rgbToHsl(rgb)
  const lch = rgbToLch(rgb)

  const eyedrop = (): void => {
    const ED = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper
    if (!ED) return
    new ED().open().then((res) => { const c = parseHex(res.sRGBHex); if (c) setFromRgb(c) }).catch(() => {})
  }
  const copy = (text: string): void => { navigator.clipboard?.writeText(text).catch(() => {}) }

  const startCellScrub = (e: React.PointerEvent, val: number, on: (n: number) => void, max: number): void => {
    e.preventDefault()
    let raw = val
    const move = (ev: PointerEvent): void => {
      const mult = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1
      raw = clamp(raw + ev.movementX * mult, 0, max)
      on(Math.round(raw))
    }
    const up = (): void => { document.body.style.cursor = ''; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    document.body.style.cursor = 'ew-resize'
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const numCell = (val: number, on: (n: number) => void, max: number, label: string): JSX.Element => (
    <label className="flex flex-1 flex-col items-center gap-0.5">
      <input type="number" value={Math.round(val)} min={0} max={max}
        onChange={(e) => on(clamp(parseFloat(e.target.value) || 0, 0, max))}
        className="w-full rounded bg-bg/70 px-1 py-1 text-center text-[12px] text-text-primary [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none" />
      <span onPointerDown={(e) => startCellScrub(e, val, on, max)} title="Drag to adjust" className="cursor-ew-resize select-none text-[10px] text-text-muted hover:text-text-primary">{label}</span>
    </label>
  )
  const copyBtn = (text: string): JSX.Element => (
    <button type="button" onClick={() => copy(text)} title="Copy" className="grid h-7 w-7 shrink-0 place-items-center self-start rounded bg-bg/70 text-text-muted hover:text-text-primary">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="5" y="5" width="8" height="8" rx="1.5" /><path d="M3 11V4a1 1 0 0 1 1-1h7" /></svg>
    </button>
  )

  return (
    <div ref={winRef} className="fixed z-[60] select-none rounded-xl bg-surface shadow-[0_12px_40px_rgba(0,0,0,0.5)]" style={{ left: pos.left, top: pos.top, width: WIDTH }}>
      {/* title bar */}
      <div onPointerDown={dragWin} className="flex cursor-grab items-center justify-between gap-2 rounded-t-xl px-2.5 py-2 active:cursor-grabbing">
        <div className="flex items-center gap-1 text-[11px]">
          <span className="rounded bg-elevated px-1.5 py-0.5 text-text-primary">sRGB</span>
          <span className="px-1.5 py-0.5 text-text-muted">Display P3</span>
        </div>
        <div className="flex items-center gap-1 text-text-muted">
          <button type="button" onClick={eyedrop} title="Pick from screen" className="grid h-6 w-6 place-items-center rounded hover:bg-elevated hover:text-text-primary">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M10 3.5l2.5 2.5M11 2.5a1.7 1.7 0 0 1 2.5 2.3L8 10.4 5 11l.6-3z" /></svg>
          </button>
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen((o) => !o)} title="Options" className="grid h-6 w-6 place-items-center rounded hover:bg-elevated hover:text-text-primary">
              <svg width="14" height="14" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3 5h10M3 8h10M3 11h10" /></svg>
            </button>
            {menuOpen && (
              <div className="t42-menu absolute right-0 top-7 z-10 w-48 rounded-lg bg-raised p-1 shadow-overlay">
                <div className="px-2 py-1 text-[11px] text-text-muted">When changing hue…</div>
                {HUE_MODES.map((m) => (
                  <button key={m.id} type="button" onClick={() => { setHueMode(m.id); setMenuOpen(false) }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-text-primary hover:bg-bg/60">
                    <span className="w-3 text-text-primary">{hueMode === m.id ? '✓' : ''}</span>{m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={req.onClose} title="Close" className="grid h-6 w-6 place-items-center rounded hover:bg-elevated hover:text-text-primary">
            <svg width="13" height="13" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>
      </div>

      <div className="space-y-2.5 px-2.5 pb-2.5">
        {/* SV field + hue + alpha */}
        <div className="flex gap-2" style={{ height: 150 }}>
          <div ref={fieldRef} onPointerDown={onField} className="relative flex-1 cursor-crosshair rounded-md"
            style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}>
            <span className="t42-handle pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} />
          </div>
          <div ref={hueRef} onPointerDown={onHue} className="relative w-3.5 cursor-pointer rounded"
            style={{ background: 'linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }}>
            <span className="pointer-events-none absolute left-1/2 h-2 w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white/30 shadow" style={{ top: `${(hsv.h / 360) * 100}%` }} />
          </div>
          {showAlpha && (
            <div ref={alphaRef} onPointerDown={onAlpha} className="relative w-3.5 cursor-pointer overflow-hidden rounded"
              style={{ backgroundImage: 'linear-gradient(45deg,#666 25%,transparent 25%),linear-gradient(-45deg,#666 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#666 75%),linear-gradient(-45deg,transparent 75%,#666 75%)', backgroundSize: '8px 8px', backgroundPosition: '0 0,0 4px,4px -4px,-4px 0' }}>
              <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${hex}, transparent)` }} />
              <span className="pointer-events-none absolute left-1/2 h-2 w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white/30 shadow" style={{ top: `${(1 - alpha) * 100}%` }} />
            </div>
          )}
        </div>

        {/* preview */}
        <div className="flex items-center gap-2">
          <div className="h-9 flex-1 overflow-hidden rounded-md">
            <div className="h-full w-full" style={{ background: req.value }} />
          </div>
          <div className="h-9 flex-1 overflow-hidden rounded-md">
            <div className="h-full w-full" style={{ background: hex }} />
          </div>
        </div>

        {/* numeric rows */}
        <div className="flex items-end gap-1.5">
          {numCell(lch.l, (l) => setFromRgb(lchToRgb({ l, c: lch.c, h: lch.h })), 100, 'L')}
          {numCell(lch.c, (c) => setFromRgb(lchToRgb({ l: lch.l, c, h: lch.h })), 150, 'C')}
          {numCell(lch.h, (h) => setFromRgb(lchToRgb({ l: lch.l, c: lch.c, h })), 360, 'H')}
          {copyBtn(`${Math.round(lch.l)} ${Math.round(lch.c)} ${Math.round(lch.h)}`)}
        </div>
        <div className="flex items-end gap-1.5">
          {numCell(hsl.h, (h) => setFromRgb(hslToRgb({ h, s: hsl.s, l: hsl.l })), 360, 'H')}
          {numCell(hsl.s * 100, (s) => setFromRgb(hslToRgb({ h: hsl.h, s: s / 100, l: hsl.l })), 100, 'S')}
          {numCell(hsl.l * 100, (l) => setFromRgb(hslToRgb({ h: hsl.h, s: hsl.s, l: l / 100 })), 100, 'L')}
          {copyBtn(`${Math.round(hsl.h)} ${Math.round(hsl.s * 100)} ${Math.round(hsl.l * 100)}`)}
        </div>
        <div className="flex items-end gap-1.5">
          {numCell(rgb.r, (r) => setFromRgb({ ...rgb, r }), 255, 'R')}
          {numCell(rgb.g, (g) => setFromRgb({ ...rgb, g }), 255, 'G')}
          {numCell(rgb.b, (b) => setFromRgb({ ...rgb, b }), 255, 'B')}
          {copyBtn(`${rgb.r} ${rgb.g} ${rgb.b}`)}
        </div>

        {/* hex + opacity */}
        <div className="flex items-center gap-1.5 rounded-md bg-bg/70 px-2 py-1.5">
          <input value={hex.replace('#', '').toUpperCase()} spellCheck={false}
            onChange={(e) => { const c = parseHex(e.target.value); if (c) setFromRgb(c) }}
            className="min-w-0 flex-1 bg-transparent text-[12px] uppercase tracking-wide text-text-primary focus:outline-none" />
          {showAlpha && (
            <>
              <span className="text-text-muted">/</span>
              <input type="number" min={0} max={100} value={Math.round(alpha * 100)}
                onChange={(e) => { const a = clamp((parseFloat(e.target.value) || 0) / 100, 0, 1); setAlpha(a); emit(rgb, a) }}
                className="w-9 bg-transparent text-right text-[12px] text-text-primary [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none" />
              <span className="text-[12px] text-text-muted">%</span>
            </>
          )}
        </div>

        {req.tokenSwatches && req.tokenSwatches.length > 0 && (
          <div className="pt-2">
            <div className="mb-1.5 text-[11px] text-text-muted">Library</div>
            <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
              {req.tokenSwatches.map((sw) => (
                <button
                  key={sw.id}
                  type="button"
                  title={`${sw.name} · ${sw.hex.toUpperCase()}`}
                  onClick={() => setFromRgb(parseHex(sw.hex) ?? { r: 0, g: 0, b: 0 })}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <span className="h-4 w-4 shrink-0 rounded-[4px]" style={{ background: sw.hex }} />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-text-primary">{sw.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {req.onCreateVar && (
          <div className="pt-2">
            <div className="mb-1.5 text-[11px] text-text-muted">Variables</div>
            {req.colorVars && req.colorVars.length > 0 && (
              <div className="mb-1.5 flex flex-col gap-0.5">
                {req.colorVars.map((cv) => (
                  <button key={cv.id} type="button" onClick={() => { req.onBindVar?.(cv.id); req.onClose() }}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-elevated">
                    <span className="h-4 w-4 shrink-0 rounded-[4px]" style={{ background: cv.hex }} />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-text-primary">{cv.name}</span>
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={() => { req.onCreateVar?.(hex); req.onClose() }}
              className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 3.5v9M3.5 8h9" /></svg>
              Create variable from this color
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
