// House styles for decks.
//
// Web pages get an art direction picked for them, which is why two landing
// pages made a week apart do not look like the same page twice. Decks got
// nothing, and it showed: every deck came back as centred white slides with a
// heading, three bullets and a stock photograph, whatever the brief said.
//
// So decks get the same treatment, but drawn from real reference decks rather
// than invented. Each style below is a whole house — palette, type, the
// furniture along the edges of every slide, how photographs are used, how
// numbers are shown, and the sequence a deck of that kind actually runs in.
// A style is picked as a unit and committed to, because half a house style
// reads as a mistake while a whole one reads as a decision.
//
// Anything the user pinned in the brief wins. If they chose a palette, the
// style keeps its layout and furniture and drops its colours; if they bound
// the design to a token library, the tokens win over both.

import type { DesignBrief } from './design.types'

export type DeckStyle = {
  id: string
  label: string
  /** One line, in the voice of the deck it came from. */
  note: string
  /** Named colour roles, so the prompt can say what each colour is *for*. */
  palette: { role: string; hex: string }[]
  /** Which of the palette a slide is allowed to be, end to end. */
  slideGrounds: string
  type: string
  /** Repeating marks at the edge of every slide. The thing that makes a deck a deck. */
  furniture: string
  imagery: string
  /** How a number, a chart or a percentage is drawn in this house. */
  data: string
  /** The running order this style is built to carry. */
  sequence: string
}

export const DECK_STYLES: DeckStyle[] = [
  {
    id: 'press',
    label: 'Press — monochrome studio',
    note: 'Black, white, and one highlighter. The type does all the work.',
    palette: [
      { role: 'paper', hex: '#FFFFFF' },
      { role: 'ink', hex: '#0A0A0A' },
      { role: 'inverted slide ground', hex: '#000000' },
      { role: 'highlight', hex: '#EFEE3C' },
      { role: 'hairline', hex: '#E4E4E4' },
      { role: 'caption grey', hex: '#8A8A8A' }
    ],
    slideGrounds: 'Every slide is either paper or the inverted black ground. Never a tint, never a gradient. Alternate them so a section reads as a change of gear.',
    type: 'One neutral grotesque throughout (Helvetica Now, Inter Tight or Suisse). Headlines large and regular weight, never bold, never tracked out, sentence case, two or three words per line. Body at a small fixed size in caption grey. No second typeface.',
    furniture: 'A bracketed index in the top left of every slide — [02], [03] — set small in caption grey. A hairline rule under the header. A footer with the brand word on the left and the URL on the right, both tiny. Nothing else touches the edges.',
    imagery: 'Full-bleed architectural or documentary photography, square or tall, hard-cropped, no rounded corners and no shadow. One photograph per slide at most, and some slides carry none at all.',
    data: 'A single number set enormous against a short label — 88%, 12.8K. Charts are hairline: grey bars with exactly one bar filled in the highlight colour, thin line charts with small dot markers, axis labels tiny.',
    sequence: 'Cover, table of contents as a three-column numbered index, about, mission as a numbered list, services, a vision slide with one sentence and a phrase marked in the highlight, a numbers slide, a portfolio grid, contact.'
  },
  {
    id: 'cellar',
    label: 'Cellar — warm brand book',
    note: 'A brand guide you could hang on a wall. Deep maroon, cream and gold.',
    palette: [
      { role: 'deep maroon', hex: '#5C1A1B' },
      { role: 'wheat cream', hex: '#F6E7B4' },
      { role: 'harvest gold', hex: '#C9A44C' },
      { role: 'rust clay', hex: '#99502A' },
      { role: 'espresso', hex: '#3A2018' }
    ],
    slideGrounds: 'Whole slides in flat colour, and slides split down the middle into two flat colours. No white slides anywhere — cream is the light ground.',
    type: 'A rounded geometric sans (Manrope) in exactly two roles: bold for headlines, regular for body and every label. Headlines short and left-set. Labels above a block, small, in the ground\'s complementary colour.',
    furniture: 'Almost none. The style is carried by the colour blocking, not by marks. A small caption line at the foot of a slide where one is needed, and nothing else.',
    imagery: 'Mosaics — a grid of four to eight photographs butted edge to edge with no gaps, mixing portraits, hands, materials and objects, all colour-graded warm to sit inside the palette.',
    data: 'Colour, not charts. A row of full-height swatch columns, each labelled with its name, hex and role. Numbers appear inline in the body rather than as hero figures.',
    sequence: 'Wordmark cover on maroon, positioning statement on cream, the mark in use on a real surface, digital touchpoints, the mark in all four colourways as a four-up grid, the palette as labelled columns, an image mosaic, type specimens with Aa set large, closing wordmark with the tagline.'
  },
  {
    id: 'grove',
    label: 'Grove — dark product deck',
    note: 'Forest green and acid lime, with numbers big enough to read from the back.',
    palette: [
      { role: 'forest ground', hex: '#14302A' },
      { role: 'acid lime', hex: '#A5E052' },
      { role: 'mint', hex: '#4E9E7A' },
      { role: 'paper', hex: '#F2F5F1' },
      { role: 'white', hex: '#FFFFFF' }
    ],
    slideGrounds: 'Mostly the forest ground, with paper slides between sections to let the deck breathe, and occasional full lime slides for a single loud statement.',
    type: 'A geometric sans (Space Grotesk or Poppins) set entirely in lower case, including headlines. Headlines large and light. Numerals are the display face: set them at three or four times the headline size, light weight, with a small raised plus or per-cent sign beside them.',
    furniture: 'A tiny logo lock-up in one top corner and a slash-prefixed label in the other — /introduction, /market, /about us. Pill-shaped outlined tags for secondary labels. Thin rules between stacked rows.',
    imagery: 'Two kinds only: cut-out portraits on flat colour, and faceted isometric shapes built from the palette that read as a logo fragment blown up. No stock photography of offices.',
    data: 'Charts made of blocks — a waffle grid of small squares, half lime and half outlined; stepped bars that overlap and recede; enormous side-by-side percentages. Every chart carries a pill tag naming what it measures.',
    sequence: 'Cover with a headline over a faceted shape, contents as three enormous numerals, a stats slide of three big figures, a ranked comparison, a leadership slide with cut-out portraits, a holdings chart, a full-bleed portrait slide, a section divider with a ghosted numeral, a closing statement.'
  },
  {
    id: 'orchid',
    label: 'Orchid — corporate report',
    note: 'Blush and plum. Built to carry a lot of text without looking heavy.',
    palette: [
      { role: 'blush ground', hex: '#F9E6F5' },
      { role: 'deep plum', hex: '#3B0A34' },
      { role: 'magenta accent', hex: '#A5219A' },
      { role: 'ink', hex: '#241021' },
      { role: 'paper', hex: '#FFFFFF' }
    ],
    slideGrounds: 'Blush by default, paper for the text-heaviest slides, deep plum for openers and closers, and a magenta-to-plum gradient reserved for the final slide only.',
    type: 'A rounded sans (Poppins) for headings and a plain grotesque for body. Headlines run two lines with the second line in the magenta accent — that two-tone headline is the signature of the house and it appears on every content slide.',
    furniture: 'The company name top left and the place or date top right, both small. A page number bottom left. A faint checkerboard of squares in the corner of plum slides, never over text.',
    imagery: 'Photographs of people working, rectangular, hard-cropped, no rounded corners, always placed to one side of the text rather than behind it.',
    data: 'Three or four labelled columns under a thin rule, each with a small asterisk mark, a bold label and a short paragraph. Milestones run along a horizontal rule with numbered nodes. Charts are plain and unfilled.',
    sequence: 'Cover on plum, agenda, a split slide of image and headed paragraphs, a metrics slide of asterisked columns, a numbered milestone rail, a summary of main points, contact on the gradient with address, site, email and phone.'
  },
  {
    id: 'atelier',
    label: 'Atelier — editorial fashion',
    note: 'Olive and cream, monospaced captions, and figures set very large.',
    palette: [
      { role: 'olive', hex: '#5A5A2E' },
      { role: 'sage', hex: '#DDE0C8' },
      { role: 'cream', hex: '#F6F4E9' },
      { role: 'bark', hex: '#3A3A1E' },
      { role: 'chalk', hex: '#FFFFFF' }
    ],
    slideGrounds: 'Cream and sage alternating, with olive slides for the loudest moments. The deck should read as a set of pages from one printed book.',
    type: 'A wide sans for display set in upper case with generous tracking, and a monospace for every caption, label and annotation. That mono is the tell: ref numbers, versions and column headers are all monospaced. Body copy stays small.',
    furniture: 'A reference mark in the top right — Ref. 01 / 26 — and the agency line bottom left, both monospaced. Thin rules boxing the slide into a visible grid. A small scalloped seal badge carrying a version number, placed over an image edge.',
    imagery: 'Fashion and still-life photography, warm and slightly desaturated, often two frames side by side at different crops. Images bleed off one edge rather than sitting inside a margin.',
    data: 'Figures set very large in the display face with a monospaced caption beneath. Bar charts drawn as tight vertical strokes rather than blocks. Percentage tiles arranged on a visible grid, one tile inverted to olive.',
    sequence: 'Cover with a two-frame image pair and the title reversed out, a three-column principles slide, a metrics grid, a large statement slide, a strategy slide split image and colour, a lookbook slide, a manifesto paragraph with two figures, a closing headline with three arrowed statistics.'
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
 * houses. Colour and type lines drop out when the user has already answered
 * those questions — the layout, furniture and sequence still apply, because
 * those are the part that stops a deck looking generated.
 */
export function pickDeckStyle(brief: DesignBrief | null): { styleId: string; text: string } {
  const seedStr = `${brief?.createdAt ?? 0}|${brief?.kind ?? ''}|${brief?.idea ?? ''}|${brief?.audience ?? ''}`
  const style = DECK_STYLES[hash(seedStr) % DECK_STYLES.length]

  const lines: string[] = ['DECK HOUSE STYLE (commit to this whole, not in part)']
  lines.push(`- House: ${style.label}. ${style.note}`)

  if (pinsColour(brief)) {
    lines.push('- Colour: use the palette already given in this brief, not this house\'s own. Keep the house\'s rule for how colour is applied:')
    lines.push(`  ${style.slideGrounds}`)
  } else {
    lines.push(`- Palette: ${style.palette.map((p) => `${p.hex} (${p.role})`).join(', ')}.`)
    lines.push(`- Grounds: ${style.slideGrounds}`)
  }

  if (!pinsFonts(brief)) lines.push(`- Type: ${style.type}`)
  lines.push(`- Slide furniture: ${style.furniture}`)
  lines.push(`- Imagery: ${style.imagery}`)
  lines.push(`- Numbers and charts: ${style.data}`)
  lines.push(`- Running order: ${style.sequence}`)

  if (brief?.look) lines.push(`- Express all of this within the requested "${brief.look}" look rather than replacing it.`)
  lines.push(
    '- Do not produce the default deck: a centred title over three equal bullet points, a stock photograph behind a translucent panel, or a slide that is only a heading and a paragraph. Every slide must use the furniture above so the deck reads as one document.'
  )

  return { styleId: style.id, text: lines.join('\n') }
}
