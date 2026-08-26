// The frame's backdrop: colour and grid.
//
// Drawn with the 2D canvas API rather than in the 3D scene so that the screen
// and the exporter can call the very same function. When "grid behind
// component" is on, an exported frame is this backdrop with the WebGL canvas
// composited over it — the same two layers in the same order the user was
// looking at. A grid drawn as scene geometry would have needed its own
// perspective handling and would not have matched.

import type { FrameStyle, LogoLayer, MotionDoc, TextLayer } from '../../../../shared/motion/types'
import { clipTimeline } from '../../../../shared/motion/entrance'

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
 * lands in the same place at 4K.
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  layers: TextLayer[],
  width: number,
  height: number
): void {
  for (const layer of layers) {
    if (!layer.text.trim()) continue
    ctx.save()
    ctx.fillStyle = layer.colour
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `600 ${Math.round((layer.size / 100) * height)}px "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif`
    ctx.fillText(layer.text, (layer.x / 100) * width, (layer.y / 100) * height)
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
  height: number
): void {
  for (const layer of layers) {
    const img = images.get(layer.imageId)
    if (!img || !img.complete || img.naturalWidth === 0) continue
    if (layer.opacity <= 0) continue
    const w = (layer.size / 100) * width
    const h = w * (img.naturalHeight / img.naturalWidth)
    ctx.save()
    ctx.globalAlpha = Math.min(1, Math.max(0, layer.opacity / 100))
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
