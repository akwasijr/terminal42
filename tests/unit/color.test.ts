import { describe, it, expect } from 'vitest'
import { parseHex, toHex, rgbToHsv, hsvToRgb, rgbToHsl, hslToRgb, rgbToLch, lchToRgb, lerpHex } from '../../src/renderer/src/lib/color'

describe('color conversions', () => {
  it('parses and formats hex', () => {
    expect(parseHex('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
    expect(parseHex('0f0')).toEqual({ r: 0, g: 255, b: 0 })
    expect(parseHex('zzz')).toBeNull()
    expect(toHex({ r: 16, g: 32, b: 48 })).toBe('#102030')
  })

  it('round-trips RGB through HSV', () => {
    for (const hex of ['#ff0000', '#00ff80', '#123456', '#abcdef', '#ffffff', '#000000']) {
      const rgb = parseHex(hex)!
      expect(toHex(hsvToRgb(rgbToHsv(rgb)))).toBe(hex)
    }
  })

  it('round-trips RGB through HSL', () => {
    for (const hex of ['#ff0000', '#00ff80', '#123456', '#abcdef']) {
      const rgb = parseHex(hex)!
      expect(toHex(hslToRgb(rgbToHsl(rgb)))).toBe(hex)
    }
  })

  it('round-trips RGB through LCH within 1 unit', () => {
    for (const hex of ['#db0004', '#a4a4a4', '#123456', '#abcdef']) {
      const rgb = parseHex(hex)!
      const back = lchToRgb(rgbToLch(rgb))
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(1)
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(1)
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(1)
    }
  })

  it('lerps colours in sRGB', () => {
    expect(lerpHex('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(lerpHex('#ff0000', '#0000ff', 0)).toBe('#ff0000')
    expect(lerpHex('#ff0000', '#0000ff', 1)).toBe('#0000ff')
  })
})
