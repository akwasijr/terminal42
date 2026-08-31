import { useEffect, useRef, useState } from 'react'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { IconArrowUp, IconMic, IconPlus, IconStop } from './icons'
import { ModelDropdown } from './ModelDropdown'
import { ModePicker, getDefaultMode, persistMode, type AgentMode } from './ModePicker'
import { ContextRing } from './ContextRing'
import { useVoiceInput, formatVoiceTime, isVoiceInputSupported } from '../lib/voice'
import { COMPOSER_FILL_EVENT } from './composerFill'
import { TokenGlyph, TokenLibraryDetail, TokenLibraryModal } from './tokens/TokenLibraryModal'
import { useChatTokens } from '../lib/tokens/chatTokens'
import { requestNewTokens } from '../lib/tokens/openLatch'
import type { TokenLibrary } from '../lib/tokens/useTokenLibraries'

// Legacy local 2-mode type kept as a no-op so old localStorage entries don't crash.
type Mode = AgentMode

/**
 * Leave chat for the token library.
 *
 * Two events rather than one because landing on the library and landing on it
 * with the setup already open are different intents, and the list has to be
 * mounted before it can hear the second — App handles the tab switch on the
 * first, so the second is dispatched behind it and read from the latch.
 */
function openLibrary(fresh: boolean): void {
  window.dispatchEvent(new Event('t42:open-tokens'))
  if (fresh) {
    requestNewTokens()
    window.dispatchEvent(new Event('t42:tokens-new'))
  }
}

export function Composer({
  sessionId,
  model,
  modelPending,
  onModelPick,
  onModelRestart,
  modelPendingRestart,
  busy = false,
  hasMessages = false,
  onSend,
  onCancel,
  onAttachFile,
  onAttachImage
}: {
  sessionId: string
  model: string | null
  modelPending: boolean
  onModelPick: (id: string) => void
  onModelRestart?: () => void
  modelPendingRestart?: boolean
  busy?: boolean
  /** Switches the placeholder to a follow-up prompt once a turn has happened. */
  hasMessages?: boolean
  /**
   * The prefix carries the attached token library. It is sent but not shown,
   * so the transcript stays the conversation rather than the briefing.
   */
  onSend: (text: string, mode: AgentMode, prefix: string | null) => void
  onCancel?: () => void
  onAttachFile?: () => void
  onAttachImage?: () => void
}) {
  const tokens = useChatTokens(sessionId)
  const [body, setBody] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [savedDraft, setSavedDraft] = useState('')
  const [mode, setMode] = useState<Mode>(() => getDefaultMode())
  const [copilotSessionId, setCopilotSessionId] = useState<string | null>(null)
  const [tokensOpen, setTokensOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const attached = tokens.chosen
    ? tokens.libraries.find((l) => l.id === tokens.chosen?.id) ?? null
    : null

  useEffect(() => {
    let cancelled = false
    setCopilotSessionId(null)
    const fetchId = (): void => {
      void window.terminal42.sessions.get(sessionId).then((s) => {
        if (!cancelled) setCopilotSessionId(s?.copilot_session_id ?? null)
      }).catch(() => {})
    }
    fetchId()
    // The Copilot session id only appears after the first turn — poll until set.
    const t = setInterval(() => { if (!copilotSessionId) fetchId() }, 5000)
    return () => { cancelled = true; clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])
  const taRef = useRef<HTMLTextAreaElement>(null)
  const initialLoad = useRef(true)

  useEffect(() => {
    initialLoad.current = true
    setBody('')
    setHistoryIndex(null)
    void window.terminal42.composer.getDraft(sessionId).then((d) => {
      setBody(d)
      initialLoad.current = false
    })
    void window.terminal42.composer
      .history(sessionId)
      .then((rows) => setHistory(rows.map((r) => r.body)))
  }, [sessionId])

  useEffect(() => {
    if (initialLoad.current) return
    const t = setTimeout(() => {
      void window.terminal42.composer.saveDraft(sessionId, body)
    }, 400)
    return () => clearTimeout(t)
  }, [body, sessionId])

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [body])

  useEffect(() => {
    persistMode(mode)
  }, [mode])

  // Starter cards in the empty state fill the composer rather than sending, so
  // the user can adjust the specifics first; attachments append their paths to
  // whatever is already typed. Scoped by session id, since several composers
  // are mounted at once — one per open session.
  useEffect(() => {
    const onFill = (e: Event): void => {
      const detail = (e as CustomEvent<{ sessionId?: string; text?: string; mode?: 'replace' | 'append' }>).detail
      if (!detail?.text || detail.sessionId !== sessionId) return
      initialLoad.current = false
      setBody((prev) => {
        if (detail.mode !== 'append') return detail.text!
        if (!prev.trim()) return detail.text!
        return prev.replace(/\s*$/, '') + ' ' + detail.text!
      })
      requestAnimationFrame(() => {
        const ta = taRef.current
        if (!ta) return
        ta.focus()
        ta.setSelectionRange(ta.value.length, ta.value.length)
      })
    }
    window.addEventListener(COMPOSER_FILL_EVENT, onFill)
    return () => window.removeEventListener(COMPOSER_FILL_EVENT, onFill)
  }, [sessionId])

  const send = async () => {
    const trimmed = body.trim()
    if (!trimmed) return
    onSend(trimmed, mode, tokens.prefix)
    await window.terminal42.composer.pushHistory(sessionId, trimmed)
    await window.terminal42.composer.saveDraft(sessionId, '')
    setHistory((h) => [trimmed, ...h])
    setHistoryIndex(null)
    setBody('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault()
      if (!busy) void send()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!busy) void send()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length === 0) return
      if (historyIndex === null) {
        setSavedDraft(body)
        setBody(history[0])
        setHistoryIndex(0)
      } else if (historyIndex < history.length - 1) {
        const next = historyIndex + 1
        setBody(history[next])
        setHistoryIndex(next)
      }
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex === null) return
      if (historyIndex === 0) {
        setBody(savedDraft)
        setHistoryIndex(null)
      } else {
        const next = historyIndex - 1
        setBody(history[next])
        setHistoryIndex(next)
      }
    }
  }

  const canSend = body.trim().length > 0

  // Voice input: local whisper.cpp via main IPC.
  const voice = useVoiceInput({
    onTranscript: (text) => { if (text) setBody(text); taRef.current?.focus() }
  })

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="rounded-2xl bg-surface px-3.5 pt-3 pb-2 transition-colors focus-within:bg-elevated">
        <textarea
          ref={taRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={
            voice.recording ? 'Listening…'
            : voice.transcribing ? 'Transcribing…'
            : hasMessages ? 'Follow up' : 'Ask anything…'
          }
          className="block w-full resize-none bg-transparent text-[14px] leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none"
          aria-label="Message Copilot"
        />
        <div className="mt-2 flex items-center gap-1.5">
          {voice.recording ? (
            <>
              <button
                type="button"
                onClick={voice.cancel}
                aria-label="Cancel recording"
                title="Cancel recording (discard)"
                className="grid h-7 w-7 place-items-center rounded-full text-text-secondary hover:bg-elevated hover:text-text-primary"
              >
                <IconStop size={11} />
              </button>
              <ComposerWaveform levels={voice.levels} />
              <span className="ml-1 text-[11.5px] tabular-nums text-text-muted">{formatVoiceTime(voice.seconds)}</span>
              <button
                type="button"
                onClick={voice.stop}
                aria-label="Stop recording"
                title="Stop and transcribe"
                className="ml-1 grid h-8 w-8 place-items-center rounded-full bg-elevated text-text-secondary transition-colors hover:bg-elevated/70 hover:text-text-primary"
              >
                <IconStop size={11} />
              </button>
            </>
          ) : voice.transcribing ? (
            <>
              <span className="text-[11.5px] text-text-muted animate-pulse">Transcribing…</span>
              <div className="ml-auto" />
            </>
          ) : (
            <>
              {(onAttachFile || onAttachImage) && (
                <AttachMenu
                  onAttachFile={onAttachFile}
                  onAttachImage={onAttachImage}
                  onOpenTokens={() => setTokensOpen(true)}
                />
              )}
              <AttachedTokens active={attached} onOpen={() => setDetailOpen(true)} />
              <ModePicker value={mode} onChange={setMode} />
              <ModelDropdown
                value={model}
                pending={modelPending}
                onPick={onModelPick}
                onRestart={onModelRestart}
                pendingRestart={modelPendingRestart}
              />
              <ContextRing copilotSessionId={copilotSessionId} />
              <div className="ml-auto" />
              {isVoiceInputSupported() && (
                <button
                  type="button"
                  onClick={() => void voice.start()}
                  aria-label="Voice input"
                  title="Dictate via mic (transcribed locally with whisper.cpp)"
                  className="grid h-8 w-8 place-items-center rounded-full text-text-secondary hover:bg-elevated hover:text-text-primary"
                >
                  <IconMic size={13} />
                </button>
              )}
              {busy ? (
                <button
                  type="button"
                  onClick={() => onCancel?.()}
                  aria-label="Stop response"
                  title="Stop the current response"
                  className="grid h-8 w-8 place-items-center rounded-full bg-error/15 text-error transition-colors hover:bg-error hover:text-white"
                >
                  <IconStop size={11} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!canSend}
                  aria-label="Send message"
                  title={canSend ? 'Send (↵)' : 'Type a message to send'}
                  className="grid h-8 w-8 place-items-center rounded-full bg-elevated text-text-secondary transition-colors hover:bg-action hover:text-action-text disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-elevated disabled:hover:text-text-secondary"
                >
                  <IconArrowUp size={14} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-text-muted">AI-generated content may be incorrect</p>
      {tokensOpen && (
        <TokenLibraryModal
          chosen={tokens.chosen}
          onChoose={tokens.choose}
          onClose={() => setTokensOpen(false)}
          onCreate={() => {
            setTokensOpen(false)
            openLibrary(true)
          }}
        />
      )}
      {detailOpen && attached && (
        <TokenLibraryDetail
          library={attached}
          onClose={() => setDetailOpen(false)}
          onOpenFull={() => {
            setDetailOpen(false)
            openLibrary(false)
          }}
        />
      )}
    </div>
  )
}

/**
 * Which library this chat is following, and nothing when it follows none.
 *
 * There used to be a standing "Tokens" chip here whether or not one was
 * attached. It duplicated the entry point under "+" and read as a setting, so
 * what is left is only the statement: the library's own name, marked as a
 * token and underlined, because it opens what it names.
 */
function AttachedTokens({
  active,
  onOpen
}: {
  active: TokenLibrary | null
  onOpen: () => void
}): JSX.Element | null {
  if (!active) return null
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Every turn follows ${active.name}`}
      className="flex h-6 items-center gap-1.5 rounded-md px-1.5 text-[11.5px] text-text-secondary underline underline-offset-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <TokenGlyph className="shrink-0" />
      <span className="max-w-[10rem] truncate">{active.name}</span>
    </button>
  )
}

function ComposerWaveform({ levels }: { levels: number[] }): JSX.Element {
  return (
    <div className="ml-1 flex h-6 flex-1 items-center gap-[2px] overflow-hidden">
      {levels.map((v, i) => {
        const pct = Math.max(8, Math.round(v * 100))
        return (
          <span
            key={i}
            className="block w-[2px] rounded-full bg-text-secondary"
            style={{ height: `${pct}%`, opacity: i < levels.length - 6 ? 0.5 : 1 }}
          />
        )
      })}
    </div>
  )
}

function AttachMenu({
  onAttachFile,
  onAttachImage,
  onOpenTokens
}: {
  onAttachFile?: () => void
  onAttachImage?: () => void
  onOpenTokens: () => void
}) {
  const item =
    'cursor-pointer rounded-md px-2 py-1.5 outline-none data-[highlighted]:bg-surface data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40'
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          aria-label="Attach"
          title="Attach a file, an image or a token library"
          className="grid h-7 w-7 place-items-center rounded-md text-text-secondary outline-none hover:bg-elevated hover:text-text-primary focus:outline-none data-[state=open]:bg-elevated data-[state=open]:text-text-primary"
        >
          <IconPlus size={14} />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-[180px] rounded-lg bg-raised p-1 text-[12px] text-text-primary shadow-overlay"
        >
          <Dropdown.Item onSelect={() => onAttachFile?.()} disabled={!onAttachFile} className={item}>
            Upload files…
          </Dropdown.Item>
          <Dropdown.Item onSelect={() => onAttachImage?.()} disabled={!onAttachImage} className={item}>
            Upload images…
          </Dropdown.Item>
          {/* A library is attached to a turn the same way a file is, because
              that is what it is: something you bring along so the answer is
              built from it. It opens a modal rather than a submenu: a library
              is chosen by recognising its colours, a menu row is too small to
              show them, and a submenu that renders nothing when you have none
              cannot tell you how to make one. */}
          <Dropdown.Item onSelect={() => onOpenTokens()} className={item}>
            Design tokens…
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}

