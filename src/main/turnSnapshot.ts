// One undo interface over two very different snapshot mechanisms.
//
// Git does the heavy lifting: writing a tree object is close to free and it
// already understands the worktree. But it has two blind spots, and a user
// watching an agent edit their files does not care which of them applies:
//
//   * a folder that is not a repository gets no git snapshot at all;
//   * inside a repository, .gitignore hides files like .env from `git add -A`.
//
// So the facade layers a content-addressed local copy store underneath git and
// presents the union. `chat.ts` records one snapshot, asks for one diff, and
// calls one revert; which mechanism covered a given file is an implementation
// detail it never has to reason about.
//
// Coverage is deliberately not total. Ignored *directories* — node_modules,
// dist, build output — are excluded: they are large, reproducible, and nobody
// means them by "undo my last turn". Copying them would exhaust the local
// store's size budget and cost coverage of the small ignored files that people
// genuinely do want back.

import { snapshotTree, diffTrees, revertPaths, readFileAtTree, listIgnoredFiles, type DiffSummary, type FileChange } from './gitSnapshot'
import {
  snapshotLocal, diffLocal, revertLocal, readLocalFileAt, readManifest, SKIP_DIRS,
  type Store, type LocalChange
} from './localSnapshot'

export type TurnSnapshot = {
  cwd: string
  /** Git tree sha, when the folder is a repository. */
  git: string | null
  /** Local manifest id, covering whatever git could not. */
  local: string | null
}

/** True when nothing at all was captured, so no undo should be offered. */
export function isEmptySnapshot(s: TurnSnapshot | null): boolean {
  return !s || (!s.git && !s.local)
}

function underSkippedDir(rel: string): boolean {
  return rel.split(/[\\/]/).some((part) => SKIP_DIRS.has(part))
}

/**
 * Capture the state of `cwd` before a turn runs.
 *
 * Both mechanisms are attempted; either may come back null. Returns null only
 * when neither captured anything, which is the caller's signal to offer no
 * undo rather than a partial one.
 */
export async function takeTurnSnapshot(store: Store, cwd: string): Promise<TurnSnapshot | null> {
  const git = await snapshotTree(cwd)

  let local: string | null = null
  if (git) {
    // In a repository, the local store's only job is the ignored files git
    // just skipped. Scoped to that list, this is a handful of small files.
    const ignored = (await listIgnoredFiles(cwd)).filter((p) => !underSkippedDir(p))
    local = ignored.length > 0 ? await snapshotLocal(store, cwd, { only: ignored }) : null
  } else {
    // Not a repository: local copies are the only undo available.
    local = await snapshotLocal(store, cwd)
  }

  if (!git && !local) return null
  return { cwd, git, local }
}

/** Git reports `reason`, the local store `error`; the caller sees only `error`. */
function normalizeFailure(f: { path: string; reason: string }): { path: string; error: string } {
  return { path: f.path, error: f.reason }
}

function toFileChange(c: LocalChange): FileChange {
  return {
    path: c.path,
    status: c.status,
    additions: 0,
    deletions: 0,
    binary: false,
    // Surfaced so the card can decline to offer an undo for a file that was
    // too large to copy, instead of failing when the button is pressed.
    unrecoverable: c.unrecoverable ?? false
  }
}

/**
 * Everything that changed since the snapshot, from both mechanisms.
 *
 * Git wins on conflict: a path can only be reported by one of them in practice
 * (git ignores exactly what the local store captured), but if that ever stops
 * being true, the mechanism with real line counts is the better answer.
 */
export async function diffTurnSnapshot(store: Store, snap: TurnSnapshot): Promise<DiffSummary> {
  const files: FileChange[] = []
  let additions = 0
  let deletions = 0

  if (snap.git) {
    const after = await snapshotTree(snap.cwd)
    if (after && after !== snap.git) {
      const d = await diffTrees(snap.cwd, snap.git, after)
      files.push(...d.files)
      additions += d.additions
      deletions += d.deletions
    }
  }

  if (snap.local) {
    const seen = new Set(files.map((f) => f.path))
    for (const c of await diffLocal(store, snap.local)) {
      if (!seen.has(c.path)) files.push(toFileChange(c))
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path))
  return { files, additions, deletions }
}

/**
 * Restore `paths`, routing each to whichever mechanism owns it.
 *
 * Ownership is decided up front rather than by trying git and falling back.
 * Git cannot distinguish "this path is absent from the snapshot tree because
 * the agent created it" from "absent because .gitignore hid it" — and its
 * answer to the first is to delete the file. Handing it an ignored path would
 * therefore destroy a .env instead of restoring it, and report success. So a
 * path the local store captured goes to the local store, full stop.
 *
 * Paths neither mechanism owns are reported as failures rather than dropped,
 * so the UI can say exactly what it could not put back.
 */
export async function revertTurnSnapshot(
  store: Store,
  snap: TurnSnapshot,
  paths: string[]
): Promise<{ ok: boolean; reverted: string[]; failed: { path: string; error: string }[] }> {
  const reverted: string[] = []
  const failed: { path: string; error: string }[] = []

  const owned = new Set<string>()
  if (snap.local) {
    const manifest = await readManifest(store, snap.local)
    if (manifest) {
      for (const p of Object.keys(manifest.files)) owned.add(p)
      for (const p of manifest.skippedLarge) owned.add(p)
      // An unscoped snapshot is the sole mechanism for this folder, so it owns
      // everything — including paths absent from the manifest, which it
      // correctly understands as "created since, so remove".
      if (!manifest.scoped) {
        return revertLocal(store, snap.local, paths)
      }
    }
  }

  const toLocal = paths.filter((p) => owned.has(p))
  const toGit = paths.filter((p) => !owned.has(p))

  if (toGit.length > 0) {
    if (snap.git) {
      const res = await revertPaths(snap.cwd, snap.git, toGit)
      reverted.push(...res.reverted)
      failed.push(...res.failed.map(normalizeFailure))
    } else {
      failed.push(...toGit.map((p) => ({ path: p, error: 'No snapshot covered this file.' })))
    }
  }

  if (toLocal.length > 0 && snap.local) {
    const res = await revertLocal(store, snap.local, toLocal)
    reverted.push(...res.reverted)
    failed.push(...res.failed)
  }

  return { ok: failed.length === 0, reverted, failed }
}

/** File contents as of the snapshot, from whichever mechanism holds them. */
export async function readFileAtSnapshot(
  store: Store,
  snap: TurnSnapshot,
  path: string
): Promise<string | null> {
  if (snap.git) {
    const fromGit = await readFileAtTree(snap.cwd, snap.git, path)
    if (fromGit !== null) return fromGit
  }
  if (snap.local) {
    const buf = await readLocalFileAt(store, snap.local, path)
    if (buf) return buf.toString('utf8')
  }
  return null
}
