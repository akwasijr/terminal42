import { useEffect, useState } from 'react'
import { IconBrain, IconClose } from './icons'

const STORAGE_KEY = 't42:brain-applied:v1'

function appliedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function persist(set: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)))
  } catch {}
}

export function ApplyBrainPrompt({
  sessionId,
  projectId
}: {
  sessionId: string
  projectId: string | null
}) {
  const [flat, setFlat] = useState<string>('')
  const [ruleCount, setRuleCount] = useState<number>(0)
  const [dismissed, setDismissed] = useState<boolean>(false)
  const [autoApply, setAutoApply] = useState<boolean>(true)

  useEffect(() => {
    setDismissed(appliedSet().has(sessionId))
    let cancelled = false
    void window.terminal42.settings.get().then((s) => {
      if (!cancelled) setAutoApply(!!s.brainAutoApply)
    })
    void window.terminal42.brain.merged(projectId, sessionId).then((m) => {
      if (cancelled) return
      setFlat(m.flat || '')
      setRuleCount(m.ruleCount || 0)
    })
    return () => {
      cancelled = true
    }
  }, [sessionId, projectId])

  if (autoApply || dismissed || !flat || ruleCount === 0) return null

  const remember = () => {
    const set = appliedSet()
    set.add(sessionId)
    persist(set)
    setDismissed(true)
  }

  const apply = async () => {
    const preface = `[Terminal42 brain: please follow these for this session: ${flat}]`
    await window.terminal42.pty.write(sessionId, preface + '\r')
    remember()
  }

  return (
    <div
      role="status"
      className="flex items-center gap-3 bg-surface px-4 py-2 text-[12px] text-text-secondary"
    >
      <span className="grid h-6 w-6 place-items-center rounded-md text-text-secondary">
        <IconBrain size={14} />
      </span>
      <span className="flex-1">
        Send your Brain to this session?{' '}
        <span className="text-text-muted">
          {ruleCount} {ruleCount === 1 ? 'rule' : 'rules'} from Global · Project · Session.
        </span>
      </span>
      <button
        type="button"
        onClick={apply}
        className="rounded-md px-2 py-1 text-text-primary hover:bg-bg"
      >
        Send
      </button>
      <button
        type="button"
        onClick={remember}
        aria-label="Dismiss"
        className="grid h-6 w-6 place-items-center rounded-md text-text-muted hover:text-text-primary"
      >
        <IconClose size={12} />
      </button>
    </div>
  )
}
