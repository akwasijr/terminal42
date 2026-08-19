import { describe, it, expect, beforeEach } from 'vitest'
import { resolveCopilotToken, copilotEnv, resetCopilotTokenCache } from '../../src/main/copilotAuth'

// The point of this module is to stop a keychain dialog appearing on every
// turn. The risk is that in trying to avoid a prompt it quietly runs the agent
// as the wrong account, so these tests are mostly about what it must NOT do.

beforeEach(() => {
  resetCopilotTokenCache()
})

const FAKE = 'gho_' + 'a'.repeat(36)

describe('resolveCopilotToken', () => {
  it('defers to a token the user already set', async () => {
    // Overriding this would silently run as a different identity.
    expect(await resolveCopilotToken({ COPILOT_GITHUB_TOKEN: FAKE })).toBeNull()
    resetCopilotTokenCache()
    expect(await resolveCopilotToken({ GH_TOKEN: FAKE })).toBeNull()
    resetCopilotTokenCache()
    expect(await resolveCopilotToken({ GITHUB_TOKEN: FAKE })).toBeNull()
  })

  it('ignores an unusable value in the environment', async () => {
    // A truncated or placeholder value should not be mistaken for a real login,
    // otherwise the CLI is handed something that cannot work.
    const r = await resolveCopilotToken({ GH_TOKEN: 'x' })
    expect(r === null || typeof r === 'string').toBe(true)
    if (typeof r === 'string') expect(r.length).toBeGreaterThan(20)
  })

  it('rejects classic personal access tokens', async () => {
    // The CLI documents ghp_ tokens as unsupported; passing one would replace a
    // keychain prompt with an auth failure, which is worse.
    const r = await resolveCopilotToken({ GH_TOKEN: 'ghp_' + 'b'.repeat(36) })
    expect(r === null || !r.startsWith('ghp_')).toBe(true)
  })
})

describe('copilotEnv', () => {
  it('never mutates the environment it was given', async () => {
    const base = { PATH: '/usr/bin' } as NodeJS.ProcessEnv
    const out = await copilotEnv(base)
    expect(base.COPILOT_GITHUB_TOKEN).toBeUndefined()
    expect(out).not.toBe(base)
    expect(out.PATH).toBe('/usr/bin')
  })

  it('passes an existing environment through untouched', async () => {
    const base = { GH_TOKEN: FAKE, PATH: '/usr/bin' } as NodeJS.ProcessEnv
    const out = await copilotEnv(base)
    // The CLI will find GH_TOKEN by itself; adding a second variable would only
    // create a chance of the two disagreeing.
    expect(out.COPILOT_GITHUB_TOKEN).toBeUndefined()
    expect(out.GH_TOKEN).toBe(FAKE)
  })

  it('only ever adds a token, never removes other variables', async () => {
    const base = { PATH: '/usr/bin', HOME: '/home/x', FOO: 'bar' } as NodeJS.ProcessEnv
    const out = await copilotEnv(base)
    expect(out.PATH).toBe('/usr/bin')
    expect(out.HOME).toBe('/home/x')
    expect(out.FOO).toBe('bar')
  })

  it('resolves quickly enough not to stall a turn', async () => {
    const started = Date.now()
    await copilotEnv({ PATH: '/nonexistent' } as NodeJS.ProcessEnv)
    // `gh` may be missing or hung; the lookup is bounded either way.
    expect(Date.now() - started).toBeLessThan(5000)
  })

  it('caches the lookup so every turn does not pay for it', async () => {
    await copilotEnv({ PATH: '/usr/bin' } as NodeJS.ProcessEnv)
    const started = Date.now()
    await copilotEnv({ PATH: '/usr/bin' } as NodeJS.ProcessEnv)
    expect(Date.now() - started).toBeLessThan(100)
  })
})

describe('copilotEnvSync', () => {
  it('returns the environment unchanged before the lookup settles', async () => {
    const { copilotEnvSync } = await import('../../src/main/copilotAuth')
    resetCopilotTokenCache()
    const out = copilotEnvSync({ PATH: '/usr/bin' } as NodeJS.ProcessEnv)
    // Not yet resolved: the CLI must be left to authenticate as it always did
    // rather than be handed an empty or half-built value.
    expect(out.COPILOT_GITHUB_TOKEN).toBeUndefined()
    expect(out.PATH).toBe('/usr/bin')
  })

  it('defers to a token already in the environment', async () => {
    const { copilotEnvSync } = await import('../../src/main/copilotAuth')
    const out = copilotEnvSync({ GH_TOKEN: FAKE } as NodeJS.ProcessEnv)
    expect(out.COPILOT_GITHUB_TOKEN).toBeUndefined()
    expect(out.GH_TOKEN).toBe(FAKE)
  })

  it('supplies the token once the lookup has settled', async () => {
    const { copilotEnvSync, resolveCopilotToken } = await import('../../src/main/copilotAuth')
    resetCopilotTokenCache()
    const token = await resolveCopilotToken({ PATH: '/usr/bin' } as NodeJS.ProcessEnv)
    const out = copilotEnvSync({ PATH: '/usr/bin' } as NodeJS.ProcessEnv)
    if (token) {
      expect(out.COPILOT_GITHUB_TOKEN).toBe(token)
    } else {
      // No gh on this machine: still must not invent a value.
      expect(out.COPILOT_GITHUB_TOKEN).toBeUndefined()
    }
  })

  it('never mutates the environment it was given', async () => {
    const { copilotEnvSync } = await import('../../src/main/copilotAuth')
    const base = { PATH: '/usr/bin' } as NodeJS.ProcessEnv
    const out = copilotEnvSync(base)
    expect(base.COPILOT_GITHUB_TOKEN).toBeUndefined()
    expect(out).not.toBe(base)
  })
})
