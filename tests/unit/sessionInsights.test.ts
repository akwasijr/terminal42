import { describe, it, expect } from 'vitest'
import {
  HILL_GATE,
  canScoreGoal,
  scoreGoal,
  toTodoInsights,
  summarizeInsights,
  EMPTY_INSIGHTS
} from '../../src/shared/sessionInsights'

const LONG_VAGUE = 'make the app faster and improve the user experience across the board'
const LONG_GOOD = 'reduce terminal cold start from 1583ms to under 800ms, measured by npm run bench'

describe('canScoreGoal', () => {
  it('rejects text that is too short to judge', () => {
    expect(canScoreGoal('Validate schema')).toBe(false)
  })

  it('rejects long text that is only a couple of words', () => {
    expect(canScoreGoal('supercalifragilisticexpialidocious antidisestablishmentarianism')).toBe(false)
  })

  it('accepts text with enough length and enough words', () => {
    expect(canScoreGoal(LONG_VAGUE)).toBe(true)
  })
})

describe('scoreGoal', () => {
  // This is the defect the module exists to prevent: the underlying scorer
  // rates "Validate schema" at 100, so passing short text through would put a
  // perfect score on a goal with no metric in it at all.
  it('returns null rather than a flattering score for a short todo title', () => {
    expect(scoreGoal('Validate schema')).toBeNull()
  })

  it('scores a vague long goal below the gate', () => {
    const s = scoreGoal(LONG_VAGUE)
    expect(s).not.toBeNull()
    expect(s as number).toBeLessThan(HILL_GATE)
  })

  it('scores a measurable goal at or above the gate', () => {
    const s = scoreGoal(LONG_GOOD)
    expect(s).not.toBeNull()
    expect(s as number).toBeGreaterThanOrEqual(HILL_GATE)
  })
})

describe('toTodoInsights', () => {
  it('does not mark an unscorable goal as weak', () => {
    const [t] = toTodoInsights([{ text: 'Validate schema', status: 'pending' }])
    expect(t.hill).toBeNull()
    expect(t.weak).toBe(false)
  })

  it('marks a scored goal below the gate as weak', () => {
    const [t] = toTodoInsights([{ text: LONG_VAGUE, status: 'pending' }])
    expect(t.weak).toBe(true)
  })

  it('does not mark a strong goal as weak', () => {
    const [t] = toTodoInsights([{ text: LONG_GOOD, status: 'in_progress' }])
    expect(t.weak).toBe(false)
  })

  it('judges title and description together so detail in the description counts', () => {
    const bare = toTodoInsights([{ text: 'Speed up boot' }])[0]
    const described = toTodoInsights([
      { text: 'Speed up boot', description: LONG_GOOD }
    ])[0]
    expect(bare.hill).toBeNull()
    expect(described.hill).not.toBeNull()
  })

  it('falls back to the done flag when no status is present', () => {
    const rows = toTodoInsights([{ text: 'a', done: true }, { text: 'b', done: false }])
    expect(rows[0].status).toBe('done')
    expect(rows[1].status).toBe('pending')
  })

  it('gives every row a stable id even when the source has none', () => {
    const rows = toTodoInsights([{ text: 'a' }, { text: 'b' }])
    expect(new Set(rows.map((r) => r.id)).size).toBe(2)
  })
})

describe('summarizeInsights', () => {
  it('counts by status', () => {
    const s = summarizeInsights({
      tasks: [
        { text: 'a', status: 'done' },
        { text: 'b', status: 'pending' },
        { text: 'c', status: 'pending' },
        { text: 'd', status: 'blocked' }
      ]
    })
    expect(s.counts).toEqual({ pending: 2, in_progress: 0, done: 1, blocked: 1, total: 4 })
  })

  it('reports the denominator so a median is never read as covering everything', () => {
    const s = summarizeInsights({
      tasks: [{ text: 'Validate schema' }, { text: LONG_GOOD }]
    })
    expect(s.todos).toHaveLength(2)
    expect(s.scoredCount).toBe(1)
  })

  it('returns a null median when nothing was scorable', () => {
    const s = summarizeInsights({ tasks: [{ text: 'Validate schema' }] })
    expect(s.hillMedian).toBeNull()
  })

  it('averages the middle pair for an even number of scores', () => {
    const s = summarizeInsights({ tasks: [{ text: LONG_VAGUE }, { text: LONG_GOOD }] })
    const scores = s.todos.map((t) => t.hill).filter((h): h is number => h !== null).sort((a, b) => a - b)
    expect(s.hillMedian).toBe(Math.round((scores[0] + scores[1]) / 2))
  })

  it('defaults auto-continue to off rather than implying it is running', () => {
    expect(summarizeInsights({ tasks: [] }).autoContinue.enabled).toBe(false)
  })

  it('passes through memory count and auto-continue state', () => {
    const s = summarizeInsights({
      tasks: [],
      memories: 7,
      autoContinue: { enabled: true, pokes: 2, lastReason: 'cooldown' }
    })
    expect(s.memories).toBe(7)
    expect(s.autoContinue).toEqual({ enabled: true, pokes: 2, lastReason: 'cooldown' })
  })

  it('matches the empty constant for empty input', () => {
    expect(summarizeInsights({ tasks: [] })).toEqual(EMPTY_INSIGHTS)
  })
})
