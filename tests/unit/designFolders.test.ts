// @vitest-environment jsdom
/**
 * Folders belong to the section they were made in.
 *
 * The bug these guard against: one flat list shown over every type, so a
 * folder made while looking at decks also hung over tokens and websites. The
 * store reads localStorage once at import, so each test resets the modules and
 * imports again rather than sharing one instance.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Store = typeof import('../../src/renderer/src/lib/designFolders')

async function load(seed: Record<string, unknown> = {}): Promise<Store> {
  localStorage.clear()
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v))
  vi.resetModules()
  return import('../../src/renderer/src/lib/designFolders')
}

const KEY = 't42-design-folders-v2'
const MAP = 't42-design-folder-map'
const LEGACY = 't42-design-folders'

beforeEach(() => {
  localStorage.clear()
})

describe('scoping', () => {
  it('only offers a folder in the section it was made in', async () => {
    const s = await load()
    s.createFolder('tokens', 'Brand')
    expect(s.listFolders('tokens')).toEqual(['Brand'])
    expect(s.listFolders('presentation')).toEqual([])
    expect(s.listFolders('web')).toEqual([])
  })

  it('lets the same name exist in two sections independently', async () => {
    const s = await load()
    s.createFolder('tokens', 'Brand')
    s.createFolder('presentation', 'Brand')
    expect(s.listFolders('tokens')).toEqual(['Brand'])
    expect(s.listFolders('presentation')).toEqual(['Brand'])
  })

  it('refuses a duplicate name within one section', async () => {
    const s = await load()
    expect(s.createFolder('tokens', 'Brand')).toBe(true)
    expect(s.createFolder('tokens', 'Brand')).toBe(false)
    expect(s.listFolders('tokens')).toEqual(['Brand'])
  })

  it('refuses a blank name and trims the rest', async () => {
    const s = await load()
    expect(s.createFolder('tokens', '   ')).toBe(false)
    s.createFolder('tokens', '  Brand  ')
    expect(s.listFolders('tokens')).toEqual(['Brand'])
  })

  it('persists so the folders survive a reload', async () => {
    const s = await load()
    s.createFolder('tokens', 'Brand')
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toEqual({ tokens: ['Brand'] })
  })
})

describe('removeFolder', () => {
  it('unassigns only the things this section owns', async () => {
    const s = await load({ [MAP]: { tok1: 'Brand', deck1: 'Brand' } })
    s.createFolder('tokens', 'Brand')
    s.createFolder('presentation', 'Brand')

    s.removeFolder('tokens', 'Brand', (id) => id.startsWith('tok'))

    // The deck's assignment is untouched: its section still has that folder.
    expect(s.getAssignments()).toEqual({ deck1: 'Brand' })
    expect(s.listFolders('tokens')).toEqual([])
    expect(s.listFolders('presentation')).toEqual(['Brand'])
  })

  it('leaves other folders alone', async () => {
    const s = await load({ [MAP]: { a: 'Brand', b: 'Archive' } })
    s.createFolder('tokens', 'Brand')
    s.createFolder('tokens', 'Archive')
    s.removeFolder('tokens', 'Brand', () => true)
    expect(s.getAssignments()).toEqual({ b: 'Archive' })
    expect(s.listFolders('tokens')).toEqual(['Archive'])
  })
})

describe('assignFolder', () => {
  it('moves a thing in and back out again', async () => {
    const s = await load()
    s.assignFolder('a', 'Brand')
    expect(s.getAssignments()).toEqual({ a: 'Brand' })
    s.assignFolder('a', null)
    expect(s.getAssignments()).toEqual({})
  })
})

describe('migrateLegacyFolders', () => {
  it('places an old folder in the sections its things occupy', async () => {
    const s = await load({ [LEGACY]: ['Acme'], [MAP]: { d1: 'Acme' } })
    s.migrateLegacyFolders((id) => (id === 'd1' ? 'presentation' : null))
    expect(s.getFolders()).toEqual({ presentation: ['Acme'] })
  })

  it('sends an empty folder to "all" so it stays visible', async () => {
    const s = await load({ [LEGACY]: ['Empty'] })
    s.migrateLegacyFolders(() => null)
    expect(s.getFolders()).toEqual({ all: ['Empty'] })
  })

  it('puts a folder spanning two sections in both', async () => {
    const s = await load({ [LEGACY]: ['Mixed'], [MAP]: { d1: 'Mixed', t1: 'Mixed' } })
    s.migrateLegacyFolders((id) => (id === 'd1' ? 'presentation' : 'tokens'))
    expect(s.getFolders().presentation).toEqual(['Mixed'])
    expect(s.getFolders().tokens).toEqual(['Mixed'])
  })

  it('clears the legacy key so it runs once', async () => {
    const s = await load({ [LEGACY]: ['Acme'] })
    s.migrateLegacyFolders(() => null)
    expect(localStorage.getItem(LEGACY)).toBeNull()
  })

  it('does not offer to migrate once the new key exists', async () => {
    const s = await load({ [LEGACY]: ['Acme'], [KEY]: { tokens: ['Brand'] } })
    expect(s.hasLegacyFolders()).toBe(false)
  })

  it('offers to migrate when only the old list is there', async () => {
    const s = await load({ [LEGACY]: ['Acme'] })
    expect(s.hasLegacyFolders()).toBe(true)
  })
})

describe('one store, so two lists cannot erase each other', () => {
  it('shows a token folder and a deck folder side by side', async () => {
    // The hazard this store exists to prevent: two components each holding
    // the whole scope map, so whichever saved last wiped the other. One
    // module means a write from either section keeps both.
    const s = await load()
    s.createFolder('tokens', 'Brand')
    s.createFolder('presentation', 'Acme')
    expect(s.getFolders()).toEqual({ tokens: ['Brand'], presentation: ['Acme'] })
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toEqual({
      tokens: ['Brand'],
      presentation: ['Acme']
    })
  })

  it('hands back a new object each change so React sees it', async () => {
    const s = await load()
    const before = s.getFolders()
    s.createFolder('tokens', 'Brand')
    expect(s.getFolders()).not.toBe(before)
  })

  it('hands back a stable object when nothing changed', async () => {
    const s = await load()
    s.createFolder('tokens', 'Brand')
    const a = s.getFolders()
    expect(s.getFolders()).toBe(a)
  })
})
