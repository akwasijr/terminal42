import { useEffect, useRef, useState } from 'react'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import {
  getTerminalActions,
  subscribeTerminalActions,
  subscribeTerminalSelection
} from '../state/terminalActions'

export function TerminalActionsMenu({ sessionId }: { sessionId: string | null }) {
  const [, force] = useState(0)
  useEffect(() => subscribeTerminalActions(() => force((n) => n + 1)), [])
  useEffect(() => subscribeTerminalSelection(() => force((n) => n + 1)), [])
  const actions = getTerminalActions(sessionId)
  const disabled = !actions
  const selection = actions?.getSelection?.() ?? ''
  const hasSel = selection.length > 0
  const snapshotRef = useRef<string>('')

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          // Snapshot selection on the same tick the menu opens so blur can't lose it.
          onMouseDown={() => { snapshotRef.current = actions?.getSelection?.() ?? '' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              snapshotRef.current = actions?.getSelection?.() ?? ''
            }
          }}
          className="grid h-7 w-7 place-items-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary outline-none focus:outline-none focus-visible:outline-none data-[state=open]:bg-elevated data-[state=open]:text-text-primary disabled:opacity-40"
          aria-label="Terminal actions"
          title="Terminal actions (copy selection, send to Brain, send to chat…)"
        >
          <IconBolt />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[240px] rounded-md border border-border bg-surface p-1 text-[12px] text-text-primary shadow-sm focus:outline-none"
        >
          <Item
            icon={<IconCopy />}
            shortcut="⌘C"
            disabled={!hasSel}
            onSelect={() => actions?.copy()}
          >
            Copy selection
          </Item>
          <Item
            icon={<IconBrain />}
            disabled={!hasSel}
            onSelect={() => void actions?.captureToBrain()}
          >
            Capture to Brain
          </Item>
          <Item
            icon={<IconPaste />}
            shortcut="⌘V"
            onSelect={() => void actions?.paste()}
          >
            Paste
          </Item>
          <div className="my-1 h-px bg-border" />
          <Item icon={<IconEraser />} shortcut="⌃U" onSelect={() => actions?.clearLine()}>
            Clear input line
          </Item>
          <Item icon={<IconTrash />} shortcut="⌘K" onSelect={() => actions?.clearScreen()}>
            Clear screen
          </Item>
          <div className="my-1 h-px bg-border" />
          <Item icon={<IconPaperclip />} onSelect={() => void actions?.attachFile()}>
            Attach file…
          </Item>
          <Item icon={<IconImage />} onSelect={() => void actions?.attachImage()}>
            Attach image…
          </Item>
          {hasSel && (
            <p className="border-t border-border px-2 pb-1 pt-1.5 text-[10px] text-text-muted">
              Working with {selection.length} char{selection.length === 1 ? '' : 's'} selected.
            </p>
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}

function Item({
  children, onSelect, shortcut, icon, disabled
}: {
  children: React.ReactNode
  onSelect: () => void
  shortcut?: string
  icon?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <Dropdown.Item
      onSelect={(e) => { if (disabled) { e.preventDefault(); return } onSelect() }}
      disabled={disabled}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-text-secondary outline-none hover:bg-elevated hover:text-text-primary focus:bg-elevated focus:text-text-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[disabled]:hover:bg-transparent"
    >
      <span className="flex items-center gap-2">
        {icon && <span className="grid h-4 w-4 place-items-center text-text-muted" aria-hidden="true">{icon}</span>}
        <span>{children}</span>
      </span>
      {shortcut && <span className="font-mono text-[10.5px] text-text-muted">{shortcut}</span>}
    </Dropdown.Item>
  )
}

/* ---------- Icons (16px, currentColor stroke) ---------- */

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}
const IconBolt = () => <Svg><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" /></Svg>
const IconCopy = () => <Svg><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Svg>
const IconPaste = () => <Svg><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></Svg>
const IconEraser = () => <Svg><path d="m4 14 6 6 12-12-6-6Z" /><path d="M10 20H4" /></Svg>
const IconTrash = () => <Svg><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></Svg>
const IconPaperclip = () => <Svg><path d="m21 11-9.5 9.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5L9 18a2 2 0 0 1-3-3l8-8" /></Svg>
const IconImage = () => <Svg><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></Svg>
const IconBrain = () => <Svg><path d="M9 3a3 3 0 0 0-3 3v0a3 3 0 0 0-3 3v3a3 3 0 0 0 3 3v0a3 3 0 0 0 3 3h0V3Z" /><path d="M15 3a3 3 0 0 1 3 3v0a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3v0a3 3 0 0 1-3 3h0V3Z" /></Svg>
