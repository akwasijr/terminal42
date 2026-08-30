/**
 * The website templates.
 *
 * Website used to share App's gallery, which meant the starting points on
 * offer were nineteen industry dashboards and a Teams shell. None of those is
 * a website. A website answers to different questions — what does a stranger
 * see first, how do they get to the thing they came for — and its templates
 * have to be shaped by that rather than by an industry vertical.
 *
 * The lesson from the decks applies here too: a template is not a colour
 * scheme. Nine palettes over one layout is one template shown nine times. So
 * what varies first is the composition — where the navigation lives, whether
 * there is a hero at all, whether the page is a column or a grid — and the
 * palette comes second.
 */

/** The shape of the page, which is the part you recognise before you read. */
export type SiteArchetype =
  /** Heading left, a product panel right, features in a row beneath. */
  | 'split'
  /** A masthead rule, one large headline, then columns of running text. */
  | 'editorial'
  /** Almost no header; the work itself fills the page from the first pixel. */
  | 'grid'
  /** A fixed nav rail on the left, a reading column, page contents on the right. */
  | 'docs'
  /** Category strip, a dense product grid, prices under each. */
  | 'storefront'
  /** One centred column, sections alternating ground, pricing and questions low. */
  | 'longform'
  /** Full-bleed cover, oversized type, a marquee of names. */
  | 'studio'
  /** A photograph, then the practical facts: hours, address, a way to book. */
  | 'venue'

/** How the largest type on the page is set. */
export type SiteHeading = {
  /** 100..900. */
  weight: number
  case: 'none' | 'uppercase'
  /** CSS letter-spacing. */
  track: string
  /** Multiplier on the base display size. */
  scale: number
}

export type WebsiteTemplate = {
  id: string
  /** What it is called in the gallery. */
  name: string
  /** One line. The gallery shows the page; it does not need a paragraph. */
  note: string
  /** What sort of site this is for, in the user's words rather than ours. */
  suits: string
  tone: 'light' | 'dark'
  archetype: SiteArchetype
  heading: SiteHeading
  /** CSS custom properties written into the page's own <style>. */
  tokens: Record<string, string>
  /** Google Fonts stylesheet for the faces above, or null for system faces. */
  fontsHref: string | null
  /**
   * The structural habits, in the order they appear down the page. These feed
   * the generator and draw the gallery preview, so a preview cannot drift
   * from what the template actually builds.
   */
  moves: string[]
}

export const WEBSITE_TEMPLATES: WebsiteTemplate[] = [
  {
    id: 'split-product',
    name: 'Split product',
    note: 'Claim on the left, the thing itself on the right.',
    suits: 'Software, hardware, anything with a screen or an object to show',
    tone: 'light',
    archetype: 'split',
    heading: { weight: 600, case: 'none', track: '-0.02em', scale: 1 },
    tokens: {
      '--site-bg': '#ffffff',
      '--site-ink': '#16181d',
      '--site-ink-2': '#5b6472',
      '--site-line': '#e4e7ec',
      '--site-accent': '#2f5bea',
      '--site-panel': '#f4f6fa',
      '--site-font': "'Plus Jakarta Sans', system-ui, sans-serif",
      '--site-mono': "'IBM Plex Mono', ui-monospace, monospace"
    },
    fontsHref:
      'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400&display=swap',
    moves: [
      'A slim header: wordmark left, four links centre, one solid action right.',
      'Hero split down the middle — heading, one paragraph and two buttons on the left; a framed panel showing the product on the right.',
      'A row of logos under the hero, set small and in one flat grey, no card and no border.',
      'Three feature columns, each an icon, a short heading and two lines.',
      'A closing band on the accent with a single action, then a four-column footer.'
    ]
  },
  {
    id: 'editorial-review',
    name: 'Editorial',
    note: 'A masthead, one headline, and columns of text.',
    suits: 'Publications, newsletters, essays, anything read rather than scanned',
    tone: 'light',
    archetype: 'editorial',
    heading: { weight: 400, case: 'none', track: '-0.01em', scale: 1.25 },
    tokens: {
      '--site-bg': '#fbfaf7',
      '--site-ink': '#14130f',
      '--site-ink-2': '#6a675e',
      '--site-line': '#ddd9cf',
      '--site-accent': '#9a2f18',
      '--site-panel': '#f2efe8',
      '--site-font': "'Fraunces', Georgia, serif",
      '--site-mono': "'IBM Plex Mono', ui-monospace, monospace"
    },
    fontsHref:
      'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=IBM+Plex+Mono:wght@400&display=swap',
    moves: [
      'A masthead: the title centred in large serif, a hairline rule under it, the date and issue number in monospace at the edges.',
      'One lead story — headline across the full measure, a standfirst in italic, then body text in two or three columns.',
      'A rule, then further stories in a three-column grid, each with a kicker, a headline and a byline.',
      'No cards, no shadows and no rounded corners anywhere: separation is by rule and whitespace only.',
      'A footer of section links set in small capitals.'
    ]
  },
  {
    id: 'work-grid',
    name: 'Work first',
    note: 'No hero. The work starts at the top of the page.',
    suits: 'Portfolios, photographers, illustrators, design studios',
    tone: 'light',
    archetype: 'grid',
    heading: { weight: 500, case: 'none', track: '-0.03em', scale: 0.85 },
    tokens: {
      '--site-bg': '#ffffff',
      '--site-ink': '#0d0d0d',
      '--site-ink-2': '#7a7a7a',
      '--site-line': '#ececec',
      '--site-accent': '#0d0d0d',
      '--site-panel': '#f5f5f5',
      '--site-font': "'DM Sans', system-ui, sans-serif",
      '--site-mono': "'DM Mono', ui-monospace, monospace"
    },
    fontsHref:
      'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400&display=swap',
    moves: [
      'A one-line header: a name on the left, three links on the right, nothing else. It does not stick.',
      'The work begins immediately — a two-column grid of pieces, each a large image with the title and year beneath in small type.',
      'Tiles vary in height so the grid reads as a column of work rather than a table of cards.',
      'A short paragraph about the person, set narrow and low on the page, after the work rather than before it.',
      'A footer that is an email address and nothing else.'
    ]
  },
  {
    id: 'docs-rail',
    name: 'Documentation',
    note: 'A nav rail, a reading column, contents on the right.',
    suits: 'Product documentation, API references, handbooks, wikis',
    tone: 'light',
    archetype: 'docs',
    heading: { weight: 600, case: 'none', track: '-0.01em', scale: 0.75 },
    tokens: {
      '--site-bg': '#ffffff',
      '--site-ink': '#1b1f24',
      '--site-ink-2': '#656d76',
      '--site-line': '#e6e8eb',
      '--site-accent': '#0969da',
      '--site-panel': '#f6f8fa',
      '--site-font': "'Geist', system-ui, sans-serif",
      '--site-mono': "'Geist Mono', ui-monospace, monospace"
    },
    fontsHref:
      'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400&display=swap',
    moves: [
      'A top bar with the product name, a search field and a version selector.',
      'Three columns: a scrolling section rail on the left, the article in the middle at a 70-character measure, an on-this-page list on the right.',
      'The current page is marked in the rail with a solid left edge in the accent, not a filled pill.',
      'Code samples in a tinted panel with a language label and a copy action; a callout style for notes and warnings that uses a coloured left edge, not a border all round.',
      'Previous and next links at the foot of the article.'
    ]
  },
  {
    id: 'storefront',
    name: 'Storefront',
    note: 'Categories, a dense product grid, prices in plain sight.',
    suits: 'Shops, catalogues, marketplaces',
    tone: 'light',
    archetype: 'storefront',
    heading: { weight: 500, case: 'none', track: '-0.02em', scale: 0.8 },
    tokens: {
      '--site-bg': '#ffffff',
      '--site-ink': '#191919',
      '--site-ink-2': '#767676',
      '--site-line': '#e8e8e8',
      '--site-accent': '#1f6f4a',
      '--site-panel': '#f7f7f5',
      '--site-font': "'DM Sans', system-ui, sans-serif",
      '--site-mono': 'ui-monospace, monospace'
    },
    fontsHref: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap',
    moves: [
      'A header with the shop name, a category row, and search, account and basket at the right.',
      'One wide banner — a photograph with a short line of type over it and a single action. Not full height.',
      'A four-column product grid: image, name, price. The price is plain text at full contrast, never a badge.',
      'Filters in a left rail on wide screens, collapsing to a button above the grid on narrow ones.',
      'A trust row near the foot — delivery, returns, payment — as three lines of text with small icons.'
    ]
  },
  {
    id: 'longform-landing',
    name: 'Long-form landing',
    note: 'One column, section after section, pricing near the end.',
    suits: 'A single product or campaign that has to explain itself',
    tone: 'light',
    archetype: 'longform',
    heading: { weight: 700, case: 'none', track: '-0.03em', scale: 1.1 },
    tokens: {
      '--site-bg': '#ffffff',
      '--site-ink': '#111827',
      '--site-ink-2': '#6b7280',
      '--site-line': '#e5e7eb',
      '--site-accent': '#c2410c',
      '--site-panel': '#faf7f5',
      '--site-font': "'Plus Jakarta Sans', system-ui, sans-serif",
      '--site-mono': 'ui-monospace, monospace'
    },
    fontsHref:
      'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap',
    moves: [
      'A centred hero: one specific claim, one sentence under it, one action. Sized to its content, not to the viewport.',
      'Sections alternate between the page ground and the tinted panel so the eye can count them without rules.',
      'Each section is a heading, a short body and one piece of evidence — a figure, a list or a screenshot.',
      'A pricing table of three plans, the middle one marked by a heavier border rather than a coloured banner.',
      'Questions and answers as an accordion list, then a final action, then a small footer.'
    ]
  },
  {
    id: 'studio-cover',
    name: 'Studio',
    note: 'Full-bleed cover, type at the size of the page.',
    suits: 'Agencies, studios, anyone selling taste',
    tone: 'dark',
    archetype: 'studio',
    heading: { weight: 500, case: 'none', track: '-0.045em', scale: 1.6 },
    tokens: {
      '--site-bg': '#0c0c0d',
      '--site-ink': '#f4f2ef',
      '--site-ink-2': '#8d8a85',
      '--site-line': '#26262a',
      '--site-accent': '#d8ff3e',
      '--site-panel': '#151517',
      '--site-font': "'Archivo', system-ui, sans-serif",
      '--site-mono': "'Archivo', ui-monospace, monospace"
    },
    fontsHref: 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&display=swap',
    moves: [
      'A cover filling the first screen: one statement set very large and tight, the navigation reduced to two words in a corner.',
      'A horizontal marquee of client names moving slowly, in one weight, no logos.',
      'Selected work as full-width rows — a large image, the client and the discipline in small type at the edges.',
      'A capabilities list as plain lines with a hairline between them, no icons and no cards.',
      'The accent appears perhaps three times on the whole page. It is a punctuation mark, not a theme.'
    ]
  },
  {
    id: 'venue-booking',
    name: 'Venue',
    note: 'A photograph, then hours, address and a way to book.',
    suits: 'Restaurants, bars, clinics, salons, anywhere with a door',
    tone: 'light',
    archetype: 'venue',
    heading: { weight: 400, case: 'none', track: '-0.01em', scale: 1.15 },
    tokens: {
      '--site-bg': '#fdfcfa',
      '--site-ink': '#221c16',
      '--site-ink-2': '#6f6357',
      '--site-line': '#e2dbd1',
      '--site-accent': '#7c4a2d',
      '--site-panel': '#f3ede4',
      '--site-font': "'Fraunces', Georgia, serif",
      '--site-mono': "'DM Mono', ui-monospace, monospace"
    },
    fontsHref:
      'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=DM+Mono:wght@400&display=swap',
    moves: [
      'A photograph across the top with the name over it and a booking action that stays reachable as you scroll.',
      'Directly beneath: the practical facts in three columns — opening hours as a day-by-day list, the address, the phone number. This comes before any story.',
      'The menu or service list as named sections with a price at the right of each line, a hairline between name and price.',
      'A short paragraph about the place, set narrow, with one further photograph.',
      'A map panel and the address repeated at the foot, because that is what people scroll to the bottom for.'
    ]
  }
]

export function websiteTemplateById(id: string | null | undefined): WebsiteTemplate | null {
  if (!id) return null
  return WEBSITE_TEMPLATES.find((t) => t.id === id) ?? null
}
