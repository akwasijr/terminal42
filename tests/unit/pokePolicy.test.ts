import { describe, it, expect } from 'vitest'
import {
  shouldPoke,
  pokesWithoutProgress,
  describeSkip,
  QUIESCENCE_MS,
  USER_ACTIVE_MS,
  COOLDOWN_MS,
  MAX_POKES_WITHOUT_PROGRESS,
  type PokeSignals,
  type TodoCounts,
  type PokeSkipReason
} from '../../src/shared/pokePolicy'

const NOW = 1_000_000

function counts(p: Partial<TodoCounts> = {}): TodoCounts {
  const c = { in_progress: 0, pending: 2, done: 1, blocked: 0, ...p }
  return { ...c, total: c.in_progress + c.pending + c.done + c.blocked }
}

// A session that is safe to poke. Each test perturbs exactly one signal so a
// failure names the rule that broke.
function signals(over: Partial<PokeSignals> = {}): PokeSignals {
  return {
    now: NOW,
    enabled: true,
    lastOutputAt: NOW - QUIESCENCE_MS - 1000,
    lastUserInputAt: NOW - USER_ACTIVE_MS - 1000,
    status: 'idle',
    counts: counts(),
    history: [],
    ...over
  }
}

function skipReason(over: Partial<PokeSignals>): PokeSkipReason | null {
  const d = shouldPoke(signals(over))
  return d.poke ? null : d.reason
}

describe('shouldPoke — the case it exists for', () => {
  it('pokes an idle session that still has open todos', () => {
    const decision = shouldPoke(signals())
    expect(decision.poke).toBe(true)
    if (decision.poke) {
      expect(decision.remaining).toBe(2)
      expect(decision.message).toMatch(/continue/i)
    }
  })

  it('counts in-progress items as outstanding', () => {
    const decision = shouldPoke(signals({ counts: counts({ pending: 0, in_progress: 1 }) }))
    expect(decision.poke).toBe(true)
  })
})

describe('shouldPoke — safety rules', () => {
  it('never pokes a session showing a permission prompt', () => {
    // The rule that makes this feature safe to ship: injected text at an
    // approval prompt answers a question the user never saw.
    expect(skipReason({ status: 'waiting' })).toBe('awaiting-user')
  })

  it('never pokes while the agent is working', () => {
    expect(skipReason({ status: 'working' })).toBe('still-working')
  })

  it('never pokes while output is still flowing', () => {
    // A pause mid-turn is not an ending; the model thinks and tools run.
    expect(skipReason({ lastOutputAt: NOW - 500 })).toBe('still-working')
    expect(skipReason({ lastOutputAt: NOW - QUIESCENCE_MS + 1 })).toBe('still-working')
  })

  it('never types into a session the user is using', () => {
    expect(skipReason({ lastUserInputAt: NOW - 1000 })).toBe('user-active')
    expect(skipReason({ lastUserInputAt: NOW - USER_ACTIVE_MS + 1 })).toBe('user-active')
  })

  it('is off unless explicitly enabled', () => {
    // Opt-in: writing into a live terminal is not a safe default.
    expect(skipReason({ enabled: false })).toBe('disabled')
  })

  it('checks enablement before anything else', () => {
    // Guards against a future reordering that could act on a disabled session.
    expect(skipReason({ enabled: false, status: 'waiting', counts: counts({ pending: 9 }) })).toBe('disabled')
  })
})

describe('shouldPoke — knowing when to stop', () => {
  it('does not poke when there is no todo list', () => {
    expect(skipReason({ counts: counts({ pending: 0, in_progress: 0, done: 0, blocked: 0 }) })).toBe('no-todos')
  })

  it('does not poke when everything is done', () => {
    expect(skipReason({ counts: counts({ pending: 0, in_progress: 0, done: 4 }) })).toBe('nothing-actionable')
  })

  it('treats blocked-only work as not actionable', () => {
    // Poking cannot unblock a blocked item, so treating it as outstanding
    // would nudge for ever with nothing to show for it.
    expect(skipReason({ counts: counts({ pending: 0, in_progress: 0, blocked: 3 }) })).toBe('nothing-actionable')
  })

  it('waits out the cooldown after a poke', () => {
    const history = [{ at: NOW - 1000, doneAtPoke: 0 }]
    expect(skipReason({ history })).toBe('cooldown')
    expect(skipReason({ history: [{ at: NOW - COOLDOWN_MS + 1, doneAtPoke: 0 }] })).toBe('cooldown')
  })

  it('gives up once pokes stop producing progress', () => {
    // The money-burning failure mode: an agent that cannot finish, nudged
    // for ever. Two fruitless pokes and we stop.
    const history = Array.from({ length: MAX_POKES_WITHOUT_PROGRESS }, (_, i) => ({
      at: NOW - COOLDOWN_MS * (i + 2),
      doneAtPoke: 1
    }))
    expect(skipReason({ history, counts: counts({ done: 1 }) })).toBe('no-progress')
  })

  it('keeps going while pokes are still completing work', () => {
    // Same number of past pokes, but the done count has risen since, so the
    // budget resets and the session is still worth nudging.
    const history = Array.from({ length: MAX_POKES_WITHOUT_PROGRESS + 3 }, (_, i) => ({
      at: NOW - COOLDOWN_MS * (i + 2),
      doneAtPoke: 1
    }))
    expect(shouldPoke(signals({ history, counts: counts({ done: 5 }) })).poke).toBe(true)
  })
})

describe('pokesWithoutProgress', () => {
  it('counts only the fruitless tail', () => {
    const history = [
      { at: 1, doneAtPoke: 0 },
      { at: 2, doneAtPoke: 1 },
      { at: 3, doneAtPoke: 3 },
      { at: 4, doneAtPoke: 3 }
    ]
    // done is 3 now: the last two pokes achieved nothing, the earlier ones did.
    expect(pokesWithoutProgress(history, 3)).toBe(2)
  })

  it('is zero when the latest poke produced work', () => {
    expect(pokesWithoutProgress([{ at: 1, doneAtPoke: 2 }], 3)).toBe(0)
  })

  it('is zero with no history', () => {
    expect(pokesWithoutProgress([], 0)).toBe(0)
  })
})

describe('describeSkip', () => {
  it('explains every reason the policy can return', () => {
    const reasons: PokeSkipReason[] = [
      'disabled', 'no-todos', 'nothing-actionable', 'still-working',
      'awaiting-user', 'user-active', 'cooldown', 'no-progress'
    ]
    for (const r of reasons) {
      expect(describeSkip(r), r).toMatch(/\S/)
    }
  })
})
