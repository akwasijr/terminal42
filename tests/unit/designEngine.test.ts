import { describe, it, expect } from 'vitest'
import {
  pickVariety,
  ART_DIRECTIONS,
  LAYOUT_ARCHETYPES,
} from '../../src/main/designVariety'
import { buildEngineBaseBlock, BASE_CSS, MOTION_JS } from '../../src/main/designAssets'
import { AI_RULES, AI_RULE_GROUPS } from '../../src/renderer/src/lib/aiRules'
import type { DesignBrief } from '../../src/main/design.types'

function brief(over: Partial<DesignBrief> = {}): DesignBrief {
  return {
    v: 1,
    kind: 'landing',
    kindLabel: 'Landing page',
    group: 'web',
    fidelity: 'highfidelity',
    createdAt: 1000,
    ...over,
  } as DesignBrief
}

describe('pickVariety', () => {
  it('is deterministic for the same brief (stable across iteration turns)', () => {
    const a = pickVariety(brief({ createdAt: 42, idea: 'a bakery' }))
    const b = pickVariety(brief({ createdAt: 42, idea: 'a bakery' }))
    expect(a.directionId).toBe(b.directionId)
    expect(a.archetypeId).toBe(b.archetypeId)
  })

  it('returns ids that exist in the catalogs', () => {
    const v = pickVariety(brief({ createdAt: 7 }))
    expect(ART_DIRECTIONS.some((d) => d.id === v.directionId)).toBe(true)
    expect(LAYOUT_ARCHETYPES.some((l) => l.id === v.archetypeId)).toBe(true)
  })

  it('varies across different designs', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const v = pickVariety(brief({ createdAt: i * 1337 + 5, idea: 'site ' + i }))
      seen.add(v.directionId + '/' + v.archetypeId)
    }
    // 20 distinct designs should produce several distinct looks, not one.
    expect(seen.size).toBeGreaterThan(5)
  })

  it('drops font guidance when the brief pins fonts', () => {
    const withFonts = pickVariety(brief({ fontHeading: 'Fraunces', fontBody: 'Hanken Grotesk' }))
    expect(withFonts.text).not.toContain('- Type:')
    const without = pickVariety(brief())
    expect(without.text).toContain('- Type:')
  })

  it('drops color guidance when the brief pins a palette', () => {
    const withColor = pickVariety(brief({ primaryColor: '#3b352c' }))
    expect(withColor.text).not.toContain('- Color:')
  })

  it('always gives imagery and composition direction', () => {
    const v = pickVariety(brief())
    expect(v.text).toContain('- Imagery:')
    expect(v.text).toContain('- Composition:')
  })
})

describe('engine assets', () => {
  it('base block carries both engine markers', () => {
    const block = buildEngineBaseBlock()
    expect(block).toContain('id="engine-base"')
    expect(block).toContain('id="engine-motion"')
  })

  it('base CSS ships the motion classes and reduced-motion guard', () => {
    expect(BASE_CSS).toContain('[data-reveal].is-visible')
    expect(BASE_CSS).toContain('prefers-reduced-motion')
    expect(BASE_CSS).toContain('--space-4')
  })

  it('motion JS wires scroll and mouse interactions', () => {
    for (const attr of ['data-reveal', 'data-split', 'data-parallax', 'data-tilt', 'data-magnet', 'data-mouse-depth']) {
      expect(MOTION_JS).toContain(attr)
    }
    expect(MOTION_JS).toContain('prefers-reduced-motion')
  })
})

describe('restraint rules', () => {
  it('adds the restraint group and its rules', () => {
    expect(AI_RULE_GROUPS.some((g) => g.id === 'restraint')).toBe(true)
    const restraint = AI_RULES.filter((r) => r.group === 'restraint')
    expect(restraint.map((r) => r.id)).toEqual(
      expect.arrayContaining(['no-unsolicited-subtext', 'only-requested-sections', 'icons-on-purpose']),
    )
  })
})
