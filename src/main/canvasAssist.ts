import { ipcMain, BrowserWindow, clipboard } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveModel } from './models'
import { copilotEnvSync } from './copilotAuth'

// An empty, isolated working directory for the assistant's Copilot process. Using
// the user's HOME made the agent scan personal folders on startup (Documents,
// Music/iTunes, …), which triggers macOS privacy prompts. An empty temp dir has
// nothing to scan and isn't a protected location.
function sandboxDir(): string {
  const dir = join(tmpdir(), 'terminal42-canvas-assist')
  try { mkdirSync(dir, { recursive: true }) } catch { /* ignore */ }
  return dir
}

// One-shot Copilot completion for the freeform-canvas assistant. Unlike chat.ts /
// design.ts this does NOT manage sessions, write history, or stream — it just runs
// `copilot --prompt ... --output-format json`, captures the final assistant message
// text, and resolves it. The renderer parses the JSON action payload itself.

function parseLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try { return JSON.parse(trimmed) as Record<string, unknown> }
  catch { return null }
}

function runOnce(prompt: string, model: string | null, cwd: string, attachments: string[] = []): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const args = [
      '--prompt', prompt,
      '--output-format', 'json',
      '--no-color',
      '--no-ask-user',
      // Speed + safety: the assistant only needs a JSON completion. Skip MCP
      // server startup, the big custom-instructions file, and experimental
      // features, and make NO tools available so the agent never touches the
      // filesystem / shell (no macOS folder/iTunes permission prompts).
      '--disable-builtin-mcps',
      '--no-custom-instructions',
      '--no-experimental',
      '--available-tools=',
      '-C', cwd,
    ]
    for (const p of attachments) args.push('--attachment', p)
    const resolved = resolveModel(model)
    if (resolved) args.push('--model', resolved)

    let child: ChildProcess
    try {
      child = spawn('copilot', args, { cwd, env: { ...copilotEnvSync(), FORCE_COLOR: '0', NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (err) {
      resolve({ ok: false, error: `Failed to start copilot: ${String(err)}` })
      return
    }

    let finalText = ''
    let buffer = ''
    let stdoutBuf = ''
    let stderrBuf = ''
    let settled = false

    const handleEvt = (evt: { type?: string; data?: Record<string, unknown> }): void => {
      const t = evt.type
      if (t === 'assistant.message_delta') buffer += String((evt.data as Record<string, unknown>)?.deltaContent ?? '')
      else if (t === 'assistant.message') { finalText = String((evt.data as Record<string, unknown>)?.content ?? buffer); buffer = '' }
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString('utf8')
      let nl = stdoutBuf.indexOf('\n')
      while (nl !== -1) {
        const line = stdoutBuf.slice(0, nl)
        stdoutBuf = stdoutBuf.slice(nl + 1)
        const evt = parseLine(line)
        if (evt) handleEvt(evt as { type?: string; data?: Record<string, unknown> })
        nl = stdoutBuf.indexOf('\n')
      }
    })
    child.stderr?.on('data', (chunk: Buffer) => { stderrBuf += chunk.toString('utf8') })

    const done = (res: { ok: true; text: string } | { ok: false; error: string }): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(res)
    }

    const timer = setTimeout(() => {
      try { child.kill('SIGTERM') } catch { /* ignore */ }
      done({ ok: false, error: 'The assistant timed out. Try a simpler request.' })
    }, 150_000)

    child.on('error', (err) => done({ ok: false, error: `copilot error: ${String(err)}` }))
    child.on('close', (code) => {
      if (stdoutBuf.trim()) { const evt = parseLine(stdoutBuf); if (evt) handleEvt(evt as { type?: string; data?: Record<string, unknown> }) }
      const text = (finalText || buffer).trim()
      if (text) done({ ok: true, text })
      else done({ ok: false, error: stderrBuf.trim() || `No response (exit ${code ?? '?'}). Make sure the Copilot CLI is installed and signed in.` })
    })
  })
}

/** True when the CLI refused the model itself, rather than failing the request. */
function modelUnavailable(error: string): boolean {
  return /model .*(is )?not available|unknown model|unsupported model/i.test(error)
}

/**
 * Run with the preferred model, and if the CLI does not have that model, run
 * again with whatever the user's default is. An account without the fast model
 * would otherwise get silence from every AI feature in the app.
 */
async function runWithFallback(
  prompt: string, model: string | null, cwd: string, attachments: string[] = []
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const first = await runOnce(prompt, model, cwd, attachments)
  if (first.ok || !model || !modelUnavailable(first.error)) return first
  return runOnce(prompt, null, cwd, attachments)
}

export function registerCanvasAssistIpc(_getWin: () => BrowserWindow | null): void {
  // Reads the OS clipboard's text/html — used to import a Figma copy (the renderer
  // 'paste' event doesn't fire reliably on a non-editable canvas).
  ipcMain.handle('canvas:readClipboardHTML', () => {
    try { return clipboard.readHTML() } catch { return '' }
  })
  ipcMain.handle('canvas:assist', async (_e, args: { prompt: string; model?: string | null }) => {
    const prompt = (args?.prompt ?? '').toString()
    if (!prompt.trim()) return { ok: false, error: 'Empty prompt.' }
    // Default to a fast model — the assistant only emits small JSON payloads, so a
    // quick model keeps it snappy regardless of the user's global default.
    const model = args?.model ?? 'claude-haiku-4.5'
    const cwd = sandboxDir()
    return runWithFallback(prompt, model, cwd)
  })

  // Vision variant: writes the provided images (data URLs) to temp files and
  // passes them to the model via `--attachment`, so the assistant can actually
  // SEE reference screenshots. Used by the design-system reference analyzer.
  ipcMain.handle('canvas:assistVision', async (_e, args: { prompt: string; images?: string[]; model?: string | null }) => {
    const prompt = (args?.prompt ?? '').toString()
    if (!prompt.trim()) return { ok: false, error: 'Empty prompt.' }
    const images = Array.isArray(args?.images) ? args!.images! : []
    // For visual analysis, prefer the user's configured (capable) default model
    // rather than the fast Haiku used for tiny text completions. Passing null
    // means we don't add --model, so the CLI uses the user's default.
    const model = args?.model ?? null
    const cwd = sandboxDir()
    const files: string[] = []
    try {
      for (const url of images.slice(0, 5)) {
        const m = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(String(url))
        if (!m) continue
        const ext = m[1].split('/')[1].replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'png'
        const file = join(cwd, `ref-${randomUUID()}.${ext}`)
        try { writeFileSync(file, Buffer.from(m[2], 'base64')); files.push(file) } catch { /* skip */ }
      }
      if (!files.length) return { ok: false, error: 'No valid images to analyze.' }
      return await runWithFallback(prompt, model, cwd, files)
    } finally {
      for (const f of files) { try { unlinkSync(f) } catch { /* ignore */ } }
    }
  })
}
