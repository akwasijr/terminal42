import { useEffect, useState } from 'react'
import { IconBranch, IconChevronRight, IconFolder, IconWorktree } from './icons'

export function ChipsRow({
  cwd,
  onOpenFolder,
  onNewWorktree
}: {
  cwd: string | null
  onOpenFolder?: () => void
  onNewWorktree?: () => void
}) {
  const [branch, setBranch] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [isRepo, setIsRepo] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!cwd) {
      setBranch(null); setDirty(false); setIsRepo(false)
      return () => { cancelled = true }
    }
    const refresh = () => {
      void window.terminal42.git.status(cwd).then((s) => {
        if (cancelled) return
        setIsRepo(!!s.isRepo)
        setBranch(s.branch ?? null)
        setDirty(!!s.dirty)
      }).catch(() => {})
    }
    refresh()
    const t = setInterval(refresh, 8000)
    return () => { cancelled = true; clearInterval(t) }
  }, [cwd])

  const folderLabel = cwd ? (cwd.split('/').filter(Boolean).pop() ?? cwd) : ':'

  return (
    <div className="flex items-center gap-2 px-5 pb-2 text-[12px] text-text-secondary">
      <Chip
        icon={<IconFolder size={12} />}
        label={folderLabel}
        title={cwd ?? undefined}
        onClick={onOpenFolder}
        hasMenu={!!onOpenFolder}
      />
      <Chip
        icon={<IconWorktree size={12} />}
        label="New worktree"
        title="Create a git worktree (coming soon)"
        onClick={onNewWorktree}
        hasMenu={!!onNewWorktree}
        muted
      />
      {isRepo && (
        <Chip
          icon={<IconBranch size={12} />}
          label={branch ?? 'detached'}
          title={dirty ? 'Working tree has uncommitted changes' : 'Working tree clean'}
          dot={dirty ? 'amber' : 'green'}
        />
      )}
    </div>
  )
}

function Chip({
  icon,
  label,
  title,
  onClick,
  hasMenu,
  muted,
  dot
}: {
  icon: React.ReactNode
  label: string
  title?: string
  onClick?: () => void
  hasMenu?: boolean
  muted?: boolean
  dot?: 'green' | 'amber'
}) {
  const interactive = !!onClick
  const className = [
    'flex h-7 items-center gap-1.5 rounded-md px-2 outline-none focus:outline-none',
    interactive ? 'cursor-pointer hover:bg-surface hover:text-text-primary' : 'cursor-default',
    muted ? 'text-text-muted' : ''
  ].filter(Boolean).join(' ')
  const inner = (
    <>
      <span className="text-text-muted">{icon}</span>
      <span className="truncate max-w-[200px]">{label}</span>
      {dot && (
        <span
          className={dot === 'amber' ? 'h-1.5 w-1.5 rounded-full bg-warning' : 'h-1.5 w-1.5 rounded-full bg-success'}
          aria-hidden="true"
        />
      )}
      {hasMenu && <IconChevronRight size={9} className="rotate-90 text-text-muted" />}
    </>
  )
  if (interactive) {
    return (
      <button type="button" onClick={onClick} title={title} className={className}>{inner}</button>
    )
  }
  return <div title={title} className={className}>{inner}</div>
}

