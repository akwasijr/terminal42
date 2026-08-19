import { describe, it, expect } from 'vitest'
import { lintHtml } from '../../src/main/lintHtml'
import { buildFoundationBlock } from '../../src/main/designFoundation'
import { AI_RULES, formatRulesForPrompt, defaultAiRules } from '../../src/renderer/src/lib/aiRules'

describe('lintHtml', () => {
  it('flags a CSS gradient', () => {
    const v = lintHtml('<div style="background:linear-gradient(#fff,#000)"></div>', null)
    expect(v.some((x) => x.rule === 'no-gradients')).toBe(true)
  })

  it('flags AI-default indigo/violet colors', () => {
    const v = lintHtml('<a style="color:#6366F1">x</a>', null)
    expect(v.some((x) => x.rule === 'no-default-palette')).toBe(true)
  })

  it('flags emoji used as icons', () => {
    const v = lintHtml('<button>🚀 Launch</button>', null)
    expect(v.some((x) => x.rule === 'no-emoji-icons')).toBe(true)
  })

  it('flags uppercase text-transform', () => {
    const v = lintHtml('<h2 style="text-transform: uppercase">hi</h2>', null)
    expect(v.some((x) => x.rule === 'no-all-caps')).toBe(true)
  })

  it('flags em dashes in copy', () => {
    const v = lintHtml('<p>Calm \u2014 considered</p>', null)
    expect(v.some((x) => x.rule === 'no-em-dash')).toBe(true)
  })

  it('flags a blurred frosted-glass header', () => {
    const v = lintHtml('<header style="backdrop-filter: blur(8px)">x</header>', null)
    expect(v.some((x) => x.rule === 'no-header-blur')).toBe(true)
  })

  it('flags a scroll progress bar', () => {
    const v = lintHtml('<div data-scroll-progress></div>', null)
    expect(v.some((x) => x.rule === 'no-progress-bar')).toBe(true)
    const v2 = lintHtml('<div class="reading-progress"></div>', null)
    expect(v2.some((x) => x.rule === 'no-progress-bar')).toBe(true)
  })

  it('flags AI-default fonts', () => {
    const v = lintHtml('<style>body{font-family:Inter,sans-serif}</style>', null)
    expect(v.some((x) => x.rule === 'distinct-fonts')).toBe(true)
  })

  it('passes a clean document', () => {
    const html =
      '<style>body{font-family:Fraunces,serif;color:#231d18}</style><main><h1>Flowers, considered</h1></main>'
    expect(lintHtml(html, null)).toEqual([])
  })

  it('only enforces the enabled rules', () => {
    const html = '<div style="background:linear-gradient(#fff,#000)">🚀</div>'
    // Only no-gradients enabled: emoji should NOT be flagged.
    const v = lintHtml(html, ['no-gradients'])
    expect(v.some((x) => x.rule === 'no-gradients')).toBe(true)
    expect(v.some((x) => x.rule === 'no-emoji-icons')).toBe(false)
  })
})

describe('formatRulesForPrompt', () => {
  it('returns directives for the active rules, in catalog order', () => {
    const out = formatRulesForPrompt(['no-gradients', 'no-emoji-icons'])
    expect(out).toContain('Non-negotiable design rules')
    expect(out.toLowerCase()).toContain('gradient')
    expect(out.toLowerCase()).toContain('emoji')
  })

  it('returns empty when nothing is active', () => {
    expect(formatRulesForPrompt([])).toBe('')
  })
})

describe('aiRules catalog', () => {
  it('every rule has a group that exists and is on by default', () => {
    const groups = new Set(['surfaces', 'icons', 'type', 'copy', 'restraint', 'layout', 'motion', 'access'])
    for (const r of AI_RULES) {
      expect(groups.has(r.group ?? '')).toBe(true)
      expect(r.default).toBe(true)
      expect(r.description.length).toBeGreaterThan(0)
    }
    expect(Object.keys(defaultAiRules()).length).toBe(AI_RULES.length)
  })
})

describe('buildFoundationBlock', () => {
  it('returns the design DNA and weaves in the requested look', () => {
    const out = buildFoundationBlock({ look: 'editorial', designSystem: null, theme: 'light' })
    expect(out).toContain('DESIGN FOUNDATION')
    expect(out).toContain('editorial')
    expect(out).toContain('Theme: light')
  })
})
