import { ipcMain } from 'electron'
import { spawn } from 'node:child_process'
import { getDb } from './db'

interface GitStatus {
  isRepo: boolean
  branch: string | null
  hasRemote: boolean
  remoteUrl: string | null
  hasUpstream: boolean
  ahead: number
  behind: number
  dirty: boolean
  lastPushAt: number | null
  error?: string
}

interface GitResult {
  ok: boolean
  code: number
  stdout: string
  stderr: string
}

function runGit(cwd: string, args: string[]): Promise<GitResult> {
  return new Promise((resolve) => {
    try {
      const child = spawn('git', args, {
        cwd,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
      })
      let out = ''
      let err = ''
      child.stdout.on('data', (d) => { out += d.toString() })
      child.stderr.on('data', (d) => { err += d.toString() })
      child.on('error', (e) => resolve({ ok: false, code: -1, stdout: out, stderr: String(e?.message ?? e) }))
      child.on('close', (code) => resolve({ ok: code === 0, code: code ?? -1, stdout: out, stderr: err }))
    } catch (e) {
      resolve({ ok: false, code: -1, stdout: '', stderr: String((e as Error)?.message ?? e) })
    }
  })
}

function pushTimeKey(cwd: string): string {
  return `git:lastPushAt:${cwd}`
}
function getLastPushAt(cwd: string): number | null {
  try {
    const r = getDb().prepare('SELECT value FROM settings_kv WHERE key = ?').get(pushTimeKey(cwd)) as { value: string } | undefined
    if (!r) return null
    const n = Number(r.value)
    return Number.isFinite(n) ? n : null
  } catch { return null }
}
function setLastPushAt(cwd: string, at: number): void {
  try {
    getDb().prepare(
      'INSERT INTO settings_kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(pushTimeKey(cwd), String(at))
  } catch {}
}

async function getStatus(cwd: string): Promise<GitStatus> {
  const empty: GitStatus = {
    isRepo: false, branch: null, hasRemote: false, remoteUrl: null,
    hasUpstream: false, ahead: 0, behind: 0, dirty: false, lastPushAt: null
  }
  if (!cwd) return { ...empty, error: 'No working directory.' }

  const inside = await runGit(cwd, ['rev-parse', '--is-inside-work-tree'])
  if (!inside.ok || inside.stdout.trim() !== 'true') return empty

  const branchRes = await runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const branch = branchRes.ok ? branchRes.stdout.trim() : null

  const remoteRes = await runGit(cwd, ['remote', 'get-url', 'origin'])
  const hasRemote = remoteRes.ok && !!remoteRes.stdout.trim()
  const remoteUrl = hasRemote ? remoteRes.stdout.trim() : null

  let hasUpstream = false
  let ahead = 0
  let behind = 0
  if (branch && hasRemote) {
    const upRes = await runGit(cwd, ['rev-parse', '--abbrev-ref', `${branch}@{upstream}`])
    hasUpstream = upRes.ok && !!upRes.stdout.trim()
    if (hasUpstream) {
      const counts = await runGit(cwd, ['rev-list', '--left-right', '--count', `${branch}...@{upstream}`])
      if (counts.ok) {
        const [a, b] = counts.stdout.trim().split(/\s+/).map((n) => Number(n) || 0)
        ahead = a
        behind = b
      }
    }
  }

  const dirtyRes = await runGit(cwd, ['status', '--porcelain'])
  const dirty = dirtyRes.ok && dirtyRes.stdout.trim().length > 0

  return {
    isRepo: true, branch, hasRemote, remoteUrl,
    hasUpstream, ahead, behind, dirty,
    lastPushAt: getLastPushAt(cwd)
  }
}

export function registerGitIpc(): void {
  ipcMain.handle('git:status', async (_e, cwd: string): Promise<GitStatus> => getStatus(cwd))

  ipcMain.handle('git:init', async (_e, cwd: string): Promise<GitResult & { branch?: string }> => {
    if (!cwd) return { ok: false, code: -1, stdout: '', stderr: 'No working directory.' }
    const init = await runGit(cwd, ['init', '-b', 'main'])
    if (!init.ok) {
      const fallback = await runGit(cwd, ['init'])
      if (!fallback.ok) return fallback
    }
    return { ...init, branch: 'main' }
  })

  ipcMain.handle('git:addRemote', async (_e, args: { cwd: string; url: string }): Promise<GitResult> => {
    if (!args.cwd) return { ok: false, code: -1, stdout: '', stderr: 'No working directory.' }
    if (!args.url || !/^(https?:\/\/|git@|ssh:\/\/)/.test(args.url.trim())) {
      return { ok: false, code: -1, stdout: '', stderr: 'Remote URL looks invalid.' }
    }
    const existing = await runGit(args.cwd, ['remote', 'get-url', 'origin'])
    if (existing.ok && existing.stdout.trim()) {
      return runGit(args.cwd, ['remote', 'set-url', 'origin', args.url.trim()])
    }
    return runGit(args.cwd, ['remote', 'add', 'origin', args.url.trim()])
  })

  ipcMain.handle('git:commitAll', async (_e, args: { cwd: string; message: string }): Promise<GitResult> => {
    if (!args.cwd) return { ok: false, code: -1, stdout: '', stderr: 'No working directory.' }
    const add = await runGit(args.cwd, ['add', '-A'])
    if (!add.ok) return add
    return runGit(args.cwd, ['commit', '-m', args.message || 'Update from Terminal42'])
  })

  ipcMain.handle('git:push', async (_e, args: string | { cwd: string; setUpstream?: boolean; branch?: string | null }): Promise<GitResult> => {
    // Accept legacy string (cwd only) for backwards compat with the old API.
    const cwd = typeof args === 'string' ? args : args.cwd
    const setUpstream = typeof args === 'string' ? false : !!args.setUpstream
    const branch = typeof args === 'string' ? null : (args.branch ?? null)

    if (!cwd) return { ok: false, code: -1, stdout: '', stderr: 'No working directory.' }
    const cmd = setUpstream && branch
      ? ['push', '-u', 'origin', branch]
      : ['push']
    const res = await runGit(cwd, cmd)
    if (res.ok) setLastPushAt(cwd, Date.now())
    return res
  })

  ipcMain.handle('git:pull', async (_e, cwd: string): Promise<GitResult> => {
    if (!cwd) return { ok: false, code: -1, stdout: '', stderr: 'No working directory.' }
    // Use --ff-only so we don't create an unexpected merge commit when the
    // local branch has diverged. User can resolve manually if the fast-forward
    // fails.
    return runGit(cwd, ['pull', '--ff-only'])
  })
}
