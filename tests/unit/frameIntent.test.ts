import { describe, expect, it } from 'vitest'
import { frameIntent, type Artboard } from '../../src/renderer/src/lib/artboards'

const ab = (id: string, x: number, y: number, w: number, h: number): Artboard =>
  ({ id, name: id, x, y, w, h, bg: '#ffffff' }) as Artboard

describe('frameIntent', () => {
  it('makes an artboard when there is nothing on the canvas', () => {
    expect(frameIntent([], 10, 10)).toBe('artboard')
  })

  it('makes an artboard when the point misses every artboard', () => {
    expect(frameIntent([ab('a', 0, 0, 100, 100)], 400, 400)).toBe('artboard')
  })

  it('makes a frame when the point lands inside an artboard', () => {
    expect(frameIntent([ab('a', 0, 0, 100, 100)], 50, 50)).toBe('frame')
  })

  it('treats the artboard edge as inside', () => {
    const as = [ab('a', 0, 0, 100, 100)]
    expect(frameIntent(as, 0, 0)).toBe('frame')
    expect(frameIntent(as, 100, 100)).toBe('frame')
  })

  it('is a frame in the gap only when an artboard covers it', () => {
    const as = [ab('a', 0, 0, 100, 100), ab('b', 200, 0, 100, 100)]
    expect(frameIntent(as, 150, 50)).toBe('artboard')
    expect(frameIntent(as, 250, 50)).toBe('frame')
  })

  it('picks frame for overlapping artboards too', () => {
    const as = [ab('a', 0, 0, 100, 100), ab('b', 50, 50, 100, 100)]
    expect(frameIntent(as, 75, 75)).toBe('frame')
  })
})
