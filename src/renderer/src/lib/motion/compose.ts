// One frame, drawn once.
//
// The screen and the exporter used to each assemble a frame their own way:
// the same steps in the same order, written twice. That works until it does
// not, and the failure is the worst kind, because it only shows up in the
// file after the export has finished. Now there is one function, and an
// export differs from the screen only in how large it is.
//
// The order below is the whole design. A shadow goes under the thing that
// casts it. Blur belongs to the picture, so it happens before anything is
// laid on top. Glass bends what is already there, so it comes after the
// picture is finished and before anything that is not part of it. Grain
// reads as the topmost layer of the image. Logos and type are not part of
// the image at all: a caption is not in the photograph.

import type { MotionDoc } from '../../../../shared/motion/types'
import { drawBackdrop, drawLogos, drawOverlay } from './backdrop'
import { beforeCardsFilter, drawEffects } from './effects'
import {
  applyEdgeBlur, applyGlass, drawDropShadow, drawEdgeShade, edgeBlurActive
} from './frameFx'

export type ComposeOptions = {
  transparent?: boolean
  showGrid?: boolean
  /** Source images for logo layers, by image id. */
  images?: Map<string, HTMLImageElement>
  /**
   * Skip the parts that do not depend on where the cards are.
   *
   * The screen keeps those on a layer of their own that is redrawn only when
   * the document changes, because grain reads back every pixel in the frame
   * and doing that sixty times a second for a texture that never moves would
   * cost more than everything else here put together.
   */
  skipStatic?: boolean
  /** Where in the loop this frame is, which decides which layers are on screen. */
  phase?: number
}

/** A scratch canvas for the card layer, kept between frames. */
let cardLayer: HTMLCanvasElement | null = null

function cardScratch(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  if (!cardLayer) cardLayer = document.createElement('canvas')
  if (cardLayer.width !== width || cardLayer.height !== height) {
    cardLayer.width = width
    cardLayer.height = height
  } else {
    cardLayer.getContext('2d')?.clearRect(0, 0, width, height)
  }
  return cardLayer
}

export function releaseComposeScratch(): void {
  if (cardLayer) { cardLayer.width = 0; cardLayer.height = 0 }
  cardLayer = null
}

export function composeFrame(
  ctx: CanvasRenderingContext2D,
  doc: MotionDoc,
  cards: HTMLCanvasElement,
  width: number,
  height: number,
  opts: ComposeOptions = {}
): void {
  if (width <= 0 || height <= 0) return
  const fx = doc.visual.effects
  const target = ctx.canvas

  drawBackdrop(ctx, doc.frame, width, height, {
    transparent: opts.transparent,
    showGrid: opts.showGrid ?? doc.frame.gridVisible
  })

  drawDropShadow(ctx, cards, fx.dropShadow, width, height)

  // Blurring the cards on their own has to happen before they are drawn, or
  // the sharp copy is already on the frame and cannot be taken back out
  // without taking the backdrop with it.
  const blurCardsOnly = edgeBlurActive(fx.edgeBlur) && fx.edgeBlur.over === 'component'
  ctx.save()
  ctx.filter = beforeCardsFilter(fx, height)
  if (blurCardsOnly) {
    const layer = cardScratch(width, height)
    const lctx = layer?.getContext('2d')
    if (layer && lctx) {
      lctx.drawImage(cards, 0, 0, width, height)
      applyEdgeBlur(layer, fx.edgeBlur, width, height)
      ctx.drawImage(layer, 0, 0, width, height)
    } else {
      ctx.drawImage(cards, 0, 0, width, height)
    }
  } else {
    ctx.drawImage(cards, 0, 0, width, height)
  }
  ctx.restore()

  if (edgeBlurActive(fx.edgeBlur) && fx.edgeBlur.over === 'everything') {
    applyEdgeBlur(target, fx.edgeBlur, width, height)
  }

  drawEdgeShade(ctx, fx.edgeShade, width, height, cards)
  applyGlass(target, fx.glass, width, height)

  if (!opts.skipStatic) {
    drawEffects(ctx, fx, width, height)
    drawLogos(ctx, doc.visual.logos, opts.images ?? new Map(), width, height, opts.phase ?? 0)
    drawOverlay(ctx, doc.visual.text, width, height, opts.phase ?? 0)
  }
}
