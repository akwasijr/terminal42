// Shared chat-bubble rendering primitives.
//
// Pure presentational components extracted from ChatView so the Project,
// Design, and Loom tabs all render assistant / user / system messages with
// identical look, animations, and tool-call surface.
//
// The components accept a structural message type so both `ChatMessage`
// (project) and `LoomMessage` (loom) satisfy it without adapters.

import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { IconBolt, IconCheck, IconChevronRight, IconClose, IconCopy } from './icons'
import { BoxesThinking } from './PencilThinking'

export type ChatLikeToolCall = {
  id: string
  name: string
  input?: string
  status: 'running' | 'done' | 'error'
  summary?: string
}

export type ChatLikeMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls: ChatLikeToolCall[]
  status: 'pending' | 'streaming' | 'done' | 'error' | 'cancelled' | string
  createdAt: number
}

// ----- Public bubble components ------------------------------------------

export function UserBubble({ message }: { message: ChatLikeMessage }): JSX.Element {
  const [copied, setCopied] = useState(false)
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(message.content || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }
  return (
    <div className="group/u flex flex-col items-end gap-1">
      <div className="flex max-w-[85%] items-start gap-2">
        <div className="select-text rounded-2xl rounded-br-md bg-elevated/40 px-3.5 py-2 text-[14px] leading-relaxed text-text-primary whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
      <div className="flex items-center gap-1.5 pr-1 text-[10.5px] text-text-muted opacity-0 transition-opacity group-hover/u:opacity-100">
        <span title={new Date(message.createdAt).toLocaleString()}>{relativeTimeShort(message.createdAt)}</span>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? 'Copied' : 'Copy message'}
          title={copied ? 'Copied' : 'Copy message'}
          className="grid h-4 w-4 place-items-center rounded text-text-muted hover:text-text-primary"
        >
          {copied ? <IconCheck size={10} /> : <IconCopy size={10} />}
        </button>
      </div>
    </div>
  )
}

export function AssistantBubble({
  message,
  extraFooter
}: {
  message: ChatLikeMessage
  // Optional slot rendered after the message footer actions (used by Loom
  // for citation chips / save-to-note / suggest-artifact).
  extraFooter?: React.ReactNode
}): JSX.Element {
  const empty = !message.content && message.status === 'streaming'
  const elapsed = useChatElapsed(message)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const grouped = useMemo(() => groupChatTools(message.toolCalls), [message.toolCalls])
  const hasMeta = grouped.length > 0

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(message.content || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className="group/msg flex select-text flex-col gap-1.5">
      {hasMeta && (
        <div className="select-none">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            title={open ? 'Hide activity' : 'Show activity'}
            className="inline-flex items-center gap-1 text-[12px] text-text-muted hover:text-text-secondary"
          >
            <IconChevronRight size={9} className={['shrink-0 transition-transform', open ? 'rotate-90' : ''].join(' ')} />
            <span>{message.status === 'streaming' ? `Working… ${formatChatElapsed(elapsed.ms)}` : `Worked for ${formatChatElapsed(elapsed.ms)}`}</span>
          </button>
          {open && (
            <div className="mt-2 ml-3 pl-3 text-[12.5px] leading-relaxed text-text-secondary">
              <p className="select-text">{summarizeChatTools(grouped)}</p>
            </div>
          )}
        </div>
      )}
      <div className="text-[14px] leading-[1.65] text-text-primary [&_p+p]:mt-2.5 [&_p+ul]:mt-2 [&_ul+p]:mt-2.5">
        {empty ? <span className="text-text-muted">…</span> : <MarkdownContent content={message.content} />}
      </div>
      {message.status !== 'streaming' && message.content && (
        <div className="mt-0.5 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/msg:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => void copy()}
            title={copied ? 'Copied' : 'Copy text'}
            aria-label={copied ? 'Copied' : 'Copy text'}
            className={['grid h-6 w-6 place-items-center rounded transition-colors',
              copied ? 'text-text-primary' : 'text-text-muted hover:bg-elevated hover:text-text-primary'].join(' ')}
          >
            {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
          </button>
          {extraFooter}
        </div>
      )}
    </div>
  )
}

export function SystemBubble({ message }: { message: ChatLikeMessage }): JSX.Element {
  return (
    <div className="flex justify-center">
      <div className="rounded-full bg-elevated px-3 py-1 text-[12px] text-text-muted">
        {message.content}
      </div>
    </div>
  )
}

export function ThinkingIndicator({ label = 'Copilot is thinking…' }: { label?: string } = {}): JSX.Element {
  return (
    <div className="flex items-end gap-2 px-1 text-[12px] text-text-muted">
      <BoxesThinking />
      <span className="leading-none">{label}</span>
    </div>
  )
}

export function ChatEmptyState({
  title = 'Start a new conversation'
}: { title?: string; body?: string } = {}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
      <IconBolt size={20} className="text-accent" />
      <h2 className="text-[15px] font-medium text-text-primary">{title}</h2>
    </div>
  )
}

// ----- Internals ----------------------------------------------------------

type ChatToolGroup = { name: string; status: 'running' | 'done' | 'error'; count: number }

function groupChatTools(calls: ChatLikeToolCall[]): ChatToolGroup[] {
  const order: string[] = []
  const map = new Map<string, ChatToolGroup>()
  for (const c of calls) {
    if (!map.has(c.name)) { order.push(c.name); map.set(c.name, { name: c.name, status: c.status, count: 1 }) }
    else {
      const g = map.get(c.name)!
      g.count += 1
      if (c.status === 'error') g.status = 'error'
      else if (c.status === 'running' && g.status !== 'error') g.status = 'running'
    }
  }
  return order.map((n) => map.get(n)!)
}

function useChatElapsed(message: ChatLikeMessage): { ms: number; final: boolean } {
  const startRef = useRef<number>(message.createdAt || Date.now())
  const finalRef = useRef<number | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (message.status === 'streaming') {
      finalRef.current = null
      const t = setInterval(() => setTick((n) => n + 1), 1000)
      return () => clearInterval(t)
    }
    if (finalRef.current === null) finalRef.current = Date.now()
    setTick((n) => n + 1)
    return
  }, [message.status])
  void tick
  const end = finalRef.current ?? Date.now()
  return { ms: Math.max(0, end - startRef.current), final: finalRef.current !== null }
}

function formatChatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function summarizeChatTools(tools: ChatToolGroup[]): string {
  const verbs: string[] = []
  for (const t of tools) {
    const n = t.name.toLowerCase()
    if (n === 'view' || n === 'read' || n === 'read_file' || n.includes('view')) verbs.push(`read ${t.count} file${t.count === 1 ? '' : 's'}`)
    else if (n === 'edit' || n === 'edit_file' || n.startsWith('apply_patch')) verbs.push(`made ${t.count} edit${t.count === 1 ? '' : 's'}`)
    else if (n === 'create' || n === 'write' || n === 'write_file') verbs.push(`created ${t.count} file${t.count === 1 ? '' : 's'}`)
    else if (n === 'bash' || n === 'shell' || n.includes('exec')) verbs.push(`ran ${t.count} command${t.count === 1 ? '' : 's'}`)
    else if (n.includes('grep') || n.includes('search') || n.includes('rg')) verbs.push(`searched ${t.count} time${t.count === 1 ? '' : 's'}`)
    else if (n.includes('glob') || n.includes('list')) verbs.push(`listed files`)
    else if (n.startsWith('figma-')) verbs.push(`called Figma ${t.count > 1 ? `×${t.count}` : ''}`.trim())
    else verbs.push(`used ${t.name}${t.count > 1 ? ` ×${t.count}` : ''}`)
  }
  if (verbs.length === 0) return 'No tool activity recorded.'
  if (verbs.length === 1) return verbs[0][0].toUpperCase() + verbs[0].slice(1) + '.'
  const last = verbs.pop()!
  const head = verbs.join(', ')
  return head[0].toUpperCase() + head.slice(1) + `, and ${last}.`
}

function relativeTimeShort(at: number): string {
  if (!at) return ''
  const diff = Math.max(0, Date.now() - at)
  const s = Math.round(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}

function ToolPill({ tool }: { tool: ChatLikeToolCall }): JSX.Element {
  const tone =
    tool.status === 'error' ? 'bg-error/10 text-error'
    : tool.status === 'running' ? 'bg-elevated text-text-secondary animate-pulse'
    : 'bg-elevated text-text-secondary'
  const Icon = tool.status === 'error' ? IconClose : tool.status === 'done' ? IconCheck : IconBolt
  return (
    <span
      title={tool.input || tool.summary || tool.name}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${tone}`}
    >
      <Icon size={10} />
      <span className="truncate max-w-[220px]">{tool.name}</span>
    </span>
  )
}
// Exported in case future callers want the raw tool pill.
export { ToolPill }

function MarkdownContent({ content }: { content: string }): JSX.Element {
  // Memoise renderer config so streaming updates don't reconstruct components.
  const components = useMemo(() => ({
    a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a {...props} target="_blank" rel="noreferrer noopener" className="text-accent underline hover:opacity-80" />
    ),
    code: (props: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) => {
      const { inline, className, children, ...rest } = props
      if (inline) {
        return <code className="rounded bg-elevated px-1 py-0.5 font-mono text-[12.5px] text-text-primary" {...rest}>{children}</code>
      }
      return (
        <pre className="my-2 overflow-x-auto rounded-lg bg-elevated p-3 font-mono text-[12.5px] leading-relaxed text-text-primary">
          <code className={className} {...rest}>{children}</code>
        </pre>
      )
    },
    p: (props: React.HTMLAttributes<HTMLParagraphElement>) => <p className="my-1.5 first:mt-0 last:mb-0" {...props} />,
    ul: (props: React.HTMLAttributes<HTMLUListElement>) => <ul className="my-1.5 list-disc pl-5" {...props} />,
    ol: (props: React.OlHTMLAttributes<HTMLOListElement>) => <ol className="my-1.5 list-decimal pl-5" {...props} />,
    li: (props: React.LiHTMLAttributes<HTMLLIElement>) => <li className="my-0.5" {...props} />,
    h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h1 className="mt-3 mb-1.5 text-[16px] font-semibold" {...props} />,
    h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h2 className="mt-3 mb-1.5 text-[15px] font-semibold" {...props} />,
    h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className="mt-2 mb-1 text-[14px] font-semibold" {...props} />,
    blockquote: (props: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
      <blockquote className="my-2 rounded-md bg-elevated/60 px-3 py-1.5 text-text-secondary" {...props} />
    )
  }), [])
  return <ReactMarkdown components={components}>{content}</ReactMarkdown>
}
