import { ipcMain, dialog, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { fileKind, scanProject, type Finding, type ScanFile } from '../shared/guidelineScan'
import { designCwd } from './designStore'
import {
  cloneUrl, designSources, entryFile, isCheckable, isDesignSource, isShell, parseGithubUrl,
  projectName, shouldSkip, type GithubRepo
} from '../shared/guidelineIntake'

// Reading a project so it can be checked.
//
// The source itself never crosses to the renderer. A front end project is
// megabytes of text and the report only needs counts and a line or two, so
// what is collected stays here under a check id and the renderer is handed
// the findings. The apply step later asks for the entry file by that id.

/** No project worth checking is bigger than this; a build output is. */
const MAX_FILES = 400
const MAX_BYTES = 512 * 1024
const CLONE_TIMEOUT = 90_000

export type CheckSource =
  | { kind: 'folder'; path: string }
  | { kind: 'github'; repo: GithubRepo }

type Check = {
  id: string
  name: string
  root: string
  /** Set when the root is ours to delete. */
  temp: boolean
  files: ScanFile[]
  entry: string | null
  findings: Finding[]
}

const checks = new Map<string, Check>()

/** Every checkable file under a directory, depth first, within the limits. */
async function collect(root: string): Promise<ScanFile[]> {
  const out: ScanFile[] = []

  const walk = async (dir: string): Promise<void> => {
    if (out.length >= MAX_FILES) return
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true, encoding: 'utf8' })
    } catch {
      return
    }
    for (const e of entries) {
      if (out.length >= MAX_FILES) return
      const full = join(dir, e.name)
      const rel = relative(root, full).split(sep).join('/')
      if (e.isDirectory()) {
        if (shouldSkip(rel)) continue
        await walk(full)
      } else if (e.isFile() && isDesignSource(rel)) {
        try {
          const info = await stat(full)
          if (info.size > MAX_BYTES) continue
          out.push({ path: rel, text: await readFile(full, 'utf8') })
        } catch { /* unreadable is the same as absent */ }
      }
    }
  }

  await walk(root)
  return out
}

function git(args: string[], cwd: string): Promise<{ ok: boolean; error: string }> {
  return new Promise((resolve) => {
    const child = spawn('git', args, {
      cwd,
      // A clone must never stop to ask for a password: a private repository
      // would otherwise hang here with nothing on screen to answer.
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo' }
    })
    let err = ''
    child.stderr?.on('data', (d) => { err += String(d) })
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve({ ok: false, error: 'Timed out' }) }, CLONE_TIMEOUT)
    child.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, error: String(e) }) })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve(code === 0 ? { ok: true, error: '' } : { ok: false, error: err.trim() || `git exited ${code}` })
    })
  })
}

/** The last line of git's complaint, which is the part worth showing. */
function gitReason(error: string): string {
  const line = error.split('\n').map((l) => l.trim()).filter(Boolean).pop() ?? ''
  if (/could not read Username|Authentication failed|terminal prompts disabled/i.test(error)) {
    return 'That repository is private, or it does not exist.'
  }
  if (/not found|Repository not found/i.test(error)) return 'No repository at that address.'
  if (/Timed out/i.test(error)) return 'The clone took too long.'
  return line.slice(0, 160) || 'The clone failed.'
}

async function fromGithub(repo: GithubRepo): Promise<{ root: string } | { error: string }> {
  const dir = await mkdtemp(join(tmpdir(), 't42-check-'))
  const args = ['clone', '--depth', '1', '--single-branch']
  if (repo.ref) args.push('--branch', repo.ref)
  args.push(cloneUrl(repo), dir)

  const res = await git(args, tmpdir())
  if (!res.ok) {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
    return { error: gitReason(res.error) }
  }
  return { root: dir }
}

let nextId = 1

export type CheckResult =
  | { ok: true; id: string; name: string; fileCount: number; entry: string | null; findings: Finding[] }
  | { ok: false; error: string }

async function run(source: CheckSource): Promise<CheckResult> {
  let root: string
  let temp = false

  if (source.kind === 'github') {
    const got = await fromGithub(source.repo)
    if ('error' in got) return { ok: false, error: got.error }
    root = got.root
    temp = true
  } else {
    root = source.path
  }

  const files = await collect(root)
  if (files.length === 0) {
    if (temp) await rm(root, { recursive: true, force: true }).catch(() => {})
    return { ok: false, error: 'Nothing to check here — no HTML, CSS or components were found.' }
  }

  // A page that is only a mount point is a poor thing to hand the repair
  // run, so a real page wins the entry even if the shell sits shallower.
  const pages = files.filter((f) => fileKind(f.path) === 'html')
  const real = pages.filter((f) => !isShell(f.text)).map((f) => f.path)

  const check: Check = {
    id: `check-${nextId++}`,
    name: projectName(source),
    root,
    temp,
    files,
    entry: entryFile(real.length > 0 ? real : pages.map((f) => f.path)),
    findings: scanProject(files)
  }
  checks.set(check.id, check)

  return {
    ok: true,
    id: check.id,
    name: check.name,
    fileCount: files.filter((f) => isCheckable(f.path)).length,
    entry: check.entry,
    findings: check.findings
  }
}

/** The page a report points at, fetched only when it is going to be used. */
export function checkEntryHtml(id: string): {
  name: string; path: string; html: string; shell: boolean
} | null {
  const check = checks.get(id)
  if (!check?.entry) return null
  const file = check.files.find((f) => f.path === check.entry)
  if (!file) return null
  return { name: check.name, path: file.path, html: file.text, shell: isShell(file.text) }
}

/**
 * Put the project's design source beside the new design, under `source/`.
 *
 * The repair run reads files rather than being handed them in the prompt: a
 * stylesheet quoted into an instruction is tokens spent on something the
 * agent can open itself, and the shortlist is small on purpose. Paths keep
 * their shape so a component that imports './App.css' still finds it.
 */
export async function seedSource(id: string, dir: string): Promise<string[]> {
  const check = checks.get(id)
  if (!check) return []
  const picked = designSources(check.files, check.entry)
  const written: string[] = []

  for (const file of picked) {
    // Nothing collected can escape the root, but the design folder is the
    // user's own data, so the path is proved to stay inside it regardless.
    const target = join(dir, 'source', file.path)
    const base = join(dir, 'source')
    if (target !== base && !target.startsWith(base + sep)) continue
    try {
      await mkdir(join(target, '..'), { recursive: true })
      await writeFile(target, file.text, 'utf8')
      written.push(`source/${file.path}`)
    } catch { /* one unwritable file is not worth failing the run for */ }
  }

  return written
}

export function forgetCheck(id: string): void {
  const check = checks.get(id)
  if (!check) return
  checks.delete(id)
  if (check.temp) void rm(check.root, { recursive: true, force: true }).catch(() => {})
}

/** Temporary clones outlive nothing; drop them when the app closes. */
export function clearChecks(): void {
  for (const id of [...checks.keys()]) forgetCheck(id)
}

/**
 * Clear clones an earlier run never got to delete.
 *
 * `clearChecks` covers an ordinary quit, but a crash or a kill leaves the
 * clone behind, and a repository is not small. Anything left in the
 * temporary directory from a previous session is ours and is finished with,
 * so it goes at startup.
 */
export async function sweepOldClones(): Promise<void> {
  const dir = tmpdir()
  let entries: Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true, encoding: 'utf8' })
  } catch { return }
  const live = new Set([...checks.values()].map((c) => c.root))
  for (const e of entries) {
    if (!e.isDirectory() || !e.name.startsWith('t42-check-')) continue
    const full = join(dir, e.name)
    if (live.has(full)) continue
    await rm(full, { recursive: true, force: true }).catch(() => {})
  }
}

export function registerGuidelineIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('guidelines:checkFolder', async (): Promise<CheckResult> => {
    const win = getWindow()
    if (!win) return { ok: false, error: 'No window' }
    const picked = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Choose a project to check'
    })
    if (picked.canceled || picked.filePaths.length === 0) return { ok: false, error: 'cancelled' }
    return run({ kind: 'folder', path: picked.filePaths[0] })
  })

  ipcMain.handle('guidelines:checkGithub', async (_e, url: string): Promise<CheckResult> => {
    const repo = parseGithubUrl(String(url ?? ''))
    if (!repo) return { ok: false, error: 'That does not look like a GitHub repository.' }
    return run({ kind: 'github', repo })
  })

  ipcMain.handle('guidelines:entry', (_e, id: string) => checkEntryHtml(String(id ?? '')))
  ipcMain.handle('guidelines:seedSource', (_e, id: string, designId: string) =>
    seedSource(String(id ?? ''), designCwd(String(designId ?? ''))))
  ipcMain.handle('guidelines:forget', (_e, id: string) => { forgetCheck(String(id ?? '')) })
}
