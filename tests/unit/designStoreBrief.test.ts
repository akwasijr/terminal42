import { describe, it, expect, vi } from 'vitest'
import { tmpdir } from 'node:os'

/**
 * Reading a brief that was written under the old name.
 *
 * The token feature was called Basis for a while, and briefs stored on disk
 * still spell the three binding fields `basisId`, `basisThemeId` and
 * `basisStamp`. A rename in the source does not reach those rows, so a design
 * bound before the rename has to keep its library.
 */

vi.mock('electron', () => ({ app: { getPath: () => tmpdir() } }))
vi.mock('../../src/main/db', () => ({ getDb: () => ({}) }))

const { rowToDesign } = await import('../../src/main/designStore')

const row = (brief: unknown): Parameters<typeof rowToDesign>[0] => ({
  id: 'd1',
  title: 'A design',
  cwd: '/tmp/d1',
  copilot_session_id: null,
  current_version: null,
  brief: brief === undefined ? null : JSON.stringify(brief),
  created_at: 0,
  last_active_at: 0
})

describe('reading a brief written before the rename', () => {
  it('keeps the library a design was bound to under the old spelling', () => {
    const d = rowToDesign(row({ v: 1, basisId: 'lib1', basisThemeId: 'light', basisStamp: 'abc' }))
    expect(d.brief?.tokensId).toBe('lib1')
    expect(d.brief?.tokensThemeId).toBe('light')
    expect(d.brief?.tokensStamp).toBe('abc')
  })

  it('prefers the new spelling when a brief carries both', () => {
    const d = rowToDesign(row({ v: 1, basisId: 'old', tokensId: 'new' }))
    expect(d.brief?.tokensId).toBe('new')
  })

  it('leaves a brief that never mentioned a library alone', () => {
    const d = rowToDesign(row({ v: 1, kind: 'landing' }))
    expect(d.brief?.tokensId).toBeUndefined()
    expect('basisId' in (d.brief as object)).toBe(false)
  })

  it('survives a brief that is not JSON', () => {
    const d = rowToDesign({ ...row(undefined), brief: '{ not json' })
    expect(d.brief).toBeNull()
  })
})
