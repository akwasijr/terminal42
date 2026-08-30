// The frame's backdrop: colour and grid.
//
// Drawn with the 2D canvas API rather than in the 3D scene so that the screen
// and the exporter can call the very same function. When "grid behind
// component" is on, an exported frame is this backdrop with the WebGL canvas
// composited over it — the same two layers in the same order the user was
// looking at. A grid drawn as scene geometry would have needed its own
// perspective handling and would not have matched.

import type {
  FrameStyle, LogoLayer, MotionDoc, PictureLayer, ShapeKind, ShapeLayer, TextLayer
} from '../../../../shared/motion/types'
import { resolvedText } from '../../../../shared/motion/types'
import { clipTimeline } from '../../../../shared/motion/entrance'
import { applyLayerTransform, layerScaleVisible } from './layerTransform'
import { layerVisibility } from '../../../../shared/motion/frame'

import { textFont } from './overlayPick'
import { canvasPaint } from './paint'

export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  frame: FrameStyle,
  width: number,
  height: number,
  opts: { transparent?: boolean; showGrid?: boolean } = {}
): void {
  ctx.clearRect(0, 0, width, height)
  if (!opts.transparent) {
    ctx.fillStyle = canvasPaint(ctx, frame.background, width, height)
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
    if (!layerScaleVisible(raw)) continue

    const px = Math.round((layer.size / 100) * height)
    if (px <= 0) continue
    const lines = (layer.caps ? layer.text.toLocaleUpperCase() : layer.text).split('\n')
    const step = px * layer.lineHeight

    ctx.save()
    ctx.globalAlpha = (layer.opacity / 100) * visible
    ctx.fillStyle = layer.colour
    ctx.textAlign = layer.align
    ctx.textBaseline = 'middle'
    ctx.font = textFont(layer, px)
    // Chromium has honoured this since 99, but it is still not everywhere, and
    // assigning an unknown property would silently do nothing rather than warn.
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(layer.tracking / 100) * px}px`

    // The block's own extent, which is what the anchor is a fraction of.
    // Measured after the font and tracking are set, or it would be the size
    // of some other typeface.
    const blockW = lines.reduce((widest, line) => Math.max(widest, ctx.measureText(line).width), 0)
    const blockH = lines.length * step
    // Text hangs off its x according to the alignment, so the middle of what
    // you can see is not the x you typed. The anchor has to be a fraction of
    // the words, not of a box they happen to sit to one side of.
    const alignShift = layer.align === 'left' ? blockW / 2 : layer.align === 'right' ? -blockW / 2 : 0

    applyLayerTransform(ctx, raw, {
      cx: (layer.x / 100) * width + alignShift,
      cy: (layer.y / 100) * height,
      w: blockW,
      h: blockH
    })

    // Drawing happens about the origin now, so put the alignment back.
    const x = -alignShift
    // Centre the block of lines on y, so the anchor is the middle of the text
    // however many lines it turns out to have.
    const top = -((lines.length - 1) * step) / 2

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
    if (!layerScaleVisible(layer)) continue
    const w = (layer.size / 100) * width
    const h = w * (img.naturalHeight / img.naturalWidth)
    ctx.save()
    ctx.globalAlpha = Math.min(1, Math.max(0, layer.opacity / 100)) * visible
    applyLayerTransform(ctx, layer, {
      cx: (layer.x / 100) * width,
      cy: (layer.y / 100) * height,
      w,
      h
    })
    ctx.drawImage(img, -w / 2, -h / 2, w, h)
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

/**
 * A shape's outline, in the box it occupies, ready to fill or clip with.
 *
 * One function so a block of colour and the cut on a picture cannot drift
 * apart: a half-circle panel and a half-circle photo beside it have to be the
 * same half-circle or the composition falls over.
 *
 * The box is given as a centre and a size because that is how every layer in
 * this app is placed — from the middle out, as a fraction of the frame — and
 * converting to corners at each call site is where sign errors live.
 */
export function shapePath(
  ctx: CanvasRenderingContext2D,
  kind: ShapeKind,
  cx: number,
  cy: number,
  w: number,
  h: number,
  cornerPct = 0
): void {
  const x = cx - w / 2
  const y = cy - h / 2
  ctx.beginPath()
  switch (kind) {
    case 'ellipse':
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2)
      break
    case 'pill': {
      // A pill's ends are always semicircles, so its radius is half the
      // shorter side and no setting can make it anything else.
      const r = Math.min(w, h) / 2
      ctx.roundRect(x, y, w, h, r)
      break
    }
    case 'half':
      // A half-circle sitting on its flat edge: the arc across the top, then
      // straight along the bottom. Drawn to fill the box rather than as a
      // true half of a circle, so it can be stretched like everything else.
      ctx.moveTo(x, y + h)
      ctx.lineTo(x, y + h)
      ctx.ellipse(cx, y + h, w / 2, h, Math.PI, 0, Math.PI * 2, false)
      ctx.closePath()
      break
    case 'arch': {
      // Straight sides up to a semicircular head — a doorway. The head takes
      // half the width, so a tall arch has long sides and a square one is
      // nearly a half-circle, which is how arches actually behave.
      const r = Math.min(w / 2, h)
      ctx.moveTo(x, y + h)
      ctx.lineTo(x, y + r)
      ctx.arc(cx, y + r, r, Math.PI, 0)
      ctx.lineTo(x + w, y + h)
      ctx.closePath()
      break
    }
    case 'triangle':
      ctx.moveTo(cx, y)
      ctx.lineTo(x + w, y + h)
      ctx.lineTo(x, y + h)
      ctx.closePath()
      break
    case 'rect':
    default: {
      const r = Math.max(0, Math.min(50, cornerPct)) / 100 * Math.min(w, h)
      if (r > 0) ctx.roundRect(x, y, w, h, r)
      else ctx.rect(x, y, w, h)
      break
    }
  }
}

/**
 * Blocks of colour, under everything else on the flat layer.
 *
 * Under, because a shape is scenery: it is the thing type sits on and the
 * thing a picture is placed against. A shape drawn over the type it was meant
 * to back would hide it, and there is no arrangement of the panel in which
 * that is what was wanted.
 */
export function drawShapes(
  ctx: CanvasRenderingContext2D,
  layers: ShapeLayer[],
  width: number,
  height: number,
  phase = 0
): void {
  for (const layer of layers) {
    const visible = layerVisibility(layer, phase)
    if (visible <= 0 || layer.opacity <= 0) continue
    const w = (layer.width / 100) * width
    const h = (layer.height / 100) * height
    if (w <= 0 || h <= 0) continue
    if (!layerScaleVisible(layer)) continue
    ctx.save()
    ctx.globalAlpha = Math.min(1, Math.max(0, layer.opacity / 100)) * visible
    applyLayerTransform(ctx, layer, {
      cx: (layer.x / 100) * width,
      cy: (layer.y / 100) * height,
      w,
      h
    })
    ctx.fillStyle = layer.colour
    drawTiled(ctx, layer, w, h)
    ctx.restore()
  }
}


/**
 * One shape, or the same shape repeated across its box.
 *
 * The box stays the layer's box either way: turning the repeat up divides the
 * space rather than growing it, so a pattern cannot escape the panel it was
 * put on and the layer's own handles still mean what they show.
 */
function drawTiled(
  ctx: CanvasRenderingContext2D,
  layer: ShapeLayer,
  w: number,
  h: number
): void {
  const cols = Math.max(1, Math.round(layer.tileX ?? 1))
  const rows = Math.max(1, Math.round(layer.tileY ?? 1))
  if (cols === 1 && rows === 1) {
    shapePath(ctx, layer.kind, 0, 0, w, h, layer.corner ?? 0)
    ctx.fill()
    return
  }
  const tw = w / cols
  const th = h / rows
  for (let row = 0; row < rows; row++) {
    // A staggered row is offset by half a tile and drawn one tile wider, so
    // the shift does not leave a gap at one edge and a stub at the other.
    const shift = layer.tileStagger && row % 2 === 1 ? tw / 2 : 0
    for (let col = shift ? -1 : 0; col < cols; col++) {
      const cx = -w / 2 + tw * (col + 0.5) + shift
      const cy = -h / 2 + th * (row + 0.5)
      ctx.save()
      // Clipped to the layer's box so a staggered row cannot bleed past it.
      ctx.beginPath()
      ctx.rect(-w / 2, -h / 2, w, h)
      ctx.clip()
      shapePath(ctx, layer.kind, cx, cy, tw, th, layer.corner ?? 0)
      ctx.fill()
      ctx.restore()
    }
  }
}

/**
 * Photographs cut to a shape.
 *
 * A slot with no picture in it draws as a marked placeholder rather than as
 * nothing. Nothing is indistinguishable from a layer that has broken, and a
 * template has to be able to say "a portrait goes here" before anyone has
 * chosen one.
 */
export function drawPictures(
  ctx: CanvasRenderingContext2D,
  layers: PictureLayer[],
  images: Map<string, HTMLImageElement>,
  width: number,
  height: number,
  phase = 0
): void {
  for (const layer of layers) {
    const visible = layerVisibility(layer, phase)
    if (visible <= 0 || layer.opacity <= 0) continue
    const w = (layer.width / 100) * width
    const h = (layer.height / 100) * height
    if (w <= 0 || h <= 0) continue
    const img = layer.imageId ? images.get(layer.imageId) : undefined
    const ready = img && img.complete && img.naturalWidth > 0

    if (!layerScaleVisible(layer)) continue
    ctx.save()
    ctx.globalAlpha = Math.min(1, Math.max(0, layer.opacity / 100)) * visible
    applyLayerTransform(ctx, layer, {
      cx: (layer.x / 100) * width,
      cy: (layer.y / 100) * height,
      w,
      h
    })
    shapePath(ctx, layer.mask, 0, 0, w, h, layer.corner ?? 0)

    if (ready) {
      ctx.clip()
      // Cover fills the mask and loses the overflow; contain shows the whole
      // picture and leaves the rest of the mask empty. Scaled from the centre
      // either way, so changing the fit does not also move the subject.
      const scale = layer.fit === 'contain'
        ? Math.min(w / img.naturalWidth, h / img.naturalHeight)
        : Math.max(w / img.naturalWidth, h / img.naturalHeight)
      const dw = img.naturalWidth * scale
      const dh = img.naturalHeight * scale
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
    } else {
      drawPlaceholder(ctx, w, h, layer.placeholder ?? 'Picture')
    }
    ctx.restore()
  }
}

/**
 * What an empty picture slot looks like.
 *
 * A flat tint and the words for what belongs there, and nothing else. It used
 * to carry a rule corner to corner and a dark plate behind the label; both
 * were removed because a template full of crossed-out boxes reads as cheap
 * rather than as unfinished, and the label alone already says the slot is
 * empty.
 *
 * Assumes the path for the mask is already on the context, so the placeholder
 * takes the shape of the slot rather than always being a rectangle.
 */
function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  label: string
): void {
  ctx.save()
  ctx.fillStyle = 'rgba(128,128,132,0.22)'
  ctx.fill()
  ctx.clip()

  // Sized to the slot with no floor under it. There used to be a 9px minimum,
  // which is a sensible legibility floor and a bad idea here: a small slot in
  // a gallery tile got a label far too big for it, drawn at the clip's centre,
  // so all anyone saw was the middle three letters — "Picture" showing as
  // "ctu". A slot too small to say what it is says nothing and stays a tint,
  // which is honest; three letters of a word is just wrong.
  const size = Math.min(w, h) * 0.075
  ctx.font = `500 ${size}px "DM Sans", system-ui, sans-serif`
  if (size >= 7 && ctx.measureText(label).width <= w * 0.86) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(128,128,132,0.85)'
    ctx.fillText(label, 0, 0)
  }
  ctx.restore()
}
