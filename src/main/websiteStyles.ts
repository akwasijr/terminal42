// Turning a chosen website template into direction the model can follow.
//
// The templates live in shared/websites/templates.ts so the gallery draws its
// previews from the same values the page is built from. What is left here is
// the choosing and the writing-out — the same division as deckStyles.ts.
//
// Unlike a deck there is no chassis to sit on: a website is one page and its
// layout is the whole of it. So the direction here is heavier on composition
// and lighter on tokens than the deck equivalent.

import type { DesignBrief } from './design.types'
import { WEBSITE_TEMPLATES, websiteTemplateById, type WebsiteTemplate } from '../shared/websites/templates'

export { WEBSITE_TEMPLATES, websiteTemplateById, type WebsiteTemplate }

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

/** The skeleton of the page, as an instruction rather than a label. */
const ARCHETYPE_BRIEF: Record<WebsiteTemplate['archetype'], string> = {
  split:
    'Structure: a slim sticky header, then a two-column hero — words on the left, a framed view of the product on the right, both vertically centred and neither taller than its content. Everything below the hero is full width.',
  editorial:
    'Structure: a centred masthead over a hairline rule, one lead story at the full measure, then a multi-column grid of further stories. Text is set in real columns, not in cards. There are no cards on this page at all.',
  grid:
    'Structure: a single line of header, then the work immediately — a two-column grid of large images with the title and year beneath each. No hero, no strapline, no introduction before the work. Tile heights vary.',
  docs: 'Structure: a top bar, then three columns for the rest of the page — a section rail on the left at a fixed width, the article in the middle at a 70-character measure, an on-this-page list on the right that hides below 1100px. The middle column scrolls; the rails are sticky.',
  storefront:
    'Structure: a header with a category row, one wide banner that is not full height, then a four-column product grid with filters in a left rail. Density is the point: show many products, not six large ones.',
  longform:
    'Structure: one centred column the whole way down, maximum 1100px, with sections alternating between the page ground and the tinted panel. The hero is sized to its content. Pricing and questions sit near the end.',
  studio:
    'Structure: a cover filling the first screen with one very large statement and almost no navigation, then a marquee of names, then selected work as full-width rows, then a plain capabilities list. Nothing is in a card.',
  venue:
    'Structure: a photograph across the top with the name over it, then the practical facts — hours, address, telephone — in three columns immediately beneath, before any prose. The menu or service list follows, then a short paragraph, then a map at the foot.'
}

/**
 * Pick one template for a website and write it out as prompt direction.
 *
 * Seeded from the brief the same way decks are, so a site keeps its template
 * across every iteration turn while two different sites get different ones.
 * Colour and font blocks drop out when the user has already answered those
 * questions — the composition still applies, because that is the part a
 * palette has no opinion about.
 */
export function pickWebsiteStyle(brief: DesignBrief | null): { styleId: string; text: string } {
  // A template chosen from the gallery wins. The automatic pick only exists so
  // that two sites do not come out alike.
  const seedStr = `${brief?.createdAt ?? 0}|${brief?.kind ?? ''}|${brief?.idea ?? ''}|${brief?.audience ?? ''}`
  const t =
    (brief?.webStyleId ? websiteTemplateById(brief.webStyleId) : null) ??
    WEBSITE_TEMPLATES[hash(seedStr) % WEBSITE_TEMPLATES.length]

  const lines: string[] = ['WEBSITE TEMPLATE (commit to this whole, not in part)']
  lines.push(`- Template: ${t.name}. ${t.note}`)
  lines.push(`- ${ARCHETYPE_BRIEF[t.archetype]}`)

  const colourPinned = pinsColour(brief)
  const fontsPinned = pinsFonts(brief)

  const tokens: Record<string, string> = {
    ...t.tokens,
    '--site-heading-weight': String(t.heading.weight),
    '--site-heading-track': t.heading.track
  }
  const decl = Object.entries(tokens)
    .filter(([k]) => {
      if (colourPinned && (k === '--site-bg' || k.startsWith('--site-ink') || k === '--site-line' || k === '--site-accent' || k === '--site-panel')) return false
      if (fontsPinned && (k === '--site-font' || k === '--site-mono')) return false
      return true
    })
    .map(([k, v]) => `  ${k}: ${v};`)

  if (decl.length) {
    lines.push('- Declare these on :root and use them throughout. No raw hex anywhere else in the stylesheet:')
    lines.push('  :root{')
    lines.push(...decl)
    lines.push('  }')
  }
  if (colourPinned) {
    lines.push(
      '- Colour: derive --site-bg, --site-ink, --site-ink-2, --site-line, --site-panel and --site-accent from the palette already given in this brief, then use them the same way.'
    )
  }
  if (!fontsPinned && t.fontsHref) {
    lines.push(`- Load the faces: <link rel="stylesheet" href="${t.fontsHref}">`)
  }
  if (t.tone === 'dark') {
    lines.push('- This template is dark. Do not lighten it into a grey, and drop shadows entirely — on a dark ground they do nothing but muddy an edge.')
  }
  lines.push(
    `- Headings: weight ${t.heading.weight}, letter-spacing ${t.heading.track}, and the largest one on the page at roughly ${Math.round(t.heading.scale * 56)}px on a desktop width, fluid with clamp() below that.`
  )

  lines.push('- The moves that make this template itself. Use every one of them at least once:')
  for (const m of t.moves) lines.push(`  - ${m}`)

  if (brief?.look) lines.push(`- Express all of this within the requested "${brief.look}" look rather than replacing it.`)

  // The failure this template set exists to prevent. Worth naming outright,
  // because it is the shape a model reaches for when left alone.
  lines.push(
    '- Do not produce the default AI landing page: a navbar over a gradient hero at 100vh, three feature cards with emoji icons, a row of invented testimonials, a final call to action and a fat footer. If this template is not that shape, do not drift back into it.'
  )
  lines.push(
    '- No blob shapes, wave dividers, aurora backgrounds, tilted dashboard screenshots or gradient hover effects.'
  )

  return { styleId: t.id, text: lines.join('\n') }
}
