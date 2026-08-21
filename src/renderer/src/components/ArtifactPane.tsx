// One pane for the thing that was built: the page as it looks, and the code
// behind it.
//
// These used to be two panes that replaced each other, so switching between
// "show me the page" and "show me the code" meant closing one thing and
// finding the other. They are the same artifact seen two ways, so they share a
// header: a Preview | Code switch, the size of the change, and the actions that
// apply to both.
//
// The preview stays mounted while Code is showing. A webview that reloads
// every time you glance at the source loses scroll position, form state and
// any running app, which makes the switch expensive enough that people stop
// using it.

import { useCallback, useEffect, useState } from 'react'
import { BrowserPane } from './BrowserPane'
import { CodeView, type TurnFile } from './CodePane'
import { DiffCounts } from './DiffCard'
import { IconClose, IconCode, IconGlobe, IconFolder, IconDownload, IconExpand, IconCollapse } from './icons'
import { paneWidthStyle } from './paneWidth'

export type CodeTarget = { messageId: string; path: string }

export function ArtifactPane({
  projectId,
  projectPath,
  activeSessionId,
  codeTarget,
  onCodeTargetChange,
  tab,
  onTabChange,
  navTo,
  expanded,
  onToggleExpanded,
  onClose,
  width
}: {
  projectId: string
  projectPath: string
  activeSessionId: string | null
  codeTarget: CodeTarget | null
  onCodeTargetChange: (t: CodeTarget | null) => void
  tab: 'preview' | 'code'
  onTabChange: (t: 'preview' | 'code') => void
  navTo?: { url: string; nonce: number } | null
  expanded: boolean
  onToggleExpanded: () => void
  onClose: () => void
  width: number
}): JSX.Element {
  const [files, setFiles] = useState<TurnFile[]>([])
  const [counts, setCounts] = useState<{ additions: number; deletions: number } | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const messageId = codeTarget?.messageId ?? null

  useEffect(() => {
    if (!messageId) { setFiles([]); setCounts(null); return }
    let cancelled = false
    void window.terminal42.chat
      .turnFiles(messageId)
      .then((res) => {
        if (cancelled || !res.ok) return
        setFiles(res.files)
        setCounts({ additions: res.additions, deletions: res.deletions })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [messageId])

  // The pane reports what it is showing so Export saves the file on screen
  // rather than re-reading a path that may have moved on.
  const handleContent = useCallback((c: string | null) => { setContent(c) }, [])

  const exportFile = async (): Promise<void> => {
    if (!codeTarget || content === null) return
    const name = codeTarget.path.split('/').pop() || 'export.txt'
    const res = await window.terminal42.system.exportFile(name, content)
    if (res.ok && res.path) setNote(`Saved to ${res.path}`)
    else if (res.error) setNote(`Could not save: ${res.error}`)
    else setNote(null)
  }

  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(null), 6000)
    return () => clearTimeout(t)
  }, [note])

  return (
    <aside
      className="flex h-full min-w-0 shrink-0 flex-col overflow-hidden rounded-panel bg-bg"
      style={expanded ? { flex: '1 1 auto', minWidth: 0 } : paneWidthStyle(width)}
      aria-label="What was built"
    >
      <header className="flex h-9 shrink-0 items-center gap-1 px-2">
        <PaneTab
          icon={<IconGlobe size={12} />}
          label="Preview"
          active={tab === 'preview'}
          onClick={() => onTabChange('preview')}
        />
        <PaneTab
          icon={<IconCode size={12} />}
          label="Code"
          active={tab === 'code'}
          onClick={() => onTabChange('code')}
        />
        {counts && (counts.additions > 0 || counts.deletions > 0) && (
          <span className="ml-1" title={`${counts.additions} lines added, ${counts.deletions} removed`}>
            <DiffCounts additions={counts.additions} deletions={counts.deletions} />
          </span>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          <HeaderBtn
            label={content === null ? 'Open a file in Code to export it' : 'Save a copy of this file'}
            aria="Export"
            onClick={() => { void exportFile() }}
            disabled={content === null}
          >
            <IconDownload size={13} />
          </HeaderBtn>
          <HeaderBtn
            label="Show this folder in Finder"
            aria="Open folder"
            onClick={() => { void window.terminal42.system.revealFolder(projectPath) }}
          >
            <IconFolder size={13} />
          </HeaderBtn>
          <HeaderBtn
            label={expanded ? 'Show the chat again' : 'Give this the full window'}
            aria={expanded ? 'Collapse pane' : 'Expand pane'}
            onClick={onToggleExpanded}
            pressed={expanded}
          >
            {expanded ? <IconCollapse size={13} /> : <IconExpand size={13} />}
          </HeaderBtn>
          <HeaderBtn label="Close" aria="Close this pane" onClick={onClose}>
            <IconClose size={12} />
          </HeaderBtn>
        </div>
      </header>

      {note && (
        <p className="shrink-0 truncate px-3 pb-1 text-[11.5px] text-text-secondary" role="status">{note}</p>
      )}

      <div className={tab === 'preview' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <BrowserPane
          projectId={projectId}
          width={0}
          embedded
          onClose={onClose}
          navTo={navTo}
          activeSessionId={activeSessionId}
        />
      </div>
      <div className={tab === 'code' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <CodeView
          messageId={codeTarget?.messageId ?? null}
          path={codeTarget?.path ?? null}
          files={files}
          onPickFile={(path) => { if (codeTarget) onCodeTargetChange({ messageId: codeTarget.messageId, path }) }}
          onContentChange={handleContent}
        />
      </div>
    </aside>
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
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
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

function HeaderBtn({
  label,
  aria,
  onClick,
  disabled,
  pressed,
  children
}: {
  label: string
  aria: string
  onClick: () => void
  disabled?: boolean
  pressed?: boolean
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={aria}
      aria-pressed={pressed}
      className="grid h-7 w-7 place-items-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-secondary"
    >
      {children}
    </button>
  )
}
