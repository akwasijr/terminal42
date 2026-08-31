import { describe, it, expect } from 'vitest'
import { agentSource, withAgent, FRAME_CHANNEL } from '../../src/shared/frameAgent'

describe('agentSource', () => {
  const src = agentSource()

  it('is valid script', () => {
    expect(() => new Function(src)).not.toThrow()
  })

  it('carries the shared helpers rather than a second copy of the rules', () => {
    for (const name of ['computeSelector', 'readStyles', 'classifyToken', 'readProjectTokens']) {
      expect(src).toContain(`var ${name} =`)
    }
    // The bodies came across, not just the names.
    expect(src).toContain('nth-of-type')
    expect(src).toContain('t42-selected')
  })

  it('can be asked to jump to a slide', () => {
    expect(src).toContain("m.kind === 'slideTo'")
    expect(src).toContain('var slideTo = function')
  })

  it('refers to nothing it does not define', () => {
    // Anything from module scope would be undefined inside a served page.
    expect(src).not.toContain('import ')
    expect(src).not.toContain('export ')
    expect(src).not.toContain('require(')
  })

  it('will not install itself twice', () => {
    expect(src).toContain('if (window.__t42agent) return')
  })

  it('announces itself, so a canvas that was already waiting hears it', () => {
    expect(src).toContain("post({ t42: 'ready' })")
  })

  it('answers on the one channel', () => {
    expect(src.split(FRAME_CHANNEL).length - 1).toBeGreaterThanOrEqual(2)
  })
})

describe('withAgent', () => {
  it('puts the agent last in the body', () => {
    const out = withAgent('<html><body><h1>Hi</h1></body></html>')
    expect(out.indexOf('<h1>')).toBeLessThan(out.indexOf('__t42agent'))
    expect(out).toMatch(/<\/script><\/body>/)
  })

  it('falls back to the end of the document when there is no body', () => {
    expect(withAgent('<html><p>x</p></html>')).toMatch(/<\/script><\/html>/)
  })

  it('appends to a fragment that closes nothing', () => {
    expect(withAgent('<p>x</p>')).toMatch(/^<p>x<\/p><script>/)
  })

  it('leaves what was there alone', () => {
    const html = '<html><body><h1>Hi</h1></body></html>'
    expect(withAgent(html)).toContain('<h1>Hi</h1>')
  })
})
