import { useEffect, useState } from 'react'
import type { TemplateInfo } from '../../../preload/index'
import { IconClose } from './icons'

// Visual templates gallery for the Design view.
//
// • Card grid with real screenshots (PNGs cached on disk).
// • A card with no screenshot yet shows a "Generate preview" overlay.
// • Click a card → modal with bigger preview + "Use this template" button.

type PreviewState = {
  status: 'unknown' | 'missing' | 'generating' | 'ready' | 'error'
  dataUrl: string | null
  msg?: string
  error?: string
}

export function TemplatesGallery({ onUse }: { onUse: (t: TemplateInfo) => void }): JSX.Element {
  const [items, setItems] = useState<TemplateInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({})
  const [open, setOpen] = useState<TemplateInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const r = await window.terminal42.templates.list()
      if (cancelled) return
      if (Array.isArray(r)) setItems(r)
      else setError(r.error || 'Failed to load templates')
    })()
    return () => { cancelled = true }
  }, [])

  // Once the list is in, hydrate any previews already on disk and fire a
  // generate request for any missing ones. The backend serializes them
  // (one job at a time), but the renderer fires the requests in parallel
  // so each card immediately reflects 'generating' / 'queued' and gets
  // its own progress messages.
  useEffect(() => {
    if (!items) return
    let cancelled = false
    void (async () => {
      const checks = await Promise.all(
        items.map(async (t) => ({ id: t.id, dataUrl: await window.terminal42.templates.previewGet(t.id) }))
      )
      if (cancelled) return
      setPreviews((cur) => {
        const next = { ...cur }
        for (const c of checks) {
          next[c.id] = c.dataUrl
            ? { status: 'ready', dataUrl: c.dataUrl }
            : { status: 'generating', dataUrl: null, msg: 'Queued…' }
        }
        return next
      })
      // Fire all generations in parallel — main serializes the queue.
      for (const c of checks) {
        if (c.dataUrl) continue
        void window.terminal42.templates.previewGenerate(c.id).then((r) => {
          if (cancelled) return
          setPreviews((p) => ({
            ...p,
            [c.id]: r.ok && r.dataUrl
              ? { status: 'ready', dataUrl: r.dataUrl }
              : { status: 'error', dataUrl: null, error: r.error || 'Failed' }
          }))
        })
      }
    })()
    return () => { cancelled = true }
  }, [items])

  // Listen for per-template generation progress.
  useEffect(() => {
    const off = window.terminal42.templates.onPreviewProgress((p) => {
      setPreviews((cur) => ({ ...cur, [p.id]: { ...(cur[p.id] || { dataUrl: null, status: 'generating' }), status: 'generating', msg: p.msg } }))
    })
    return () => { off() }
  }, [])

  const generate = async (id: string): Promise<void> => {
    setPreviews((p) => ({ ...p, [id]: { ...(p[id] || { dataUrl: null }), status: 'generating', msg: 'Queued…' } }))
    const r = await window.terminal42.templates.previewGenerate(id)
    setPreviews((p) => ({
      ...p,
      [id]: r.ok && r.dataUrl
        ? { status: 'ready', dataUrl: r.dataUrl }
        : { status: 'error', dataUrl: null, error: r.error || 'Failed' }
    }))
  }

  if (error) return <div className="px-1 text-[13px] text-text-muted">{error}</div>
  if (!items) return <div className="px-1 text-[13px] text-text-muted">Loading templates…</div>
  if (items.length === 0) return <div className="px-1 text-[13px] text-text-muted">No templates available.</div>

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((t) => {
          const ps = previews[t.id] || { status: 'unknown' as const, dataUrl: null }
          return (
            <div
              key={t.id}
              className="group relative flex w-full flex-col gap-3 rounded-xl bg-surface p-4 transition-colors hover:bg-elevated"
            >
              <button
                type="button"
                onClick={() => setOpen(t)}
                className="flex w-full min-w-0 flex-1 flex-col gap-3 text-left"
              >
                <div className="relative h-32 w-full overflow-hidden rounded-lg bg-elevated">
                  {ps.dataUrl ? (
                    <img src={ps.dataUrl} alt={`${t.displayName} preview`} className="h-full w-full object-cover" />
                  ) : (
                    <PlaceholderArt seed={t.id} />
                  )}
                  {ps.status === 'generating' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-bg/70 px-3 text-center backdrop-blur-sm">
                      <Spinner />
                      <span className="line-clamp-2 text-[10.5px] text-text-secondary">{ps.msg || 'Generating…'}</span>
                    </div>
                  )}
                </div>
                <div className="w-full min-w-0">
                  <div className="block w-full truncate text-[14px] font-medium text-text-primary">
                    {t.displayName}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-[11.5px] text-text-muted">
                    {t.description}
                  </div>
                </div>
              </button>
              {(ps.status === 'missing' || ps.status === 'error') && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void generate(t.id) }}
                  title={ps.status === 'error' ? 'Retry preview' : 'Generate preview'}
                  className="absolute right-2 top-2 rounded-md bg-bg/85 px-2 py-1 text-[10.5px] font-medium text-text-primary opacity-0 shadow-sm -default transition-opacity hover:bg-elevated group-hover:opacity-100"
                >
                  {ps.status === 'error' ? 'Retry' : 'Generate'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {open && (
        <PreviewModal
          template={open}
          state={previews[open.id] || { status: 'unknown', dataUrl: null }}
          onGenerate={() => void generate(open.id)}
          onUse={() => { onUse(open); setOpen(null) }}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  )
}

function PreviewModal({
  template, state, onGenerate, onUse, onClose
}: {
  template: TemplateInfo
  state: PreviewState
  onGenerate: () => void
  onUse: () => void
  onClose: () => void
}): JSX.Element {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/80 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-raised shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-text-primary">{template.displayName}</h2>
            <p className="mt-0.5 line-clamp-2 text-[12.5px] text-text-secondary">{template.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="grid h-8 w-8 place-items-center rounded-md text-text-muted hover:bg-elevated hover:text-text-primary"
          >
            <IconClose size={14} />
          </button>
        </header>

        <div className="relative flex-1 overflow-hidden bg-elevated">
          {state.dataUrl ? (
            <img src={state.dataUrl} alt={`${template.displayName} preview`} className="h-full w-full object-contain" />
          ) : (
            <div className="grid h-full place-items-center">
              <PlaceholderArt seed={template.id} large />
            </div>
          )}
          {state.status === 'generating' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg/75 backdrop-blur-sm">
              <Spinner large />
              <span className="text-[13px] text-text-secondary">{state.msg || 'Generating preview…'}</span>
              <span className="text-[11.5px] text-text-muted">First run installs dependencies — this can take a few minutes.</span>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 px-5 py-3">
          <div className="text-[12px] text-text-muted">
            {state.status === 'error' ? `Preview failed: ${state.error || 'unknown error'}` : null}
          </div>
          <div className="flex gap-2">
            {!state.dataUrl && state.status !== 'generating' && (
              <button
                type="button"
                onClick={onGenerate}
                className="rounded-md bg-elevated px-3 py-1.5 text-[13px] font-medium text-text-primary hover:bg-elevated/80"
              >
                {state.status === 'error' ? 'Retry preview' : 'Generate preview'}
              </button>
            )}
            <button
              type="button"
              onClick={onUse}
              className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-text hover:opacity-90"
            >
              Use this template
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function Spinner({ large }: { large?: boolean } = {}): JSX.Element {
  const size = large ? 28 : 18
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin text-text-secondary">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" fill="none" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// Soft generative placeholder — same role as DesignCard's empty pencil state,
// just colored so each template has a distinct identity while it waits.
function PlaceholderArt({ seed, large }: { seed: string; large?: boolean }): JSX.Element {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const a = h % 360
  const b = (h >> 8) % 360
  const style: React.CSSProperties = {
    background: `linear-gradient(135deg, hsl(${a} 40% 60% / 0.55), hsl(${b} 40% 45% / 0.55))`
  }
  return <div className={`h-full w-full ${large ? '' : ''}`} style={style} aria-hidden="true" />
}
