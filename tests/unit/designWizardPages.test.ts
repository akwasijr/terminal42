import { describe, it, expect } from 'vitest'
import { pagesForState } from '../../src/renderer/src/lib/designBrief'

describe('pagesForState — streamlined website flow', () => {
  const web = pagesForState({ category: 'web', kind: 'website', target: 'html' })

  it('drops the steps that do not matter for generating a site', () => {
    for (const p of [
      'surface', 'fidelity', 'stack', 'shape', 'icons', 'density', 'spacing', 'grid', 'motion', 'inspiration',
    ]) {
      expect(web).not.toContain(p)
    }
  })

  it('keeps the decisions that shape a site, plus brief + defaults', () => {
    expect(web).toContain('idea')
    expect(web).toContain('defaults')
    expect(web).toContain('summary')
    // and it is genuinely shorter than the old full flow
    expect(web.length).toBeLessThan(12)
  })

  it('leaves non-web (app) kinds on their full flow', () => {
    const app = pagesForState({ category: 'app', kind: 'dashboard', target: 'html' })
    // an app/dashboard still gets the precision steps a site does not
    expect(app.length).toBeGreaterThan(web.length)
  })
})
