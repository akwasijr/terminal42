// Controls that only the frame treatments need.
//
// A group is a switch with settings behind it, and an edge amount is four
// numbers that are nearly always the same number. Both patterns appear four
// times over in the effects panel and nowhere else in the app, which is why
// they live here rather than in the shared control set.

import { useId, useRef, useState, type ReactNode } from 'react'
import type { EdgeAmounts, EdgeFalloff } from '../../../../shared/motion/types'
import { SegmentedRow, SliderRow } from './controls'

/**
 * A treatment, named by its switch.
 *
 * The settings are hidden while the switch is off because they cannot do
 * anything: showing nine dead sliders reads as a broken panel rather than an
 * available one. Turning it on opens the group in the same gesture, so there
 * is never a step between saying yes and being able to say how much.
 */
export function FxGroup({
  label, enabled, onEnabled, children
}: {
  label: string
  enabled: boolean
  onEnabled: (v: boolean) => void
  children: ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const showing = enabled && open
  return (
    <div className={`flex flex-col gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${enabled ? 'bg-sunken' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={!enabled}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={showing}
          className="min-w-0 flex-1 rounded-md py-0.5 text-left text-[11px] text-text-secondary transition-colors enabled:hover:text-text-primary disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {label}
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={label}
          onClick={() => {
            const next = !enabled
            onEnabled(next)
            if (next) setOpen(true)
          }}
          className={`relative h-4 w-7 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${enabled ? 'bg-text-primary' : 'bg-raised'}`}
        >
          <span
            className={`absolute left-0 top-0.5 h-3 w-3 rounded-full bg-bg transition-transform ${enabled ? 'translate-x-3.5' : 'translate-x-0.5'}`}
          />
        </button>
      </div>
      {showing ? <div className="flex flex-col gap-2.5 pb-1">{children}</div> : null}
    </div>
  )
}

/**
 * Which way a light is coming from.
 *
 * A dial rather than a slider because the value wraps: 359 and 1 are next to
 * each other, and a track has to put them at opposite ends. The number field
 * beside it is not a fallback — typing 45 is faster than aiming at it, and it
 * is what makes the control usable without a pointer at all.
 */
export function AngleDial({
  label, value, onChange
}: { label: string; value: number; onChange: (v: number) => void }): React.JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null)
  const id = useId()
  const wrap = (v: number): number => ((Math.round(v) % 360) + 360) % 360

  const aim = (e: { clientX: number; clientY: number }): void => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    // Zero points down, and degrees run clockwise, to match where a light
    // overhead actually puts the shadow.
    onChange(wrap((Math.atan2(-dx, dy) * 180) / Math.PI))
  }

  // Straight down is zero, so the marker starts at the bottom and turns with
  // the angle.
  const rad = ((value + 90) * Math.PI) / 180
  const mx = 50 + Math.cos(rad) * 34
  const my = 50 + Math.sin(rad) * 34

  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-[11px] text-text-secondary">{label}</label>
      <div className="flex items-center gap-2">
        <div
          ref={ref}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={value}
          aria-valuetext={`${value} degrees`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId)
            aim(e)
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) aim(e)
          }}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 15 : 1
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(wrap(value + step)) }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(wrap(value - step)) }
          }}
          className="relative h-7 w-7 shrink-0 cursor-pointer rounded-full bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <span
            className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-primary"
            style={{ left: `${mx}%`, top: `${my}%` }}
          />
        </div>
        <input
          id={id}
          type="number"
          value={value}
          min={0}
          max={359}
          onChange={(e) => onChange(wrap(Number(e.target.value)))}
          className="w-12 rounded-md bg-sunken px-1.5 py-1 text-right text-[11px] tabular-nums text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        />
      </div>
    </div>
  )
}

/**
 * How far a treatment reaches in from each edge.
 *
 * Nearly every piece wants the same number on all four, so that is the
 * default view and one slider does it. Per-edge is there because the moment
 * you want it, four linked sliders are useless.
 */
export function EdgeRows({
  value, onChange
}: { value: EdgeAmounts; onChange: (v: EdgeAmounts) => void }): React.JSX.Element {
  const even = value.top === value.bottom && value.top === value.left && value.top === value.right
  const [perEdge, setPerEdge] = useState(!even)
  return (
    <>
      <SegmentedRow
        label="Edges"
        value={perEdge ? 'per' : 'all'}
        options={[
          { value: 'all', label: 'All' },
          { value: 'per', label: 'Per edge' }
        ]}
        onChange={(v) => {
          const per = v === 'per'
          setPerEdge(per)
          // Coming back to All has to pick one number, and the largest is the
          // one you can see — dropping to the smallest would look like the
          // effect had been turned down rather than evened out.
          if (!per) {
            const m = Math.max(value.top, value.bottom, value.left, value.right)
            onChange({ top: m, bottom: m, left: m, right: m })
          }
        }}
      />
      {perEdge ? (
        <>
          <SliderRow label="Top" value={value.top} min={0} max={100} step={1} onChange={(v) => onChange({ ...value, top: v })} />
          <SliderRow label="Bottom" value={value.bottom} min={0} max={100} step={1} onChange={(v) => onChange({ ...value, bottom: v })} />
          <SliderRow label="Left" value={value.left} min={0} max={100} step={1} onChange={(v) => onChange({ ...value, left: v })} />
          <SliderRow label="Right" value={value.right} min={0} max={100} step={1} onChange={(v) => onChange({ ...value, right: v })} />
        </>
      ) : (
        <SliderRow
          label="Reach"
          value={value.top}
          min={0}
          max={100}
          step={1}
          onChange={(v) => onChange({ top: v, bottom: v, left: v, right: v })}
        />
      )}
    </>
  )
}

export function FalloffRow({
  value, onChange
}: { value: EdgeFalloff; onChange: (v: EdgeFalloff) => void }): React.JSX.Element {
  return (
    <SegmentedRow
      label="Falloff"
      value={value}
      options={[
        { value: 'linear', label: 'Linear' },
        { value: 'soft', label: 'Soft' }
      ]}
      onChange={onChange}
    />
  )
}
