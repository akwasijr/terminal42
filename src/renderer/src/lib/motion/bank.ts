// The starter pictures.
//
// The tool this is modelled on ships fifty-four stock photographs. We cannot
// redistribute those, and shipping a folder of images would put megabytes in
// the app for the sake of something most people replace immediately. So the
// starter set is drawn instead: twelve deterministic pictures, generated at
// whatever size is asked for, that exist to show what a deck of cards looks
// like with pictures on it.
//
// Deterministic is the point. The same id always draws the same picture, so a
// piece made today opens the same tomorrow even though nothing was stored.

export type BankImage = { id: string; label: string }

export const IMAGE_BANK: readonly BankImage[] = [
  { id: 'dune', label: 'Dune' },
  { id: 'tide', label: 'Tide' },
  { id: 'ember', label: 'Ember' },
  { id: 'moss', label: 'Moss' },
  { id: 'slate', label: 'Slate' },
  { id: 'bloom', label: 'Bloom' },
  { id: 'signal', label: 'Signal' },
  { id: 'drift', label: 'Drift' },
  { id: 'quarry', label: 'Quarry' },
  { id: 'lantern', label: 'Lantern' },
  { id: 'harbour', label: 'Harbour' },
  { id: 'orchard', label: 'Orchard' }
]

/** Two ends of a gradient and an ink colour for whatever sits on top of it. */
const PALETTE: Record<string, [string, string, string]> = {
  dune: ['#e8d5b7', '#b07d4f', '#4a2f1a'],
  tide: ['#bfe3f2', '#2f6f93', '#0e2a3a'],
  ember: ['#ffd0a6', '#d1452f', '#3d0f0a'],
  moss: ['#d6e6c3', '#4f7a3a', '#1c2e14'],
  slate: ['#d8dbe0', '#5b636e', '#1b1f24'],
  bloom: ['#f6d3e2', '#b4477e', '#3a1024'],
  signal: ['#fff0b8', '#e0a400', '#3d2c00'],
  drift: ['#dcd9f2', '#6558a8', '#1f1a3d'],
  quarry: ['#e3ded6', '#8c7f6b', '#2e281f'],
  lantern: ['#ffe2c2', '#e2761f', '#3f1d05'],
  harbour: ['#cfe0e6', '#3d6b78', '#13272d'],
  orchard: ['#e9e3bd', '#7f9a3c', '#2a3312']
}

/**
 * A small integer hash, so every picture's arrangement follows from its id.
 *
 * The same reasoning as everywhere else in Motion: no `Math.random()`, because
 * a picture that changed between the screen and the export would be a bug that
 * only appeared in the file.
 */
function hash(seed: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

/**
 * Draw one starter picture at the given size.
 *
 * Each is a gradient with a few large shapes over it — big enough to still
 * read as something at the size a card appears on screen, which a photograph
 * scaled to 90 pixels would not.
 */
export function drawBankImage(canvas: HTMLCanvasElement, id: string, size = 512): void {
  const ctx = canvas.getContext('2d')
  if (!ctx || size <= 0) return
  canvas.width = size
  canvas.height = Math.round(size * 1.25)
  const w = canvas.width
  const h = canvas.height
  const [light, mid, ink] = PALETTE[id] ?? PALETTE.slate

  const angle = hash(id, 1) * Math.PI
  const grad = ctx.createLinearGradient(0, 0, Math.cos(angle) * w, Math.sin(angle) * h)
  grad.addColorStop(0, light)
  grad.addColorStop(1, mid)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  const shapes = 3 + Math.floor(hash(id, 2) * 3)
  for (let i = 0; i < shapes; i++) {
    const r = hash(id, 10 + i)
    const s = hash(id, 40 + i)
    ctx.save()
    ctx.globalAlpha = 0.12 + s * 0.22
    ctx.fillStyle = i % 2 === 0 ? ink : light
    ctx.translate(r * w, s * h)
    ctx.rotate((r - 0.5) * Math.PI)
    if (i % 3 === 0) {
      ctx.beginPath()
      ctx.arc(0, 0, w * (0.18 + s * 0.3), 0, Math.PI * 2)
      ctx.fill()
    } else if (i % 3 === 1) {
      ctx.fillRect(-w * 0.4, -h * 0.06, w * 0.8, h * (0.05 + s * 0.14))
    } else {
      ctx.beginPath()
      ctx.moveTo(0, -h * 0.24)
      ctx.lineTo(w * 0.3, h * 0.18)
      ctx.lineTo(-w * 0.3, h * 0.18)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }

  // A band along the bottom gives every picture a consistent place for the eye
  // to land, which is what stops a deck of twelve of these reading as noise.
  ctx.fillStyle = ink
  ctx.globalAlpha = 0.85
  ctx.fillRect(0, h - h * 0.11, w, h * 0.11)
  ctx.globalAlpha = 1
}

/** The same picture as a PNG payload, ready to be written to disk. */
export function bankImageBase64(id: string, size = 512): string | null {
  const canvas = document.createElement('canvas')
  drawBankImage(canvas, id, size)
  const url = canvas.toDataURL('image/png')
  return url.split(',')[1] ?? null
}
