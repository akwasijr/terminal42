import { describe, it, expect } from 'vitest'
import { STARTER_PROMPT_TEXTS } from '../../src/renderer/src/components/starterPrompts'
import { analyzeGoalQuality, shouldShowGoalQualityHint } from '../../src/shared/goalQuality'

// The starters are the first thing a new user ever sends. If one of them trips
// the harness's own "this goal may be hard to measure" hint, the very first
// thing the product does is scold the user for a prompt the product wrote —
// which teaches them the hint is noise. This test is the guard against that.

describe('starter prompts', () => {
  it('offers three distinct starters', () => {
    expect(STARTER_PROMPT_TEXTS).toHaveLength(3)
    expect(new Set(STARTER_PROMPT_TEXTS.map((p) => p.id)).size).toBe(3)
  })

  for (const p of STARTER_PROMPT_TEXTS) {
    it(`"${p.title}" does not trip the goal-quality hint`, () => {
      const analysis = analyzeGoalQuality(p.prompt)
      expect(
        shouldShowGoalQualityHint(p.prompt, analysis),
        `scored ${analysis.score}/100 — rewrite it with a stated target and a named way to verify it`
      ).toBe(false)
    })
  }

  it('keeps starters short enough to read at a glance', () => {
    for (const p of STARTER_PROMPT_TEXTS) {
      expect(p.prompt.split(/\s+/).length, p.id).toBeLessThanOrEqual(60)
      expect(p.title.split(/\s+/).length, p.id).toBeLessThanOrEqual(6)
    }
  })
})
