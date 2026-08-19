import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

// node:sqlite rather than better-sqlite3: the installed better-sqlite3 binary is
// compiled against Electron's ABI and cannot load under the test runner's Node.
// Routed through createRequire because Vite's import analysis does not resolve
// this builtin.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void
    prepare(sql: string): { run(...a: unknown[]): unknown; get(...a: unknown[]): unknown; all(...a: unknown[]): unknown[] }
    close(): void
  }
}
type Db = InstanceType<typeof DatabaseSync>

// The snapshot/diff/revert primitives are covered exhaustively in
// gitSnapshot.test.ts. What these tests cover is the seam above them in
// chat.ts, which is where a mistake actually destroys someone's work: that
// undo reverts through the *recorded* file list against the *recorded*
// snapshot, refuses to run twice, and that the file-diff reader cannot be
// talked into reading a file the turn never touched.
//
// Driven through the real IPC handlers rather than by exporting the private
// functions, so the registration wiring is covered too.

const handlers = new Map<string, (e: unknown, ...args: never[]) => unknown>()
let db: Db

vi.mock('electron', () => ({
  BrowserWindow: class {},
  ipcMain: {
    handle: (channel: string, fn: (e: unknown, ...args: never[]) => unknown) => {
      handlers.set(channel, fn)
    },
    on: () => {}
  }
}))
vi.mock('../../src/main/db', () => ({ getDb: () => db }))
vi.mock('../../src/main/models', () => ({ resolveModel: () => ({ id: 'test', label: 'test' }) }))
vi.mock('../../src/main/memoryContext', () => ({ buildMemoryContext: async () => '' }))
vi.mock('../../src/main/sessionInsights', () => ({ recordMemoryUse: () => {} }))

const { registerChatIpc } = await import('../../src/main/chat')

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@e', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@e' }
  })
}

let repo: string

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 't42-chatdiff-'))
  git(dir, 'init', '-q', '-b', 'main')
  writeFileSync(join(dir, 'app.ts'), 'original\n')
  writeFileSync(join(dir, 'untouched.ts'), 'keep me\n')
  git(dir, 'add', '-A')
  git(dir, 'commit', '-qm', 'init')
  return dir
}

/** Mirrors what chat.ts stores on the assistant row when a turn ends. */
async function recordTurn(id: string, cwd: string, before: string, files: string[]): Promise<void> {
  const { diffTrees, snapshotTree } = await import('../../src/main/gitSnapshot')
  const after = await snapshotTree(cwd)
  const diff = await diffTrees(cwd, before, after!)
  db.prepare('UPDATE chat_messages SET snapshot_tree = ?, diff_json = ?, diff_cwd = ? WHERE id = ?').run(
    before,
    JSON.stringify(files.length ? { ...diff, files: diff.files.filter((f) => files.includes(f.path)) } : diff),
    cwd,
    id
  )
}

function insertMessage(id: string): void {
  db.prepare(
    `INSERT INTO chat_messages (id, session_id, role, content, tool_calls, status, created_at, undone)
     VALUES (?, 's1', 'assistant', 'done', NULL, 'complete', 1, 0)`
  ).run(id)
}

const undo = (id: string): Promise<{ ok: boolean; reverted: string[]; error?: string }> =>
  handlers.get('chat:undo')!(null, id as never) as Promise<{ ok: boolean; reverted: string[]; error?: string }>

const fileDiff = (
  messageId: string,
  path: string
): Promise<{ ok: boolean; before: string | null; after: string | null; error?: string }> =>
  handlers.get('chat:fileDiff')!(null, { messageId, path } as never) as Promise<{
    ok: boolean
    before: string | null
    after: string | null
    error?: string
  }>

beforeEach(() => {
  handlers.clear()
  db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY, session_id TEXT, role TEXT, content TEXT, tool_calls TEXT,
    status TEXT, created_at INTEGER, snapshot_tree TEXT, diff_json TEXT,
    diff_cwd TEXT, undone INTEGER DEFAULT 0)`)
  registerChatIpc(() => null)
  repo = makeRepo()
})

afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
  db.close()
})

describe('chat:undo', () => {
  it('restores a file the turn modified', async () => {
    const { snapshotTree } = await import('../../src/main/gitSnapshot')
    const before = (await snapshotTree(repo))!
    insertMessage('m1')
    writeFileSync(join(repo, 'app.ts'), 'agent rewrote this\n')
    await recordTurn('m1', repo, before, [])

    const res = await undo('m1')
    expect(res.ok).toBe(true)
    expect(res.reverted).toContain('app.ts')
    expect(readFileSync(join(repo, 'app.ts'), 'utf8')).toBe('original\n')
  })

  it('leaves edits the user made outside the turn alone', async () => {
    const { snapshotTree } = await import('../../src/main/gitSnapshot')
    const before = (await snapshotTree(repo))!
    insertMessage('m1')
    writeFileSync(join(repo, 'app.ts'), 'agent rewrote this\n')
    // Recorded diff covers only app.ts; the user then edits another file.
    await recordTurn('m1', repo, before, ['app.ts'])
    writeFileSync(join(repo, 'untouched.ts'), 'my own hand-edit\n')

    await undo('m1')
    expect(readFileSync(join(repo, 'untouched.ts'), 'utf8')).toBe('my own hand-edit\n')
    expect(readFileSync(join(repo, 'app.ts'), 'utf8')).toBe('original\n')
  })

  it('deletes a file the turn created', async () => {
    const { snapshotTree } = await import('../../src/main/gitSnapshot')
    const before = (await snapshotTree(repo))!
    insertMessage('m1')
    writeFileSync(join(repo, 'brand-new.ts'), 'added by agent\n')
    await recordTurn('m1', repo, before, [])

    await undo('m1')
    expect(existsSync(join(repo, 'brand-new.ts'))).toBe(false)
  })

  it('recreates a file the turn deleted', async () => {
    const { snapshotTree } = await import('../../src/main/gitSnapshot')
    const before = (await snapshotTree(repo))!
    insertMessage('m1')
    rmSync(join(repo, 'app.ts'))
    await recordTurn('m1', repo, before, [])

    await undo('m1')
    expect(readFileSync(join(repo, 'app.ts'), 'utf8')).toBe('original\n')
  })

  it('restores a nested file, recreating its directory', async () => {
    const { snapshotTree } = await import('../../src/main/gitSnapshot')
    mkdirSync(join(repo, 'src', 'deep'), { recursive: true })
    writeFileSync(join(repo, 'src', 'deep', 'x.ts'), 'v1\n')
    git(repo, 'add', '-A')
    git(repo, 'commit', '-qm', 'nested')
    const before = (await snapshotTree(repo))!
    insertMessage('m1')
    rmSync(join(repo, 'src'), { recursive: true })
    await recordTurn('m1', repo, before, [])

    await undo('m1')
    expect(readFileSync(join(repo, 'src', 'deep', 'x.ts'), 'utf8')).toBe('v1\n')
  })

  it('refuses a second undo rather than reverting against a stale snapshot', async () => {
    const { snapshotTree } = await import('../../src/main/gitSnapshot')
    const before = (await snapshotTree(repo))!
    insertMessage('m1')
    writeFileSync(join(repo, 'app.ts'), 'agent rewrote this\n')
    await recordTurn('m1', repo, before, [])

    expect((await undo('m1')).ok).toBe(true)
    // The user then makes their own change to the same file.
    writeFileSync(join(repo, 'app.ts'), 'user work after undo\n')

    const second = await undo('m1')
    expect(second.ok).toBe(false)
    expect(second.error).toMatch(/already undone/i)
    expect(readFileSync(join(repo, 'app.ts'), 'utf8')).toBe('user work after undo\n')
  })

  it('reports a clear error when no snapshot was recorded', async () => {
    insertMessage('m1')
    const res = await undo('m1')
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/no snapshot/i)
  })

  it('reports a clear error for an unknown message', async () => {
    const res = await undo('nope')
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/not found/i)
  })

  it('marks the row undone so reloaded history shows it', async () => {
    const { snapshotTree } = await import('../../src/main/gitSnapshot')
    const before = (await snapshotTree(repo))!
    insertMessage('m1')
    writeFileSync(join(repo, 'app.ts'), 'changed\n')
    await recordTurn('m1', repo, before, [])
    await undo('m1')

    const row = db.prepare('SELECT undone FROM chat_messages WHERE id = ?').get('m1') as { undone: number }
    expect(row.undone).toBe(1)
  })
})

describe('chat:fileDiff', () => {
  it('returns before and after contents for a changed file', async () => {
    const { snapshotTree } = await import('../../src/main/gitSnapshot')
    const before = (await snapshotTree(repo))!
    insertMessage('m1')
    writeFileSync(join(repo, 'app.ts'), 'rewritten\n')
    await recordTurn('m1', repo, before, [])

    const res = await fileDiff('m1', 'app.ts')
    expect(res.ok).toBe(true)
    expect(res.before).toBe('original\n')
    expect(res.after).toBe('rewritten\n')
  })

  it('refuses a file the turn never touched', async () => {
    const { snapshotTree } = await import('../../src/main/gitSnapshot')
    const before = (await snapshotTree(repo))!
    insertMessage('m1')
    writeFileSync(join(repo, 'app.ts'), 'rewritten\n')
    await recordTurn('m1', repo, before, ['app.ts'])

    const res = await fileDiff('m1', 'untouched.ts')
    expect(res.ok).toBe(false)
    expect(res.after).toBeNull()
  })

  it('refuses a traversal path outside the repository', async () => {
    const { snapshotTree } = await import('../../src/main/gitSnapshot')
    const before = (await snapshotTree(repo))!
    insertMessage('m1')
    writeFileSync(join(repo, 'app.ts'), 'rewritten\n')
    await recordTurn('m1', repo, before, [])

    const res = await fileDiff('m1', '../../../../etc/passwd')
    expect(res.ok).toBe(false)
    expect(res.after).toBeNull()
  })

  it('returns null before-content for a file the turn created', async () => {
    const { snapshotTree } = await import('../../src/main/gitSnapshot')
    const before = (await snapshotTree(repo))!
    insertMessage('m1')
    writeFileSync(join(repo, 'fresh.ts'), 'brand new\n')
    await recordTurn('m1', repo, before, [])

    const res = await fileDiff('m1', 'fresh.ts')
    expect(res.ok).toBe(true)
    expect(res.before).toBeNull()
    expect(res.after).toBe('brand new\n')
  })

  it('declines binary files instead of returning mojibake', async () => {
    const { snapshotTree } = await import('../../src/main/gitSnapshot')
    const before = (await snapshotTree(repo))!
    insertMessage('m1')
    writeFileSync(join(repo, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x00, 0xff]))
    await recordTurn('m1', repo, before, [])

    const res = await fileDiff('m1', 'logo.png')
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/binary/i)
  })
})
