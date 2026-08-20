import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { snapshotTree } from '../../src/main/gitSnapshot'

// A session can be opened on any folder, including a home directory or a
// Desktop that happens to be a git repo holding tens of gigabytes. Staging
// that on every turn hashes the whole tree, which does not fail — it just
// never finishes, so the diff card never appears and undo silently does
// nothing. These tests pin the "give up" behaviour.

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 't42-timeout-'))
  execFileSync('git', ['init', '-q'], { cwd: dir })
  execFileSync('git', ['config', 'user.email', 't@e.st'], { cwd: dir })
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir })
  return dir
}

describe('snapshotTree cost control', () => {
  it('still snapshots a normal repository', async () => {
    const dir = makeRepo()
    try {
      writeFileSync(join(dir, 'a.txt'), 'hello')
      const sha = await snapshotTree(dir)
      expect(sha).toMatch(/^[0-9a-f]{40,64}$/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('gives up instead of hanging when staging cannot finish in time', async () => {
    const dir = makeRepo()
    try {
      // Enough files that staging is measurably slow, combined with a git
      // that is made to block. Simulating the real 388k-file case directly
      // would take minutes to set up, so instead we shadow `git` with a
      // script that never exits, which is what a multi-minute hash looks
      // like from the caller's side.
      const binDir = join(dir, 'fakebin')
      mkdirSync(binDir)
      writeFileSync(
        join(binDir, 'git'),
        '#!/bin/sh\nif [ "$1" = "rev-parse" ]; then echo true; exit 0; fi\nsleep 600\n',
        { mode: 0o755 }
      )
      const originalPath = process.env.PATH
      process.env.PATH = `${binDir}:${originalPath}`
      try {
        const started = Date.now()
        const sha = await snapshotTree(dir, 1000)
        const elapsed = Date.now() - started
        expect(sha).toBeNull()
        // The point of the guard: bounded, not "eventually".
        expect(elapsed).toBeLessThan(10_000)
      } finally {
        process.env.PATH = originalPath
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 40_000)

  it('kills the staging process instead of leaving it hashing in the background', async () => {
    const dir = makeRepo()
    try {
      const binDir = join(dir, 'fakebin')
      mkdirSync(binDir)
      const marker = join(dir, 'still-running')
      // The fake writes a marker only if it is allowed to run to completion.
      // If the timeout merely stopped waiting without killing the child, the
      // marker would appear and every turn would leak another staging run.
      writeFileSync(
        join(binDir, 'git'),
        `#!/bin/sh\nif [ "$1" = "rev-parse" ]; then echo true; exit 0; fi\nsleep 2\ntouch ${marker}\n`,
        { mode: 0o755 }
      )
      const originalPath = process.env.PATH
      process.env.PATH = `${binDir}:${originalPath}`
      try {
        expect(await snapshotTree(dir, 300)).toBeNull()
      } finally {
        process.env.PATH = originalPath
      }
      await new Promise((r) => setTimeout(r, 3000))
      expect(existsSync(marker), 'staging survived the timeout').toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 40_000)
})
