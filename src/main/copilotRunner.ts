// Shared one-shot Copilot CLI runner.
//
// Built initially for the Loom feature. chat.ts and design.ts still have
// their own near-duplicate copies of this logic; they should migrate here
// in a follow-up so model-fallback / rate-limit handling lives in one place.
//
// API: callback-based. The runner owns spawn + JSON line parsing + retry
// (unknown --model → drop model and retry; default model rate-limited and
// eligible for auto-switch → retry with --model auto). Caller handles
// persistence and IPC emission via the provided callbacks.

import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { resolveModel } from './models'
import { copilotEnvSync } from './copilotAuth'

export type CopilotToolCall = {
  id: string
  name: string
  input?: string
  status: 'running' | 'done' | 'error'
  summary?: string
}

export type CopilotRunOptions = {
  prompt: string
  cwd: string
  model?: string | null
  resumeId?: string | null
  effort?: 'low' | 'medium' | null
  // 'plan' suppresses --no-ask-user. Other modes always include it.
  mode?: 'interactive' | 'plan' | 'autopilot'
  env?: NodeJS.ProcessEnv

  onStart?: () => void
  onAssistantStart?: (messageId: string) => void
  onAssistantDelta?: (delta: string, messageId: string) => void
  onAssistantMessage?: (content: string, messageId: string) => void
  onToolStart?: (tool: CopilotToolCall) => void
  onToolEnd?: (tool: CopilotToolCall) => void
  onResumeIdCaptured?: (copilotSessionId: string) => void
  onRateLimit?: (message: string, eligibleForAutoSwitch: boolean) => void
  onModelFallback?: (kind: 'unknown-model' | 'rate-limit-auto', detail: string) => void
  onDone?: (info: CopilotRunResult) => void
  onError?: (err: Error) => void
}

export type CopilotRunResult = {
  exitCode: number
  cancelled: boolean
  rateLimitMessage: string | null
  fallbackUsed: 'unknown-model' | 'rate-limit-auto' | null
  stderrTail: string
}

export type CopilotRunHandle = {
  cancel(): void
  isRunning(): boolean
}

type InternalState = {
  child: ChildProcess
  assistantMsgId: string | null
  buffer: string
  toolCalls: Map<string, CopilotToolCall>
  cancelled: boolean
  doneEmitted: boolean
  rateLimitMessage: string | null
  rateLimitAutoEligible: boolean
  stderrBuf: string
  stdoutBuf: string
}

function parseLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try { return JSON.parse(trimmed) as Record<string, unknown> }
  catch { return null }
}

function isUnknownModelError(stderr: string): boolean {
  return /from --model flag is not available|isn't available|is not available/i.test(stderr)
}

export function runCopilot(opts: CopilotRunOptions): CopilotRunHandle {
  const fallbackUsedRef: { value: CopilotRunResult['fallbackUsed'] } = { value: null }
  const handle: { current: InternalState | null } = { current: null }
  const cancelledRef = { value: false }

  const spawnAttempt = (requestedModel: string | null | undefined, attemptKind: 'initial' | 'unknown-model' | 'rate-limit-auto'): void => {
    // Resolve retired/internal IDs up front so an old saved selection does not
    // burn the first attempt on a name the CLI will reject.
    const model = resolveModel(requestedModel)
    const args: string[] = [
      '--prompt', opts.prompt,
      '--allow-all-tools',
      '--allow-all-paths',
      '--output-format', 'json',
      '--no-color',
      '-C', opts.cwd
    ]
    const mode = opts.mode ?? 'interactive'
    if (mode !== 'plan') args.push('--no-ask-user')
    if (model) args.push('--model', model)
    // --effort low/medium is rejected when --model is 'auto'; we omit it on auto fallbacks.
    if (opts.effort && model !== 'auto') args.push('--effort', opts.effort)
    if (opts.resumeId && attemptKind === 'initial') args.push('--resume', opts.resumeId)

    let child: ChildProcess
    try {
      child = spawn('copilot', args, {
        cwd: opts.cwd,
        env: { ...copilotEnvSync(), ...(opts.env ?? {}), FORCE_COLOR: '0', NO_COLOR: '1' },
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } catch (err) {
      opts.onError?.(err instanceof Error ? err : new Error(String(err)))
      opts.onDone?.({ exitCode: -1, cancelled: false, rateLimitMessage: null, fallbackUsed: fallbackUsedRef.value, stderrTail: '' })
      return
    }

    const state: InternalState = {
      child,
      assistantMsgId: null,
      buffer: '',
      toolCalls: new Map(),
      cancelled: false,
      doneEmitted: false,
      rateLimitMessage: null,
      rateLimitAutoEligible: false,
      stderrBuf: '',
      stdoutBuf: ''
    }
    handle.current = state

    // The very first attempt fires onStart; subsequent retries are silent
    // from the caller's perspective (they emit onModelFallback instead).
    if (attemptKind === 'initial') opts.onStart?.()

    child.stdout?.on('data', (chunk: Buffer) => {
      state.stdoutBuf += chunk.toString('utf8')
      let nl = state.stdoutBuf.indexOf('\n')
      while (nl !== -1) {
        const line = state.stdoutBuf.slice(0, nl)
        state.stdoutBuf = state.stdoutBuf.slice(nl + 1)
        const evt = parseLine(line)
        if (evt) processEvent(state, evt as { type: string; data?: Record<string, unknown>; sessionId?: string })
        nl = state.stdoutBuf.indexOf('\n')
      }
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      state.stderrBuf += chunk.toString('utf8')
    })
    child.on('error', (err) => {
      opts.onError?.(err)
      finalize(state, -1)
    })
    child.on('close', (code) => {
      if (state.stdoutBuf.trim()) {
        const evt = parseLine(state.stdoutBuf)
        if (evt) processEvent(state, evt as { type: string; data?: Record<string, unknown>; sessionId?: string })
        state.stdoutBuf = ''
      }
      finalize(state, code ?? 0)
    })

    const processEvent = (s: InternalState, evt: { type: string; data?: Record<string, unknown>; sessionId?: string }): void => {
      const t = evt.type
      if (t === 'session.error') {
        const d = (evt.data as { errorType?: string; message?: string; eligibleForAutoSwitch?: boolean }) ?? {}
        if (d.errorType === 'rate_limit') {
          s.rateLimitMessage = typeof d.message === 'string' ? d.message : 'Copilot rate limit reached.'
          s.rateLimitAutoEligible = !!d.eligibleForAutoSwitch
        }
        return
      }
      if (t === 'assistant.message_start') {
        const id = randomUUID()
        s.assistantMsgId = id
        opts.onAssistantStart?.(id)
        return
      }
      if (t === 'assistant.message_delta') {
        const delta = String((evt.data as Record<string, unknown>)?.deltaContent ?? '')
        if (!delta || !s.assistantMsgId) return
        s.buffer += delta
        opts.onAssistantDelta?.(delta, s.assistantMsgId)
        return
      }
      if (t === 'assistant.message') {
        const content = String((evt.data as Record<string, unknown>)?.content ?? s.buffer)
        if (s.assistantMsgId) opts.onAssistantMessage?.(content, s.assistantMsgId)
        s.buffer = ''
        s.assistantMsgId = null
        return
      }
      if (t === 'tool.execution_start' || t === 'assistant.tool_call_start' || t === 'assistant.tool_request') {
        const data = (evt.data as Record<string, unknown>) ?? {}
        const id = String(data.toolCallId ?? data.id ?? randomUUID())
        const name = String(data.toolName ?? data.name ?? 'tool')
        const input = data.input ? JSON.stringify(data.input).slice(0, 280) : undefined
        const tool: CopilotToolCall = { id, name, input, status: 'running' }
        s.toolCalls.set(id, tool)
        opts.onToolStart?.(tool)
        return
      }
      if (t === 'tool.execution_end' || t === 'assistant.tool_call_end' || t === 'tool.result') {
        const data = (evt.data as Record<string, unknown>) ?? {}
        const id = String(data.toolCallId ?? data.id ?? '')
        const existing = s.toolCalls.get(id)
        if (!existing) return
        const ok = (data.status ?? data.outcome) !== 'error'
        existing.status = ok ? 'done' : 'error'
        if (data.summary) existing.summary = String(data.summary).slice(0, 280)
        s.toolCalls.set(id, existing)
        opts.onToolEnd?.(existing)
        return
      }
      if (t === 'result') {
        const copilotSessionId = (evt as { sessionId?: string }).sessionId
        if (copilotSessionId) opts.onResumeIdCaptured?.(copilotSessionId)
        return
      }
    }

    const finalize = (s: InternalState, exitCode: number): void => {
      if (handle.current !== s) return
      if (s.doneEmitted) return
      s.doneEmitted = true
      handle.current = null

      const tail = s.stderrBuf.slice(-2000)

      // Cancellation always wins. Don't attempt fallback for a user cancel.
      if (s.cancelled || cancelledRef.value) {
        opts.onDone?.({ exitCode, cancelled: true, rateLimitMessage: s.rateLimitMessage, fallbackUsed: fallbackUsedRef.value, stderrTail: tail })
        return
      }

      // Unknown-model fallback: only attempt once and only when we actually
      // requested a model on this attempt.
      if (attemptKind === 'initial' && exitCode !== 0 && model && isUnknownModelError(tail)) {
        fallbackUsedRef.value = 'unknown-model'
        opts.onModelFallback?.('unknown-model', tail.split('\n').slice(-3).join('\n'))
        spawnAttempt(null, 'unknown-model')
        return
      }

      // Rate-limit fallback: if Copilot signalled rate_limit AND said the
      // request is eligible for auto-switch, retry once with --model auto.
      if (attemptKind !== 'rate-limit-auto' && s.rateLimitMessage && s.rateLimitAutoEligible) {
        fallbackUsedRef.value = 'rate-limit-auto'
        opts.onModelFallback?.('rate-limit-auto', s.rateLimitMessage)
        spawnAttempt('auto', 'rate-limit-auto')
        return
      }

      // Terminal: rate limit but no auto eligibility, or just a clean exit.
      opts.onDone?.({
        exitCode,
        cancelled: false,
        rateLimitMessage: s.rateLimitMessage,
        fallbackUsed: fallbackUsedRef.value,
        stderrTail: tail
      })
    }
  }

  spawnAttempt(opts.model ?? null, 'initial')

  return {
    cancel(): void {
      cancelledRef.value = true
      const s = handle.current
      if (!s) return
      s.cancelled = true
      try { s.child.kill('SIGTERM') } catch {}
    },
    isRunning(): boolean {
      return handle.current !== null
    }
  }
}
