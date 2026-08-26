import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8')

const SWITCH_FILES = [
  'src/renderer/src/components/motion/controls.tsx',
  'src/renderer/src/components/motion/MotionPanels.tsx',
  'src/renderer/src/components/DesignWizard.tsx',
  'src/renderer/src/components/DesignSystemWizard.tsx'
]

describe('toggle switch knobs', () => {
  // A knob is positioned absolutely and then slid with translate-x. Without an
  // explicit left, it starts from its static position instead of the track's
  // edge, and because a <button> centres its content an empty inline box lands
  // at the middle of the track. The translate then carried it clean outside.
  it.each(SWITCH_FILES)('pins the knob to the track in %s', (file) => {
    const src = read(file)
    const knobs = src.match(/absolute[^`'"]*\bh-3 w-3 rounded-full[^`'"]*/g) ?? []
    expect(knobs.length).toBeGreaterThan(0)
    for (const knob of knobs) expect(knob).toMatch(/\bleft-0\b/)
  })
})

describe('SegmentedRow', () => {
  const src = read('src/renderer/src/components/motion/controls.tsx')
  const body = src.slice(src.indexOf('export function SegmentedRow'))
  const row = body.slice(0, body.indexOf('\n}\n'))

  // "Front" rendered as "Fr…" and "9:16" as "9:…" because each option was
  // flex-1 (basis 0), so options shrank to nothing rather than wrapping.
  it('never truncates an option', () => {
    expect(row).not.toMatch(/\btruncate\b/)
    expect(row).not.toMatch(/\bflex-1\b/)
    expect(row).toMatch(/whitespace-nowrap/)
  })

  it('lets the row wrap instead of counting options', () => {
    expect(row).toMatch(/flex-wrap/)
    // The old rule guessed from the option count, which missed three short
    // options sitting beside a long label.
    expect(row).not.toMatch(/options\.length > \d/)
  })
})
