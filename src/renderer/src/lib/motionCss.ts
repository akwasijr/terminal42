// Pure helpers that turn a motion timeline spec into CSS. Kept framework-free so
// they can be unit-tested and reused by the timeline UI, the live preview, and
// the "copy as CSS" / bake-to-design paths (Figma Motion's Dev Mode does the same).

export type MotionKeyframe = {
  id: string
  /** 0..100 position on the timeline. */
  t: number
  /** translate X in px. */
  x: number
  /** translate Y in px. */
  y: number
  scale: number
  /** rotate in degrees. */
  rotate: number
  /** 0..1 */
  opacity: number
  /** Easing for the segment that STARTS at this keyframe (to the next one).
   * Any CSS timing function: cubic-bezier(...), ease-*, linear, steps(...). When
   * unset, the segment falls back to the spec-level easing. */
  easing?: string
}

export type MotionSpec = {
  /** keyframes/animation name, e.g. "t42motion". */
  name: string
  /** duration in ms. */
  duration: number
  /** CSS timing function. */
  easing: string
  keyframes: MotionKeyframe[]
}

export const EASING_PRESETS: { id: string; label: string; value: string }[] = [
  { id: 'linear', label: 'Linear', value: 'linear' },
  { id: 'in', label: 'Ease in', value: 'cubic-bezier(0.42,0,1,1)' },
  { id: 'out', label: 'Ease out', value: 'cubic-bezier(0,0,0.58,1)' },
  { id: 'inout', label: 'Ease in and out', value: 'cubic-bezier(0.42,0,0.58,1)' },
  { id: 'smooth', label: 'Smooth', value: 'cubic-bezier(0.22,1,0.36,1)' },
  { id: 'backin', label: 'Ease in back', value: 'cubic-bezier(0.36,0,0.66,-0.56)' },
  { id: 'backout', label: 'Ease out back', value: 'cubic-bezier(0.34,1.56,0.64,1)' },
  { id: 'backinout', label: 'Ease in and out back', value: 'cubic-bezier(0.68,-0.6,0.32,1.6)' },
  { id: 'hold', label: 'Hold', value: 'steps(1,jump-start)' },
]

/** True for "hold" style step easings, which jump rather than interpolate. */
export function isHold(easing: string | undefined): boolean {
  return !!easing && easing.startsWith('steps(')
}

function round(n: number, d = 2): number {
  const f = Math.pow(10, d)
  return Math.round((Number.isFinite(n) ? n : 0) * f) / f
}
function clampT(t: number): number {
  return Math.max(0, Math.min(100, round(t, 2)))
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, round(n, 3)))
}

function frameBody(k: MotionKeyframe, isLast: boolean): string {
  const tf = `translate3d(${round(k.x)}px, ${round(k.y)}px, 0) scale(${round(k.scale, 3)}) rotate(${round(k.rotate)}deg)`
  // Per-segment easing: a keyframe's animation-timing-function applies to the
  // interval that STARTS at it. The final keyframe has no outgoing segment.
  const ease = !isLast && k.easing ? ` animation-timing-function: ${k.easing};` : ''
  return `transform: ${tf}; opacity: ${clamp01(k.opacity)};${ease}`
}

/** Just the `@keyframes` block. */
export function generateKeyframes(spec: MotionSpec): string {
  const sorted = [...spec.keyframes].sort((a, b) => a.t - b.t)
  const frames = sorted
    .map((k, i) => `  ${clampT(k.t)}% { ${frameBody(k, i === sorted.length - 1)} }`)
    .join('\n')
  return `@keyframes ${spec.name} {\n${frames}\n}`
}

/**
 * Full CSS: the `@keyframes` plus the rule that runs the animation on `selector`,
 * with a reduced-motion guard so it never fights accessibility settings.
 */
export function generateMotionCss(
  selector: string,
  spec: MotionSpec,
  opts: { playback?: 'once' | 'loop' | 'pingpong' } = {},
): string {
  const tail =
    opts.playback === 'loop' ? 'infinite' : opts.playback === 'pingpong' ? 'infinite alternate' : 'both'
  return [
    generateKeyframes(spec),
    `${selector} { animation: ${spec.name} ${Math.round(spec.duration)}ms ${spec.easing} ${tail}; will-change: transform, opacity; }`,
    `@media (prefers-reduced-motion: reduce) { ${selector} { animation: none; } }`,
  ].join('\n')
}

/** A sensible starting reveal (rise + fade in). */
export function defaultKeyframes(): MotionKeyframe[] {
  return [
    { id: 'k0', t: 0, x: 0, y: 24, scale: 1, rotate: 0, opacity: 0 },
    { id: 'k1', t: 100, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
  ]
}

export const MOTION_PRESETS = [
  { id: 'fade', label: 'Fade in' },
  { id: 'rise', label: 'Rise up' },
  { id: 'scale', label: 'Scale in' },
  { id: 'slide', label: 'Slide in' },
] as const

/** A predefined entrance spec for a preset id (used by the quick-apply menu). */
export function presetSpec(id: string): MotionSpec {
  const base = { name: `t42m_${id}`, duration: 600, easing: 'cubic-bezier(.22,1,.36,1)' }
  const at = (t: number, over: Partial<MotionKeyframe>): MotionKeyframe => ({
    id: `k${t}`, t, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, ...over,
  })
  switch (id) {
    case 'fade':  return { ...base, keyframes: [at(0, { opacity: 0 }), at(100, { opacity: 1 })] }
    case 'rise':  return { ...base, keyframes: [at(0, { opacity: 0, y: 24 }), at(100, { opacity: 1, y: 0 })] }
    case 'scale': return { ...base, keyframes: [at(0, { opacity: 0, scale: 0.92 }), at(100, { opacity: 1, scale: 1 })] }
    case 'slide': return { ...base, keyframes: [at(0, { opacity: 0, x: -40 }), at(100, { opacity: 1, x: 0 })] }
    default:      return { ...base, keyframes: defaultKeyframes() }
  }
}
