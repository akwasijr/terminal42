// Variety engine: stops the generator churning out the same look every time.
//
// For each design we deterministically pick one "art direction" (type / color /
// imagery mood) and one "layout archetype" (composition) from curated catalogs.
// The pick is seeded from the brief, so it is stable for a given design but
// differs across designs, and it avoids the most recently used combinations.
// It NEVER overrides choices the user made explicitly in the brief: if the brief
// pins fonts or a palette, we drop that axis of guidance and only steer the
// unspecified ones (imagery and composition are almost never specified, so they
// carry most of the variety).

import type { DesignBrief } from './design.types'

export type ArtDirection = {
  id: string
  label: string
  /** Typographic mood (used only when the brief does not pin fonts). */
  type: string
  /** Color approach (used only when the brief does not pin a palette). */
  color: string
  /** Imagery strategy (almost always applied). */
  imagery: string
}

export type LayoutArchetype = {
  id: string
  label: string
  /** Hero composition. */
  hero: string
  /** Section rhythm across the page. */
  rhythm: string
  /** Navigation treatment. */
  nav: string
}

export const ART_DIRECTIONS: ArtDirection[] = [
  {
    id: 'editorial-serif',
    label: 'Editorial serif',
    type: 'A high-contrast serif display paired with a clean grotesque body, generous leading, magazine-like hierarchy.',
    color: 'Warm paper neutrals with one deep ink accent. Solid colors only.',
    imagery: 'Full-bleed cinematic photography with confident editorial crops.',
  },
  {
    id: 'warm-minimal',
    label: 'Warm minimal',
    type: 'A calm humanist sans with a single characterful display weight; lots of air around the type.',
    color: 'Warm earthy neutrals (sand, clay, off-white) with one deep accent used sparingly.',
    imagery: 'A few, well-chosen warm photographs surrounded by negative space.',
  },
  {
    id: 'mono-contrast',
    label: 'Monochrome contrast',
    type: 'A bold grotesque display in near-black on off-white, tight tracking, strong size jumps.',
    color: 'Near-monochrome (off-white, soft black) with one sharp accent. Gallery-like.',
    imagery: 'High-contrast black-and-white or duotone-treated images.',
  },
  {
    id: 'soft-organic',
    label: 'Soft organic',
    type: 'A rounded, friendly sans with a soft display face; relaxed spacing.',
    color: 'Soft muted neutrals leaning gently warm, one quiet accent. No neon.',
    imagery: 'Soft natural-light photography with rounded image corners.',
  },
  {
    id: 'classic-refined',
    label: 'Classic refined',
    type: 'A timeless serif for headings with a quiet sans for body; hairline rules and small caps used with restraint.',
    color: 'Refined neutral base (ivory, graphite) with a single understated accent.',
    imagery: 'Framed editorial photographs with refined captions.',
  },
  {
    id: 'bold-grotesque',
    label: 'Bold grotesque',
    type: 'An oversized grotesque/sans display set very large with tight tracking; punchy scale contrast.',
    color: 'A confident neutral base with one strong, considered brand color.',
    imagery: 'Type-led: imagery is secondary, used full-bleed and sparingly.',
  },
  {
    id: 'archival-texture',
    label: 'Archival',
    type: 'A precise grotesque with a monospaced caption face; document-like hierarchy.',
    color: 'Muted, slightly desaturated neutrals with fine rules and captions.',
    imagery: 'Documentary, slightly grainy / archival imagery, always captioned.',
  },
  {
    id: 'modern-utility',
    label: 'Modern utility',
    type: 'A precise neo-grotesque pairing; tight, functional, confident hierarchy.',
    color: 'A clean neutral base with one saturated brand color used as a clear signal.',
    imagery: 'Clean subject / product photography on neutral backdrops.',
  },
]

export const LAYOUT_ARCHETYPES: LayoutArchetype[] = [
  {
    id: 'centered-stage',
    label: 'Centered stage',
    hero: 'A centered hero: a large headline, a short line of intent, one primary action, plenty of air.',
    rhythm: 'A calm single-column rhythm with generous whitespace between sections.',
    nav: 'A minimal top nav: wordmark left, a few links, one quiet action.',
  },
  {
    id: 'split-asymmetric',
    label: 'Split asymmetric',
    hero: 'A split hero: text on one side, a strong image on the other, deliberately asymmetric.',
    rhythm: 'Alternating two-column sections (image / text) that swap sides down the page.',
    nav: 'A wide top nav with the wordmark offset and a clear primary action.',
  },
  {
    id: 'fullbleed-immersive',
    label: 'Full-bleed immersive',
    hero: 'A full-bleed image or video hero with the headline overlaid; immersive and cinematic.',
    rhythm: 'Alternating full-bleed bands and contained text sections for breathing room.',
    nav: 'A transparent nav that sits over the hero and gains a solid background on scroll.',
  },
  {
    id: 'type-first',
    label: 'Type first',
    hero: 'An oversized typographic hero: the headline IS the hero, imagery minimal or absent.',
    rhythm: 'Strong typographic sections with rules and generous margins; imagery used rarely.',
    nav: 'A spare nav: just a wordmark and one link or action.',
  },
  {
    id: 'editorial-offset',
    label: 'Editorial offset',
    hero: 'An offset, indented hero with a side caption, like a magazine opener.',
    rhythm: 'A magazine grid: indented columns, side captions, pull quotes.',
    nav: 'A wordmark-centered nav with links split to either side.',
  },
  {
    id: 'grid-systematic',
    label: 'Systematic grid',
    hero: 'A hero built on a visible grid: headline, supporting column, and a precise image block.',
    rhythm: 'A modular grid where whitespace (not borders) separates the modules.',
    nav: 'A structured nav aligned to the grid, links evenly set.',
  },
  {
    id: 'sidebar-anchored',
    label: 'Sidebar anchored',
    hero: 'A fixed side label or vertical wordmark with the hero content scrolling beside it.',
    rhythm: 'Content scrolls past a sticky side anchor; sections are tall and deliberate.',
    nav: 'A vertical side nav or a sticky side label instead of a top bar.',
  },
  {
    id: 'horizontal-accent',
    label: 'Horizontal accent',
    hero: 'A vertical hero with one deliberate horizontal-scroll or marquee accent below it.',
    rhythm: 'Mostly vertical, with a single horizontal-scroll gallery or marquee as a signature moment.',
    nav: 'A minimal top nav; the horizontal moment is the memorable detail.',
  },
]

export type VarietyDirective = {
  directionId: string
  archetypeId: string
  text: string
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function briefPinsFonts(b: DesignBrief | null): boolean {
  return !!(b && (b.fontHeading || b.fontBody || b.fontPrimary || b.fontPairId || b.customFonts))
}

function briefPinsColor(b: DesignBrief | null): boolean {
  return !!(b && (b.paletteId || b.primaryColor || (b.paletteColors && b.paletteColors.length)))
}

// Remember the last few picks so successive designs do not repeat a look.
const recentDirections: string[] = []
const recentArchetypes: string[] = []
const RECENT = 3

function pickAvoiding<T extends { id: string }>(items: T[], seed: number, recent: string[]): T {
  const n = items.length
  for (let i = 0; i < n; i++) {
    const cand = items[(seed + i) % n]
    if (!recent.includes(cand.id)) return cand
  }
  return items[seed % n]
}

function remember(list: string[], id: string): void {
  list.push(id)
  while (list.length > RECENT) list.shift()
}

/**
 * Pick a distinct art direction + layout archetype for this design and render a
 * prompt directive. Purely deterministic from the brief seed, so the SAME design
 * keeps its look across every iteration turn while DIFFERENT designs vary (the
 * brief's createdAt makes each seed unique). Explicit brief choices (fonts,
 * palette) are respected.
 */
export function pickVariety(brief: DesignBrief | null): VarietyDirective {
  const seedStr = `${brief?.createdAt ?? 0}|${brief?.kind ?? ''}|${brief?.idea ?? ''}|${brief?.audience ?? ''}`
  const seed = hash(seedStr)

  const direction = ART_DIRECTIONS[seed % ART_DIRECTIONS.length]
  const archetype = LAYOUT_ARCHETYPES[(seed >>> 5) % LAYOUT_ARCHETYPES.length]

  const lines: string[] = ['ART DIRECTION (commit to this so the design is distinct, not a default)']
  lines.push(`- Direction: ${direction.label}.`)
  if (!briefPinsFonts(brief)) lines.push(`- Type: ${direction.type}`)
  if (!briefPinsColor(brief)) lines.push(`- Color: ${direction.color}`)
  lines.push(`- Imagery: ${direction.imagery}`)
  lines.push(`- Composition: ${archetype.label}. ${archetype.hero}`)
  lines.push(`- Rhythm: ${archetype.rhythm}`)
  lines.push(`- Navigation: ${archetype.nav}`)
  if (brief?.look) lines.push(`- Express all of the above within the user's requested "${brief.look}" look.`)
  lines.push('- Avoid your default move (a centered hero over three equal feature cards with evenly spaced sections). Lean fully into the direction above.')

  return { directionId: direction.id, archetypeId: archetype.id, text: lines.join('\n') }
}
