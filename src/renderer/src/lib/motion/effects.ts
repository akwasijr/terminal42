// Treatments applied to the whole finished frame: blur, grain, vignette,
// shadow and a colour grade.
//
// Drawn in the same 2D pass as the backdrop and the overlay (see
// `composite` in exporter.ts) rather than per card, so an export reproduces
// exactly what the screen showed without the renderer having to know these
// exist. Blur and the colour grade are cheap enough to hand to the browser
// as a `ctx.filter` before the cards are drawn; tint, vignette, shadow and
// grain are painted back on top afterwards, because a CSS filter cannot
// darken corners or lay grain over a picture that has not been drawn yet.

import type { EffectsState } from '../../../../shared/motion/types'

/** Blur is specified in pixels at this reference height; other sizes scale from it. */
const REFERENCE_HEIGHT = 1080

/**
 * True when nothing in `fx` would change the picture.
 *
 * `tint` itself is not checked: a tint colour sitting away from its default
 * with `tintAmount` at 0 paints nothing, so it must not trip this flag. The
 * caller uses this to skip the whole pass, so it has to agree exactly with
 * what `beforeCardsFilter` and `drawEffects` actually do with a neutral
 * value.
 */
export function effectsAreNeutral(fx: EffectsState): boolean {
  return (
    fx.blur === 0 &&
    fx.grain === 0 &&
    fx.vignette === 0 &&
    fx.shadow === 0 &&
    fx.brightness === 100 &&
    fx.contrast === 100 &&
    fx.saturation === 100 &&
    fx.tintAmount === 0
  )
}

/**
 * The `ctx.filter` string that applies blur and the colour grade to
 * whatever is drawn next.
 *
 * Only the parts that actually differ from neutral are included, so a
 * document that only turns up contrast does not pay for a `blur(0px)` the
 * browser would otherwise have to parse and no-op on every frame.
 */
export function beforeCardsFilter(fx: EffectsState, height: number): string {
  const parts: string[] = []
  if (fx.blur > 0) {
    const scale = height > 0 ? height / REFERENCE_HEIGHT : 1
    parts.push(`blur(${(fx.blur * scale).toFixed(2)}px)`)
  }
  if (fx.brightness !== 100) parts.push(`brightness(${fx.brightness}%)`)
  if (fx.contrast !== 100) parts.push(`contrast(${fx.contrast}%)`)
  if (fx.saturation !== 100) parts.push(`saturate(${fx.saturation}%)`)
  return parts.length > 0 ? parts.join(' ') : 'none'
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** A colour laid flat over the frame at `tintAmount` percent. */
function drawTint(ctx: CanvasRenderingContext2D, width: number, height: number, tint: string, tintAmount: number): void {
  ctx.save()
  ctx.globalAlpha = clamp(tintAmount, 0, 100) / 100
  ctx.fillStyle = tint
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

/** A radial gradient that darkens the corners, reaching further in as `vignette` rises. */
function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number, vignette: number): void {
  const strength = clamp(vignette, 0, 100) / 100
  const cx = width / 2
  const cy = height / 2
  // The gradient starts a third of the way out, so a light vignette reads as
  // a corner darkening rather than a dark ring visible at any strength.
  const innerR = Math.min(width, height) * 0.35
  const outerR = Math.max(width, height) * 0.75
  const gradient = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR)
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
  gradient.addColorStop(1, `rgba(0, 0, 0, ${(strength * 0.65).toFixed(3)})`)
  ctx.save()
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

/**
 * A soft dark band just inside each edge of the frame.
 *
 * Kept as four thin edge gradients rather than one big radial gradient like
 * the vignette, so it reads as the frame having depth at its border instead
 * of duplicating the vignette's corner darkening.
 */
function drawShadow(ctx: CanvasRenderingContext2D, width: number, height: number, shadow: number): void {
  const strength = clamp(shadow, 0, 100) / 100
  const band = Math.max(1, Math.min(width, height) * 0.08) * strength
  const alpha = (0.55 * strength).toFixed(3)

  ctx.save()
  const top = ctx.createLinearGradient(0, 0, 0, band)
  top.addColorStop(0, `rgba(0, 0, 0, ${alpha})`)
  top.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, width, band)

  const bottom = ctx.createLinearGradient(0, height, 0, height - band)
  bottom.addColorStop(0, `rgba(0, 0, 0, ${alpha})`)
  bottom.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, height - band, width, band)

  const left = ctx.createLinearGradient(0, 0, band, 0)
  left.addColorStop(0, `rgba(0, 0, 0, ${alpha})`)
  left.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = left
  ctx.fillRect(0, 0, band, height)

  const right = ctx.createLinearGradient(width, 0, width - band, 0)
  right.addColorStop(0, `rgba(0, 0, 0, ${alpha})`)
  right.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = right
  ctx.fillRect(width - band, 0, band, height)
  ctx.restore()
}

/**
 * A tiny, deliberately non-cryptographic integer hash (Thomas Wang's
 * 32-bit mix). It is used instead of `Math.random()` because grain has to
 * come out pixel-for-pixel identical on every call: the same frame size and
 * strength must produce the same noise on screen and in an export, or a
 * looping video would visibly flicker where the grain disagreed with
 * itself frame to frame.
 */
function hashInt(seed: number): number {
  let x = seed | 0
  x = ((x >>> 16) ^ x) * 0x45d9f3b
  x = ((x >>> 16) ^ x) * 0x45d9f3b
  x = (x >>> 16) ^ x
  return x >>> 0
}

/** A handful of recent grain buffers, so scrubbing the same document does not rehash every frame. */
const GRAIN_CACHE_LIMIT = 6
const grainCache = new Map<string, Int16Array>()

/**
 * Per-pixel brightness offsets for a grain pass at this size and strength.
 *
 * Built once per (width, height, grain) triple and reused after that. The
 * cache is a plain `Map`, so the oldest entry is simply the first key in
 * iteration order; evicting it when the cache is full keeps memory bounded
 * however many sizes a session's exports and on-screen preview touch.
 */
function grainAmplitude(width: number, height: number, grain: number): Int16Array {
  const key = `${width}x${height}:${grain}`
  const cached = grainCache.get(key)
  if (cached) return cached

  const count = width * height
  const amp = new Int16Array(count)
  const maxAmp = (grain / 100) * 36
  for (let i = 0; i < count; i++) {
    // Salting with the strength as well as the index means two different
    // strengths at the same size are not simply rescaled copies of one
    // another, which would make a grain slider feel like a volume knob on
    // one fixed texture rather than a genuinely different grain.
    const h = hashInt(i * 2654435761 ^ (grain * 97 + 1))
    const unit = (h % 2000) / 1000 - 1 // roughly -1..1, evenly enough for grain
    amp[i] = Math.round(unit * maxAmp)
  }

  if (grainCache.size >= GRAIN_CACHE_LIMIT) {
    const oldestKey = grainCache.keys().next().value
    if (oldestKey !== undefined) grainCache.delete(oldestKey)
  }
  grainCache.set(key, amp)
  return amp
}

/**
 * Film grain, added to the frame that is already drawn.
 *
 * Implemented as a brightness offset on the existing pixels rather than a
 * translucent noise layer painted on top: `putImageData` replaces whatever
 * was there, alpha included, so painting a semi-transparent noise rectangle
 * with it would punch a hole in the frame instead of blending. Reading the
 * frame back, nudging each channel and writing it back keeps every pixel's
 * own alpha untouched and looks like grain sitting in the image rather than
 * a film laid over it.
 */
function drawGrain(ctx: CanvasRenderingContext2D, width: number, height: number, grain: number): void {
  const g = Math.round(clamp(grain, 0, 100))
  const amp = grainAmplitude(width, height, g)
  const frame = ctx.getImageData(0, 0, width, height)
  const data = frame.data
  for (let i = 0; i < amp.length; i++) {
    const offset = amp[i]
    const o = i * 4
    // Uint8ClampedArray clamps on assignment, so an offset that pushes a
    // channel past 0 or 255 simply saturates instead of wrapping.
    data[o] += offset
    data[o + 1] += offset
    data[o + 2] += offset
  }
  ctx.putImageData(frame, 0, 0)
}

/**
 * Paints tint, vignette, shadow and grain over an already-composited frame,
 * in that order — tint first because it sits under the depth cues, grain
 * last because it should read as the topmost layer of the image.
 *
 * Leaves the context exactly as it found it. `save`/`restore` covers the
 * styles each helper touches, but `globalAlpha`, `globalCompositeOperation`
 * and `filter` are put back explicitly as well, because this runs inside a
 * shared compositing pass and a stray filter left set would blur whatever
 * the caller draws next.
 */
export function drawEffects(ctx: CanvasRenderingContext2D, fx: EffectsState, width: number, height: number): void {
  if (!ctx || width <= 0 || height <= 0) return
  if (fx.tintAmount === 0 && fx.vignette === 0 && fx.shadow === 0 && fx.grain === 0) return

  const prevAlpha = ctx.globalAlpha
  const prevComposite = ctx.globalCompositeOperation
  const prevFilter = ctx.filter

  ctx.save()
  ctx.filter = 'none'
  ctx.globalCompositeOperation = 'source-over'

  if (fx.tintAmount > 0) drawTint(ctx, width, height, fx.tint, fx.tintAmount)
  if (fx.vignette > 0) drawVignette(ctx, width, height, fx.vignette)
  if (fx.shadow > 0) drawShadow(ctx, width, height, fx.shadow)
  if (fx.grain > 0) drawGrain(ctx, width, height, fx.grain)

  ctx.restore()
  ctx.globalAlpha = prevAlpha
  ctx.globalCompositeOperation = prevComposite
  ctx.filter = prevFilter
}
