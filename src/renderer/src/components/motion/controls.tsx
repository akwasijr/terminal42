// The control vocabulary for Motion's panels.
//
// Every parameter in the app is one of four things — a number, a switch, a
// choice, or a colour — so there are four row components and nothing else.
// Panels are then described as data rather than markup, which is what lets a
// component declare its own parameters and get a working panel without any
// panel code knowing it exists.

import { useCallback, useId, useRef, useState, type ReactNode } from 'react'
import { IconChevronRight } from '../icons'

export function Section({
  title, children, defaultOpen = true, onReset, right
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  onReset?: () => void
  right?: ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-border/60 last:border-b-0">
      <header className="flex items-center gap-1 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-1.5 text-left text-[11.5px] font-medium text-text-primary hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-sm"
        >
          <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>
            <IconChevronRight />
          </span>
          {title}
        </button>
        {right}
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            title={`Reset ${title.toLowerCase()}`}
            className="rounded-sm px-1.5 py-0.5 text-[10.5px] text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Reset
          </button>
        ) : null}
      </header>
      {open ? <div className="flex flex-col gap-2 px-3 pb-3">{children}</div> : null}
    </section>
  )
}

/**
 * A number with a drag-anywhere label.
 *
 * The label is a drag handle as well as a label because the useful range of
 * most of these is a few pixels wide on a 200px slider, and dragging the word
 * "Radius" is far easier to aim at than a 12px thumb.
 */
export function SliderRow({
  label, value, min, max, step = 0.01, unit, onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}): React.JSX.Element {
  const id = useId()
  const drag = useRef<{ x: number; start: number } | null>(null)

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLLabelElement>) => {
    drag.current = { x: e.clientX, start: value }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [value])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLLabelElement>) => {
    const d = drag.current
    if (!d) return
    const span = max - min
    const next = d.start + ((e.clientX - d.x) / 220) * span
    onChange(Math.min(max, Math.max(min, roundTo(next, step))))
  }, [max, min, onChange, step])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLLabelElement>) => {
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={id}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="cursor-ew-resize select-none text-[11px] text-text-secondary"
        >
          {label}
        </label>
        <input
          type="number"
          value={Number(value.toFixed(3))}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
          }}
          className="w-16 rounded-sm bg-sunken px-1.5 py-0.5 text-right font-mono text-[10.5px] text-text-primary [appearance:textfield] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 [&::-webkit-inner-spin-button]:appearance-none"
          aria-label={`${label}${unit ? ` in ${unit}` : ''}`}
        />
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="motion-slider"
      />
    </div>
  )
}

function roundTo(v: number, step: number): number {
  if (!Number.isFinite(step) || step <= 0) return v
  return Math.round(v / step) * step
}

export function ToggleRow({
  label, value, onChange, hint
}: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-text-secondary" title={hint}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${value ? 'bg-accent' : 'bg-raised'}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-bg transition-transform ${value ? 'translate-x-3.5' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  )
}

export function SegmentedRow<T extends string>({
  label, value, options, onChange
}: {
  label?: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
}): React.JSX.Element {
  return (
    <div className={label ? 'flex items-center justify-between gap-2' : ''}>
      {label ? <span className="text-[11px] text-text-secondary">{label}</span> : null}
      <div role="radiogroup" aria-label={label} className="flex items-center gap-0.5 rounded-sm bg-sunken p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-[4px] px-2 py-0.5 text-[10.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
              value === o.value ? 'bg-raised text-text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ColorRow({
  label, value, onChange
}: { label: string; value: string; onChange: (v: string) => void }): React.JSX.Element {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-[11px] text-text-secondary">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} hex value`}
          className="w-20 rounded-sm bg-sunken px-1.5 py-0.5 font-mono text-[10.5px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        />
        <input
          id={id}
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-5 w-5 cursor-pointer rounded-sm border border-border bg-transparent p-0"
        />
      </div>
    </div>
  )
}
