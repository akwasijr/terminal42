// Turning a chosen deck template into direction the model can follow.
//
// The templates themselves live in shared/decks/templates.ts so the gallery
// draws its previews from the same values the deck is built from. What is left
// here is the choosing and the writing-out.

import type { DesignBrief } from './design.types'
import { DECK_TEMPLATES, deckTemplateById, type DeckTemplate } from '../shared/decks/templates'

export { DECK_TEMPLATES, deckTemplateById, type DeckTemplate }

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

/** How a cover is composed, as an instruction rather than a label. */
const COVER_BRIEF: Record<DeckTemplate['cover'], string> = {
  marker:
    'Cover: a bracketed index marker at the top left, the heading sitting low at the left, a hairline rule above a footer carrying a name and a URL. No photograph.',
  wordmark:
    'Cover: the wordmark alone, centred, on the saturated ground. Nothing else on the slide — no strapline, no date, no logo lock-up.',
  photo:
    'Cover: a photograph filling the upper two thirds, the heading beneath it in a solid accent band with the type knocked out of it.',
  panel:
    'Cover: split vertically. A portrait photograph on the narrow left against the page ground; the heading on a dark accent panel filling the wider right, with a rule and a short list of section names under it.',
  editorial:
    'Cover: two photographic frames side by side at different crops along the lower half, the heading in light capitals above them, a monospaced reference number top left and the year top right.'
}

/**
 * Pick one template for a deck and write it out as prompt direction.
 *
 * Seeded from the brief the same way the web variety engine is, so a deck keeps
 * its template across every iteration turn while two different decks get
 * different ones. The colour block drops out when the user has already answered
 * that question — the composition and running order still apply, because those
 * are the part the chassis has no opinion about.
 */
export function pickDeckStyle(brief: DesignBrief | null): { styleId: string; text: string } {
  // A template chosen from the gallery wins. The automatic pick exists so that
  // two decks do not look alike; once somebody has said which one they want,
  // varying it would be overruling them.
  const seedStr = `${brief?.createdAt ?? 0}|${brief?.kind ?? ''}|${brief?.idea ?? ''}|${brief?.audience ?? ''}`
  const t =
    (brief?.deckStyleId ? deckTemplateById(brief.deckStyleId) : null) ??
    DECK_TEMPLATES[hash(seedStr) % DECK_TEMPLATES.length]

  const lines: string[] = ['DECK TEMPLATE (commit to this whole, not in part)']
  lines.push(`- Template: ${t.name}. ${t.note}`)

  const colourPinned = pinsColour(brief)
  const fontsPinned = pinsFonts(brief)

  // The chassis reads every one of these; setting them is how a template is
  // applied. Anything the user already chose replaces the matching line rather
  // than the whole block, so a pinned palette still gets this template's radius
  // and faces.
  const tokens: Record<string, string> = {
    ...t.tokens,
    '--deck-heading-weight': String(t.heading.weight),
    '--deck-heading-case': t.heading.case,
    '--deck-heading-track': t.heading.track
  }
  const decl = Object.entries(tokens)
    .filter(([k]) => {
      if (colourPinned && (k.startsWith('--deck-accent') || k === '--deck-bg' || k.startsWith('--deck-ink') || k === '--deck-panel' || k === '--deck-panel-2')) return false
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
  if (!colourPinned && t.tone === 'light') {
    lines.push('- This is a light template: put data-deck-tone="light" on <html> so the chassis turns its panel tints over with it. Put it on <html> only, never on <body>.')
  }
  if (colourPinned) {
    lines.push('- Colour: derive --deck-bg, --deck-ink, --deck-ink-2, --deck-ink-3 and --deck-accent-1..4 from the palette already given in this brief. Set data-deck-tone="light" on <html> if that ground is light.')
  }
  if (!fontsPinned && t.fontsHref) {
    lines.push(`- Load the faces: <link rel="stylesheet" href="${t.fontsHref}">`)
  }

  lines.push(`- Put data-cover="${t.cover}" on the cover section. The chassis lays it out from that; do not lay it out yourself.`)
  lines.push(`- ${COVER_BRIEF[t.cover]}`)
  // The two things the template cannot know, when the brief answered them.
  const LEN: Record<string, string> = {
    short: 'Five to eight slides. One point, made once, and no filler to reach a number.',
    medium: 'Ten to fifteen slides, for fifteen to twenty minutes in a room.',
    long: 'Twenty or more slides. It has to hold up read alone, so every slide carries its own caption.'
  }
  const ARC: Record<string, string> = {
    problem: 'Run it problem to solution: open on what is wrong, spend the middle on why it persists, close on the fix.',
    progress: 'Run it as a state of play: what shipped, what moved, what is next. Numbers early, not saved for the end.',
    proposal: 'Run it as an ask: say what you want in the first three slides, then spend the rest earning it.',
    teach: 'Run it as a lesson: one idea, built up a step at a time, with the recap restating the steps in order.',
    story: 'Run it as a narrative in order, and let the turn land on its own slide.'
  }
  if (brief?.deckLength && LEN[brief.deckLength]) lines.push(`- ${LEN[brief.deckLength]}`)
  if (brief?.deckArc && ARC[brief.deckArc]) lines.push(`- ${ARC[brief.deckArc]}`)
  lines.push('- The moves that make this template itself. Use every one of them at least once:')
  for (const m of t.moves) lines.push(`  - ${m}`)

  if (brief?.look) lines.push(`- Express all of this within the requested "${brief.look}" look rather than replacing it.`)
  lines.push(
    '- Do not produce the default deck: a centred title over three equal bullet points, a stock photograph behind a translucent panel, or a slide that is only a heading and a paragraph.'
  )

  return { styleId: t.id, text: lines.join('\n') }
}
