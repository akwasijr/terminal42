// Making sure the type is actually there before we draw it.
//
// This exists because of a quiet failure in the 2D canvas API: setting
// `ctx.font` to a family the document has not finished loading does not throw
// and does not wait — it silently falls back to a system face and draws that.
// Nothing looks broken, the letters are simply the wrong ones, and on export
// the mistake is baked into the file.
//
// The DOM does not have this problem because it re-renders when a webfont
// arrives. A canvas has already been painted by then, so the load has to be
// awaited first and the frame drawn second.

import { fontByLabel, googleFontsHref } from '../freeformTypes'
import type { TextLayer } from '../../../../shared/motion/types'
import { resolvedText } from '../../../../shared/motion/types'

const LINK_ID = 't42-motion-fonts'

/** The distinct family/weight/style combinations a set of layers actually asks for. */
function facesUsed(layers: TextLayer[]): Array<{ family: string; weight: number; italic: boolean }> {
  const seen = new Map<string, { family: string; weight: number; italic: boolean }>()
  for (const raw of layers) {
    if (!raw.text.trim()) continue
    const layer = resolvedText(raw)
    // A family with no Google spec is a system stack, which is present already.
    if (!fontByLabel(layer.font).google) continue
    const key = `${layer.font}|${layer.weight}|${layer.italic}`
    if (!seen.has(key)) seen.set(key, { family: layer.font, weight: layer.weight, italic: layer.italic })
  }
  return [...seen.values()]
}

/**
 * Ask the document for the families these layers use.
 *
 * Idempotent: the stylesheet link is reused and only its href is touched, so
 * calling this on every document change does not pile up <link> tags or make
 * the browser re-fetch what it already has.
 */
export function requestTextFonts(layers: TextLayer[]): void {
  if (typeof document === 'undefined') return
  const href = googleFontsHref(layers.filter((l) => l.text.trim()).map((l) => resolvedText(l).font))
  if (!href) return
  let link = document.getElementById(LINK_ID) as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = LINK_ID
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }
  if (link.href !== href) link.href = href
}

/**
 * Wait until those families can be drawn.
 *
 * Failures resolve rather than reject. A missing webfont should cost the user
 * a fallback face, not a failed export — and since this is awaited on the path
 * to encoding a video, throwing here would lose the whole render over one
 * unreachable stylesheet.
 */
export async function ensureTextFonts(layers: TextLayer[]): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  const faces = facesUsed(layers)
  if (faces.length === 0) return
  requestTextFonts(layers)
  await Promise.all(
    faces.map(async (f) => {
      try {
        // The size is irrelevant to which face loads, but the shorthand is not
        // optional — `document.fonts.load` parses it as a CSS font value.
        await document.fonts.load(`${f.italic ? 'italic ' : ''}${f.weight} 64px "${f.family}"`)
      } catch {
        // Fall back rather than fail.
      }
    })
  )
}
