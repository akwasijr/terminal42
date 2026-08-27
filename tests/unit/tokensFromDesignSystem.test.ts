import { describe, it, expect } from 'vitest'
import { studioFromDesignSystem, feelFromDesignSystem, parseEasing } from '../../src/renderer/src/lib/tokens/fromDesignSystem'
import { generateSystem, DEFAULT_ANSWERS } from '../../src/renderer/src/lib/designSystem'
import { resolveAll } from '../../src/shared/tokens/resolve'

/**
 * A design system becoming a token library.
 *
 * The point of the bridge is that nothing is asked twice and nothing the
 * system decided is quietly re-derived. A type scale the system settled in
 * pixels has to arrive in pixels; a red the system chose has to be the red
 * that `colour.danger.fill` resolves to, or the library is a different design
 * system wearing the same name.
 */

const ds = generateSystem(DEFAULT_ANSWERS)
const studio = studioFromDesignSystem(ds)

function value(themeId: string | null, path: string): unknown {
  const hit = resolveAll(studio, themeId).get(path)
  return hit?.value
}

describe('the library a design system makes', () => {
  it('is named after the system', () => {
    expect(studio.name).toBe(ds.name)
  })

  it('opens in the theme the system was drawn in', () => {
    expect(studio.activeTheme).toBe(ds.base === 'dark' ? 'dark' : 'light')
  })

  it('carries the type scale in the pixels the system settled on', () => {
    expect(value(studio.activeTheme, 'size.md')).toBe(ds.type.base)
    expect(value(studio.activeTheme, 'size.4xl')).toBe(ds.type.xxxl)
    expect(value(studio.activeTheme, 'size.xs')).toBe(ds.type.xs)
  })

  it('carries the corner radii rather than deriving them again', () => {
    expect(value(studio.activeTheme, 'radius.md')).toBe(ds.radii.md)
    expect(value(studio.activeTheme, 'radius.full')).toBe(ds.radii.pill)
  })

  it('carries the weights and the motion timings', () => {
    expect(value(studio.activeTheme, 'weight.bold')).toBe(ds.weights.bold)
    expect(value(studio.activeTheme, 'time.normal')).toBe(ds.motion.normal)
  })

  it('makes the system status colours the ones the semantics resolve to', () => {
    // The semantic token still aliases a primitive — the tier rule is intact —
    // but the primitive is now on a ramp through the system's own red.
    const danger = studio.sets.flatMap((x) => x.tokens).find((t) => t.path === 'colour.danger.fill')
    expect(danger?.value).toMatch(/^\{palette\./)
    const resolved = String(value(studio.activeTheme, 'colour.danger.fill'))
    expect(resolved).toMatch(/^#/)
    expect(resolved).not.toBe(String(value(studio.activeTheme, 'colour.success.fill')))
  })

  it('carries the two typefaces', () => {
    expect(value(studio.activeTheme, 'family.sans')).toBe(ds.font.family)
    expect(value(studio.activeTheme, 'family.display')).toBe(ds.font.heading)
  })

  it('still has both themes, so the library is themeable from the start', () => {
    expect(studio.themes.map((t) => t.id).sort()).toEqual(['dark', 'light'])
  })

  it('leaves every token resolvable', () => {
    for (const themeId of studio.themes.map((t) => t.id)) {
      for (const [, hit] of resolveAll(studio, themeId)) {
        expect(hit.value).not.toBeUndefined()
      }
    }
  })

  it('starts at the bottom of the enforcement ladder like any new library', () => {
    expect(studio.enforcement).toBe('advise')
  })
})

describe('the feel read off a system', () => {
  it('treats a squircle as a curve, because the scaffold has no squircle', () => {
    expect(feelFromDesignSystem({ ...ds, cornerStyle: 'squircle' }).corner).toBe('curved')
  })

  it('reads no shadow as flat and a strong one as elevated', () => {
    expect(feelFromDesignSystem({ ...ds, shadow: 'off' }).elevation).toBe('flat')
    expect(feelFromDesignSystem({ ...ds, shadow: 'strong' }).elevation).toBe('elevated')
    expect(feelFromDesignSystem({ ...ds, shadow: 'subtle' }).elevation).toBe('subtle')
  })
})

describe('reading an easing', () => {
  it('takes the four numbers out of a cubic-bezier', () => {
    expect(parseEasing('cubic-bezier(0.4, 0, 0.2, 1)')).toEqual({ x1: 0.4, y1: 0, x2: 0.2, y2: 1 })
  })

  it('says nothing for a keyword, so the scaffold curve is left alone', () => {
    expect(parseEasing('ease-in-out')).toBeNull()
    expect(parseEasing('cubic-bezier(0.4, 0)')).toBeNull()
  })
})
