// Retiring a token instead of deleting it, and carrying other tools' metadata.

import { describe, it, expect } from 'vitest'
import { setDeprecated } from '../../src/shared/tokens/edit'
import { formatTokensForPrompt, toDTCG } from '../../src/shared/tokens/export'
import { fromTokensJson, fromTokensText } from '../../src/shared/tokens/import'
import type { TokenStudio } from '../../src/shared/tokens/types'

const studio: TokenStudio = {
  id: 'ts',
  name: 'Ours',
  sets: [
    {
      id: 's1',
      name: 'All',
      order: 0,
      tokens: [
        { id: '1', path: 'palette.blue', type: 'color', value: '#0000ff', tier: 'primitive' },
        { id: '2', path: 'colour.text', type: 'color', value: '{palette.blue}', tier: 'semantic' },
        { id: '3', path: 'colour.old', type: 'color', value: '{palette.blue}', tier: 'semantic' }
      ]
    }
  ],
  themes: [{ id: 'one', name: 'One', sets: { s1: 'enabled' } }],
  activeTheme: 'one'
}

const retired = setDeprecated(studio, 's1', 'colour.old', {
  severity: 'warning',
  message: 'Use colour.text instead'
})

describe('setDeprecated', () => {
  it('marks the one token and leaves the rest alone', () => {
    const tokens = retired.sets[0].tokens
    expect(tokens.find((t) => t.path === 'colour.old')?.deprecated).toEqual({
      severity: 'warning',
      message: 'Use colour.text instead'
    })
    expect(tokens.find((t) => t.path === 'colour.text')?.deprecated).toBeUndefined()
  })

  it('takes the mark off cleanly rather than leaving an empty one behind', () => {
    const back = setDeprecated(retired, 's1', 'colour.old', null)
    const token = back.sets[0].tokens.find((t) => t.path === 'colour.old')
    expect(token && 'deprecated' in token).toBe(false)
  })

  it('leaves the token working', () => {
    expect(retired.sets[0].tokens.find((t) => t.path === 'colour.old')?.value).toBe('{palette.blue}')
  })
})

describe('what a model is told', () => {
  it('is not told about a token it should stop reaching for', () => {
    const prompt = formatTokensForPrompt(retired, 'one')
    expect(prompt).toContain('--colour-text')
    expect(prompt).not.toContain('--colour-old')
  })

  it('still exports it, because designs already name it', () => {
    const json = JSON.parse(toDTCG(retired, 'one'))
    expect(json.colour.old.$value).toBe('#0000ff')
    expect(json.colour.old.$deprecated).toEqual({
      severity: 'warning',
      message: 'Use colour.text instead'
    })
  })
})

describe('metadata survives a round trip', () => {
  it('comes back with the deprecation intact', () => {
    const { studio: back } = fromTokensText(toDTCG(retired, 'one'), 'Back')
    expect(back.sets[0].tokens.find((t) => t.path === 'colour.old')?.deprecated).toEqual({
      severity: 'warning',
      message: 'Use colour.text instead'
    })
  })

  it('carries a field we do not understand out again untouched', () => {
    const ext = { 'studio.tokens': { modify: { type: 'lighten' } } }
    const { studio: back } = fromTokensJson(
      { a: { b: { $type: 'color', $value: '#fff', $extensions: ext } } },
      'Ext'
    )
    expect(back.sets[0].tokens[0].extensions).toEqual(ext)
    expect(JSON.parse(toDTCG(back, back.activeTheme)).a.b.$extensions).toEqual(ext)
  })

  it('reads the short form some files use', () => {
    const { studio: back } = fromTokensJson(
      { a: { $type: 'color', $value: '#fff', $deprecated: true } },
      'Short'
    )
    expect(back.sets[0].tokens[0].deprecated).toEqual({ severity: 'warning' })
  })

  it('drops a deprecation it cannot read rather than guessing', () => {
    const { studio: back } = fromTokensJson(
      { a: { $type: 'color', $value: '#fff', $deprecated: 'sometime' } },
      'Junk'
    )
    expect(back.sets[0].tokens[0].deprecated).toBeUndefined()
  })
})
