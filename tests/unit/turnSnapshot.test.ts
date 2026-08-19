import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  takeTurnSnapshot, diffTurnSnapshot, revertTurnSnapshot, readFileAtSnapshot, isEmptySnapshot
} from '../../src/main/turnSnapshot'
import { listIgnoredFiles } from '../../src/main/gitSnapshot'

// Real git repositories and real files. The whole point of this facade is that
// it papers over the seam between two mechanisms with genuinely different
// failure modes; a mock would let me assert my own idea of that seam rather
// than what git actually does with a .gitignore.

let root: string
let storeDir: string
const store = (): { dir: string } => ({ dir: storeDir })

const git = (...args: string[]): string =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' }
  })

const write = (rel: string, content: string): void => {
  const abs = join(root, rel)
  mkdirSync(join(abs, '..'), { recursive: true })
  writeFileSync(abs, content)
}

const initRepo = (): void => {
  git('init', '-q')
  git('config', 'user.email', 't@t')
  git('config', 'user.name', 't')
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 't42-turn-root-'))
  storeDir = mkdtempSync(join(tmpdir(), 't42-turn-store-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  rmSync(storeDir, { recursive: true, force: true })
})

describe('listIgnoredFiles', () => {
  it('lists ignored files but not ignored directories', async () => {
    initRepo()
    write('.gitignore', '.env\nnode_modules/\nbuild/\n')
    write('.env', 'SECRET=1')
    write('node_modules/pkg/index.js', 'x')
    write('build/out.js', 'x')
    git('add', '-A')
    git('commit', '-qm', 'init')

    const ignored = await listIgnoredFiles(root)
    expect(ignored).toContain('.env')
    // The directories are collapsed and dropped, not enumerated. Without this
    // a real project would try to copy every file in node_modules.
    expect(ignored.some((p) => p.startsWith('node_modules'))).toBe(false)
    expect(ignored.some((p) => p.startsWith('build'))).toBe(false)
  })

  it('returns empty for a non-repository instead of throwing', async () => {
    write('a.txt', 'x')
    expect(await listIgnoredFiles(root)).toEqual([])
  })
})

describe('takeTurnSnapshot', () => {
  it('uses git in a repository', async () => {
    initRepo()
    write('a.txt', 'one')
    git('add', '-A')
    git('commit', '-qm', 'init')

    const snap = await takeTurnSnapshot(store(), root)
    expect(snap?.git).toBeTruthy()
    // No ignored files, so no local copies were made at all.
    expect(snap?.local).toBeNull()
  })

  it('also captures ignored files in a repository', async () => {
    initRepo()
    write('.gitignore', '.env\n')
    write('.env', 'SECRET=1')
    write('a.txt', 'one')
    git('add', '-A')
    git('commit', '-qm', 'init')

    const snap = await takeTurnSnapshot(store(), root)
    expect(snap?.git).toBeTruthy()
    expect(snap?.local).toBeTruthy()
  })

  it('falls back to local copies outside a repository', async () => {
    write('a.txt', 'one')
    const snap = await takeTurnSnapshot(store(), root)
    expect(snap?.git).toBeNull()
    expect(snap?.local).toBeTruthy()
  })

  it('reports an empty snapshot as empty', () => {
    expect(isEmptySnapshot(null)).toBe(true)
    expect(isEmptySnapshot({ cwd: root, git: null, local: null })).toBe(true)
    expect(isEmptySnapshot({ cwd: root, git: 'abc', local: null })).toBe(false)
  })
})

describe('diffTurnSnapshot', () => {
  it('reports tracked changes via git', async () => {
    initRepo()
    write('a.txt', 'one')
    git('add', '-A')
    git('commit', '-qm', 'init')

    const snap = (await takeTurnSnapshot(store(), root))!
    write('a.txt', 'two')

    const d = await diffTurnSnapshot(store(), snap)
    expect(d.files.map((f) => f.path)).toEqual(['a.txt'])
    expect(d.files[0].status).toBe('modified')
  })

  it('reports ignored-file changes that git cannot see', async () => {
    initRepo()
    write('.gitignore', '.env\n')
    write('.env', 'SECRET=1')
    write('a.txt', 'one')
    git('add', '-A')
    git('commit', '-qm', 'init')

    const snap = (await takeTurnSnapshot(store(), root))!
    write('.env', 'SECRET=2')

    const d = await diffTurnSnapshot(store(), snap)
    // This is the entire point of the local layer: git reports nothing here.
    expect(d.files.map((f) => f.path)).toEqual(['.env'])
    expect(d.files[0].status).toBe('modified')
  })

  it('reports both mechanisms together, sorted and without duplicates', async () => {
    initRepo()
    write('.gitignore', '.env\n')
    write('.env', 'SECRET=1')
    write('z.txt', 'one')
    git('add', '-A')
    git('commit', '-qm', 'init')

    const snap = (await takeTurnSnapshot(store(), root))!
    write('.env', 'SECRET=2')
    write('z.txt', 'two')

    const d = await diffTurnSnapshot(store(), snap)
    expect(d.files.map((f) => f.path)).toEqual(['.env', 'z.txt'])
  })

  it('reports changes outside a repository', async () => {
    write('a.txt', 'one')
    const snap = (await takeTurnSnapshot(store(), root))!
    write('a.txt', 'two')
    write('b.txt', 'new')

    const d = await diffTurnSnapshot(store(), snap)
    expect(d.files.map((f) => f.path).sort()).toEqual(['a.txt', 'b.txt'])
  })

  it('reports nothing when nothing changed', async () => {
    initRepo()
    write('a.txt', 'one')
    git('add', '-A')
    git('commit', '-qm', 'init')
    const snap = (await takeTurnSnapshot(store(), root))!
    expect((await diffTurnSnapshot(store(), snap)).files).toEqual([])
  })
})

describe('revertTurnSnapshot', () => {
  it('restores a tracked file via git', async () => {
    initRepo()
    write('a.txt', 'one')
    git('add', '-A')
    git('commit', '-qm', 'init')

    const snap = (await takeTurnSnapshot(store(), root))!
    write('a.txt', 'two')

    const res = await revertTurnSnapshot(store(), snap, ['a.txt'])
    expect(res.ok).toBe(true)
    expect(readFileSync(join(root, 'a.txt'), 'utf8')).toBe('one')
  })

  it('restores an ignored file git could not', async () => {
    initRepo()
    write('.gitignore', '.env\n')
    write('.env', 'SECRET=1')
    git('add', '-A')
    git('commit', '-qm', 'init')

    const snap = (await takeTurnSnapshot(store(), root))!
    write('.env', 'SECRET=2')

    const res = await revertTurnSnapshot(store(), snap, ['.env'])
    expect(res.ok).toBe(true)
    expect(readFileSync(join(root, '.env'), 'utf8')).toBe('SECRET=1')
  })

  it('restores from both mechanisms in one call', async () => {
    initRepo()
    write('.gitignore', '.env\n')
    write('.env', 'SECRET=1')
    write('a.txt', 'one')
    git('add', '-A')
    git('commit', '-qm', 'init')

    const snap = (await takeTurnSnapshot(store(), root))!
    write('.env', 'SECRET=2')
    write('a.txt', 'two')

    const res = await revertTurnSnapshot(store(), snap, ['.env', 'a.txt'])
    expect(res.ok).toBe(true)
    expect(readFileSync(join(root, '.env'), 'utf8')).toBe('SECRET=1')
    expect(readFileSync(join(root, 'a.txt'), 'utf8')).toBe('one')
  })

  it('removes a file that did not exist at snapshot time', async () => {
    write('a.txt', 'one')
    const snap = (await takeTurnSnapshot(store(), root))!
    write('new.txt', 'created by the agent')

    const res = await revertTurnSnapshot(store(), snap, ['new.txt'])
    expect(res.ok).toBe(true)
    expect(existsSync(join(root, 'new.txt'))).toBe(false)
  })

  it('reports a file no snapshot covers rather than silently dropping it', async () => {
    initRepo()
    write('a.txt', 'one')
    git('add', '-A')
    git('commit', '-qm', 'init')
    const snap = (await takeTurnSnapshot(store(), root))!

    const res = await revertTurnSnapshot(store(), snap, ['../escape.txt'])
    expect(res.ok).toBe(false)
    expect(res.failed).toHaveLength(1)
    expect(res.reverted).toEqual([])
  })
})

describe('readFileAtSnapshot', () => {
  it('reads a tracked file from git', async () => {
    initRepo()
    write('a.txt', 'original')
    git('add', '-A')
    git('commit', '-qm', 'init')

    const snap = (await takeTurnSnapshot(store(), root))!
    write('a.txt', 'changed')
    expect(await readFileAtSnapshot(store(), snap, 'a.txt')).toBe('original')
  })

  it('reads an ignored file from the local store', async () => {
    initRepo()
    write('.gitignore', '.env\n')
    write('.env', 'SECRET=1')
    git('add', '-A')
    git('commit', '-qm', 'init')

    const snap = (await takeTurnSnapshot(store(), root))!
    write('.env', 'SECRET=2')
    expect(await readFileAtSnapshot(store(), snap, '.env')).toBe('SECRET=1')
  })

  it('returns null for a file neither mechanism holds', async () => {
    write('a.txt', 'one')
    const snap = (await takeTurnSnapshot(store(), root))!
    expect(await readFileAtSnapshot(store(), snap, 'never-existed.txt')).toBeNull()
  })
})
