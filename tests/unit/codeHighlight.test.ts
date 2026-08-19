import { describe, it, expect } from 'vitest'
import { tokensForLine } from '../../src/renderer/src/components/CodePane'
import { languageForPath } from '../../src/renderer/src/lib/highlight'
import type { DiffLine } from '../../src/shared/lineDiff'
import type { CodeToken } from '../../src/renderer/src/lib/highlight'

// Highlighting is decoration, but mis-highlighting is not: colouring a row
// with another row's tokens would silently show the user code that isn't
// there. These pin the rule that a row only ever gets tokens proven to belong
// to it, and falls back to plain text otherwise.

const tok = (...parts: string[]): CodeToken[] => parts.map((content) => ({ content, color: '#fff' }))

const line = (over: Partial<DiffLine>): DiffLine => ({
  kind: 'ctx',
  text: '',
  beforeNo: null,
  afterNo: null,
  ...over
})

describe('tokensForLine', () => {
  const before = [tok('const ', 'a'), tok('old line')]
  const after = [tok('const ', 'a'), tok('new line'), tok('extra')]

  it('takes an added line from the after side', () => {
    const got = tokensForLine(line({ kind: 'add', text: 'new line', afterNo: 2 }), { before, after })
    expect(got?.map((t) => t.content).join('')).toBe('new line')
  })

  it('takes a deleted line from the before side', () => {
    const got = tokensForLine(line({ kind: 'del', text: 'old line', beforeNo: 2 }), { before, after })
    expect(got?.map((t) => t.content).join('')).toBe('old line')
  })

  it('takes a context line from the after side', () => {
    const got = tokensForLine(
      line({ kind: 'ctx', text: 'const a', beforeNo: 1, afterNo: 1 }),
      { before, after }
    )
    expect(got?.map((t) => t.content).join('')).toBe('const a')
  })

  // The important one: a deleted row must never be coloured using the after
  // text that replaced it.
  it('does not colour a deleted line with the after side', () => {
    const got = tokensForLine(line({ kind: 'del', text: 'old line', beforeNo: 2 }), {
      before: null,
      after
    })
    expect(got).toBeNull()
  })

  it('falls back to plain text when the token text does not match the row', () => {
    const got = tokensForLine(line({ kind: 'add', text: 'something else', afterNo: 2 }), {
      before,
      after
    })
    expect(got).toBeNull()
  })

  it('falls back when the line number is past the end of the tokens', () => {
    expect(tokensForLine(line({ kind: 'add', text: 'x', afterNo: 99 }), { before, after })).toBeNull()
  })

  it('falls back when nothing has been highlighted yet', () => {
    expect(
      tokensForLine(line({ kind: 'add', text: 'new line', afterNo: 2 }), { before: null, after: null })
    ).toBeNull()
  })

  it('falls back when the row has no line number on its own side', () => {
    expect(tokensForLine(line({ kind: 'add', text: 'new line', afterNo: null }), { before, after })).toBeNull()
  })
})

describe('languageForPath', () => {
  it('maps common source extensions', () => {
    expect(languageForPath('src/main/chat.ts')).toBe('typescript')
    expect(languageForPath('App.tsx')).toBe('tsx')
    expect(languageForPath('a/b/style.css')).toBe('css')
    expect(languageForPath('package.json')).toBe('json')
    expect(languageForPath('main.py')).toBe('python')
    expect(languageForPath('cmd/server/main.go')).toBe('go')
  })

  it('is case insensitive', () => {
    expect(languageForPath('README.MD')).toBe('markdown')
  })

  it('recognises files identified by name rather than extension', () => {
    expect(languageForPath('Dockerfile')).toBe('shellscript')
    expect(languageForPath('project/.gitignore')).toBe('shellscript')
  })

  it('returns null for an unknown extension rather than guessing', () => {
    expect(languageForPath('notes.wat')).toBeNull()
    expect(languageForPath('logo.png')).toBeNull()
  })

  it('returns null for a file with no extension', () => {
    expect(languageForPath('LICENSE')).toBeNull()
  })

  it('does not mistake a dotted directory for an extension', () => {
    expect(languageForPath('my.app/config')).toBeNull()
  })
})
