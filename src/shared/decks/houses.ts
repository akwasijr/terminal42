// House styles for decks — the values, shared by the generator and the gallery.
//
// Web pages get an art direction picked for them, which is why two landing
// pages made a week apart do not look like the same page twice. Decks got
// nothing, and it showed: every deck came back as centred white slides with a
// heading, three bullets and a stock photograph, whatever the brief said.
//
// A house is a set of values for the chassis in deckChassis.ts: its ground,
// its inks, its four accents, its faces and its corner radius, plus the few
// judgements the chassis cannot make for itself — what a photograph is for,
// how a number is drawn, and the order the deck runs in.
//
// These live in shared/ rather than main/ because the gallery draws its
// previews from exactly these values. A preview painted from a copy would
// drift from the deck it promises, and a template that lies about what it
// makes is worse than no template at all.
//
// Anything the user pinned in the brief wins. If they chose a palette, the
// house keeps its type, imagery and running order and drops its colours; if
// they bound the design to a token library, the tokens win over both.


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
      '--deck-radius': '2px'
    },
    fontsHref: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap',
    type: 'Headlines run two lines with the second line inside a <span class="accent">. That two-tone headline is the signature of the house and belongs on every content slide.',
    imagery: 'Photographs of people working, rectangular, hard-cropped, always beside the text rather than behind it. A stepped checkerboard of plum squares runs off one corner as the only decoration.',
    data: 'Three or four stat tiles under a heading, each a bold figure and a short label. Milestones run as a numbered recap rather than as a chart.',
    sequence: 'Cover, agenda, a split of the situation and the response, a stats slide, a two-up exhibit, a tiles slide of workstreams, a numbered recap, contact. Every slide but the cover carries the company name top left, the place top right and a page number bottom left.'
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
      '--deck-radius': '4px',
      // Light and upper case, which is the whole character of the reference:
      // the headlines are wide, airy and set in capitals, and setting them
      // bold — the default everywhere else — turns an editorial deck into a
      // corporate one.
      '--deck-heading-weight': '300',
      '--deck-heading-case': 'uppercase',
      // Capitals need air, not the negative tracking a bold lower-case
      // headline wants.
      '--deck-heading-track': '.01em'
    },
    fontsHref: 'https://fonts.googleapis.com/css2?family=Archivo:wght@300;400;600&family=IBM+Plex+Mono:wght@400;500&display=swap',
    type: 'Display set light and wide in capitals, never bold, with the mono for every caption, label and eyebrow. That mono is the tell: reference numbers, versions and column headers are all monospaced.',
    imagery: 'Fashion and still-life photography, warm and slightly desaturated, often two frames side by side at different crops.',
    data: 'Figures set very large in the display face with a monospaced label beneath. Percentage tiles on a visible grid, one tile inverted.',
    sequence: 'Cover with a two-frame exhibit, a three-point principles slide, a stats grid, a single statement slide, a split of strategy, a lookbook carousel, a recap, a closing line.'
  },

  // Taken from the orange-and-black investor deck in the reference set: one
  // loud brand colour used at full strength as a ground, condensed capitals
  // at cover size, and numbered points that read like a contents page.
  {
    id: 'pitch',
    label: 'Pitch — investor orange',
    note: 'One loud orange against black and off-white. Built to be read from a back row.',
    tone: 'light',
    tokens: {
      ...tints('light'),
      '--deck-bg': '#FBF7F2',
      '--deck-ink': '#121212',
      '--deck-ink-2': '#3A3634',
      '--deck-ink-3': '#7A736E',
      '--deck-accent-1': '#F1571C',
      '--deck-accent-2': '#121212',
      '--deck-accent-3': '#F1571C',
      '--deck-accent-4': '#FFE3D2',
      '--deck-font': "'Archivo',-apple-system,system-ui,sans-serif",
      '--deck-mono': "'Archivo',ui-monospace,Menlo,monospace",
      '--deck-radius': '0px',
      '--deck-heading-weight': '900',
      '--deck-heading-case': 'uppercase',
      '--deck-heading-track': '-.01em'
    },
    fontsHref: 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800;900&display=swap',
    type: 'Headings in heavy capitals, tight and stacked over two or three lines. Body stays small and regular underneath. Inside a sentence, the words that carry the claim are set in the orange.',
    imagery: 'Full-bleed photographs of people at work, cropped square and butted straight against each other with no gap. Never a photograph behind text.',
    data: 'Points numbered 01, 02, 03 in large light figures with a short heading and two lines beneath, stepped down the slide with a small arrow between them.',
    sequence: 'Cover on solid orange, a numbered contents page on black, the problem across two or three numbered slides, the product, the solution, market opportunity, business model, financials, the team, the ask.'
  }
]

/** One house by id, or null when the id is unknown. */
export function deckStyleById(id: string): DeckStyle | null {
  return DECK_STYLES.find((s) => s.id === id) ?? null
}
