// Exercises gitSnapshot against real temporary repositories.
//
// These deliberately shell out to real git rather than mocking it: the entire
// value of the module is that `git add -A` into a scratch index leaves the
// user's index alone, and a mock would just assert our own assumptions back at
// us. The invisibility guarantee is only meaningful if a real git verifies it.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  snapshotTree, diffTrees, revertPaths, readFileAtTree, isSafeRelativePath, isRepo
} from '../../src/main/gitSnapshot'

let repo: string

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' })
}

function write(rel: string, body: string): void {
  const abs = join(repo, rel)
  mkdirSync(join(abs, '..'), { recursive: true })
  writeFileSync(abs, body)
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 't42-gittest-'))
  git('init', '-q')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  write('a.txt', 'one\ntwo\nthree\n')
  write('keep.txt', 'untouched\n')
  git('add', '-A')
  git('commit', '-qm', 'initial')
})

afterEach(() => {
  try { rmSync(repo, { recursive: true, force: true }) } catch {}
})

describe('snapshotTree', () => {
  it('returns a tree sha inside a repository', async () => {
    const sha = await snapshotTree(repo)
    expect(sha).toMatch(/^[0-9a-f]{40,64}$/)
  })

  it('returns null outside a repository', async () => {
    const plain = mkdtempSync(join(tmpdir(), 't42-plain-'))
    try {
      expect(await isRepo(plain)).toBe(false)
      expect(await snapshotTree(plain)).toBeNull()
    } finally {
      rmSync(plain, { recursive: true, force: true })
    }
  })

  // The guarantee that makes it safe to snapshot before every single turn.
  it('leaves the real index untouched', async () => {
    write('staged.txt', 'staged\n')
    git('add', 'staged.txt')
    write('unstaged.txt', 'unstaged\n')
    const before = git('status', '--porcelain')

    await snapshotTree(repo)

    expect(git('status', '--porcelain')).toBe(before)
  })

  it('does not modify the worktree or HEAD', async () => {
    write('b.txt', 'new file\n')
    const head = git('rev-parse', 'HEAD').trim()

    await snapshotTree(repo)

    expect(git('rev-parse', 'HEAD').trim()).toBe(head)
    expect(readFileSync(join(repo, 'b.txt'), 'utf8')).toBe('new file\n')
    expect(readFileSync(join(repo, 'a.txt'), 'utf8')).toBe('one\ntwo\nthree\n')
  })

  it('does not create a stash entry', async () => {
    write('b.txt', 'new\n')
    await snapshotTree(repo)
    expect(git('stash', 'list').trim()).toBe('')
  })

  it('captures untracked files so they can be undone', async () => {
    const before = await snapshotTree(repo)
    write('fresh.txt', 'created by agent\n')
    const after = await snapshotTree(repo)
    const diff = await diffTrees(repo, before!, after!)
    expect(diff.files.map((f) => f.path)).toContain('fresh.txt')
  })

  it('ignores paths excluded by .gitignore', async () => {
    write('.gitignore', 'ignored/\n')
    git('add', '-A'); git('commit', '-qm', 'ignore')
    const before = await snapshotTree(repo)
    write('ignored/blob.txt', 'build output\n')
    const after = await snapshotTree(repo)
    const diff = await diffTrees(repo, before!, after!)
    expect(diff.files).toHaveLength(0)
  })
})

describe('diffTrees', () => {
  it('reports additions, modifications and deletions with line counts', async () => {
    const before = await snapshotTree(repo)
    write('a.txt', 'one\ntwo\nthree\nfour\n')
    write('added.txt', 'x\ny\n')
    rmSync(join(repo, 'keep.txt'))
    const after = await snapshotTree(repo)

    const diff = await diffTrees(repo, before!, after!)
    const byPath = Object.fromEntries(diff.files.map((f) => [f.path, f]))

    expect(diff.files).toHaveLength(3)
    expect(byPath['a.txt']).toMatchObject({ status: 'modified', additions: 1, deletions: 0 })
    expect(byPath['added.txt']).toMatchObject({ status: 'added', additions: 2, deletions: 0 })
    expect(byPath['keep.txt']).toMatchObject({ status: 'deleted', additions: 0, deletions: 1 })
    expect(diff.additions).toBe(3)
    expect(diff.deletions).toBe(1)
  })

  it('reports no changes when nothing happened', async () => {
    const before = await snapshotTree(repo)
    const after = await snapshotTree(repo)
    const diff = await diffTrees(repo, before!, after!)
    expect(diff).toEqual({ files: [], additions: 0, deletions: 0 })
  })

  it('marks binary files without inventing line counts', async () => {
    const before = await snapshotTree(repo)
    writeFileSync(join(repo, 'blob.bin'), Buffer.from([0, 1, 2, 0, 255, 254]))
    const after = await snapshotTree(repo)
    const diff = await diffTrees(repo, before!, after!)
    const bin = diff.files.find((f) => f.path === 'blob.bin')
    expect(bin).toMatchObject({ binary: true, additions: 0, deletions: 0 })
  })

  it('handles paths with spaces and non-ascii characters', async () => {
    const before = await snapshotTree(repo)
    write('dir with space/café ☕.txt', 'hi\n')
    const after = await snapshotTree(repo)
    const diff = await diffTrees(repo, before!, after!)
    expect(diff.files.map((f) => f.path)).toContain('dir with space/café ☕.txt')
  })

  // A rename reported as a single entry would leave the old path out of the
  // change list, so undo would restore the new file and orphan the old one.
  it('treats a rename as a delete plus an add', async () => {
    const before = await snapshotTree(repo)
    git('mv', 'a.txt', 'renamed.txt')
    const after = await snapshotTree(repo)
    const diff = await diffTrees(repo, before!, after!)
    const paths = diff.files.map((f) => f.path).sort()
    expect(paths).toEqual(['a.txt', 'renamed.txt'])
  })
})

describe('revertPaths', () => {
  it('restores a modified file to its snapshot content', async () => {
    const before = await snapshotTree(repo)
    write('a.txt', 'totally different\n')

    const res = await revertPaths(repo, before!, ['a.txt'])

    expect(res.ok).toBe(true)
    expect(readFileSync(join(repo, 'a.txt'), 'utf8')).toBe('one\ntwo\nthree\n')
  })

  it('deletes a file that did not exist in the snapshot', async () => {
    const before = await snapshotTree(repo)
    write('new.txt', 'created during the turn\n')

    await revertPaths(repo, before!, ['new.txt'])

    expect(existsSync(join(repo, 'new.txt'))).toBe(false)
  })

  it('recreates a file the turn deleted', async () => {
    const before = await snapshotTree(repo)
    rmSync(join(repo, 'keep.txt'))

    await revertPaths(repo, before!, ['keep.txt'])

    expect(readFileSync(join(repo, 'keep.txt'), 'utf8')).toBe('untouched\n')
  })

  // The reason undo is path-scoped instead of `git checkout .`.
  it('leaves files outside the change list alone', async () => {
    const before = await snapshotTree(repo)
    write('a.txt', 'agent edit\n')
    write('keep.txt', 'MY OWN EDIT WHILE THE AGENT WORKED\n')

    await revertPaths(repo, before!, ['a.txt'])

    expect(readFileSync(join(repo, 'a.txt'), 'utf8')).toBe('one\ntwo\nthree\n')
    expect(readFileSync(join(repo, 'keep.txt'), 'utf8')).toBe('MY OWN EDIT WHILE THE AGENT WORKED\n')
  })

  it('restores binary content byte-for-byte', async () => {
    const bytes = Buffer.from([0, 159, 146, 150, 255, 0, 13, 10])
    writeFileSync(join(repo, 'img.bin'), bytes)
    const before = await snapshotTree(repo)
    writeFileSync(join(repo, 'img.bin'), Buffer.from('clobbered'))

    await revertPaths(repo, before!, ['img.bin'])

    expect(readFileSync(join(repo, 'img.bin')).equals(bytes)).toBe(true)
  })

  it('restores nested files, recreating missing directories', async () => {
    write('deep/nested/file.txt', 'original\n')
    const before = await snapshotTree(repo)
    rmSync(join(repo, 'deep'), { recursive: true })

    await revertPaths(repo, before!, ['deep/nested/file.txt'])

    expect(readFileSync(join(repo, 'deep/nested/file.txt'), 'utf8')).toBe('original\n')
  })

  it('preserves the executable bit', async () => {
    write('run.sh', '#!/bin/sh\necho hi\n')
    execFileSync('chmod', ['755', join(repo, 'run.sh')])
    const before = await snapshotTree(repo)
    write('run.sh', 'clobbered\n')
    execFileSync('chmod', ['644', join(repo, 'run.sh')])

    await revertPaths(repo, before!, ['run.sh'])

    const mode = execFileSync('stat', ['-f', '%Lp', join(repo, 'run.sh')], { encoding: 'utf8' }).trim()
    expect(mode).toBe('755')
  })

  it('refuses to write outside the repository', async () => {
    const before = await snapshotTree(repo)
    const res = await revertPaths(repo, before!, ['../escape.txt', '/etc/passwd'])
    expect(res.ok).toBe(false)
    expect(res.reverted).toEqual([])
    expect(res.failed.map((f) => f.reason)).toEqual(['unsafe path', 'unsafe path'])
  })

  it('reports failure rather than throwing without a snapshot', async () => {
    const res = await revertPaths(repo, '', ['a.txt'])
    expect(res.ok).toBe(false)
    expect(res.failed[0].reason).toBe('no snapshot')
  })
})

describe('isSafeRelativePath', () => {
  it('accepts ordinary relative paths', () => {
    expect(isSafeRelativePath('/tmp/repo', 'src/index.ts')).toBe(true)
    expect(isSafeRelativePath('/tmp/repo', 'a.txt')).toBe(true)
  })

  it('rejects absolute paths, traversal, and the root itself', () => {
    expect(isSafeRelativePath('/tmp/repo', '/etc/passwd')).toBe(false)
    expect(isSafeRelativePath('/tmp/repo', '../outside.txt')).toBe(false)
    expect(isSafeRelativePath('/tmp/repo', 'src/../../outside.txt')).toBe(false)
    expect(isSafeRelativePath('/tmp/repo', '')).toBe(false)
    expect(isSafeRelativePath('/tmp/repo', '.')).toBe(false)
  })

  // A sibling directory sharing a name prefix must not pass a naive
  // startsWith check.
  it('rejects a sibling directory with a shared prefix', () => {
    expect(isSafeRelativePath('/tmp/repo', '../repo-evil/x.txt')).toBe(false)
  })
})

describe('readFileAtTree', () => {
  it('reads content as it was at the snapshot', async () => {
    const before = await snapshotTree(repo)
    write('a.txt', 'changed\n')
    expect(await readFileAtTree(repo, before!, 'a.txt')).toBe('one\ntwo\nthree\n')
  })

  it('returns null for a path absent from the snapshot', async () => {
    const before = await snapshotTree(repo)
    expect(await readFileAtTree(repo, before!, 'nope.txt')).toBeNull()
  })
})
