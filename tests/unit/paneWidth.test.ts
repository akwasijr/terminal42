import { describe, it, expect } from 'vitest'
import {
  paneWidthStyle,
  clampChatWidth,
  PANE_MIN_WIDTH,
  CHAT_MIN_WIDTH,
  CHAT_MAX_WIDTH,
  CHAT_DEFAULT_WIDTH
} from '../../src/renderer/src/components/paneWidth'

describe('paneWidthStyle', () => {
  it('uses a fixed width when one is given', () => {
    expect(paneWidthStyle(480)).toEqual({ width: '480px', minWidth: `${PANE_MIN_WIDTH}px` })
  })

  it('fills the remaining space when asked to', () => {
    expect(paneWidthStyle(0)).toEqual({ flex: '1 1 0%', minWidth: `${PANE_MIN_WIDTH}px` })
  })

  // A pane that renders `width: NaNpx` collapses to nothing and looks like the
  // preview failed, which is the exact bug this guards.
  it('fills rather than collapsing on a corrupted width', () => {
    for (const bad of [NaN, Infinity, -Infinity, -20]) {
      expect(paneWidthStyle(bad), String(bad)).toEqual({
        flex: '1 1 0%',
        minWidth: `${PANE_MIN_WIDTH}px`
      })
    }
  })

  it('never emits a fractional pixel width', () => {
    expect(paneWidthStyle(480.6).width).toBe('481px')
  })

  it('honours a caller-supplied minimum', () => {
    expect(paneWidthStyle(0, 200).minWidth).toBe('200px')
  })
})

describe('clampChatWidth', () => {
  it('keeps the composer usable at the low end', () => {
    expect(clampChatWidth(10)).toBe(CHAT_MIN_WIDTH)
  })

  it('stops the chat crowding out the preview', () => {
    expect(clampChatWidth(5000)).toBe(CHAT_MAX_WIDTH)
  })

  it('passes a sane width through', () => {
    expect(clampChatWidth(420)).toBe(420)
  })

  it('falls back to the default on a corrupted stored value', () => {
    for (const bad of [NaN, Infinity]) expect(clampChatWidth(bad), String(bad)).toBe(CHAT_DEFAULT_WIDTH)
  })

  it('has a default inside its own bounds', () => {
    expect(CHAT_DEFAULT_WIDTH).toBeGreaterThanOrEqual(CHAT_MIN_WIDTH)
    expect(CHAT_DEFAULT_WIDTH).toBeLessThanOrEqual(CHAT_MAX_WIDTH)
  })
})
