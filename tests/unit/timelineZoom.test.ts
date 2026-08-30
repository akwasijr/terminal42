import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../../src/renderer/src')
const timeline = readFileSync(join(root, 'components/motion/MotionTimeline.tsx'), 'utf8')
const studio = readFileSync(join(root, 'components/motion/MotionStudio.tsx'), 'utf8')
const pane = readFileSync(join(root, 'lib/motion/paneWidth.ts'), 'utf8')

describe('the whole timeline is in view before you zoom', () => {
  it('shows the lanes for every element without being asked', () => {
    // A lane you have to unfold is a lane you do not know is there.
    const open = timeline.match(/const \[open, setOpen\] = useState\((true|false)\)/)
    expect(open?.[1], 'the layer list no longer starts open').toBe('true')
  })

  it('grows the pane to hold its rows unless you sized it yourself', () => {
    expect(studio).toContain('timelineHeightChosen')
    expect(studio).toMatch(/timelineHeightChosen\s*\?\s*timelineHeight/)
    expect(studio).toContain('ResizeObserver')
  })

  it('counts the card margin, which scrollHeight leaves out', () => {
    expect(studio).toContain('TIMELINE_CARD_MARGIN')
  })

  it('remembers whether a size was chosen or merely defaulted', () => {
    expect(pane).toMatch(/\[number, \(n: number\) => void, boolean\]/)
    expect(pane).toContain('setChosen(true)')
  })
})

describe('zoom is the only thing that makes the timeline scroll sideways', () => {
  it('does not offer a scrollbar at rest', () => {
    expect(timeline).toMatch(/zoom > 1 \? 'overflow-x-auto' : 'overflow-x-clip'/)
  })

  it('widens the track rather than repositioning every key', () => {
    // Every lane places things in percentages, so a wider track rescales the
    // playhead, the ticks and the keys together for free.
    expect(timeline).toMatch(/width: `\$\{zoom \* 100\}%`/)
    expect(timeline).toContain("minWidth: '100%'")
  })

  it('re-spaces the ruler instead of crowding it', () => {
    expect(timeline).toMatch(/tickStep\(durationSec \/ Math\.max\(1, zoom\)\)/)
  })

  it('keeps the row names and buttons put while the lanes move', () => {
    expect(timeline).toContain('LABEL_STICK')
    expect(timeline).toContain('TAIL_STICK')
  })
})

describe('nothing wipes the piece from one click', () => {
  it('has no bulk clear control', () => {
    // Clearing is what selecting a key and deleting it is for. A button that
    // threw away every key on the piece sat where a single row's controls sit.
    expect(timeline).not.toMatch(/>\s*Clear\s*</)
  })
})
