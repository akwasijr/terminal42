// Motion's front door: the pieces you have, and a way to start another.
//
// Laid out like the Form list on purpose, so the two feel like one app: a
// title, one button that opens the choice of arrangements, then the work.
// The thumbnail is a real frame captured while the piece was last open, so
// the list never has to spin up the GPU to draw itself.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MotionDoc } from '../../../../shared/motion/types'
import { emptyDoc, hydrateDoc } from '../../../../shared/motion/defaults'
import { MOTION_COMPONENTS } from '../../../../shared/motion/registry'
import { MotionStudio } from './MotionStudio'
import { IconPlus, IconTrash } from '../icons'
import { formatAge } from '../../lib/formatAge'

type Row = { id: string; title: string; doc: unknown; thumbnail: string | null; updatedAt: number }

export function MotionView(): React.JSX.Element {
  const [rows, setRows] = useState<Row[]>([])
  const [open, setOpen] = useState<{ id: string; title: string; doc: MotionDoc } | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    const list = await window.terminal42.motion.list()
    setRows(list as Row[])
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent): void => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

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
    <div className="h-full w-full overflow-y-auto overflow-x-hidden bg-bg">
      <div className="mx-auto max-w-6xl px-8 pb-10 pt-10">
        <header className="mb-4 flex items-center justify-between gap-4">
          <h1 className="text-[20px] font-semibold text-text-primary">Motion</h1>
          <div ref={menuRef} className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-action px-3 py-1.5 text-[13px] font-medium text-action-text transition-opacity hover:opacity-90"
            >
              <IconPlus size={13} />
              <span>New motion</span>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="-mr-0.5 ml-0.5 opacity-80"><path d="M4 6l4 4 4-4" /></svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-30 mt-1.5 w-52 overflow-hidden rounded-lg bg-raised py-1 shadow-overlay">
                {MOTION_COMPONENTS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setMenuOpen(false); void create(c.id) }}
                    className="flex w-full items-center px-3 py-2 text-left text-[12.5px] font-medium text-text-primary hover:bg-elevated"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {loading ? (
          <p className="text-[12px] text-text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl bg-surface/40 px-6 py-16 text-center text-[13px] text-text-muted">
            No pieces yet.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((row) => (
              <div key={row.id} className="group relative flex w-full flex-col rounded-xl bg-surface p-4 transition-colors hover:bg-elevated">
                <button
                  type="button"
                  onClick={() => openRow(row)}
                  className="flex w-full min-w-0 flex-1 flex-col gap-3 text-left focus-visible:outline-none"
                >
                  <span className="motion-checker relative block h-32 w-full overflow-hidden rounded-lg bg-elevated">
                    {row.thumbnail ? (
                      <img src={row.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="block w-full min-w-0">
                    <span className="block w-full truncate text-[14px] font-medium text-text-primary">{row.title}</span>
                    <span className="mt-0.5 block text-[11.5px] text-text-muted">{formatAge(row.updatedAt)}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void remove(row.id)}
                  aria-label={`Delete ${row.title}`}
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-text-muted opacity-0 transition-opacity hover:bg-elevated hover:text-error focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 group-hover:opacity-100"
                >
                  <IconTrash size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
