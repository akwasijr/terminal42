/**
 * The deck templates.
 *
 * Each one is a whole deck taken from a reference deck in ~/Desktop/Deck Temps
 * and rebuilt on the deck template in ~/deck-template, which is vendored at
 * resources/deck-templates/base. A template is not a colour scheme: the
 * earlier attempt varied only the palette and every deck came out looking the
 * same, which is exactly what it was not supposed to do. So a template here
 * also decides how a slide is laid out — where the heading sits, whether a
 * slide is split down the middle, whether points are numbered, how a figure
 * is set — and those are the things you actually notice.
 */

/** How the cover, and by extension the deck, is composed. */
export type DeckCover =
  /** Heading bottom left on a plain ground, index marker top left. Deck 01. */
  | 'marker'
  /** Wordmark centred on a saturated ground, nothing else. Deck 02. */
  | 'wordmark'
  /** Heading over the lower half of a full-bleed photograph. Deck 03. */
  | 'photo'
  /** Two panels: a portrait on the left, the heading on a dark right. Deck 04. */
  | 'panel'
  /** Two photographic frames at different crops, heading over them. Other. */
  | 'editorial'

/** How a heading is set, which is most of a deck's character. */
export type DeckHeading = {
  /** 100..900. */
  weight: number
  case: 'none' | 'uppercase'
  /** CSS letter-spacing. */
  track: string
  /** Multiplier on the base display size. */
  scale: number
}

export type DeckTemplate = {
  id: string
  /** What it is called in the gallery. */
  name: string
  /** One line. Not a paragraph — the gallery shows the deck, not prose. */
  note: string
  /** Which reference deck it was taken from, for anyone comparing later. */
  source: string
  tone: 'light' | 'dark'
  cover: DeckCover
  heading: DeckHeading
  /** Token overrides written into the deck's own <style>. */
  tokens: Record<string, string>
  /** Google Fonts stylesheet for the faces above, or null for system faces. */
  fontsHref: string | null
  /**
   * The distinguishing layout habits, in the order they show up. Fed to the
   * generator and used to draw the gallery preview, so the preview cannot
   * drift from what the template actually produces.
   */
  moves: string[]
}

export const DECK_TEMPLATES: DeckTemplate[] = [
  {
    id: 'studio',
    name: 'Studio',
    note: 'Black, white and one highlighter yellow.',
    source: 'Deck 01',
    tone: 'light',
    cover: 'marker',
    heading: { weight: 400, case: 'none', track: '-0.02em', scale: 1 },
    tokens: {
      '--deck-bg': '#FFFFFF',
      '--deck-ink': '#000000',
      '--deck-ink-2': '#5C5C5C',
      '--deck-ink-3': '#A3A3A3',
      '--deck-panel': 'rgba(0,0,0,.05)',
      '--deck-panel-2': 'rgba(0,0,0,.09)',
      '--deck-accent-1': '#F4F04B',
      '--deck-accent-2': '#000000',
      '--deck-accent-3': '#F4F04B',
      '--deck-accent-4': '#E8E8E8',
      '--deck-font': "'Helvetica Neue',Helvetica,Arial,sans-serif",
      '--deck-mono': "'Helvetica Neue',Helvetica,Arial,sans-serif",
      '--deck-radius': '0px'
    },
    fontsHref: null,
    moves: [
      'A bracketed index marker, [02], sits above every heading.',
      'Headings are regular weight, never bold, and sit at the top left.',
      'Every third slide flips to a black ground with the type knocked out.',
      'One phrase per deck is marked in the yellow, as a highlighter pen would.',
      'A hairline rule runs above the footer, which carries a name and a URL.',
      'Contents is a real slide: a numbered two or three column list.'
    ]
  },
  {
    id: 'brandbook',
    name: 'Brand book',
    note: 'Deep maroon, wheat cream and gold.',
    source: 'Deck 02',
    tone: 'dark',
    cover: 'wordmark',
    heading: { weight: 800, case: 'none', track: '-0.02em', scale: 1.05 },
    tokens: {
      '--deck-bg': '#5C1F1B',
      '--deck-ink': '#F9EBAF',
      '--deck-ink-2': '#D8BE8A',
      '--deck-ink-3': '#A98A63',
      '--deck-panel': 'rgba(249,235,175,.07)',
      '--deck-panel-2': 'rgba(249,235,175,.13)',
      '--deck-accent-1': '#C9922F',
      '--deck-accent-2': '#F9EBAF',
      '--deck-accent-3': '#8B4A22',
      '--deck-accent-4': '#3A120F',
      '--deck-font': "'Manrope',-apple-system,system-ui,sans-serif",
      '--deck-mono': "'DM Mono',ui-monospace,Menlo,monospace",
      '--deck-radius': '0px'
    },
    fontsHref:
      'https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=DM+Mono:wght@400;500&display=swap',
    moves: [
      'The cover is the wordmark centred on the maroon and nothing else.',
      'Slides come in pairs: maroon, then cream, so the deck breathes.',
      'A full-width swatch strip names each colour with its hex beneath.',
      'Type specimens set a large Aa beside the line the face is meant to set.',
      'Photographs run as an edge-to-edge grid with no gaps between them.',
      'The closing slide repeats the cover with a single line under it.'
    ]
  },
  {
    id: 'briefing',
    name: 'Briefing',
    note: 'White, forest green, and photographs held in green bands.',
    source: 'Deck 03',
    tone: 'light',
    cover: 'photo',
    heading: { weight: 500, case: 'none', track: '-0.02em', scale: 0.95 },
    tokens: {
      '--deck-bg': '#FFFFFF',
      '--deck-ink': '#1C1C1C',
      '--deck-ink-2': '#4A4A4A',
      '--deck-ink-3': '#8A8A8A',
      '--deck-panel': 'rgba(28,28,28,.05)',
      '--deck-panel-2': 'rgba(45,122,62,.12)',
      '--deck-accent-1': '#2D7A3E',
      '--deck-accent-2': '#5BA86B',
      '--deck-accent-3': '#9ACBA4',
      '--deck-accent-4': '#E8F1E9',
      '--deck-font': "'Poppins',-apple-system,system-ui,sans-serif",
      '--deck-mono': "'Poppins',-apple-system,system-ui,sans-serif",
      '--deck-radius': '0px'
    },
    fontsHref:
      'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap',
    moves: [
      'Headings run to two lines, the first in ink and the second in the green.',
      'A photograph fills one half of the slide and butts against the type.',
      'Figures are set inside stepped green columns of increasing height.',
      'Portraits carry a green caption bar across their lower edge.',
      'A green rule runs down the left of a dated list.',
      'Calls to action are a solid green pill with an arrow.'
    ]
  },
  {
    id: 'report',
    name: 'Report',
    note: 'Blush and plum, with a stepped checkerboard.',
    source: 'Deck 04',
    tone: 'light',
    cover: 'panel',
    heading: { weight: 500, case: 'none', track: '-0.01em', scale: 1 },
    tokens: {
      '--deck-bg': '#FBEAF6',
      '--deck-ink': '#2B0A26',
      '--deck-ink-2': '#5C2352',
      '--deck-ink-3': '#9B6D92',
      '--deck-panel': 'rgba(43,10,38,.05)',
      '--deck-panel-2': 'rgba(43,10,38,.10)',
      '--deck-accent-1': '#9B1E86',
      '--deck-accent-2': '#5C1050',
      '--deck-accent-3': '#2B0A26',
      '--deck-accent-4': '#E9C6E0',
      '--deck-font': "'Poppins',-apple-system,system-ui,sans-serif",
      '--deck-mono': "'Poppins',-apple-system,system-ui,sans-serif",
      '--deck-radius': '0px'
    },
    fontsHref:
      'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap',
    moves: [
      'A standing header carries the company name left and the place right.',
      'Headings break across two lines, the second line in the plum.',
      'The cover is a portrait panel on the left against a dark plum right.',
      'Points sit under a horizontal rule with numbered plum tabs on it.',
      'A stepped checkerboard of plum squares runs off one corner.',
      'Page numbers, not dots: "Page 17" bottom left on every slide.'
    ]
  },
  {
    id: 'editorial',
    name: 'Editorial',
    note: 'Olive and cream, monospaced captions, figures set very large.',
    source: 'Other Decks',
    tone: 'light',
    cover: 'editorial',
    heading: { weight: 300, case: 'uppercase', track: '0.01em', scale: 1.1 },
    tokens: {
      '--deck-bg': '#F6F4E9',
      '--deck-ink': '#3A3A1E',
      '--deck-ink-2': '#5A5A2E',
      '--deck-ink-3': '#8C8C63',
      '--deck-panel': 'rgba(58,58,30,.06)',
      '--deck-panel-2': 'rgba(58,58,30,.11)',
      '--deck-accent-1': '#5A5A2E',
      '--deck-accent-2': '#8C8C63',
      '--deck-accent-3': '#3A3A1E',
      '--deck-accent-4': '#E4E1CB',
      '--deck-font': "'Archivo',-apple-system,system-ui,sans-serif",
      '--deck-mono': "'IBM Plex Mono',ui-monospace,Menlo,monospace",
      '--deck-radius': '2px'
    },
    fontsHref:
      'https://fonts.googleapis.com/css2?family=Archivo:wght@300;400;600&family=IBM+Plex+Mono:wght@400;500&display=swap',
    moves: [
      'Headings are light, wide capitals — never bold.',
      'Every caption, label and reference number is monospaced.',
      'Figures are set very large with a monospaced label beneath.',
      'Percentage tiles sit on a visible grid with one tile inverted.',
      'Two photographic frames run side by side at different crops.',
      'A scalloped disc marks the slide the deck is really about.'
    ]
  }
]

/** One template by id, or null when the id is unknown. */
export function deckTemplateById(id: string | null | undefined): DeckTemplate | null {
  if (!id) return null
  return DECK_TEMPLATES.find((t) => t.id === id) ?? null
}
