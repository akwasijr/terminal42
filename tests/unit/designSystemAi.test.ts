import { describe, it, expect } from 'vitest'
import {
  generateSystem, buildSystemPrompt, parseSystemReply, applyAiSystem, applyFeel, applyReference, feelFromProfile, FEEL_PRESETS, DEFAULT_ANSWERS,
  type SystemAnswers
} from '../../src/renderer/src/lib/designSystem'

const A: SystemAnswers = { ...DEFAULT_ANSWERS, name: 'Acme', purpose: 'A fintech dashboard', primary: '#112233', secondary: '#445566', tertiary: '#778899' }

describe('design system AI helpers', () => {
  it('generateSystem attaches a brief when brief fields are present', () => {
    const s = generateSystem(A)
    expect(s.brief?.purpose).toBe('A fintech dashboard')
    expect(s.name).toBe('Acme')
  })

  it('generateSystem omits brief when no brief fields', () => {
    const s = generateSystem({ ...DEFAULT_ANSWERS, name: 'Plain' })
    expect(s.brief).toBeUndefined()
  })

  it('buildSystemPrompt includes the brief and sampled palette', () => {
    const p = buildSystemPrompt(A, ['#ff0000', 'not-a-hex', '#00ff00'])
    expect(p).toContain('A fintech dashboard')
    expect(p).toContain('#ff0000')
    expect(p).toContain('#00ff00')
    expect(p).not.toContain('not-a-hex')
    expect(p).toContain('JSON object')
  })

  it('parseSystemReply extracts JSON from a fenced reply', () => {
    const raw = 'Sure!\n```json\n{ "name": "X", "colors": { "primary": "#abcdef" } }\n```\nDone.'
    const parsed = parseSystemReply(raw) as Record<string, unknown>
    expect(parsed).toBeTruthy()
    expect(parsed.name).toBe('X')
  })

  it('parseSystemReply returns null for non-JSON', () => {
    expect(parseSystemReply('no json here')).toBeNull()
  })

  it('applyAiSystem overrides valid hex colors and docs, ignores invalid', () => {
    const base = generateSystem(A)
    const out = applyAiSystem(base, {
      name: 'Refined',
      colors: { primary: '#aabbcc', secondary: 'bad', success: '#00aa00' },
      docs: { overview: 'Overview text', colors: 'Color usage' }
    })
    expect(out.name).toBe('Refined')
    expect(out.colors.primary).toBe('#aabbcc')
    expect(out.colors.secondary).toBe(base.colors.secondary) // invalid ignored
    expect(out.colors.success).toBe('#00aa00')
    expect(out.docs?.overview).toBe('Overview text')
    expect(out.id).toBe(base.id) // identity preserved
  })

  it('applyAiSystem strips em dashes from docs', () => {
    const base = generateSystem(A)
    const out = applyAiSystem(base, { docs: { overview: 'a \u2014 b' } })
    expect(out.docs?.overview).toBe('a - b')
  })

  it('applyAiSystem returns base unchanged on garbage', () => {
    const base = generateSystem(A)
    expect(applyAiSystem(base, null)).toEqual(base)
    expect(applyAiSystem(base, 'x')).toEqual(base)
  })

  it('buildSystemPrompt includes the active anti-AI-default rules', () => {
    const p = buildSystemPrompt(A, [])
    expect(p).toContain('Non-negotiable design rules')
    expect(p.toLowerCase()).toContain('gradient')
  })

  it('generateSystem honors elevation and motion choices', () => {
    const flat = generateSystem({ ...A, elevation: 'flat', motionStyle: 'none' })
    expect(flat.shadow).toBe('off')
    expect(flat.motion.normal).toBe(0)
    const elevated = generateSystem({ ...A, elevation: 'elevated', motionStyle: 'expressive' })
    expect(elevated.shadow).toBe('medium')
    expect(elevated.motion.normal).toBeGreaterThan(0)
    expect(elevated.rules).toBeTruthy()
  })

  it('applyFeel applies distinctive, unique attributes per feel', () => {
    const base = { ...DEFAULT_ANSWERS }
    const brut = applyFeel(base, 'brutalist')
    const play = applyFeel(base, 'playful')
    const elegant = applyFeel(base, 'elegant')
    expect(brut.cornerStyle).toBe('angular')
    expect(play.cornerStyle).toBe('full')
    expect(brut.headingFont).not.toBe(play.headingFont)
    expect(elegant.bodyFont).not.toBe(play.bodyFont)
    // colors differ across feels
    expect(new Set([brut.primary, play.primary, elegant.primary]).size).toBe(3)
    // every feel preset is defined and complete
    const feels = ['minimal', 'professional', 'bold', 'playful', 'soft', 'elegant', 'brutalist', 'technical', 'luxe'] as const
    for (const f of feels) {
      const p = FEEL_PRESETS[f]
      expect(p.label.length).toBeGreaterThan(0)
      expect(/^#[0-9a-f]{6}$/i.test(p.primary)).toBe(true)
    }
  })

  it('generateSystem applies the chosen corner + border style', () => {
    const angular = generateSystem({ ...A, cornerStyle: 'angular', borderStyle: 'none' })
    expect(angular.cornerStyle).toBe('angular')
    expect(angular.borderStyle).toBe('none')
    expect(angular.radii.md).toBeLessThan(4)
    const curved = generateSystem({ ...A, cornerStyle: 'curved', borderStyle: 'outlined' })
    expect(curved.radii.md).toBeGreaterThan(angular.radii.md)
  })

  it('feelFromProfile + applyReference deduce style from a reference', () => {
    expect(feelFromProfile({ base: 'dark', tone: 'vibrant', palette: [] })).toBe('bold')
    expect(feelFromProfile({ base: 'dark', tone: 'muted', palette: [] })).toBe('technical')
    expect(feelFromProfile({ base: 'light', tone: 'vibrant', palette: [] })).toBe('playful')
    const out = applyReference({ ...DEFAULT_ANSWERS }, { base: 'dark', tone: 'vibrant', palette: ['#112233', '#445566', '#778899'] })
    expect(out.base).toBe('dark')
    expect(out.primary).toBe('#112233')
    expect(out.secondary).toBe('#445566')
  })

  it('buildSystemPrompt asks the AI to match reference screenshots', () => {
    const withRef = buildSystemPrompt({ ...A, shots: ['data:a', 'data:b', 'data:c'], refName: 'Stripe dashboard' }, ['#112233'])
    expect(withRef).toMatch(/Reference UI screenshots were provided/)
    expect(withRef).toContain('Stripe dashboard')
    const noRef = buildSystemPrompt({ ...A, shots: undefined, refName: '' }, [])
    expect(noRef).not.toMatch(/Reference UI screenshots were provided/)
  })
})
