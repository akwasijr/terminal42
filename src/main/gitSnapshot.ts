// Turn-scoped worktree snapshots, diffs, and reverts.
//
// Backs the "N files changed +X -Y · Undo" card in chat. The hard requirement
// is that taking a snapshot must be invisible: it must not touch the user's
// index, their worktree, their stash, or HEAD. A snapshot happens before every
// chat turn, so any side effect would corrupt real work.
//
// The trick is a throwaway index file. `git add -A` writes staging state to
// whatever GIT_INDEX_FILE points at, so pointing it at a temp path lets us
// stage the whole worktree into a scratch index and call `git write-tree` to
// freeze it as a tree object — leaving the real index untouched.
//
// Undo is deliberately narrow: it restores only the paths that changed during
// that turn, from that turn's snapshot. It never runs `git checkout .`, which
// would also destroy edits the user made by hand while the agent worked.
//
// This module intentionally imports neither electron nor the database so it
// can be unit-tested directly against a real temporary repository.

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { mkdir, unlink, writeFile, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path'

export type FileChangeStatus = 'added' | 'modified' | 'deleted'

export interface FileChange {
  path: string
  status: FileChangeStatus
  additions: number
  deletions: number
  /** Binary files report no line counts; git prints "-" for both. */
  binary: boolean
  /**
   * True when the change was detected but the original contents were not
   * captured, so it cannot be reverted. Only the local-copy store produces
   * this, for files above its per-file size limit. The UI should show the
   * change but not offer to undo it, rather than failing on the click.
   */
  unrecoverable?: boolean
}

export interface DiffSummary {
  files: FileChange[]
  additions: number
  deletions: number
}

interface RawResult {
  ok: boolean
  code: number
  stdout: Buffer
  stderr: string
}

/**
 * Run git, capturing stdout as a Buffer.
 *
 * Buffer rather than string matters for `cat-file blob`: decoding binary
 * content through utf-8 is lossy, so restoring a PNG via a string round-trip
 * silently corrupts it.
 */
/**
 * How long any single git call in a snapshot may run before we give up.
 *
 * Snapshotting stages the whole worktree, and the cost of that is set by the
 * folder, not by the turn. A session opened on a home directory or a Desktop
 * holding tens of gigabytes will hash for minutes, on every turn, and the
 * result is a chat that appears to work but never produces a diff card.
 * Failing fast turns that into a plainly missing undo instead of a hang.
 */
export const GIT_TIMEOUT_MS = 15_000

function runGitRaw(
  cwd: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
  timeoutMs = GIT_TIMEOUT_MS
): Promise<RawResult> {
  return new Promise((resolve) => {
    try {
      const child = spawn('git', args, {
        cwd,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...env }
      })
      const chunks: Buffer[] = []
      let err = ''
      let settled = false
      const finish = (r: RawResult): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(r)
      }
      // Kill rather than just resolving: an abandoned `git add` would carry on
      // hashing in the background, so every turn would leave another one
      // running.
      const timer = setTimeout(() => {
        try { child.kill('SIGKILL') } catch { /* already gone */ }
        finish({ ok: false, code: -1, stdout: Buffer.alloc(0), stderr: `git timed out after ${timeoutMs}ms` })
      }, timeoutMs)
      timer.unref?.()
      child.stdout.on('data', (d: Buffer) => { chunks.push(d) })
      child.stderr.on('data', (d) => { err += d.toString() })
      child.on('error', (e) =>
        finish({ ok: false, code: -1, stdout: Buffer.alloc(0), stderr: String(e?.message ?? e) })
      )
      child.on('close', (code) =>
        finish({ ok: code === 0, code: code ?? -1, stdout: Buffer.concat(chunks), stderr: err })
      )
    } catch (e) {
      resolve({ ok: false, code: -1, stdout: Buffer.alloc(0), stderr: String((e as Error)?.message ?? e) })
    }
  })
}

async function runGitText(
  cwd: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
  timeoutMs?: number
): Promise<{ ok: boolean; out: string; err: string }> {
  const r = await runGitRaw(cwd, args, env, timeoutMs)
  return { ok: r.ok, out: r.stdout.toString('utf8'), err: r.stderr }
}

export async function isRepo(cwd: string, timeoutMs?: number): Promise<boolean> {
  if (!cwd) return false
  const r = await runGitText(cwd, ['rev-parse', '--is-inside-work-tree'], undefined, timeoutMs)
  return r.ok && r.out.trim() === 'true'
}

/**
 * Freeze the current worktree as a git tree object and return its sha.
 *
 * Returns null when `cwd` isn't a repository — callers treat that as "no undo
 * available for this turn" rather than an error, since plenty of sessions run
 * outside a repo.
 *
 * Files excluded by .gitignore are NOT captured (git add -A honours ignores).
 * That keeps snapshots fast in projects with node_modules, at the cost of not
 * being able to undo changes to ignored files. Deliberate trade: ignored paths
 * are build output, and snapshotting them on every turn would be pathological.
 */
export async function snapshotTree(cwd: string, timeoutMs = GIT_TIMEOUT_MS): Promise<string | null> {
  if (!(await isRepo(cwd, timeoutMs))) return null
  let dir: string | null = null
  try {
    dir = mkdtempSync(join(tmpdir(), 't42-snap-'))
    const indexFile = join(dir, 'index')
    const env = { GIT_INDEX_FILE: indexFile }
    // Stage everything into the scratch index. The real index is untouched
    // because GIT_INDEX_FILE redirects all staging writes.
    const add = await runGitText(cwd, ['add', '-A', '--', '.'], env, timeoutMs)
    if (!add.ok) return null
    const tree = await runGitText(cwd, ['write-tree'], env, timeoutMs)
    if (!tree.ok) return null
    const sha = tree.out.trim()
    return /^[0-9a-f]{40,64}$/.test(sha) ? sha : null
  } catch {
    return null
  } finally {
    if (dir) { try { rmSync(dir, { recursive: true, force: true }) } catch {} }
  }
}

/** Split a NUL-delimited git payload, dropping the trailing empty field. */
function splitZ(out: string): string[] {
  const parts = out.split('\0')
  if (parts.length && parts[parts.length - 1] === '') parts.pop()
  return parts
}

/**
 * Compare two snapshots and report per-file line counts.
 *
 * Rename detection is disabled: a rename reported as one entry would leave the
 * old path absent from the change list, and undo would then restore the new
 * file without removing the old one. Treating it as delete+add keeps revert
 * total.
 */
export async function diffTrees(cwd: string, treeA: string, treeB: string): Promise<DiffSummary> {
  const empty: DiffSummary = { files: [], additions: 0, deletions: 0 }
  if (!treeA || !treeB) return empty

  // With --no-renames, `--numstat -z` emits one NUL-terminated record per
  // file: "additions \t deletions \t path". (The three-field form with the
  // path split across records only occurs for renames, which are disabled.)
  const num = await runGitText(cwd, ['diff', '--numstat', '-z', '--no-renames', treeA, treeB])
  if (!num.ok) return empty
  const stats = new Map<string, { additions: number; deletions: number; binary: boolean }>()
  for (const field of splitZ(num.out)) {
    const m = /^(-|\d+)\t(-|\d+)\t([\s\S]+)$/.exec(field)
    if (!m) continue
    const binary = m[1] === '-' || m[2] === '-'
    const path = m[3]
    stats.set(path, {
      additions: binary ? 0 : Number(m[1]) || 0,
      deletions: binary ? 0 : Number(m[2]) || 0,
      binary
    })
  }

  // --name-status -z emits: status NUL path NUL
  const names = await runGitText(cwd, ['diff', '--name-status', '-z', '--no-renames', treeA, treeB])
  const files: FileChange[] = []
  if (names.ok) {
    const fields = splitZ(names.out)
    for (let i = 0; i + 1 < fields.length; i += 2) {
      const code = fields[i].trim()
      const path = fields[i + 1]
      if (!path) continue
      const status: FileChangeStatus =
        code.startsWith('A') ? 'added' : code.startsWith('D') ? 'deleted' : 'modified'
      const s = stats.get(path) ?? { additions: 0, deletions: 0, binary: false }
      files.push({ path, status, additions: s.additions, deletions: s.deletions, binary: s.binary })
    }
  }

  return {
    files,
    additions: files.reduce((n, f) => n + f.additions, 0),
    deletions: files.reduce((n, f) => n + f.deletions, 0)
  }
}

/**
 * Reject paths that would write outside the repository.
 *
 * Paths reaching here originate from git itself, but this runs on the main
 * process with full disk access and reverts by writing to arbitrary paths, so
 * it validates rather than trusts. Absolute paths and any `..` traversal that
 * escapes the root are refused.
 */
export function isSafeRelativePath(cwd: string, path: string): boolean {
  if (!path || isAbsolute(path)) return false
  if (path.includes('\0')) return false
  const root = resolve(cwd)
  const target = resolve(root, normalize(path))
  return target !== root && (target.startsWith(root + sep))
}

/** Read a single blob out of a snapshot, or null when the path isn't in it. */
async function readBlob(cwd: string, tree: string, path: string): Promise<{ content: Buffer; mode: string } | null> {
  const ls = await runGitText(cwd, ['ls-tree', '-z', tree, '--', path])
  if (!ls.ok) return null
  const entry = splitZ(ls.out)[0]
  if (!entry) return null
  const m = /^(\d{6}) (blob|tree) ([0-9a-f]+)\t([\s\S]*)$/.exec(entry)
  if (!m || m[2] !== 'blob') return null
  const blob = await runGitRaw(cwd, ['cat-file', 'blob', m[3]])
  if (!blob.ok) return null
  return { content: blob.stdout, mode: m[1] }
}

export interface RevertResult {
  ok: boolean
  reverted: string[]
  failed: Array<{ path: string; reason: string }>
}

/**
 * Restore the given paths to their contents in `tree`.
 *
 * Only the listed paths are touched. A path absent from the snapshot was
 * created during the turn, so undoing it means deleting it.
 */
export async function revertPaths(cwd: string, tree: string, paths: string[]): Promise<RevertResult> {
  const reverted: string[] = []
  const failed: Array<{ path: string; reason: string }> = []
  if (!tree) return { ok: false, reverted, failed: paths.map((p) => ({ path: p, reason: 'no snapshot' })) }
  if (!(await isRepo(cwd))) {
    return { ok: false, reverted, failed: paths.map((p) => ({ path: p, reason: 'not a git repository' })) }
  }

  for (const path of paths) {
    if (!isSafeRelativePath(cwd, path)) {
      failed.push({ path, reason: 'unsafe path' })
      continue
    }
    const abs = resolve(cwd, path)
    try {
      const blob = await readBlob(cwd, tree, path)
      if (!blob) {
        // Created during the turn: undo removes it.
        try { await unlink(abs) } catch (e) {
          const code = (e as NodeJS.ErrnoException)?.code
          if (code !== 'ENOENT') throw e
        }
        reverted.push(path)
        continue
      }
      await mkdir(dirname(abs), { recursive: true })
      await writeFile(abs, blob.content)
      if (blob.mode === '100755') { try { await chmod(abs, 0o755) } catch {} }
      else if (blob.mode === '100644') { try { await chmod(abs, 0o644) } catch {} }
      reverted.push(path)
    } catch (e) {
      failed.push({ path, reason: String((e as Error)?.message ?? e) })
    }
  }

  return { ok: failed.length === 0, reverted, failed }
}

/** Read a file's text at a snapshot, for the diff view. Null when absent. */
export async function readFileAtTree(cwd: string, tree: string, path: string): Promise<string | null> {
  if (!tree || !isSafeRelativePath(cwd, path)) return null
  const blob = await readBlob(cwd, tree, path)
  if (!blob) return null
  return blob.content.toString('utf8')
}

/**
 * Individual files under `cwd` that git ignores.
 *
 * `snapshotTree` honours .gitignore, so anything ignored is invisible to the
 * git snapshot and would silently not be undoable. Listing these lets the
 * local-copy store cover exactly that gap.
 *
 * `--directory` collapses a wholly-ignored directory into one entry, which is
 * the difference between 6 results and 27,000 on a project with node_modules.
 * Those directory entries are then dropped rather than expanded: ignored
 * directories are build output and dependencies, which are large, reproducible,
 * and not what anyone means by "undo my last turn". Copying them would blow the
 * local snapshot's size budget and cost the user coverage of the small ignored
 * files — .env and friends — that they actually would want back.
 */
export async function listIgnoredFiles(cwd: string): Promise<string[]> {
  const res = await runGitText(cwd, ['ls-files', '-o', '-i', '--exclude-standard', '--directory', '-z'])
  if (!res.ok) return []
  return res.out
    .split('\0')
    .filter(Boolean)
    .filter((p) => !p.endsWith('/'))
}
