import { describe, it, expect } from 'vitest'
import { studioFromFeel, type Feel } from '../../src/shared/tokens/scaffold'
import { toFormCollection, syncTokensCollection, sameCollections } from '../../src/renderer/src/lib/tokens/toForm'
import type { VariableCollection } from '../../src/renderer/src/lib/variables'

/**
 * A form bound to a token library.
 *
 * The binding is only worth having if it survives being reopened. A form binds
 * a fill to a variable by id, and the collection is rebuilt from the library
 * every time the file opens, so the ids have to come out the same or every
 * reopen would silently unbind the whole file.
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

describe('a token library as a form collection', () => {
  it('gives the same ids every time it is built for the same library', () => {
    const a = toFormCollection(studio, 'lib1')
    const b = toFormCollection(studio, 'lib1')
    expect(a.id).toBe(b.id)
    expect(a.modes.map((m) => m.id)).toEqual(b.modes.map((m) => m.id))
    expect(a.variables.map((v) => v.id)).toEqual(b.variables.map((v) => v.id))
    expect(a.variables.length).toBeGreaterThan(0)
  })

  it('keeps the ids when the library is edited, so bindings hold', () => {
    const before = toFormCollection(studio, 'lib1')
    const edited = JSON.parse(JSON.stringify(studio)) as typeof studio
    const set = edited.sets.find((s) => s.tokens.some((t) => t.type === 'color'))
    const token = set?.tokens.find((t) => t.type === 'color')
    if (!set || !token) throw new Error('no colour token to edit')
    token.value = '#ff0000'
    const after = toFormCollection(edited, 'lib1')
    expect(after.variables.map((v) => v.id)).toEqual(before.variables.map((v) => v.id))
  })

  it('gives two libraries different ids', () => {
    expect(toFormCollection(studio, 'lib1').id).not.toBe(toFormCollection(studio, 'lib2').id)
  })

  it('still works unbound, with ids nobody depends on', () => {
    const c = toFormCollection(studio)
    expect(c.fromTokens).toBeUndefined()
    expect(c.id).not.toContain('lib1')
  })
})

const own: VariableCollection = {
  id: 'mine',
  name: 'My collection',
  modes: [{ id: 'm1', name: 'Only' }],
  activeMode: 'm1',
  variables: []
}

describe('syncing a bound library into a form', () => {
  it("adds the library beside the file's own collections", () => {
    const out = syncTokensCollection([own], studio, 'lib1')
    expect(out).toHaveLength(2)
    expect(out.find((c) => c.id === 'mine')).toEqual(own)
    expect(out.find((c) => c.fromTokens === 'lib1')).toBeTruthy()
  })

  it('replaces the previous copy rather than growing a second one', () => {
    const once = syncTokensCollection([own], studio, 'lib1')
    const twice = syncTokensCollection(once, studio, 'lib1')
    expect(twice.filter((c) => c.fromTokens === 'lib1')).toHaveLength(1)
    expect(sameCollections(once, twice)).toBe(true)
  })

  it('keeps the mode the file was looking at', () => {
    const once = syncTokensCollection([], studio, 'lib1')
    const dark = once[0].modes[1]
    expect(dark).toBeTruthy()
    const looking = [{ ...once[0], activeMode: dark.id }]
    const again = syncTokensCollection(looking, studio, 'lib1')
    expect(again[0].activeMode).toBe(dark.id)
  })

  it('drops the library when the form is unbound', () => {
    const bound = syncTokensCollection([own], studio, 'lib1')
    const loose = syncTokensCollection(bound, null, null)
    expect(loose).toEqual([own])
  })

  it('drops the old library when the form is bound to a different one', () => {
    const bound = syncTokensCollection([own], studio, 'lib1')
    const moved = syncTokensCollection(bound, studio, 'lib2')
    expect(moved.filter((c) => c.fromTokens)).toHaveLength(1)
    expect(moved.find((c) => c.fromTokens)?.fromTokens).toBe('lib2')
  })

  it('leaves the library out when it cannot be read', () => {
    const bound = syncTokensCollection([own], studio, 'lib1')
    const gone = syncTokensCollection(bound, null, 'lib1')
    expect(gone).toEqual([own])
  })

  it('notices a real change so the file is only saved when something moved', () => {
    const once = syncTokensCollection([], studio, 'lib1')
    const edited = JSON.parse(JSON.stringify(studio)) as typeof studio
    const token = edited.sets.flatMap((s) => s.tokens).find((t) => t.type === 'color')
    if (!token) throw new Error('no colour token')
    token.value = '#123456'
    const after = syncTokensCollection(once, edited, 'lib1')
    expect(sameCollections(once, after)).toBe(false)
  })
})
