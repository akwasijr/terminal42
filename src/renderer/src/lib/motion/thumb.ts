// Preset thumbnails.
//
// Drawn as a flat projection on a 2D canvas rather than by spinning up a
// WebGL context per thumbnail. Fifteen live 3D previews per component would
// mean fifteen contexts — browsers cap those at around sixteen and start
// silently killing the oldest — and would burn a GPU frame each on every
// panel repaint. A projected outline is enough to tell a ring from a ribbon,
// which is the only job a thumbnail has.

import type { CardPlacement, MotionDoc, Pose } from '../../../../shared/motion/types'
import { computePlacements, resolvedPictureLayers, resolvedShapeLayers } from '../../../../shared/motion/frame'
import { drawPictures, drawShapes } from './backdrop'

/**
 * The engine's camera, mirrored here.
 *
 * A thumbnail is only worth showing if it predicts the frame, so it uses the
 * same lens and the same distance rather than zooming to fit whatever the
 * preset happens to contain. Fitting to content made every preset fill its
 * tile: two enormous cards and forty tiny ones both ended up tile-sized, so
 * the strip told you nothing about how they differ.
 */
const FOCAL = 12
const FOV_DEG = 38

/** Card footprint in scene units, shared by the fit measurement and the draw. */
const CARD_W = 0.62
const CARD_H = 0.82

export function drawPresetThumb(
  canvas: HTMLCanvasElement,
  doc: MotionDoc,
  phase: number,
  opts: { width: number; height: number; near: string; far: string }
): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(opts.width * dpr)
  canvas.height = Math.round(opts.height * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, opts.width, opts.height)

  // Scenery first, because it sits under the cards in the real frame. A tile
  // that left it out would show the Habitts card as a scatter of dots on
  // white and tell you nothing about the template you were choosing.
  //
  // No pictures are passed: the gallery builds every template with none, so
  // each picture draws as its placeholder, which is what the template really
  // amounts to before you have chosen a photograph.
  drawShapes(ctx, resolvedShapeLayers(doc, phase), opts.width, opts.height, phase)
  drawPictures(ctx, resolvedPictureLayers(doc, phase), new Map(), opts.width, opts.height, phase)

  const placements = computePlacements(doc, phase)
  const projected = placements
    .map((p) => project(p, doc.pose))
    .filter((p) => p.depth > 0.05)
    // Painter's algorithm: far cards first, so near cards overlap them the way
    // the real renderer draws it.
    .sort((a, b) => b.z - a.z)

  // Pixels per world unit at the z = 0 plane, straight off the camera's
  // frustum. Anything the real frame would crop, the tile crops too.
  const scale = opts.height / (2 * Math.tan((FOV_DEG * Math.PI) / 360) * FOCAL)

  for (const p of projected) {
    const x = opts.width / 2 + p.x * scale
    const y = opts.height / 2 + p.y * scale
    const w = Math.max(1.5, CARD_W * p.depth * scale * p.scale)
    const h = Math.max(2, CARD_H * p.depth * scale * p.scale)
    ctx.globalAlpha = Math.max(0.12, Math.min(1, p.opacity * (0.45 + p.depth * 0.55)))
    ctx.fillStyle = p.depth > 0.9 ? opts.near : opts.far
    roundRect(ctx, x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.16)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

type Projected = { x: number; y: number; z: number; depth: number; scale: number; opacity: number }

function project(p: CardPlacement, pose: Pose): Projected {
  const rx = (pose.tiltX * Math.PI) / 180
  const ry = (pose.tiltY * Math.PI) / 180
  // Yaw then pitch, the same order the engine's group hierarchy applies them.
  const x1 = p.x * Math.cos(ry) + p.z * Math.sin(ry)
  const z1 = -p.x * Math.sin(ry) + p.z * Math.cos(ry)
  const y2 = p.y * Math.cos(rx) - z1 * Math.sin(rx)
  const z2 = p.y * Math.sin(rx) + z1 * Math.cos(rx)
  const depth = FOCAL / Math.max(0.5, FOCAL - z2)
  return { x: x1 * depth, y: -y2 * depth, z: z2, depth, scale: p.scale, opacity: p.opacity }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
