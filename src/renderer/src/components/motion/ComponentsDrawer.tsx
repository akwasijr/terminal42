// The left drawer: which arrangement, and which tuning of it.
//
// Components and their presets share one panel because they are one decision
// made at two levels of detail — "a ring" then "that ring". Splitting them
// across two places would mean picking a component, hunting for its presets,
// and losing the comparison that makes presets worth having.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentId, MotionDoc } from '../../../../shared/motion/types'
import { MOTION_COMPONENTS, SOON_COMPONENTS, componentFor } from '../../../../shared/motion/registry'
import { PRESETS_PER_COMPONENT, presetLabel, presetParams } from '../../../../shared/motion/presets'
import { drawPresetThumb } from '../../lib/motion/thumb'

export type SavedLayout = {
  id: string
  name: string
  componentId: string
  doc: unknown
  thumbnail: string | null
  createdAt: number
}

export function ComponentsDrawer({
  doc, onPickComponent, onPickPreset, layouts, onApplyLayout, onDeleteLayout, onSaveLayout,
  naming, layoutName, onLayoutNameChange, onConfirmName, onCancelName
}: {
  doc: MotionDoc
  onPickComponent: (id: ComponentId) => void
  onPickPreset: (index: number) => void
  layouts: SavedLayout[]
  onApplyLayout: (l: SavedLayout) => void
  onDeleteLayout: (id: string) => void
  onSaveLayout: () => void
  /** True while the drawer is asking what to call the layout. */
  naming: boolean
  layoutName: string
  onLayoutNameChange: (name: string) => void
  onConfirmName: () => void
  onCancelName: () => void
}): React.JSX.Element {
  const [tab, setTab] = useState<'components' | 'layouts'>('components')

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col overflow-hidden rounded-panel bg-surface">
      <header className="flex shrink-0 items-center gap-0.5 p-2">
        {(['components', 'layouts'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`rounded-sm px-2 py-1 text-[11.5px] capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
              tab === t ? 'bg-raised text-text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {t}
          </button>
        ))}
      </header>

      {tab === 'components' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <ul className="flex flex-col gap-0.5">
            {MOTION_COMPONENTS.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onPickComponent(c.id)}
                  aria-current={doc.componentId === c.id ? 'true' : undefined}
                  className={`w-full rounded-sm px-2 py-1.5 text-left text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    doc.componentId === c.id
                      ? 'bg-accent/15 text-accent'
                      : 'text-text-secondary hover:bg-raised hover:text-text-primary'
                  }`}
                >
                  {c.label}
                </button>
                {doc.componentId === c.id ? (
                  <PresetStrip doc={doc} onPick={onPickPreset} />
                ) : null}
              </li>
            ))}
          </ul>

          <p className="px-2 pb-1 pt-3 text-[10.5px] uppercase tracking-wide text-text-muted">Not built yet</p>
          <ul className="flex flex-col gap-0.5">
            {SOON_COMPONENTS.map((name) => (
              <li key={name}>
                <span
                  className="flex cursor-not-allowed items-center justify-between rounded-sm px-2 py-1.5 text-[12px] text-text-muted/60"
                  title="Not built yet"
                >
                  {name}
                  <span className="rounded-full bg-raised px-1.5 py-0.5 text-[9.5px] text-text-muted">Soon</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <button
            type="button"
            onClick={onSaveLayout}
            className="mb-2 w-full rounded-sm bg-raised px-2 py-1.5 text-[11.5px] text-text-primary hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Save this layout
          </button>
          {naming ? (
            <form
              className="mb-2 flex items-center gap-1"
              onSubmit={(e) => { e.preventDefault(); onConfirmName() }}
            >
              <input
                autoFocus
                value={layoutName}
                onChange={(e) => onLayoutNameChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') onCancelName() }}
                aria-label="Layout name"
                className="min-w-0 flex-1 rounded-sm bg-sunken px-1.5 py-1 text-[11.5px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              />
              <button
                type="submit"
                className="rounded-sm bg-raised px-2 py-1 text-[11px] text-text-primary hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                Save
              </button>
            </form>
          ) : null}
          {layouts.length === 0 ? (
            <p className="px-2 py-6 text-center text-[11.5px] text-text-muted">
              Saved layouts keep a look without its pictures, so you can put new images into the same motion.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {layouts.map((l) => (
                <li key={l.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onApplyLayout(l)}
                    className="flex flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[12px] text-text-secondary hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    {l.thumbnail ? (
                      <img src={l.thumbnail} alt="" width={36} height={20} className="rounded-[3px]" />
                    ) : null}
                    <span className="truncate">{l.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteLayout(l.id)}
                    aria-label={`Delete layout ${l.name}`}
                    className="rounded-sm px-1.5 py-1 text-[10.5px] text-text-muted opacity-0 transition-opacity hover:text-error focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 group-hover:opacity-100"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  )
}

function PresetStrip({ doc, onPick }: { doc: MotionDoc; onPick: (i: number) => void }): React.JSX.Element {
  const component = componentFor(doc.componentId)
  const current = doc.params[doc.componentId]
  const activeIndex = useMemo(() => {
    for (let i = 0; i < PRESETS_PER_COMPONENT; i++) {
      if (sameParams(presetParams(component, i), current)) return i
    }
    return -1
  }, [component, current])

  return (
    <ul className="mt-1 grid grid-cols-3 gap-1 px-1 pb-1">
      {Array.from({ length: PRESETS_PER_COMPONENT }, (_, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => onPick(i)}
            aria-pressed={activeIndex === i}
            title={`${component.label} ${presetLabel(i)}`}
            className={`relative block w-full overflow-hidden rounded-sm bg-sunken transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
              activeIndex === i ? 'ring-1 ring-accent' : 'hover:ring-1 hover:ring-border-strong'
            }`}
          >
            <PresetThumb doc={doc} index={i} />
            <span className="absolute bottom-0.5 left-1 font-mono text-[8.5px] text-text-muted">{presetLabel(i)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

const THUMB_W = 62
const THUMB_H = 42

function PresetThumb({ doc, index }: { doc: MotionDoc; index: number }): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const component = componentFor(doc.componentId)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const preset: MotionDoc = {
      ...doc,
      params: { ...doc.params, [doc.componentId]: presetParams(component, index) }
    }
    const styles = getComputedStyle(document.documentElement)
    const rgb = (name: string, fallback: string): string => {
      const v = styles.getPropertyValue(name).trim()
      return v ? `rgb(${v})` : fallback
    }
    // A fixed phase, not a live one: a thumbnail that animated would make the
    // strip the busiest thing on screen and pull the eye away from the frame.
    drawPresetThumb(canvas, preset, 0.18, {
      width: THUMB_W,
      height: THUMB_H,
      accent: rgb('--accent', '#7aa2f7'),
      muted: rgb('--border-strong', '#555')
    })
  }, [component, doc, index])

  return <canvas ref={ref} style={{ width: THUMB_W, height: THUMB_H }} aria-hidden="true" />
}

function sameParams(a: Record<string, unknown>, b: Record<string, unknown> | undefined): boolean {
  if (!b) return false
  const keys = Object.keys(a)
  if (keys.length === 0) return false
  return keys.every((k) => {
    const av = a[k]
    const bv = b[k]
    return typeof av === 'number' && typeof bv === 'number' ? Math.abs(av - bv) < 1e-6 : av === bv
  })
}
