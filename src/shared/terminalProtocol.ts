// The vocabulary the terminal, the main process and the agent layer all speak.
//
// The app previously inferred what the shell was doing by regex-sniffing
// rendered output (see the ANSI stripper at the top of TerminalPane.tsx).
// That cannot distinguish a prompt from a command echoing a prompt-like
// string, cannot see exit codes at all, and breaks whenever a tool paints
// something unexpected. The fix is to stop guessing: the shell emits OSC
// escape sequences marking prompt/command boundaries, and long-running
// commands can emit structured progress lines. This module turns that byte
// stream into typed events.
//
// Everything here is pure and runtime-agnostic on purpose — no Electron, no
// xterm, no DOM — so the main process, the renderer and unit tests can all
// share one implementation and one set of edge cases.

/** OSC 133 is the FinalTerm/VS Code shell-integration vocabulary. */
export const OSC_PROMPT_START = 'A'
export const OSC_COMMAND_START = 'B'
export const OSC_COMMAND_EXECUTED = 'C'
export const OSC_COMMAND_FINISHED = 'D'

/** Marker prefixes a script can print to report progress explicitly. */
export const PROGRESS_MARKER = 'T42_PROGRESS'
export const CHECKPOINT_MARKER = 'T42_CHECKPOINT'

export type ShellEvent =
  | { kind: 'prompt-start' }
  | { kind: 'command-start' }
  | { kind: 'command-executed'; command: string | null }
  | { kind: 'command-finished'; exitCode: number | null }
  | { kind: 'cwd'; cwd: string }
  | { kind: 'progress'; percent: number | null; message: string | null; current: number | null; total: number | null; unit: string | null }
  | { kind: 'checkpoint'; message: string }

export type CommandStatus = 'running' | 'succeeded' | 'failed' | 'aborted'

/** One command, from the prompt that introduced it to its exit code. */
export type CommandBlock = {
  id: string
  command: string | null
  cwd: string | null
  status: CommandStatus
  exitCode: number | null
  startedAt: number
  endedAt: number | null
}

const BEL = '\x07'
const ESC = '\x1b'
const OSC_OPEN = '\x1b]'

// A lone ESC] in binary output would otherwise make the parser buffer for
// ever waiting for a terminator that never comes.
const MAX_PENDING_OSC = 4096

// Long lines (minified bundles, base64 blobs) are not progress reports, and
// scanning them repeatedly is wasted work.
const MAX_SCANNED_LINE = 2048

const ANSI_RE = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b[()][A-Z0-9]/g
const CTRL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '').replace(CTRL_RE, '')
}

/**
 * Parses one OSC body (everything between `ESC ]` and its terminator).
 * Returns null for sequences we do not care about — title changes and the
 * like are frequent and must not be mistaken for shell integration.
 */
export function parseOscBody(body: string): ShellEvent | null {
  // OSC 7 carries the working directory as a file URI.
  if (body.startsWith('7;')) {
    const raw = body.slice(2)
    const cwd = fileUriToPath(raw)
    return cwd ? { kind: 'cwd', cwd } : null
  }

  if (!body.startsWith('133;')) return null

  const parts = body.slice(4).split(';')
  switch (parts[0]) {
    case OSC_PROMPT_START:
      return { kind: 'prompt-start' }
    case OSC_COMMAND_START:
      return { kind: 'command-start' }
    case OSC_COMMAND_EXECUTED: {
      // Some shells attach the command line as `C;cmd=<text>`.
      const cmd = parts.slice(1).find((p) => p.startsWith('cmd='))
      return { kind: 'command-executed', command: cmd ? decodeOscValue(cmd.slice(4)) : null }
    }
    case OSC_COMMAND_FINISHED: {
      // `D` with no code means the command was aborted before it ran (an
      // empty prompt line), which is different from exiting with 0.
      if (parts.length < 2 || parts[1] === '') return { kind: 'command-finished', exitCode: null }
      const code = Number.parseInt(parts[1], 10)
      return { kind: 'command-finished', exitCode: Number.isNaN(code) ? null : code }
    }
    default:
      return null
  }
}

/** OSC payloads escape `;` and control bytes as hex so they survive parsing. */
function decodeOscValue(v: string): string {
  return v.replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(Number.parseInt(h, 16)))
}

function fileUriToPath(uri: string): string | null {
  if (!uri.startsWith('file://')) return null
  // Strip the authority (usually the hostname, sometimes empty).
  const afterScheme = uri.slice('file://'.length)
  const slash = afterScheme.indexOf('/')
  if (slash === -1) return null
  try {
    return decodeURIComponent(afterScheme.slice(slash))
  } catch {
    // A malformed percent-escape must not take down the parser.
    return afterScheme.slice(slash)
  }
}

/**
 * Reads a single line for a progress report.
 *
 * Structured markers are authoritative. The heuristic fallbacks exist because
 * most tools will never emit our markers, but they are deliberately narrow:
 * a bogus progress bar is worse than none, so a bare percentage somewhere in
 * a sentence is ignored unless the line also looks like a progress report.
 */
export function parseProgressLine(line: string): ShellEvent | null {
  const text = stripAnsi(line).trim()
  if (!text || text.length > MAX_SCANNED_LINE) return null

  const marker = text.indexOf(PROGRESS_MARKER)
  if (marker !== -1) {
    const payload = readJsonPayload(text.slice(marker + PROGRESS_MARKER.length))
    if (payload) {
      return {
        kind: 'progress',
        percent: numberOrNull(payload.percent),
        message: typeof payload.message === 'string' ? payload.message : null,
        current: numberOrNull(payload.current),
        total: numberOrNull(payload.total),
        unit: typeof payload.unit === 'string' ? payload.unit : null
      }
    }
  }

  const checkpoint = text.indexOf(CHECKPOINT_MARKER)
  if (checkpoint !== -1) {
    const payload = readJsonPayload(text.slice(checkpoint + CHECKPOINT_MARKER.length))
    const message = payload && typeof payload.message === 'string' ? payload.message : null
    if (message) return { kind: 'checkpoint', message }
  }

  // Heuristic 1: "Compiling foo [45%]" / "45% done". A percentage alone is
  // not enough — "coverage dropped by 12%" is prose, not progress — so it
  // must either carry a progress verb or own the start or end of the line.
  const pct = /(?:^|[\s[(])(\d{1,3}(?:\.\d+)?)\s?%(?:[\s\])]|$)/.exec(text)
  if (pct) {
    const percent = Number.parseFloat(pct[1])
    const label = labelFrom(text)
    const anchored = pct.index === 0 || pct.index + pct[0].length >= text.length
    if (percent >= 0 && percent <= 100 && (label || anchored)) {
      return { kind: 'progress', percent, message: label, current: null, total: null, unit: null }
    }
  }

  // Heuristic 2: "3/10 tests", "1.5/3.0 GiB", "step 3 of 10". Gated the same
  // way, since a bare "3/10" is just as likely to be a date or a path.
  const ratio = /(?:^|[\s[(])(\d+(?:\.\d+)?)\s*(?:\/|\bof\b)\s*(\d+(?:\.\d+)?)\s*([A-Za-z]{1,4})?/.exec(text)
  if (ratio) {
    const current = Number.parseFloat(ratio[1])
    const total = Number.parseFloat(ratio[2])
    const label = labelFrom(text)
    const unit = ratio[3] ?? null
    if (total > 0 && current <= total && (label || unit || ratio.index === 0)) {
      return {
        kind: 'progress',
        percent: Math.round((current / total) * 1000) / 10,
        message: label,
        current,
        total,
        unit
      }
    }
  }

  return null
}

function labelFrom(text: string): string | null {
  const verb = /\b(Compiling|Building|Downloading|Installing|Fetching|Uploading|Testing|Running|Linking|Packaging)\b/i.exec(text)
  return verb ? verb[1] : null
}

function numberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function readJsonPayload(rest: string): Record<string, unknown> | null {
  const start = rest.indexOf('{')
  if (start === -1) return null
  // Scan for the matching brace rather than assuming the JSON ends the line —
  // progress markers are often printed inline with other output.
  let depth = 0
  for (let i = start; i < rest.length; i++) {
    if (rest[i] === '{') depth++
    else if (rest[i] === '}') {
      depth--
      if (depth === 0) {
        try {
          const parsed: unknown = JSON.parse(rest.slice(start, i + 1))
          return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
        } catch {
          return null
        }
      }
    }
  }
  return null
}

/**
 * Incremental parser over raw PTY output.
 *
 * PTY data arrives in arbitrary chunks, so an escape sequence or a progress
 * line is routinely split down the middle. Callers must therefore feed every
 * chunk through one long-lived instance rather than parsing chunks
 * independently — the whole point of this class is holding the partial tail.
 */
export class ShellEventParser {
  private pending = ''
  private line = ''

  /** Feeds a chunk of raw output and returns whatever completed. */
  write(chunk: string): ShellEvent[] {
    const events: ShellEvent[] = []
    let buf = this.pending + chunk
    this.pending = ''

    while (buf.length > 0) {
      const start = buf.indexOf(OSC_OPEN)
      if (start === -1) {
        // A chunk can end on the ESC of an escape sequence whose `]` is in the
        // next chunk. Treating that ESC as text would silently drop the whole
        // sequence, so hold it back.
        if (buf.endsWith(ESC)) {
          this.scanText(buf.slice(0, -1), events)
          this.pending = ESC
          return events
        }
        this.scanText(buf, events)
        buf = ''
        break
      }

      this.scanText(buf.slice(0, start), events)

      const body = buf.slice(start + OSC_OPEN.length)
      const term = findTerminator(body)
      if (term === -1) {
        // Incomplete sequence: hold it for the next chunk, unless it has grown
        // past anything plausible, in which case it was never a real OSC.
        if (body.length > MAX_PENDING_OSC) {
          buf = body
          continue
        }
        this.pending = buf.slice(start)
        return events
      }

      const event = parseOscBody(body.slice(0, term))
      if (event) events.push(event)
      buf = body.slice(term + terminatorLength(body, term))
    }

    return events
  }

  /** Flushes a trailing partial line, e.g. a progress bar with no newline. */
  flush(): ShellEvent[] {
    const events: ShellEvent[] = []
    if (this.line) {
      const event = parseProgressLine(this.line)
      if (event) events.push(event)
      this.line = ''
    }
    this.pending = ''
    return events
  }

  private scanText(text: string, out: ShellEvent[]): void {
    if (!text) return
    // Progress bars redraw in place with \r, so treat it as a line break too.
    const parts = (this.line + text).split(/\r\n|\n|\r/)
    this.line = parts.pop() ?? ''
    for (const part of parts) {
      const event = parseProgressLine(part)
      if (event) out.push(event)
    }
    if (this.line.length > MAX_SCANNED_LINE) this.line = this.line.slice(-MAX_SCANNED_LINE)
  }
}

function findTerminator(body: string): number {
  const bel = body.indexOf(BEL)
  const st = body.indexOf(ESC + '\\')
  if (bel === -1) return st
  if (st === -1) return bel
  return Math.min(bel, st)
}

function terminatorLength(body: string, at: number): number {
  return body[at] === BEL ? 1 : 2
}

/** Everything derived from the event stream that the UI needs to render. */
export type TerminalState = {
  blocks: CommandBlock[]
  /** Where the next command will run, per the most recent OSC 7. */
  cwd: string | null
  progress: Extract<ShellEvent, { kind: 'progress' }> | null
}

export const EMPTY_TERMINAL_STATE: TerminalState = { blocks: [], cwd: null, progress: null }

/**
 * Folds shell events into command blocks.
 *
 * Kept separate from parsing because the two fail differently: a shell whose
 * integration is half-installed still produces valid events, just not a
 * well-formed A→B→C→D cycle, and this has to survive that without inventing
 * commands or leaving blocks running for ever.
 */
export function applyShellEvent(
  state: TerminalState,
  event: ShellEvent,
  now: number,
  nextId: () => string
): TerminalState {
  const { blocks } = state
  const last = blocks[blocks.length - 1]

  switch (event.kind) {
    case 'command-executed': {
      // A prompt that was never submitted leaves a running block behind; the
      // next command supersedes it rather than stacking up.
      const base = last && last.status === 'running' ? blocks.slice(0, -1) : blocks
      return {
        ...state,
        // Stale progress from the previous command would otherwise appear to
        // belong to this one.
        progress: null,
        blocks: [...base, {
          id: nextId(),
          command: event.command,
          cwd: state.cwd,
          status: 'running',
          exitCode: null,
          startedAt: now,
          endedAt: null
        }]
      }
    }

    case 'command-finished': {
      if (!last || last.status !== 'running') return state
      const finished: CommandBlock = {
        ...last,
        status: event.exitCode === null ? 'aborted' : event.exitCode === 0 ? 'succeeded' : 'failed',
        exitCode: event.exitCode,
        endedAt: now
      }
      return { ...state, progress: null, blocks: [...blocks.slice(0, -1), finished] }
    }

    // OSC 7 is emitted by the prompt, so it describes where the *next*
    // command will run — not where the one that just finished ran.
    case 'cwd':
      return state.cwd === event.cwd ? state : { ...state, cwd: event.cwd }

    case 'progress':
      return { ...state, progress: event }

    default:
      return state
  }
}
