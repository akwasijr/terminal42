// Where the flat layers actually are on the frame.
//
// Text and logos are drawn onto the 2D overlay, which means the WebGL picker
// cannot see them: it knows about card meshes and nothing else. So a piece
// made from a template arrived with words on it that could not be clicked,
// which is a strange thing for an editor to say — the layer is right there.
//
// The boxes are computed here rather than inside the drawing code so that one
// function answers both questions that must never disagree: what is under the
// pointer, and where to put the marquee. If the hit test measured text its own
// way it would drift from the drawing the first time a typographic field was
// added, and the marquee would sit next to the layer instead of around it.
//
// Everything is in canvas pixels, because that is the space the overlay is
// drawn in and the space a pointer arrives in. Converting to the document's
// percentages is the caller's job, and only a drag needs to.

import type { LogoLayer, MotionDoc, TextLayer } from '../../../../shared/motion/types'
import { resolvedText } from '../../../../shared/motion/types'
import { layerVisibility } from '../../../../shared/motion/frame'
import { fontByLabel } from '../freeformTypes'

/** What the user has hold of. A card lives in the scene; the rest are flat. */
export type Pick =
  | { kind: 'card'; index: number }
  | { kind: 'text'; id: string }
  | { kind: 'logo'; id: string }

export type Box = { x: number; y: number; w: number; h: number }

export function samePick(a: Pick | null, b: Pick | null): boolean {
  if (a === null || b === null) return a === b
  if (a.kind !== b.kind) return false
  return a.kind === 'card' ? a.index === (b as { index: number }).index : a.id === (b as { id: string }).id
}

/** The font string the overlay draws with, so a measurement matches the paint. */
export function textFont(layer: ReturnType<typeof resolvedText>, px: number): string {
  return `${layer.italic ? 'italic ' : ''}${layer.weight} ${px}px ${fontByLabel(layer.font).stack}`
}

/**
 * The rectangle a text layer covers.
 *
 * Width comes from the widest line, since that is what the block occupies
 * however the lines are aligned, and the alignment then decides which side of
 * the anchor it hangs from. Height is the line box rather than the glyphs: a
 * line of "acorn" and a line of "Ægypt" should be the same size to click on.
 *
 * Returns null when there is nothing on screen to hit, which includes an empty
 * string, a zero size and a layer that is outside its own window in the loop.
 */
export function textBox(
  ctx: CanvasRenderingContext2D,
  raw: TextLayer,
  width: number,
  height: number,
  phase: number
): Box | null {
  if (!raw.text.trim()) return null
  if (layerVisibility(raw, phase) <= 0) return null
  const layer = resolvedText(raw)
  if (layer.opacity <= 0) return null
  const px = Math.round((layer.size / 100) * height)
  if (px <= 0) return null

  const lines = (layer.caps ? layer.text.toLocaleUpperCase() : layer.text).split('\n')
  const step = px * layer.lineHeight

  ctx.save()
  ctx.font = textFont(layer, px)
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(layer.tracking / 100) * px}px`
  let widest = 0
  for (const line of lines) widest = Math.max(widest, ctx.measureText(line).width)
  ctx.restore()

  const x = (layer.x / 100) * width
  const y = (layer.y / 100) * height
  const h = (lines.length - 1) * step + px
  const left = layer.align === 'left' ? x : layer.align === 'right' ? x - widest : x - widest / 2
  return { x: left, y: y - h / 2, w: widest, h }
}

/** The rectangle a logo covers. Width is given; height follows the picture. */
export function logoBox(
  layer: LogoLayer,
  images: Map<string, HTMLImageElement>,
  width: number,
  height: number,
  phase: number
): Box | null {
  if (layerVisibility(layer, phase) <= 0) return null
  if (layer.opacity <= 0) return null
  const img = images.get(layer.imageId)
  if (!img || !img.complete || img.naturalWidth === 0) return null
  const w = (layer.size / 100) * width
  const h = w * (img.naturalHeight / img.naturalWidth)
  return { x: (layer.x / 100) * width - w / 2, y: (layer.y / 100) * height - h / 2, w, h }
}

/** Every flat layer's box, in the order they are painted: first is furthest back. */
export function overlayBoxes(
  ctx: CanvasRenderingContext2D,
  doc: MotionDoc,
  images: Map<string, HTMLImageElement>,
  width: number,
  height: number,
  phase: number
): Array<{ pick: Pick; box: Box }> {
  const out: Array<{ pick: Pick; box: Box }> = []
  for (const t of doc.visual.text) {
    const box = textBox(ctx, t, width, height, phase)
    if (box) out.push({ pick: { kind: 'text', id: t.id }, box })
  }
  for (const l of doc.visual.logos) {
    const box = logoBox(l, images, width, height, phase)
    if (box) out.push({ pick: { kind: 'logo', id: l.id }, box })
  }
  return out
}

/** The box for one pick, or null if it is a card or is not on screen now. */
export function boxFor(
  ctx: CanvasRenderingContext2D,
  doc: MotionDoc,
  images: Map<string, HTMLImageElement>,
  width: number,
  height: number,
  phase: number,
  pick: Pick | null
): Box | null {
  if (!pick || pick.kind === 'card') return null
  const found = overlayBoxes(ctx, doc, images, width, height, phase)
    .find((b) => samePick(b.pick, pick))
  return found?.box ?? null
}

/**
 * The topmost flat layer under a point.
 *
 * Searched back to front because that is the order they were painted in, so
 * the one the user can see is the one they get. The pad is there because a
 * thin piece of text is a hard target and clicking a hair outside it should
 * still mean that layer rather than the backdrop behind it.
 */
export function pickOverlay(
  ctx: CanvasRenderingContext2D,
  doc: MotionDoc,
  images: Map<string, HTMLImageElement>,
  width: number,
  height: number,
  phase: number,
  px: number,
  py: number,
  pad = 4
): Pick | null {
  const boxes = overlayBoxes(ctx, doc, images, width, height, phase)
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i].box
    if (px >= b.x - pad && px <= b.x + b.w + pad && py >= b.y - pad && py <= b.y + b.h + pad) {
      return boxes[i].pick
    }
  }
  return null
}

/**
 * The marquee around the selected flat layer.
 *
 * Drawn in the accent over a knocked-back halo rather than as a plain hairline,
 * because the frame behind it can be any colour at all and a single-colour
 * outline disappears against roughly one background in twenty.
 */
export function drawPickOutline(ctx: CanvasRenderingContext2D, box: Box, accent: string): void {
  const pad = 4
  const x = box.x - pad
  const y = box.y - pad
  const w = box.w + pad * 2
  const h = box.h + pad * 2
  ctx.save()
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.strokeRect(x, y, w, h)
  ctx.lineWidth = 1.5
  ctx.strokeStyle = accent
  ctx.strokeRect(x, y, w, h)
  // Corner marks, so the selection still reads on a frame whose own contents
  // happen to be full of rectangles.
  const arm = Math.min(10, w / 3, h / 3)
  ctx.lineWidth = 2.5
  for (const [cx, cy, sx, sy] of [
    [x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]
  ] as Array<[number, number, number, number]>) {
    ctx.beginPath()
    ctx.moveTo(cx + sx * arm, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + sy * arm)
    ctx.stroke()
  }
  ctx.restore()
}
