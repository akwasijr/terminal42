import { describe, it, expect, vi, beforeEach } from 'vitest'

// The policy is tested exhaustively in pokePolicy.test.ts. What these tests
// cover is the wiring, which is where a mistake would actually type into
// somebody's terminal: that the right signals reach the policy, and that a
// "no" is genuinely a no-op rather than a write nobody checked for.

const writeAgentPoke = vi.fn(() => true)
const snapshotSessions = vi.fn()
const readTodoCounts = vi.fn()
const getSettings = vi.fn()

vi.mock('electron', () => ({ BrowserWindow: class {} }))
vi.mock('../../src/main/pty', () => ({
  snapshotSessions: (...a: unknown[]) => snapshotSessions(...a),
  writeAgentPoke: (...a: unknown[]) => writeAgentPoke(...(a as [string, string]))
}))
vi.mock('../../src/main/tasks', () => ({
  readTodoCounts: (...a: unknown[]) => readTodoCounts(...a),
  SESSION_STATE_DIR: '/tmp/session-state'
}))
vi.mock('../../src/main/settings', () => ({ getSettings: () => getSettings() }))

const { runAutoPokeTick, stopAutoPoke } = await import('../../src/main/autoPoke')

const OPEN_TODOS = { in_progress: 0, pending: 2, done: 1, blocked: 0, total: 3 }

function session(over: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Date.now()
  return {
    id: 's1',
    copilotSessionId: 'copilot-1',
    // Old enough to clear both the quiescence and user-active guards.
    lastOutputAt: now - 120_000,
    lastInputAt: now - 120_000,
    scrollbackTail: 'all done here\n> ',
    ...over
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  stopAutoPoke()
  writeAgentPoke.mockReturnValue(true)
  readTodoCounts.mockReturnValue(OPEN_TODOS)
  getSettings.mockReturnValue({ autoContinueEnabled: true })
  snapshotSessions.mockReturnValue([session()])
})

const noWindow = (): null => null

describe('auto-poke wiring', () => {
  it('resumes an idle session that still has open todos', () => {
    runAutoPokeTick(noWindow)
    expect(writeAgentPoke).toHaveBeenCalled()
    const [id, text] = writeAgentPoke.mock.calls[0] as [string, string]
    expect(id).toBe('s1')
    expect(text).toMatch(/continue/i)
  })

  it('sends the newline as a separate write', () => {
    // Some prompts submit on the first Enter they see, so the message has to
    // be fully in the input line before anything is committed.
    runAutoPokeTick(noWindow)
    expect(writeAgentPoke.mock.calls.map((c) => c[1])).toEqual([expect.stringMatching(/continue/i), '\r'])
  })

  it('writes nothing when the feature is off', () => {
    getSettings.mockReturnValue({ autoContinueEnabled: false })
    runAutoPokeTick(noWindow)
    expect(writeAgentPoke).not.toHaveBeenCalled()
  })

  it('writes nothing when the session shows a permission prompt', () => {
    // End to end through the real classifier: this is the failure that would
    // approve something the user never saw.
    snapshotSessions.mockReturnValue([
      session({ scrollbackTail: 'Run `rm -rf build`?\nApprove [y/n]' })
    ])
    runAutoPokeTick(noWindow)
    expect(writeAgentPoke).not.toHaveBeenCalled()
  })

  it('writes nothing while the agent is still producing output', () => {
    snapshotSessions.mockReturnValue([session({ lastOutputAt: Date.now() })])
    runAutoPokeTick(noWindow)
    expect(writeAgentPoke).not.toHaveBeenCalled()
  })

  it('writes nothing while the user is typing', () => {
    snapshotSessions.mockReturnValue([session({ lastInputAt: Date.now() })])
    runAutoPokeTick(noWindow)
    expect(writeAgentPoke).not.toHaveBeenCalled()
  })

  it('ignores sessions with no linked Copilot session', () => {
    snapshotSessions.mockReturnValue([session({ copilotSessionId: null })])
    runAutoPokeTick(noWindow)
    expect(writeAgentPoke).not.toHaveBeenCalled()
  })

  it('respects the cooldown instead of poking every tick', () => {
    runAutoPokeTick(noWindow)
    expect(writeAgentPoke).toHaveBeenCalledTimes(2)
    writeAgentPoke.mockClear()
    runAutoPokeTick(noWindow)
    runAutoPokeTick(noWindow)
    expect(writeAgentPoke).not.toHaveBeenCalled()
  })

  it('survives an unreadable session database', () => {
    // A half-written or locked SQLite file must not kill the polling loop.
    readTodoCounts.mockImplementation(() => {
      throw new Error('database is locked')
    })
    expect(() => runAutoPokeTick(noWindow)).not.toThrow()
    expect(writeAgentPoke).not.toHaveBeenCalled()
  })
})

describe('auto-poke bookkeeping', () => {
  it('forgets history for sessions that have gone away', () => {
    runAutoPokeTick(noWindow)
    writeAgentPoke.mockClear()

    // Same id reappearing after a close is a genuinely new session, so it must
    // not inherit the previous one's cooldown.
    snapshotSessions.mockReturnValue([])
    runAutoPokeTick(noWindow)
    snapshotSessions.mockReturnValue([session()])
    runAutoPokeTick(noWindow)

    expect(writeAgentPoke).toHaveBeenCalled()
  })
})
