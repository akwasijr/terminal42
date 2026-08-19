// Pure colour-space conversions for the custom colour picker. Everything is
// framework-free and unit-tested so the picker UI and the gradient maths can
// share one implementation. Hex is the canonical stored form (#rrggbb).

export interface RGB { r: number; g: number; b: number } // 0..255
export interface HSV { h: number; s: number; v: number } // h 0..360, s/v 0..1
export interface HSL { h: number; s: number; l: number } // h 0..360, s/l 0..1
export interface LCH { l: number; c: number; h: number } // CIE Lab LCH, l 0..100

export const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))
const round = (n: number): number => Math.round(n)

/** Parse #rgb / #rrggbb (with or without #) into RGB, or null when invalid. */
export function parseHex(input: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map((x) => x + x).join('')
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function toHex({ r, g, b }: RGB): string {
  const h = (n: number): string => clamp(round(n), 0, 255).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const hh = ((h % 360) + 360) % 360 / 60
  const c = v * s
  const x = c * (1 - Math.abs((hh % 2) - 1))
  let r = 0, g = 0, b = 0
  if (hh >= 0 && hh < 1) [r, g, b] = [c, x, 0]
  else if (hh < 2) [r, g, b] = [x, c, 0]
  else if (hh < 3) [r, g, b] = [0, c, x]
  else if (hh < 4) [r, g, b] = [0, x, c]
  else if (hh < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = v - c
  return { r: round((r + m) * 255), g: round((g + m) * 255), b: round((b + m) * 255) }
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const d = max - min
  const l = (max + min) / 2
  let h = 0, s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const hh = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((hh / 60) % 2 - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (hh < 60) [r, g, b] = [c, x, 0]
  else if (hh < 120) [r, g, b] = [x, c, 0]
  else if (hh < 180) [r, g, b] = [0, c, x]
  else if (hh < 240) [r, g, b] = [0, x, c]
  else if (hh < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return { r: round((r + m) * 255), g: round((g + m) * 255), b: round((b + m) * 255) }
}

// ── CIE Lab / LCH (D65) ──────────────────────────────────────────────────────
const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const linearToSrgb = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)
const Xn = 95.047, Yn = 100.0, Zn = 108.883
const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
const fInv = (t: number): number => { const t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787 }

export function rgbToLab({ r, g, b }: RGB): { l: number; a: number; b: number } {
  const rl = srgbToLinear(r / 255), gl = srgbToLinear(g / 255), bl = srgbToLinear(b / 255)
  const X = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) * 100
  const Y = (rl * 0.2126 + gl * 0.7152 + bl * 0.0722) * 100
  const Z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) * 100
  const fx = f(X / Xn), fy = f(Y / Yn), fz = f(Z / Zn)
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }
}

export function labToRgb({ l, a, b }: { l: number; a: number; b: number }): RGB {
  const fy = (l + 16) / 116
  const fx = fy + a / 500
  const fz = fy - b / 200
  const X = Xn * fInv(fx), Y = Yn * fInv(fy), Z = Zn * fInv(fz)
  const x = X / 100, y = Y / 100, z = Z / 100
  const rl = x * 3.2406 + y * -1.5372 + z * -0.4986
  const gl = x * -0.9689 + y * 1.8758 + z * 0.0415
  const bl = x * 0.0557 + y * -0.2040 + z * 1.0570
  return {
    r: clamp(round(linearToSrgb(clamp(rl, 0, 1)) * 255), 0, 255),
    g: clamp(round(linearToSrgb(clamp(gl, 0, 1)) * 255), 0, 255),
    b: clamp(round(linearToSrgb(clamp(bl, 0, 1)) * 255), 0, 255),
  }
}

export function rgbToLch(rgb: RGB): LCH {
  const { l, a, b } = rgbToLab(rgb)
  const c = Math.sqrt(a * a + b * b)
  let h = Math.atan2(b, a) * 180 / Math.PI
  if (h < 0) h += 360
  return { l, c, h }
}

export function lchToRgb({ l, c, h }: LCH): RGB {
  const hr = h * Math.PI / 180
  return labToRgb({ l, a: Math.cos(hr) * c, b: Math.sin(hr) * c })
}

/** Linear interpolation between two hex colours in sRGB, t in 0..1. */
export function lerpHex(a: string, b: string, t: number): string {
  const ca = parseHex(a) ?? { r: 0, g: 0, b: 0 }
  const cb = parseHex(b) ?? { r: 0, g: 0, b: 0 }
  return toHex({ r: ca.r + (cb.r - ca.r) * t, g: ca.g + (cb.g - ca.g) * t, b: ca.b + (cb.b - ca.b) * t })
}

/** Parse any rgb()/rgba()/hex colour into a hex string + alpha (0..1). */
export function parseAnyColor(input: string): { hex: string; alpha: number } {
  const rgba = /^rgba?\(([^)]+)\)$/i.exec(input.trim())
  if (rgba) {
    const parts = rgba[1].split(',').map((s) => parseFloat(s.trim()))
    return { hex: toHex({ r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0 }), alpha: parts[3] == null ? 1 : clamp(parts[3], 0, 1) }
  }
  const c = parseHex(input)
  return c ? { hex: toHex(c), alpha: 1 } : { hex: '#000000', alpha: 1 }
}
