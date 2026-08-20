import { ipcMain, BrowserWindow, app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getDb } from './db'
import { writtenPathFrom, toolArgumentsOf } from '../shared/toolArtifacts'
import { pickPreviewArtifact } from '../shared/previewArtifact'
import { resolveModel } from './models'
import { assembleCacheStableMessages, flattenPromptCacheMessages } from '../shared/promptCache'
import { buildMemoryContext } from './memoryContext'
import { recordMemoryUse } from './sessionInsights'
import { reframeGoal, renderGoalReframePrompt } from '../shared/goalReframe'
import { type DiffSummary } from './gitSnapshot'
import {
  takeTurnSnapshot, diffTurnSnapshot, revertTurnSnapshot, readFileAtSnapshot,
  isEmptySnapshot, type TurnSnapshot
} from './turnSnapshot'
import { pruneStore, type Store } from './localSnapshot'
import { copilotEnvSync } from './copilotAuth'

/**
 * Where local file copies for undo are kept.
 *
 * Outside the project so a snapshot never shows up in the user's own diff, and
 * under userData so it is cleaned up with the app rather than left behind in a
 * folder they may later delete.
 */
function undoStore(): Store {
  return { dir: join(app.getPath('userData'), 'undo-snapshots') }
}

/**
 * How long local copies survive. Undo is an immediate-regret feature — nobody
 * reaches for it on a week-old turn — and the copies are real disk, so they are
 * swept rather than kept forever.
 */
const UNDO_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

/** Sweep expired local copies. Called once at startup; failure is not fatal. */
export function pruneUndoSnapshots(): void {
  void pruneStore(undoStore(), UNDO_RETENTION_MS).catch(() => {})
}

export type ChatRole = 'user' | 'assistant' | 'system'
export type ChatStatus = 'pending' | 'streaming' | 'done' | 'error' | 'cancelled'

export type ToolCall = {
  id: string
  name: string
  input?: string
  status: 'running' | 'done' | 'error'
  summary?: string
}

export type ChatMessage = {
  id: string
  sessionId: string
  role: ChatRole
  content: string
  toolCalls: ToolCall[]
  status: ChatStatus
  createdAt: number
  /** Files this turn changed. Absent until the turn finishes, or when the
   *  session isn't running inside a git repository. */
  diff?: DiffSummary | null
  /** True once the user has reverted this turn, so Undo isn't offered twice. */
  undone?: boolean
}

type RunState = {
  child: ChildProcess
  assistantMsgId: string | null
  buffer: string
  toolCalls: Map<string, ToolCall>
  cancelled: boolean
  doneEmitted: boolean
  /** Working directory the turn ran in, kept so the diff and any later undo
   *  resolve against the same repo even if the project is re-pointed. */
  cwd: string
  /** Worktree snapshot taken as the turn started. Held as a promise so
   *  starting the run is never blocked on git. */
  snapshot: Promise<TurnSnapshot | null>
  /** Absolute paths the turn's tools wrote, in the order they were written.
   *  Read from the tool calls rather than the snapshot so the preview can
   *  open the moment the turn ends, whatever size the folder is. */
  written: string[]
  // Retry context for transparent model fallback (one-shot --prompt mode
  // doesn't auto-fall-back on unknown --model, so we re-send without it).
  // If that hits a rate limit and is eligible for auto-switch, we retry
  // once more with --model auto.
  requestedModel: string | null
  originalText: string
  originalOpts: { cwd?: string | null; prefix?: string | null; agentMode?: 'interactive' | 'plan' | 'autopilot' }
  isModelFallback: boolean
  isAutoFallback: boolean
  rateLimitMessage: string | null
  rateLimitAutoEligible: boolean
}

const running = new Map<string, RunState>()

function emit(win: BrowserWindow | null, event: string, payload: unknown): void {
  try { win?.webContents.send(event, payload) } catch {}
}

function finalizeRun(win: BrowserWindow | null, sessionId: string, state: RunState, exitCode: number): void {
  if (running.get(sessionId) !== state) return
  running.delete(sessionId)
  if (state.doneEmitted) return
  state.doneEmitted = true
  emitTurnArtifact(win, sessionId, state)
  void recordTurnDiff(win, sessionId, state)
  emit(win, 'chat:done', { sessionId, exitCode })
}

/**
 * Tell the renderer about a page the turn wrote, so it can be shown rather
 * than described.
 *
 * Emitted from the tool calls, not the diff: the diff needs a worktree
 * snapshot, which in a large folder can take minutes, and a preview that
 * arrives minutes after the answer is no preview at all.
 */
function emitTurnArtifact(win: BrowserWindow | null, sessionId: string, state: RunState): void {
  const page = pickPreviewArtifact(state.written.map((path) => ({ path, status: 'added' })))
  if (!page) return
  emit(win, 'chat:artifact', { sessionId, path: page, cwd: state.cwd })
}

/**
 * Work out what the finished turn changed on disk and attach it to the
 * assistant message.
 *
 * Runs detached from the done event on purpose: taking the closing snapshot
 * costs a couple of git invocations, and making the user wait for the diff
 * before the response is marked complete would be a regression in the common
 * case where nothing changed at all. The card simply appears a moment later.
 */
async function recordTurnDiff(win: BrowserWindow | null, sessionId: string, state: RunState): Promise<void> {
  try {
    const messageId = state.assistantMsgId
    if (!messageId) return
    const before = await state.snapshot
    if (isEmptySnapshot(before)) return
    const snap = before as TurnSnapshot
    const diff = await diffTurnSnapshot(undoStore(), snap)
    if (diff.files.length === 0) return
    getDb()
      .prepare('UPDATE chat_messages SET snapshot_tree = ?, snapshot_local = ?, diff_json = ?, diff_cwd = ? WHERE id = ?')
      .run(snap.git, snap.local, JSON.stringify(diff), state.cwd, messageId)
    emit(win, 'chat:diff', { sessionId, messageId, diff })
  } catch {
    // A diff is a convenience; never let it break the turn.
  }
}

function rowToMessage(row: {
  id: string; session_id: string; role: ChatRole; content: string;
  tool_calls: string | null; status: ChatStatus; created_at: number;
  diff_json?: string | null; undone?: number | null
}): ChatMessage {
  let toolCalls: ToolCall[] = []
  if (row.tool_calls) {
    try { toolCalls = JSON.parse(row.tool_calls) } catch {}
  }
  let diff: DiffSummary | null = null
  if (row.diff_json) {
    try { diff = JSON.parse(row.diff_json) as DiffSummary } catch {}
  }
  return {
    id: row.id, sessionId: row.session_id, role: row.role, content: row.content,
    toolCalls, status: row.status, createdAt: row.created_at,
    diff, undone: !!row.undone
  }
}

function loadHistory(sessionId: string): ChatMessage[] {
  const rows = getDb()
    .prepare(`SELECT id, session_id, role, content, tool_calls, status, created_at, diff_json, undone
              FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC, id ASC`)
    .all(sessionId) as Array<Parameters<typeof rowToMessage>[0]>
  return rows.map(rowToMessage)
}

function insertMessage(m: ChatMessage): void {
  getDb()
    .prepare(`INSERT INTO chat_messages (id, session_id, role, content, tool_calls, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(m.id, m.sessionId, m.role, m.content, JSON.stringify(m.toolCalls), m.status, m.createdAt)
}

function updateMessage(m: ChatMessage): void {
  getDb()
    .prepare(`UPDATE chat_messages SET content = ?, tool_calls = ?, status = ? WHERE id = ?`)
    .run(m.content, JSON.stringify(m.toolCalls), m.status, m.id)
}

function getCopilotResumeId(sessionId: string): string | null {
  const row = getDb()
    .prepare('SELECT copilot_session_id FROM sessions WHERE id = ?')
    .get(sessionId) as { copilot_session_id: string | null } | undefined
  return row?.copilot_session_id ?? null
}

function saveCopilotResumeId(sessionId: string, copilotSessionId: string): void {
  getDb()
    .prepare('UPDATE sessions SET copilot_session_id = ?, last_active_at = ? WHERE id = ?')
    .run(copilotSessionId, Date.now(), sessionId)
}

function getSessionModel(sessionId: string): string | null {
  const row = getDb()
    .prepare('SELECT model FROM sessions WHERE id = ?')
    .get(sessionId) as { model: string | null } | undefined
  return row?.model ?? null
}

function getProjectCwd(sessionId: string): string | null {
  const row = getDb()
    .prepare(`SELECT p.path AS path FROM sessions s
              LEFT JOIN projects p ON p.id = s.project_id WHERE s.id = ?`)
    .get(sessionId) as { path: string | null } | undefined
  return row?.path ?? null
}

function processJsonEvent(
  win: BrowserWindow | null,
  sessionId: string,
  state: RunState,
  evt: { type: string; data?: Record<string, unknown>; sessionId?: string; exitCode?: number }
): void {
  const t = evt.type
  // Capture rate-limit errors so the close handler can either auto-switch
  // to the "auto" model picker or surface a friendly message.
  if (t === 'session.error') {
    const d = (evt.data as { errorType?: string; message?: string; eligibleForAutoSwitch?: boolean }) ?? {}
    if (d.errorType === 'rate_limit') {
      state.rateLimitMessage = typeof d.message === 'string' ? d.message : 'Copilot rate limit reached.'
      state.rateLimitAutoEligible = !!d.eligibleForAutoSwitch
    }
  }
  if (t === 'assistant.message_start') {
    const id = randomUUID()
    state.assistantMsgId = id
    const msg: ChatMessage = {
      id, sessionId, role: 'assistant', content: '',
      toolCalls: Array.from(state.toolCalls.values()),
      status: 'streaming', createdAt: Date.now()
    }
    insertMessage(msg)
    emit(win, 'chat:message', msg)
    return
  }
  if (t === 'assistant.message_delta') {
    const delta = String((evt.data as Record<string, unknown>)?.deltaContent ?? '')
    if (!delta || !state.assistantMsgId) return
    state.buffer += delta
    emit(win, 'chat:delta', { sessionId, messageId: state.assistantMsgId, delta })
    return
  }
  if (t === 'assistant.message') {
    const content = String((evt.data as Record<string, unknown>)?.content ?? state.buffer)
    if (!state.assistantMsgId) return
    const msg: ChatMessage = {
      id: state.assistantMsgId, sessionId, role: 'assistant', content,
      toolCalls: Array.from(state.toolCalls.values()),
      status: 'done', createdAt: Date.now()
    }
    updateMessage(msg)
    emit(win, 'chat:message', msg)
    state.buffer = ''
    state.assistantMsgId = null
    return
  }
  if (t === 'tool.execution_start' || t === 'assistant.tool_call_start' || t === 'assistant.tool_request') {
    const data = (evt.data as Record<string, unknown>) ?? {}
    const id = String(data.toolCallId ?? data.id ?? randomUUID())
    const name = String(data.toolName ?? data.name ?? 'tool')
    // The CLI names this field `arguments`; `input` is accepted as a
    // fallback for older event shapes. Reading only `input` meant tool
    // arguments were silently always empty.
    const args = toolArgumentsOf(data)
    const input = args ? JSON.stringify(args).slice(0, 280) : undefined
    const written = writtenPathFrom(name, args)
    if (written && !state.written.includes(written)) state.written.push(written)
    state.toolCalls.set(id, { id, name, input, status: 'running' })
    emit(win, 'chat:tool', { sessionId, tool: state.toolCalls.get(id) })
    return
  }
  if (t === 'tool.execution_end' || t === 'assistant.tool_call_end' || t === 'tool.result') {
    const data = (evt.data as Record<string, unknown>) ?? {}
    const id = String(data.toolCallId ?? data.id ?? '')
    const existing = state.toolCalls.get(id)
    if (!existing) return
    const ok = (data.status ?? data.outcome) !== 'error'
    existing.status = ok ? 'done' : 'error'
    if (data.summary) existing.summary = String(data.summary).slice(0, 280)
    state.toolCalls.set(id, existing)
    emit(win, 'chat:tool', { sessionId, tool: existing })
    return
  }
  if (t === 'result') {
    const copilotSessionId = (evt as { sessionId?: string }).sessionId
    if (copilotSessionId) saveCopilotResumeId(sessionId, copilotSessionId)
    emit(win, 'chat:done', { sessionId, exitCode: (evt as { exitCode?: number }).exitCode ?? 0 })
    return
  }
}

/**
 * Revert every file a turn changed, back to the snapshot taken before it ran.
 *
 * Scoped to that turn's file list, so edits the user made by hand while the
 * agent worked survive. Marked `undone` afterwards so the card stops offering
 * a second revert against a now-stale snapshot.
 */
async function undoTurn(messageId: string): Promise<{ ok: boolean; reverted: string[]; error?: string }> {
  const row = getDb()
    .prepare('SELECT snapshot_tree, snapshot_local, diff_json, diff_cwd, undone FROM chat_messages WHERE id = ?')
    .get(messageId) as { snapshot_tree: string | null; snapshot_local: string | null; diff_json: string | null; diff_cwd: string | null; undone: number } | undefined
  if (!row) return { ok: false, reverted: [], error: 'Message not found.' }
  if (row.undone) return { ok: false, reverted: [], error: 'These changes were already undone.' }
  if ((!row.snapshot_tree && !row.snapshot_local) || !row.diff_cwd || !row.diff_json) {
    return { ok: false, reverted: [], error: 'No snapshot was recorded for this turn.' }
  }
  const snap: TurnSnapshot = { cwd: row.diff_cwd, git: row.snapshot_tree, local: row.snapshot_local }
  let diff: DiffSummary
  try { diff = JSON.parse(row.diff_json) as DiffSummary }
  catch { return { ok: false, reverted: [], error: 'Recorded changes could not be read.' } }

  // Files the snapshot could not capture are excluded rather than attempted:
  // the card already shows them as not undoable, and asking git to restore a
  // path it never held would delete it.
  const paths = diff.files.filter((f) => !f.unrecoverable).map((f) => f.path)
  const res = await revertTurnSnapshot(undoStore(), snap, paths)
  if (res.reverted.length > 0) {
    getDb().prepare('UPDATE chat_messages SET undone = 1 WHERE id = ?').run(messageId)
  }
  if (!res.ok) {
    return {
      ok: false,
      reverted: res.reverted,
      error: `Could not restore ${res.failed.length} file(s): ${res.failed.map((f) => f.path).join(', ')}`
    }
  }
  return { ok: true, reverted: res.reverted }
}

/**
 * Before/after contents of one file the turn touched, for the Code view.
 *
 * `path` is checked against that turn's recorded file list, so this can only
 * ever read files the turn actually changed.
 */
async function loadFileDiff(
  messageId: string,
  path: string
): Promise<{ ok: boolean; before: string | null; after: string | null; error?: string }> {
  const row = getDb()
    .prepare('SELECT snapshot_tree, snapshot_local, diff_json, diff_cwd FROM chat_messages WHERE id = ?')
    .get(messageId) as { snapshot_tree: string | null; snapshot_local: string | null; diff_json: string | null; diff_cwd: string | null } | undefined
  if (!row || (!row.snapshot_tree && !row.snapshot_local) || !row.diff_cwd || !row.diff_json) {
    return { ok: false, before: null, after: null, error: 'No snapshot for this turn.' }
  }
  let diff: DiffSummary
  try { diff = JSON.parse(row.diff_json) as DiffSummary }
  catch { return { ok: false, before: null, after: null, error: 'Recorded changes could not be read.' } }
  const entry = diff.files.find((f) => f.path === path)
  if (!entry) return { ok: false, before: null, after: null, error: 'That file is not part of this change.' }
  if (entry.binary) return { ok: false, before: null, after: null, error: 'Binary file.' }

  const snap: TurnSnapshot = { cwd: row.diff_cwd, git: row.snapshot_tree, local: row.snapshot_local }
  const before = await readFileAtSnapshot(undoStore(), snap, path)
  let after: string | null = null
  try { after = await readFile(join(row.diff_cwd, path), 'utf8') }
  catch { after = null }
  return { ok: true, before, after }
}

function parseLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try { return JSON.parse(trimmed) as Record<string, unknown> }
  catch { return null }
}

function send(
  win: BrowserWindow | null,
  sessionId: string,
  text: string,
  opts: { model?: string | null; cwd?: string | null; prefix?: string | null; agentMode?: 'interactive' | 'plan' | 'autopilot'; isModelFallback?: boolean; isAutoFallback?: boolean }
): { ok: true } | { ok: false; error: string } {
  if (running.has(sessionId) && !opts.isModelFallback && !opts.isAutoFallback) {
    return { ok: false, error: 'Another response is in progress.' }
  }
  const cwd = opts.cwd ?? getProjectCwd(sessionId) ?? process.env.HOME ?? process.cwd()
  // `opts.model === null` is an explicit "drop the model" signal used by the
  // unknown-model/rate-limit fallback retries below. Using `??` here would
  // treat that null the same as "not provided" and re-fetch the same stale
  // session model, repeating the exact failure the retry was meant to fix.
  const model = opts.model !== undefined ? opts.model : getSessionModel(sessionId)
  const resume = getCopilotResumeId(sessionId)

  const userMsg: ChatMessage = {
    id: randomUUID(),
    sessionId,
    role: 'user',
    content: text,
    toolCalls: [],
    status: 'done',
    createdAt: Date.now()
  }
  if (!opts.isModelFallback && !opts.isAutoFallback) {
    insertMessage(userMsg)
    emit(win, 'chat:message', userMsg)
  }

  const mode = opts.agentMode ?? 'interactive'
  let modePrefix = ''
  if (mode === 'plan') {
    modePrefix = 'MODE: PLAN. Before writing or running anything, draft a short numbered plan (3-7 steps) of what you intend to do, then STOP and wait for the user to reply with "go" or edits. Do not call any write/edit/exec tools yet.\n\n'
  } else if (mode === 'autopilot') {
    modePrefix = 'MODE: AUTOPILOT. Execute the full task end-to-end without asking clarifying questions. Make reasonable defaults silently. Only stop on a hard error you cannot recover from.\n\n'
  } else {
    modePrefix = 'MODE: INTERACTIVE. Work in small reversible steps. After each meaningful action (file write, command run, external API call), pause briefly to let the user steer if needed. Prefer asking one short clarifying question over making a wrong assumption.\n\n'
  }

  // If the user mentions Figma, hand the agent a short tool guide so it
  // picks the best MCP path (same logic as the design view's exporter).
  let figmaPrefix = ''
  if (/\bfigma\b/i.test(text)) {
    figmaPrefix = [
      'FIGMA AVAILABLE via the figma-write MCP server.',
      '  Requires the "MCP WebSocket Client" plugin running in Figma Desktop. Probe with figma-write-figma_plugin_status (5s timeout). If it responds, use figma-write-figma_pages / figma_nodes / figma_auto_layout / figma_text / figma_fills / figma_strokes / figma_effects / figma_fonts. For icons use figma-write-figma_svg with SVG fetched from a CDN (Phosphor / Tabler / Lucide / Remix); replace currentColor with the right hex first.',
      '  If the probe fails, say so and stop. Do not call figma-* tools: the hosted Figma MCP is not configured, so those tool names do not exist.',
      'Quality rules: real auto-layout frames, real text nodes, real vector icons. Never substitute icons with basic shapes. Never use FIXED sizing on auto-layout frames. No em-dashes (U+2014) in any layer/text — use ASCII "-".',
      ''
    ].join('\n')
  }

  // Recalled Brain notes. This is background the agent would otherwise have to
  // be told again every session, so it belongs in the stable prefix ahead of
  // the request. buildMemoryContext returns a null block when nothing clears
  // its relevance floor, which is the common case and must stay silent.
  const memory = buildMemoryContext(text)
  recordMemoryUse(resume ?? sessionId, memory.used.length)

  // When the goal has nothing measurable in it, say so before the request
  // rather than after: the model should read the request already knowing it
  // needs a metric. Returns '' for goals that already pass the gate.
  const reframe = renderGoalReframePrompt(reframeGoal(text))

  // Ordered from most stable to most volatile so the longest possible prefix
  // is byte-identical between turns. The user's text stays last: this is
  // flattened into a single --prompt string, so anything appended after it
  // would read as instructions trailing the request rather than framing it.
  const promptText = flattenPromptCacheMessages(assembleCacheStableMessages({
    stablePrefix: [
      { role: 'system', content: modePrefix },
      ...(figmaPrefix ? [{ role: 'system' as const, content: figmaPrefix }] : []),
      ...(opts.prefix ? [{ role: 'system' as const, content: opts.prefix }] : []),
      ...(memory.block ? [{ role: 'system' as const, content: memory.block }] : []),
      ...(reframe ? [{ role: 'system' as const, content: reframe }] : [])
    ],
    history: [],
    currentTurn: { role: 'user', content: text }
  }))
  const args: string[] = [
    '--prompt', promptText,
    '--allow-all-tools',
    '--allow-all-paths',
    '--output-format', 'json',
    '--no-color',
    '-C', cwd
  ]
  if (mode !== 'plan') args.push('--no-ask-user')
  const resolvedModel = resolveModel(model)
  if (resolvedModel) args.push('--model', resolvedModel)
  if (resume) args.push('--resume', resume)

  // The `figma-write` MCP is loaded from ~/.copilot/mcp-config.json. The
  // figmaPrefix above tells the agent how to use it. Nothing to disable here.

  // Resolved before spawning so the CLI finds a token in its environment and
  // never reaches for the keychain, which prompts once per launch when the
  // caller is this app rather than the user's own terminal.
  const copilotSpawnEnv = copilotEnvSync()

  let child: ChildProcess
  try {
    child = spawn('copilot', args, {
      cwd,
      env: { ...copilotSpawnEnv, FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (err) {
    const errMsg: ChatMessage = {
      id: randomUUID(), sessionId, role: 'system',
      content: `Failed to start copilot: ${String(err)}`, toolCalls: [],
      status: 'error', createdAt: Date.now()
    }
    insertMessage(errMsg)
    emit(win, 'chat:message', errMsg)
    emit(win, 'chat:done', { sessionId, exitCode: -1 })
    return { ok: false, error: String(err) }
  }

  const state: RunState = {
    child, assistantMsgId: null, buffer: '', toolCalls: new Map(), cancelled: false, doneEmitted: false,
    cwd,
    // Fired here rather than awaited: the run must not wait on git.
    snapshot: takeTurnSnapshot(undoStore(), cwd),
    written: [],
    requestedModel: model ?? null,
    originalText: text,
    originalOpts: { cwd: opts.cwd, prefix: opts.prefix, agentMode: opts.agentMode },
    isModelFallback: !!opts.isModelFallback,
    isAutoFallback: !!opts.isAutoFallback,
    rateLimitMessage: null,
    rateLimitAutoEligible: false
  }
  running.set(sessionId, state)
  emit(win, 'chat:start', { sessionId })

  let stdoutBuf = ''
  let stderrBuf = ''
  child.stdout?.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString('utf8')
    let nl = stdoutBuf.indexOf('\n')
    while (nl !== -1) {
      const line = stdoutBuf.slice(0, nl)
      stdoutBuf = stdoutBuf.slice(nl + 1)
      const evt = parseLine(line)
      if (evt) processJsonEvent(win, sessionId, state, evt as Parameters<typeof processJsonEvent>[3])
      nl = stdoutBuf.indexOf('\n')
    }
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    stderrBuf += chunk.toString('utf8')
  })
  child.on('error', (err) => {
    const errMsg: ChatMessage = {
      id: randomUUID(), sessionId, role: 'system',
      content: `copilot error: ${String(err)}`, toolCalls: [],
      status: 'error', createdAt: Date.now()
    }
    insertMessage(errMsg)
    emit(win, 'chat:message', errMsg)
    finalizeRun(win, sessionId, state, -1)
  })
  child.on('close', (code) => {
    // Drain any remaining buffered line
    if (stdoutBuf.trim()) {
      const evt = parseLine(stdoutBuf)
      if (evt) processJsonEvent(win, sessionId, state, evt as Parameters<typeof processJsonEvent>[3])
    }

    // Rate-limit recovery: Copilot may exit cleanly (code 0) right after
    // emitting a session.error/rate_limit. If the error is auto-switch
    // eligible, retry with --model auto so the user actually gets a reply.
    if (state.rateLimitMessage && !state.cancelled && state.rateLimitAutoEligible && !state.isAutoFallback) {
      if (state.assistantMsgId) {
        const msg: ChatMessage = {
          id: state.assistantMsgId, sessionId, role: 'assistant',
          content: '', toolCalls: [], status: 'cancelled', createdAt: Date.now()
        }
        updateMessage(msg)
        emit(win, 'chat:message', msg)
      }
      const notice: ChatMessage = {
        id: randomUUID(), sessionId, role: 'system',
        content: 'Hit the rate limit on the default model. Retrying with the "auto" picker (uses any model that\'s currently available).',
        toolCalls: [], status: 'done', createdAt: Date.now()
      }
      insertMessage(notice)
      emit(win, 'chat:message', notice)
      finalizeRun(win, sessionId, state, code ?? -1)
      send(win, sessionId, state.originalText, { ...state.originalOpts, model: 'auto', isModelFallback: true, isAutoFallback: true })
      return
    }
    if (state.rateLimitMessage && !state.cancelled) {
      if (state.assistantMsgId) {
        const msg: ChatMessage = {
          id: state.assistantMsgId, sessionId, role: 'assistant',
          content: '', toolCalls: [], status: 'cancelled', createdAt: Date.now()
        }
        updateMessage(msg)
        emit(win, 'chat:message', msg)
      }
      const errMsg: ChatMessage = {
        id: randomUUID(), sessionId, role: 'system',
        content: `Copilot rate limit reached.\n\n${state.rateLimitMessage}`,
        toolCalls: [], status: 'error', createdAt: Date.now()
      }
      insertMessage(errMsg)
      emit(win, 'chat:message', errMsg)
      finalizeRun(win, sessionId, state, code ?? -1)
      return
    }

    // Transparent --model fallback: Copilot one-shot mode exits with code 1
    // when --model is unrecognized. Re-send the same prompt without --model
    // so the user gets a response instead of a cryptic error. Only once per
    // turn, only when an explicit model was requested.
    const modelUnavailable = code !== 0
      && !state.cancelled
      && !!state.requestedModel
      && !state.isModelFallback
      && /from --model flag is not available/i.test(stderrBuf)
    if (modelUnavailable) {
      if (state.assistantMsgId) {
        const msg: ChatMessage = {
          id: state.assistantMsgId, sessionId, role: 'assistant',
          content: '', toolCalls: [], status: 'cancelled', createdAt: Date.now()
        }
        updateMessage(msg)
        emit(win, 'chat:message', msg)
      }
      const notice: ChatMessage = {
        id: randomUUID(), sessionId, role: 'system',
        content: `Model "${state.requestedModel}" isn't available on this Copilot CLI right now — retrying with the default model.`,
        toolCalls: [], status: 'done', createdAt: Date.now()
      }
      insertMessage(notice)
      emit(win, 'chat:message', notice)
      finalizeRun(win, sessionId, state, code ?? -1)
      send(win, sessionId, state.originalText, { ...state.originalOpts, model: null, isModelFallback: true })
      return
    }

    // If we never finalised an assistant message, mark it
    if (state.assistantMsgId) {
      const msg: ChatMessage = {
        id: state.assistantMsgId, sessionId, role: 'assistant',
        content: state.buffer || '(no response)',
        toolCalls: Array.from(state.toolCalls.values()),
        status: state.cancelled ? 'cancelled' : (code === 0 ? 'done' : 'error'),
        createdAt: Date.now()
      }
      updateMessage(msg)
      emit(win, 'chat:message', msg)
    }
    if (code !== 0 && !state.cancelled) {
      const tail = stderrBuf.split('\n').filter(Boolean).slice(-3).join('\n')
      if (tail) {
        const errMsg: ChatMessage = {
          id: randomUUID(), sessionId, role: 'system',
          content: `copilot exited with code ${code}\n${tail}`, toolCalls: [],
          status: 'error', createdAt: Date.now()
        }
        insertMessage(errMsg)
        emit(win, 'chat:message', errMsg)
      }
    }
    finalizeRun(win, sessionId, state, code ?? -1)
  })
  return { ok: true }
}

function cancel(sessionId: string): boolean {
  const state = running.get(sessionId)
  if (!state) return false
  state.cancelled = true
  try { state.child.kill('SIGTERM') } catch {}
  setTimeout(() => {
    const s = running.get(sessionId)
    if (!s) return
    try { s.child.kill('SIGKILL') } catch {}
    setTimeout(() => {
      if (running.get(sessionId) === state) finalizeRun(null, sessionId, state, -1)
    }, 2000)
  }, 1500)
  return true
}

function clearHistory(sessionId: string): void {
  cancel(sessionId)
  getDb().prepare('DELETE FROM chat_messages WHERE session_id = ?').run(sessionId)
  getDb().prepare('UPDATE sessions SET copilot_session_id = NULL WHERE id = ?').run(sessionId)
}

export function isBusy(sessionId: string): boolean {
  return running.has(sessionId)
}

export function killAllChats(): void {
  for (const [id] of running) cancel(id)
}

export function registerChatIpc(getWin: () => BrowserWindow | null): void {
  ipcMain.handle('chat:send', (_e, args: { sessionId: string; text: string; model?: string | null; prefix?: string | null; agentMode?: 'interactive' | 'plan' | 'autopilot' }) => {
    return send(getWin(), args.sessionId, args.text, { model: args.model ?? null, cwd: null, prefix: args.prefix ?? null, agentMode: args.agentMode ?? 'interactive' })
  })
  ipcMain.handle('chat:cancel', (_e, sessionId: string) => ({ ok: cancel(sessionId) }))
  ipcMain.handle('chat:history', (_e, sessionId: string) => loadHistory(sessionId))
  ipcMain.handle('chat:clear', (_e, sessionId: string) => { clearHistory(sessionId); return { ok: true } })
  ipcMain.handle('chat:isBusy', (_e, sessionId: string) => isBusy(sessionId))
  ipcMain.handle('chat:undo', async (_e, messageId: string) => undoTurn(messageId))
  ipcMain.handle('chat:fileDiff', async (_e, args: { messageId: string; path: string }) =>
    loadFileDiff(args.messageId, args.path))
}
