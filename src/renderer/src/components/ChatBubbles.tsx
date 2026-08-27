// Shared chat-bubble rendering primitives.
//
// Pure presentational components extracted from ChatView so the Project,
// Design, and Loom tabs all render assistant / user / system messages with
// identical look, animations, and tool-call surface.
//
// The components accept a structural message type so both `ChatMessage`
// (project) and `LoomMessage` (loom) satisfy it without adapters.

import { chatActivityLabel, summarizeChatTools, type ChatToolGroup } from './chatActivity'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
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
            <span title={`Took ${formatChatElapsed(elapsed.ms)}`}>
              {message.status === 'streaming'
                ? `Working… ${formatChatElapsed(elapsed.ms)}`
                : (chatActivityLabel(grouped) ?? `Worked for ${formatChatElapsed(elapsed.ms)}`)}
            </span>
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

/**
 * True while rendering the children of a fenced code block.
 *
 * react-markdown stopped passing an `inline` flag to the `code` component in
 * v9, so the only reliable way to tell a fenced block from an inline span is
 * position: a fenced block is a `code` inside a `pre`. Reading it from context
 * beats guessing from the language class, which would misread a fence that
 * has no language as an inline span.
 */
const InCodeBlock = createContext(false)

/**
 * Turns a `t42://` link in a reply into a jump inside the app.
 *
 * The app already listens for these moves on the window; until now nothing
 * ever asked for one, so a reply could only tell somebody where to go and
 * hope they went. A link is the right shape for the ask because a reply is
 * markdown and markdown already has links: no new syntax to teach and no
 * parsing of prose. Anything that is not our scheme falls through to a plain
 * anchor, so an ordinary https link is untouched.
 *
 * Returns null when the href is not one of ours, which is also how the
 * renderer decides between a button and an anchor.
 */
/**
 * Lets a `t42://` link survive react-markdown's URL sanitising.
 *
 * The default transform blanks every scheme it does not recognise, which is
 * the right instinct — it is what stops `javascript:` in a reply — but it also
 * blanked ours, so the renderer below never saw an href to act on. Only our
 * own scheme is added to the safe list; everything else still goes through the
 * default, so the protection is unchanged for links from outside.
 */
function appUrlTransform(url: string): string {
  return url.startsWith('t42://') ? url : defaultUrlTransform(url)
}

function appJump(href: string | undefined): (() => void) | null {
  if (!href || !href.startsWith('t42://')) return null
  const path = href.slice('t42://'.length).replace(/\/$/, '')
  if (path === 'basis' || path === 'tokens') {
    return () => window.dispatchEvent(new Event('t42:open-tokens'))
  }
  if (path === 'terminal') {
    return () => window.dispatchEvent(new Event('t42:jump-to-terminal'))
  }
  const design = /^design\/(.+)$/.exec(path)
  if (design) {
    const designId = decodeURIComponent(design[1])
    return () => window.dispatchEvent(new CustomEvent('t42:open-design', { detail: { designId } }))
  }
  return null
}

export function MarkdownContent({ content }: { content: string }): JSX.Element {
  // Memoise renderer config so streaming updates don't reconstruct components.
  const components = useMemo(() => ({
    a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
      const jump = appJump(props.href)
      if (jump) {
        const { children } = props
        return (
          <button
            type="button"
            onClick={jump}
            className="rounded-sm text-accent underline hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {children}
          </button>
        )
      }
      return <a {...props} target="_blank" rel="noreferrer noopener" className="text-accent underline hover:opacity-80" />
    },
    pre: (props: React.HTMLAttributes<HTMLPreElement>) => {
      const { children, ...rest } = props
      return (
        <InCodeBlock.Provider value={true}>
          <pre
            className="my-2 overflow-x-auto rounded-lg bg-elevated p-3 font-mono text-[12.5px] leading-relaxed text-text-primary"
            {...rest}
          >
            {children}
          </pre>
        </InCodeBlock.Provider>
      )
    },
    code: (props: React.HTMLAttributes<HTMLElement>) => {
      const { className, children, ...rest } = props
      return <CodeSpan className={className} rest={rest}>{children}</CodeSpan>
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
  return <ReactMarkdown components={components} urlTransform={appUrlTransform}>{content}</ReactMarkdown>
}

/**
 * A `code` element, styled as a chip inline and as plain text inside a fence.
 *
 * Applying the chip styling inside a fence would draw a rounded, padded box
 * around every code block's contents — which is what a file path in the middle
 * of a sentence used to look like, only inverted.
 */
function CodeSpan({
  className,
  rest,
  children
}: {
  className?: string
  rest: React.HTMLAttributes<HTMLElement>
  children?: React.ReactNode
}): JSX.Element {
  const inBlock = useContext(InCodeBlock)
  if (inBlock) return <code className={className} {...rest}>{children}</code>
  return (
    <code
      className="rounded bg-elevated px-1 py-0.5 font-mono text-[12.5px] text-text-primary"
      {...rest}
    >
      {children}
    </code>
  )
}
