// The frame's backdrop: colour and grid.
//
// Drawn with the 2D canvas API rather than in the 3D scene so that the screen
// and the exporter can call the very same function. When "grid behind
// component" is on, an exported frame is this backdrop with the WebGL canvas
// composited over it — the same two layers in the same order the user was
// looking at. A grid drawn as scene geometry would have needed its own
// perspective handling and would not have matched.

import type { FrameStyle, LogoLayer, MotionDoc, TextLayer } from '../../../../shared/motion/types'
import { resolvedText } from '../../../../shared/motion/types'
import { clipTimeline } from '../../../../shared/motion/entrance'
import { layerVisibility } from '../../../../shared/motion/frame'
import { fontByLabel } from '../freeformTypes'

export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  frame: FrameStyle,
  width: number,
  height: number,
  opts: { transparent?: boolean; showGrid?: boolean } = {}
): void {
  ctx.clearRect(0, 0, width, height)
  if (!opts.transparent) {
    ctx.fillStyle = frame.background
    ctx.fillRect(0, 0, width, height)
  }

  const showGrid = opts.showGrid ?? frame.gridVisible
  if (!showGrid) return

  const cols = Math.max(1, Math.round(frame.gridColumns))
  const rows = Math.max(1, Math.round(frame.gridRows))
  // Dots sit on cell corners rather than cell centres, so "12 × 12" reads as
  // twelve divisions of the frame the way a layout grid does.
  const stepX = width / cols
  const stepY = height / rows
  const dot = Math.max(1, Math.min(width, height) / 900)

  ctx.fillStyle = frame.gridColour
  for (let ix = 0; ix <= cols; ix++) {
    for (let iy = 0; iy <= rows; iy++) {
      ctx.beginPath()
      ctx.arc(ix * stepX, iy * stepY, dot, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

export const FRAME_ASPECT_RATIO: Record<FrameStyle['aspect'], number> = {
  '16:9': 16 / 9,
  '4:5': 4 / 5,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:3': 4 / 3
}

/**
 * The pixel size of an export at a chosen vertical resolution.
 *
 * The number the user picks is the height — "1080" means 1080 lines, the way
 * every video tool means it — so a 9:16 export at 1080 is a tall 608x1080 and
 * not a 1080-wide letterbox.
 *
 * Both dimensions are forced even because H.264 refuses odd dimensions, and
 * the failure arrives at the end of a long encode rather than the start.
 */
export function exportSize(aspect: FrameStyle['aspect'], resolution: number): { width: number; height: number } {
  const ratio = FRAME_ASPECT_RATIO[aspect] ?? 16 / 9
  return { width: even(resolution * ratio), height: even(resolution) }
}

function even(n: number): number {
  const r = Math.round(n)
  return r % 2 === 0 ? r : r + 1
}

/**
 * Text drawn over the piece.
 *
 * Kept in 2D and on top rather than as geometry in the scene, because a title
 * card is type and wants to stay crisp, upright and readable — putting it in
 * the 3D scene would subject it to the pose, the drift and the perspective,
 * which is exactly what nobody wants from a caption.
 *
 * Sizes and positions are fractions of the frame, so a layer placed at 1080
 * lands in the same place at 4K. Tracking is a fraction of the type size for
 * the same reason: as a pixel count it would look right on screen and pull the
 * letters apart in the export.
 *
 * Two things the 2D API does not give us are done by hand. It has no notion of
 * a line box, so multiple lines are laid out here and the block is centred on
 * the layer's own position rather than hanging below it — the anchor should
 * mean the same thing whether the layer is one line or three. And it cannot
 * underline, so the rule is measured and drawn per line, which is also the
 * only way to get it under a *centred* line rather than under the whole block.
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  layers: TextLayer[],
  width: number,
  height: number,
  phase = 0
): void {
  for (const raw of layers) {
    if (!raw.text.trim()) continue
    const visible = layerVisibility(raw, phase)
    if (visible <= 0) continue
    const layer = resolvedText(raw)
    if (layer.opacity <= 0) continue

    const px = Math.round((layer.size / 100) * height)
    if (px <= 0) continue
    const lines = (layer.caps ? layer.text.toLocaleUpperCase() : layer.text).split('\n')
    const step = px * layer.lineHeight

    ctx.save()
    ctx.globalAlpha = (layer.opacity / 100) * visible
    ctx.fillStyle = layer.colour
    ctx.textAlign = layer.align
    ctx.textBaseline = 'middle'
    ctx.font = `${layer.italic ? 'italic ' : ''}${layer.weight} ${px}px ${fontByLabel(layer.font).stack}`
    // Chromium has honoured this since 99, but it is still not everywhere, and
    // assigning an unknown property would silently do nothing rather than warn.
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(layer.tracking / 100) * px}px`

    const x = (layer.x / 100) * width
    const y = (layer.y / 100) * height
    // Centre the block of lines on y, so the anchor is the middle of the text
    // however many lines it turns out to have.
    const top = y - ((lines.length - 1) * step) / 2

    lines.forEach((line, i) => {
      const ly = top + i * step
      ctx.fillText(line, x, ly)
      if (!layer.underline || !line.trim()) return
      const w = ctx.measureText(line).width
      const lx = layer.align === 'left' ? x : layer.align === 'right' ? x - w : x - w / 2
      // Just below the baseline, and thick enough to survive a small export.
      ctx.fillRect(lx, ly + px * 0.42, w, Math.max(1, px * 0.055))
    })

    ctx.restore()
  }
}

/**
 * Logos drawn over the piece.
 *
 * Flat and upright for the same reason text is: a mark is identity, and a
 * logo that tumbles with the scene reads as another card rather than as the
 * signature on the work. Width is a fraction of the frame and the height
 * follows the picture, so a wordmark and a roundel both keep their shape.
 */
export function drawLogos(
  ctx: CanvasRenderingContext2D,
  layers: LogoLayer[],
  images: Map<string, HTMLImageElement>,
  width: number,
  height: number,
  phase = 0
): void {
  for (const layer of layers) {
    const visible = layerVisibility(layer, phase)
    if (visible <= 0) continue
    const img = images.get(layer.imageId)
    if (!img || !img.complete || img.naturalWidth === 0) continue
    if (layer.opacity <= 0) continue
    const w = (layer.size / 100) * width
    const h = w * (img.naturalHeight / img.naturalWidth)
    ctx.save()
    ctx.globalAlpha = Math.min(1, Math.max(0, layer.opacity / 100)) * visible
    ctx.drawImage(img, (layer.x / 100) * width - w / 2, (layer.y / 100) * height - h / 2, w, h)
    ctx.restore()
  }
}

/**
 * The one-line description of what pressing Export will produce.
 *
 * Worth having because every number in it comes from a different section of
 * the panel — the aspect from the frame toolbar, the height and rate from
 * Video, the length from the entrance, the loop and the exit together. Nobody
 * should have to add those up in their head to find out how long the file is.
 */
export function describeOutput(
  doc: MotionDoc,
  cardCount: number,
  ext: string
): string {
  const { width, height } = exportSize(doc.frame.aspect, doc.export.resolution)
  const seconds = clipTimeline(doc, cardCount).frames / Math.max(1, doc.export.fps)
  return [
    `Output ${ext.toUpperCase()}`,
    `${width}×${height}`,
    `${doc.export.fps}fps`,
    `${seconds.toFixed(1)}s`,
    doc.frame.aspect
  ].join(' · ')
}
