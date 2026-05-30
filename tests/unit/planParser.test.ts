import { describe, it, expect } from 'vitest'
import {
  buildPlanStateForMessage,
  stripPlanFences,
  containsPlanFence
} from '../../src/renderer/src/lib/planParser'

const planBlock = [
  '```plan',
  JSON.stringify({
    plan: [
      { id: 'design', title: 'Design the layout', detail: 'wireframe' },
      { id: 'build', title: 'Build it' },
      { id: 'verify', title: 'Verify' }
    ]
  }),
  '```'
].join('\n')

function update(obj: Record<string, unknown>): string {
  return ['```plan-update', JSON.stringify({ update: obj }), '```'].join('\n')
}

describe('buildPlanStateForMessage', () => {
  it('returns null when there is no plan fence', () => {
    expect(buildPlanStateForMessage('just some prose')).toBeNull()
    expect(buildPlanStateForMessage('')).toBeNull()
  })

  it('parses an initial plan into pending steps', () => {
    const state = buildPlanStateForMessage(planBlock)
    expect(state).not.toBeNull()
    expect(state!.steps.map((s) => s.id)).toEqual(['design', 'build', 'verify'])
    expect(state!.steps.every((s) => s.status === 'pending')).toBe(true)
    expect(state!.hasProgress).toBe(false)
    expect(state!.verified).toBe(false)
    expect(state!.steps[0].detail).toBe('wireframe')
  })

  it('applies plan-update status changes, last update wins', () => {
    const msg = [
      planBlock,
      update({ id: 'design', status: 'in_progress' }),
      update({ id: 'design', status: 'done', note: 'finished' })
    ].join('\n\n')
    const state = buildPlanStateForMessage(msg)!
    const design = state.steps.find((s) => s.id === 'design')!
    expect(design.status).toBe('done')
    expect(design.note).toBe('finished')
    expect(state.hasProgress).toBe(true)
  })

  it('marks verified only when the verify step is done', () => {
    const notDone = buildPlanStateForMessage([planBlock, update({ id: 'verify', status: 'in_progress' })].join('\n\n'))!
    expect(notDone.verified).toBe(false)
    const done = buildPlanStateForMessage([planBlock, update({ id: 'verify', status: 'done' })].join('\n\n'))!
    expect(done.verified).toBe(true)
  })

  it('ignores updates for unknown ids and invalid statuses', () => {
    const msg = [
      planBlock,
      update({ id: 'nope', status: 'done' }),
      update({ id: 'build', status: 'bogus' })
    ].join('\n\n')
    const state = buildPlanStateForMessage(msg)!
    expect(state.steps.find((s) => s.id === 'build')!.status).toBe('pending')
  })

  it('keeps a question for needs_input steps', () => {
    const state = buildPlanStateForMessage(
      [planBlock, update({ id: 'build', status: 'needs_input', question: 'Which framework?' })].join('\n\n')
    )!
    const build = state.steps.find((s) => s.id === 'build')!
    expect(build.status).toBe('needs_input')
    expect(build.question).toBe('Which framework?')
  })

  it('ignores a second plan block in the same message', () => {
    const second = ['```plan', JSON.stringify({ plan: [{ id: 'x', title: 'X' }] }), '```'].join('\n')
    const state = buildPlanStateForMessage([planBlock, second].join('\n\n'))!
    expect(state.steps.map((s) => s.id)).toEqual(['design', 'build', 'verify'])
  })
})

describe('stripPlanFences', () => {
  it('removes plan and plan-update fences, keeping prose', () => {
    const msg = ['Here is my plan.', planBlock, 'Working on it now.', update({ id: 'design', status: 'done' })].join('\n\n')
    const out = stripPlanFences(msg)
    expect(out).toContain('Here is my plan.')
    expect(out).toContain('Working on it now.')
    expect(out).not.toContain('```plan')
    expect(out).not.toContain('"update"')
  })

  it('collapses to empty when the message is only a plan block', () => {
    expect(stripPlanFences(planBlock)).toBe('')
  })
})

describe('containsPlanFence', () => {
  it('detects plan and plan-update fences', () => {
    expect(containsPlanFence(planBlock)).toBe(true)
    expect(containsPlanFence(update({ id: 'design', status: 'done' }))).toBe(true)
  })

  it('returns false for plain prose', () => {
    expect(containsPlanFence('no fences here')).toBe(false)
    expect(containsPlanFence('')).toBe(false)
  })
})
