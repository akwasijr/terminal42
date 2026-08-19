import { useEffect, useState } from 'react'
import type { InboxEntry } from '../../../preload/index'

export function InboxView() {
  const [items, setItems] = useState<InboxEntry[]>([])
  const [selected, setSelected] = useState<InboxEntry | null>(null)

  const refresh = async () => setItems(await window.terminal42.inbox.list())

  useEffect(() => {
    void refresh()
    const off = window.terminal42.inbox.onNew(() => void refresh())
    return off
  }, [])

  const open = async (e: InboxEntry) => {
    setSelected(e)
    if (!e.read) {
      await window.terminal42.inbox.markRead(e.id)
      void refresh()
    }
  }

  const remove = async (id: string) => {
    await window.terminal42.inbox.remove(id)
    if (selected?.id === id) setSelected(null)
    void refresh()
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header className="flex h-[60px] shrink-0 items-center justify-between gap-4 px-6">
        <h1 className="text-[18px] font-semibold leading-tight text-text-primary">Inbox</h1>
      </header>
      <div className="flex flex-1 overflow-hidden">
      <div className="flex w-[280px] flex-col bg-surface">
        <ul className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <li className="px-3 py-4 text-center text-[12px] text-text-muted">Nothing here yet.</li>
          ) : (
            items.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => void open(e)}
                  className={[
                    'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left',
                    selected?.id === e.id ? 'bg-elevated' : 'hover:bg-elevated'
                  ].join(' ')}
                >
                  <div className="flex w-full items-center gap-2">
                    {!e.read && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />}
                    <span className={['truncate text-[12px]', e.read ? 'text-text-secondary' : 'font-medium text-text-primary'].join(' ')}>
                      {e.title}
                    </span>
                  </div>
                  <span className="text-[11px] text-text-muted">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
      <div className="flex flex-1 flex-col">
        {selected ? (
          <>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-[14px] font-semibold">{selected.title}</div>
                <div className="text-[11px] text-text-muted">
                  {selected.kind} · {new Date(selected.created_at).toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void remove(selected.id)}
                className="rounded-sm px-2 py-1 text-[11px] text-text-secondary hover:bg-elevated"
              >
                Remove
              </button>
            </div>
            <pre
              className="flex-1 overflow-auto whitespace-pre-wrap bg-bg p-4 font-mono text-[12px] text-text-primary"
              style={{ userSelect: 'text' }}
            >
              {selected.body}
            </pre>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-[13px] text-text-muted">
            Pick something on the left to read it.
          </div>
        )}
      </div>
      </div>
    </main>
  )
}
