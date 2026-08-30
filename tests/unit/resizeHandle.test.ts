import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '../../src/renderer/src')
const handle = readFileSync(join(root, 'components/motion/ResizeHandle.tsx'), 'utf8')
const studio = readFileSync(join(root, 'components/motion/MotionStudio.tsx'), 'utf8')

/**
 * The resize handle, on both axes.
 *
 * There is one handle rather than a horizontal one and a vertical one that
 * look alike, so what these guard is that the shared parts stay shared: the
 * axis is decided in one place, and every axis-dependent thing — the
 * coordinate, the cursor, the arrow keys, the aria orientation — is decided
 * from it rather than assumed.
 */
describe('ResizeHandle covers both axes', () => {
  it('offers a vertical side, so a pane above or below can be sized', () => {
    expect(handle).toMatch(/'left'\s*\|\s*'right'\s*\|\s*'top'\s*\|\s*'bottom'/)
  })

  it('reads clientY on the vertical axis and clientX on the horizontal one', () => {
    expect(handle).toContain('vertical ? e.clientY : e.clientX')
    expect(handle).toContain("const vertical = side === 'top' || side === 'bottom'")
  })

  it('grows the pane when you drag away from it, on either axis', () => {
    // 'left' and 'top' both have their pane before the handle, so a larger
    // coordinate means a larger pane; 'right' and 'bottom' are the reverse.
    expect(handle).toContain("side === 'left' || side === 'top' ? pos - d.pos : d.pos - pos")
  })

  it('uses the up and down arrows when it is vertical', () => {
    expect(handle).toContain("vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight']")
  })

  it('shows the cursor that matches the axis', () => {
    expect(handle).toContain('cursor-row-resize')
    expect(handle).toContain('cursor-col-resize')
  })

  it('reports the orientation of the separator, not of the split', () => {
    // A left/right split is divided by a vertical line and the other way
    // round, which is the opposite of what the side name suggests.
    expect(handle).toContain("aria-orientation={vertical ? 'horizontal' : 'vertical'}")
  })

  it('keeps a per-side reset that a caller can override', () => {
    expect(handle).toContain('reset ?? DEFAULT_RESET[side]')
  })
})

describe('the Motion timeline is a pane', () => {
  it('remembers its height under its own key, clamped', () => {
    expect(studio).toContain("useStoredWidth('motion.timelinePane', 240, 120, 620)")
  })

  it('sits below a vertical handle that sizes it', () => {
    expect(studio).toMatch(/label="Timeline height"[\s\S]{0,200}side="bottom"/)
  })

  it('scrolls rather than growing past the height it was given', () => {
    expect(studio).toMatch(/overflow-y-auto"[\s\S]{0,80}style=\{\{ height: timelinePaneHeight \}\}/)
  })

  it('leaves the stage on flex-1, so the two share the column', () => {
    // If the stage were fixed too, growing the timeline would push the
    // bottom of the window off the screen instead of trading space with it.
    expect(studio).toContain('<div className="relative min-h-0 flex-1">')
  })
})
