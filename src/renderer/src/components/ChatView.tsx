import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../../preload/index'
import {
  AssistantBubble, UserBubble, SystemBubble, ThinkingIndicator
} from './ChatBubbles'
import { DiffCard } from './DiffCard'
import { ChatEmptyStateFull } from './ChatEmptyStateFull'
import { COMPOSER_FILL_EVENT } from './composerFill'

export function ChatView({
  sessionId,
  onBusyChange,
  onHasMessagesChange,
  onOpenFile
}: {
  sessionId: string
  onBusyChange?: (busy: boolean) => void
  onHasMessagesChange?: (has: boolean) => void
  onOpenFile?: (messageId: string, path: string) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  // Load history on mount/session change
  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    setMessages([])
    void window.terminal42.chat.history(sessionId).then((rows) => {
      if (cancelled) return
      setMessages(rows)
      setLoaded(true)
    }).catch(() => {
      if (!cancelled) setLoaded(true)
    })
    void window.terminal42.chat.isBusy(sessionId).then((b) => {
      if (cancelled) return
      setBusy(b)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [sessionId])

  useEffect(() => { onBusyChange?.(busy) }, [busy, onBusyChange])
  useEffect(() => { onHasMessagesChange?.(messages.length > 0) }, [messages.length, onHasMessagesChange])

  // Subscribe to streaming events
  useEffect(() => {
    const offMessage = window.terminal42.chat.onMessage((m) => {
      if (m.sessionId !== sessionId) return
      setMessages((prev) => {
        const idx = prev.findIndex((p) => p.id === m.id)
        if (idx === -1) return [...prev, m]
        const next = prev.slice()
        next[idx] = m
        return next
      })
    })
    const offDelta = window.terminal42.chat.onDelta((d) => {
      if (d.sessionId !== sessionId) return
      setMessages((prev) => {
        const idx = prev.findIndex((p) => p.id === d.messageId)
        if (idx === -1) return prev
        const next = prev.slice()
        next[idx] = { ...next[idx], content: next[idx].content + d.delta }
        return next
      })
    })
    const offTool = window.terminal42.chat.onTool((d) => {
      if (d.sessionId !== sessionId) return
      setMessages((prev) => {
        // Attach tool to the most recent streaming assistant msg, or last assistant
        const idx = (() => {
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i].role === 'assistant') return i
          }
          return -1
        })()
        if (idx === -1) return prev
        const next = prev.slice()
        const m = next[idx]
        const tcs = m.toolCalls.slice()
        const existing = tcs.findIndex((t) => t.id === d.tool.id)
        if (existing === -1) tcs.push(d.tool)
        else tcs[existing] = d.tool
        next[idx] = { ...m, toolCalls: tcs }
        return next
      })
    })
    const offStart = window.terminal42.chat.onStart((d) => {
      if (d.sessionId !== sessionId) return
      setBusy(true)
    })
    const offDone = window.terminal42.chat.onDone((d) => {
      if (d.sessionId !== sessionId) return
      setBusy(false)
    })
    // Diffs arrive shortly after `done`: computing them is detached from the
    // turn so the response is never held up waiting on git.
    const offDiff = window.terminal42.chat.onDiff((d) => {
      if (d.sessionId !== sessionId) return
      setMessages((prev) => {
        const idx = prev.findIndex((p) => p.id === d.messageId)
        if (idx === -1) return prev
        const next = prev.slice()
        next[idx] = { ...next[idx], diff: d.diff, undone: false }
        return next
      })
    })
    return () => { offMessage(); offDelta(); offTool(); offStart(); offDone(); offDiff() }
  }, [sessionId])

  // Scroll-to-bottom handling
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = (): void => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      stickToBottomRef.current = distanceFromBottom < 80
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!stickToBottomRef.current) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, busy])

  const isEmpty = loaded && messages.length === 0

  // The empty state is centred in the whole pane, so it bypasses the
  // max-w-3xl message column and the scroll padding entirely.
  if (isEmpty) {
    return (
      <div className="h-full w-full overflow-y-auto">
        <ChatEmptyStateFull
          onPick={(text) => {
            window.dispatchEvent(new CustomEvent(COMPOSER_FILL_EVENT, { detail: { sessionId, text } }))
          }}
        />
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="h-full w-full overflow-y-auto px-4 py-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        {!loaded && (
          <div className="grid place-items-center py-16 text-text-muted">Loading…</div>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onUndone={() => setMessages((prev) => prev.map((p) => (p.id === m.id ? { ...p, undone: true } : p)))}
            onOpenFile={onOpenFile ? (path) => onOpenFile(m.id, path) : undefined}
          />
        ))}
        {busy && <ThinkingIndicator />}
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  onUndone,
  onOpenFile
}: {
  message: ChatMessage
  onUndone?: () => void
  onOpenFile?: (path: string) => void
}): JSX.Element {
  if (message.role === 'user') return <UserBubble message={message} />
  if (message.role === 'system') return <SystemBubble message={message} />
  return (
    <div className="flex flex-col gap-2">
      <AssistantBubble message={message} />
      {message.diff && message.diff.files.length > 0 && (
        <DiffCard
          messageId={message.id}
          diff={message.diff}
          undone={message.undone}
          onUndone={onUndone}
          onOpenFile={onOpenFile}
        />
      )}
    </div>
  )
}


