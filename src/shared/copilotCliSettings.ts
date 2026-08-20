/**
 * Pure helpers for editing `~/.copilot/settings.json`, the Copilot CLI's own
 * settings file.
 *
 * We only ever touch one key: `storeTokenPlaintext`. Everything else in that
 * file belongs to the user (theme, allowedUrls, disabledMcpServers, sandbox,
 * model, ...) and must survive a round trip untouched — hence the merge-based
 * approach rather than writing a fresh object.
 *
 * Why the key matters: the CLI installs a macOS Keychain credential store at
 * startup unconditionally, so no environment variable stops the "wants to use
 * your confidential information" prompt. `storeTokenPlaintext` is the only
 * documented lever — it routes token reads to `~/.copilot/config.json`
 * instead, which is why enabling it costs encryption at rest.
 *
 * Verified: a CLI run against a settings file written by this module reports
 * `config_storeTokenPlaintext: "true"` in its own config dump, so the file we
 * produce is accepted and applied. Not verified: that this removes the prompt
 * in every case — the prompt could not be reproduced headlessly, so the
 * setting is offered as a user choice rather than applied automatically.
 */

export const STORE_TOKEN_PLAINTEXT = 'storeTokenPlaintext'

export type CliSettings = Record<string, unknown>

/**
 * Parse the settings file. Returns `null` when the text is not a JSON object,
 * which callers must treat as "refuse to write" — silently replacing a file we
 * failed to understand would destroy the user's configuration.
 *
 * Missing files are the caller's concern; pass `''` for those and you get `{}`.
 */
export function parseCliSettings(text: string): CliSettings | null {
  if (text.trim() === '') return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  return parsed as CliSettings
}

/** Whether plaintext token storage is currently on. Only `true` counts. */
export function readsStoreTokenPlaintext(settings: CliSettings): boolean {
  return settings[STORE_TOKEN_PLAINTEXT] === true
}

/**
 * Return a copy with the key set, or removed when disabling.
 *
 * Disabling deletes rather than writing `false` so that toggling on and back
 * off leaves the file exactly as we found it.
 */
export function withStoreTokenPlaintext(settings: CliSettings, enabled: boolean): CliSettings {
  const next: CliSettings = { ...settings }
  if (enabled) next[STORE_TOKEN_PLAINTEXT] = true
  else delete next[STORE_TOKEN_PLAINTEXT]
  return next
}

/** Serialize the way the CLI writes it: 2-space indent, trailing newline. */
export function serializeCliSettings(settings: CliSettings): string {
  return `${JSON.stringify(settings, null, 2)}\n`
}
