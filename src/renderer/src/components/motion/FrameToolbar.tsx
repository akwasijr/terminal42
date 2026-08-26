// The toolbar that floats over the frame.
//
// Everything here is about the *frame* rather than the motion: how big it is,
// what colour sits behind it, whether the grid shows, and how you are allowed
// to drag. These used to live in the side panels, which was wrong — you judge
// a background by looking at it, and looking at it means the control belongs
// where your eye already is.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useColorPicker } from './pickerContext'
import type { FrameAspect, MotionDoc } from '../../../../shared/motion/types'

export type FrameFit = 'contain' | 'edge'

const ASPECTS: ReadonlyArray<{ id: FrameAspect; label: string }> = [
  { id: '16:9', label: '16:9' },
  { id: '4:3', label: '4:3' },
  { id: '1:1', label: '1:1' },
  { id: '4:5', label: '4:5' },
  { id: '9:16', label: '9:16' }
]

// A short row of backgrounds you would actually reach for, dark to light with
// two tinted neutrals. Anything else is a hex away.
const SWATCHES: ReadonlyArray<{ value: string; label: string }> = [
  { value: '#000000', label: 'Black' },
  { value: '#111113', label: 'Near black' },
  { value: '#3a3a3f', label: 'Slate' },
  { value: '#8a8a90', label: 'Grey' },
  { value: '#cfcac2', label: 'Stone' },
  { value: '#f2f0ec', label: 'Paper' },
  { value: '#ffffff', label: 'White' }
]

const GRID_PRESETS: ReadonlyArray<{ columns: number; rows: number }> = [
  { columns: 3, rows: 3 },
  { columns: 4, rows: 4 },
  { columns: 6, rows: 4 },
  { columns: 12, rows: 8 }
]

export function FrameToolbar({
  doc,
  onChange,
  playing,
  onTogglePlaying,
  onReplay,
  replayLooping,
  poseMode,
  onPoseMode,
  fit,
  onFit,
  onResetView,
  viewChanged
}: {
  doc: MotionDoc
  onChange: (patch: Partial<MotionDoc>) => void
  playing: boolean
  onTogglePlaying: () => void
  /** Replay the entrance animation. A second press leaves it looping. */
  onReplay: () => void
  replayLooping: boolean
  poseMode: boolean
  onPoseMode: (on: boolean) => void
  fit: FrameFit
  onFit: (fit: FrameFit) => void
  onResetView: () => void
  /** Whether the view has been turned or zoomed away from where it started. */
  viewChanged: boolean
}): React.JSX.Element {
  const frame = doc.frame
  const setFrame = (p: Partial<MotionDoc['frame']>): void => onChange({ frame: { ...frame, ...p } })

  // One popover at a time. Each panel used to own its own open flag and close
  // itself on an outside mousedown, which works for a mouse but not for a
  // keyboard: Enter and Space fire click with no mousedown at all, so panels
  // stacked on top of each other. Single selection cannot express that state.
  const [openPop, setOpenPop] = useState<string | null>(null)

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-2">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-panel bg-surface/90 px-1 py-1 shadow-sm backdrop-blur">
        <ToolButton
          label={replayLooping ? 'Stop replaying the entrance' : 'Replay the entrance animation'}
          onClick={onReplay}
          active={replayLooping}
        >
          <PlayGlyph />
        </ToolButton>
        <ToolButton
          label={playing ? 'Pause the animation' : 'Run the animation'}
          onClick={onTogglePlaying}
          active={playing}
        >
          <LoopGlyph />
        </ToolButton>

        <Divider />

        <Popover label="Frame size" open={openPop === 'frame'} onOpen={(o) => setOpenPop(o ? 'frame' : null)} trigger={<span className="font-mono text-[10.5px]">{frame.aspect}</span>}>
          <PopTitle>Frame size</PopTitle>
          <div className="flex flex-wrap gap-1">
            {ASPECTS.map((a) => (
              <Chip key={a.id} active={frame.aspect === a.id} onClick={() => setFrame({ aspect: a.id })}>
                {a.label}
              </Chip>
            ))}
          </div>
          <PopTitle>Corners</PopTitle>
          <Stepper value={frame.corners} min={0} max={48} step={2} suffix="px" onChange={(v) => setFrame({ corners: v })} />
          <PopTitle>Gap</PopTitle>
          <Stepper value={frame.gap} min={0} max={60} step={2} suffix="%" onChange={(v) => setFrame({ gap: v })} />
        </Popover>

        <ToolButton
          label={fit === 'contain' ? 'Fill the whole panel' : 'Fit the frame in view'}
          onClick={() => onFit(fit === 'contain' ? 'edge' : 'contain')}
          active={fit === 'edge'}
        >
          {fit === 'contain' ? <ExpandGlyph /> : <ContractGlyph />}
        </ToolButton>

        <Divider />

        <Popover
          open={openPop === 'background'}
          onOpen={(o) => setOpenPop(o ? 'background' : null)}
          label="Background"
          trigger={
            <span
              className="block h-3.5 w-3.5 rounded-sm ring-1 ring-inset ring-border"
              style={{ background: frame.background }}
            />
          }
        >
          <PopTitle>Background</PopTitle>
          <div className="flex flex-wrap gap-1">
            {SWATCHES.map((s) => (
              <button
                key={s.value}
                type="button"
                title={s.label}
                aria-label={s.label}
                aria-pressed={frame.background.toLowerCase() === s.value}
                onClick={() => setFrame({ background: s.value })}
                className={`h-5 w-5 rounded-sm ring-1 ring-inset transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  frame.background.toLowerCase() === s.value ? 'ring-accent' : 'ring-border'
                }`}
                style={{ background: s.value }}
              />
            ))}
          </div>
          <HexField value={frame.background} onChange={(v) => setFrame({ background: v })} />
        </Popover>

        <Divider />

        <ToolButton
          label={frame.gridVisible ? 'Hide the grid' : 'Show the grid'}
          onClick={() => setFrame({ gridVisible: !frame.gridVisible })}
          active={frame.gridVisible}
        >
          <GridGlyph />
        </ToolButton>
        {frame.gridVisible ? (
          <Popover label="Grid size" open={openPop === 'grid'} onOpen={(o) => setOpenPop(o ? 'grid' : null)} trigger={<span className="font-mono text-[10.5px]">{frame.gridColumns}×{frame.gridRows}</span>}>
            <PopTitle>Grid size</PopTitle>
            <div className="flex flex-wrap gap-1">
              {GRID_PRESETS.map((g) => (
                <Chip
                  key={`${g.columns}x${g.rows}`}
                  active={frame.gridColumns === g.columns && frame.gridRows === g.rows}
                  onClick={() => setFrame({ gridColumns: g.columns, gridRows: g.rows })}
                >
                  {g.columns}×{g.rows}
                </Chip>
              ))}
            </div>
            <LabelledStepper label="Columns" value={frame.gridColumns} min={1} max={48} step={1} onChange={(v) => setFrame({ gridColumns: v })} />
            <LabelledStepper label="Rows" value={frame.gridRows} min={1} max={48} step={1} onChange={(v) => setFrame({ gridRows: v })} />
            <PopTitle>Line colour</PopTitle>
            <HexField value={frame.gridColour} onChange={(v) => setFrame({ gridColour: v })} />
            <label className="mt-1 flex items-center gap-2 text-[11px] text-text-secondary">
              <input
                type="checkbox"
                checked={frame.gridInExport}
                onChange={(e) => setFrame({ gridInExport: e.target.checked })}
                className="accent-accent"
              />
              Keep the grid in exports
            </label>
          </Popover>
        ) : null}

        <Divider />

        <ToolButton
          label={poseMode ? 'Stop posing. Drag turns the piece.' : 'Pose: drag to tilt, Shift to scale, Cmd to move'}
          onClick={() => onPoseMode(!poseMode)}
          active={poseMode}
        >
          <GlobeGlyph />
        </ToolButton>
        <ToolButton label="Put the view back" onClick={onResetView} disabled={!viewChanged}>
          <ResetGlyph />
        </ToolButton>
      </div>
    </div>
  )
}

function ToolButton({
  label, onClick, active = false, disabled = false, children
}: {
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={`flex h-7 min-w-7 items-center justify-center rounded-sm px-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-40 ${
        active ? 'bg-raised text-text-primary' : 'text-text-secondary hover:bg-raised hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  )
}

function Divider(): React.JSX.Element {
  return <span aria-hidden className="mx-0.5 h-4 w-px bg-border/70" />
}

/**
 * A button that opens a small panel under itself.
 *
 * The panel closes on Escape and on a click anywhere else, because a toolbar
 * that stays open while you go back to dragging the frame is in the way of
 * the only thing you opened it to look at.
 */
function Popover({ label, trigger, children, open, onOpen }: {
  label: string
  trigger: ReactNode
  children: ReactNode
  open: boolean
  onOpen: (open: boolean) => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpen])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => onOpen(!open)}
        title={label}
        aria-label={label}
        aria-expanded={open}
        className={`flex h-7 min-w-7 items-center justify-center rounded-sm px-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
          open ? 'bg-raised text-text-primary' : 'text-text-secondary hover:bg-raised hover:text-text-primary'
        }`}
      >
        {trigger}
      </button>
      {open ? (
        <div className="absolute left-1/2 top-9 z-20 flex w-52 -translate-x-1/2 flex-col gap-1.5 rounded-panel bg-surface p-2.5 shadow-md">
          {children}
        </div>
      ) : null}
    </div>
  )
}

function PopTitle({ children }: { children: ReactNode }): React.JSX.Element {
  return <p className="text-[11px] font-medium text-text-muted">{children}</p>
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-sm px-2 py-1 font-mono text-[10.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
        active ? 'bg-elevated text-text-primary' : 'bg-raised text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  )
}

function LabelledStepper({
  label, value, min, max, step, onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-text-secondary">{label}</span>
      <Stepper value={value} min={min} max={max} step={step} onChange={onChange} />
    </div>
  )
}

function Stepper({
  value, min, max, step, suffix, onChange
}: {
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (v: number) => void
}): React.JSX.Element {
  const clamp = (v: number): number => Math.min(max, Math.max(min, v))
  return (
    <div className="flex items-center gap-0.5">
      <StepButton label={`Less (${min} lowest)`} onClick={() => onChange(clamp(value - step))} disabled={value <= min}>−</StepButton>
      <span className="w-11 text-center font-mono text-[10.5px] text-text-primary">{value}{suffix ?? ''}</span>
      <StepButton label={`More (${max} highest)`} onClick={() => onChange(clamp(value + step))} disabled={value >= max}>+</StepButton>
    </div>
  )
}

function StepButton({
  label, onClick, disabled, children
}: {
  label: string
  onClick: () => void
  disabled: boolean
  children: ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-5 w-5 items-center justify-center rounded-sm bg-raised text-[11px] leading-none text-text-secondary hover:text-text-primary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      {children}
    </button>
  )
}

/**
 * A hex field that only commits when what you typed is a colour.
 *
 * Typing a hex means passing through "#", "#f", "#ff" — all invalid — so
 * committing on every keystroke would flash the frame black on the way to a
 * colour you meant.
 */
function HexField({ value, onChange }: { value: string; onChange: (v: string) => void }): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = (v: string): void => {
    const trimmed = v.trim()
    const hex = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) onChange(hex.toLowerCase())
    else setDraft(value)
  }
  const openPicker = useColorPicker()
  const swatch = useRef<HTMLButtonElement>(null)
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
  const open = (): void => {
    const r = swatch.current?.getBoundingClientRect()
    if (!openPicker || !r) return
    openPicker({
      value: safe,
      opacity: 1,
      showAlpha: false,
      anchor: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
      onChange: (hex) => onChange(hex)
    })
  }
  return (
    <div className="flex items-center gap-1.5">
      {openPicker ? (
        <button
          ref={swatch}
          type="button"
          onClick={open}
          aria-label="Pick a colour"
          className="h-6 w-7 shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          style={{ background: safe, boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.14)' }}
        />
      ) : (
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Pick a colour"
          className="h-6 w-7 shrink-0 cursor-pointer rounded-sm bg-transparent p-0.5"
        />
      )}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(e.currentTarget.value) }}
        aria-label="Colour as hex"
        spellCheck={false}
        className="min-w-0 flex-1 rounded-sm bg-raised px-1.5 py-1 font-mono text-[10.5px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      />
    </div>
  )
}

const S = { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

function PlayGlyph(): React.JSX.Element {
  return <svg {...S}><path d="M5 3.5l7 4.5-7 4.5z" fill="currentColor" stroke="none" /></svg>
}
function LoopGlyph(): React.JSX.Element {
  return <svg {...S}><path d="M3 8a5 5 0 0 1 8.5-3.5L13 6" /><path d="M13 3v3h-3" /><path d="M13 8a5 5 0 0 1-8.5 3.5L3 10" /><path d="M3 13v-3h3" /></svg>
}
function ExpandGlyph(): React.JSX.Element {
  return <svg {...S}><path d="M6 2H2v4" /><path d="M10 2h4v4" /><path d="M6 14H2v-4" /><path d="M10 14h4v-4" /></svg>
}
function ContractGlyph(): React.JSX.Element {
  return <svg {...S}><path d="M2 6h4V2" /><path d="M14 6h-4V2" /><path d="M2 10h4v4" /><path d="M14 10h-4v4" /></svg>
}
function GridGlyph(): React.JSX.Element {
  return <svg {...S}><rect x="2" y="2" width="12" height="12" rx="1" /><path d="M6 2v12M10 2v12M2 6h12M2 10h12" /></svg>
}
function GlobeGlyph(): React.JSX.Element {
  return <svg {...S}><circle cx="8" cy="8" r="6" /><path d="M2 8h12" /><path d="M8 2c2 2 2 10 0 12M8 2C6 4 6 12 8 14" /></svg>
}
function ResetGlyph(): React.JSX.Element {
  return <svg {...S}><path d="M3 8a5 5 0 1 1 1.6 3.7" /><path d="M2 5v3.2h3.2" /></svg>
}
