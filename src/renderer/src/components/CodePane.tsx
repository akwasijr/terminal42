// The Code half of the artifact pane: what a turn changed, and what the file
// says now.
//
// Two views, because they answer different questions. "Changes" renders a
// unified diff with both gutters — what did that turn do here. "Source" renders
// the whole file numbered from line 1 — what does this file actually contain.
// A turn usually touches more than one file, so the files it changed are listed
// and switched between here rather than being fixed by whatever card was
// clicked in chat.
//
// Syntax colouring comes from Shiki (real TextMate grammars), loaded on demand
// so no grammar reaches the startup bundle. It is strictly an enhancement: the
// text is rendered from the diff itself, and if highlighting is unavailable or
// fails the same rows render as plain text. Colour must never be the reason a
// file cannot be read.

import { useEffect, useState } from 'react'
import { diffLines, type DiffLine } from '../../../shared/lineDiff'
import { highlightToLines, languageForPath, type CodeToken } from '../lib/highlight'

export type TurnFile = {
  path: string
  status: string
  additions: number
  deletions: number
  binary: boolean
}

export function CodeView({
  messageId,
  path,
  files,
  onPickFile,
  onContentChange
}: {
  messageId: string | null
  path: string | null
  files: TurnFile[]
  onPickFile: (path: string) => void
  onContentChange?: (content: string | null) => void
}): JSX.Element {
  const [mode, setMode] = useState<'changes' | 'source'>('changes')
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; error: string }
    | { status: 'ready'; lines: DiffLine[]; after: string | null }
  >({ status: 'idle' })
  const [tokens, setTokens] = useState<{ before: CodeToken[][] | null; after: CodeToken[][] | null }>({
    before: null,
    after: null
  })

  useEffect(() => {
    if (!messageId || !path) { setState({ status: 'idle' }); onContentChange?.(null); return }
    let cancelled = false
    setState({ status: 'loading' })
    setTokens({ before: null, after: null })
    void window.terminal42.chat
      .fileDiff(messageId, path)
      .then((res) => {
        if (cancelled) return
        if (!res.ok) { setState({ status: 'error', error: res.error ?? 'Could not load this file.' }); onContentChange?.(null); return }
        setState({ status: 'ready', lines: diffLines(res.before ?? '', res.after ?? ''), after: res.after })
        onContentChange?.(res.after)
        // Highlighting resolves after the text is already on screen, so a slow
        // grammar load never delays showing the file.
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
    // onContentChange is a reporting channel, not an input: including it would
    // refetch the file every time the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId, path])

  if (!messageId || !path) {
    return (
      <div className="grid flex-1 place-items-center px-6 text-center">
        <p className="max-w-[36ch] text-[12.5px] text-text-muted">
          No file open. Open one from a change card in the chat, and its code shows up here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-2 pb-1.5">
        <FilePicker files={files} path={path} onPick={onPickFile} />
        <div className="ml-auto flex items-center gap-0.5">
          <ModeTab label="Changes" active={mode === 'changes'} onClick={() => setMode('changes')} />
          <ModeTab label="Source" active={mode === 'source'} onClick={() => setMode('source')} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto pb-2">
        {state.status === 'loading' && (
          <p className="px-3 py-6 text-[12.5px] text-text-muted">Loading {mode === 'source' ? 'file' : 'changes'}…</p>
        )}
        {state.status === 'error' && (
          <p className="px-3 py-6 text-[12.5px] text-text-secondary">{state.error}</p>
        )}
        {state.status === 'ready' && mode === 'changes' && <DiffBody lines={state.lines} tokens={tokens} />}
        {state.status === 'ready' && mode === 'source' && (
          <SourceBody text={state.after} tokens={tokens.after} />
        )}
      </div>
    </div>
  )
}

/**
 * The whole file, numbered from line 1.
 *
 * A deleted file has no "now" to show, which is said plainly rather than
 * rendered as an empty pane that looks like a loading failure.
 */
function SourceBody({ text, tokens }: { text: string | null; tokens: CodeToken[][] | null }): JSX.Element {
  if (text === null) {
    return <p className="px-3 py-6 text-[12.5px] text-text-muted">This file no longer exists. The turn deleted it.</p>
  }
  if (text === '') {
    return <p className="px-3 py-6 text-[12.5px] text-text-muted">This file is empty.</p>
  }
  const lines = text.replace(/\n$/, '').split('\n')
  return (
    <table className="w-full border-collapse font-mono text-[12px] leading-[1.5]">
      <tbody>
        {lines.map((line, i) => {
          const row = tokens?.[i]
          const usable = row && row.map((t) => t.content).join('') === line ? row : null
          return (
            <tr key={i}>
              <td className="w-[1%] select-none whitespace-nowrap pl-3 pr-3 text-right align-top text-[11px] tabular-nums text-text-muted">
                {i + 1}
              </td>
              <td className="whitespace-pre-wrap break-words pr-3 align-top text-text-primary">
                {usable && usable.length > 0
                  ? usable.map((t, j) => (
                      <span key={j} style={t.color ? { color: t.color } : undefined}>{t.content}</span>
                    ))
                  : line || '\u00a0'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/**
 * The files this turn changed.
 *
 * A single-file turn gets a plain label: a dropdown with one option in it is
 * an invitation to click something that does nothing.
 */
function FilePicker({
  files,
  path,
  onPick
}: {
  files: TurnFile[]
  path: string
  onPick: (path: string) => void
}): JSX.Element {
  if (files.length < 2) {
    return (
      <span className="min-w-0 truncate text-[11.5px] text-text-muted" title={path}>{path}</span>
    )
  }
  return (
    <label className="flex min-w-0 items-center gap-1.5">
      <span className="sr-only">File to show</span>
      <select
        value={path}
        onChange={(e) => onPick(e.target.value)}
        className="min-w-0 max-w-full truncate rounded-md bg-surface px-1.5 py-0.5 text-[11.5px] text-text-secondary outline-none hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        title={path}
      >
        {files.map((f) => (
          <option key={f.path} value={f.path}>
            {f.path}{f.binary ? '' : ` (+${f.additions} −${f.deletions})`}
          </option>
        ))}
      </select>
    </label>
  )
}

function ModeTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'h-6 rounded-md px-2 text-[11.5px] transition-colors',
        active ? 'bg-elevated text-text-primary' : 'text-text-secondary hover:bg-surface hover:text-text-primary'
      ].join(' ')}
    >
      {label}
    </button>
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
