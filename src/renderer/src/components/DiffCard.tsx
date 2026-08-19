// "N files changed +X −Y · Undo" card shown under the turn that made them.
//
// Undo writes to the user's working tree, so it is deliberately two-step: the
// first click arms the button, the second commits. That avoids a modal while
// still making destructive intent explicit — a single mis-click next to the
// message body should never silently roll back a turn's work.

import { useEffect, useRef, useState } from 'react'
import type { ChatDiff, ChatFileChange } from '../../../preload/index'
import { IconCode, IconRefresh, IconChevronRight } from './icons'

export function DiffCard({
  messageId,
  diff,
  undone,
  onUndone,
  onOpenFile
}: {
  messageId: string
  diff: ChatDiff
  undone?: boolean
  onUndone?: () => void
  onOpenFile?: (path: string) => void
}): JSX.Element | null {
  const [armed, setArmed] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const disarmRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Disarm on its own so the button can't sit primed indefinitely and catch a
  // later, unrelated click.
  useEffect(() => {
    if (!armed) return
    disarmRef.current = setTimeout(() => setArmed(false), 4000)
    return () => { if (disarmRef.current) clearTimeout(disarmRef.current) }
  }, [armed])

  if (!diff || diff.files.length === 0) return null

  const undo = async (): Promise<void> => {
    if (!armed) { setArmed(true); return }
    setArmed(false)
    setWorking(true)
    setError(null)
    try {
      const res = await window.terminal42.chat.undo(messageId)
      if (!res.ok) setError(res.error ?? 'Could not undo these changes.')
      else onUndone?.()
    } catch (e) {
      setError(String((e as Error)?.message ?? e))
    } finally {
      setWorking(false)
    }
  }

  const fileCount = diff.files.length

  return (
    <div className="rounded-xl bg-surface px-3 py-2 text-[12.5px]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-text-secondary hover:text-text-primary"
          title={expanded ? 'Hide changed files' : 'Show changed files'}
        >
          <IconChevronRight
            size={9}
            className={['shrink-0 text-text-muted transition-transform', expanded ? 'rotate-90' : ''].join(' ')}
          />
          <IconCode size={13} className="shrink-0 text-text-muted" />
          <span className={undone ? 'text-text-muted line-through' : 'text-text-primary'}>
            {fileCount} file{fileCount === 1 ? '' : 's'} changed
          </span>
          <DiffCounts additions={diff.additions} deletions={diff.deletions} muted={undone} />
        </button>

        {undone ? (
          <span className="shrink-0 text-[11.5px] text-text-muted">Undone</span>
        ) : (
          <button
            type="button"
            onClick={() => void undo()}
            disabled={working}
            aria-label={armed ? 'Confirm undo' : 'Undo these changes'}
            title={
              armed
                ? 'Click again to restore every file this turn changed'
                : 'Restore every file this turn changed to its previous contents'
            }
            className={[
              'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] transition-colors',
              armed
                ? 'bg-warning/15 text-warning hover:bg-warning hover:text-white'
                : 'text-text-muted hover:bg-elevated hover:text-text-primary',
              working ? 'cursor-wait opacity-60' : ''
            ].join(' ')}
          >
            <IconRefresh size={11} />
            {working ? 'Undoing…' : armed ? 'Confirm undo' : 'Undo'}
          </button>
        )}
      </div>

      {error && <p className="mt-1.5 pl-[26px] text-[11.5px] text-error">{error}</p>}

      {expanded && (
        <ul className="mt-1.5 flex flex-col gap-0.5 pl-[26px]">
          {diff.files.map((f) => (
            <li key={f.path}>
              <FileRow file={f} onOpen={onOpenFile} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FileRow({
  file,
  onOpen
}: {
  file: ChatFileChange
  onOpen?: (path: string) => void
}): JSX.Element {
  const canOpen = !!onOpen && !file.binary && file.status !== 'deleted'
  const label = (
    <>
      <StatusMark status={file.status} />
      <span className="truncate text-text-secondary">{file.path}</span>
      {file.binary ? (
        <span className="ml-auto shrink-0 text-[11px] text-text-muted">binary</span>
      ) : (
        <span className="ml-auto shrink-0">
          <DiffCounts additions={file.additions} deletions={file.deletions} />
        </span>
      )}
    </>
  )
  const className = 'flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-[12px]'
  if (!canOpen) return <div className={className} title={file.path}>{label}</div>
  return (
    <button
      type="button"
      onClick={() => onOpen?.(file.path)}
      title={`View changes to ${file.path}`}
      className={`${className} text-left hover:bg-elevated`}
    >
      {label}
    </button>
  )
}

function StatusMark({ status }: { status: ChatFileChange['status'] }): JSX.Element {
  const cfg =
    status === 'added' ? { ch: 'A', cls: 'text-success', title: 'Added' }
    : status === 'deleted' ? { ch: 'D', cls: 'text-error', title: 'Deleted' }
    : { ch: 'M', cls: 'text-warning', title: 'Modified' }
  return (
    <span className={`shrink-0 font-mono text-[10.5px] ${cfg.cls}`} title={cfg.title} aria-label={cfg.title}>
      {cfg.ch}
    </span>
  )
}

export function DiffCounts({
  additions,
  deletions,
  muted
}: {
  additions: number
  deletions: number
  muted?: boolean
}): JSX.Element {
  return (
    <span className="shrink-0 font-mono text-[11.5px] tabular-nums">
      <span className={muted ? 'text-text-muted' : 'text-success'}>+{additions}</span>{' '}
      <span className={muted ? 'text-text-muted' : 'text-error'}>−{deletions}</span>
    </span>
  )
}
