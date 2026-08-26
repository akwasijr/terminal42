// The treatments that need pixels.
//
// Everything in `effects.ts` can be worked out from numbers alone: a tint is
// a colour over a rectangle, a vignette is a gradient, grain is a hash. The
// four here cannot. A drop shadow needs the component's silhouette, an edge
// blur needs whatever is already drawn underneath it, and glass needs to
// read the picture back in order to bend it. So they live apart, take a
// canvas rather than a context, and run at a known point in the composite.
//
// All four are written as in-place operations on a canvas. That matters for
// the blur especially: a blurred copy drawn *over* a sharp one leaves the
// sharp edges showing through as a halo, so the sharp picture has to be
// taken out where the blur goes in. Replacing rather than layering is the
// whole difference between this looking like glass and looking like a
// mistake.

import type {
  DropShadowFx, EdgeAmounts, EdgeBlurFx, EdgeFalloff, EdgeShadeFx, EffectsState, GlassFx
} from '../../../../shared/motion/types'

/**
 * Scratch canvases, kept and reused.
 *
 * A frame needs up to four of these and there are sixty frames a second, so
 * allocating them per frame would hand the garbage collector a few hundred
 * megabytes a minute of canvas backing store. They are keyed by role rather
 * than pooled anonymously, so two steps that are live at the same time can
 * never be handed the same one.
 */
const scratches = new Map<string, HTMLCanvasElement>()

function scratch(role: string, width: number, height: number): HTMLCanvasElement | null {
  let c = scratches.get(role)
  if (!c) {
    if (typeof document === 'undefined') return null
    c = document.createElement('canvas')
    scratches.set(role, c)
  }
  if (c.width !== width || c.height !== height) {
    c.width = width
    c.height = height
  } else {
    const ctx = c.getContext('2d')
    ctx?.clearRect(0, 0, width, height)
  }
  return c
}

/** Frees the scratch canvases. Called when the studio closes. */
export function releaseFxScratches(): void {
  for (const c of scratches.values()) { c.width = 0; c.height = 0 }
  scratches.clear()
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** The shorter side, which every distance here is a percentage of. */
function shortSide(width: number, height: number): number {
  return Math.min(width, height)
}

export function anyEdge(edges: EdgeAmounts): boolean {
  return edges.top > 0 || edges.bottom > 0 || edges.left > 0 || edges.right > 0
}

export function dropShadowActive(fx: DropShadowFx): boolean {
  return fx.enabled && fx.density > 0
}

export function edgeBlurActive(fx: EdgeBlurFx): boolean {
  return fx.enabled && fx.amount > 0 && anyEdge(fx.edges)
}

export function edgeShadeActive(fx: EdgeShadeFx): boolean {
  return fx.enabled && anyEdge(fx.edges)
}

export function glassActive(fx: GlassFx): boolean {
  if (!fx.enabled || fx.width <= 0 || fx.refraction <= 0) return false
  return fx.edges === 'all' || anyEdge(fx.per)
}

/**
 * True when any of these four would change the picture.
 *
 * The screen uses this to decide between compositing every frame and simply
 * stacking three canvases, which is much cheaper and is what almost every
 * piece needs. Getting this wrong in the false direction means an effect
 * silently does nothing, so it has to agree exactly with the four checks
 * above.
 */
export function needsPixelPass(fx: EffectsState): boolean {
  return (
    dropShadowActive(fx.dropShadow) ||
    edgeBlurActive(fx.edgeBlur) ||
    edgeShadeActive(fx.edgeShade) ||
    glassActive(fx.glass)
  )
}

/**
 * Colour stops running from full strength at the edge to nothing at `reach`.
 *
 * `softness` decides how much of that distance is spent ramping: at zero the
 * treatment holds full strength almost the whole way and then stops, which
 * reads as a band; at a hundred it starts giving way immediately. `falloff`
 * decides the shape of the ramp itself, and `soft` is eased at both ends so
 * there is no line where the effect ends.
 */
function addStops(gradient: CanvasGradient, softness: number, falloff: EdgeFalloff, alpha: number): void {
  const ramp = clamp(softness, 0, 100) / 100
  const hold = 1 - ramp
  const at = (offset: number, a: number): void => {
    gradient.addColorStop(clamp(offset, 0, 1), `rgba(255, 255, 255, ${(a * alpha).toFixed(4)})`)
  }
  at(0, 1)
  if (hold > 0) at(hold, 1)
  if (falloff === 'linear') {
    at(1, 0)
    return
  }
  // Three interior stops are enough to read as eased; more would be exact and
  // indistinguishable. The values are a smoothstep sampled at quarters.
  const span = 1 - hold
  at(hold + span * 0.25, 0.8438)
  at(hold + span * 0.5, 0.5)
  at(hold + span * 0.75, 0.1563)
  at(1, 0)
}

/**
 * A greyscale mask, white where the treatment applies.
 *
 * The four edges are laid down normally rather than combined by taking the
 * larger of the two, so a corner where two edges meet is stronger than
 * either alone. That is what a corner does: it is near two edges, and a
 * treatment that reaches in from both should reach further there.
 */
function edgeMask(
  width: number,
  height: number,
  edges: EdgeAmounts,
  softness: number,
  falloff: EdgeFalloff,
  role: string
): HTMLCanvasElement | null {
  const c = scratch(role, width, height)
  const ctx = c?.getContext('2d')
  if (!c || !ctx) return null

  const paint = (reach: number, gradient: CanvasGradient, x: number, y: number, w: number, h: number): void => {
    if (reach <= 0 || w <= 0 || h <= 0) return
    addStops(gradient, softness, falloff, 1)
    ctx.fillStyle = gradient
    ctx.fillRect(x, y, w, h)
  }

  const vt = (height * clamp(edges.top, 0, 100)) / 100
  paint(vt, ctx.createLinearGradient(0, 0, 0, vt), 0, 0, width, vt)

  const vb = (height * clamp(edges.bottom, 0, 100)) / 100
  paint(vb, ctx.createLinearGradient(0, height, 0, height - vb), 0, height - vb, width, vb)

  const hl = (width * clamp(edges.left, 0, 100)) / 100
  paint(hl, ctx.createLinearGradient(0, 0, hl, 0), 0, 0, hl, height)

  const hr = (width * clamp(edges.right, 0, 100)) / 100
  paint(hr, ctx.createLinearGradient(width, 0, width - hr, 0), width - hr, 0, hr, height)

  return c
}

/**
 * The component's own shape, as an opaque silhouette.
 *
 * Taken from the card layer's alpha, which is exactly the shape the cards
 * cover. Anything that needs to touch only the component rather than the
 * whole frame narrows its mask with this.
 */
function silhouetteOf(cards: CanvasImageSource, width: number, height: number, role: string): HTMLCanvasElement | null {
  const c = scratch(role, width, height)
  const ctx = c?.getContext('2d')
  if (!c || !ctx) return null
  ctx.drawImage(cards, 0, 0, width, height)
  return c
}

/**
 * The component's silhouette, offset, blurred and coloured.
 *
 * Drawn straight onto the frame before the cards are, so the cards land on
 * top of their own shadow rather than beside it.
 */
export function drawDropShadow(
  ctx: CanvasRenderingContext2D,
  cards: CanvasImageSource,
  fx: DropShadowFx,
  width: number,
  height: number
): void {
  if (!dropShadowActive(fx) || width <= 0 || height <= 0) return
  const shape = scratch('shadow', width, height)
  const sctx = shape?.getContext('2d')
  if (!shape || !sctx) return

  sctx.drawImage(cards, 0, 0, width, height)
  // `source-in` keeps the alpha it already has and replaces every colour, so
  // what is left is the silhouette painted in the shadow's colour.
  sctx.globalCompositeOperation = 'source-in'
  sctx.fillStyle = fx.colour
  sctx.fillRect(0, 0, width, height)
  sctx.globalCompositeOperation = 'source-over'

  const unit = shortSide(width, height)
  const at = shadowOffset(fx, width, height)
  const blur = (fx.blur / 100) * unit * 0.12

  ctx.save()
  ctx.globalAlpha = clamp(fx.density, 0, 100) / 100
  if (blur > 0.05) ctx.filter = `blur(${blur.toFixed(2)}px)`
  ctx.drawImage(shape, at.x, at.y, width, height)
  ctx.restore()
}

/**
 * Replaces the edges of `target` with a blurred copy of themselves.
 *
 * In place and by replacement, not by layering: the sharp picture is cut out
 * wherever the blur is going, so the two never show at once. Drawing a
 * blurred copy over a sharp one instead leaves every hard edge visible
 * through the blur as a halo, which looks like a rendering fault rather than
 * a soft edge.
 */
export function applyEdgeBlur(
  target: HTMLCanvasElement,
  fx: EdgeBlurFx,
  width: number,
  height: number,
  clipTo?: CanvasImageSource
): void {
  if (!edgeBlurActive(fx) || width <= 0 || height <= 0) return
  const ctx = target.getContext('2d')
  const mask = edgeMask(width, height, fx.edges, fx.softness, fx.falloff, 'blurMask')
  const blurred = scratch('blurred', width, height)
  const bctx = blurred?.getContext('2d')
  if (!ctx || !mask || !blurred || !bctx) return

  const radius = (fx.amount / 100) * shortSide(width, height) * 0.08
  if (radius < 0.05) return

  bctx.filter = `blur(${radius.toFixed(2)}px)`
  bctx.drawImage(target, 0, 0)
  bctx.filter = 'none'
  bctx.globalCompositeOperation = 'destination-in'
  bctx.drawImage(mask, 0, 0)
  if (clipTo) bctx.drawImage(clipTo, 0, 0, width, height)
  bctx.globalCompositeOperation = 'source-over'

  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.drawImage(blurred, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(blurred, 0, 0)
  ctx.restore()
}

/** The colour a shade actually paints, which is its mode unless it says otherwise. */
export function shadeColour(fx: EdgeShadeFx): string {
  if (fx.colour !== '#000000' && fx.colour !== '#ffffff') return fx.colour
  return fx.mode === 'light' ? '#ffffff' : '#000000'
}

/** A wash of colour reaching in from the edges, over the cards or over everything. */
export function drawEdgeShade(
  ctx: CanvasRenderingContext2D,
  fx: EdgeShadeFx,
  width: number,
  height: number,
  cards?: CanvasImageSource
): void {
  if (!edgeShadeActive(fx) || width <= 0 || height <= 0) return
  const layer = scratch('shade', width, height)
  const lctx = layer?.getContext('2d')
  const mask = edgeMask(width, height, fx.edges, fx.softness, fx.falloff, 'shadeMask')
  if (!layer || !lctx || !mask) return

  lctx.fillStyle = shadeColour(fx)
  lctx.fillRect(0, 0, width, height)
  lctx.globalCompositeOperation = 'destination-in'
  lctx.drawImage(mask, 0, 0)
  // Narrowing to the cards is a second cut of the same mask rather than a
  // different mask, so the edges mean the same thing in both scopes.
  if (fx.over === 'component' && cards) {
    const shape = silhouetteOf(cards, width, height, 'shadeShape')
    if (shape) lctx.drawImage(shape, 0, 0)
  }
  lctx.globalCompositeOperation = 'source-over'

  ctx.save()
  ctx.drawImage(layer, 0, 0)
  ctx.restore()
}

/** How wide the glass band is on each edge, in pixels. */
function glassBands(fx: GlassFx, width: number, height: number): EdgeAmounts {
  const unit = shortSide(width, height)
  const full = (fx.width / 100) * unit
  if (fx.edges === 'all') return { top: full, bottom: full, left: full, right: full }
  const scale = (pct: number): number => (clamp(pct, 0, 100) / 100) * full
  return { top: scale(fx.per.top), bottom: scale(fx.per.bottom), left: scale(fx.per.left), right: scale(fx.per.right) }
}

/**
 * Bends the picture inside a band along each edge, the way the thick edge of
 * a sheet of glass does.
 *
 * Done as a row of thin slices, each drawn from further into the picture
 * than where it lands. Thin because the bend has to look continuous, but not
 * one pixel thin: at four thousand pixels wide that would be a thousand
 * draws an edge, and the difference between a two pixel slice and a one
 * pixel slice is not visible while the difference in cost is.
 */
export function applyGlass(
  target: HTMLCanvasElement,
  fx: GlassFx,
  width: number,
  height: number
): void {
  if (!glassActive(fx) || width <= 0 || height <= 0) return
  const ctx = target.getContext('2d')
  const source = scratch('glassSrc', width, height)
  const sctx = source?.getContext('2d')
  if (!ctx || !source || !sctx) return
  sctx.drawImage(target, 0, 0)

  const bands = glassBands(fx, width, height)
  const pull = clamp(fx.refraction, 0, 100) / 100
  // Curve is an exponent: at the low end the bend is even across the band,
  // at the high end almost all of it happens in the last few pixels, which
  // is what makes an edge look thick rather than merely smeared.
  const curve = 1 + (clamp(fx.curve, 0, 100) / 100) * 3
  const STEP = 2

  ctx.save()
  ctx.imageSmoothingEnabled = true

  // `t` runs 0 at the frame's edge to 1 at the inner lip of the band, so
  // every edge is described the same way and only the mapping to pixels
  // differs.
  const sliceH = (band: number, fromTop: boolean): void => {
    if (band < 1) return
    for (let d = 0; d < band; d += STEP) {
      const t = d / band
      const depth = Math.pow(1 - t, curve) * pull * band
      const dstY = fromTop ? d : height - d - STEP
      const srcY = fromTop ? Math.min(height - 1, d + depth) : Math.max(0, height - d - STEP - depth)
      ctx.drawImage(source, 0, srcY, width, STEP, 0, dstY, width, STEP)
    }
  }
  const sliceV = (band: number, fromLeft: boolean): void => {
    if (band < 1) return
    for (let d = 0; d < band; d += STEP) {
      const t = d / band
      const depth = Math.pow(1 - t, curve) * pull * band
      const dstX = fromLeft ? d : width - d - STEP
      const srcX = fromLeft ? Math.min(width - 1, d + depth) : Math.max(0, width - d - STEP - depth)
      ctx.drawImage(source, srcX, 0, STEP, height, dstX, 0, STEP, height)
    }
  }

  sliceH(bands.top, true)
  sliceH(bands.bottom, false)
  sliceV(bands.left, true)
  sliceV(bands.right, false)
  ctx.restore()
}

/**
 * Where a shadow at this angle and distance lands, in pixels.
 *
 * Pulled out of drawDropShadow so the convention can be stated once and
 * checked directly. Getting the sign wrong here puts the shadow on the
 * opposite side of the component from the light, which looks wrong without
 * looking obviously broken.
 */
export function shadowOffset(fx: DropShadowFx, width: number, height: number): { x: number; y: number } {
  // On a canvas y grows downwards, so straight down is +y and turning
  // clockwise from it runs (-sin, cos) — which is what adding the quarter
  // turn gives, not subtracting it.
  const radians = ((fx.angle + 90) * Math.PI) / 180
  const distance = (clamp(fx.distance, 0, 100) / 100) * shortSide(width, height) * 0.25
  return { x: Math.cos(radians) * distance, y: Math.sin(radians) * distance }
}
