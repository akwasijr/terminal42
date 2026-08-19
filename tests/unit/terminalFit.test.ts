import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// FitAddon derives the row count from getComputedStyle(host).height. Under
// border-box that reports the *padded* height while the usable box is smaller,
// and FitAddon only subtracts padding found on the .xterm element itself — not
// on the host it was opened into. Padding on the host is therefore counted as
// space that does not exist, and the terminal renders one row more than fits,
// clipping the bottom line in half. This is invisible to the type system and
// to every existing test, so it is guarded at the source.
const SOURCE = readFileSync(
  resolve(__dirname, '../../src/renderer/src/components/TerminalPane.tsx'),
  'utf8'
)

describe('terminal fit geometry', () => {
  it('opens xterm into an element that carries no padding', () => {
    const host = /<div\s+ref=\{containerRef\}[^>]*className="([^"]*)"/.exec(SOURCE)
    expect(host, 'could not find the xterm host element').not.toBeNull()
    const classes = host![1].split(/\s+/)
    const padding = classes.filter((c) => /^-?p[xytrbl]?-/.test(c))
    expect(padding, `host must not be padded, found: ${padding.join(' ')}`).toEqual([])
  })

  it('still leaves breathing room via a wrapper', () => {
    // The spacing itself is intentional; losing it would be a silent regression
    // in the other direction, with text jammed against the panel edge.
    expect(SOURCE).toMatch(/className="h-full w-full px-4[^"]*"[\s\S]{0,120}ref=\{containerRef\}/)
  })
})
