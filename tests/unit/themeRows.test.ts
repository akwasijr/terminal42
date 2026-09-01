import { describe, it, expect } from 'vitest'
import { themeRows, groupRows, CREATE_TOKEN_KINDS } from '../../src/renderer/src/lib/tokens/themeRows'
import type { TokenStudio } from '../../src/shared/tokens/types'

function studio(): TokenStudio {
  return {
    name: 'Test',
    activeTheme: 'light',
    themes: [{ id: 'light', name: 'Light', sets: { base: 'enabled' } }],
    sets: [
      {
        id: 'base',
        name: 'Base',
        order: 0,
        tokens: [
          { id: 'blue', path: 'blue.500', type: 'color', tier: 'primitive', value: '#2563eb' },
          { id: 'action', path: 'color.action.rest', type: 'color', tier: 'semantic', value: '{blue.500}' },
          { id: 'gap', path: 'spacing.md', type: 'dimension', tier: 'semantic', value: 16 }
        ]
      }
    ]
  } as unknown as TokenStudio
}

describe('themeRows', () => {
  it('has nothing to show without a library', () => {
    expect(themeRows(null, null)).toEqual([])
  })

  it('leaves raw values out and resolves the rest', () => {
    const rows = themeRows(studio(), 'light')
    expect(rows.map((r) => r.path)).toEqual(['color.action.rest', 'spacing.md'])
    expect(rows[0].value).toBe('#2563eb')
    expect(rows[0].swatch).toBe('#2563eb')
    expect(rows[1].swatch).toBeNull()
  })

  it('names a token by its last segment and groups it by its first', () => {
    const rows = themeRows(studio(), 'light')
    expect(rows[0].name).toBe('rest')
    expect(rows[0].group).toBe('color')
  })

  it('searches on the whole path, not just the name', () => {
    expect(themeRows(studio(), 'light', 'action').map((r) => r.path)).toEqual(['color.action.rest'])
    expect(themeRows(studio(), 'light', 'SPACING').map((r) => r.path)).toEqual(['spacing.md'])
    expect(themeRows(studio(), 'light', 'nothing')).toEqual([])
  })
})

describe('groupRows', () => {
  it('runs rows together under their group', () => {
    const groups = groupRows(themeRows(studio(), 'light'))
    expect(groups.map((g) => g.group)).toEqual(['color', 'spacing'])
    expect(groups[0].rows).toHaveLength(1)
  })
})

describe('CREATE_TOKEN_KINDS', () => {
  it('offers every kind exactly once, each landing somewhere of its own', () => {
    const paths = CREATE_TOKEN_KINDS.map((k) => k.path)
    expect(new Set(paths).size).toBe(paths.length)
    expect(CREATE_TOKEN_KINDS.every((k) => k.tier === 'semantic')).toBe(true)
  })
})
