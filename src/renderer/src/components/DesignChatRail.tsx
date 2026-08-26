import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import type { DesignMessage, DesignProgressStep, DesignToolCall } from '../../../preload/index'
import { IconArrowUp, IconCheck, IconChevronRight, IconClose, IconCopy, IconMic, IconPaperclip, IconPlus, IconStop, IconThumbDown, IconThumbUp, IconTrash } from './icons'
import { BoxesThinking } from './PencilThinking'
import { useVoiceInput, formatVoiceTime, isVoiceInputSupported } from '../lib/voice'
import { MODELS, ProviderLogo } from './ModelDropdown'
import { ModePicker, getDefaultMode, persistMode, type AgentMode } from './ModePicker'
import { ContextRing } from './ContextRing'
import { buildPlanStateForMessage, stripPlanFences, containsPlanFence, type PlanState } from '../lib/planParser'
import { PlanChecklist } from './PlanChecklist'

type ChatAttachment = { filename: string; label: string; kind: 'template' | 'reference' }

const ACCEPTED_ATTACHMENTS = '.png,.jpg,.jpeg,.gif,.webp,.svg,.avif,.pptx,.docx,.xlsx,.pdf,.html,.htm,.css,.json,.txt,.md,.scss'
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'])

export function DesignChatRail({ designId }: { designId: string }): JSX.Element {
  const [messages, setMessages] = useState<DesignMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<string>('Working…')
  const [progress, setProgress] = useState<DesignProgressStep[]>([])
  const [loaded, setLoaded] = useState(false)
  const [hasVersions, setHasVersions] = useState(false)
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [agentMode, setAgentMode] = useState<AgentMode>(() => getDefaultMode())
  // Queue of prompts the user typed while a previous run was still in flight.
  // Drained one-at-a-time when busy flips to false.
  type QueuedPrompt = { id: string; text: string; model: string | null; mode: AgentMode; displayText?: string | null }
  const [queue, setQueue] = useState<QueuedPrompt[]>([])
  const queueRef = useRef<QueuedPrompt[]>([])
  useEffect(() => { queueRef.current = queue }, [queue])
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputAcceptRef = useRef<string>('*/*')
  const fileInputNoteRef = useRef<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)

  const [copilotSessionId, setCopilotSessionId] = useState<string | null>(null)

  // Load history + busy state on mount/design change
  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    setMessages([])
    setBody('')
    setPhase('Working…')
    setProgress([])
    setAttachments([])
    setDragOver(false)
    setQueue([])
    setCopilotSessionId(null)
    void window.terminal42.designs.history(designId).then((rows) => {
      if (cancelled) return
      setMessages(rows)
      setLoaded(true)
    })
    void window.terminal42.designs.isBusy(designId).then((b) => { if (!cancelled) setBusy(b) })
    void window.terminal42.designs.listVersions(designId).then((vs) => { if (!cancelled) setHasVersions(vs.length > 0) })
    void window.terminal42.designs.get(designId).then((d) => {
      if (cancelled || !d) return
      setCopilotSessionId(d.copilotSessionId ?? null)
      // Don't pre-populate attachments from the saved brief: those are
      // already used by the model on every send. Showing them as chips
      // every time you open the design felt like leftovers. Chips are
      // for things you just attached in THIS session.
    })
    void window.terminal42.settings.get().then((s) => { if (!cancelled) setSelectedModel(s.defaultModel) })
    return () => { cancelled = true }
  }, [designId])

  const pickModel = (id: string): void => {
    setSelectedModel(id)
    void window.terminal42.settings.set('defaultModel', id).catch(() => {})
  }

  // Open the hidden file input with the right filter for the requested kind.
  // The actual upload happens in onFileChosen below when the user picks.
  const openFilePicker = (kind: 'tokens' | 'screenshot' | 'codebase'): void => {
    fileInputAcceptRef.current = kind === 'screenshot'
      ? '.png,.jpg,.jpeg,.gif,.webp,.svg,.avif'
      : ACCEPTED_ATTACHMENTS
    fileInputNoteRef.current = kind
    if (fileInputRef.current) {
      fileInputRef.current.value = ''   // allow re-pick of same file
      fileInputRef.current.accept = fileInputAcceptRef.current
      fileInputRef.current.click()
    }
  }

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const kind = fileInputNoteRef.current as 'tokens' | 'screenshot' | 'codebase'
    await addFiles(files, kind)
  }

  const addFiles = async (files: File[], kind: 'tokens' | 'screenshot' | 'codebase' | 'drop'): Promise<void> => {
    const accepted = files.filter(isAcceptedFile)
    if (!accepted.length) {
      appendLocalSystemMessage('No supported files found. Try images, PDF, PowerPoint, Word, Excel, HTML, CSS, JSON, Markdown, or text.')
      return
    }
    try {
      const added: ChatAttachment[] = []
      for (const file of accepted) {
        const buf = await file.arrayBuffer()
        const image = IMAGE_EXTS.has(extFor(file.name))
        const res = image
          ? await window.terminal42.designs.uploadInspiration(designId, file.name, buf)
          : await window.terminal42.designs.uploadTemplate(designId, file.name, buf)
        if (!('ok' in res) || !res.ok) {
          appendLocalSystemMessage(`Couldn't attach ${file.name}: ${('error' in res && res.error) || 'unknown error'}`)
          continue
        }
        added.push({ filename: res.filename, label: file.name, kind: image ? 'reference' : 'template' })
      }
      if (!added.length) return
      setAttachments((cur) => dedupeAttachments([...cur.filter((a) => !added.some((n) => n.kind === 'template' && a.kind === 'template')), ...added]))
      const noun =
        kind === 'screenshot' ? 'reference image'
        : kind === 'tokens' ? 'design system / template'
        : accepted.length === 1 ? 'reference file' : 'reference files'
      appendLocalSystemMessage(`Attached ${added.length} ${noun}. The next message will use ${added.length === 1 ? 'it' : 'them'} as context.`)
      // Pre-fill the textarea with a hint nudging the user to describe what to do.
      setBody((cur) => cur || (
        kind === 'screenshot'
          ? 'Use the attached screenshot as the layout reference. Match its structure, hierarchy and proportions.'
          : kind === 'tokens'
            ? 'Use the attached file as the source of truth for the look. Keep its colours, fonts, layout, and overall structure. Only update the content per my next instruction.'
            : 'Use the attached file as the starting context. Read it, then ask what I want to change.'
      ))
      taRef.current?.focus()
    } catch (err) {
      appendLocalSystemMessage(`Couldn't read file: ${String(err)}`)
    }
  }

  const removeAttachment = async (filename: string): Promise<void> => {
    const res = await window.terminal42.designs.removeAttachment(designId, filename)
    if (!res.ok) {
      appendLocalSystemMessage(`Couldn't remove ${filename}: ${res.error}`)
      return
    }
    setAttachments((cur) => cur.filter((a) => a.filename !== filename))
  }

  const appendLocalSystemMessage = (text: string): void => {
    const m: DesignMessage = {
      id: `local-${Date.now()}`,
      designId,
      role: 'system',
      content: text,
      toolCalls: [],
      status: 'done',
      createdAt: Date.now()
    }
    setMessages((prev) => [...prev, m])
  }

  // Subscribe to streaming events
  useEffect(() => {
    const offMessage = window.terminal42.designs.onMessage((m) => {
      if (m.designId !== designId) return
      setMessages((prev) => {
        const idx = prev.findIndex((p) => p.id === m.id)
        if (idx === -1) return [...prev, m]
        const next = prev.slice()
        next[idx] = m
        return next
      })
    })
    const offDelta = window.terminal42.designs.onDelta((d) => {
      if (d.designId !== designId) return
      setMessages((prev) => {
        const idx = prev.findIndex((p) => p.id === d.messageId)
        if (idx === -1) return prev
        const next = prev.slice()
        next[idx] = { ...next[idx], content: next[idx].content + d.delta }
        return next
      })
    })
    const offTool = window.terminal42.designs.onTool((d) => {
      if (d.designId !== designId) return
      setMessages((prev) => {
        // Attach tool to most recent assistant message
        let idx = -1
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].role === 'assistant') { idx = i; break }
        }
        if (idx === -1) return prev
        const next = prev.slice()
        const m = next[idx]
        const tcs = m.toolCalls.slice()
        const existing = tcs.findIndex((t) => t.id === d.tool.id)
        if (existing === -1) tcs.push(d.tool); else tcs[existing] = d.tool
        next[idx] = { ...m, toolCalls: tcs }
        return next
      })
    })
    const offStart = window.terminal42.designs.onStart((d) => { if (d.designId === designId) { setBusy(true); setPhase('Starting…'); setProgress([]) } })
    const offDone = window.terminal42.designs.onDone((d) => { if (d.designId === designId) setBusy(false) })
    const offPhase = window.terminal42.designs.onPhase((d) => { if (d.designId === designId) setPhase(d.phase) })
    const offProgress = window.terminal42.designs.onProgress((d) => { if (d.designId === designId) setProgress(d.steps) })
    return () => { offMessage(); offDelta(); offTool(); offStart(); offDone(); offPhase(); offProgress() }
  }, [designId])

  // Sticky scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = (): void => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight
      stickRef.current = dist < 80
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!stickRef.current) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy])

  // Auto-grow textarea
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [body])

  // Core send used by the composer, the queue drainer, and the external
  // `t42:design-prompt` event (annotations / direct-edit sync). All paths
  // share the same hardening:
  //   - busy → queue (prompt is preserved verbatim)
  //   - accepted:false + "in progress" → queue (race between early
  //     design:done and the backend's running.delete; transient)
  //   - accepted:false (other reason) → restore composer text if any,
  //     emit a system message containing the full prompt so external
  //     callers (annotation/edit) don't silently lose work
  //   - thrown → same as accepted:false (other reason)
  const sendText = async (
    rawText: string,
    opts: { model?: string | null; mode?: AgentMode; source?: 'composer' | 'annotation' | 'edit' | 'event'; onRestore?: (text: string) => void; displayText?: string | null } = {}
  ): Promise<void> => {
    const trimmed = rawText.trim()
    if (!trimmed) return
    const model = opts.model !== undefined ? opts.model : selectedModel
    const mode = opts.mode ?? agentMode
    const source = opts.source ?? 'composer'
    const displayText = opts.displayText && opts.displayText.trim() ? opts.displayText.trim() : null
    const sourceLabel =
      source === 'annotation' ? 'annotation comment'
      : source === 'edit' ? 'canvas edit'
      : 'message'
    const queueItem: QueuedPrompt = { id: `q-${Date.now()}`, text: trimmed, model, mode, displayText }
    if (busy) {
      setQueue((q) => [...q, queueItem])
      const previewText = displayText ?? trimmed
      appendLocalSystemMessage(`Queued ${sourceLabel}: "${previewText.slice(0, 80)}${previewText.length > 80 ? '…' : ''}". It'll run after the current response finishes.`)
      return
    }
    try {
      const res = await window.terminal42.designs.send(designId, trimmed, model, mode, displayText)
      if (res && !res.ok) {
        if (res.accepted === false && /in progress/i.test(res.error ?? '')) {
          setQueue((q) => [...q, queueItem])
          return
        }
        if (res.accepted === false && opts.onRestore) opts.onRestore(trimmed)
        appendLocalSystemMessage(
          `Couldn't send ${sourceLabel}: ${res.error ?? 'unknown error'}\n\n> ${truncateForMessage(displayText ?? trimmed)}`
        )
      }
    } catch (err) {
      if (opts.onRestore) opts.onRestore(trimmed)
      appendLocalSystemMessage(
        `Couldn't send ${sourceLabel}: ${String(err)}\n\n> ${truncateForMessage(displayText ?? trimmed)}`
      )
    }
  }

  const send = async (): Promise<void> => {
    const trimmed = body.trim()
    if (!trimmed) return
    // Clear the textarea optimistically; sendText will restore on
    // persist-reject only if the user hasn't typed something new.
    setBody('')
    await sendText(trimmed, {
      source: 'composer',
      onRestore: (txt) => setBody((cur) => cur || txt)
    })
  }

  const cancel = async (): Promise<void> => {
    // Stop the running design + clear any queued prompts so the user isn't
    // surprised by a queued message firing right after they hit Stop.
    const hadQueue = queueRef.current.length
    setQueue([])
    await window.terminal42.designs.cancel(designId)
    if (hadQueue) appendLocalSystemMessage(`Stopped. Cleared ${hadQueue} queued prompt${hadQueue === 1 ? '' : 's'}.`)
  }

  // External prompt channel. DesignCanvas (annotations, direct-edit sync)
  // dispatches a `t42:design-prompt` CustomEvent instead of calling
  // `designs.send` itself, so external prompts share the rail's queue,
  // error surfacing, and per-message plan rendering. Detail shape:
  //   { designId, text, source?: 'annotation'|'edit'|'event' }
  useEffect(() => {
    const handler = (ev: Event): void => {
      const ce = ev as CustomEvent<{ designId: string; text: string; displayText?: string | null; source?: 'annotation' | 'edit' | 'event'; mode?: AgentMode }>
      const detail = ce.detail
      if (!detail || detail.designId !== designId) return
      if (typeof detail.text !== 'string' || !detail.text.trim()) return
      void sendText(detail.text, {
        source: detail.source ?? 'event',
        displayText: detail.displayText ?? null,
        mode: detail.mode ?? undefined
      })
    }
    window.addEventListener('t42:design-prompt', handler as EventListener)
    return () => window.removeEventListener('t42:design-prompt', handler as EventListener)
    // sendText closes over current `busy` / `selectedModel` / `agentMode`
    // via state references, so we deliberately re-subscribe whenever those
    // change to keep the queue-vs-send decision fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designId, busy, selectedModel, agentMode])

  // External system-message channel. Sibling components (canvas export
  // menu, Figma dialog, etc.) dispatch `t42:design-system-message` to
  // surface a non-prompt status line in the chat — "Exported as PDF to
  // ~/Desktop/x.pdf", "Couldn't export: …", "Sent to Figma — see chat
  // for the URL when it's ready". This replaces silent successes /
  // hidden errors. Detail shape: { designId, text }.
  useEffect(() => {
    const handler = (ev: Event): void => {
      const ce = ev as CustomEvent<{ designId: string; text: string }>
      const detail = ce.detail
      if (!detail || detail.designId !== designId) return
      if (typeof detail.text !== 'string' || !detail.text.trim()) return
      appendLocalSystemMessage(detail.text.trim())
    }
    window.addEventListener('t42:design-system-message', handler as EventListener)
    return () => window.removeEventListener('t42:design-system-message', handler as EventListener)
  }, [designId])

  // Drain queue when current run finishes.
  //
  // Race guard: the backend emits `design:done` from two places — the
  // `result` event (BEFORE `running.delete()`) and `finalizeRun` (AFTER).
  // If we drain on the early `done`, the next send() can hit a still-set
  // running flag and be rejected with "Another response is in progress".
  // When that happens we put the prompt BACK at the head of the queue
  // and try again on the next done tick. Same for any thrown error.
  useEffect(() => {
    if (busy) return
    const next = queueRef.current[0]
    if (!next) return
    setQueue((q) => q.slice(1))
    void (async () => {
      const requeue = (): void => setQueue((q) => [next, ...q])
      try {
        const res = await window.terminal42.designs.send(designId, next.text, next.model, next.mode, next.displayText ?? null)
        if (res && !res.ok) {
          if (res.accepted === false && /in progress/i.test(res.error ?? '')) {
            // Backend wasn't fully idle yet; re-queue silently so we
            // retry on the next idle tick instead of dropping the user's
            // prompt.
            requeue()
            return
          }
          appendLocalSystemMessage(
            `Queued prompt failed: ${res.error ?? 'unknown error'}\n\n> ${truncateForMessage(next.displayText ?? next.text)}`
          )
        }
      } catch (err) {
        appendLocalSystemMessage(
          `Queued prompt failed: ${String(err)}\n\n> ${truncateForMessage(next.displayText ?? next.text)}`
        )
      }
    })()
  }, [busy, designId])

  const removeQueued = (id: string): void => {
    setQueue((q) => q.filter((x) => x.id !== id))
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault()
      void send()
    }
  }

  // Voice input: local whisper.cpp transcription. Setting body via
  // onTranscript means the user sees the transcript appear in the
  // textarea after Stop (transcribing takes ~1-2s for short clips).
  const voice = useVoiceInput({
    onTranscript: (text) => { if (text) setBody(text); taRef.current?.focus() },
    onError: (err) => appendLocalSystemMessage(err)
  })

  const isEmpty = loaded && messages.length === 0 && !hasVersions

  // Track rail width so the composer can collapse labels when narrow.
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [railWidth, setRailWidth] = useState(0)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      setRailWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const compact = railWidth > 0 && railWidth < 460

  // Plan checklists are scoped per "run" — the slice of assistant
  // messages produced by a single user prompt. The Copilot CLI can
  // emit MULTIPLE assistant messages within one run (one per
  // assistant.message_start, often interleaved with tool calls), so
  // per-message scoping would drop later plan-update fences. Per-run
  // scoping aggregates all assistant content for the run, then attaches
  // the resulting checklist to the FIRST assistant message of that run.
  //
  // Returns a Map<assistantMessageId, { plan, active, showPlan }>:
  //   - plan      : aggregated PlanState (or null when the run never emitted one)
  //   - active    : true while any assistant message in the run is streaming
  //   - showPlan  : true when the checklist should be visible inline
  //                 (active OR the plan has real progress)
  // Only the first assistant message of each run is keyed; later
  // assistant messages in the same run get nothing (so we render one
  // checklist per run, not per assistant message).
  const planByMessageId = useMemo(() => {
    type RunEntry = { plan: ReturnType<typeof buildPlanStateForMessage>; active: boolean; showPlan: boolean }
    const out = new Map<string, RunEntry>()
    let runFirstAssistantId: string | null = null
    let runContents: string[] = []
    let runActive = false
    const flush = (): void => {
      if (!runFirstAssistantId) return
      const plan = buildPlanStateForMessage(runContents.join('\n\n'))
      const showPlan = !!plan && (runActive || plan.hasProgress)
      out.set(runFirstAssistantId, { plan, active: runActive, showPlan })
      runFirstAssistantId = null
      runContents = []
      runActive = false
    }
    for (const m of messages) {
      if (m.role === 'user') {
        flush()
        continue
      }
      if (m.role !== 'assistant') continue
      if (!runFirstAssistantId) runFirstAssistantId = m.id
      runContents.push(m.content || '')
      if (m.status === 'streaming') runActive = true
    }
    flush()
    return out
  }, [messages])

  // True when any run's plan is currently visible AND active. Used to
  // suppress the generic ProgressList fallback (avoids double progress UI).
  const anyActivePlan = useMemo(() => {
    if (!busy) return false
    for (const entry of planByMessageId.values()) {
      if (entry.active && entry.showPlan) return true
    }
    return false
  }, [planByMessageId, busy])

  return (
    <div
      ref={rootRef}
      className={['relative flex h-full w-full flex-col bg-surface', dragOver ? 'ring-1 ring-accent/40' : ''].join(' ')}
      onDragEnter={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false) }}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        void addFiles(Array.from(e.dataTransfer.files), 'drop')
      }}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-2xl bg-bg/75 text-[13px] font-medium text-text-primary backdrop-blur-sm">
          Drop files to attach
        </div>
      )}
      {/* Scrollable message log */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-5">
        <div className="flex flex-col gap-6">
          {!loaded && <div className="py-12 text-center text-text-muted">Loading…</div>}
          {isEmpty && <DesignEmpty
            onPick={(prompt) => { setBody(prompt); taRef.current?.focus() }}
            onAttach={(kind) => openFilePicker(kind)}
          />}
          {messages.map((m) => (
            <Message
              key={m.id}
              message={m}
              runPlanEntry={m.role === 'assistant' ? planByMessageId.get(m.id) : undefined}
            />
          ))}
          {busy && !anyActivePlan && (() => {
            // Only show the full progress box when there are tool-call steps
            // (file writes, edits, etc.). For simple replies show a minimal spinner.
            const hasToolCalls = progress.some((s) => s.id.startsWith('tool:'))
            return hasToolCalls
              ? <ProgressList steps={progress} fallbackLabel={phase} />
              : <div className="flex items-center gap-2 px-1 text-[12px] text-text-muted">
                  <BoxesThinking />
                  <span>Thinking…</span>
                </div>
          })()}
        </div>
      </div>

      {/* Queue strip (pending prompts shown above composer when busy) */}
      {queue.length > 0 && (
        <div className="shrink-0 bg-surface/40 px-3 py-2">
          <div className="mb-1 flex items-baseline gap-2 text-[10.5px] text-text-muted">
            <span>Queued</span>
            <span className="text-text-secondary">{queue.length}</span>
          </div>
          <ul className="flex flex-col gap-1">
            {queue.map((q, i) => (
              <li key={q.id} className="group flex items-baseline gap-2 rounded-md bg-elevated/30 px-2 py-1.5 text-[12px] text-text-secondary">
                <span className="w-4 shrink-0 text-right text-[10.5px] tabular-nums text-text-muted">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate">{q.text}</span>
                <button
                  type="button"
                  onClick={() => removeQueued(q.id)}
                  aria-label="Remove queued prompt"
                  title="Remove from queue"
                  className="shrink-0 text-text-muted opacity-0 transition group-hover:opacity-100 hover:text-error"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Composer */}
      <div className="shrink-0 bg-surface px-3 pt-2 pb-3">
        <div className="rounded-2xl bg-elevated/50 px-3 pt-3 pb-2 transition-colors focus-within:bg-elevated">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((a) => (
                <AttachmentChip key={`${a.kind}:${a.filename}`} attachment={a} onRemove={() => void removeAttachment(a.filename)} />
              ))}
            </div>
          )}
          <textarea
            ref={taRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={voice.recording ? 'Listening…' : 'Describe what you want to create…'}
            className="block w-full resize-none bg-transparent text-[14px] leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none"
            style={{ caretColor: 'rgb(var(--accent))' }}
            aria-label="Describe what you want to create"
          />
          <div className="mt-2 flex items-center gap-1">
            {voice.recording ? (
              <>
                <button
                  type="button"
                  onClick={voice.cancel}
                  aria-label="Cancel recording"
                  title="Cancel recording (discard)"
                  className="grid h-7 w-7 place-items-center rounded-full text-text-secondary hover:bg-elevated hover:text-text-primary"
                >
                  <IconClose size={11} />
                </button>
                <Waveform levels={voice.levels} />
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
                <button
                  type="button"
                  onClick={() => openFilePicker('tokens')}
                  title="Attach a template (.pptx, .docx, .pdf, image, etc.): copies into the design and grounds the next prompt"
                  className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary"
                  aria-label="Attach"
                >
                  <IconPlus size={12} />
                  {!busy && !compact && <span>Attach</span>}
                </button>
                <ModelSelect value={selectedModel} onChange={pickModel} disabled={busy} />
                <ModePicker value={agentMode} onChange={(m) => { setAgentMode(m); persistMode(m) }} disabled={busy} />
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
                {busy && (
                  <button
                    type="button"
                    onClick={() => void cancel()}
                    aria-label="Stop"
                    title="Stop the current response"
                    className="grid h-8 w-8 place-items-center rounded-full bg-error/15 text-error transition-colors hover:bg-error hover:text-white"
                  >
                    <IconStop size={11} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!body.trim()}
                  aria-label={busy ? 'Add to queue' : 'Send'}
                  title={busy ? 'Add to queue (↵)' : 'Send (↵)'}
                  className="grid h-8 w-8 place-items-center rounded-full bg-action text-action-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <IconArrowUp size={14} />
                </button>
              </>
            )}
          </div>
        </div>
        {/* Hidden file input: used by Attach button + empty-state pills */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={fileInputAcceptRef.current}
          multiple
          onChange={(e) => void onFileChosen(e)}
        />
      </div>
    </div>
  )
}

function AttachmentChip({ attachment, onRemove }: { attachment: ChatAttachment; onRemove: () => void }): JSX.Element {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-surface px-2 py-1 text-[11px] text-text-secondary"
      title={`${attachment.kind === 'template' ? 'Template' : 'Reference'}: ${attachment.filename}`}
    >
      <IconPaperclip size={10} />
      <span className="max-w-[120px] truncate">{attachment.label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${attachment.label}`}
        className="grid h-4 w-4 place-items-center rounded-full text-text-muted hover:bg-elevated hover:text-error"
      >
        <IconTrash size={9} />
      </button>
    </span>
  )
}

function ModelSelect({ value, onChange, disabled }: { value: string | null; onChange: (id: string) => void; disabled: boolean }): JSX.Element {
  const current = MODELS.find((m) => m.id === value)
  const groups = Array.from(new Set(MODELS.map((m) => m.group)))
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          aria-label="Design model"
          title={`Design model: ${current?.label ?? 'choose'}`}
          className="ml-1 inline-flex h-7 max-w-[140px] items-center gap-1 rounded-md px-2 text-[12px] text-text-secondary outline-none hover:bg-elevated hover:text-text-primary focus-visible:outline-none data-[state=open]:bg-elevated data-[state=open]:text-text-primary disabled:opacity-50"
          disabled={disabled}
        >
          <span className="truncate">{shortModelLabel(current?.label) ?? 'Model'}</span>
          <IconChevronRight size={9} className="shrink-0 rotate-90 text-text-muted" />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="start"
          side="top"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 max-h-[320px] min-w-[240px] overflow-y-auto rounded-lg bg-raised p-1 text-[12px] text-text-primary shadow-overlay"
        >
          <div className="px-2 pt-2 pb-1.5 text-[11px] text-text-muted">
            Used for the next design run.
          </div>
          {groups.map((g) => (
            <div key={g}>
              <div className="flex items-center gap-1.5 px-2 pt-1.5 pb-1 text-[11px] text-text-muted">
                <ProviderLogo provider={g} />
                <span>{g}</span>
              </div>
              {MODELS.filter((m) => m.group === g).map((m) => (
                <Dropdown.Item
                  key={m.id}
                  onSelect={() => onChange(m.id)}
                  className={[
                    'flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 outline-none',
                    m.id === value ? 'bg-surface font-medium text-text-primary' : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                  ].join(' ')}
                >
                  <span>{m.label}</span>
                  {m.id === value && <span className="text-text-muted">·</span>}
                </Dropdown.Item>
              ))}
            </div>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}

function shortModelLabel(label: string | undefined): string | undefined {
  return label?.replace(/^Claude\s+/i, '')
}

function extFor(name: string): string {
  return (name.split('.').pop() ?? '').toLowerCase()
}

function isAcceptedFile(file: File): boolean {
  return ACCEPTED_ATTACHMENTS.split(',').some((part) => {
    const ext = part.replace('.', '').trim().toLowerCase()
    return ext && extFor(file.name) === ext
  })
}

function dedupeAttachments(items: ChatAttachment[]): ChatAttachment[] {
  const seen = new Set<string>()
  const out: ChatAttachment[] = []
  for (const item of items) {
    const key = `${item.kind}:${item.filename}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

// Used inside failure system messages to echo the user's prompt back so
// nothing is silently lost — especially important for annotation / canvas
// edits where the source UI has already cleared its local state.
function truncateForMessage(text: string, max = 400): string {
  const oneLine = text.replace(/\n+/g, ' ⏎ ')
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine
}

// ─── Message rendering ────────────────────────────────────────────────────

// The optional `runPlanEntry` is populated by the parent on the FIRST
// assistant message of a run that emitted a plan. It carries the
// aggregated PlanState for the entire run plus a precomputed visibility
// decision (`showPlan`) so PlanChecklist itself never has to early-return
// before its hooks (avoids React hook-order violations).
type RunPlanEntry = {
  plan: PlanState | null
  active: boolean
  showPlan: boolean
}

function Message({ message, runPlanEntry }: { message: DesignMessage; runPlanEntry?: RunPlanEntry }): JSX.Element {
  if (message.role === 'user') return <UserMessage message={message} />
  if (message.role === 'system') return <SystemMessage message={message} />
  return <AssistantMessage message={message} runPlanEntry={runPlanEntry} />
}

function UserMessage({ message }: { message: DesignMessage }): JSX.Element {
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
      <div className="max-w-[88%] select-text rounded-2xl rounded-br-md bg-elevated/40 px-3.5 py-2 text-[13.5px] leading-relaxed text-text-primary">
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
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

function SystemMessage({ message }: { message: DesignMessage }): JSX.Element {
  return (
    <div className="flex select-text items-start gap-2 text-[11.5px] leading-relaxed text-text-muted">
      <span className="mt-2 flex-shrink-0 grow-0 basis-3" />
      <span className="flex-1">{message.content}</span>
    </div>
  )
}

function AssistantMessage({ message, runPlanEntry }: { message: DesignMessage; runPlanEntry?: RunPlanEntry }): JSX.Element {
  const grouped = useMemo(() => groupTools(message.toolCalls), [message.toolCalls])
  const writtenFiles = useMemo(() => extractWrittenFiles(message.toolCalls), [message.toolCalls])
  // Hide plan / plan-update JSON fences from the displayed prose — the
  // PlanChecklist surfaces them as a checklist instead. If the message
  // contains ONLY control fences, treat it as empty so we don't render
  // a stray "…" placeholder.
  const cleanContent = useMemo(() => stripPlanFences(message.content || ''), [message.content])
  const wasOnlyPlan = !cleanContent && !!message.content && containsPlanFence(message.content)
  const empty = !cleanContent && message.status === 'streaming' && !wasOnlyPlan
  const hasMeta = grouped.length > 0 || writtenFiles.length > 0
  const elapsed = useElapsedFor(message)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Per-run plan provided by the parent. Only the first assistant message
  // of a run carries a runPlanEntry; later messages in the same run have
  // `undefined` so we don't render duplicate checklists. Parent has
  // already computed visibility (`showPlan`).
  const showPlan = !!runPlanEntry && runPlanEntry.showPlan && !!runPlanEntry.plan
  const planNode = showPlan && runPlanEntry?.plan
    ? <PlanChecklist plan={runPlanEntry.plan} active={runPlanEntry.active} />
    : null

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(cleanContent || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  // If the assistant turn ONLY emitted a plan fence (no prose, no tools)
  // and the plan checklist itself isn't being shown, don't render an
  // empty bubble.
  if (!cleanContent && wasOnlyPlan && !hasMeta && !showPlan) {
    return <></>
  }

  return (
    <div className="group/msg flex select-text flex-col gap-1.5">
      {planNode}
      {hasMeta && (
        <ThinkingDisclosure
          open={open}
          onToggle={() => setOpen((v) => !v)}
          elapsed={elapsed}
          status={message.status}
          tools={grouped}
          files={writtenFiles}
        />
      )}
      <div className="text-[13.5px] leading-[1.65] text-text-primary [&_p+p]:mt-2.5 [&_p+ul]:mt-2 [&_ul+p]:mt-2.5">
          {empty ? <span className="text-text-muted">…</span> : cleanContent ? <Markdown content={cleanContent} /> : null}
      </div>
      {message.status !== 'streaming' && cleanContent && (
        <div className="mt-0.5 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/msg:opacity-100 focus-within:opacity-100">
          <ActionIcon onClick={() => void copy()} title={copied ? 'Copied' : 'Copy text'} active={copied}>
            {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
          </ActionIcon>
          <ActionIcon title="Good response">
            <IconThumbUp size={12} />
          </ActionIcon>
          <ActionIcon title="Bad response">
            <IconThumbDown size={12} />
          </ActionIcon>
        </div>
      )}
    </div>
  )
}

function ActionIcon({
  children, title, onClick, active
}: {
  children: React.ReactNode
  title: string
  onClick?: () => void
  active?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={[
        'grid h-6 w-6 place-items-center rounded transition-colors',
        active ? 'text-text-primary' : 'text-text-muted hover:bg-elevated hover:text-text-primary'
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function ThinkingDisclosure({
  open, onToggle, elapsed, status, tools, files
}: {
  open: boolean
  onToggle: () => void
  elapsed: { ms: number; final: boolean }
  status: DesignMessage['status']
  tools: ToolGroup[]
  files: string[]
}): JSX.Element {
  const isStreaming = status === 'streaming'
  const label = isStreaming
    ? `Working… ${formatElapsedShort(elapsed.ms)}`
    : `Worked for ${formatElapsedShort(elapsed.ms)}`
  return (
    <div className="select-none">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        title={open ? 'Hide activity' : 'Show activity'}
        className="inline-flex items-center gap-1 text-[12px] text-text-muted hover:text-text-secondary"
      >
        <IconChevronRight size={9} className={['shrink-0 transition-transform', open ? 'rotate-90' : ''].join(' ')} />
        <span>{label}</span>
      </button>
      {open && (tools.length > 0 || files.length > 0) && (
        <div className="mt-2 ml-3 pl-3 text-[12.5px] leading-relaxed text-text-secondary">
          <p className="select-text">{summarizeTools(tools, files)}</p>
        </div>
      )}
    </div>
  )
}

// Render tool activity as a single-line prose sentence rather than a pill row.
// Maps common tool names to verbs, groups by verb, sorts by frequency.
function summarizeTools(tools: ToolGroup[], files: string[]): string {
  const verbCounts = new Map<string, number>()
  const bump = (verb: string, n: number): void => {
    verbCounts.set(verb, (verbCounts.get(verb) ?? 0) + n)
  }
  for (const t of tools) {
    const n = t.name.toLowerCase()
    if (n === 'view' || n === 'read' || n === 'read_file' || n.includes('view')) bump(`read ${t.count} file${t.count === 1 ? '' : 's'}`, 1)
    else if (n === 'edit' || n === 'edit_file' || n.startsWith('apply_patch')) bump(`made ${t.count} edit${t.count === 1 ? '' : 's'}`, 1)
    else if (n === 'create' || n === 'write' || n === 'write_file') bump(`created ${t.count} file${t.count === 1 ? '' : 's'}`, 1)
    else if (n === 'bash' || n === 'shell' || n.includes('exec')) bump(`ran ${t.count} command${t.count === 1 ? '' : 's'}`, 1)
    else if (n.includes('grep') || n.includes('search') || n.includes('rg')) bump(`searched ${t.count} time${t.count === 1 ? '' : 's'}`, 1)
    else if (n.includes('glob') || n.includes('list')) bump(`listed files`, 1)
    else if (n.startsWith('figma-use_figma') || n === 'figma-use_figma') bump(`updated Figma ${t.count} time${t.count === 1 ? '' : 's'}`, 1)
    else if (n.startsWith('figma-get_screenshot')) bump(`took ${t.count} screenshot${t.count === 1 ? '' : 's'}`, 1)
    else if (n.startsWith('figma-create_new_file')) bump('created a Figma file', 1)
    else if (n.startsWith('figma-search_design_system')) bump('searched the design system', 1)
    else if (n.startsWith('figma-')) bump(`ran ${t.count} Figma call${t.count === 1 ? '' : 's'}`, 1)
    else if (n.startsWith('mcp:') || n.startsWith('mcp__')) bump(`called ${t.count} MCP tool${t.count === 1 ? '' : 's'}`, 1)
    else bump(`called ${t.name} ${t.count > 1 ? `×${t.count}` : ''}`.trim(), 1)
  }
  const parts = Array.from(verbCounts.keys())
  if (files.length > 0 && !parts.some((p) => p.startsWith('created') || p.startsWith('made'))) {
    parts.push(`touched ${files.length} file${files.length === 1 ? '' : 's'}`)
  }
  if (parts.length === 0) return 'No tool activity recorded.'
  if (parts.length === 1) return capitalize(parts[0]) + '.'
  const last = parts.pop()!
  return capitalize(parts.join(', ') + `, and ${last}.`)
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

// Live elapsed time per assistant message: counts up while streaming,
// freezes the moment status flips to done/error/cancelled. Avoids relying
// on message.createdAt because the runner overwrites it on final commit.
function useElapsedFor(message: DesignMessage): { ms: number; final: boolean } {
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

function formatElapsedShort(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

// Group tool calls by name so we get "Read ×3" instead of three separate pills.
type ToolGroup = { name: string; status: 'running' | 'done' | 'error'; count: number }
function groupTools(calls: DesignToolCall[]): ToolGroup[] {
  const order: string[] = []
  const map = new Map<string, ToolGroup>()
  for (const c of calls) {
    const key = c.name
    if (!map.has(key)) {
      order.push(key)
      map.set(key, { name: key, status: c.status, count: 1 })
    } else {
      const g = map.get(key)!
      g.count += 1
      // Status priority: error > running > done
      if (c.status === 'error') g.status = 'error'
      else if (c.status === 'running' && g.status !== 'error') g.status = 'running'
    }
  }
  return order.map((k) => map.get(k)!)
}

// Pull file paths out of write_file / edit / create-style tool calls.
function extractWrittenFiles(calls: DesignToolCall[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const c of calls) {
    const n = c.name.toLowerCase()
    if (!n.includes('write') && !n.includes('edit') && !n.includes('create')) continue
    if (!c.input) continue
    let parsed: Record<string, unknown> | null = null
    try { parsed = JSON.parse(c.input) } catch {}
    if (!parsed) continue
    const candidate = (parsed.path ?? parsed.file ?? parsed.filePath ?? parsed.targetPath) as string | undefined
    if (typeof candidate === 'string' && candidate.trim() && !seen.has(candidate)) {
      seen.add(candidate)
      out.push(candidate)
    }
  }
  return out
}


function ProgressList({ steps, fallbackLabel }: { steps: DesignProgressStep[]; fallbackLabel: string }): JSX.Element {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])
  if (!steps.length) {
    return (
      <div className="flex items-center gap-2 px-1 text-[12px] text-text-muted">
        <BoxesThinking />
        <span>{fallbackLabel}</span>
        {seconds >= 5 && <span className="opacity-60">· {seconds}s</span>}
      </div>
    )
  }
  // Collapse mcp:* steps that have all completed into a single line
  const mcps = steps.filter((s) => s.id.startsWith('mcp:'))
  const otherSteps = steps.filter((s) => !s.id.startsWith('mcp:'))
  const mcpAllDone = mcps.length > 0 && mcps.every((s) => s.status === 'done')
  const mcpRow: DesignProgressStep | null = mcps.length === 0 ? null : mcpAllDone
    ? { id: 'mcp', label: `Connected ${mcps.length} server${mcps.length === 1 ? '' : 's'}`, status: 'done', startedAt: mcps[0].startedAt }
    : { id: 'mcp', label: 'Connecting servers', status: 'running', startedAt: mcps[0].startedAt }
  const all: DesignProgressStep[] = mcpRow ? [mcpRow, ...otherSteps] : otherSteps
  const current = [...all].reverse().find((s) => s.status === 'running') ?? all[all.length - 1] ?? null

  // Truncate to MAX visible. Keep the most recent ones: older done items
  // drop off the top so the list never grows past the box. The currently-
  // running step is always pinned at the bottom.
  const MAX = 3
  const dropped = Math.max(0, all.length - MAX)
  const display = all.slice(-MAX)

  return (
    <div className="rounded-lg bg-elevated/30 px-3 py-2.5">
      {current && (
        <div className="mb-1.5 truncate text-[11.5px] text-text-secondary">
          Working on {current.label.toLowerCase()}
        </div>
      )}
      {dropped > 0 && (
        <div className="mb-1 text-[10.5px] text-text-muted opacity-60">
          + {dropped} earlier step{dropped === 1 ? '' : 's'} done
        </div>
      )}
      <div className="flex flex-col gap-1">
        {display.map((s) => <ProgressItem key={s.id} step={s} />)}
        {seconds >= 5 && (
          <span className="ml-5 text-[10.5px] text-text-muted opacity-60">{seconds}s elapsed</span>
        )}
      </div>
    </div>
  )
}

function ProgressItem({ step }: { step: DesignProgressStep }): JSX.Element {
  return (
    <div className="flex items-start gap-2 text-[12px]">
      <span className="mt-0.5 flex-shrink-0">
        <StatusGlyph status={step.status} />
      </span>
      <span className={[
        'min-w-0 flex-1 break-words',
        step.status === 'done' ? 'text-text-muted opacity-70' :
        step.status === 'error' ? 'text-error' :
        'text-text-secondary'
      ].join(' ')}>
        {step.label}
      </span>
    </div>
  )
}

function StatusGlyph({ status }: { status: 'running' | 'done' | 'error' }): JSX.Element {
  if (status === 'done') {
    return (
      <span className="grid h-3.5 w-3.5 place-items-center text-success">
        <IconCheck size={9} />
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="grid h-3.5 w-3.5 place-items-center text-error">
        <IconClose size={8} />
      </span>
    )
  }
  // Running: small spinner ring instead of a green pulsing dot (which
  // looks like a status light, not an activity indicator).
  return (
    <span className="grid h-3.5 w-3.5 place-items-center">
      <svg viewBox="0 0 16 16" width="11" height="11" className="animate-spin text-text-secondary" aria-hidden="true">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.25" />
        <path d="M8 2 a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  )
}

function DesignEmpty({ onPick, onAttach }: {
  onPick: (prompt: string) => void
  onAttach: (kind: 'tokens' | 'screenshot' | 'codebase') => void
}): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-5 py-8">
      <div className="text-center">
        <h2 className="text-[18px] font-semibold text-text-primary">Start with context</h2>
        <p className="mt-1 text-[12.5px] text-text-muted">Designs grounded in real context turn out better.</p>
      </div>
      <div className="flex w-full max-w-[300px] flex-col gap-2">
        <ContextPill
          tone="rose"
          label="Design system"
          hint="Drop in design tokens or a tailwind config"
          onClick={() => onAttach('tokens')}
        />
        <ContextPill
          tone="violet"
          label="Add screenshot"
          hint="Use a reference image as the layout starting point"
          onClick={() => onAttach('screenshot')}
        />
        <ContextPill
          tone="amber"
          label="Attach codebase"
          hint="Read a project's README + tokens before designing"
          onClick={() => onAttach('codebase')}
        />
        <ContextPill
          tone="blue"
          label="Paste a Figma URL"
          hint="Build from an existing Figma frame"
          onClick={() => {
            const url = window.prompt('Paste a Figma file or frame URL:')
            if (url && /figma\.com\//i.test(url)) {
              onPick(`Figma reference: ${url}\n\nRead this Figma file via the figma MCP tools (figma_get_design_context, figma_get_screenshot, figma_get_metadata) and recreate it as HTML/CSS that matches the layout, colours and typography.`)
            }
          }}
        />
      </div>
      <div className="mt-1 text-[11.5px] text-text-muted">Or just describe what you want below.</div>
    </div>
  )
}

function Waveform({ levels }: { levels: number[] }): JSX.Element {
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

function ContextPill({ tone, label, hint, onClick }: {
  tone: 'rose' | 'violet' | 'amber' | 'blue'
  label: string
  hint: string
  onClick: () => void
}): JSX.Element {
  const dot =
    tone === 'rose'   ? 'bg-rose-400/30 text-rose-300'   :
    tone === 'violet' ? 'bg-violet-400/30 text-violet-300' :
    tone === 'amber'  ? 'bg-amber-400/30 text-amber-300' :
                        'bg-sky-400/30 text-sky-300'
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-full bg-elevated/40 px-3 py-2 text-left transition-colors hover:bg-elevated"
      title={hint}
    >
      <span className={['grid h-7 w-7 flex-shrink-0 place-items-center rounded-full', dot].join(' ')}>
        <span className="h-2 w-2 rounded-full bg-current" />
      </span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-text-primary">{label}</span>
      </span>
    </button>
  )
}


function Markdown({ content }: { content: string }): JSX.Element {
  const components = useMemo(() => ({
    a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a {...props} target="_blank" rel="noreferrer noopener" className="text-accent underline hover:opacity-80" />
    ),
    code: (props: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) => {
      const { inline, className, children, ...rest } = props
      // react-markdown v10 dropped the `inline` prop. Detect block code via
      // the `language-xyz` className that's only set on fenced blocks.
      const isBlock = inline === false || /\blanguage-/.test(className ?? '')
      if (!isBlock) {
        return (
          <code
            className="font-mono text-[12.5px] text-text-primary"
            style={{ background: 'transparent', padding: 0, borderRadius: 0 }}
            {...rest}
          >
            {children}
          </code>
        )
      }
      return (
        <pre className="my-2 overflow-x-auto rounded-lg bg-elevated p-3 font-mono text-[12.5px] leading-relaxed text-text-primary">
          <code className={className} {...rest}>{children}</code>
        </pre>
      )
    },
    p: (props: React.HTMLAttributes<HTMLParagraphElement>) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
    ul: (props: React.HTMLAttributes<HTMLUListElement>) => <ul className="my-2 list-disc space-y-1 pl-5 marker:text-text-muted" {...props} />,
    ol: (props: React.OlHTMLAttributes<HTMLOListElement>) => <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-text-muted" {...props} />,
    li: (props: React.LiHTMLAttributes<HTMLLIElement>) => <li className="leading-[1.6]" {...props} />,
    h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h1 className="mt-3 mb-1.5 text-[16px] font-semibold" {...props} />,
    h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h2 className="mt-3 mb-1.5 text-[15px] font-semibold" {...props} />,
    h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className="mt-2 mb-1 text-[14px] font-semibold" {...props} />,
    blockquote: (props: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
      <blockquote className="my-2 rounded-md bg-elevated/60 px-3 py-1.5 text-text-secondary" {...props} />
    )
  }), [])
  return <ReactMarkdown components={components}>{content}</ReactMarkdown>
}
