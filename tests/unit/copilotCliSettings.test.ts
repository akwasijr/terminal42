import { describe, it, expect } from 'vitest'
import {
  parseCliSettings,
  readsStoreTokenPlaintext,
  serializeCliSettings,
  withStoreTokenPlaintext
} from '../../src/shared/copilotCliSettings'

// A trimmed copy of a real ~/.copilot/settings.json. Every one of these keys
// belongs to the user and none of them are ours to lose.
const REAL = `{
  "renderMarkdown": true,
  "theme": "high-contrast",
  "allowedUrls": [
    "http://127.0.0.1:6001"
  ],
  "disabledMcpServers": [
    "viztweak"
  ],
  "sandbox": {
    "enabled": false,
    "userPolicy": { "network": { "allowLocalNetwork": true } }
  },
  "model": "claude-opus-5"
}
`

describe('parseCliSettings', () => {
  it('reads an object', () => {
    expect(parseCliSettings('{"theme":"dark"}')).toEqual({ theme: 'dark' })
  })

  it('treats a missing/empty file as empty settings', () => {
    expect(parseCliSettings('')).toEqual({})
    expect(parseCliSettings('   \n ')).toEqual({})
  })

  it('refuses malformed JSON rather than guessing', () => {
    expect(parseCliSettings('{"theme": ')).toBeNull()
    expect(parseCliSettings('not json at all')).toBeNull()
  })

  it('refuses JSON that is not an object', () => {
    expect(parseCliSettings('[1,2,3]')).toBeNull()
    expect(parseCliSettings('null')).toBeNull()
    expect(parseCliSettings('"a string"')).toBeNull()
    expect(parseCliSettings('42')).toBeNull()
  })
})

describe('readsStoreTokenPlaintext', () => {
  it('is off when absent', () => {
    expect(readsStoreTokenPlaintext({ theme: 'dark' })).toBe(false)
  })

  it('is on only for a real true', () => {
    expect(readsStoreTokenPlaintext({ storeTokenPlaintext: true })).toBe(true)
    expect(readsStoreTokenPlaintext({ storeTokenPlaintext: false })).toBe(false)
    expect(readsStoreTokenPlaintext({ storeTokenPlaintext: 'true' })).toBe(false)
    expect(readsStoreTokenPlaintext({ storeTokenPlaintext: 1 })).toBe(false)
  })
})

describe('withStoreTokenPlaintext', () => {
  it('keeps every other key when enabling', () => {
    const before = parseCliSettings(REAL)!
    const after = withStoreTokenPlaintext(before, true)
    for (const key of Object.keys(before)) {
      expect(after[key]).toEqual(before[key])
    }
    expect(after.storeTokenPlaintext).toBe(true)
  })

  it('keeps nested structures intact', () => {
    const after = withStoreTokenPlaintext(parseCliSettings(REAL)!, true)
    expect(after.sandbox).toEqual({
      enabled: false,
      userPolicy: { network: { allowLocalNetwork: true } }
    })
    expect(after.disabledMcpServers).toEqual(['viztweak'])
  })

  it('does not mutate the input', () => {
    const before = parseCliSettings(REAL)!
    withStoreTokenPlaintext(before, true)
    expect('storeTokenPlaintext' in before).toBe(false)
  })

  it('removes the key when disabling, so on-then-off restores the original', () => {
    const before = parseCliSettings(REAL)!
    const roundTrip = withStoreTokenPlaintext(withStoreTokenPlaintext(before, true), false)
    expect(roundTrip).toEqual(before)
    expect('storeTokenPlaintext' in roundTrip).toBe(false)
  })

  it('is a no-op on disable when the key was never there', () => {
    const before = parseCliSettings(REAL)!
    expect(withStoreTokenPlaintext(before, false)).toEqual(before)
  })
})

describe('serializeCliSettings', () => {
  it('round-trips through parse unchanged', () => {
    const before = parseCliSettings(REAL)!
    const text = serializeCliSettings(withStoreTokenPlaintext(before, true))
    expect(parseCliSettings(text)).toEqual({ ...before, storeTokenPlaintext: true })
  })

  it('writes CLI-style 2-space indent and a trailing newline', () => {
    const text = serializeCliSettings({ theme: 'dark' })
    expect(text).toBe('{\n  "theme": "dark"\n}\n')
  })
})
