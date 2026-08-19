import { describe, it, expect } from 'vitest'
import { diffLines, countChanges, LCS_LINE_CAP } from '../../src/shared/lineDiff'

/** Compact rendering used to keep expectations readable. */
function shape(before: string, after: string): string[] {
  return diffLines(before, after).map((l) => {
    const mark = l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' '
    return `${mark}${l.text}`
  })
}

describe('diffLines', () => {
  it('reports identical text as all context', () => {
    const lines = diffLines('a\nb\nc\n', 'a\nb\nc\n')
    expect(lines.every((l) => l.kind === 'context')).toBe(true)
    expect(lines).toHaveLength(3)
  })

  it('detects an appended line', () => {
    expect(shape('a\nb\n', 'a\nb\nc\n')).toEqual([' a', ' b', '+c'])
  })

  it('detects a removed line', () => {
    expect(shape('a\nb\nc\n', 'a\nc\n')).toEqual([' a', '-b', ' c'])
  })

  it('reports a replaced line as a removal followed by an addition', () => {
    expect(shape('a\nb\nc\n', 'a\nB\nc\n')).toEqual([' a', '-b', '+B', ' c'])
  })

  it('keeps unrelated regions as context when editing in two places', () => {
    expect(shape('a\nb\nc\nd\ne\n', 'a\nB\nc\nd\nE\n'))
      .toEqual([' a', '-b', '+B', ' c', ' d', '-e', '+E'])
  })

  it('handles an empty before (whole file added)', () => {
    expect(shape('', 'a\nb\n')).toEqual(['+a', '+b'])
  })

  it('handles an empty after (whole file removed)', () => {
    expect(shape('a\nb\n', '')).toEqual(['-a', '-b'])
  })

  it('treats two empty texts as no lines at all', () => {
    expect(diffLines('', '')).toEqual([])
  })

  it('does not invent a trailing blank line from the final newline', () => {
    expect(diffLines('a\n', 'a\n')).toHaveLength(1)
    expect(diffLines('a', 'a')).toHaveLength(1)
  })

  it('preserves genuinely blank lines inside the text', () => {
    expect(shape('a\n\nb\n', 'a\n\nb\nc\n')).toEqual([' a', ' ', ' b', '+c'])
  })

  describe('line numbering', () => {
    it('numbers both sides through an insertion', () => {
      const lines = diffLines('a\nc\n', 'a\nb\nc\n')
      expect(lines.map((l) => [l.kind, l.beforeNo, l.afterNo])).toEqual([
        ['context', 1, 1],
        ['add', null, 2],
        ['context', 2, 3]
      ])
    })

    it('numbers both sides through a deletion', () => {
      const lines = diffLines('a\nb\nc\n', 'a\nc\n')
      expect(lines.map((l) => [l.kind, l.beforeNo, l.afterNo])).toEqual([
        ['context', 1, 1],
        ['del', 2, null],
        ['context', 3, 2]
      ])
    })

    // The suffix is emitted separately from the aligned middle, so the two
    // sides' offsets have to be tracked independently.
    it('keeps the trailing context correctly numbered after a size change', () => {
      const lines = diffLines('a\nb\nc\nz\n', 'a\nz\n')
      const last = lines[lines.length - 1]
      expect(last).toMatchObject({ kind: 'context', text: 'z', beforeNo: 4, afterNo: 2 })
    })

    it('never numbers an added line on the before side', () => {
      const lines = diffLines('a\n', 'a\nb\nc\n')
      for (const l of lines.filter((x) => x.kind === 'add')) expect(l.beforeNo).toBeNull()
    })
  })

  describe('large inputs', () => {
    it('stays linear when a huge file is unchanged apart from one line', () => {
      const big = Array.from({ length: 20000 }, (_, i) => `line ${i}`).join('\n') + '\n'
      const edited = big.replace('line 9999\n', 'line 9999 CHANGED\n')
      const started = Date.now()
      const lines = diffLines(big, edited)
      // Prefix/suffix trimming should leave a trivial middle, so this must not
      // approach the LCS cap in cost.
      expect(Date.now() - started).toBeLessThan(2000)
      expect(countChanges(lines)).toEqual({ additions: 1, deletions: 1 })
    })

    it('falls back to block replacement past the cap instead of hanging', () => {
      const a = Array.from({ length: LCS_LINE_CAP + 10 }, (_, i) => `a${i}`).join('\n')
      const b = Array.from({ length: LCS_LINE_CAP + 10 }, (_, i) => `b${i}`).join('\n')
      const lines = diffLines(a, b)
      const counts = countChanges(lines)
      expect(counts.deletions).toBe(LCS_LINE_CAP + 10)
      expect(counts.additions).toBe(LCS_LINE_CAP + 10)
      expect(lines.some((l) => l.kind === 'context')).toBe(false)
    })
  })
})

describe('countChanges', () => {
  it('counts additions and deletions, ignoring context', () => {
    expect(countChanges(diffLines('a\nb\n', 'a\nB\nC\n'))).toEqual({ additions: 2, deletions: 1 })
  })

  it('returns zeroes for an unchanged file', () => {
    expect(countChanges(diffLines('a\n', 'a\n'))).toEqual({ additions: 0, deletions: 0 })
  })
})
