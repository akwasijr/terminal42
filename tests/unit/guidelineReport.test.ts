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
    expect(p).toContain('Rebuild it as one self-contained page')
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
