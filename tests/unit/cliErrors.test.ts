import { describe, it, expect } from 'vitest'
import { classifyCliError, pokeAllowedForError, describeCliError } from '../../src/shared/cliErrors'

describe('classifyCliError', () => {
  it('treats empty output as unknown', () => {
    expect(classifyCliError('')).toBe('unknown')
  })

  it('treats ordinary output with no error as unknown', () => {
    expect(classifyCliError('Reading src/main/pty.ts\nDone in 1.2s')).toBe('unknown')
  })

  describe('fatal conditions', () => {
    const fatal = [
      'Error: 401 Unauthorized',
      'HTTP 403 Forbidden',
      'authentication failed',
      'token expired',
      'credentials invalid',
      'Please re-login to continue',
      'quota exceeded',
      'insufficient credits',
      'monthly limit reached',
      'model gpt-9 not found',
      'permission denied',
      'EACCES: permission denied',
      'ENOENT: no such file or directory',
      'copilot: command not found'
    ]
    for (const text of fatal) {
      it(`stops on: ${text}`, () => {
        expect(classifyCliError(text)).toBe('fatal')
      })
    }
  })

  describe('transient conditions', () => {
    const transient = [
      'Error: 429 Too Many Requests',
      'HTTP 503',
      'rate limited, slow down',
      'ECONNRESET',
      'ETIMEDOUT',
      'EAI_AGAIN',
      'network error',
      'connection reset',
      'request timed out',
      'temporary failure, try again',
      'service unavailable',
      'upstream error'
    ]
    for (const text of transient) {
      it(`retries on: ${text}`, () => {
        expect(classifyCliError(text)).toBe('transient')
      })
    }
  })

  // The asymmetry that keeps the loop from running away: a message can look
  // retryable and still describe a permanent condition.
  it('prefers fatal when both signals are present', () => {
    expect(classifyCliError('429: monthly quota exceeded, try again next month')).toBe('fatal')
  })

  it('is case insensitive', () => {
    expect(classifyCliError('AUTHENTICATION FAILED')).toBe('fatal')
    expect(classifyCliError('Connection Reset')).toBe('transient')
  })

  it('does not fire on prose that merely mentions the words', () => {
    expect(classifyCliError('Updated the retry docs for the network module')).not.toBe('fatal')
  })
})

describe('pokeAllowedForError', () => {
  it('blocks only fatal', () => {
    expect(pokeAllowedForError('fatal')).toBe(false)
    expect(pokeAllowedForError('transient')).toBe(true)
  })

  // Most turns end with no error text at all. Refusing to continue whenever we
  // cannot prove things are fine would disable the feature in the normal case.
  it('allows unknown, because silence is the common case not a failure', () => {
    expect(pokeAllowedForError('unknown')).toBe(true)
  })
})

describe('describeCliError', () => {
  it('gives every kind a distinct human explanation', () => {
    const all = ['fatal', 'transient', 'unknown'] as const
    const texts = all.map(describeCliError)
    expect(new Set(texts).size).toBe(3)
    for (const t of texts) expect(t.length).toBeGreaterThan(0)
  })
})
