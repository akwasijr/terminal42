import { describe, expect, it } from 'vitest'
import { CHECKS, coverageAcross, coverageOf, coverageScore, gapsBySection } from '../../src/shared/tokens/coverage'
import { fillGaps, fillNote } from '../../src/shared/tokens/harden'
import { studioFromFeel, emptyStudio } from '../../src/shared/tokens/scaffold'
import { resolveAll } from '../../src/shared/tokens/resolve'
import { aliasTarget, type TokenStudio } from '../../src/shared/tokens/types'

const FEEL = {
  primary: '#2563eb',
  secondary: '#7c3aed',
  density: 'normal',
  corner: 'soft',
  scale: 'normal',
  elevation: 'subtle',
  bodyFont: 'DM Sans',
  headingFont: 'DM Sans'
} as never

function fresh(): { studio: TokenStudio; theme: string | null } {
  const studio = studioFromFeel('Check', FEEL)
  return { studio, theme: studio.themes[0]?.id ?? null }
}

describe('token coverage', () => {
  it('every check states what breaks without it', () => {
    for (const check of CHECKS) {
      expect(check.why.length).toBeGreaterThan(20)
      expect(check.label.length).toBeGreaterThan(3)
      expect(check.need).toBeGreaterThan(0)
    }
  })

  it('check ids are unique', () => {
    const ids = CHECKS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('a scaffolded library answers every check', () => {
    const { studio, theme } = fresh()
    const rows = coverageOf(studio, theme)
    const missing = rows.filter((r) => !r.met).map((r) => r.check.id)
    expect(missing).toEqual([])
    expect(coverageScore(rows).percent).toBe(100)
  })

  it('an empty library answers none of them', () => {
    const studio = emptyStudio('Nothing')
    const rows = coverageOf(studio, studio.themes[0]?.id ?? null)
    expect(rows.every((r) => !r.met)).toBe(true)
    expect(coverageScore(rows).percent).toBe(0)
  })

  it('a check that is met names the tokens that met it', () => {
    const { studio, theme } = fresh()
    const focus = coverageOf(studio, theme).find((r) => r.check.id === 'focus')
    expect(focus?.met).toBe(true)
    expect(focus?.found.some((p) => /focus/i.test(p))).toBe(true)
  })

  it('a token in a set the theme switches off does not count', () => {
    const { studio, theme } = fresh()
    const off: TokenStudio = {
      ...studio,
      themes: studio.themes.map((t) => ({
        ...t,
        sets: Object.fromEntries(Object.keys(t.sets).map((k) => [k, 'off' as const]))
      }))
    }
    expect(coverageScore(coverageOf(off, theme)).percent).toBe(0)
  })

  it('gaps are grouped by section, worst first', () => {
    const studio = emptyStudio('Nothing')
    const groups = gapsBySection(coverageOf(studio, studio.themes[0]?.id ?? null))
    expect(groups.length).toBeGreaterThan(1)
    for (let i = 1; i < groups.length; i += 1) {
      expect(groups[i - 1].missing.length).toBeGreaterThanOrEqual(groups[i].missing.length)
    }
  })

  it('recognises a library that used its own names', () => {
    const { studio, theme } = fresh()
    const renamed: TokenStudio = {
      ...studio,
      sets: studio.sets.map((s) => ({
        ...s,
        tokens: s.tokens.map((t) =>
          t.path === 'colour.focus.ring' ? { ...t, path: 'brand.outline.focus' } : t
        )
      }))
    }
    const focus = coverageOf(renamed, theme).find((r) => r.check.id === 'focus')
    expect(focus?.met).toBe(true)
  })
})

describe('filling the gaps', () => {
  /** A library from before the layer, icon, link and grid families existed. */
  function dated(): { studio: TokenStudio; theme: string | null } {
    const { studio, theme } = fresh()
    const drop = /^(colour\.(layer|icon|link|inverse|skeleton|field|focus)|breakpoint|column|gutter|layout)\./
    return {
      studio: {
        ...studio,
        sets: studio.sets.map((s) => ({
          ...s,
          tokens: s.tokens.filter((t) => !drop.test(t.path) && t.path !== 'type.bodyCompact' && !/^ease\.expressive/.test(t.path))
        }))
      },
      theme
    }
  }

  it('takes a dated library to full coverage', () => {
    const { studio, theme } = dated()
    expect(coverageScore(coverageOf(studio, theme)).percent).toBeLessThan(100)
    const filled = fillGaps(studio, theme)
    expect(filled.added.length).toBeGreaterThan(10)
    expect(coverageScore(coverageOf(filled.studio, theme)).percent).toBe(100)
  })

  it('everything it adds resolves to a real value', () => {
    const { studio, theme } = dated()
    const filled = fillGaps(studio, theme)
    const resolved = resolveAll(filled.studio, theme)
    for (const path of filled.added) {
      const hit = resolved.get(path)
      expect(hit, path).toBeTruthy()
      const value = hit?.value
      expect(value, path).not.toBeUndefined()
      if (typeof value === 'string') expect(aliasTarget(value), path).toBeNull()
    }
  })

  it('points at the library rather than inventing a colour', () => {
    const { studio, theme } = dated()
    const filled = fillGaps(studio, theme)
    const raw = filled.studio.sets.flatMap((s) => s.tokens)
    const layer = raw.find((t) => t.path === 'colour.layer.01')
    expect(aliasTarget(layer?.value ?? '')).toBeTruthy()
  })

  it('the inverse surface is the library swapped, not a new colour', () => {
    const { studio, theme } = dated()
    const filled = fillGaps(studio, theme)
    const resolved = resolveAll(filled.studio, theme)
    const bg = resolved.get('colour.inverse.bg')?.value
    const text = resolved.get('colour.text.primary')?.value
    expect(bg).toBe(text)
  })

  it('changes nothing that was already there', () => {
    const { studio, theme } = dated()
    const before = studio.sets.flatMap((s) => s.tokens).map((t) => `${t.path}=${JSON.stringify(t.value)}`).sort()
    const filled = fillGaps(studio, theme)
    const after = new Set(
      filled.studio.sets.flatMap((s) => s.tokens).map((t) => `${t.path}=${JSON.stringify(t.value)}`)
    )
    for (const line of before) expect(after.has(line), line).toBe(true)
  })

  it('does not mutate the studio it was given', () => {
    const { studio, theme } = dated()
    const count = studio.sets.flatMap((s) => s.tokens).length
    fillGaps(studio, theme)
    expect(studio.sets.flatMap((s) => s.tokens).length).toBe(count)
  })

  it('adds nothing to a library that already covers everything', () => {
    const { studio, theme } = fresh()
    const filled = fillGaps(studio, theme)
    expect(filled.added).toEqual([])
    expect(fillNote(filled)).toMatch(/already covers/)
  })

  it('is idempotent', () => {
    const { studio, theme } = dated()
    const once = fillGaps(studio, theme)
    const twice = fillGaps(once.studio, theme)
    expect(twice.added).toEqual([])
  })

  it('does not let a style take the name of a size that already has it', () => {
    // A scaffolded library holds type.display as a font size. The whole style
    // wants the same name; before, the seed was dropped every time, so the
    // gap the button offered to close could never close.
    const { studio, theme } = dated()
    const filled = fillGaps(studio, theme)
    const all = filled.studio.sets.flatMap((s) => s.tokens)
    for (const t of all.filter((t) => t.type === 'typography')) {
      const clash = all.filter((o) => o.path === t.path && o.type !== t.type)
      expect(clash).toEqual([])
    }
  })

  it('says why when a sweep can close nothing', () => {
    // The bar says a thing is undecided and the button offers to decide it.
    // When the sweep cannot, silence reads as a broken button, so the reason
    // the gap survived is what comes back instead.
    const note = fillNote({
      studio: emptyStudio('Nothing'),
      added: [],
      skipped: [{ id: 'focus', reason: 'The library has no brand colour to make a ring out of.' }]
    })
    expect(note).toContain('no brand colour')
    expect(note).not.toMatch(/already covers/)
  })

  it('says what it could not do rather than guessing', () => {
    const studio = emptyStudio('Nothing')
    const filled = fillGaps(studio, studio.themes[0]?.id ?? null)
    expect(filled.skipped.length).toBeGreaterThan(0)
    for (const s of filled.skipped) expect(s.reason.length).toBeGreaterThan(20)
    expect(fillNote(filled)).toMatch(/decision/)
  })

  it('a compact body keeps the body it came from', () => {
    const { studio, theme } = dated()
    const filled = fillGaps(studio, theme)
    const resolved = resolveAll(filled.studio, theme)
    const body = resolved.get('type.body')?.value as Record<string, unknown> | undefined
    const compact = resolved.get('type.bodyCompact')?.value as Record<string, unknown> | undefined
    expect(compact?.fontFamily).toBe(body?.fontFamily)
    expect(compact?.fontSize).toBe(body?.fontSize)
    expect(Number(compact?.lineHeight)).toBeLessThan(Number(body?.lineHeight))
  })

  it('lands a colour among colours rather than in the type set', () => {
    const { studio, theme } = dated()
    const filled = fillGaps(studio, theme)
    const set = filled.studio.sets.find((s) => s.tokens.some((t) => t.path === 'colour.icon.primary'))
    const colours = set?.tokens.filter((t) => t.type === 'color').length ?? 0
    expect(colours).toBeGreaterThan(5)
  })

  it('does not park a token in a set the theme never exports', () => {
    const { studio, theme } = dated()
    const filled = fillGaps(studio, theme)
    const active = filled.studio.themes.find((t) => t.id === theme)
    const source = new Set(
      Object.entries(active?.sets ?? {})
        .filter(([, state]) => state !== 'enabled')
        .map(([id]) => id)
    )
    // A breakpoint that only lives in a source set resolves perfectly and
    // never reaches a stylesheet, which is not a filled gap.
    for (const path of ['breakpoint.md', 'column.sm', 'gutter.wide']) {
      const holders = filled.studio.sets.filter((s) => s.tokens.some((t) => t.path === path))
      expect(holders.length, path).toBeGreaterThan(0)
      expect(holders.some((s) => !source.has(s.id)), path).toBe(true)
    }
  })

  it('fills every theme, not only the one it was asked about', () => {
    const { studio, theme } = dated()
    const filled = fillGaps(studio, theme)
    for (const t of filled.studio.themes) {
      expect(coverageScore(coverageOf(filled.studio, t.id)).percent, t.name).toBe(100)
    }
  })

  it('reaches a theme that is missing what another theme already has', () => {
    // The shape a library takes after a fill that only knew about one theme:
    // complete in Light, short in Dark, and reporting itself finished.
    const { studio, theme } = dated()
    const once = fillGaps(studio, theme)
    const light = once.studio.themes[0].id
    const dark = once.studio.themes[1]?.id
    if (!dark) return
    const lightOnly: TokenStudio = {
      ...once.studio,
      sets: once.studio.sets.map((s) => ({
        ...s,
        tokens: once.studio.themes[1] && once.studio.themes[1].sets[s.id] === 'enabled'
          ? s.tokens.filter((t) => !/^colour\.(icon|layer)\./.test(t.path))
          : s.tokens
      }))
    }
    expect(coverageScore(coverageOf(lightOnly, light)).percent).toBe(100)
    expect(coverageScore(coverageOf(lightOnly, dark)).percent).toBeLessThan(100)

    const again = fillGaps(lightOnly, light)
    expect(again.added.length).toBeGreaterThan(0)
    expect(coverageScore(coverageOf(again.studio, dark)).percent).toBe(100)
  })

  it('builds type styles for a library that only has loose numbers', () => {
    const { studio, theme } = fresh()
    const bare: TokenStudio = {
      ...studio,
      sets: studio.sets.map((s) => ({
        ...s,
        tokens: s.tokens.filter((t) => t.type !== 'typography')
      }))
    }
    expect(coverageOf(bare, theme).find((r) => r.check.id === 'typeStyles')?.met).toBe(false)
    const filled = fillGaps(bare, theme)
    expect(coverageOf(filled.studio, theme).find((r) => r.check.id === 'typeStyles')?.met).toBe(true)
    const body = resolveAll(filled.studio, theme).get('type.body')?.value as Record<string, unknown>
    expect(typeof body.fontFamily).toBe('string')
    expect(typeof body.fontSize).toBe('number')
  })
})

describe('coverage across themes', () => {
  it('a check met in one theme and not another is not met', () => {
    const { studio } = fresh()
    const light = studio.themes[0].id
    const dark = studio.themes[1]?.id
    if (!dark) return
    const stripped: TokenStudio = {
      ...studio,
      sets: studio.sets.map((s) => ({
        ...s,
        tokens: studio.themes[1].sets[s.id] === 'enabled' && studio.themes[0].sets[s.id] !== 'enabled'
          ? s.tokens.filter((t) => !/^colour\.icon\./.test(t.path))
          : s.tokens
      }))
    }
    expect(coverageOf(stripped, light).find((r) => r.check.id === 'icon')?.met).toBe(true)
    expect(coverageAcross(stripped).find((r) => r.check.id === 'icon')?.met).toBe(false)
  })

  it('agrees with a single theme when there is only one', () => {
    const { studio, theme } = fresh()
    const one: TokenStudio = { ...studio, themes: studio.themes.slice(0, 1) }
    expect(coverageScore(coverageAcross(one))).toEqual(coverageScore(coverageOf(one, theme)))
  })
})
