import { describe, it, expect } from 'vitest'
import { contextDisplay, contextAgeMs, formatTokens, CONTEXT_STALE_MS } from '../../src/shared/contextUsage'

const NOW = Date.UTC(2026, 7, 20, 12, 0, 0)
const iso = (msAgo: number): string => new Date(NOW - msAgo).toISOString()

const usage = (over: Partial<Parameters<typeof contextDisplay>[0] & object> = {}): NonNullable<Parameters<typeof contextDisplay>[0]> => ({
  inputTokens: 69_300,
  contextLimit: 200_000,
  percent: 35,
  sourceTimestamp: iso(1000),
  ...over
})

const show = (u: Parameters<typeof contextDisplay>[0], hasSession = true) =>
  contextDisplay(u, { hasSession, now: NOW })

describe('contextDisplay', () => {
  it('presents a fresh reading', () => {
    const d = show(usage())
    expect(d).not.toBeNull()
    expect(d!.percent).toBe(35)
    expect(d!.usedOfLimit).toBe('69k / 200k')
  })

  it('hides when there is no session', () => {
    expect(show(usage(), false)).toBeNull()
  })

  it('hides when there is no reading at all', () => {
    expect(show(null)).toBeNull()
    expect(show(undefined)).toBeNull()
  })

  it('hides before the CLI has reported any tokens', () => {
    expect(show(usage({ inputTokens: 0 }))).toBeNull()
  })

  it('hides when the context limit is unknown', () => {
    expect(show(usage({ contextLimit: 0 }))).toBeNull()
  })

  // The whole point of this module: both tabs now hide at the same moment.
  it('hides a reading older than the staleness cutoff', () => {
    expect(show(usage({ sourceTimestamp: iso(CONTEXT_STALE_MS + 1000) }))).toBeNull()
  })

  it('still shows a reading just inside the cutoff', () => {
    expect(show(usage({ sourceTimestamp: iso(CONTEXT_STALE_MS - 1000) }))).not.toBeNull()
  })

  it('hides a reading with no timestamp rather than trusting it', () => {
    expect(show(usage({ sourceTimestamp: null }))).toBeNull()
  })

  it('hides a reading with an unparseable timestamp', () => {
    expect(show(usage({ sourceTimestamp: 'not a date' }))).toBeNull()
  })

  it('reports age so callers can say how fresh the number is', () => {
    expect(show(usage({ sourceTimestamp: iso(90_000) }))!.ageMs).toBe(90_000)
  })

  describe('tone', () => {
    it('is normal below 75%', () => {
      expect(show(usage({ percent: 74 }))!.tone).toBe('normal')
    })
    it('warns from 75%', () => {
      expect(show(usage({ percent: 75 }))!.tone).toBe('warning')
    })
    it('is critical from 90%', () => {
      expect(show(usage({ percent: 90 }))!.tone).toBe('critical')
    })
  })

  it('clamps a nonsensical percentage instead of rendering it', () => {
    expect(show(usage({ percent: 240 }))!.percent).toBe(100)
    expect(show(usage({ percent: -5 }))!.percent).toBe(0)
    expect(show(usage({ percent: NaN }))!.percent).toBe(0)
  })
})

describe('contextAgeMs', () => {
  it('treats a missing timestamp as infinitely old', () => {
    expect(contextAgeMs(null, NOW)).toBe(Infinity)
  })

  it('never returns a negative age for a clock-skewed future timestamp', () => {
    expect(contextAgeMs(new Date(NOW + 60_000).toISOString(), NOW)).toBe(0)
  })
})

describe('formatTokens', () => {
  it('leaves small counts alone', () => {
    expect(formatTokens(900)).toBe('900')
  })
  it('uses one decimal below 10k', () => {
    expect(formatTokens(1234)).toBe('1.2k')
    expect(formatTokens(9999)).toBe('10.0k')
  })
  it('rounds to whole k at and above 10k', () => {
    expect(formatTokens(69_300)).toBe('69k')
    expect(formatTokens(200_000)).toBe('200k')
  })
  it('does not render a negative or non-finite count', () => {
    expect(formatTokens(-1)).toBe('0')
    expect(formatTokens(NaN)).toBe('0')
  })
})
