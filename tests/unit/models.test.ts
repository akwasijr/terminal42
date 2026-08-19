import { describe, it, expect } from 'vitest'
import { FALLBACK_MODELS, inferGroup, compareGroups, resolveModelAgainst, GROUP_ORDER } from '../../src/shared/models'

// The fallback catalog used to exist twice, kept in sync by hand, and drifted
// — which is how retired models kept showing up in the picker. These guard the
// properties that made that drift possible.

describe('model catalog', () => {
  it('has no duplicate model IDs', () => {
    const ids = FALLBACK_MODELS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every model a label and a known provider group', () => {
    for (const m of FALLBACK_MODELS) {
      expect(m.label.trim()).not.toBe('')
      expect(GROUP_ORDER).toContain(m.group)
    }
  })

  it('declares a group matching what inferGroup derives from the ID', () => {
    // If these disagree, a live model and its fallback twin land in different
    // sections of the picker.
    for (const m of FALLBACK_MODELS) {
      expect(inferGroup(m.id)).toBe(m.group)
    }
  })

  it('routes new IDs from known providers to the right group', () => {
    expect(inferGroup('claude-opus-9')).toBe('Anthropic')
    expect(inferGroup('gpt-7-turbo')).toBe('OpenAI')
    expect(inferGroup('gemini-9-pro')).toBe('Google')
    expect(inferGroup('grok-9')).toBe('xAI')
    expect(inferGroup('mai-code-9')).toBe('Microsoft')
    expect(inferGroup('llama-4')).toBe('Other')
  })

  it('is large and varied enough to pass the live-fetch sanity check', () => {
    // main/models.ts refuses a fetched list of <3 entries or a single group;
    // the fallback must comfortably clear the same bar.
    expect(FALLBACK_MODELS.length).toBeGreaterThanOrEqual(5)
    expect(new Set(FALLBACK_MODELS.map((m) => m.group)).size).toBeGreaterThanOrEqual(2)
  })

  it('sorts known providers in order and unknown ones last', () => {
    const sorted = ['Other', 'Microsoft', 'Anthropic', 'Nope', 'OpenAI'].sort(compareGroups)
    expect(sorted.indexOf('Anthropic')).toBeLessThan(sorted.indexOf('OpenAI'))
    expect(sorted.indexOf('OpenAI')).toBeLessThan(sorted.indexOf('Microsoft'))
    expect(sorted.at(-1)).toBe('Nope')
  })

  it('does not list models that the CLI has retired', () => {
    // Entitlements for these no longer resolve; leaving them in the fallback
    // is what surfaced picker entries that failed on first use.
    const retired = ['claude-opus-4.5', 'claude-sonnet-4.5', 'gpt-5.2', 'gpt-4o', 'gpt-4.1']
    for (const id of retired) {
      expect(FALLBACK_MODELS.find((m) => m.id === id)).toBeUndefined()
    }
  })
})

describe('resolveModelAgainst', () => {
  const catalog = FALLBACK_MODELS

  it('passes through a model the catalog offers', () => {
    expect(resolveModelAgainst(catalog, 'claude-opus-5')).toBe('claude-opus-5')
  })

  it('passes through the CLI router', () => {
    // "auto" is not a catalog entry but is a valid --model value.
    expect(resolveModelAgainst(catalog, 'auto')).toBe('auto')
  })

  it('omits the flag when nothing was requested', () => {
    expect(resolveModelAgainst(catalog, null)).toBeNull()
    expect(resolveModelAgainst(catalog, undefined)).toBeNull()
    expect(resolveModelAgainst(catalog, '')).toBeNull()
  })

  it('strips internal decorations off a real model ID', () => {
    // The exact failure seen in the app: a session saved with the CLI's
    // internal 1M variant, which --model rejects outright.
    expect(resolveModelAgainst(catalog, 'claude-opus-4.7-1m-internal')).toBe('claude-opus-4.7')
    expect(resolveModelAgainst(catalog, 'claude-opus-4.7-high')).toBe('claude-opus-4.7')
    expect(resolveModelAgainst(catalog, 'claude-opus-4.6-1m')).toBe('claude-opus-4.6')
  })

  it('falls back within the same provider for a retired model', () => {
    const resolved = resolveModelAgainst(catalog, 'claude-opus-4.5')
    expect(resolved).not.toBeNull()
    expect(catalog.find((m) => m.id === resolved)?.group).toBe('Anthropic')
  })

  it('omits the flag for an unrecognisable provider rather than guessing', () => {
    expect(resolveModelAgainst(catalog, 'llama-4-405b')).toBeNull()
  })

  it('never returns a model missing from the catalog', () => {
    const ids = new Set(catalog.map((m) => m.id))
    for (const probe of ['claude-opus-4.5', 'gpt-4o', 'gemini-2.0-pro', 'grok-3', 'mai-code-0']) {
      const resolved = resolveModelAgainst(catalog, probe)
      if (resolved !== null) expect(ids.has(resolved)).toBe(true)
    }
  })
})
