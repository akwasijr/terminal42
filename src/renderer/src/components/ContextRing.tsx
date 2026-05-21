import { useEffect, useState } from 'react'
import type { ContextUsage } from '../../../preload/index'

// Small inline ring + percentage badge that lives next to the model picker
// in chat composers. Mirrors the indicator Claude Code shows in its CLI.
export function ContextRing({ copilotSessionId }: { copilotSessionId: string | null }): JSX.Element | null {
  const [usage, setUsage] = useState<ContextUsage | null>(null)

  useEffect(() => {
    setUsage(null)
    if (!copilotSessionId) return
    let cancelled = false
    void window.terminal42.copilot.contextUsage(copilotSessionId).then((u) => { if (!cancelled) setUsage(u) }).catch(() => {})
    const off = window.terminal42.copilot.onContextUsage(copilotSessionId, (u) => { if (!cancelled) setUsage(u) })
    const t = setInterval(() => {
      void window.terminal42.copilot.contextUsage(copilotSessionId).then((u) => { if (!cancelled) setUsage(u) }).catch(() => {})
    }, 8000)
    return () => { cancelled = true; clearInterval(t); off() }
  }, [copilotSessionId])

  if (!usage || usage.contextLimit <= 0) return null
  const pct = Math.max(0, Math.min(100, Math.round(usage.percent)))
  // Staleness: data > 5 min old means the session is idle or the numbers are
  // from a previous session lifecycle. Hide the ring to avoid misleading values.
  const ageMs = usage.sourceTimestamp ? Date.now() - new Date(usage.sourceTimestamp).getTime() : Infinity
  if (ageMs > 5 * 60 * 1000) return null
  // Ring colour shifts as we approach the cap.
  const tone =
    pct >= 90 ? { stroke: 'stroke-error',   text: 'text-error'   } :
    pct >= 75 ? { stroke: 'stroke-warning', text: 'text-warning' } :
                { stroke: 'stroke-text-secondary', text: 'text-text-muted' }

  const r = 6.5
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct / 100)
  const titleParts = [
    `${pct}% of context used`,
    `${formatTokens(usage.inputTokens)} of ${formatTokens(usage.contextLimit)} tokens`,
    usage.model ? `Model: ${usage.model}` : null,
    usage.source ? `Source: ${describeSource(usage.source, usage.sourceTimestamp)}` : null,
  ].filter(Boolean) as string[]

  return (
    <span
      className="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[11px] text-text-muted"
      title={titleParts.join('\n')}
      aria-label={titleParts[0]}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r={r} className="stroke-border" strokeWidth="1.4" fill="none" />
        <circle
          cx="8" cy="8" r={r}
          className={tone.stroke}
          strokeWidth="1.6"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 8 8)"
        />
      </svg>
      <span className={['tabular-nums', tone.text].join(' ')}>{pct}%</span>
    </span>
  )
}

function formatTokens(n: number): string {
  if (n <= 0) return '0'
  if (n < 1000) return String(n)
  if (n < 100_000) return `${(n / 1000).toFixed(1)}k`
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

function describeSource(source: 'shutdown' | 'truncation' | 'compaction', ts: string | null): string {
  const label =
    source === 'shutdown'   ? 'session shutdown' :
    source === 'truncation' ? 'last truncation'  :
                              'last compaction'
  if (!ts) return label
  const age = Date.now() - new Date(ts).getTime()
  if (!Number.isFinite(age) || age < 0) return label
  const m = Math.floor(age / 60000)
  if (m < 1) return `${label} (just now)`
  if (m < 60) return `${label} (${m}m ago)`
  const h = Math.floor(m / 60)
  if (h < 24) return `${label} (${h}h ago)`
  return `${label} (${Math.floor(h / 24)}d ago)`
}
