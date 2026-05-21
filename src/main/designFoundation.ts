// Concrete anatomy directives for design systems and visual looks.
// The brief picker labels (e.g. "Modern", "Brutalist", "Lightning · Salesforce")
// are too abstract on their own — the model treats them as polite suggestions
// and outputs a generic SaaS template anyway. This module turns each pick into
// a hard, specific block of CSS-level directives the model can't ignore.

export type LookAnatomy = {
  surfaces: string
  type: string
  shape: string
  motion: string
  signature: string // one line that screams "this is THE look, not generic SaaS"
}

const LOOK_ANATOMY: Record<string, LookAnatomy> = {
  minimal: {
    surfaces: 'White or near-white pages. ONE surface elevation: shallow shadow OR 1px hairline border, never both. Generous 64-96px section padding.',
    type: 'Single grotesk family. h1 ~36px, body ~16px. line-height 1.5. Heavy use of weight (400/600) for hierarchy, not size.',
    shape: 'Subtle 4-6px radius. No tinted halos. No icon containers. No outlines on inputs except 1px on focus.',
    motion: 'Almost none. Hover = color shift only. No transforms, no scale.',
    signature: 'Whitespace IS the design. Every element earns its presence; if it can be cut, cut it.',
  },
  bold: {
    surfaces: 'High contrast: dark sections sit next to light. Full-bleed colored hero blocks. Surfaces fight for attention.',
    type: 'Display headlines 56-96px, weight 700-900. Body 16-18px regular. Aggressive size jumps between levels.',
    shape: 'Sharp 0-4px radius. Solid color buttons, no outlines.',
    motion: 'Snappy 120ms transitions. Confident hover (slight lift OR color invert).',
    signature: 'Big type, big color blocks, no shy moves. The hero swings first.',
  },
  modern: {
    surfaces: 'Off-white page (#fafafa-like). White cards with very subtle 1px border (#e5e7eb-like) OR shallow shadow, never both. 32-48px gutter.',
    type: 'Geometric grotesk (DM Sans, Geist, Plus Jakarta, Satoshi). h1 36-48px medium, body 14-15px regular.',
    shape: 'Soft 8-12px radius on cards/buttons. Pills (full radius) for tags only. Crisp 1px borders.',
    motion: '150ms ease-out on hover. Subtle background tint shift, never scale.',
    signature: 'Crisp, geometric, neutral. Reads as "current Vercel/Linear/Geist territory."',
  },
  editorial: {
    surfaces: 'Single-column long-form layouts dominate. Off-white page, body sits centered with generous side margins. Pull-quotes, inline figures, captions in italic.',
    type: 'Serif headlines (Fraunces, Playfair, Source Serif), grotesk body. h1 48-72px, body 18-20px, leading 1.6+. Drop caps allowed on first paragraph.',
    shape: 'Hairline rules (1px) instead of cards. No radius on dividers. Section breaks via whitespace, not boxes.',
    motion: 'No motion. Pages turn, they do not animate.',
    signature: 'Reads like a magazine spread. Type is the layout. Boxes and cards are mostly absent.',
  },
  playful: {
    surfaces: 'Multiple background colors per page. Tinted cards (pastel hues) with deliberate offsets. Asymmetric placement.',
    type: 'Rounded display (DM Serif Display, Recoleta, Quicksand) for headlines. Friendly grotesk body. Wider tracking on small caps.',
    shape: 'Generous 16-24px radius everywhere. Pills for buttons. Squircle avatars. Hand-drawn or rounded icons.',
    motion: 'Bouncy 250ms cubic-bezier(0.34, 1.56, 0.64, 1). Hover = scale 1.02 + tilt.',
    signature: 'Color, curves, and a little bounce. Nothing is straight or grey.',
  },
  friendly: {
    surfaces: 'Warm off-white (#fdfcf9, #faf7f2). Soft beige/peach tinted cards. Round corners.',
    type: 'Humanist sans (Inter alternatives like Manrope, Karla, Public Sans). h1 32-44px, body 16px, leading 1.55.',
    shape: '12-16px radius. Soft shadows (4-12px blur, low opacity).',
    motion: '200ms ease. Hover = subtle lift (translateY -1 to -2px).',
    signature: 'Warmth without being childish. The kind of UI that says "we got you."',
  },
  luxe: {
    surfaces: 'Cream or charcoal pages. Massive whitespace (120-200px section padding). Few elements per screen.',
    type: 'Light-weight serifs (Cormorant, Lora) or thin grotesks (Inter Light, GT Sectra). h1 64-96px weight 300. Generous tracking on caps eyebrows.',
    shape: '0-2px radius. Hairline 1px gold/bronze accents allowed. Buttons are text + underline, not pills.',
    motion: 'Slow 400ms ease. Fade in only.',
    signature: 'Quiet wealth. Acres of negative space, slim type, almost no UI chrome.',
  },
  brutalist: {
    surfaces: 'Stark white or stark black. Heavy 2-4px solid black borders. No shadows. Off-grid placement allowed.',
    type: 'Mono or industrial sans (Space Mono, IBM Plex Mono, Helvetica). h1 weight 900, body weight 400. ALL CAPS allowed on labels (defies the no-caps rule for THIS look only — keep short).',
    shape: 'Sharp 0px radius everywhere. Rectangles only. No pills.',
    motion: 'None or instant. No easing.',
    signature: 'Raw, opinionated, refuses to be polite. Borders are loud, layout is grid-defying.',
  },
  organic: {
    surfaces: 'Earthy palette (terracotta, sage, sand). Asymmetric blob backgrounds (SVG, used SPARINGLY). Page bg has subtle texture or grain.',
    type: 'Soft serif (Fraunces, DM Serif Display) headings + humanist sans body. h1 44-56px.',
    shape: 'Squircles (border-radius: 28% / 72% etc.) on hero shapes. Standard 12-16px radius on cards.',
    motion: 'Slow 300-400ms ease-in-out. Floating subtle bob on hero element.',
    signature: 'Hand-of-craft, not Sketch-template. Imperfect curves, natural palette.',
  },
  technical: {
    surfaces: 'Dark page (#0b0d12, #111317) with neutral surfaces (#161a22). Mono-led labels. Visible grid alignment.',
    type: 'Monospace for labels, numbers, code (JetBrains Mono, IBM Plex Mono). Geometric grotesk for prose. h1 28-36px, body 13-14px.',
    shape: '4-6px radius on cards, 0px on data table cells. 1px crisp borders.',
    motion: 'No bounce. 100ms ease-out on hover. Color shift only.',
    signature: 'Reads as a developer tool: dense, mono, precise, dark by default.',
  },
  monochrome: {
    surfaces: 'Pure white or pure black page. ONE accent color used sparingly (links, primary action only).',
    type: 'Single family, single weight for body. Hierarchy via size and spacing.',
    shape: '0-4px radius. No shadows; rely on borders only.',
    motion: 'Minimal. Color shift on hover.',
    signature: 'Black, white, and one decisive accent. No greys-of-greys.',
  },
  retro: {
    surfaces: 'Warm cream or muted earth-tone pages. Bordered cards with chunky shadows (4-8px solid offset, no blur).',
    type: 'Display serifs (Reckless, Recoleta) or geometric grotesks evoking 70s/80s posters. h1 48-72px.',
    shape: '6-10px radius on cards. Solid offset shadows (no soft blur).',
    motion: 'Snappy 150ms. Hover = shadow + 2px translate.',
    signature: 'Warm palette, chunky shadows, design that nods at vinyl-era graphics.',
  },
  futuristic: {
    surfaces: 'Deep blue/black page with subtle gradient mesh (allowed for THIS look only — keep desaturated). Glassmorphic cards with backdrop-blur.',
    type: 'Geometric or stencil display (Eurostile, Geist Mono). h1 in light/thin weight feels right.',
    shape: '8-16px radius. Subtle inner glow on focused inputs.',
    motion: 'Slow 300ms ease-out. Subtle parallax allowed on hero only.',
    signature: 'Dark, glassy, sci-fi. Glow is restrained — not neon arcade.',
  },
  'hand-drawn': {
    surfaces: 'Off-white paper (#fcfaf6). Slight rotation on cards (-1 to 1 deg). Sketch-style underlines.',
    type: 'Handwritten display (Caveat, Reenie Beanie) for accents only; humanist sans for body.',
    shape: 'Wobbly borders via SVG strokes. 8-16px radius approximations.',
    motion: 'Wobble on hover.',
    signature: 'Looks made-by-hand, not made-by-Figma. Slight imperfection everywhere.',
  },
}

// Concrete anatomy hints for the most common design systems. For systems
// not in this map we fall back to a generic "look up the official docs"
// directive — the model has web access and SHOULD use it.
const DS_ANATOMY: Record<string, string> = {
  'material-3': 'Material 3: dynamic color tokens, M3 elevation tints (no drop shadows for surfaces — use surface tint), 16dp grid, FAB on dashboards, tonal buttons, segmented buttons. Roboto/Roboto Flex. State layers on interactive (8% on hover, 12% on focus).',
  'apple-hig': 'Apple HIG: SF Pro Display + SF Pro Text. Translucent materials, 8/16/24pt grid, large titles on top of scroll content, tab bar bottom on iOS. Sharp 8-13px corner radius. Generous tap targets (44pt min).',
  'fluent-2': 'Fluent 2: Segoe UI Variable. Curved 4px radius. Acrylic/Mica backgrounds with backdrop blur. Reveal highlight on hover. 8-point grid. Brand color for primary, semibold weight for emphasis.',
  carbon: 'IBM Carbon: IBM Plex Sans + IBM Plex Mono. Sharp 0-2px radius. Strict 8-column to 16-column grid (g100 spacing tokens). Functional color (blue 60, gray 100). Buttons are rectangular. Data tables dominate.',
  spectrum: 'Adobe Spectrum: Adobe Clean. Spectrum-defined gray palette + 8 color buckets. 4px grid. Square corners on inputs, 4px on buttons. Light/dark/darkest themes.',
  polaris: 'Shopify Polaris: Inter. Soft surfaces (#fafbfb-like), 8px radius cards, 4-12-16-32px spacing. Compact dense data layouts. Subtle borders, almost no shadows. Polaris green primary.',
  primer: 'GitHub Primer: -apple-system / Segoe UI stack. 6px radius. Border-defined cards (no shadow). Octicons. Subtle color palette, lots of grays. Sticky sidebar nav.',
  atlassian: 'Atlassian: Charlie Sans. Soft 3-6px radius. Light blue (#0052cc) primary. Card-heavy layouts. Iconographic empty states. Trello-influenced color.',
  lightning: 'Salesforce Lightning (SLDS / Astro): Salesforce Sans. Top utility bar + global header (purple #032d60). White cards on #f3f3f3 page bg. Sharp 4px radius. SLDS icons. Dense forms with inline labels.',
  'base-web': 'Uber Base Web: UberMove + UberMove Mono. Strict 4px scale. Hard right angles or pill buttons. High-contrast active states.',
  pajamas: 'GitLab Pajamas: GitLab Sans. Compact, IDE-adjacent. Orange #fc6d26 accent. Crisp tables, file tree sidebars.',
  evergreen: 'Segment Evergreen: Inter. Friendly business-app feel, 4-6px radius, blue/teal accents.',
  garden: 'Zendesk Garden: System sans. Approachable rounded 8px radius. Lots of green. Empty states with illustrations.',
  canvas: 'Workday Canvas: Roobert. Enterprise HR/finance feel: dense forms, blue primary, conservative type scale.',
  forge: 'Twilio Paste: Inter. Crisp 4px radius, vibrant accent palette, accessible color combos.',
  helios: 'HashiCorp Helios: Geist Mono + Inter. Dark default, gradient accent allowed (purple-blue), DevOps tooling vibe.',
  geist: 'Vercel Geist: Geist Sans + Geist Mono. Black and white dominant, single accent. 8px radius, no shadows, hairline borders. Mono for code/numbers.',
  backpack: 'Skyscanner Backpack: Relative Pro. Travel-friendly: rounded 8-12px, blue + green palette, large hero imagery.',
  nord: 'Trivago Nord: System sans. Travel data-dense: cards with prices, blue accent, crisp.',
  orbit: 'Kiwi.com Orbit: Roboto. Travel booking flow: white surfaces, orange #fa6724 primary, 4px radius.',
  lexicon: 'Liferay Lexicon: Source Sans 3. Enterprise portal: blue #2161d6, traditional left-nav layout.',
  photon: 'Mozilla Photon: System sans. Firefox feel: rounded 4-8px, blue primary, clean and informational.',
  gel: 'BBC GEL: BBC Reith Sans + BBC Reith Serif. Editorial, accessible, news-orientated. Black + red accent.',
  uswds: 'USWDS: Public Sans + Source Serif Pro. US gov: blue + red, accessible color contrast, banner with flag at top.',
  'gov-uk': 'GOV.UK: GDS Transport. Plain, accessible: black on yellow header, generous spacing, simple forms with labels above.',
  'ant-design': 'Ant Design: -apple-system stack + AlibabaSans. Dense business UIs: 2-4px radius, blue #1677ff primary, side menu collapsible.',
  arco: 'Arco Design: PingFang/Inter. ByteDance enterprise: 4-8px radius, blue/green accents.',
  shadcn: 'shadcn/ui: Inter (or Geist). Slate gray neutral palette, subtle 6-8px radius, hairline borders. Lucide icons. Composable Radix primitives.',
  'tailwind-ui': 'Tailwind UI: Inter. Indigo or chosen accent. 6-8px radius, soft shadows on cards. Marketing + app patterns.',
  radix: 'Radix UI primitives: unstyled — focus on accessibility patterns. Dropdown/dialog/popover anatomy is the brand.',
  chakra: 'Chakra UI: Inter. Friendly 6-8px radius, generous padding, blue primary. Default dark mode toggle.',
  mantine: 'Mantine: Inter. Slightly tighter spacing than Chakra, 4-6px radius, blue accent, hooks-driven.',
  'park-ui': 'Park UI: Inter. Ark UI primitives + Panda CSS. shadcn-adjacent neutral palette.',
  nextui: 'NextUI: Inter. Vibrant rainbow accent palette, 12-16px radius (rounder than shadcn), shadows on cards.',
  mui: 'MUI Material: Roboto. Material patterns in React: 4px radius, ripple on click, FAB, app bar.',
  bootstrap: 'Bootstrap 5: System sans stack. Classic .btn .card .navbar markup. 6-8px radius, blue primary.',
  bulma: 'Bulma: Inter. Flexbox-based: .columns .column patterns. Vibrant green/red/yellow accent palette.',
  audi: 'Audi UI: AudiType. Premium automotive: black + red accent, sharp 0-2px radius, generous whitespace, large hero imagery.',
  salt: 'JPMorgan Salt: Open Sans. Financial enterprise: dense data, conservative blue/gray palette, sharp corners.',
}

// Build the DESIGN FOUNDATION block. This sits at the TOP of the prompt
// (above STYLE CONTRACT) so the model treats look + system as the loudest
// signal, not as polite background suggestions.
//
// When designSystem is set: that wins — emit its anatomy as the primary
// directive and tell the model to look up the official docs as well.
// When only look is set: emit the look anatomy.
// When both: system overrides, but we still mention the look as a "tone".
export function buildFoundationBlock(opts: {
  designSystem?: string | null
  designSystemLabel?: string | null
  look?: string | null
  lookLabel?: string | null
}): string {
  const lines: string[] = []
  const ds = opts.designSystem ?? null
  const look = opts.look ?? null
  if (!ds && !look) return ''

  lines.push('DESIGN FOUNDATION (read first; this defines the entire visual language and overrides any conflicting baseline default below):')

  if (ds) {
    const dsLabel = opts.designSystemLabel ?? ds
    const anatomy = DS_ANATOMY[ds]
    lines.push('')
    lines.push(`SYSTEM: ${dsLabel}.`)
    if (anatomy) {
      lines.push(`Anatomy: ${anatomy}`)
    } else {
      lines.push(`Look up the official documentation for "${dsLabel}" before writing code (font family, color tokens, component anatomy, spacing scale, corner radius). Use the system's actual values, not generic defaults.`)
    }
    lines.push('Reproduce real component anatomy from this system: do NOT output generic Tailwind cards if the system has its own card/button/input patterns. Use its color tokens as CSS variables.')
    if (look) {
      const lookLabel = opts.lookLabel ?? look
      lines.push(`Tone within the system: ${lookLabel} (apply where the system permits; system wins on conflicts).`)
    }
  } else if (look) {
    const lookLabel = opts.lookLabel ?? look
    const anatomy = LOOK_ANATOMY[look]
    if (anatomy) {
      lines.push('')
      lines.push(`LOOK: ${lookLabel}. This is the brief's strongest visual signal — commit visibly. Failing to differentiate "${lookLabel}" from a generic SaaS dashboard is a failed build.`)
      lines.push(`Surfaces: ${anatomy.surfaces}`)
      lines.push(`Type: ${anatomy.type}`)
      lines.push(`Shape: ${anatomy.shape}`)
      lines.push(`Motion: ${anatomy.motion}`)
      lines.push(`Signature: ${anatomy.signature}`)
    } else {
      lines.push(`LOOK: ${lookLabel}. Commit to this aesthetic visibly; do not output a generic SaaS dashboard.`)
    }
  }

  return lines.join('\n')
}
