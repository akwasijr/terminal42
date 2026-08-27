// Sets arranged in folders by their slash paths.

import { describe, it, expect } from 'vitest'
import {
  folderOf,
  folderState,
  leafName,
  renameFolder,
  renameSet,
  setFolderState,
  setsUnder,
  treeOfSets,
  type SetNode
} from '../../src/shared/tokens/sets'
import type { TokenSet, TokenStudio } from '../../src/shared/tokens/types'

const set = (id: string, name: string, order: number): TokenSet => ({ id, name, order, tokens: [] })

const sets = [
  set('a', 'Palette', 0),
  set('b', 'Nike/Light', 1),
  set('c', 'Nike/Dark', 2),
  set('d', 'Nike/Raw/Colour', 3),
  set('e', 'Adidas/Light', 4)
]

const studio: TokenStudio = {
  id: 'ts',
  name: 'Ours',
  sets,
  themes: [
    { id: 'one', name: 'One', sets: { a: 'source', b: 'enabled', c: 'off', d: 'source', e: 'off' } }
  ],
  activeTheme: 'one'
}

const names = (nodes: SetNode[]): string[] => nodes.map((n) => n.name)

describe('leafName and folderOf', () => {
  it('splits a nested name into where it is and what it is called', () => {
    expect(leafName('Nike/Raw/Colour')).toBe('Colour')
    expect(folderOf('Nike/Raw/Colour')).toBe('Nike/Raw')
  })

  it('leaves a plain name alone', () => {
    expect(leafName('Palette')).toBe('Palette')
    expect(folderOf('Palette')).toBe('')
  })
})

describe('treeOfSets', () => {
  const tree = treeOfSets(sets)

  it('puts top-level sets and folders side by side, in stacking order', () => {
    expect(names(tree)).toEqual(['Palette', 'Nike', 'Adidas'])
  })

  it('nests as deep as the names go', () => {
    const nike = tree[1]
    expect(nike.kind).toBe('folder')
    if (nike.kind !== 'folder') return
    expect(names(nike.children)).toEqual(['Light', 'Dark', 'Raw'])
    const raw = nike.children[2]
    expect(raw.kind === 'folder' && names(raw.children)).toEqual(['Colour'])
  })

  it('gathers every set under a folder however deep', () => {
    expect(setsUnder(tree[1]).map((s) => s.id).sort()).toEqual(['b', 'c', 'd'])
  })
})

describe('folderState', () => {
  const tree = treeOfSets(sets)

  it('says mixed when the sets inside disagree', () => {
    expect(folderState(studio, 'one', tree[1])).toBe('mixed')
  })

  it('says the one state when they all agree', () => {
    expect(folderState(studio, 'one', tree[2])).toBe('off')
  })
})

describe('setFolderState', () => {
  it('puts everything under the folder into one state', () => {
    const tree = treeOfSets(sets)
    const next = setFolderState(studio, 'one', tree[1], 'enabled')
    expect(next.themes[0].sets).toMatchObject({ b: 'enabled', c: 'enabled', d: 'enabled' })
    expect(next.themes[0].sets.a).toBe('source')
  })
})

describe('renameSet', () => {
  it('moves a set between folders, since that is all a move is', () => {
    const next = renameSet(studio, 'b', 'Adidas/Light 2')
    expect(next.sets.find((s) => s.id === 'b')?.name).toBe('Adidas/Light 2')
  })

  it('tidies stray spaces and empty parts out of the path', () => {
    const next = renameSet(studio, 'b', '  Nike / / Light  ')
    expect(next.sets.find((s) => s.id === 'b')?.name).toBe('Nike/Light')
  })

  it('refuses a name another set already has', () => {
    expect(renameSet(studio, 'b', 'Nike/Dark')).toBe(studio)
  })

  it('refuses an empty name', () => {
    expect(renameSet(studio, 'b', '   ')).toBe(studio)
  })
})

describe('renameFolder', () => {
  it('carries every set inside it', () => {
    const next = renameFolder(studio, 'Nike', 'Swoosh')
    expect(next.sets.map((s) => s.name)).toEqual([
      'Palette',
      'Swoosh/Light',
      'Swoosh/Dark',
      'Swoosh/Raw/Colour',
      'Adidas/Light'
    ])
  })

  it('renames a folder inside a folder without disturbing the one above', () => {
    const next = renameFolder(studio, 'Nike/Raw', 'Primitive')
    expect(next.sets.find((s) => s.id === 'd')?.name).toBe('Nike/Primitive/Colour')
  })

  it('will not let a rename smuggle in another level', () => {
    const next = renameFolder(studio, 'Nike', 'A/B')
    expect(next.sets.find((s) => s.id === 'b')?.name).toBe('A B/Light')
  })
})
