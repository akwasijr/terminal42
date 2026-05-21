import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../../preload/index'
import {
  AssistantBubble, UserBubble, SystemBubble, ThinkingIndicator, ChatEmptyState
} from './ChatBubbles'

export function ChatView({
  sessionId,
  onBusyChange
}: {
  sessionId: string
  onBusyChange?: (busy: boolean) => void
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
    return () => { offMessage(); offDelta(); offTool(); offStart(); offDone() }
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

  return (
    <div ref={scrollRef} className="h-full w-full overflow-y-auto px-4 py-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        {!loaded && (
          <div className="grid place-items-center py-16 text-text-muted">Loading…</div>
        )}
        {isEmpty && <ChatEmptyState />}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {busy && <ThinkingIndicator />}
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }): JSX.Element {
  if (message.role === 'user') return <UserBubble message={message} />
  if (message.role === 'system') return <SystemBubble message={message} />
  return <AssistantBubble message={message} />
}


