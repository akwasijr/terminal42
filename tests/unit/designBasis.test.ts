import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { studioFromFeel, type Feel } from '../../src/shared/tokens/scaffold'

/**
 * Binding a design to a token library.
 *
 * Two things have to happen when a brief names a library: the prompt has to
 * carry the semantic names, and the folder has to carry the files those names
 * refer to. Neither may throw when the library has gone missing, because a
 * library that cannot be read is a reason to generate without it rather than a
 * reason to refuse.
 */

const FEEL: Feel = {
  name: 'Calm',
  primary: '#4338ca',
  secondary: '#0a2540',
  tertiary: '#06b6d4',
  headingFont: 'Space Grotesk',
  bodyFont: 'Inter',
  corner: 'rounded',
  density: 'comfortable',
  scale: 'balanced',
  elevation: 'subtle'
}

const studio = studioFromFeel('Calm', FEEL)
const record = { id: 'lib1', name: 'Calm', studio: JSON.parse(JSON.stringify(studio)), createdAt: 0, updatedAt: 0 }
const store = { get: vi.fn((id: string) => (id === 'lib1' ? record : null)) }

vi.mock('../../src/main/tokens', () => ({ getTokenStudio: (id: string) => store.get(id) }))
vi.mock('electron', () => ({ app: { getPath: () => tmpdir() }, BrowserWindow: { getAllWindows: () => [] }, ipcMain: { handle: () => {} } }))

const { buildBasisBlock, writeBasisFiles } = await import('../../src/main/design')

const brief = (over: Record<string, unknown> = {}): never =>
  ({ basisId: 'lib1', basisThemeId: null, ...over }) as never

beforeEach(() => { store.get.mockClear() })

describe('a design bound to a library', () => {
  it('carries the library into the prompt', () => {
    const block = buildBasisBlock(brief())
    expect(block).toContain('--')
    expect(block.length).toBeGreaterThan(80)
  })

  it('tells the model to paste the declarations rather than link them', () => {
    expect(buildBasisBlock(brief())).toContain('paste its :root block')
  })

  it('says nothing at all when no library is named', () => {
    expect(buildBasisBlock(brief({ basisId: null }))).toBe('')
    expect(buildBasisBlock(null)).toBe('')
  })

  it('says nothing when the library has been deleted', () => {
    expect(buildBasisBlock(brief({ basisId: 'gone' }))).toBe('')
  })

  it('writes all three files into the design folder', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'basis-'))
    await writeBasisFiles(dir, brief())
    expect(existsSync(join(dir, 'tokens.css'))).toBe(true)
    expect(existsSync(join(dir, 'tokens.json'))).toBe(true)
    expect(existsSync(join(dir, 'tokens.md'))).toBe(true)
    expect(readFileSync(join(dir, 'tokens.css'), 'utf8')).toContain(':root')
    expect(JSON.parse(readFileSync(join(dir, 'tokens.json'), 'utf8'))).toBeTypeOf('object')
  })

  it('writes nothing, and does not throw, when the library has been deleted', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'basis-'))
    await writeBasisFiles(dir, brief({ basisId: 'gone' }))
    expect(existsSync(join(dir, 'tokens.css'))).toBe(false)
  })
})
