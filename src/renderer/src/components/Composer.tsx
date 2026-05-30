import { useEffect, useRef, useState } from 'react'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { IconArrowUp, IconMic, IconPlus, IconStop } from './icons'
import { ModelDropdown } from './ModelDropdown'
import { ModePicker, getDefaultMode, persistMode, type AgentMode } from './ModePicker'
import { ContextRing } from './ContextRing'
import { useVoiceInput, formatVoiceTime, isVoiceInputSupported } from '../lib/voice'

// Legacy local 2-mode type kept as a no-op so old localStorage entries don't crash.
type Mode = AgentMode

export function Composer({
  sessionId,
  model,
  modelPending,
  onModelPick,
  onModelRestart,
  modelPendingRestart,
  busy = false,
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
  onSend: (text: string, mode: AgentMode) => void
  onCancel?: () => void
  onAttachFile?: () => void
  onAttachImage?: () => void
}) {
  const [body, setBody] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [savedDraft, setSavedDraft] = useState('')
  const [mode, setMode] = useState<Mode>(() => getDefaultMode())
  const [copilotSessionId, setCopilotSessionId] = useState<string | null>(null)

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

  const send = async () => {
    const trimmed = body.trim()
    if (!trimmed) return
    onSend(trimmed, mode)
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
          placeholder={voice.recording ? 'Listening…' : voice.transcribing ? 'Transcribing…' : 'Ask anything…'}
          className="block w-full resize-none bg-transparent text-[14px] leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none"
          style={{ caretColor: 'rgb(var(--accent))' }}
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
              {(onAttachFile || onAttachImage) && <AttachMenu onAttachFile={onAttachFile} onAttachImage={onAttachImage} />}
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
                  className="grid h-8 w-8 place-items-center rounded-full bg-elevated text-text-secondary transition-colors hover:bg-accent hover:text-accent-text disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-elevated disabled:hover:text-text-secondary"
                >
                  <IconArrowUp size={14} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
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
  onAttachImage
}: {
  onAttachFile?: () => void
  onAttachImage?: () => void
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          aria-label="Attach"
          title="Attach a file or image"
          className="grid h-7 w-7 place-items-center rounded-md text-text-secondary outline-none hover:bg-elevated hover:text-text-primary focus:outline-none data-[state=open]:bg-elevated data-[state=open]:text-text-primary"
        >
          <IconPlus size={14} />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-[180px] rounded-lg bg-elevated p-1 text-[12px] text-text-primary shadow-lg"
        >
          <Dropdown.Item
            onSelect={() => onAttachFile?.()}
            disabled={!onAttachFile}
            className="cursor-pointer rounded-md px-2 py-1.5 outline-none data-[highlighted]:bg-surface data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40"
          >
            Attach file…
          </Dropdown.Item>
          <Dropdown.Item
            onSelect={() => onAttachImage?.()}
            disabled={!onAttachImage}
            className="cursor-pointer rounded-md px-2 py-1.5 outline-none data-[highlighted]:bg-surface data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40"
          >
            Attach image…
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}

