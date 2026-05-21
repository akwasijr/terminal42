import { useEffect, useRef, useState } from 'react'

export type VTElementInfo = {
  tag: string
  selector: string
  componentName?: string | null
  classList?: string[]
  filePath?: string | null
  lineNumber?: number | null
}

export type VTElementDiff = {
  element: VTElementInfo
  changes: Array<{ property: string; oldValue: string; newValue: string }>
  suggestedClasses?: string[]
}

export type VTConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

const VT_PORT = 7890

/**
 * Connects to the local viztweak WebSocket bridge (started by `npx viztweak`)
 * and exposes the live diffs that the user is making in their browser.
 */
export function useVizTweak(enabled: boolean): {
  state: VTConnectionState
  diffs: VTElementDiff[]
  selectedElement: VTElementInfo | null
  clear: () => void
} {
  const [state, setState] = useState<VTConnectionState>('disconnected')
  const [diffs, setDiffs] = useState<VTElementDiff[]>([])
  const [selectedElement, setSelectedElement] = useState<VTElementInfo | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<number>(0)
  const timerRef = useRef<number | null>(null)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null }
      wsRef.current?.close()
      wsRef.current = null
      setState('disconnected')
      return
    }

    let cancelled = false
    const connect = () => {
      if (cancelled || !enabledRef.current) return
      setState('connecting')
      let ws: WebSocket
      try {
        ws = new WebSocket(`ws://127.0.0.1:${VT_PORT}`)
      } catch {
        scheduleRetry()
        return
      }
      wsRef.current = ws

      ws.onopen = () => {
        retryRef.current = 0
        setState('connected')
      }
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(typeof evt.data === 'string' ? evt.data : '')
          if (!msg || typeof msg !== 'object') return
          if (msg.type === 'changes_updated' && Array.isArray(msg.payload?.diffs)) {
            setDiffs(msg.payload.diffs as VTElementDiff[])
          } else if (msg.type === 'changes_cleared') {
            setDiffs([])
          } else if (msg.type === 'element_selected' && msg.payload?.element) {
            setSelectedElement(msg.payload.element as VTElementInfo)
          }
        } catch {
          /* ignore malformed frames */
        }
      }
      ws.onerror = () => { setState('error') }
      ws.onclose = () => {
        wsRef.current = null
        setState('disconnected')
        scheduleRetry()
      }
    }

    const scheduleRetry = () => {
      if (cancelled || !enabledRef.current) return
      retryRef.current = Math.min(retryRef.current + 1, 6)
      const delay = Math.min(1000 * 2 ** retryRef.current, 15000)
      timerRef.current = window.setTimeout(connect, delay)
    }

    connect()
    return () => {
      cancelled = true
      if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null }
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [enabled])

  const clear = () => {
    setDiffs([])
    try {
      wsRef.current?.send(JSON.stringify({ type: 'clear_changes', payload: {} }))
    } catch {
      /* not connected */
    }
  }

  return { state, diffs, selectedElement, clear }
}

export function isLocalPreviewUrl(url: string): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true
    if (/^192\.168\.\d+\.\d+$/.test(host)) return true
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true
    if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) return true
    return false
  } catch {
    return false
  }
}

export function formatDiffsAsPrompt(diffs: VTElementDiff[]): string {
  if (!diffs.length) return ''
  const lines: string[] = []
  lines.push('I made the following visual changes in the browser. Please apply them in code:')
  lines.push('')
  diffs.forEach((d, i) => {
    const el = d.element
    const head = el.componentName
      ? `**${i + 1}. <${el.componentName}>** \`${el.selector}\``
      : `**${i + 1}. \`${el.selector}\`**`
    lines.push(head)
    if (el.filePath) {
      lines.push(`Source: \`${el.filePath}${el.lineNumber ? ':' + el.lineNumber : ''}\``)
    }
    if (d.suggestedClasses && d.suggestedClasses.length) {
      lines.push(`Suggested classes: \`${d.suggestedClasses.join(' ')}\``)
    }
    if (d.changes.length) {
      lines.push('')
      lines.push('| Property | Before | After |')
      lines.push('| --- | --- | --- |')
      for (const c of d.changes) {
        lines.push(`| \`${c.property}\` | \`${c.oldValue || ':'}\` | \`${c.newValue || ':'}\` |`)
      }
    }
    lines.push('')
  })
  lines.push("Keep the existing structure and behavior. Apply the changes using the project's existing styling approach (Tailwind / CSS modules / styled-components / etc.).")
  return lines.join('\n')
}
