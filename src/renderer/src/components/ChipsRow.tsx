import { useEffect, useState } from 'react'
import { IconBranch, IconFolder } from './icons'

export function ChipsRow({
  cwd,
  onOpenFolder
}: {
  cwd: string | null
  onOpenFolder?: () => void
}) {
  const [branch, setBranch] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [isRepo, setIsRepo] = useState(false)
  const [ahead, setAhead] = useState(0)
  const [behind, setBehind] = useState(0)

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
        setAhead(s.ahead ?? 0)
        setBehind(s.behind ?? 0)
      }).catch(() => {})
    }
    refresh()
    const t = setInterval(refresh, 8000)
    return () => { cancelled = true; clearInterval(t) }
  }, [cwd])

  if (!cwd) return null

  const folderLabel = cwd.split('/').filter(Boolean).pop() ?? cwd
  const branchTitle = [
    dirty ? 'Uncommitted changes' : 'Working tree clean',
    ahead ? `${ahead} ahead` : '',
    behind ? `${behind} behind` : ''
  ].filter(Boolean).join(' · ')

  return (
    <div className="flex items-center gap-1 px-4 pb-1 text-[12px] text-text-secondary">
      <Chip
        icon={<IconFolder size={12} />}
        label={folderLabel}
        title={onOpenFolder ? `${cwd} — click to reveal in Finder` : cwd}
        onClick={onOpenFolder}
      />
      {isRepo && (
        <Chip
          icon={<IconBranch size={12} />}
          label={branch ?? 'detached'}
          title={branchTitle}
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
  muted,
  dot
}: {
  icon: React.ReactNode
  label: string
  title?: string
  onClick?: () => void
  muted?: boolean
  dot?: 'green' | 'amber'
}) {
  const interactive = !!onClick
  const className = [
    'flex h-7 items-center gap-1.5 rounded-md px-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
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
    </>
  )
  if (interactive) {
    return (
      <button type="button" onClick={onClick} title={title} className={className}>{inner}</button>
    )
  }
  return <div title={title} className={className}>{inner}</div>
}

