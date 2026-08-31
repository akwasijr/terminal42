import { describe, expect, it } from 'vitest'
import { analyzeGoalQuality, goalQualityGateScore } from '../../src/shared/goalQuality'

describe('analyzeGoalQuality', () => {
  it('scores climbable goals high when they include a target and verification', () => {
    const analysis = analyzeGoalQuality('Cut terminal render time for a 10k-line log below 100ms, measured by npm run bench:terminal in src/renderer/src/components/TerminalPane.tsx.')

    expect(analysis.score).toBeGreaterThanOrEqual(goalQualityGateScore())
    expect(analysis.suggestions).toEqual([])
    expect(analysis.reasons.some((reason) => reason.kind === 'measurable-target')).toBe(true)
    expect(analysis.reasons.some((reason) => reason.kind === 'verification-method')).toBe(true)
  })

  it('scores vague goals low and explains the missing reward signal', () => {
    const analysis = analyzeGoalQuality('Please improve the composer and make the terminal faster and cleaner so the whole app feels nicer to use.')

    expect(analysis.score).toBeLessThan(72)
    expect(analysis.suggestions.length).toBeGreaterThan(0)
    expect(analysis.reasons.some((reason) => reason.text.includes('“faster”'))).toBe(true)
    expect(analysis.reasons.some((reason) => reason.kind === 'missing-measure')).toBe(true)
  })

  it('keeps anchored vague words from dominating a measurable goal', () => {
    const analysis = analyzeGoalQuality('Make terminal startup faster by reducing cold start below 800ms, verified with npm run bench:startup.')

    expect(analysis.score).toBeGreaterThanOrEqual(85)
    expect(analysis.reasons.filter((reason) => reason.kind === 'vague-language')).toHaveLength(0)
  })

  it('does not flag greetings or short exchanges', () => {
    for (const text of ['hi', 'thanks', 'ok', 'run the tests']) {
      const analysis = analyzeGoalQuality(text)
      expect(analysis.isLikelyGoal).toBe(false)
    }
  })

  it('does not flag questions', () => {
    const text = 'Can you explain why the composer gets slower when the prompt includes a pasted log?'
    const analysis = analyzeGoalQuality(text)

    expect(analysis.isLikelyGoal).toBe(false)
  })

  it('does not flag pasted stack traces', () => {
    const text = `TypeError: Cannot read properties of undefined
    at renderComposer (/Users/me/terminal42/src/renderer/src/components/Composer.tsx:42:11)
    at App (/Users/me/terminal42/src/renderer/src/App.tsx:12:3)`
    const analysis = analyzeGoalQuality(text)

    expect(analysis.isLikelyGoal).toBe(false)
  })

  it('is deterministic across repeated calls', () => {
    const text = 'Improve prompt handling in Composer.tsx so pasted multi-line commands are nicer and easier to use.'

    expect(analyzeGoalQuality(text)).toEqual(analyzeGoalQuality(text))
  })

  it('references the offending text in suggestions for vague language', () => {
    const analysis = analyzeGoalQuality('Improve the renderer so it is faster and cleaner for everyday work in the app.')

    expect(analysis.suggestions.some((suggestion) => suggestion.includes('faster'))).toBe(true)
    expect(analysis.suggestions.some((suggestion) => suggestion.includes('cleaner'))).toBe(true)
  })

  it('does not treat a concise operational command as a goal to score', () => {
    const analysis = analyzeGoalQuality('run npm test for the renderer package')

    expect(analysis.isLikelyGoal).toBe(false)
  })
})
