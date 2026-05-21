import { ipcMain, shell, BrowserWindow } from 'electron'
import { createServer } from 'net'
import { randomUUID } from 'crypto'
import * as pty from 'node-pty'
import { getDb, type PreviewCommandRow } from './db'

type Running = {
  id: string
  commandId: string
  projectId: string
  name: string
  proc: pty.IPty
  port: number | null
  url: string | null
  cwd: string
  startedAt: number
  buffer: string
}

const running = new Map<string, Running>()

export function runningPreviewCount(): number {
  return running.size
}

export function runningPreviewList(): Array<{
  id: string
  commandId: string
  projectId: string
  name: string
  port: number | null
  url: string | null
  cwd: string
  startedAt: number
}> {
  return Array.from(running.values()).map((r) => ({
    id: r.id,
    commandId: r.commandId,
    projectId: r.projectId,
    name: r.name,
    port: r.port,
    url: r.url,
    cwd: r.cwd,
    startedAt: r.startedAt
  }))
}

export function stopPreview(id: string): boolean {
  const r = running.get(id)
  if (!r) return false
  try { r.proc.kill() } catch {}
  running.delete(id)
  return true
}

function probePort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port, '127.0.0.1')
  })
}

async function findFreePort(start: number, max = 25): Promise<number> {
  for (let i = 0; i < max; i++) {
    const p = start + i
    if (await probePort(p)) return p
  }
  return start
}

function buildCommand(
  command: string,
  framework: string | null,
  port: number
): { line: string; usedToken: boolean } {
  if (command.includes('{port}')) {
    return { line: command.replace(/\{port\}/g, String(port)), usedToken: true }
  }
  switch (framework) {
    case 'vite':
      return { line: `${command} -- --port ${port}`, usedToken: false }
    case 'next':
      return { line: `${command} -- -p ${port}`, usedToken: false }
    case 'cra':
      return { line: `PORT=${port} ${command}`, usedToken: false }
    case 'astro':
      return { line: `${command} -- --port ${port}`, usedToken: false }
    default:
      return { line: command, usedToken: false }
  }
}

// Strip ANSI sequences before regex; restrict path charset so we don't
// swallow trailing colour-resets like `\x1b[38;2;...m` if a stray escape
// gets through.
const ANSI_RE = /\x1B\[[0-9;?]*[A-Za-z]|\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g
const URL_RE = /(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?(?:\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*)?)/i

export function registerPreviewIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('preview:list', (_e, projectId: string) => {
    return getDb()
      .prepare('SELECT * FROM preview_commands WHERE project_id = ? ORDER BY created_at ASC')
      .all(projectId) as PreviewCommandRow[]
  })

  ipcMain.handle(
    'preview:add',
    (_e, args: { projectId: string; name: string; command: string; framework: string | null; preferredPort: number | null }) => {
      const id = randomUUID()
      getDb()
        .prepare(
          'INSERT INTO preview_commands (id, project_id, name, command, framework, preferred_port, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(id, args.projectId, args.name, args.command, args.framework, args.preferredPort, Date.now())
      return getDb().prepare('SELECT * FROM preview_commands WHERE id = ?').get(id) as PreviewCommandRow
    }
  )

  ipcMain.handle('preview:remove', (_e, id: string) => {
    getDb().prepare('DELETE FROM preview_commands WHERE id = ?').run(id)
    return { ok: true }
  })

  ipcMain.handle('preview:running', () => {
    return Array.from(running.values()).map((r) => ({
      id: r.id,
      commandId: r.commandId,
      projectId: r.projectId,
      name: r.name,
      pid: r.proc.pid,
      port: r.port,
      url: r.url,
      cwd: r.cwd,
      startedAt: r.startedAt
    }))
  })

  ipcMain.handle('preview:start', async (_e, args: { commandId: string; cwd: string }) => {
    const cmd = getDb()
      .prepare('SELECT * FROM preview_commands WHERE id = ?')
      .get(args.commandId) as PreviewCommandRow | undefined
    if (!cmd) return { ok: false, error: 'Command not found' }

    const requestedPort = cmd.preferred_port ?? 3000
    const freePort = await findFreePort(requestedPort)
    const built = buildCommand(cmd.command, cmd.framework, freePort)
    const id = randomUUID()
    const shellBin = process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh'
    const shellArgs = process.platform === 'win32' ? ['-NoLogo', '-Command', built.line] : ['-l', '-c', built.line]

    const proc = pty.spawn(shellBin, shellArgs, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: args.cwd,
      env: { ...process.env, FORCE_COLOR: '1', PORT: String(freePort) } as Record<string, string>
    })

    const r: Running = {
      id,
      commandId: cmd.id,
      projectId: cmd.project_id,
      name: cmd.name,
      proc,
      port: freePort,
      url: null,
      cwd: args.cwd,
      startedAt: Date.now(),
      buffer: ''
    }
    running.set(id, r)

    proc.onData((data) => {
      r.buffer = (r.buffer + data).slice(-8000)
      if (!r.url) {
        const stripped = r.buffer.replace(ANSI_RE, '')
        const m = stripped.match(URL_RE)
        if (m) {
          r.url = m[1].replace(/[).,;:'"`>\]]+$/, '')
          const win = getWindow()
          if (win && !win.isDestroyed()) {
            win.webContents.send('preview:ready', { id, url: r.url, port: r.port })
          }
        }
      }
      const win = getWindow()
      if (win && !win.isDestroyed()) win.webContents.send(`preview:data:${id}`, data)
    })
    proc.onExit(({ exitCode }) => {
      running.delete(id)
      const win = getWindow()
      if (win && !win.isDestroyed()) win.webContents.send(`preview:exit:${id}`, exitCode)
    })

    return {
      ok: true,
      id,
      port: freePort,
      portShifted: freePort !== requestedPort,
      requestedPort
    }
  })

  ipcMain.handle('preview:stop', (_e, id: string) => {
    const r = running.get(id)
    if (r) {
      try { r.proc.kill() } catch {}
      running.delete(id)
    }
    return { ok: !!r }
  })

  ipcMain.handle('preview:restart', (_e, id: string) => {
    const r = running.get(id)
    if (!r) return { ok: false }
    const commandId = r.commandId
    const cwd = r.cwd
    try { r.proc.kill() } catch {}
    running.delete(id)
    return { ok: true, commandId, cwd }
  })

  ipcMain.handle('preview:open', (_e, id: string) => {
    const r = running.get(id)
    if (r?.url) shell.openExternal(r.url)
    return { ok: !!r?.url }
  })
}

export function killAllPreviews(): void {
  for (const [, r] of running) {
    try { r.proc.kill() } catch {}
  }
  running.clear()
}
