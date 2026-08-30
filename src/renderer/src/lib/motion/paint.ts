// A background is either one colour or a run between colours. Both are kept as
// a single string, because everywhere a background is shown that is not the
// engine - a template card, a thumbnail - it is handed straight to CSS, and CSS
// already understands both. The canvas is the only place that does not, so the
// translation lives here rather than splitting the type in two.

/** Matches `linear-gradient(90deg, #aabbcc, #ddeeff)`, the only form written. */
const LINEAR = /^linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg\s*,\s*(.+)\)$/i
const HEX = /#[0-9a-fA-F]{3,8}/g

export function isGradient(value: string): boolean {
  return LINEAR.test(value.trim())
}

/**
 * Builds a two-stop gradient string. Kept in one place so the parser above and
 * every caller agree on the spelling without anyone having to match by eye.
 */
export function linearGradient(angleDeg: number, from: string, to: string): string {
  return `linear-gradient(${Math.round(angleDeg)}deg, ${from}, ${to})`
}

/**
 * What to give a 2D context's fillStyle for this background.
 *
 * An unreadable value falls back to the string itself: the canvas then paints
 * black, which is what it did before gradients existed, rather than throwing
 * and taking the whole frame with it.
 */
export function canvasPaint(
  ctx: CanvasRenderingContext2D,
  value: string,
  width: number,
  height: number
): string | CanvasGradient {
  const m = LINEAR.exec(value.trim())
  if (!m) return value

  const stops = m[2].match(HEX) ?? []
  if (stops.length < 2) return stops[0] ?? value

  // CSS measures the angle from "up", clockwise; the canvas wants two points.
  // Half the diagonal in that direction reaches the corner the run should end
  // at, so a 45deg gradient meets the corner rather than stopping short of it.
  const rad = (Number(m[1]) - 90) * (Math.PI / 180)
  const cx = width / 2
  const cy = height / 2
  const reach = (Math.abs(Math.cos(rad)) * width + Math.abs(Math.sin(rad)) * height) / 2
  const g = ctx.createLinearGradient(
    cx - Math.cos(rad) * reach, cy - Math.sin(rad) * reach,
    cx + Math.cos(rad) * reach, cy + Math.sin(rad) * reach
  )
  stops.forEach((hex, i) => g.addColorStop(i / (stops.length - 1), hex))
  return g
}
