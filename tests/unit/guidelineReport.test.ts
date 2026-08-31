import { describe, it, expect } from 'vitest'
import { buildReport, countLabel, reportSummary, applyPrompt } from '../../src/shared/guidelineReport'
import type { Finding } from '../../src/shared/guidelineScan'

const f = (id: string, count = 1): Finding => ({ id, count })

describe('buildReport', () => {
  it('has nothing to say about nothing', () => {
    expect(buildReport([])).toEqual([])
  })

  it('puts findings under their group', () => {
    const [section] = buildReport([f('inline-styles', 3)])
    expect(section.group.id).toBe('anti-ai')
    expect(section.rows[0].guideline.label).toBe('Inline styles')
  })

  it('adds up every occurrence in a group', () => {
    const [section] = buildReport([f('inline-styles', 3), f('div-soup', 2)])
    expect(section.total).toBe(5)
  })

  it('puts the busiest group first', () => {
    const sections = buildReport([f('no-lang', 1), f('inline-styles', 9)])
    expect(sections[0].group.id).toBe('anti-ai')
  })

  it('puts the busiest finding first inside a group', () => {
    const [section] = buildReport([f('div-soup', 1), f('inline-styles', 7)])
    expect(section.rows[0].guideline.id).toBe('inline-styles')
  })

  it('settles equal findings by name rather than by luck', () => {
    const [section] = buildReport([f('inline-styles', 2), f('div-soup', 2)])
    expect(section.rows.map((r) => r.guideline.id)).toEqual(['div-soup', 'inline-styles'])
  })

  it('drops a finding it has no rule for, rather than showing a bare id', () => {
    expect(buildReport([f('made-up-rule', 5)])).toEqual([])
  })

  it('keeps groups apart', () => {
    const sections = buildReport([f('inline-styles'), f('no-lang'), f('missing-alt')])
    expect(sections.map((s) => s.group.id).sort()).toEqual(['a11y', 'anti-ai', 'media'])
  })

  it('carries the example through to the row', () => {
    const sections = buildReport([{ id: 'inline-styles', count: 1, example: '<p style="a">' }])
    expect(sections[0].rows[0].finding.example).toBe('<p style="a">')
  })
})

describe('countLabel', () => {
  it('shows a number only where there is more than one', () => {
    expect(countLabel(f('a', 4))).toBe('4')
    expect(countLabel(f('a', 1))).toBe('')
  })
})

describe('reportSummary', () => {
  it('says so when there is nothing to change', () => {
    expect(reportSummary([], 'my-site')).toBe('my-site follows all of them.')
  })

  it('counts rules and areas', () => {
    const sections = buildReport([f('inline-styles', 9), f('no-lang')])
    expect(reportSummary(sections, 'my-site')).toBe('2 to change in my-site, across 2 areas.')
  })

  it('says area rather than areas for one', () => {
    const sections = buildReport([f('inline-styles', 9)])
    expect(reportSummary(sections, 'x')).toBe('1 to change in x, across 1 area.')
  })
})

describe('applyPrompt', () => {
  const sections = buildReport([f('inline-styles', 7), f('no-lang')])

  it('is empty when nothing was accepted, so nothing is sent', () => {
    expect(applyPrompt(sections, new Set())).toBe('')
  })

  it('includes only what is still ticked', () => {
    const text = applyPrompt(sections, new Set(['no-lang']))
    expect(text).toContain('No lang on html')
    expect(text).not.toContain('Inline styles')
  })

  it('carries the fix, so the agent is not asked to work it out again', () => {
    const text = applyPrompt(sections, new Set(['inline-styles']))
    expect(text).toContain('Move to a class')
  })

  it('says how many places, where there is more than one', () => {
    expect(applyPrompt(sections, new Set(['inline-styles']))).toContain('(7 places)')
    expect(applyPrompt(sections, new Set(['no-lang']))).not.toContain('places')
  })

  it('groups the instructions the way the report was read', () => {
    const text = applyPrompt(sections, new Set(['inline-styles', 'no-lang']))
    expect(text).toContain('AI defaults:')
    expect(text).toContain('Accessibility:')
    expect(text.indexOf('AI defaults:')).toBeLessThan(text.indexOf('Accessibility:'))
  })

  it('tells the agent to change nothing else', () => {
    const text = applyPrompt(sections, new Set(['no-lang']))
    expect(text).toContain('Change only what they ask for')
  })

  it('leaves out a group with nothing ticked in it', () => {
    expect(applyPrompt(sections, new Set(['no-lang']))).not.toContain('AI defaults:')
  })
})

/** The prompt is wrapped for reading, so a phrase may span two lines. */
const flat = (s: string): string => s.replace(/\s+/g, ' ')

describe('applyPrompt on a mount point', () => {
  const sections = buildReport([
    { id: 'no-lazy', count: 1, file: 'index.html', line: 3, sample: '<img>' }
  ])
  const accepted = new Set(['no-lazy'])

  it('asks for an edit when the page is real', () => {
    const p = applyPrompt(sections, accepted, { shell: false })
    expect(p).toContain('Apply these design guideline fixes to v001.html')
    expect(p).not.toContain('Rebuild')
  })

  it('asks for a rebuild when the page is only a mount point', () => {
    const p = applyPrompt(sections, accepted, { shell: true, files: ['source/App.jsx'] })
    expect(flat(p)).toContain('Rebuild it as a page that shows the project')
    expect(p).toContain('./source/')
    expect(p).not.toContain('Apply these design guideline fixes to v001.html')
  })

  it('says how much source there is to read', () => {
    expect(applyPrompt(sections, accepted, { files: ['a', 'b'] })).toContain('(2 files)')
    expect(applyPrompt(sections, accepted, { files: ['a'] })).toContain('(1 file)')
  })

  it('mentions no source when none was carried', () => {
    expect(applyPrompt(sections, accepted, { files: [] })).not.toContain('./source/')
  })

  it('is still empty when nothing is accepted', () => {
    expect(applyPrompt(sections, new Set(), { shell: true })).toBe('')
  })
})

describe('applyPrompt with a token library', () => {
  const sections = buildReport([
    { id: 'no-tokens', count: 1, file: 'a.css', line: 1, sample: 'color: #fff' }
  ])
  const accepted = new Set(['no-tokens'])
  const tokens = { name: 'Ember', block: ':root { --color-primary: #b34700 }' }

  it('puts the library in and says to use it instead', () => {
    const p = applyPrompt(sections, accepted, { tokens })
    expect(p).toContain('--color-primary: #b34700')
    expect(p).toContain('Use the Ember library above in place of the values')
  })

  it('says nothing about a library when none is attached', () => {
    expect(applyPrompt(sections, accepted)).not.toContain('in place of the values')
    expect(applyPrompt(sections, accepted, { tokens: null })).not.toContain('in place of the values')
  })

  it('still asks for a rebuild when the page is a shell', () => {
    const p = applyPrompt(sections, accepted, { shell: true, tokens })
    expect(flat(p)).toContain('Rebuild it as a page that shows the project')
    expect(p).toContain('Use the Ember library above')
  })

  it('keeps the library out when nothing is accepted', () => {
    expect(applyPrompt(sections, new Set(), { tokens })).toBe('')
  })
})

describe('applyPrompt keeps the page standing on its own', () => {
  const sections = buildReport([
    { id: 'no-tokens', count: 1, file: 'a.css', line: 1, sample: 'color: #fff' }
  ])
  const accepted = new Set(['no-tokens'])

  it('says every custom property must be declared, whatever the source', () => {
    for (const source of [{}, { shell: true }, { shell: false }]) {
      const p = flat(applyPrompt(sections, accepted, source))
      expect(p).toContain('must be declared in that same file with a real value')
      expect(p).toContain('Never refer to a variable that is not declared there')
    }
  })

  it('warns that an alias to a library name resolves to nothing', () => {
    const p = applyPrompt(sections, accepted, {
      tokens: { name: 'Minimal', block: ':root { --colour-brand-rest: #3730a3 }' }
    })
    expect(flat(p)).toContain('with their literal values')
    expect(flat(p)).toContain('leaves the page unstyled')
  })

  it('tells a rebuild not to invent content the source does not have', () => {
    const p = flat(applyPrompt(sections, accepted, { shell: true }))
    expect(p).toContain('Do not invent a product, sections or content the source does not have')
  })

  it('carries what a system says about itself, not only its values', () => {
    // Held to a system's colours and to none of its decisions is being
    // measured against a palette, not against a system.
    const p = applyPrompt(sections, accepted, {
      tokens: {
        name: 'Calm Care',
        block: ':root { --colour-brand: #7b8b7c }',
        covers: 'Patterns it has agreed: Login, Forms.\nDo not: use a dropdown for two options.'
      }
    })
    expect(flat(p)).toContain('Calm Care also says this about itself')
    expect(p).toContain('Patterns it has agreed: Login, Forms.')
    expect(p).toContain('Do not: use a dropdown for two options.')
  })

  it('says nothing about coverage when the system claims none', () => {
    const p = applyPrompt(sections, accepted, {
      tokens: { name: 'Calm Care', block: ':root { --colour-brand: #7b8b7c }' }
    })
    expect(p).not.toContain('also says this about itself')
  })
})
