import { describe, it, expect } from 'vitest'
import { vibeFromWords, vibeScores, words } from '../../src/renderer/src/lib/vibeFromWords'

describe('words', () => {
  it('splits on anything that is not a letter or hyphen', () => {
    expect(words('Clean, calm — lots of space!')).toEqual(['clean', 'calm', 'lots', 'of', 'space'])
  })
  it('keeps hyphenated words whole', () => {
    expect(words('a high-end feel')).toEqual(['a', 'high-end', 'feel'])
  })
  it('gives nothing back for an empty description', () => {
    expect(words('')).toEqual([])
  })
})

describe('vibeFromWords', () => {
  it('falls back to minimal when nothing matches', () => {
    expect(vibeFromWords('something about widgets')).toBe('minimal')
  })
  it('keeps the caller fallback when nothing matches', () => {
    expect(vibeFromWords('something about widgets', 'luxe')).toBe('luxe')
  })
  it('reads a plain description', () => {
    expect(vibeFromWords('clean and calm with lots of whitespace')).toBe('minimal')
    expect(vibeFromWords('a serious enterprise banking dashboard')).toBe('professional')
    expect(vibeFromWords('loud, dramatic, high contrast')).toBe('bold')
    expect(vibeFromWords('fun and friendly for kids')).toBe('playful')
    expect(vibeFromWords('gentle pastels for a wellness app')).toBe('soft')
    expect(vibeFromWords('editorial serif, refined like a magazine')).toBe('elegant')
    expect(vibeFromWords('raw, stark, angular concrete')).toBe('brutalist')
    expect(vibeFromWords('a dense monospace developer tool')).toBe('technical')
    expect(vibeFromWords('premium gold, expensive and exclusive')).toBe('luxe')
  })
  it('ignores case and punctuation', () => {
    expect(vibeFromWords('LUXURY. PREMIUM! GOLD?')).toBe('luxe')
  })
  it('picks the feel with the most hits when two are named', () => {
    expect(vibeFromWords('clean but mostly premium, luxury, gold and exclusive')).toBe('luxe')
  })
  it('breaks a tie towards the earlier feel', () => {
    expect(vibeFromWords('minimal luxe')).toBe('minimal')
  })
})

describe('vibeScores', () => {
  it('counts each vocabulary word once', () => {
    expect(vibeScores('gold gold gold').luxe).toBe(1)
  })
  it('scores every feel', () => {
    expect(Object.keys(vibeScores('anything'))).toHaveLength(9)
  })
})
