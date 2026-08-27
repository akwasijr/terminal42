// Motion's front door: the pieces you have, and a way to start another.
//
// Laid out like the Form list on purpose, so the two feel like one app: a
// title, one button that opens the choice of arrangements, then the work.
// The thumbnail is a real frame captured while the piece was last open, so
// the list never has to spin up the GPU to draw itself.

import { useCallback, useEffect, useState } from 'react'
import type { MotionDoc } from '../../../../shared/motion/types'
import { emptyDoc, hydrateDoc } from '../../../../shared/motion/defaults'
import { MOTION_COMPONENTS } from '../../../../shared/motion/registry'
import { MotionStudio } from './MotionStudio'
import { MotionTemplates } from './MotionTemplates'
import { MotionSetup, type MotionSetupChoice } from './MotionSetup'
import { buildTemplateDoc } from '../../lib/motion/templateDoc'
import type { MotionTemplate } from '../../../../shared/motion/templates'
import { IconPlus, IconTrash } from '../icons'
import { formatAge } from '../../lib/formatAge'

type Row = { id: string; title: string; doc: unknown; thumbnail: string | null; updatedAt: number }

export function MotionView(): React.JSX.Element {
  const [rows, setRows] = useState<Row[]>([])
  const [open, setOpen] = useState<{ id: string; title: string; doc: MotionDoc } | null>(null)
  const [loading, setLoading] = useState(true)
  const [setupOpen, setSetupOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    const list = await window.terminal42.motion.list()
    setRows(list as Row[])
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const create = async (choice: MotionSetupChoice): Promise<void> => {
    setSetupOpen(false)
    const blank = emptyDoc(choice.componentId)
    // The frame is settled before the piece exists, so the first thing you see
    // is already the shape and the colour you asked for.
    const doc: MotionDoc = {
      ...blank,
      frame: { ...blank.frame, aspect: choice.aspect, background: choice.background }
    }
    const label = MOTION_COMPONENTS.find((c) => c.id === choice.componentId)?.label ?? 'Motion'
    const row = await window.terminal42.motion.create(label, doc)
    await refresh()
    setOpen({ id: row.id, title: row.title, doc })
  }

  // A template arrives as a whole piece, so it is created exactly as a blank
  // one is: stored first, then opened, so closing it leaves something behind.
  const createFromTemplate = async (template: MotionTemplate): Promise<void> => {
    setTemplatesOpen(false)
    const doc = await buildTemplateDoc(template)
    const row = await window.terminal42.motion.create(template.name, doc)
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
          <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setTemplatesOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md bg-surface px-3 text-[13px] font-medium text-text-primary ring-1 ring-inset ring-border transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Templates
          </button>
          <button
            type="button"
            onClick={() => setSetupOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md bg-action px-3 text-[13px] font-medium text-action-text transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <IconPlus size={13} />
            <span>New motion</span>
          </button>
          </div>
        </header>

        {loading ? (
          <p className="text-[12px] text-text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl bg-surface/40 px-6 py-16 text-center">
            <p className="text-[13px] text-text-muted">No pieces yet.</p>
            <button
              type="button"
              onClick={() => setTemplatesOpen(true)}
              className="mt-3 rounded-md bg-action px-3 py-1.5 text-[13px] font-medium text-action-text transition-opacity hover:opacity-90"
            >
              Browse templates
            </button>
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
      {setupOpen && (
        <MotionSetup onCancel={() => setSetupOpen(false)} onCreate={(c) => void create(c)} />
      )}
      {templatesOpen && (
        <MotionTemplates onPick={(t) => void createFromTemplate(t)} onClose={() => setTemplatesOpen(false)} />
      )}
    </div>
  )
}
