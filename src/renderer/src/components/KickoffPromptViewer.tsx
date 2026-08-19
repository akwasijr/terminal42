import { useEffect, useMemo, useRef, useState } from 'react'
import { buildKickoffPrompt } from '../lib/brief'
import type { ProjectBrief } from '../../../preload/index'

export function KickoffPromptButton({
  projectId,
  sessionId
}: {
  projectId: string
  sessionId: string | null
}) {
  const [open, setOpen] = useState(false)
  const [hasBrief, setHasBrief] = useState(false)
  const [openSessionId, setOpenSessionId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setHasBrief(false)
    void window.terminal42.brief.load(projectId)
      .then((b: ProjectBrief | null) => {
        if (cancelled) return
        setHasBrief(!!b && b.type !== 'blank')
      })
      .catch(() => { if (!cancelled) setHasBrief(false) })
    return () => { cancelled = true }
  }, [projectId])

  if (!hasBrief) return null

  const onOpen = () => {
    setOpenSessionId(sessionId)
    setOpen(true)
  }

  return (
    <>
      <button
        onClick={onOpen}
        title="View the kickoff prompt for this project"
        aria-label="View kickoff prompt"
        className="grid h-7 w-7 place-items-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 3v4"/>
          <path d="M19 17v4"/>
          <path d="M3 5h4"/>
          <path d="M17 19h4"/>
          <path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z"/>
        </svg>
      </button>
      {open && (
        <KickoffPromptModal
          projectId={projectId}
          sessionId={openSessionId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; brief: ProjectBrief }

function KickoffPromptModal({
  projectId,
  sessionId,
  onClose
}: {
  projectId: string
  sessionId: string | null
  onClose: () => void
}) {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' })
  const [inspirationDir, setInspirationDir] = useState<string | undefined>(undefined)
  const [brandDir, setBrandDir] = useState<string | undefined>(undefined)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const backdropMouseDown = useRef(false)
  const toastTimer = useRef<number | null>(null)

  // Load brief + inspiration dir + brand dir for this projectId. Cancel on unmount or project change.
  useEffect(() => {
    let cancelled = false
    setLoad({ kind: 'loading' })
    Promise.all([
      window.terminal42.brief.load(projectId),
      window.terminal42.brief.inspirationDir(projectId).catch(() => undefined),
      window.terminal42.brief.brandDir(projectId).catch(() => undefined)
    ])
      .then(([b, dir, bdir]) => {
        if (cancelled) return
        setInspirationDir(typeof dir === 'string' ? dir : undefined)
        setBrandDir(typeof bdir === 'string' ? bdir : undefined)
        if (!b || b.type === 'blank') { setLoad({ kind: 'empty' }); return }
        setLoad({ kind: 'ok', brief: b })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Failed to load brief'
        setLoad({ kind: 'error', message: msg })
      })
    return () => { cancelled = true }
  }, [projectId])

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Focus management: trap inside dialog, restore on close.
  useEffect(() => {
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null
    closeBtnRef.current?.focus()
    return () => {
      previouslyFocused.current?.focus?.()
    }
  }, [])

  // Cleanup toast timer on unmount.
  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
  }, [])

  const showToast = (kind: 'success' | 'error', text: string, ms = 1800) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    setToast({ kind, text })
    toastTimer.current = window.setTimeout(() => setToast(null), ms) as unknown as number
  }

  const prompt = useMemo(() => {
    if (load.kind !== 'ok') return ''
    try { return buildKickoffPrompt(load.brief, { inspirationBaseDir: inspirationDir, brandBaseDir: brandDir }) } catch { return '' }
  }, [load, inspirationDir, brandDir])

  const lines = prompt ? prompt.split('\n').length : 0

  const onCopy = async () => {
    if (!prompt) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard not available')
      await navigator.clipboard.writeText(prompt)
      showToast('success', 'Copied to clipboard')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Copy failed'
      showToast('error', msg)
    }
  }

  // Send the raw prompt text to the active session. We deliberately do NOT:
  //   - append \r (no auto-execute; user reviews and presses Enter)
  //   - wrap in bracketed-paste escapes (Copilot's input field shows them as
  //     literal "[200~" garbage; raw text behaves correctly there)
  const onPaste = async () => {
    if (!prompt) return
    if (!sessionId) {
      showToast('error', 'No active session to paste into')
      return
    }
    try {
      const res = await window.terminal42.pty.write(sessionId, prompt) as { ok?: boolean } | undefined
      if (res && res.ok === false) throw new Error('Terminal write rejected')
      showToast('success', 'Pasted into terminal: press Enter to send', 2400)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Paste failed'
      showToast('error', msg)
    }
  }

  // Backdrop click: only close if the mousedown started on the backdrop too.
  // Prevents drag-selecting text inside the dialog from closing the modal
  // when the mouseup happens to land outside.
  const onBackdropMouseDown = (e: React.MouseEvent) => {
    backdropMouseDown.current = e.target === e.currentTarget
  }
  const onBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && backdropMouseDown.current) onClose()
    backdropMouseDown.current = false
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onMouseDown={onBackdropMouseDown}
      onClick={onBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kickoff-modal-title"
        className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-bg shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <div id="kickoff-modal-title" className="text-sm font-semibold text-text-primary">
              Kickoff prompt
            </div>
            <div className="text-xs text-text-secondary">
              {load.kind === 'ok'
                ? `${lines} lines · regenerated from this project's brief`
                : load.kind === 'loading' ? 'Loading brief…'
                : load.kind === 'empty' ? 'No brief saved for this project'
                : `Error: ${load.message}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCopy}
              disabled={load.kind !== 'ok'}
              className="rounded-md px-3 py-1.5 text-xs text-text-primary hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Copy
            </button>
            <button
              onClick={onPaste}
              disabled={load.kind !== 'ok' || !sessionId}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
              title={
                !sessionId
                  ? 'No active session at the time this dialog opened'
                  : 'Paste into terminal: press Enter to send'
              }
            >
              Paste into terminal
            </button>
            <button
              ref={closeBtnRef}
              onClick={onClose}
              className="rounded-md p-1.5 text-text-secondary hover:bg-surface hover:text-text-primary"
              aria-label="Close kickoff prompt"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className={[
              'mx-5 mt-3 rounded-md px-3 py-2 text-xs text-white shadow',
              toast.kind === 'success' ? 'bg-accent' : 'bg-red-500'
            ].join(' ')}
          >
            {toast.text}
          </div>
        )}

        <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words bg-surface/30 p-5 font-mono text-[12px] leading-relaxed text-text-primary">
          {load.kind === 'ok' ? prompt :
           load.kind === 'loading' ? 'Loading…' :
           load.kind === 'empty' ? 'This project has no brief yet.' :
           `Could not load brief: ${load.message}`}
        </pre>

        <div className="px-5 py-2 text-[11px] text-text-secondary">
          Tip: paste inserts the prompt into the active terminal but does not press Enter.
          Review it, then hit Return when you're ready.
        </div>
      </div>
    </div>
  )
}
