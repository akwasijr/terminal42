// Line-level diff for the code pane.
//
// Written rather than pulled in: the requirement is narrow (two strings in, a
// renderable line list out) and a dependency would still need this much
// wrapping. Being local also means the cost characteristics are ours to
// control, which matters because this runs on files of arbitrary size in the
// render path.
//
// Strategy: strip the common prefix and suffix first — for a typical edit that
// leaves a handful of lines — then run a real LCS over what remains. The LCS
// table is O(n*m), so it is only used below a size cap; past that the middle
// section is reported as a wholesale replacement, which stays correct and
// merely renders less precisely.

export type DiffLineKind = 'context' | 'add' | 'del'

export interface DiffLine {
  kind: DiffLineKind
  text: string
  /** 1-based line number in the "before" text, or null for added lines. */
  beforeNo: number | null
  /** 1-based line number in the "after" text, or null for removed lines. */
  afterNo: number | null
}

/** Beyond this many changed lines on a side, fall back to block replacement. */
export const LCS_LINE_CAP = 2000

function splitLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split('\n')
  // A trailing newline yields a final empty element that isn't a real line.
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** Longest common subsequence of two line arrays, as index pairs. */
function lcsPairs(a: string[], b: string[]): Array<[number, number]> {
  const n = a.length
  const m = b.length
  const table: Uint32Array = new Uint32Array((n + 1) * (m + 1))
  const at = (i: number, j: number): number => i * (m + 1) + j
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[at(i, j)] = a[i] === b[j]
        ? table[at(i + 1, j + 1)] + 1
        : Math.max(table[at(i + 1, j)], table[at(i, j + 1)])
    }
  }
  const pairs: Array<[number, number]> = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { pairs.push([i, j]); i++; j++ }
    else if (table[at(i + 1, j)] >= table[at(i, j + 1)]) i++
    else j++
  }
  return pairs
}

/**
 * Compare two texts and return every line, tagged and numbered.
 *
 * Removed lines carry their original number and added lines their new one, so
 * the renderer can show both gutters without recomputing anything.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = splitLines(before)
  const b = splitLines(after)

  // Common prefix.
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++

  // Common suffix, stopping before the prefix so the two never overlap.
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB-- }

  const out: DiffLine[] = []
  for (let i = 0; i < start; i++) {
    out.push({ kind: 'context', text: a[i], beforeNo: i + 1, afterNo: i + 1 })
  }

  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)

  if (midA.length > LCS_LINE_CAP || midB.length > LCS_LINE_CAP) {
    // Too large to align precisely; report as a wholesale replacement.
    midA.forEach((text, k) => out.push({ kind: 'del', text, beforeNo: start + k + 1, afterNo: null }))
    midB.forEach((text, k) => out.push({ kind: 'add', text, beforeNo: null, afterNo: start + k + 1 }))
  } else {
    const pairs = lcsPairs(midA, midB)
    let ia = 0
    let ib = 0
    const emitUpTo = (ta: number, tb: number): void => {
      while (ia < ta) { out.push({ kind: 'del', text: midA[ia], beforeNo: start + ia + 1, afterNo: null }); ia++ }
      while (ib < tb) { out.push({ kind: 'add', text: midB[ib], beforeNo: null, afterNo: start + ib + 1 }); ib++ }
    }
    for (const [pa, pb] of pairs) {
      emitUpTo(pa, pb)
      out.push({ kind: 'context', text: midA[pa], beforeNo: start + pa + 1, afterNo: start + pb + 1 })
      ia = pa + 1
      ib = pb + 1
    }
    emitUpTo(midA.length, midB.length)
  }

  // Trailing common suffix: numbering continues from each side's own offset.
  for (let k = 0; k < a.length - endA; k++) {
    out.push({ kind: 'context', text: a[endA + k], beforeNo: endA + k + 1, afterNo: endB + k + 1 })
  }

  return out
}

/** Count of added and removed lines in a diff. */
export function countChanges(lines: DiffLine[]): { additions: number; deletions: number } {
  let additions = 0
  let deletions = 0
  for (const l of lines) {
    if (l.kind === 'add') additions++
    else if (l.kind === 'del') deletions++
  }
  return { additions, deletions }
}
