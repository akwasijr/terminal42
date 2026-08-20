// Side pane showing what a turn changed in a single file.
//
// Renders a unified diff with both gutters rather than a plain file listing,
// because the question the pane answers is "what did that turn do here", not
// "what does this file contain".
//
// Syntax colouring comes from Shiki (real TextMate grammars), loaded on demand
// so no grammar reaches the startup bundle. It is strictly an enhancement: the
// before/after text is rendered from the diff itself, and if highlighting is
// unavailable or fails the same rows render as plain text. Colour must never
// be the reason a diff cannot be read.

import { useEffect, useState } from 'react'
import { diffLines, countChanges, type DiffLine } from '../../../shared/lineDiff'
import { highlightToLines, languageForPath, type CodeToken } from '../lib/highlight'
import { IconClose, IconCode, IconGlobe, IconFolder } from './icons'
import { DiffCounts } from './DiffCard'
import { paneWidthStyle } from './paneWidth'

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
  const [tokens, setTokens] = useState<{ before: CodeToken[][] | null; after: CodeToken[][] | null }>({
    before: null,
    after: null
  })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    setTokens({ before: null, after: null })
    void window.terminal42.chat
      .fileDiff(messageId, path)
      .then((res) => {
        if (cancelled) return
        if (!res.ok) { setState({ status: 'error', error: res.error ?? 'Could not load this file.' }); return }
        const lines = diffLines(res.before ?? '', res.after ?? '')
        setState({ status: 'ready', lines })
        // Highlighting resolves after the diff is already on screen, so a slow
        // grammar load never delays showing the change.
        const lang = languageForPath(path)
        if (!lang) return
        void Promise.all([
          highlightToLines(res.before ?? '', lang),
          highlightToLines(res.after ?? '', lang)
        ]).then(([before, after]) => {
          if (cancelled || (!before && !after)) return
          setTokens({ before, after })
        })
      })
      .catch((e) => { if (!cancelled) setState({ status: 'error', error: String((e as Error)?.message ?? e) }) })
    return () => { cancelled = true }
  }, [messageId, path])

  const counts = state.status === 'ready' ? countChanges(state.lines) : null

  return (
    <aside
      className="flex shrink-0 flex-col overflow-hidden rounded-panel bg-bg"
      style={paneWidthStyle(width)}
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
        {state.status === 'ready' && <DiffBody lines={state.lines} tokens={tokens} />}
      </div>
    </aside>
  )
}

function DiffBody({
  lines,
  tokens
}: {
  lines: DiffLine[]
  tokens: { before: CodeToken[][] | null; after: CodeToken[][] | null }
}): JSX.Element {
  if (lines.length === 0) {
    return <p className="px-3 py-6 text-[12.5px] text-text-muted">This file is empty.</p>
  }
  return (
    <table className="w-full border-collapse font-mono text-[12px] leading-[1.5]">
      <tbody>
        {lines.map((l, i) => (
          <DiffRow key={i} line={l} tokens={tokensForLine(l, tokens)} />
        ))}
      </tbody>
    </table>
  )
}

/**
 * The tokens belonging to one diff row.
 *
 * Each side is tokenised as a whole file, so a row is matched back by its own
 * line number: a deleted row can only come from the "before" text, an added
 * row only from the "after". Tokenising the interleaved diff instead would
 * feed the grammar a file that never existed and mis-colour from the first
 * unbalanced brace onwards.
 *
 * Returns null if anything fails to line up, which falls back to plain text
 * for that row rather than showing tokens from the wrong line.
 */
export function tokensForLine(
  line: DiffLine,
  tokens: { before: CodeToken[][] | null; after: CodeToken[][] | null }
): CodeToken[] | null {
  const [side, no] =
    line.kind === 'del' ? [tokens.before, line.beforeNo] : [tokens.after, line.afterNo]
  if (!side || !no) return null
  const row = side[no - 1]
  if (!row) return null
  // Guard against a highlighter that normalised the text differently from the
  // diff; showing the wrong colours silently is worse than showing none.
  const joined = row.map((t) => t.content).join('')
  return joined === line.text ? row : null
}

function DiffRow({ line, tokens }: { line: DiffLine; tokens: CodeToken[] | null }): JSX.Element {
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
      <td className="whitespace-pre-wrap break-words pr-3 align-top text-text-primary">
        {tokens && tokens.length > 0
          ? tokens.map((t, i) => (
              <span key={i} style={t.color ? { color: t.color } : undefined}>
                {t.content}
              </span>
            ))
          : line.text || '\u00a0'}
      </td>
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
