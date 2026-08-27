// Doing one thing to many tokens at once.

import { describe, it, expect } from 'vitest'
import {
  bulkDelete,
  bulkMove,
  bulkRename,
  bulkRetire,
  bulkRetype,
  sweepNote
} from '../../src/shared/tokens/bulk'
import { resolveAll } from '../../src/shared/tokens/resolve'
import type { TokenStudio } from '../../src/shared/tokens/types'

const studio: TokenStudio = {
  id: 'ts',
  name: 'Ours',
  sets: [
    {
      id: 'palette',
      name: 'Palette',
      order: 0,
      tokens: [
        { id: '1', path: 'brand.blue.500', type: 'color', value: '#0000ff', tier: 'primitive' },
        { id: '2', path: 'brand.blue.700', type: 'color', value: '#0000cc', tier: 'primitive' },
        { id: '3', path: 'brand.grey.100', type: 'color', value: '#eeeeee', tier: 'primitive' }
      ]
    },
    {
      id: 'core',
      name: 'Core',
      order: 1,
      tokens: [
        { id: '4', path: 'colour.text', type: 'color', value: '{brand.blue.500}', tier: 'semantic' },
        { id: '5', path: 'space.small', type: 'dimension', value: 8, tier: 'primitive' },
        { id: '6', path: 'brand.grey.100', type: 'color', value: '#dddddd', tier: 'primitive' }
      ]
    }
  ],
  themes: [{ id: 'one', name: 'One', sets: { palette: 'enabled', core: 'enabled' } }],
  activeTheme: 'one'
}

const pathsIn = (s: TokenStudio, setId: string): string[] =>
  (s.sets.find((x) => x.id === setId)?.tokens ?? []).map((t) => t.path).sort()

describe('bulkDelete', () => {
  it('removes every picked token and counts them', () => {
    const r = bulkDelete(studio, [
      { setId: 'palette', path: 'brand.blue.500' },
      { setId: 'palette', path: 'brand.blue.700' }
    ])
    expect(r.changed).toBe(2)
    expect(pathsIn(r.studio, 'palette')).toEqual(['brand.grey.100'])
  })

  it('says so rather than throwing when a token has already gone', () => {
    const r = bulkDelete(studio, [{ setId: 'palette', path: 'nope' }])
    expect(r.changed).toBe(0)
    expect(r.skipped[0].because).toMatch(/not there/)
  })
})

describe('bulkRetire', () => {
  it('marks them all, and takes the mark off again', () => {
    const picks = [
      { setId: 'palette', path: 'brand.blue.500' },
      { setId: 'palette', path: 'brand.blue.700' }
    ]
    const gone = bulkRetire(studio, picks, { severity: 'warning', message: 'Old ramp' })
    expect(gone.studio.sets[0].tokens.filter((t) => t.deprecated).length).toBe(2)
    const back = bulkRetire(gone.studio, picks, null)
    expect(back.studio.sets[0].tokens.filter((t) => t.deprecated).length).toBe(0)
  })
})

describe('bulkRetype', () => {
  it('keeps a value the new type could have held', () => {
    const r = bulkRetype(studio, [{ setId: 'core', path: 'space.small' }], 'fontSize')
    const t = r.studio.sets[1].tokens.find((x) => x.path === 'space.small')
    expect(t?.type).toBe('fontSize')
    expect(t?.value).toBe(8)
  })

  it('blanks a value the new type could not have held', () => {
    const r = bulkRetype(studio, [{ setId: 'palette', path: 'brand.blue.500' }], 'duration')
    const t = r.studio.sets[0].tokens.find((x) => x.path === 'brand.blue.500')
    expect(t?.type).toBe('duration')
    expect(t?.value).toBe(200)
  })

  it('leaves an alias alone, since what it points at decides the value', () => {
    const r = bulkRetype(studio, [{ setId: 'core', path: 'colour.text' }], 'text')
    const t = r.studio.sets[1].tokens.find((x) => x.path === 'colour.text')
    expect(t?.value).toBe('{brand.blue.500}')
  })

  it('skips a token that is already that type', () => {
    const r = bulkRetype(studio, [{ setId: 'palette', path: 'brand.blue.500' }], 'color')
    expect(r.changed).toBe(0)
    expect(r.skipped[0].because).toMatch(/already color/)
  })
})

describe('bulkMove', () => {
  it('carries tokens across without breaking what points at them', () => {
    const r = bulkMove(studio, [{ setId: 'palette', path: 'brand.blue.500' }], 'core')
    expect(r.changed).toBe(1)
    expect(pathsIn(r.studio, 'palette')).toEqual(['brand.blue.700', 'brand.grey.100'])
    expect(pathsIn(r.studio, 'core')).toContain('brand.blue.500')
    expect(resolveAll(r.studio, 'one').get('colour.text')?.value).toBe('#0000ff')
  })

  it('leaves a token alone rather than overwrite a name the target set has', () => {
    const r = bulkMove(studio, [{ setId: 'palette', path: 'brand.grey.100' }], 'core')
    expect(r.changed).toBe(0)
    expect(r.skipped[0].because).toMatch(/already has that name/)
    expect(pathsIn(r.studio, 'palette')).toContain('brand.grey.100')
  })

  it('does not move a token into the set it is in', () => {
    const r = bulkMove(studio, [{ setId: 'core', path: 'space.small' }], 'core')
    expect(r.changed).toBe(0)
    expect(r.skipped[0].because).toMatch(/already in Core/)
  })

  it('moves the ones it can even when one of them collides', () => {
    const r = bulkMove(
      studio,
      [
        { setId: 'palette', path: 'brand.blue.500' },
        { setId: 'palette', path: 'brand.grey.100' }
      ],
      'core'
    )
    expect(r.changed).toBe(1)
    expect(r.skipped.length).toBe(1)
  })
})

describe('bulkRename', () => {
  const picks = [
    { setId: 'palette', path: 'brand.blue.500' },
    { setId: 'palette', path: 'brand.blue.700' }
  ]

  it('rewrites the part asked for and repoints the aliases', () => {
    const r = bulkRename(studio, picks, 'brand.', 'accent.')
    expect(pathsIn(r.studio, 'palette')).toContain('accent.blue.500')
    const alias = r.studio.sets[1].tokens.find((t) => t.path === 'colour.text')
    expect(alias?.value).toBe('{accent.blue.500}')
    expect(resolveAll(r.studio, 'one').get('colour.text')?.value).toBe('#0000ff')
  })

  it('treats the text to find as text, not as a pattern', () => {
    const r = bulkRename(studio, picks, '.', '-')
    expect(pathsIn(r.studio, 'palette')).toContain('brand-blue-500')
  })

  it('skips a token the text does not appear in', () => {
    const r = bulkRename(studio, [{ setId: 'palette', path: 'brand.grey.100' }], 'blue', 'azure')
    expect(r.changed).toBe(0)
    expect(r.skipped[0].because).toMatch(/does not contain/)
  })

  it('will not rename a token onto a name its set already uses', () => {
    const r = bulkRename(studio, [{ setId: 'palette', path: 'brand.blue.700' }], '700', '500')
    expect(r.changed).toBe(0)
    expect(r.skipped[0].because).toMatch(/taken/)
  })

  it('will not leave a token with no name at all', () => {
    const r = bulkRename(studio, [{ setId: 'palette', path: 'brand.blue.500' }], 'brand.blue.500', '')
    expect(r.changed).toBe(0)
    expect(r.skipped[0].because).toMatch(/no name/)
  })

  it('does nothing at all when there is nothing to find', () => {
    expect(bulkRename(studio, picks, '', 'x').studio).toBe(studio)
  })
})

describe('sweepNote', () => {
  it('reads as a sentence when everything worked', () => {
    expect(sweepNote({ studio, changed: 4, skipped: [] }, 'Renamed')).toBe('Renamed 4 tokens.')
  })

  it('counts one token as one token', () => {
    expect(sweepNote({ studio, changed: 1, skipped: [] }, 'Moved')).toBe('Moved 1 token.')
  })

  it('names the one it left alone, and why', () => {
    expect(
      sweepNote({ studio, changed: 2, skipped: [{ path: 'a.b', because: 'it is taken' }] }, 'Moved')
    ).toBe('Moved 2 tokens. Left a.b alone, it is taken.')
  })

  it('summarises when it left several alone', () => {
    const note = sweepNote(
      {
        studio,
        changed: 1,
        skipped: [
          { path: 'a.b', because: 'it is taken' },
          { path: 'c.d', because: 'it is taken' }
        ]
      },
      'Moved'
    )
    expect(note).toBe('Moved 1 token. Left 2 alone, starting with a.b, it is taken.')
  })
})
