// The control vocabulary for Motion's panels.
//
// Every parameter in the app is one of four things — a number, a switch, a
// choice, or a colour — so there are four row components, plus one variant.
// SegmentedRow and SelectRow are both a choice; they differ only in how many
// options there are to show, because fourteen typefaces laid out flat would
// swamp the panel that a left/centre/right does not.
// Panels are then described as data rather than markup, which is what lets a
// component declare its own parameters and get a working panel without any
// panel code knowing it exists.

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { IconChevronRight } from '../icons'
import { useColorPicker } from './pickerContext'
import { useBrandColours } from '../../lib/motion/brand'

export function Section({
  title, children, defaultOpen = false, onReset, right, badge, reveal = false
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  onReset?: () => void
  right?: ReactNode
  badge?: string
  /**
   * While true the section stays open regardless of what the user last did
   * with it. Something outside the panel is pointing at what is inside — a
   * layer picked on the frame — and a shut section would hide the very
   * controls that selection was asking for.
   */
  reveal?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => {
    if (reveal) setOpen(true)
  }, [reveal])
  return (
    <section className="flex flex-col">
      {/* The header is the whole row, so the target is the width of the panel
          rather than the width of the word. Actions sit inside it but above
          it in the stacking order, which is why they are siblings of the
          button rather than children of it — a button cannot contain a
          button. */}
      <div
        className={`relative flex items-center rounded-lg bg-elevated transition-colors hover:bg-raised ${
          open ? 'rounded-b-none' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[12px] font-medium text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <span className="truncate">{title}</span>
          {badge ? (
            <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              {badge}
            </span>
          ) : null}
        </button>
        <div className="flex shrink-0 items-center gap-0.5 pr-2">
          {right}
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              title={`Reset ${title.toLowerCase()}`}
              aria-label={`Reset ${title.toLowerCase()}`}
              className="rounded-md p-1 text-text-muted transition-colors hover:bg-sunken hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <IconReset />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-hidden
            tabIndex={-1}
            className="pointer-events-none p-1 text-text-muted"
          >
            <span className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>
              <IconChevronRight />
            </span>
          </button>
        </div>
      </div>
      {open ? (
        <div className="flex flex-col gap-3 rounded-b-lg bg-elevated/60 px-3 pb-3 pt-2.5">{children}</div>
      ) : null}
    </section>
  )
}

function IconReset(): React.JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 2v6h6" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L3 8" />
    </svg>
  )
}

/**
 * A number with a drag-anywhere label.
 *
 * The label is a drag handle as well as a label because the useful range of
 * most of these is a few pixels wide on a 200px slider, and dragging the word
 * "Radius" is far easier to aim at than a 12px thumb.
 */
/**
 * A value that can change over the loop.
 *
 * `keyed` is whether the track exists at all, `here` whether one of its keys
 * sits at the instant showing now — the two differ, and the button has to say
 * which, or there is no way to tell "this animates" from "this animates and
 * you are looking at a key".
 */
export type KeyframeHandle = {
  keyed: boolean
  here: boolean
  onToggle: () => void
}

export function SliderRow({
  label, value, min, max, step = 0.01, unit, onChange, keyframe
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
  keyframe?: KeyframeHandle
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
    <div className="flex flex-col gap-1.5 py-0.5">
      <div className="flex items-center justify-between gap-2">
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
        {keyframe ? (
          <button
            type="button"
            onClick={keyframe.onToggle}
            title={
              keyframe.here
                ? `Remove the key on ${label} at this point in the loop`
                : `Key ${label} at this point in the loop`
            }
            aria-label={keyframe.here ? `Remove key on ${label}` : `Key ${label}`}
            aria-pressed={keyframe.here}
            className="ml-auto grid h-4 w-4 shrink-0 place-items-center rounded-sm text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <span
              className={`block h-[7px] w-[7px] rotate-45 ${
                keyframe.here
                  ? 'bg-accent'
                  : keyframe.keyed
                    ? 'bg-transparent ring-1 ring-inset ring-accent'
                    : 'bg-transparent ring-1 ring-inset ring-current'
              }`}
            />
          </button>
        ) : null}
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
          className="w-14 shrink-0 rounded-md bg-sunken px-1.5 py-1 text-right text-[10.5px] tabular-nums text-text-primary [appearance:textfield] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 [&::-webkit-inner-spin-button]:appearance-none"
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
        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${value ? 'bg-text-primary' : 'bg-raised'}`}
      >
        <span
          className={`absolute left-0 top-0.5 h-3 w-3 rounded-full bg-bg transition-transform ${value ? 'translate-x-3.5' : 'translate-x-0.5'}`}
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
  // An option you cannot read is not an option, so nothing here truncates.
  // The label and the group sit on one line while they both fit; when they
  // stop fitting the group wraps below the label, and if it is still too wide
  // the options wrap among themselves. Letting the browser measure this beats
  // guessing from the number of options, because a short set with a long
  // label overflows just as easily as a long one.
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
      {label ? <span className="shrink-0 text-[11px] text-text-secondary">{label}</span> : null}
      <div
        role="radiogroup"
        aria-label={label}
        className="flex max-w-full flex-none flex-wrap items-center gap-0.5 rounded-md bg-sunken p-0.5"
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`shrink-0 whitespace-nowrap rounded-[5px] px-2 py-1 text-[10.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
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

/**
 * A choice with more options than will sit on a row.
 *
 * The same kind of thing as SegmentedRow, shown differently because of scale
 * alone. It is a native select rather than a bespoke menu so that typing a
 * letter jumps to a family and the keyboard works without any of it being
 * reimplemented here.
 */
export function SelectRow<T extends string | number>({
  label, value, options, onChange
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
}): React.JSX.Element {
  const id = useId()
  const numeric = typeof value === 'number'
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="shrink-0 text-[11px] text-text-secondary">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange((numeric ? Number(e.target.value) : e.target.value) as T)}
        className="min-w-0 max-w-[60%] rounded-sm bg-sunken px-1.5 py-1 text-[10.5px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

/**
 * A colour, edited the way Form edits colour.
 *
 * The swatch opens the app's own picker rather than the browser's, so hex,
 * opacity and the design system's colour variables are all in the same place
 * they are everywhere else. Outside a picker host it falls back to the native
 * input, so the row still works rather than becoming inert.
 */
export function ColorRow({
  label, value, onChange
}: { label: string; value: string; onChange: (v: string) => void }): React.JSX.Element {
  const id = useId()
  const openPicker = useColorPicker()
  const brand = useBrandColours()
  const swatch = useRef<HTMLButtonElement>(null)
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'

  const open = (): void => {
    const r = swatch.current?.getBoundingClientRect()
    if (!openPicker || !r) return
    openPicker({
      value: safe,
      opacity: 1,
      showAlpha: false,
      anchor: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
      // The brand's own colours, offered wherever a colour is asked for, so
      // that staying on palette is the easy path rather than a hex you have
      // to remember and retype.
      colorVars: brand.map((hex, i) => ({ id: `brand-${i}`, name: hex, hex })),
      onChange: (hex) => onChange(hex)
    })
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-[11px] text-text-secondary">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} hex value`}
          className="w-20 rounded-sm bg-sunken px-1.5 py-0.5 font-mono text-[10.5px] uppercase text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        />
        {openPicker ? (
          <button
            ref={swatch}
            id={id}
            type="button"
            onClick={open}
            aria-label={`Edit ${label.toLowerCase()}`}
            // An inset ring rather than a border: it reads as the edge of the
            // colour instead of a line drawn around it, and stays visible on
            // a swatch the same tone as the panel.
            className="h-5 w-5 shrink-0 rounded-[5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            style={{ background: safe, boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.14)' }}
          />
        ) : (
          <input
            id={id}
            type="color"
            value={safe}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`Edit ${label.toLowerCase()}`}
            className="h-5 w-5 shrink-0 cursor-pointer rounded-sm bg-transparent p-0"
          />
        )}
      </div>
    </div>
  )
}

/**
 * A quiet fold inside a section.
 *
 * Distinct from Section: a Section is a subject, and this is the tail of one.
 * It gets no card of its own, because giving it one would make a refinement
 * look like a peer of the thing it refines.
 */
export function Disclosure({
  label, children
}: { label: string; children: ReactNode }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 self-start rounded-md py-0.5 text-[11px] text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <span className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>
          <IconChevronRight />
        </span>
        {open ? 'Fewer settings' : label}
      </button>
      {open ? <div className="flex flex-col gap-2.5">{children}</div> : null}
    </div>
  )
}
