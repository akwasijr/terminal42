import { useState } from 'react'
import type { JSX } from 'react'
import { IconClose } from './icons'

/**
 * The row of folder chips above a list.
 *
 * Shared rather than copied because two lists show folders now — designs and
 * token libraries — and a second implementation would drift from the first
 * within a week. The folders themselves come from lib/designFolders, which
 * scopes them to the section they were made in.
 */

function FolderChip({
  active,
  onClick,
  label,
  count,
  onRemove
}: {
  active: boolean
  onClick: () => void
  label: string
  count?: number
  onRemove?: () => void
}): JSX.Element {
  return (
    <span
      className={[
        'group inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] transition-colors',
        active ? 'bg-elevated text-text-primary' : 'text-text-secondary hover:bg-elevated/60 hover:text-text-primary'
      ].join(' ')}
    >
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
          {onRemove ? (
            <path d="M2 4.5a1 1 0 0 1 1-1h3l1.2 1.2H13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
          ) : (
            <rect x="2" y="3.5" width="12" height="9.5" rx="1.2" />
          )}
        </svg>
        <span>{label}</span>
        {count != null && count > 0 && <span className="text-[10px] text-text-muted">{count}</span>}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="Delete folder"
          className="grid h-3.5 w-3.5 place-items-center rounded text-text-muted opacity-0 hover:text-error group-hover:opacity-100"
        >
          <IconClose size={8} />
        </button>
      )}
    </span>
  )
}

export function FolderBar({
  folders,
  filter,
  onFilter,
  count,
  onCreate,
  onRemove,
  adding,
  onAddingChange
}: {
  folders: string[]
  filter: string
  onFilter: (f: string) => void
  count: (name: string) => number
  onCreate: (name: string) => void
  onRemove: (name: string) => void
  /** Whether the name field is open. Owned outside so the New menu can open it. */
  adding: boolean
  onAddingChange: (open: boolean) => void
}): JSX.Element | null {
  const [name, setName] = useState('')
  if (!folders.length && !adding) return null

  const commit = (): void => {
    onCreate(name)
    setName('')
    onAddingChange(false)
  }

  return (
    <div className="-mt-1 mb-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] font-medium text-text-muted">Folders</span>
      <FolderChip active={filter === 'all'} onClick={() => onFilter('all')} label="All" />
      {folders.map((f) => (
        <FolderChip
          key={f}
          active={filter === f}
          onClick={() => onFilter(f)}
          label={f}
          count={count(f)}
          onRemove={() => onRemove(f)}
        />
      ))}
      {adding && (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setName('')
              onAddingChange(false)
            }
          }}
          onBlur={commit}
          placeholder="Folder name…"
          className="w-36 rounded-md bg-elevated px-2 py-1 text-[12px] text-text-primary focus:outline-none"
        />
      )}
    </div>
  )
}
