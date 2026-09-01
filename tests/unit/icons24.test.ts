import { describe, it, expect } from 'vitest'
import { ICON_PATHS, ICON_NAMES, resolveIcon } from '../../src/renderer/src/lib/icons24'
import { GOLDEN_EXAMPLES } from '../../src/renderer/src/lib/goldenExamples'

interface AnyNode { props?: Record<string, unknown>; children?: AnyNode[] }

/** Every icon name referenced anywhere in a golden example tree. */
function iconNamesIn(node: AnyNode | undefined, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out
  const p = (node.props ?? {}) as Record<string, unknown>
  for (const key of ['icon', 'brandIcon', 'leftIcon', 'rightIcon', 'action']) {
    const v = p[key]
    if (typeof v === 'string' && key !== 'action') out.push(v)
  }
  const items = p.items
  if (Array.isArray(items)) {
    for (const it of items) {
      const icon = (it as { icon?: unknown })?.icon
      if (typeof icon === 'string') out.push(icon)
    }
  }
  for (const c of node.children ?? []) iconNamesIn(c, out)
  return out
}

describe('icon library', () => {
  it('has a path for every name it advertises', () => {
    for (const n of ICON_NAMES) expect(ICON_PATHS[n], n).toBeTruthy()
  })

  it('never ships an empty path, which would draw nothing', () => {
    for (const [name, d] of Object.entries(ICON_PATHS)) {
      expect(d.trim().length, name).toBeGreaterThan(4)
      expect(d.trim().startsWith('M'), `${name} starts with a move`).toBe(true)
    }
  })
})

describe('resolveIcon', () => {
  it('takes an exact name', () => {
    expect(resolveIcon('search')).toBe('search')
    expect(resolveIcon('settings')).toBe('settings')
  })

  it('takes synonyms, plurals, casing and separators', () => {
    expect(resolveIcon('magnifying glass')).toBe('search')
    expect(resolveIcon('Gear')).toBe('settings')
    expect(resolveIcon('notifications')).toBe('bell')
    expect(resolveIcon('credit_card')).toBe('card')
    expect(resolveIcon('trash-icon')).toBe('trash')
  })

  // The bug that made a whole sidebar draw the same hamburger: every nav item
  // was named after the container it sat in, and the resolver read left to
  // right, so nav-dashboard, nav-usage and nav-billing all landed on `menu`.
  it('reads past the container word to the thing being named', () => {
    expect(resolveIcon('nav-dashboard')).toBe('home')
    expect(resolveIcon('nav-settings')).toBe('settings')
    expect(resolveIcon('menu-calendar')).toBe('calendar')
    expect(resolveIcon('sidebar-user')).toBe('user')
    expect(resolveIcon('tab-chart')).toBe('chart')
    expect(resolveIcon('button-download')).toBe('download')
  })

  it('does not collapse different names onto one glyph', () => {
    const names = ['nav-dashboard', 'nav-history', 'nav-settings', 'nav-mail', 'nav-user']
    const resolved = names.map((n) => resolveIcon(n))
    expect(new Set(resolved).size).toBe(names.length)
  })

  it('still resolves a container word used on its own', () => {
    expect(resolveIcon('menu')).toBe('menu')
    expect(resolveIcon('hamburger')).toBe('menu')
    expect(resolveIcon('nav')).toBe('menu')
  })

  it('falls back to a container word when nothing else in the name is known', () => {
    expect(resolveIcon('list-item')).toBe('list')
    expect(resolveIcon('search-field')).toBe('search')
  })

  it('returns nothing rather than guessing wrong', () => {
    expect(resolveIcon('')).toBe('')
    expect(resolveIcon(undefined)).toBe('')
    expect(resolveIcon('zzzz-qqqq')).toBe('')
  })
})

// The golden examples are what the model copies. An icon name in there that
// does not exist teaches it to invent names, and draws an empty path.
describe('golden examples', () => {
  it('only reference icons that exist', () => {
    for (const g of GOLDEN_EXAMPLES) {
      for (const name of iconNamesIn(g.tree as AnyNode)) {
        expect(resolveIcon(name), `${g.id} references "${name}"`).not.toBe('')
      }
    }
  })
})
