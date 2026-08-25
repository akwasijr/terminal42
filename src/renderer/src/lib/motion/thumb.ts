// Preset thumbnails.
//
// Drawn as a flat projection on a 2D canvas rather than by spinning up a
// WebGL context per thumbnail. Fifteen live 3D previews per component would
// mean fifteen contexts — browsers cap those at around sixteen and start
// silently killing the oldest — and would burn a GPU frame each on every
// panel repaint. A projected outline is enough to tell a ring from a ribbon,
// which is the only job a thumbnail has.

import type { CardPlacement, MotionDoc, Pose } from '../../../../shared/motion/types'
import { computePlacements } from '../../../../shared/motion/frame'

/** Matches the engine's camera closely enough that a thumbnail predicts the frame. */
const FOCAL = 12

export function drawPresetThumb(
  canvas: HTMLCanvasElement,
  doc: MotionDoc,
  phase: number,
  opts: { width: number; height: number; accent: string; muted: string }
): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(opts.width * dpr)
  canvas.height = Math.round(opts.height * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, opts.width, opts.height)

  const placements = computePlacements(doc, phase)
  const projected = placements
    .map((p) => project(p, doc.pose))
    .filter((p) => p.depth > 0.05)
    // Painter's algorithm: far cards first, so near cards overlap them the way
    // the real renderer draws it.
    .sort((a, b) => b.z - a.z)

  const bounds = extent(projected)
  const pad = 6
  const scale = Math.min(
    (opts.width - pad * 2) / Math.max(0.001, bounds.w),
    (opts.height - pad * 2) / Math.max(0.001, bounds.h)
  )

  for (const p of projected) {
    const x = opts.width / 2 + (p.x - bounds.cx) * scale
    const y = opts.height / 2 + (p.y - bounds.cy) * scale
    const w = Math.max(1.5, 0.62 * p.depth * scale * p.scale)
    const h = Math.max(2, 0.82 * p.depth * scale * p.scale)
    ctx.globalAlpha = Math.max(0.12, Math.min(1, p.opacity * (0.45 + p.depth * 0.55)))
    ctx.fillStyle = p.depth > 0.9 ? opts.accent : opts.muted
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

function extent(ps: Projected[]): { cx: number; cy: number; w: number; h: number } {
  if (ps.length === 0) return { cx: 0, cy: 0, w: 1, h: 1 }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of ps) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
  }
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w: Math.max(1.2, maxX - minX + 1),
    h: Math.max(1.2, maxY - minY + 1)
  }
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
