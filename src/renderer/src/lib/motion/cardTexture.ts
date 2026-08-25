// Cards, drawn.
//
// A card is a plane wearing a texture, and everything interesting about how it
// looks — rounded corners, the gradient overlay, the placeholder face — is
// painted into that texture on a 2D canvas rather than solved in the material.
// Two reasons: rounded corners on a plane otherwise need either an alpha mask
// or custom geometry per corner radius, and the exporter has to produce
// exactly what the screen shows, which is far easier to guarantee when the
// pixels come from one place.
//
// Bend is the exception. It has to move vertices, so it is patched into the
// standard material's vertex shader rather than baked.

import type * as THREE from 'three'
import type { CardStyle } from '../../../../shared/motion/types'

const ASPECT_RATIO: Record<CardStyle['aspect'], number> = {
  '1:1': 1,
  '4:6': 4 / 6,
  '4:5': 4 / 5,
  '9:16': 9 / 16,
  '4:3': 4 / 3,
  '16:9': 16 / 9
}

export function cardAspect(style: CardStyle): number {
  return ASPECT_RATIO[style.aspect] ?? 1
}

/**
 * The face of a card, as pixels.
 *
 * `image` is optional: with nothing loaded the card shows the same neutral
 * surface the design mocks up, so a new document is immediately something you
 * can pose and light rather than an empty frame.
 */
export function drawCardFace(
  canvas: HTMLCanvasElement,
  style: CardStyle,
  opts: { image?: HTMLImageElement | null; label?: string; side: 'front' | 'back'; pixelSize?: number }
): void {
  const aspect = cardAspect(style)
  const size = opts.pixelSize ?? 512
  const w = aspect >= 1 ? size : Math.round(size * aspect)
  const h = aspect >= 1 ? Math.round(size / aspect) : size
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, w, h)
  const radius = (Math.min(w, h) * style.corner) / 100
  roundedPath(ctx, 0, 0, w, h, radius)
  ctx.clip()

  if (opts.image) {
    // Cover, not stretch: a portrait photo squeezed into a 16:9 card is the
    // single most obvious sign of a template doing the arranging.
    const ir = opts.image.width / opts.image.height
    const cr = w / h
    let dw = w
    let dh = h
    if (ir > cr) { dw = h * ir } else { dh = w / ir }
    ctx.drawImage(opts.image, (w - dw) / 2, (h - dh) / 2, dw, dh)
  } else {
    const flat = ctx.createLinearGradient(0, 0, 0, h)
    flat.addColorStop(0, '#f4f4f2')
    flat.addColorStop(1, '#dcdcd8')
    ctx.fillStyle = flat
    ctx.fillRect(0, 0, w, h)
    if (opts.label) {
      ctx.fillStyle = '#111110'
      ctx.font = `500 ${Math.round(Math.min(w, h) * 0.11)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(opts.label, w / 2, h / 2)
    }
  }

  const wantsGradient =
    style.gradient && (style.gradientSide === 'both' || style.gradientSide === opts.side)
  if (wantsGradient) {
    const opacity = opts.side === 'back' ? style.backOpacity : style.gradientOpacity
    const g = ctx.createLinearGradient(0, h, 0, 0)
    g.addColorStop(0, `rgba(0,0,0,${(opacity / 100).toFixed(3)})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
}

function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.lineTo(x + w - rad, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad)
  ctx.lineTo(x + w, y + h - rad)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
  ctx.lineTo(x + rad, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad)
  ctx.lineTo(x, y + rad)
  ctx.quadraticCurveTo(x, y, x + rad, y)
  ctx.closePath()
}

/**
 * Teach a material to bend.
 *
 * `onBeforeCompile` is used rather than a bespoke ShaderMaterial so the card
 * keeps three.js's own lighting and tone mapping: a hand-rolled shader would
 * have to reimplement both, and would drift from the rest of the scene the
 * first time the renderer's defaults changed.
 *
 * Returns the uniform objects so the per-frame update can write to them
 * without recompiling anything.
 */
export function applyBendShader(material: THREE.Material): {
  bend: { value: number }
  axis: { value: number }
} {
  const bend = { value: 0 }
  const axis = { value: 0 }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBend = bend
    shader.uniforms.uBendAxis = axis
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uBend;
uniform float uBendAxis;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
if (abs(uBend) > 0.0001) {
  // Wrap the plane onto the inside of a cylinder whose radius follows from
  // the bend angle, so the card's surface length is preserved and a bend of
  // zero is exactly the flat plane rather than a near-miss.
  float span = uBendAxis > 0.5 ? 1.0 : 1.0;
  float u = uBendAxis > 0.5 ? transformed.y : transformed.x;
  float radius = span / uBend;
  float theta = u / radius;
  float offset = radius * (1.0 - cos(theta));
  float along = radius * sin(theta);
  if (uBendAxis > 0.5) { transformed.y = along; } else { transformed.x = along; }
  transformed.z -= offset;
}`
      )
  }
  material.needsUpdate = true
  return { bend, axis }
}
