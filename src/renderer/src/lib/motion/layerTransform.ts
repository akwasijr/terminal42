import type { LayerTransform } from '../../../../shared/motion/types'

/**
 * Where a layer sits and how big it is, in device pixels.
 *
 * `cx`/`cy` are the middle of the layer, because that is what every layer's
 * x/y has always meant here, and `w`/`h` are its own extent -- what the
 * anchor is a fraction of.
 */
export type LayerBox = {
  cx: number
  cy: number
  w: number
  h: number
}

/**
 * Put the canvas into a layer's own frame of reference.
 *
 * Call inside a save()/restore() and then draw the layer centred on the
 * origin. Every kind of layer goes through here so that turning a word and
 * turning a photograph are the same operation rather than four near-copies
 * that drift apart -- which is how shapes ended up able to rotate while text
 * and logos could not.
 *
 * The anchor is the point the layer turns and grows about, and it is placed
 * so that moving it does not move the layer. That is the behaviour anyone who
 * has moved an anchor point in another tool expects: with nothing rotated and
 * nothing scaled, the layer is exactly where it was, and the anchor only
 * starts to matter once there is a transform for it to be the centre of.
 */
export function applyLayerTransform(
  ctx: CanvasRenderingContext2D,
  layer: LayerTransform,
  box: LayerBox
): void {
  const rotation = layer.rotation ?? 0
  const scale = (layer.scale ?? 100) / 100
  const ax = layer.anchor?.x ?? 0.5
  const ay = layer.anchor?.y ?? 0.5

  // The anchor's offset from the middle, which is where the turn happens.
  const ox = (ax - 0.5) * box.w
  const oy = (ay - 0.5) * box.h

  ctx.translate(box.cx + ox, box.cy + oy)
  if (rotation) ctx.rotate((rotation * Math.PI) / 180)
  if (scale !== 1) ctx.scale(scale, scale)
  // Back off the anchor, so what gets drawn at the origin is still the
  // middle of the layer. With no rotation and no scale these two translates
  // cancel exactly and the layer has not moved.
  if (ox || oy) ctx.translate(-ox, -oy)
}

/**
 * Whether a layer would draw as nothing.
 *
 * A scale of zero collapses the canvas transform, and a negative one mirrors
 * it -- which is a real effect, but scaling *through* zero is not, so the
 * sliders stop at zero and this is what the draw code checks before spending
 * anything on it.
 */
export function layerScaleVisible(layer: LayerTransform): boolean {
  return (layer.scale ?? 100) > 0
}

/**
 * The box a layer covers once it has been scaled, for hit testing and the
 * marquee.
 *
 * Rotation is deliberately left out, which is the choice this file's caller
 * has always made: an upright box round a tilted layer is easier to grab than
 * a tilted one, and costs only a little slack at the corners. Scale is not
 * the same kind of detail -- at 200% the layer is twice the size and, if the
 * anchor has been moved, somewhere else as well, so a box that ignored it
 * would sit nowhere near the layer rather than slightly wide of it.
 */
export function scaledBox(layer: LayerTransform, box: LayerBox): LayerBox {
  const scale = layer.scale ?? 100
  if (scale === 100) return box
  const s = scale / 100
  const ox = ((layer.anchor?.x ?? 0.5) - 0.5) * box.w
  const oy = ((layer.anchor?.y ?? 0.5) - 0.5) * box.h
  // Growing away from an anchor that is not the middle moves the middle.
  return {
    cx: box.cx + ox * (1 - s),
    cy: box.cy + oy * (1 - s),
    w: box.w * s,
    h: box.h * s
  }
}
