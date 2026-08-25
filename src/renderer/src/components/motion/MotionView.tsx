// Motion's front door: the pieces you have, and a way to start another.
//
// The list is deliberately thin. Everything interesting happens in the studio,
// and a list that tried to preview each piece in 3D would spend the GPU on
// nothing — the saved thumbnail is a frame of the real thing, captured while
// the piece was last open.

import { useCallback, useEffect, useState } from 'react'
import type { MotionDoc } from '../../../../shared/motion/types'
import { emptyDoc, hydrateDoc } from '../../../../shared/motion/defaults'
import { MOTION_COMPONENTS } from '../../../../shared/motion/registry'
import { MotionStudio } from './MotionStudio'
import { IconPlus, IconTrash } from '../icons'

type Row = { id: string; title: string; doc: unknown; thumbnail: string | null; updatedAt: number }

export function MotionView(): React.JSX.Element {
  const [rows, setRows] = useState<Row[]>([])
  const [open, setOpen] = useState<{ id: string; title: string; doc: MotionDoc } | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (): Promise<void> => {
    const list = await window.terminal42.motion.list()
    setRows(list as Row[])
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const create = async (componentId: MotionDoc['componentId']): Promise<void> => {
    const doc = emptyDoc(componentId)
    const label = MOTION_COMPONENTS.find((c) => c.id === componentId)?.label ?? 'Motion'
    const row = await window.terminal42.motion.create(label, doc)
    await refresh()
    setOpen({ id: row.id, title: row.title, doc })
  }

  const openRow = (row: Row): void => {
    setOpen({ id: row.id, title: row.title, doc: hydrateDoc(row.doc) })
  }

  const remove = async (id: string): Promise<void> => {
    await window.terminal42.motion.delete(id)
    await refresh()
  }

  if (open) {
    return (
      <MotionStudio
        key={open.id}
        id={open.id}
        title={open.title}
        initialDoc={open.doc}
        onRename={(t) => {
          setOpen((o) => (o ? { ...o, title: t } : o))
          void window.terminal42.motion.rename(open.id, t)
        }}
        onClose={() => { setOpen(null); void refresh() }}
      />
    )
  }

  return (
    <main className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-6">
      <header className="flex items-baseline gap-3">
        <h1 className="text-[15px] font-medium text-text-primary">Motion</h1>
        <p className="text-[12px] text-text-secondary">
          Set numbers, get a scene of cards on a seamless loop. Export it as video or a still.
        </p>
      </header>

      <section>
        <h2 className="pb-2 text-[11px] uppercase tracking-wide text-text-muted">Start from</h2>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
          {MOTION_COMPONENTS.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => void create(c.id)}
                className="flex w-full items-center gap-2 rounded-md bg-surface px-3 py-2.5 text-left text-[12px] text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <IconPlus />
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="min-h-0">
        <h2 className="pb-2 text-[11px] uppercase tracking-wide text-text-muted">Your pieces</h2>
        {loading ? (
          <p className="text-[12px] text-text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-md bg-surface px-4 py-8 text-center text-[12px] text-text-muted">
            Nothing here yet. Pick an arrangement above and start turning the numbers.
          </p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {rows.map((row) => (
              <li key={row.id} className="group relative">
                <button
                  type="button"
                  onClick={() => openRow(row)}
                  className="block w-full overflow-hidden rounded-md bg-surface text-left transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <span className="motion-checker block aspect-video w-full overflow-hidden">
                    {row.thumbnail ? (
                      <img src={row.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="block truncate px-3 py-2 text-[12px] text-text-primary">{row.title}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void remove(row.id)}
                  aria-label={`Delete ${row.title}`}
                  className="absolute right-1.5 top-1.5 rounded-sm bg-bg/80 p-1 text-text-muted opacity-0 transition-opacity hover:text-error focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 group-hover:opacity-100"
                >
                  <IconTrash />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
