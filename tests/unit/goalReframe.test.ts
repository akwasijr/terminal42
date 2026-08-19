import { describe, expect, it } from 'vitest'
import { HILL_GATE } from '../../src/shared/sessionInsights'
import { meetsHillGate, reframeGoal, renderGoalReframePrompt } from '../../src/shared/goalReframe'

describe('goal reframing', () => {
  it('pushes back on vague performance goals with metric, baseline, target, and feedback loop slots', () => {
    const reframe = reframeGoal('make the app faster and improve the user experience across the board')

    expect(reframe.rawScore).toBe(6)
    expect(reframe.credibleScore).toBe(6)
    expect(reframe.meetsGate).toBe(false)
    expect(reframe.shouldPushBack).toBe(true)
    expect(kindsOf(reframe)).toEqual(
      expect.arrayContaining(['measurable_quantity', 'current_baseline', 'target_value', 'feedback_loop'])
    )
    expect(reframe.feedbackLoop.examples).toContain('npm run bench')
  })

  it('maps codebase cleanup goals to concrete missing elements without inventing numbers', () => {
    const reframe = reframeGoal('clean up the codebase and make everything better and more maintainable')

    expect(reframe.rawScore).toBe(13)
    expect(kindsOf(reframe)).toEqual(
      expect.arrayContaining(['affected_surface', 'measurable_quantity', 'current_baseline', 'target_value', 'feedback_loop'])
    )
    expect(renderGoalReframePrompt(reframe)).toContain('<current baseline>')
    expect(renderGoalReframePrompt(reframe)).toContain('<target value>')
    expect(renderGoalReframePrompt(reframe)).not.toContain('1583ms')
  })

  it('does not push back on a fully measurable benchmark goal', () => {
    const reframe = reframeGoal('reduce terminal cold start from 1583ms to under 800ms, measured by npm run bench')

    expect(reframe.rawScore).toBe(100)
    expect(reframe.meetsGate).toBe(true)
    expect(reframe.shouldPushBack).toBe(false)
    expect(reframe.missing).toHaveLength(0)
  })

  it('uses the shared hill gate for goals that pass the threshold', () => {
    const reframe = reframeGoal('get all 413 unit tests passing after refactoring the pty module')

    expect(HILL_GATE).toBe(72)
    expect(reframe.rawScore).toBe(76)
    expect(meetsHillGate(reframe.credibleScore)).toBe(true)
    expect(reframe.shouldPushBack).toBe(false)
  })

  it('does not trust high scores on text too short to judge', () => {
    const reframe = reframeGoal('Validate schema')

    expect(reframe.rawScore).toBe(100)
    expect(reframe.credibleScore).toBeNull()
    expect(reframe.meetsGate).toBe(false)
    // Unjudgeable is not the same as bad: a short title earns no score, and
    // so it also earns no lecture.
    expect(reframe.shouldPushBack).toBe(false)
    expect(kindsOf(reframe)).toContain('objective')
  })

  it('renders a terse prompt-injectable reframe string', () => {
    const prompt = renderGoalReframePrompt(
      reframeGoal('make the terminal faster and improve the whole experience for everyone')
    )

    // Asserts behaviour rather than exact wording: it must ask for a
    // measurable restatement and stay short enough to spend on a live message.
    expect(prompt).toMatch(/measurable/i)
    expect(prompt).toContain('<metric>')
    expect(prompt.length).toBeLessThan(420)
  })
})

function kindsOf(reframe: ReturnType<typeof reframeGoal>): string[] {
  return reframe.missing.map((item) => item.kind)
}

describe('renderGoalReframePrompt restraint', () => {
  const STRONG = 'reduce terminal cold start from 1583ms to under 800ms, measured by npm run bench'

  // This is spliced into a live prompt. Demanding a rewrite of a goal that
  // already scores 100 would make the feature actively harmful.
  it('says nothing at all about a goal that passes the gate', () => {
    expect(renderGoalReframePrompt(reframeGoal(STRONG))).toBe('')
  })

  it('does not echo slots the goal already satisfies', () => {
    const out = renderGoalReframePrompt(reframeGoal('make the app faster and improve the user experience across the board'))
    expect(out).not.toContain('<existing')
  })

  it('still asks for what is genuinely missing', () => {
    const out = renderGoalReframePrompt(reframeGoal('make the app faster and improve the user experience across the board'))
    expect(out).toContain('<metric>')
    expect(out).toContain('feedback_loop')
  })

  it('stays short enough to spend on every message', () => {
    const out = renderGoalReframePrompt(reframeGoal('clean up the codebase and make everything better and more maintainable'))
    expect(out.length).toBeLessThan(400)
  })
})

describe('push-back restraint on everyday messages', () => {
  // The injection runs on every chat message, so anything that is not clearly
  // a weak goal has to stay silent. Lecturing "commit this" about metrics is
  // how a useful nudge becomes noise the user learns to ignore.
  const EVERYDAY = [
    'fix the login bug',
    'whats in this file?',
    'run the tests',
    'add a dark mode toggle',
    'why is this failing?',
    'commit this',
    'make the button blue',
    'thanks!',
    'explain how pty.ts works',
    'add a hero section to the landing page'
  ]
  for (const message of EVERYDAY) {
    it(`stays quiet for: ${message}`, () => {
      expect(renderGoalReframePrompt(reframeGoal(message))).toBe('')
    })
  }

  it('does not push back on text too short to judge', () => {
    expect(reframeGoal('Validate schema').shouldPushBack).toBe(false)
  })

  const VAGUE_GOALS = [
    'make the terminal faster and improve the whole experience',
    'clean up the codebase and make everything better and more maintainable',
    'make the app faster and improve the user experience across the board'
  ]
  for (const goal of VAGUE_GOALS) {
    it(`still pushes back on: ${goal}`, () => {
      expect(renderGoalReframePrompt(reframeGoal(goal))).not.toBe('')
    })
  }
})
