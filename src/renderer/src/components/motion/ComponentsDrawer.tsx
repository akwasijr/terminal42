// The left drawer: which arrangement, and which tuning of it.
//
// Components and their presets share one panel because they are one decision
// made at two levels of detail — "a ring" then "that ring". The panel drills
// down rather than expanding in place: fifteen previews shown inside a list
// of eleven components leaves each preview the size of a postage stamp, and a
// preview you cannot read is worse than no preview at all.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentId, MotionDoc } from '../../../../shared/motion/types'
import { MOTION_COMPONENTS, SOON_COMPONENTS, componentFor } from '../../../../shared/motion/registry'
import { PRESETS_PER_COMPONENT, presetLabel, presetParams } from '../../../../shared/motion/presets'
import { drawPresetThumb } from '../../lib/motion/thumb'
import { IconChevronRight } from '../icons'

export type SavedLayout = {
  id: string
  name: string
  componentId: string
  doc: unknown
  thumbnail: string | null
  createdAt: number
}

export function ComponentsDrawer({
  doc, onPickComponent, onPickPreset, layouts, onApplyLayout, onDeleteLayout, width
}: {
  doc: MotionDoc
  width: number
  onPickComponent: (id: ComponentId) => void
  onPickPreset: (index: number) => void
  layouts: SavedLayout[]
  onApplyLayout: (l: SavedLayout) => void
  onDeleteLayout: (id: string) => void
}): React.JSX.Element {
  const [tab, setTab] = useState<'components' | 'layouts'>('components')
  // Which component's presets are open. Null is the list of components.
  const [drilled, setDrilled] = useState<ComponentId | null>(null)

  return (
    <aside style={{ width }} className="flex h-full shrink-0 flex-col overflow-hidden rounded-panel bg-surface">
      <header className="flex shrink-0 items-center gap-0.5 rounded-lg bg-sunken p-0.5 m-2">
        {(['components', 'layouts'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`flex-1 rounded-md px-2 py-1.5 text-[11.5px] capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
              tab === t ? 'bg-raised text-text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {t}
          </button>
        ))}
      </header>

      {tab === 'components' ? (
        drilled ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-1 px-2 pb-1">
              <button
                type="button"
                onClick={() => setDrilled(null)}
                aria-label="Back to all components"
                className="rounded-sm px-1 py-1 text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <span className="inline-block rotate-180"><IconChevronRight /></span>
              </button>
              <span className="text-[12px] text-text-primary">{componentFor(drilled).label}</span>
            </div>
            <PresetList
              doc={doc}
              componentId={drilled}
              onPick={(i) => {
                if (doc.componentId !== drilled) onPickComponent(drilled)
                onPickPreset(i)
              }}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            <ul className="flex flex-col gap-0.5">
              {MOTION_COMPONENTS.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => { onPickComponent(c.id); setDrilled(c.id) }}
                    aria-current={doc.componentId === c.id ? 'true' : undefined}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                      doc.componentId === c.id
                        ? 'bg-elevated font-medium text-text-primary'
                        : 'text-text-secondary hover:bg-elevated/60 hover:text-text-primary'
                    }`}
                  >
                    <span className="flex-1">{c.label}</span>
                    {doc.componentId === c.id ? (
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
                    ) : null}
                    <span className="text-text-muted"><IconChevronRight /></span>
                  </button>
                </li>
              ))}
            </ul>

            <p className="px-3 pb-1 pt-4 text-[11px] font-medium text-text-muted">Not built yet</p>
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
        )
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
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

/**
 * Every preset for one component, full width and labelled.
 *
 * Full width because a preset is a picture and the whole point is to compare
 * pictures; the label is there because "the one with the cards leaning back"
 * is not something you can say to yourself without a name to hang it on.
 */
function PresetList({
  doc, componentId, onPick
}: {
  doc: MotionDoc
  componentId: ComponentId
  onPick: (i: number) => void
}): React.JSX.Element {
  const component = componentFor(componentId)
  // The preview has to show this component even when the document is still on
  // a different one, or drilling into Ring from a Carousel would show fifteen
  // carousels.
  const previewDoc = useMemo<MotionDoc>(() => ({ ...doc, componentId }), [doc, componentId])
  const current = doc.componentId === componentId ? doc.params[componentId] : undefined
  const activeIndex = useMemo(() => {
    for (let i = 0; i < PRESETS_PER_COMPONENT; i++) {
      if (sameParams(presetParams(component, i), current)) return i
    }
    return -1
  }, [component, current])

  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3">
      {Array.from({ length: PRESETS_PER_COMPONENT }, (_, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => onPick(i)}
            aria-pressed={activeIndex === i}
            className={`relative block w-full overflow-hidden rounded-sm bg-sunken transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
              activeIndex === i ? 'ring-1 ring-border-strong' : 'opacity-80 hover:opacity-100'
            }`}
          >
            <PresetThumb doc={previewDoc} index={i} />
            <span className="absolute bottom-1 left-2 text-[10px] text-text-secondary">
              {component.label} {presetLabel(i)}
            </span>
            {activeIndex === i ? (
              <span aria-hidden className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  )
}

const THUMB_W = 208
const THUMB_H = 117

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

  return <canvas ref={ref} className="block w-full" style={{ aspectRatio: `${THUMB_W} / ${THUMB_H}` }} aria-hidden="true" />
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
