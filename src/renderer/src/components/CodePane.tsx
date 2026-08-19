// Side pane showing what a turn changed in a single file.
//
// Renders a unified diff with both gutters rather than a plain file listing,
// because the question the pane answers is "what did that turn do here", not
// "what does this file contain".
//
// There is no syntax colouring: the project carries no highlighter dependency,
// and adding one purely for decoration is a call for the user to make. Change
// tone does the work of drawing the eye instead.

import { useEffect, useState } from 'react'
import { diffLines, countChanges, type DiffLine } from '../../../shared/lineDiff'
import { IconClose, IconCode, IconGlobe, IconFolder } from './icons'
import { DiffCounts } from './DiffCard'

export function CodePane({
  messageId,
  path,
  width,
  onClose,
  onShowPreview,
  onOpenFolder
}: {
  messageId: string
  path: string
  width: number
  onClose: () => void
  onShowPreview?: () => void
  onOpenFolder?: () => void
}): JSX.Element {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; lines: DiffLine[] }
  >({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    void window.terminal42.chat
      .fileDiff(messageId, path)
      .then((res) => {
        if (cancelled) return
        if (!res.ok) { setState({ status: 'error', error: res.error ?? 'Could not load this file.' }); return }
        setState({ status: 'ready', lines: diffLines(res.before ?? '', res.after ?? '') })
      })
      .catch((e) => { if (!cancelled) setState({ status: 'error', error: String((e as Error)?.message ?? e) }) })
    return () => { cancelled = true }
  }, [messageId, path])

  const counts = state.status === 'ready' ? countChanges(state.lines) : null

  return (
    <aside
      className="flex shrink-0 flex-col overflow-hidden rounded-panel bg-bg"
      style={{ width }}
      aria-label={`Changes to ${path}`}
    >
      <header className="flex h-9 shrink-0 items-center gap-1 px-2">
        {onShowPreview && (
          <PaneTab icon={<IconGlobe size={12} />} label="Preview" onClick={onShowPreview} />
        )}
        <PaneTab icon={<IconCode size={12} />} label="Code" active />
        {counts && (
          <span className="ml-1">
            <DiffCounts additions={counts.additions} deletions={counts.deletions} />
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          {onOpenFolder && (
            <button
              type="button"
              onClick={onOpenFolder}
              title="Reveal this project in Finder"
              aria-label="Open folder"
              className="grid h-7 w-7 place-items-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary"
            >
              <IconFolder size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close code view"
            className="grid h-7 w-7 place-items-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary"
          >
            <IconClose size={12} />
          </button>
        </div>
      </header>

      <p className="shrink-0 truncate px-3 pb-1.5 text-[11.5px] text-text-muted" title={path}>{path}</p>

      <div className="min-h-0 flex-1 overflow-auto pb-2">
        {state.status === 'loading' && (
          <p className="px-3 py-6 text-[12.5px] text-text-muted">Loading changes…</p>
        )}
        {state.status === 'error' && (
          <p className="px-3 py-6 text-[12.5px] text-text-secondary">{state.error}</p>
        )}
        {state.status === 'ready' && <DiffBody lines={state.lines} />}
      </div>
    </aside>
  )
}

function DiffBody({ lines }: { lines: DiffLine[] }): JSX.Element {
  if (lines.length === 0) {
    return <p className="px-3 py-6 text-[12.5px] text-text-muted">This file is empty.</p>
  }
  return (
    <table className="w-full border-collapse font-mono text-[12px] leading-[1.5]">
      <tbody>
        {lines.map((l, i) => (
          <DiffRow key={i} line={l} />
        ))}
      </tbody>
    </table>
  )
}

function DiffRow({ line }: { line: DiffLine }): JSX.Element {
  const tone =
    line.kind === 'add' ? 'bg-success/10'
    : line.kind === 'del' ? 'bg-error/10'
    : ''
  const mark = line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ' '
  const markTone =
    line.kind === 'add' ? 'text-success' : line.kind === 'del' ? 'text-error' : 'text-text-muted'
  return (
    <tr className={tone}>
      <td className="w-[1%] select-none whitespace-nowrap pl-3 pr-2 text-right align-top text-[11px] tabular-nums text-text-muted">
        {line.beforeNo ?? ''}
      </td>
      <td className="w-[1%] select-none whitespace-nowrap pr-2 text-right align-top text-[11px] tabular-nums text-text-muted">
        {line.afterNo ?? ''}
      </td>
      <td className={`w-[1%] select-none pr-1 align-top ${markTone}`}>{mark}</td>
      <td className="whitespace-pre-wrap break-words pr-3 align-top text-text-primary">{line.text || '\u00a0'}</td>
    </tr>
  )
}

function PaneTab({
  icon,
  label,
  active,
  onClick
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] transition-colors',
        active
          ? 'bg-elevated text-text-primary'
          : 'text-text-secondary hover:bg-surface hover:text-text-primary'
      ].join(' ')}
    >
      <span className="text-text-muted">{icon}</span>
      {label}
    </button>
  )
}
