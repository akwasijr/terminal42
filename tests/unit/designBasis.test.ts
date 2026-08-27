import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { studioFromFeel, type Feel } from '../../src/shared/tokens/scaffold'
import { basisHash } from '../../src/shared/tokens/export'
import { hydrateStudio } from '../../src/shared/tokens/types'

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

const { buildBasisBlock, writeBasisFiles, basisHasMoved } = await import('../../src/main/design')

const brief = (over: Record<string, unknown> = {}): never =>
  ({ basisId: 'lib1', basisThemeId: null, ...over }) as never

beforeEach(() => {
  store.get.mockReset()
  store.get.mockImplementation((id: string) => (id === 'lib1' ? record : null))
})

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

  // A primitive exists so a semantic token can point
  // at it; naming one in the prompt invites the model to reach past the
  // semantic layer, which is the single thing a shared library exists to
  // prevent. The stylesheet may still declare them — a declaration nobody is
  // told about costs a line and breaks nothing — so the two are checked
  // against each other rather than in isolation.
  it('withholds the raw palette from the prompt even when the theme exports it', async () => {
    const open = JSON.parse(JSON.stringify(studio))
    // The palette is the set the primitives live in; switching it on is a
    // toggle away in the themes screen, so this is a state a user can reach.
    const palette = open.sets.find(
      (s: { tokens: { tier?: string }[] }) => s.tokens.some((tok) => tok.tier === 'primitive')
    )
    for (const theme of open.themes) theme.sets[palette.id] = 'enabled'
    store.get.mockImplementation(() => ({ ...record, studio: open }))

    const dir = mkdtempSync(join(tmpdir(), 'basis-'))
    await writeBasisFiles(dir, brief())
    const css = readFileSync(join(dir, 'tokens.css'), 'utf8')
    const declared = new Set(Array.from(css.matchAll(/(--[\w-]+)\s*:/g), (m) => m[1]))
    const named = new Set(Array.from(buildBasisBlock(brief()).matchAll(/--[\w-]+/g), (m) => m[0]))

    // Named from the studio rather than by spelling, so a renamed palette
    // does not quietly turn this into a test of nothing.
    const primitives = new Set(
      (open.sets as { tokens: { path: string; tier?: string }[] }[])
        .flatMap((set) => set.tokens)
        .filter((tok) => tok.tier === 'primitive')
        .map((tok) => `--${tok.path.replace(/\./g, '-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`)
    )
    expect(primitives.size).toBeGreaterThan(0)

    // The gate really is open: the palette reached the stylesheet.
    expect([...primitives].filter((n) => declared.has(n)).length).toBeGreaterThan(0)
    // And was still kept out of the prompt.
    expect([...named].filter((n) => primitives.has(n))).toEqual([])
    // Everything the prompt does name is declared, so nothing resolves to
    // nothing.
    expect(named.size).toBeGreaterThan(5)
    expect([...named].filter((n) => !declared.has(n))).toEqual([])
  })

  it('writes nothing, and does not throw, when the library has been deleted', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'basis-'))
    await writeBasisFiles(dir, brief({ basisId: 'gone' }))
    expect(existsSync(join(dir, 'tokens.css'))).toBe(false)
  })
})

/**
 * Noticing that the library moved.
 *
 * The stamp exists so a design can be told its library has changed without
 * every design keeping a copy of the library. That only works if the hash is
 * quiet about things a design cannot see and loud about things it can.
 */
describe('the library stamp', () => {
  const hydrated = hydrateStudio(JSON.parse(JSON.stringify(studio)))

  it('is the same twice for the same library', () => {
    expect(basisHash(hydrated, hydrated.activeTheme)).toBe(basisHash(hydrated, hydrated.activeTheme))
  })

  // Someone adding a second theme has not touched the one this design uses,
  // so nothing would be rewritten beside it. Flagging every bound design stale
  // because a colleague started a dark mode would teach everyone to ignore the
  // flag, and then the row that mattered would be invisible too.
  it('ignores a change that would not rewrite this design\u2019s files', () => {
    const before = basisHash(hydrated, hydrated.activeTheme)
    const edited = hydrateStudio(JSON.parse(JSON.stringify(studio)))
    edited.themes.push({ id: 'later', name: 'Dark', sets: { ...edited.themes[0].sets } })
    expect(basisHash(edited, edited.activeTheme)).toBe(before)
  })

  // The opposite case, and the reason all three files are hashed rather than
  // just the stylesheet: a description reaches tokens.json and tokens.md, so
  // the folder really is out of date even though the page renders the same.
  it('notices a change that only reaches the written docs', () => {
    const before = basisHash(hydrated, hydrated.activeTheme)
    const edited = hydrateStudio(JSON.parse(JSON.stringify(studio)))
    const token = edited.sets.flatMap((s) => s.tokens).find((tok) => tok.tier !== 'primitive')!
    token.description = `${token.description ?? ''} (a note for whoever reads this)`
    expect(basisHash(edited, edited.activeTheme)).not.toBe(before)
  })

  it('changes when a value the design uses changes', () => {
    const before = basisHash(hydrated, hydrated.activeTheme)
    const edited = hydrateStudio(JSON.parse(JSON.stringify(studio)))
    const token = edited.sets.flatMap((s) => s.tokens).find((tok) => tok.type === 'color')!
    token.value = '#123456'
    expect(basisHash(edited, edited.activeTheme)).not.toBe(before)
  })

  it('is stamped by writing the files, and matches afterwards', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'basis-'))
    const stamp = await writeBasisFiles(dir, brief())
    expect(stamp).toBeTypeOf('string')
    expect(basisHasMoved(brief({ basisStamp: stamp }))).toBe(false)
  })

  it('reports drift once the library has changed under a stamped design', () => {
    expect(basisHasMoved(brief({ basisStamp: 'something-else' }))).toBe(true)
  })

  // Three ways of having nothing to say, all of which must read as "no
  // opinion" rather than as drift: an unstamped design predates stamping, an
  // unbound one never had a library, and a deleted library cannot be compared
  // against. Claiming staleness on any of them spends the flag's only bit of
  // attention on noise.
  it('says nothing when it cannot know', () => {
    expect(basisHasMoved(brief({ basisStamp: null }))).toBe(false)
    expect(basisHasMoved(brief({ basisId: null, basisStamp: 'x' }))).toBe(false)
    expect(basisHasMoved(brief({ basisId: 'gone', basisStamp: 'x' }))).toBe(false)
    expect(basisHasMoved(null)).toBe(false)
  })
})

