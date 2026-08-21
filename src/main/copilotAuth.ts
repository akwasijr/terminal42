// Supplying an auth token to spawned `copilot` processes.
//
// NOTE ON THE KEYCHAIN DIALOG: this does NOT stop it. That was the original
// intent, and it was wrong. Verified against the CLI's own debug log: with
// COPILOT_GITHUB_TOKEN set, the CLI still creates a macOS keychain entry for
// service `copilot-cli` and reads it ("get password from entry Cred { service:
// \"copilot-cli\" }"). The credential store is instantiated at startup
// regardless of the environment.
//
// The setting that actually suppresses the read is `storeTokenPlaintext` in
// ~/.copilot/settings.json — measured at 0 keychain reads with it, 1 without —
// but that writes the token unencrypted to ~/.copilot/config.json, which is a
// trade-off for the user to make, not this app.
//
// What this module is still good for: handing a token to a CLI that would
// otherwise have none, e.g. when the app is launched from Finder and the
// CLI's own `gh auth token` lookup fails. It is an availability fallback, not
// a privacy measure.
//
// The token is held in memory for the life of the process and never written to
// disk, logged, or sent to the renderer.

import { agentEnv } from './browserShim'
import { execFile } from 'node:child_process'

/** Env vars the CLI checks, in its own order of precedence. */
const TOKEN_VARS = ['COPILOT_GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN'] as const

/**
 * Cached result of asking `gh`. `undefined` means "not asked yet"; `null` means
 * "asked, and there is no token" — which must be remembered too, or every turn
 * would pay for another failed lookup.
 */
let cached: string | null | undefined
let cachedAt = 0

/**
 * How long a lookup is trusted.
 *
 * `gh` hands out tokens that expire, and the CLI prefers the token we give it
 * over its own working keychain login — so a cache that never expired turned
 * "the app has been open since yesterday" into "every turn fails to
 * authenticate". Observed exactly that. Re-asking `gh` costs a few
 * milliseconds against a local credential store, so the window is short.
 */
const CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Forget the cached token.
 *
 * Called when the CLI rejects it, so the next turn asks `gh` again instead of
 * failing the same way forever.
 */
export function invalidateCopilotToken(): void {
  cached = undefined
  cachedAt = 0
}

function cacheIsFresh(): boolean {
  return cached !== undefined && Date.now() - cachedAt < CACHE_TTL_MS
}

/** Classic PATs are explicitly unsupported by the CLI, so they are not offered. */
function isUsableToken(t: string): boolean {
  const token = t.trim()
  if (token.length < 20) return false
  if (token.startsWith('ghp_')) return false
  return true
}

/**
 * Ask the GitHub CLI for its token.
 *
 * Killed after a short deadline: `gh` can sit waiting on its own credential
 * prompt, and a hung lookup here would stall the user's turn — the exact
 * problem this module exists to avoid.
 */
function askGh(timeoutMs = 3000): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false
    const done = (v: string | null): void => {
      if (!settled) { settled = true; resolve(v) }
    }
    try {
      const child = execFile('gh', ['auth', 'token'], { timeout: timeoutMs }, (err, stdout) => {
        if (err || !stdout) return done(null)
        const token = String(stdout).trim()
        done(isUsableToken(token) ? token : null)
      })
      child.on('error', () => done(null))
    } catch {
      done(null)
    }
    setTimeout(() => done(null), timeoutMs + 500)
  })
}

/**
 * A token to pass to the CLI, or null to let it authenticate on its own.
 *
 * An existing environment variable wins: the user set it deliberately, and
 * overriding it would silently run as a different account.
 */
export async function resolveCopilotToken(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  for (const key of TOKEN_VARS) {
    const v = env[key]
    if (v && isUsableToken(v)) return null
  }
  if (cacheIsFresh()) return cached ?? null
  cached = await askGh()
  cachedAt = Date.now()
  return cached
}

/**
 * Environment for a spawned `copilot`, with a token added when one is available.
 *
 * Returns a new object; the caller's env is never mutated.
 */
export async function copilotEnv(base: NodeJS.ProcessEnv = process.env): Promise<NodeJS.ProcessEnv> {
  const token = await resolveCopilotToken(base)
  if (!token) return agentEnv({ ...base })
  return agentEnv({ ...base, COPILOT_GITHUB_TOKEN: token })
}

/**
 * Same, but without waiting.
 *
 * Most of the places that launch the CLI sit inside synchronous code —
 * `send` returns its result synchronously, and pty spawning is a sync IPC
 * handler — so threading a promise through them would change signatures all
 * the way up for what is only an optimisation. Instead `primeCopilotToken` runs
 * once at startup and this reads the settled result.
 *
 * If the lookup has not finished yet, this returns the environment unchanged
 * and the CLI authenticates exactly as it did before. The keychain prompt is
 * what we are avoiding, not something we are required to avoid.
 */
export function copilotEnvSync(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  for (const key of TOKEN_VARS) {
    const v = base[key]
    if (v && isUsableToken(v)) return agentEnv({ ...base })
  }
  // A stale token is worse than none: the CLI prefers what we hand it over
  // its own keychain login, so passing an expired one turns a working setup
  // into "copilot exited with code 1". Past the window, say nothing and let
  // the CLI authenticate itself, and start a refresh for the next turn.
  if (!cached || !cacheIsFresh()) {
    if (!cacheIsFresh()) primeCopilotToken()
    return agentEnv({ ...base })
  }
  return agentEnv({ ...base, COPILOT_GITHUB_TOKEN: cached })
}

/**
 * Start the token lookup so `copilotEnvSync` has an answer by the time the user
 * sends anything. Safe to call more than once; failure is not fatal.
 */
export function primeCopilotToken(): void {
  void resolveCopilotToken().catch(() => {})
}

/** Testing seam: forget the cached lookup. */
export function resetCopilotTokenCache(): void {
  cached = undefined
  cachedAt = 0
}

/** Testing seam: pretend a lookup happened, with control over how long ago. */
export function __setCachedTokenForTest(token: string | null, ageMs = 0): void {
  cached = token
  cachedAt = Date.now() - ageMs
}

/** The window a lookup is trusted for, exposed so tests do not guess it. */
export const TOKEN_CACHE_TTL_MS = CACHE_TTL_MS
