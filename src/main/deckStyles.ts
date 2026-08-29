// Choosing a house style for a deck.
//
// The houses themselves live in shared/decks/houses.ts so the gallery can draw
// its previews from the same values the deck is built from. What is left here
// is the choosing and the writing-out: which house a deck gets, and how that
// becomes direction the model can follow.

import type { DesignBrief } from './design.types'
import { DECK_STYLES, deckStyleById, type DeckStyle } from '../shared/decks/houses'

export { DECK_STYLES, deckStyleById, type DeckStyle }

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pinsColour(b: DesignBrief | null): boolean {
  return !!(b && (b.paletteId || b.primaryColor || (b.paletteColors && b.paletteColors.length) || b.tokensId))
}

function pinsFonts(b: DesignBrief | null): boolean {
  return !!(b && (b.fontPairId || b.fontPrimary || b.fontHeading || b.customFonts))
}

/**
 * Pick one house style for a deck and write it out as prompt direction.
 *
 * Seeded from the brief the same way the web variety engine is, so a deck keeps
 * its house across every iteration turn while two different decks get different
 * houses. The colour block drops out when the user has already answered that
 * question — the type, imagery and running order still apply, because those are
 * the part the chassis has no opinion about.
 */
export function pickDeckStyle(brief: DesignBrief | null): { styleId: string; text: string } {
  // A house chosen from the gallery wins. The automatic pick exists so that
  // two decks do not look alike; once somebody has said which one they want,
  // varying it would be overruling them.
  const seedStr = `${brief?.createdAt ?? 0}|${brief?.kind ?? ''}|${brief?.idea ?? ''}|${brief?.audience ?? ''}`
  const style =
    (brief?.deckStyleId ? deckStyleById(brief.deckStyleId) : null) ??
    DECK_STYLES[hash(seedStr) % DECK_STYLES.length]

  const lines: string[] = ['DECK HOUSE STYLE (commit to this whole, not in part)']
  lines.push(`- House: ${style.label}. ${style.note}`)

  const colourPinned = pinsColour(brief)
  const fontsPinned = pinsFonts(brief)

  // The chassis reads every one of these; setting them is how a house is
  // applied. Anything the user already chose replaces the matching line
  // rather than the whole block, so a pinned palette still gets this house's
  // radius and faces.
  const decl = Object.entries(style.tokens)
    .filter(([k]) => {
      if (colourPinned && (k.startsWith('--deck-accent') || k === '--deck-bg' || k.startsWith('--deck-ink') || k === '--deck-panel' || k === '--deck-panel-2' || k === '--deck-sheen')) return false
      if (fontsPinned && (k === '--deck-font' || k === '--deck-mono')) return false
      return true
    })
    .map(([k, v]) => `  ${k}: ${v};`)

  if (decl.length) {
    lines.push('- Put this in your own <style> after the chassis block:')
    lines.push('  :root{')
    lines.push(...decl)
    lines.push('  }')
  }
  if (!colourPinned && style.tone === 'light') {
    lines.push('- This is a light house: put data-deck-tone="light" on <html> so the chassis flips its panel tints and sheen with it.')
  }
  if (colourPinned) {
    lines.push('- Colour: derive --deck-bg, --deck-ink, --deck-ink-2, --deck-ink-3 and --deck-accent-1..4 from the palette already given in this brief. Set data-deck-tone="light" on <html> if that ground is light.')
  }
  if (!fontsPinned && style.fontsHref) {
    lines.push(`- Load the faces: <link rel="stylesheet" href="${style.fontsHref}">`)
  }
  if (!fontsPinned) lines.push(`- Type: ${style.type}`)
  lines.push(`- Imagery: ${style.imagery}`)
  lines.push(`- Numbers: ${style.data}`)
  lines.push(`- Running order: ${style.sequence}`)

  if (brief?.look) lines.push(`- Express all of this within the requested "${brief.look}" look rather than replacing it.`)
  lines.push(
    '- Do not produce the default deck: a centred title over three equal bullet points, a stock photograph behind a translucent panel, or a slide that is only a heading and a paragraph.'
  )

  return { styleId: style.id, text: lines.join('\n') }
}
