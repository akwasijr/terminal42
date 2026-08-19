// Shared easing math: parse a CSS timing function into control points and a
// 0..1 → 0..1 progress function, so the live preview eases exactly like the
// exported CSS. Used by the motion timeline, the AE-style timeline, and the
// curve editor.

export const NAMED_BEZIER: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
}

export function isHold(easing: string | undefined): boolean {
  return !!easing && easing.startsWith('steps(')
}

export function isSpring(easing: string | undefined): boolean {
  return !!easing && easing.startsWith('spring(')
}

/** Parse `spring(bounce,freq)` → { bounce, freq }. */
export function springParams(easing: string | undefined): { bounce: number; freq: number } {
  const m = easing?.match(/spring\(([^)]+)\)/)
  if (m) {
    const p = m[1].split(',').map((n) => parseFloat(n.trim()))
    return { bounce: Number.isFinite(p[0]) ? p[0] : 0.3, freq: Number.isFinite(p[1]) ? p[1] : 11 }
  }
  return { bounce: 0.3, freq: 11 }
}

/** A normalized spring progress function: starts at 0, settles at 1, overshoots
 * for higher bounce. `freq` controls how fast it settles. */
export function springFn(bounce: number, freq: number): (t: number) => number {
  const b = Math.max(0, Math.min(1, bounce))
  const omega = Math.max(3, freq)
  const zeta = Math.max(0.01, 1 - b) // damping ratio: high bounce → low damping
  if (zeta < 1) {
    const wd = omega * Math.sqrt(1 - zeta * zeta)
    return (t: number): number => {
      if (t <= 0) return 0
      if (t >= 1) return 1
      return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t))
    }
  }
  return (t: number): number => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    return 1 - Math.exp(-omega * t) * (1 + omega * t)
  }
}

export const SPRING_PRESETS: { id: string; label: string; bounce: number; freq: number }[] = [
  { id: 'gentle', label: 'Gentle', bounce: 0.3, freq: 6 },
  { id: 'quick', label: 'Quick', bounce: 0.35, freq: 10 },
  { id: 'bouncy', label: 'Bouncy', bounce: 0.65, freq: 5 },
  { id: 'slow', label: 'Slow', bounce: 0.2, freq: 4 },
]

export function bezierPts(easing: string | undefined): [number, number, number, number] {
  if (!easing) return NAMED_BEZIER.linear
  const m = easing.match(/cubic-bezier\(([^)]+)\)/)
  if (m) {
    const p = m[1].split(',').map((n) => parseFloat(n.trim()))
    if (p.length === 4 && p.every((n) => Number.isFinite(n))) return [p[0], p[1], p[2], p[3]]
  }
  return NAMED_BEZIER[easing] ?? NAMED_BEZIER.linear
}

/** Build a progress function p(x): given linear x in 0..1 return eased y. */
export function easingFn(easing: string | undefined): (t: number) => number {
  if (isHold(easing)) return () => 1
  if (isSpring(easing)) { const { bounce, freq } = springParams(easing); return springFn(bounce, freq) }
  const [x1, y1, x2, y2] = bezierPts(easing)
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number): number => ((ay * t + by) * t + cy) * t
  const dX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx
  return (x: number): number => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 6; i++) {
      const d = dX(t) || 1e-6
      t -= (sampleX(t) - x) / d
    }
    return sampleY(t)
  }
}

export const EASING_PRESETS: { id: string; label: string; value: string }[] = [
  { id: 'hold', label: 'Hold', value: 'steps(1,jump-start)' },
  { id: 'linear', label: 'Linear', value: 'linear' },
  { id: 'in', label: 'Ease in', value: 'cubic-bezier(0.42,0,1,1)' },
  { id: 'out', label: 'Ease out', value: 'cubic-bezier(0,0,0.58,1)' },
  { id: 'inout', label: 'Ease in and out', value: 'cubic-bezier(0.42,0,0.58,1)' },
  { id: 'backin', label: 'Ease in back', value: 'cubic-bezier(0.36,0,0.66,-0.56)' },
  { id: 'backout', label: 'Ease out back', value: 'cubic-bezier(0.34,1.56,0.64,1)' },
  { id: 'backinout', label: 'Ease in and out back', value: 'cubic-bezier(0.68,-0.6,0.32,1.6)' },
]

/** A short label for any easing value (named preset, hold, spring, or custom). */
export function easingLabel(value: string | undefined): string {
  if (isHold(value)) return 'Hold'
  if (isSpring(value)) return 'Spring'
  const hit = EASING_PRESETS.find((p) => p.value === value)
  return hit ? hit.label : 'Custom bezier'
}

/** A tiny SVG path drawing the easing curve, for menu/preset icons. */
export function curveIconPath(value: string | undefined, w = 16, h = 16, pad = 2.5): string {
  const X = (x: number): number => pad + x * (w - 2 * pad)
  const Y = (y: number): number => (h - pad) - y * (h - 2 * pad)
  if (isHold(value)) return `M${X(0)},${Y(0)} L${X(0.5)},${Y(0)} L${X(0.5)},${Y(1)} L${X(1)},${Y(1)}`
  const [x1, y1, x2, y2] = bezierPts(value)
  return `M${X(0)},${Y(0)} C${X(x1)},${Y(y1)} ${X(x2)},${Y(y2)} ${X(1)},${Y(1)}`
}
