// House styles for decks.
//
// Web pages get an art direction picked for them, which is why two landing
// pages made a week apart do not look like the same page twice. Decks got
// nothing, and it showed: every deck came back as centred white slides with a
// heading, three bullets and a stock photograph, whatever the brief said.
//
// A house used to be described in prose — the furniture along the edges, how
// a slide is grounded, what the running order is — and a model reads prose and
// approximates it. The chassis in deckChassis.ts now supplies the structure as
// working code, so a house here is no longer a description of a deck. It is a
// set of values for the chassis: its ground, its inks, its four accents, its
// faces, and its corner radius, plus the handful of judgements the chassis
// cannot make for itself — what a photograph is for, how a number is drawn,
// and the order the deck runs in.
//
// Anything the user pinned in the brief wins. If they chose a palette, the
// house keeps its type, imagery and running order and drops its colours; if
// they bound the design to a token library, the tokens win over both.

import type { DesignBrief } from './design.types'

export type DeckStyle = {
  id: string
  label: string
  /** One line, in the voice of the deck it came from. */
  note: string
  /** Dark or light ground, so the chassis flips its panel tints to match. */
  tone: 'dark' | 'light'
  /** Chassis custom properties, written straight into the deck's :root. */
  tokens: Record<string, string>
  /** A Google Fonts href, or null when the faces are already on the system. */
  fontsHref: string | null
  /** How the faces are used, beyond which ones they are. */
  type: string
  imagery: string
  /** How a number, a chart or a percentage is drawn in this house. */
  data: string
  /** The running order this style is built to carry. */
  sequence: string
}

/** Panel tints and sheen, which follow the ground rather than the palette. */
function tints(tone: 'dark' | 'light'): Record<string, string> {
  return tone === 'dark'
    ? {
        '--deck-panel': 'rgba(255,255,255,.045)',
        '--deck-panel-2': 'rgba(255,255,255,.085)',
        '--deck-sheen': 'rgba(255,255,255,.07)'
      }
    : {
        '--deck-panel': 'rgba(15,17,26,.045)',
        '--deck-panel-2': 'rgba(15,17,26,.085)',
        '--deck-sheen': 'rgba(255,255,255,.55)'
      }
}

export const DECK_STYLES: DeckStyle[] = [
  {
    id: 'press',
    label: 'Press — monochrome studio',
    note: 'Black, white, and one highlighter. The type does all the work.',
    tone: 'light',
    tokens: {
      ...tints('light'),
      '--deck-bg': '#FFFFFF',
      '--deck-ink': '#0A0A0A',
      '--deck-ink-2': '#5E5E5E',
      '--deck-ink-3': '#8A8A8A',
      '--deck-accent-1': '#0A0A0A',
      '--deck-accent-2': '#EFEE3C',
      '--deck-accent-3': '#0A0A0A',
      '--deck-accent-4': '#EFEE3C',
      '--deck-font': "'Inter Tight',-apple-system,system-ui,sans-serif",
      '--deck-mono': "'IBM Plex Mono',ui-monospace,Menlo,monospace",
      '--deck-radius': '0px'
    },
    fontsHref: 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap',
    type: 'Headlines large and regular weight, never bold, never tracked out, sentence case, two or three words per line. Everything else small, in the mono. No third face.',
    imagery: 'Full-bleed architectural or documentary photography, hard-cropped, square corners, no shadow. One photograph per slide at most, and several slides carry none.',
    data: 'A single number set enormous against a short label. Charts are hairline: grey bars with exactly one bar in the highlight, thin lines with small dot markers.',
    sequence: 'Cover, contents, the position in one sentence, the case in three or four reasons, a numbers slide, a two-up exhibit, a recap, contact.'
  },
  {
    id: 'cellar',
    label: 'Cellar — warm brand book',
    note: 'A brand guide you could hang on a wall. Deep maroon, cream and gold.',
    tone: 'dark',
    tokens: {
      ...tints('dark'),
      '--deck-bg': '#5C1A1B',
      '--deck-ink': '#F6E7B4',
      '--deck-ink-2': '#D8B98A',
      '--deck-ink-3': '#A97E62',
      '--deck-accent-1': '#C9A44C',
      '--deck-accent-2': '#99502A',
      '--deck-accent-3': '#C9A44C',
      '--deck-accent-4': '#99502A',
      '--deck-font': "'Manrope',-apple-system,system-ui,sans-serif",
      '--deck-mono': "'DM Mono',ui-monospace,Menlo,monospace",
      '--deck-radius': '18px'
    },
    fontsHref: 'https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=DM+Mono:wght@400;500&display=swap',
    type: 'One rounded geometric sans in exactly two roles: heavy for headlines, regular for everything else. Headlines short and left-set, with a small mono label above them.',
    imagery: 'Mosaics — a grid of photographs butted edge to edge with no gaps, mixing portraits, hands, materials and objects, all graded warm.',
    data: 'Colour rather than charts. A row of full-height swatches, each labelled with its name and role. Numbers appear inline rather than as hero figures.',
    sequence: 'Wordmark cover, the position on one slide, the mark in use, a two-up exhibit of surfaces, the palette as labelled tiles, an image mosaic, type specimens, a closing wordmark with the line.'
  },
  {
    id: 'grove',
    label: 'Grove — dark product deck',
    note: 'Forest green and acid lime, with numbers big enough to read from the back.',
    tone: 'dark',
    tokens: {
      ...tints('dark'),
      '--deck-bg': '#14302A',
      '--deck-ink': '#F2F5F1',
      '--deck-ink-2': '#9DBBAC',
      '--deck-ink-3': '#4E9E7A',
      '--deck-accent-1': '#A5E052',
      '--deck-accent-2': '#4E9E7A',
      '--deck-accent-3': '#A5E052',
      '--deck-accent-4': '#2C6B54',
      '--deck-font': "'Space Grotesk',-apple-system,system-ui,sans-serif",
      '--deck-mono': "'Space Mono',ui-monospace,Menlo,monospace",
      '--deck-radius': '16px'
    },
    fontsHref: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Space+Mono:wght@400;700&display=swap',
    type: 'Headlines large and set entirely in lower case. Numerals are the display face: set them very large and light, with a small raised plus or per-cent beside them.',
    imagery: 'Two kinds only: cut-out portraits on flat colour, and faceted shapes built from the palette. No stock photography of offices.',
    data: 'Stat tiles carrying one enormous figure each, and side-by-side percentages. Every figure gets a short label under it naming what it measures.',
    sequence: 'Cover, contents, the problem in three reasons, a stats slide of three figures, a split comparison, a tiles slide of what ships, a carousel of the product, a recap, an ask.'
  },
  {
    id: 'orchid',
    label: 'Orchid — corporate report',
    note: 'Blush and plum. Built to carry a lot of text without looking heavy.',
    tone: 'light',
    tokens: {
      ...tints('light'),
      '--deck-bg': '#F9E6F5',
      '--deck-ink': '#241021',
      '--deck-ink-2': '#5D3557',
      '--deck-ink-3': '#8A6483',
      '--deck-accent-1': '#A5219A',
      '--deck-accent-2': '#3B0A34',
      '--deck-accent-3': '#A5219A',
      '--deck-accent-4': '#3B0A34',
      '--deck-font': "'Poppins',-apple-system,system-ui,sans-serif",
      '--deck-mono': "'IBM Plex Mono',ui-monospace,Menlo,monospace",
      '--deck-radius': '14px'
    },
    fontsHref: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap',
    type: 'Headlines run two lines with the second line inside a <span class="accent">. That two-tone headline is the signature of the house and belongs on every content slide.',
    imagery: 'Photographs of people working, rectangular, hard-cropped, always beside the text rather than behind it.',
    data: 'Three or four stat tiles under a heading, each a bold figure and a short label. Milestones run as a numbered recap rather than as a chart.',
    sequence: 'Cover, agenda, a split of the situation and the response, a stats slide, a two-up exhibit, a tiles slide of workstreams, a numbered recap, contact.'
  },
  {
    id: 'atelier',
    label: 'Atelier — editorial fashion',
    note: 'Olive and cream, monospaced captions, and figures set very large.',
    tone: 'light',
    tokens: {
      ...tints('light'),
      '--deck-bg': '#F6F4E9',
      '--deck-ink': '#3A3A1E',
      '--deck-ink-2': '#5A5A2E',
      '--deck-ink-3': '#8C8C63',
      '--deck-accent-1': '#5A5A2E',
      '--deck-accent-2': '#8C8C63',
      '--deck-accent-3': '#5A5A2E',
      '--deck-accent-4': '#3A3A1E',
      '--deck-font': "'Archivo',-apple-system,system-ui,sans-serif",
      '--deck-mono': "'IBM Plex Mono',ui-monospace,Menlo,monospace",
      '--deck-radius': '4px'
    },
    fontsHref: 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&family=IBM+Plex+Mono:wght@400;500&display=swap',
    type: 'A wide sans for display and the mono for every caption, label and eyebrow. That mono is the tell: reference numbers, versions and column headers are all monospaced.',
    imagery: 'Fashion and still-life photography, warm and slightly desaturated, often two frames side by side at different crops.',
    data: 'Figures set very large in the display face with a monospaced label beneath. Percentage tiles on a visible grid, one tile inverted.',
    sequence: 'Cover with a two-frame exhibit, a three-point principles slide, a stats grid, a single statement slide, a split of strategy, a lookbook carousel, a recap, a closing line.'
  }
]

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

export function deckStyleById(id: string): DeckStyle | null {
  return DECK_STYLES.find((s) => s.id === id) ?? null
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
  const seedStr = `${brief?.createdAt ?? 0}|${brief?.kind ?? ''}|${brief?.idea ?? ''}|${brief?.audience ?? ''}`
  const style = DECK_STYLES[hash(seedStr) % DECK_STYLES.length]

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
