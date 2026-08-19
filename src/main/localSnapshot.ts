// Undo coverage for everything git cannot give us.
//
// The git snapshotter is the primary mechanism and stays that way: it is
// cheap, atomic, and already understands the worktree. But it has two holes
// that matter to a user who just watched an agent change their files:
//
//   1. A folder that is not a git repository gets no undo at all.
//   2. Inside a repository, `git add -A` honours .gitignore, so files like
//      .env or a build output the agent rewrote are invisible to it.
//
// This module fills both by keeping content-addressed copies of files
// alongside the app's own data. It is deliberately a *fallback*: copying bytes
// is far more expensive than writing a git tree, so it runs only over the set
// git will not cover, and it refuses to run at all rather than crawl something
// pathological.
//
// The refusal is the important part. A snapshotter that silently gives up
// halfway would offer an Undo button that restores some of a turn's changes
// and not others, which is worse than no button. Every limit here returns an
// explicit "no snapshot", and the caller is expected to show no Undo.

import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile, stat, rm, access } from 'node:fs/promises'
import { constants as FS, type Dirent } from 'node:fs'
import { join, relative, sep, dirname } from 'node:path'

/**
 * Directories never worth copying: either enormous, reproducible from a
 * manifest, or owned by another tool. Skipping them is what keeps a local
 * snapshot affordable on a real project.
 */
export const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.venv',
  'venv',
  '__pycache__',
  '.cache',
  '.turbo',
  '.parcel-cache',
  '.gradle',
  '.pnpm-store',
  'coverage',
  '.terraform',
  'Pods',
  '.DS_Store'
])

/** Refuse rather than crawl: a project past any of these gets no local undo. */
export const LIMITS = {
  /** Individual files above this are left out of the manifest entirely. */
  maxFileBytes: 4 * 1024 * 1024,
  /** Total bytes copied for one snapshot. */
  maxTotalBytes: 64 * 1024 * 1024,
  /** Number of files in one snapshot. */
  maxFiles: 4000
}

export type LocalManifest = {
  id: string
  root: string
  createdAt: number
  /** relative path -> sha256 of contents */
  files: Record<string, string>
  /**
   * Paths deliberately not captured because they exceeded maxFileBytes. Kept
   * so a diff can report them as changed-but-not-undoable instead of pretending
   * they were unchanged.
   */
  skippedLarge: string[]
  /**
   * When the snapshot covered an explicit path list (the git-repo case, where
   * we only capture ignored files) rather than a full walk of the root.
   *
   * The diff has to know: a scoped snapshot must compare only those paths, or
   * every ordinary tracked file in the project would be reported as "added"
   * simply because it was never in the manifest.
   */
  scoped: boolean
}

export type LocalChange = {
  path: string
  status: 'added' | 'modified' | 'deleted'
  /** True when the file was too large to capture, so it cannot be reverted. */
  unrecoverable?: boolean
}

/** Where blobs and manifests live, e.g. <userData>/undo-snapshots. */
export type Store = { dir: string }

function objectPath(store: Store, hash: string): string {
  return join(store.dir, 'objects', hash.slice(0, 2), hash.slice(2))
}

function manifestPath(store: Store, id: string): string {
  return join(store.dir, 'manifests', `${id}.json`)
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, FS.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Every file under `root` worth snapshotting.
 *
 * `only` restricts the walk to an explicit set of relative paths, which is how
 * the git-repo case stays cheap: we pass exactly the ignored files rather than
 * walking the tree. Returns null when a limit is hit.
 */
async function collectFiles(
  root: string,
  only: string[] | null
): Promise<{ paths: string[]; skippedLarge: string[] } | null> {
  const paths: string[] = []
  const skippedLarge: string[] = []
  let totalBytes = 0

  const consider = async (rel: string): Promise<boolean> => {
    let size: number
    try {
      const st = await stat(join(root, rel))
      if (!st.isFile()) return true
      size = st.size
    } catch {
      return true
    }
    if (size > LIMITS.maxFileBytes) {
      skippedLarge.push(rel)
      return true
    }
    totalBytes += size
    if (totalBytes > LIMITS.maxTotalBytes) return false
    paths.push(rel)
    return paths.length <= LIMITS.maxFiles
  }

  if (only) {
    for (const rel of only) {
      if (!isSafeRelative(rel)) continue
      if (!(await consider(rel))) return null
    }
    return { paths, skippedLarge }
  }

  const walk = async (dir: string): Promise<boolean> => {
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return true
    }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue
      const abs = join(dir, e.name)
      if (e.isSymbolicLink()) continue
      if (e.isDirectory()) {
        if (!(await walk(abs))) return false
      } else if (e.isFile()) {
        if (!(await consider(relative(root, abs)))) return false
      }
    }
    return true
  }

  if (!(await walk(root))) return null
  return { paths, skippedLarge }
}

/**
 * Copy the current contents of `root` into the store and return a manifest id.
 *
 * Returns null when the project is too large to capture, so the caller can
 * decline to offer an undo rather than offer a partial one.
 */
export async function snapshotLocal(
  store: Store,
  root: string,
  opts: { only?: string[] | null; id?: string } = {}
): Promise<string | null> {
  const collected = await collectFiles(root, opts.only ?? null)
  if (!collected) return null

  const files: Record<string, string> = {}
  for (const rel of collected.paths) {
    try {
      const buf = await readFile(join(root, rel))
      const hash = sha256(buf)
      files[rel] = hash
      const dest = objectPath(store, hash)
      // Content addressed, so an identical blob from an earlier turn is reused
      // and the same file surviving many turns is stored once.
      if (!(await exists(dest))) {
        await mkdir(dirname(dest), { recursive: true })
        await writeFile(dest, buf)
      }
    } catch {
      // Unreadable file: leave it out. It will simply not be undoable.
    }
  }

  const id = opts.id ?? createHash('sha256').update(`${root}:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 32)
  const manifest: LocalManifest = {
    id,
    root,
    createdAt: Date.now(),
    files,
    skippedLarge: collected.skippedLarge,
    scoped: !!opts.only
  }
  const mp = manifestPath(store, id)
  await mkdir(dirname(mp), { recursive: true })
  await writeFile(mp, JSON.stringify(manifest), 'utf8')
  return id
}

export async function readManifest(store: Store, id: string): Promise<LocalManifest | null> {
  try {
    return JSON.parse(await readFile(manifestPath(store, id), 'utf8')) as LocalManifest
  } catch {
    return null
  }
}

/**
 * What changed under `root` since the snapshot.
 *
 * Compares content hashes rather than mtimes: an agent that rewrites a file
 * with identical content has not changed anything the user needs to undo, and
 * showing it as changed would make the diff card untrustworthy.
 */
export async function diffLocal(store: Store, id: string): Promise<LocalChange[]> {
  const manifest = await readManifest(store, id)
  if (!manifest) return []

  // A scoped snapshot is re-examined over exactly the paths it captured, plus
  // the large ones it declined; a full snapshot re-walks the root so that files
  // the turn created are seen too.
  const current = manifest.scoped
    ? await collectFiles(manifest.root, [...Object.keys(manifest.files), ...manifest.skippedLarge])
    : await collectFiles(manifest.root, null)
  const changes: LocalChange[] = []
  const seen = new Set<string>()

  const currentPaths = current?.paths ?? []
  for (const rel of currentPaths) {
    seen.add(rel)
    let hash: string
    try {
      hash = sha256(await readFile(join(manifest.root, rel)))
    } catch {
      continue
    }
    const before = manifest.files[rel]
    if (before === undefined) changes.push({ path: rel, status: 'added' })
    else if (before !== hash) changes.push({ path: rel, status: 'modified' })
  }

  for (const rel of Object.keys(manifest.files)) {
    if (!seen.has(rel)) changes.push({ path: rel, status: 'deleted' })
  }

  for (const rel of manifest.skippedLarge) {
    if (!seen.has(rel)) continue
    changes.push({ path: rel, status: 'modified', unrecoverable: true })
  }

  changes.sort((a, b) => a.path.localeCompare(b.path))
  return changes
}

/**
 * Restore `paths` to their snapshot contents.
 *
 * Scoped to the paths given, so edits the user made by hand to other files
 * while the agent worked are untouched. A path absent from the snapshot did
 * not exist then, so it is deleted now.
 */
export async function revertLocal(
  store: Store,
  id: string,
  paths: string[]
): Promise<{ ok: boolean; reverted: string[]; failed: { path: string; error: string }[] }> {
  const manifest = await readManifest(store, id)
  if (!manifest) {
    return { ok: false, reverted: [], failed: paths.map((p) => ({ path: p, error: 'No snapshot recorded.' })) }
  }

  const reverted: string[] = []
  const failed: { path: string; error: string }[] = []

  for (const rel of paths) {
    if (!isSafeRelative(rel)) {
      failed.push({ path: rel, error: 'Unsafe path.' })
      continue
    }
    const abs = join(manifest.root, rel)
    const hash = manifest.files[rel]
    try {
      if (hash === undefined) {
        if (manifest.skippedLarge.includes(rel)) {
          failed.push({ path: rel, error: 'File was too large to snapshot.' })
          continue
        }
        // Absent from the snapshot: the turn created it, so undo removes it.
        await rm(abs, { force: true })
        reverted.push(rel)
        continue
      }
      const buf = await readFile(objectPath(store, hash))
      await mkdir(dirname(abs), { recursive: true })
      await writeFile(abs, buf)
      reverted.push(rel)
    } catch (e) {
      failed.push({ path: rel, error: String((e as Error)?.message ?? e) })
    }
  }

  return { ok: failed.length === 0, reverted, failed }
}

/** Contents of one file as of the snapshot, or null if it did not exist. */
export async function readLocalFileAt(store: Store, id: string, path: string): Promise<Buffer | null> {
  const manifest = await readManifest(store, id)
  if (!manifest || !isSafeRelative(path)) return null
  const hash = manifest.files[path]
  if (!hash) return null
  try {
    return await readFile(objectPath(store, hash))
  } catch {
    return null
  }
}

/**
 * Relative, inside the root, no traversal.
 *
 * Checked on the way in *and* on the way out: these paths reach `writeFile`,
 * so a `../` that slipped through would let a manifest write anywhere on disk.
 */
export function isSafeRelative(p: string): boolean {
  if (!p || p.startsWith('/') || p.startsWith('\\')) return false
  if (/^[a-zA-Z]:/.test(p)) return false
  const parts = p.split(/[\\/]/)
  return !parts.some((part) => part === '..' || part === '.')
}

/**
 * Delete manifests older than `keepMs`, and any blob no live manifest still
 * references. Without this the store grows by the size of the project on every
 * turn that touches an ignored file.
 */
export async function pruneStore(store: Store, keepMs: number, now: number = Date.now()): Promise<void> {
  const mdir = join(store.dir, 'manifests')
  let ids: string[]
  try {
    ids = (await readdir(mdir)).filter((f) => f.endsWith('.json'))
  } catch {
    return
  }

  const live = new Set<string>()
  for (const file of ids) {
    const id = file.replace(/\.json$/, '')
    const m = await readManifest(store, id)
    if (!m) continue
    if (now - m.createdAt > keepMs) {
      await rm(manifestPath(store, id), { force: true })
      continue
    }
    for (const hash of Object.values(m.files)) live.add(hash)
  }

  const odir = join(store.dir, 'objects')
  let shards: string[]
  try {
    shards = await readdir(odir)
  } catch {
    return
  }
  for (const shard of shards) {
    let blobs: string[]
    try {
      blobs = await readdir(join(odir, shard))
    } catch {
      continue
    }
    for (const blob of blobs) {
      if (!live.has(shard + blob)) await rm(join(odir, shard, blob), { force: true })
    }
  }
}

/** Exposed for the caller that needs to join a root and a checked path. */
export function safeJoin(root: string, rel: string): string | null {
  if (!isSafeRelative(rel)) return null
  const abs = join(root, rel)
  return abs === root || abs.startsWith(root + sep) ? abs : null
}
