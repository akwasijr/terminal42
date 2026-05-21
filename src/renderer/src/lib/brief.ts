import type { ProjectBrief } from '../../../preload/index'

export type ProjectTypeId =
  | 'web-app'
  | 'marketing-site' | 'content-site' | 'productivity'
  | 'slide-deck' | 'social-post' | 'poster' | 'brochure' | 'one-pager' | 'resume'
  | 'api' | 'library' | 'data' | 'cli'
  | 'other' | 'blank'

export type Branch = 'visual' | 'backend' | 'lib' | 'none'

export const PROJECT_TYPES: {
  id: ProjectTypeId
  label: string
  blurb: string
  branch: Branch
  group?: 'engineering'   // hidden behind a "More" expander when set
}[] = [
  { id: 'web-app',         label: 'App',                blurb: 'Accounts, data, state',     branch: 'visual' },
  { id: 'marketing-site',  label: 'Marketing site',     blurb: 'Landing or product site',   branch: 'visual' },
  { id: 'content-site',    label: 'Content site',       blurb: 'Blog, docs, portfolio',     branch: 'visual' },
  { id: 'productivity',    label: 'Productivity tool',  blurb: 'Dashboard or internal tool', branch: 'visual' },
  { id: 'slide-deck',      label: 'Slide deck',         blurb: 'Presentation',              branch: 'visual' },
  { id: 'social-post',     label: 'Social post',        blurb: 'Instagram, LinkedIn, X',    branch: 'visual' },
  { id: 'poster',          label: 'Poster',             blurb: 'Print or digital',          branch: 'visual' },
  { id: 'brochure',        label: 'Brochure',           blurb: 'Print fold-out',            branch: 'visual' },
  { id: 'one-pager',       label: 'One-pager PDF',      blurb: 'Pitch or sales sheet',      branch: 'visual' },
  { id: 'resume',          label: 'Resume',             blurb: 'CV',                        branch: 'visual' },
  { id: 'other',           label: 'Other',              blurb: 'Tell us what it is',        branch: 'lib' },
  { id: 'blank',           label: 'Blank',              blurb: 'Skip the brief',            branch: 'none' },
  // Engineering: collapsed under a "More" expander.
  { id: 'api',             label: 'API',                blurb: 'Service or webhook',        branch: 'backend', group: 'engineering' },
  { id: 'library',         label: 'Library',            blurb: 'Reusable package',          branch: 'lib',     group: 'engineering' },
  { id: 'data',            label: 'Data',               blurb: 'Analysis, ML, ETL',         branch: 'lib',     group: 'engineering' },
  { id: 'cli',             label: 'CLI',                blurb: 'Command-line tool',         branch: 'lib',     group: 'engineering' }
]

// Surfaces / form factors. Independent of project type: a "web app" can target
// mobile, desktop, or both. A "marketing site" usually targets all three.
export const SURFACE_OPTIONS: { id: string; label: string; hint: string }[] = [
  { id: 'mobile',  label: 'Mobile',  hint: 'Phones, ~320 to 480px wide, touch first' },
  { id: 'tablet',  label: 'Tablet',  hint: '~600 to 1024px, mixed touch and pointer' },
  { id: 'desktop', label: 'Desktop', hint: 'Laptops and large screens, pointer and keyboard' },
  { id: 'tv',      label: 'TV / large display', hint: 'Big-screen ambient or kiosk display' }
]

// Sub-types per project type. Helps Copilot understand the actual kind of app.
export const SUB_TYPES_BY_TYPE: Record<string, string[]> = {
  'web-app': [
    'SaaS dashboard', 'Admin panel', 'E-commerce', 'Social network',
    'Marketplace', 'Booking / scheduling', 'Chat / messaging', 'Forum / community',
    'Education / LMS', 'Health / fitness', 'Finance / fintech', 'AI assistant',
    'Internal tool', 'Other'
  ],
  'marketing-site': [
    'Product launch', 'Startup landing', 'Personal brand',
    'Event', 'Campaign / micro-site', 'App download page', 'Other'
  ],
  'content-site': [
    'Personal blog', 'Tech blog', 'Documentation', 'Portfolio',
    'News / magazine', 'Newsletter archive', 'Wiki', 'Other'
  ],
  'productivity': [
    'Dashboard', 'Internal admin', 'Reporting', 'CRM',
    'Project tracker', 'Note taking', 'Other'
  ],
  'slide-deck': [
    'Pitch deck (investor)', 'Sales deck', 'Conference talk', 'Internal all-hands',
    'Product launch keynote', 'Workshop / training', 'Lightning talk', 'Other'
  ],
  'social-post': [
    'LinkedIn single image', 'LinkedIn carousel', 'Instagram square', 'Instagram story / reel cover',
    'X / Twitter card', 'Threads card', 'Quote card', 'Announcement', 'Other'
  ],
  'poster': [
    'Event poster', 'Conference / talk poster', 'Promo poster', 'Typographic poster',
    'Movie / gig poster', 'Educational / informational', 'Other'
  ],
  'brochure': [
    'Bi-fold (4 panels)', 'Tri-fold (6 panels)', 'Z-fold (6 panels)',
    'Booklet (saddle-stitched)', 'Single-sheet menu', 'Other'
  ],
  'one-pager': [
    'Investor one-pager', 'Sales one-pager', 'Product spec sheet',
    'Executive summary', 'Tear-sheet', 'Press release', 'Other'
  ],
  'resume': [
    'Single-column classic', 'Two-column with sidebar', 'Designer / creative',
    'Academic CV', 'Engineering / technical', 'Other'
  ],
  'api': [
    'REST API', 'GraphQL API', 'Webhook receiver', 'Background worker',
    'Auth service', 'Payments', 'Other'
  ]
}

export const AUDIENCE_OPTIONS = [
  'Just me', 'Friends and family', 'Consumers',
  'SMB', 'Enterprise', 'Internal team', 'Open source community'
]

export const LOOK_OPTIONS = [
  { id: 'minimal',   label: 'Clean and minimal', hint: 'Lots of whitespace, neutral, restraint' },
  { id: 'playful',   label: 'Playful',            hint: 'Rounded, color rich, friendly' },
  { id: 'editorial', label: 'Editorial',          hint: 'Magazine like, type driven' },
  { id: 'data',      label: 'Data dense',         hint: 'Tables, charts, compact' },
  { id: 'luxury',    label: 'Luxury',             hint: 'Generous spacing, fine type, premium' },
  { id: 'brutalist', label: 'Brutalist',          hint: 'Stark, raw, opinionated' },
  { id: 'friendly',  label: 'Friendly',           hint: 'Warm, approachable, accessible' }
]

export const BRAND_SWATCHES = [
  '#5B47FB', '#0EA5E9', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#8B5CF6', '#06B6D4',
  '#84CC16', '#F97316', '#111827', '#FFFFFF'
]

export type FontGroup = 'Sans' | 'Display / Editorial' | 'Serif' | 'Mono' | 'System'
export const FONT_OPTIONS: { id: string; stack: string; group: FontGroup }[] = [
  // Sans (modern UI)
  { id: 'Geist',              stack: '"Geist", system-ui, sans-serif',              group: 'Sans' },
  { id: 'Inter',              stack: '"Inter", system-ui, sans-serif',              group: 'Sans' },
  { id: 'DM Sans',            stack: '"DM Sans", system-ui, sans-serif',            group: 'Sans' },
  { id: 'Plus Jakarta Sans',  stack: '"Plus Jakarta Sans", system-ui, sans-serif',  group: 'Sans' },
  { id: 'Satoshi',            stack: '"Satoshi", system-ui, sans-serif',            group: 'Sans' },
  { id: 'IBM Plex Sans',      stack: '"IBM Plex Sans", system-ui, sans-serif',      group: 'Sans' },
  { id: 'Space Grotesk',      stack: '"Space Grotesk", system-ui, sans-serif',      group: 'Sans' },
  { id: 'Manrope',            stack: '"Manrope", system-ui, sans-serif',            group: 'Sans' },
  { id: 'General Sans',       stack: '"General Sans", system-ui, sans-serif',       group: 'Sans' },
  { id: 'Söhne',              stack: '"Söhne", system-ui, sans-serif',              group: 'Sans' },
  { id: 'Aeonik',             stack: '"Aeonik", system-ui, sans-serif',             group: 'Sans' },
  { id: 'Suisse Int\'l',      stack: '"Suisse Int\'l", system-ui, sans-serif',      group: 'Sans' },
  // Display / Editorial
  { id: 'Fraunces',           stack: '"Fraunces", Georgia, serif',                  group: 'Display / Editorial' },
  { id: 'Playfair Display',   stack: '"Playfair Display", Georgia, serif',          group: 'Display / Editorial' },
  { id: 'GT Sectra',          stack: '"GT Sectra", Georgia, serif',                 group: 'Display / Editorial' },
  { id: 'Tiempos Headline',   stack: '"Tiempos Headline", Georgia, serif',          group: 'Display / Editorial' },
  { id: 'Migra',              stack: '"Migra", Georgia, serif',                     group: 'Display / Editorial' },
  { id: 'Editorial New',      stack: '"Editorial New", Georgia, serif',             group: 'Display / Editorial' },
  // Serif (body / reading)
  { id: 'EB Garamond',        stack: '"EB Garamond", Georgia, serif',               group: 'Serif' },
  { id: 'Source Serif Pro',   stack: '"Source Serif Pro", Georgia, serif',          group: 'Serif' },
  { id: 'Lora',               stack: '"Lora", Georgia, serif',                      group: 'Serif' },
  { id: 'Newsreader',         stack: '"Newsreader", Georgia, serif',                group: 'Serif' },
  // Mono
  { id: 'JetBrains Mono',     stack: '"JetBrains Mono", ui-monospace, monospace',   group: 'Mono' },
  { id: 'Geist Mono',         stack: '"Geist Mono", ui-monospace, monospace',       group: 'Mono' },
  { id: 'IBM Plex Mono',      stack: '"IBM Plex Mono", ui-monospace, monospace',    group: 'Mono' },
  { id: 'Berkeley Mono',      stack: '"Berkeley Mono", ui-monospace, monospace',    group: 'Mono' },
  // System
  { id: 'System default',     stack: 'system-ui, -apple-system, sans-serif',        group: 'System' }
]

export const ICON_LIBRARY_OPTIONS: { id: string; label: string; hint: string }[] = [
  { id: 'Lucide',          label: 'Lucide',           hint: 'Friendly default. Huge set, line style, MIT.' },
  { id: 'Phosphor',        label: 'Phosphor',         hint: 'Six weights including duotone. Versatile.' },
  { id: 'Heroicons',       label: 'Heroicons',        hint: 'Tailwind house set. Solid + outline.' },
  { id: 'Tabler',          label: 'Tabler',           hint: 'Crisp 24px line set, dense library.' },
  { id: 'Radix Icons',     label: 'Radix Icons',      hint: 'Compact 15×15 UI icons. Quiet and neutral.' },
  { id: 'Material Symbols',label: 'Material Symbols', hint: 'Variable axis. Google product feel.' },
  { id: 'Iconoir',         label: 'Iconoir',          hint: 'Hand-tuned, slightly editorial line set.' },
  { id: 'Feather',         label: 'Feather',          hint: 'Original minimal line set. Small and crisp.' },
  { id: 'None / custom',   label: 'None or custom',   hint: 'I\'ll bring my own SVGs.' }
]

export const IMAGE_SOURCE_OPTIONS: { id: string; label: string; hint: string }[] = [
  { id: 'upload',   label: 'Upload my own',         hint: 'I\'ll provide real photos / screenshots / brand imagery.' },
  { id: 'unsplash', label: 'Unsplash library',      hint: 'Pull free editorial photos via Unsplash. Filter for cohesion.' },
  { id: 'pexels',   label: 'Pexels library',        hint: 'Pull free stock via Pexels.' },
  { id: 'mix',      label: 'Mix (uploads + stock)', hint: 'Brand assets I provide, stock for fillers.' },
  { id: 'none',     label: 'No images',             hint: 'Type, colour, and layout only.' },
  { id: 'later',    label: 'Decide later',          hint: 'Use clearly-marked image placeholders for now.' }
]

export const MOTION_OPTIONS: { id: string; label: string; hint: string }[] = [
  { id: 'framer-motion',    label: 'Framer Motion',         hint: 'React component animations, gestures, layout transitions.' },
  { id: 'gsap',             label: 'GSAP',                  hint: 'Industrial-strength timeline animations, ScrollTrigger.' },
  { id: 'lenis',            label: 'Lenis (smooth scroll)', hint: 'Inertial smooth-scroll. Pairs with GSAP ScrollTrigger.' },
  { id: 'anime',            label: 'Anime.js',              hint: 'Lightweight tweening for SVG, DOM, JS objects.' },
  { id: 'motion-one',       label: 'Motion One',            hint: 'Tiny Web Animations API wrapper. Native feel.' },
  { id: 'view-transitions', label: 'View Transitions API',  hint: 'Native cross-doc + SPA transitions. No deps.' },
  { id: 'css-only',         label: 'CSS only',              hint: 'Transitions, keyframes, scroll-driven animations. No JS lib.' },
  { id: 'none',             label: 'No animation',          hint: 'Static. Don\'t add motion unless I ask.' }
]

export const THEME_OPTIONS = [
  { id: 'light' as const, label: 'Light' },
  { id: 'dark' as const,  label: 'Dark' },
  { id: 'auto' as const,  label: 'Auto (system)' },
  { id: 'both' as const,  label: 'Both with toggle' }
]

export const RADIUS_STEPS: { id: NonNullable<ProjectBrief['radius']>; label: string; px: number }[] = [
  { id: 'square',  label: 'Square',  px: 0  },
  { id: 'subtle',  label: 'Subtle',  px: 4  },
  { id: 'medium',  label: 'Medium',  px: 10 },
  { id: 'rounded', label: 'Rounded', px: 18 },
  { id: 'pill',    label: 'Pill',    px: 999 }
]

export const SHADOW_STEPS: { id: NonNullable<ProjectBrief['shadow']>; label: string; css: string }[] = [
  { id: 'none',   label: 'None',   css: 'none' },
  { id: 'subtle', label: 'Subtle', css: '0 1px 2px rgba(0,0,0,.08), 0 1px 3px rgba(0,0,0,.06)' },
  { id: 'medium', label: 'Medium', css: '0 4px 6px rgba(0,0,0,.07), 0 8px 16px rgba(0,0,0,.08)' },
  { id: 'strong', label: 'Strong', css: '0 10px 15px rgba(0,0,0,.10), 0 20px 35px rgba(0,0,0,.12)' }
]

export const OUTLINE_STEPS: { id: NonNullable<ProjectBrief['outline']>; label: string; px: number }[] = [
  { id: 'none',   label: 'None',   px: 0 },
  { id: 'subtle', label: 'Subtle', px: 1 },
  { id: 'strong', label: 'Strong', px: 2 }
]

export const STACK_BY_TYPE: Record<string, string[]> = {
  'web-app':        ['React + Vite', 'Next.js', 'SvelteKit', 'Remix', 'Astro', 'React Native', 'Flutter', 'SwiftUI', 'Electron', 'Tauri', 'Let copilot pick'],
  'marketing-site': ['Astro', 'Next.js', '11ty', 'Plain HTML', 'Webflow export', 'Let copilot pick'],
  'content-site':   ['Astro', 'Hugo', 'Jekyll', 'Next.js', 'Plain HTML', 'Let copilot pick'],
  'productivity':   ['React + Vite', 'Next.js', 'SwiftUI', 'Electron', 'Tauri', 'Let copilot pick'],
  'slide-deck':     ['Reveal.js (web)', 'Slidev (Markdown)', 'Spectacle (React)', 'Plain HTML', 'Keynote (export)', 'PowerPoint (export)', 'Let copilot pick'],
  'social-post':    ['HTML + canvas (export PNG)', 'React + html-to-image', 'SVG hand-authored', 'Figma export workflow', 'Let copilot pick'],
  'poster':         ['HTML + print CSS', 'SVG hand-authored', 'TypeScript + paper.js', 'Plain HTML', 'Let copilot pick'],
  'brochure':       ['HTML + print CSS', 'Pandoc + LaTeX', 'Paged.js (web → print)', 'Plain HTML', 'Let copilot pick'],
  'one-pager':      ['HTML + print CSS', 'Paged.js (web → print)', 'React PDF (@react-pdf/renderer)', 'LaTeX', 'Let copilot pick'],
  'resume':         ['HTML + print CSS', 'Paged.js (web → print)', 'React PDF (@react-pdf/renderer)', 'LaTeX (moderncv / awesome-cv)', 'Markdown + Pandoc', 'Let copilot pick']
}

// Design systems for apps. When the user picks one, button shapes, shadows,
// radii, spacing, typography and component anatomy all come from the system :
// Copilot must NOT invent its own scale.
export const DESIGN_SYSTEM_OPTIONS: { id: string; label: string; hint: string; category: string; mono: string }[] = [
  { id: 'none',       label: 'None / custom',             hint: 'Use my own tokens, no off-the-shelf system',     category: 'Custom',     mono: '∅' },
  { id: 'apple-hig',  label: 'Apple Human Interface',     hint: 'iOS, iPadOS, macOS. SF Pro, native controls',    category: 'Platform',   mono: 'A' },
  { id: 'material-3', label: 'Material 3 (Material You)', hint: 'Google Material Design 3. Roboto / Inter',       category: 'Platform',   mono: 'M' },
  { id: 'fluent-2',   label: 'Microsoft Fluent 2',        hint: 'Windows and Microsoft 365. Segoe UI Variable',   category: 'Platform',   mono: 'F' },
  { id: 'carbon',     label: 'IBM Carbon',                hint: 'Enterprise and data dense. IBM Plex',            category: 'Enterprise', mono: 'C' },
  { id: 'atlassian',  label: 'Atlassian Design',          hint: 'Jira, Confluence. Charlie Sans',                 category: 'Enterprise', mono: 'At' },
  { id: 'polaris',    label: 'Shopify Polaris',           hint: 'Commerce admin. Inter',                          category: 'Enterprise', mono: 'P' },
  { id: 'antd',       label: 'Ant Design',                hint: 'Enterprise web. Alibaba Sans / Inter',           category: 'Enterprise', mono: 'a' },
  { id: 'shadcn',     label: 'shadcn/ui',                 hint: 'Radix primitives + Tailwind, copy-in components',category: 'Headless',   mono: 's' },
  { id: 'radix-tw',   label: 'Radix + Tailwind',          hint: 'Headless Radix primitives, Tailwind for styling',category: 'Headless',   mono: 'R' }
]

export const DATA_BACKEND_OPTIONS: { id: string; label: string; hint: string; mono: string }[] = [
  { id: 'supabase',    label: 'Supabase',         hint: 'Postgres + auth + storage + realtime', mono: 'S' },
  { id: 'firebase',    label: 'Firebase',         hint: 'Firestore + auth + functions',          mono: 'F' },
  { id: 'azure',       label: 'Azure',            hint: 'Cosmos DB or Tables + Entra ID',        mono: 'Az' },
  { id: 'aws-amplify', label: 'AWS Amplify',      hint: 'DynamoDB + Cognito + AppSync',          mono: 'AW' },
  { id: 'convex',      label: 'Convex',           hint: 'Reactive backend, TypeScript end-to-end', mono: 'Cv' },
  { id: 'planetscale', label: 'PlanetScale',      hint: 'Serverless MySQL with branching',       mono: 'P' },
  { id: 'sqlite',      label: 'Local SQLite',     hint: 'File-based, single-user, no server',    mono: 'sq' },
  { id: 'rest',        label: 'Custom REST API',  hint: "I'll point at an existing endpoint",     mono: '{}' },
  { id: 'pick',        label: 'Let copilot pick', hint: 'Recommend one with a reason',           mono: '?' }
]

export const LANGUAGE_OPTIONS = [
  'TypeScript / Node', 'JavaScript', 'Python', 'Go',
  'Rust', 'Ruby', 'Java', 'C#', 'Elixir', 'Swift', 'Let copilot pick'
]

export const AUTH_OPTIONS = ['None', 'API key', 'OAuth', 'Session cookie', 'JWT', 'Magic link']
export const STORE_OPTIONS = ['Postgres', 'MySQL', 'SQLite', 'MongoDB', 'Redis', 'Files on disk', 'None']
export const DEPLOY_OPTIONS = ['Vercel', 'Fly.io', 'Railway', 'AWS', 'Cloudflare', 'Self-host', 'Unsure yet']

function radiusPx(id?: string): number {
  return RADIUS_STEPS.find((s) => s.id === id)?.px ?? 10
}
function shadowCss(id?: string): string {
  return SHADOW_STEPS.find((s) => s.id === id)?.css ?? '0 1px 2px rgba(0,0,0,.08), 0 1px 3px rgba(0,0,0,.06)'
}
function outlinePx(id?: string): number {
  return OUTLINE_STEPS.find((s) => s.id === id)?.px ?? 1
}
function fontStack(id?: string): string | undefined {
  return FONT_OPTIONS.find((f) => f.id === id)?.stack
}

function lookCharacter(b: ProjectBrief): string {
  const tags = b.look ?? []
  const lib: Record<string, string> = {
    'Clean and minimal': 'restrained, lots of whitespace, neutral palette beyond the brand color, quiet typographic hierarchy',
    'Playful':           'rounded shapes, color-rich, generous motion, friendly micro-copy',
    'Editorial':         'magazine-like, type-driven hierarchy, large display headings, narrative spacing',
    'Data dense':        'compact rows, monospaced numerics where useful, table-first layouts, low chrome',
    'Luxury':            'generous spacing, fine type details, premium feel, restrained motion',
    'Brutalist':         'stark, raw grids, opinionated type, high contrast, system fonts allowed',
    'Friendly':          'warm tones, approachable copy, accessible defaults, soft corners'
  }
  const desc = tags.map((t) => lib[t]).filter(Boolean).join('; ')
  if (b.lookNote && b.lookNote.trim()) {
    return desc ? `${desc}. Designer note: ${b.lookNote.trim()}` : `Designer note: ${b.lookNote.trim()}`
  }
  return desc
}

function humanize(s?: string): string {
  if (!s) return ''
  return s.replace(/[-_]/g, ' ').trim()
}

function articleFor(word: string): 'a' | 'an' {
  return /^[aeiou]/i.test(word.trim()) ? 'an' : 'a'
}

function typeStory(b: ProjectBrief): string {
  const t = b.typeLabel?.toLowerCase() ?? ''
  const subHuman = humanize(b.subType).toLowerCase()
  const sub = subHuman ? ` Specifically ${articleFor(subHuman)} ${subHuman}.` : ''
  const stories: Record<string, string> = {
    'app':              `An interactive product. Users will sign in, create things, see their data persist, and come back. Reliability, state, and trust matter more than marketing polish.${sub}`,
    'marketing site':   `A marketing site has one job: convince a visitor in under thirty seconds. Hero clarity, social proof, and a single dominant call to action matter more than feature depth.${sub}`,
    'content site':     `A content site is read more than it is clicked. Reading rhythm, type scale, and link affordance matter more than splashy components.${sub}`,
    'productivity tool':`A productivity tool gets used daily by someone who wants to be fast. Information density, shortcuts, and predictable layouts matter more than animation.${sub}`,
    'slide deck':       `A slide deck is consumed in real time while a person speaks. One idea per slide, type that reads from the back of the room, and zero "agenda / thank you" filler. Density of insight, not density of bullets.${sub}`,
    'social post':      `A social post fights for two seconds of attention in a feed. Type-as-art, one strong idea, platform-native safe zones (1080×1080 IG, 1200×630 LI/X, 1080×1920 stories). Export-ready static image is the deliverable.${sub}`,
    'poster':           `A poster is read once at distance, then maybe up close. Single dominant element, hierarchy at three levels max, generous whitespace. Print-safe colors and bleed if going to press.${sub}`,
    'brochure':         `A brochure is held in two hands and folded. Panel sequence, fold-aware layout, real margins, body type that survives 80gsm paper, and a clear call to action on the back panel.${sub}`,
    'one-pager pdf':    `A one-pager is the document that gets forwarded. Information density on a single page, scannable structure, real type, embedded sources, print-safe.${sub}`,
    'resume / cv':      `A résumé is scanned by a human in 7 seconds and parsed by an ATS in 0.7 seconds. Real type, single column unless asked otherwise, machine-readable text (no images of text), no skills bars or radial charts.${sub}`,
    'api / backend':    `An API is a contract. Predictable shapes, typed boundaries, clear error envelopes, and great docs matter more than visual polish.${sub}`,
    'library / sdk':    `A library is judged by its README and its first five minutes. Ergonomic API, zero surprise, great types, and runnable examples matter more than feature count.${sub}`,
    'data / notebook':  `A data project is judged by reproducibility. Clear pipeline, pinned deps, deterministic seeds, and explainable outputs matter more than UI.${sub}`,
    'cli / script':     `A CLI is judged by its --help output and how it behaves in a pipe. Sensible defaults, useful exit codes, machine-readable modes, and zero unexpected prompts matter most.${sub}`
  }
  return stories[t] ?? `${b.typeLabel ?? 'A project'}.${sub}`
}

function surfaceStory(surfaces?: string[]): string {
  if (!surfaces || !surfaces.length) return ''
  const set = new Set(surfaces)
  const has = (id: string) => set.has(id)
  const lines: string[] = []
  const list = surfaces
    .map((s) => SURFACE_OPTIONS.find((o) => o.id === s)?.label ?? s)
    .join(', ')
  lines.push(`Target form factors: **${list}**.`)

  if (has('mobile') && has('desktop')) {
    lines.push('This is a fully responsive build. Design mobile-first, then progressively enhance for tablet and desktop. Every screen must work at 320px wide without horizontal scroll, and must use available real estate intelligently at 1440px+ (multi-column layouts, persistent navigation, hover affordances).')
  } else if (has('mobile') && !has('desktop')) {
    lines.push('This is mobile-only. Optimize for one-handed use, thumb reachability, and touch targets of at least 44x44px. Do not waste effort on hover states or pointer-only interactions. Assume slow networks and intermittent connectivity.')
  } else if (has('desktop') && !has('mobile')) {
    lines.push('This is desktop-only. Optimize for keyboard navigation, multi-column layouts, hover affordances, and density. Do not bother with mobile breakpoints; the mobile view can be a "best viewed on desktop" notice.')
  }
  if (has('tablet')) {
    lines.push('Tablet is in scope: include a layout that works at ~768 to 1024px, where neither mobile nor desktop assumptions hold.')
  }
  if (has('tv')) {
    lines.push('TV / large display is in scope: assume 10-foot viewing, no mouse, oversized type, and remote-control or no-input navigation.')
  }
  return lines.join(' ')
}

function audienceStory(a?: string): string {
  if (!a) return ''
  const map: Record<string, string> = {
    'Just me':              "It is for me alone, so optimize for my speed and my taste. No onboarding, no empty states explaining the obvious, no marketing surface.",
    'Friends and family':   "It is for a small trusted circle. Skip enterprise patterns. Prefer warmth, plain language, and forgiving defaults.",
    'Consumers':            "It is for the general public. Assume a wide range of tech literacy. Default to plain language, generous tap targets, and explanations over jargon.",
    'SMB':                  "It is for small business owners who are busy and not necessarily technical. Prefer outcomes over options. Make the happy path obvious. Hide power features behind a clear 'Advanced' affordance.",
    'Enterprise':           "It is for enterprise users. Density, audit trails, role-based access, keyboard navigation, accessibility, and exportable data matter. Avoid playful copy.",
    'Internal team':        "It is for an internal team. Skip onboarding, skip marketing. Optimize for power users who will live in this every day. Density and shortcuts beat decoration.",
    'Open source community':"It is for developers who will read the source. The README, examples, and contribution guide matter as much as the product itself. Be ruthless about clarity."
  }
  return map[a] ?? `Built for ${a}.`
}

function themeStory(theme?: string): string {
  const map: Record<string, string> = {
    light: 'Ship a light theme only for v1. Design tokens still go through CSS variables so a dark theme can be added later without refactoring components.',
    dark:  'Ship a dark theme only for v1. Make sure contrast hits WCAG AA against the dark surface, especially for the brand color.',
    auto:  'Follow the operating system preference automatically using `prefers-color-scheme`. Both light and dark must look intentional, not like one is a fallback.',
    both:  'Ship both themes with a visible toggle in the UI. Persist the choice. Default to system on first load.'
  }
  return theme ? (map[theme] ?? '') : ''
}

// ---- helpers for format D (story + appendix) ----

function bulletsOrParagraph(s?: string): string {
  if (!s) return ''
  const text = s.trim()
  if (!text) return ''
  // If user wrote multiple lines, render as a bullet list. Otherwise a paragraph.
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length > 1) return lines.map((l) => `- ${l.replace(/^[-*•]\s*/, '')}`).join('\n')
  return text
}

function projectTitle(b: ProjectBrief): string {
  if (b.oneLiner && b.oneLiner.trim()) return b.oneLiner.trim().replace(/\.$/, '')
  const t = b.typeLabel ?? 'Project'
  const sub = humanize(b.subType)
  return sub ? `${t}: ${sub.replace(/\b\w/g, (c) => c.toUpperCase())}` : t
}

export interface KickoffOptions {
  /** Absolute path to the inspiration directory; if provided, image references render as absolute paths so the agent can read them. */
  inspirationBaseDir?: string
  /** Absolute path to the brand directory; if provided, the logo path renders as an absolute path. */
  brandBaseDir?: string
}

export function buildKickoffPrompt(b: ProjectBrief, opts: KickoffOptions = {}): string {
  if (b.type === 'blank') return ''

  const out: string[] = []

  // ============ TITLE & INTRO ============
  out.push(`# ${projectTitle(b)}`, '')
  out.push("Hey. I just put together a brief for a brand new project in Terminal42 and I want you to be my design and engineering partner on it. Read this whole thing before doing anything. The first half is the story of what I'm building and why. The second half (\"Design system\") is the literal spec you'll work from when writing code. If anything later in our conversation conflicts with this brief, raise it. Don't silently override.", '')

  // ============ TOP-OF-MIND ANTI-DEFAULTS (loud digest) ============
  // Fires for every visual type. These are the most-violated AI tropes.
  // Stated up-front so they frame everything that follows.
  const VISUAL_TYPES: ProjectTypeId[] = [
    'web-app', 'marketing-site', 'content-site', 'productivity',
    'slide-deck', 'social-post', 'poster', 'brochure', 'one-pager', 'resume'
  ]
  if (VISUAL_TYPES.includes(b.type)) {
    out.push('---', '')
    out.push("## Read this first: defaults that will get rejected", '')
    out.push("Every AI-generated UI converges on the same handful of tells. If you ship any of these without me explicitly asking for them, I will reject the work and we'll start over. These override anything later in the brief.", '')
    out.push('')
    out.push('1. **No container behind icons.** Never wrap an icon in a coloured rounded square, circle, soft-tint badge, or gradient chip. Icons sit flat on the surface, in a single colour (usually `text-primary` or the accent), at 16/20/24px. The only exception is a true status pill where the badge IS the UI element (e.g., a notification dot). Feature lists, nav, list items, cards: flat icon, no container.')
    out.push('2. **No multi-coloured headings.** Never highlight a single word inside a heading in a different colour ("Build **better** faster", "The **smartest** way", "Modern apps for **modern** teams" with the bold word in accent or gradient). Headings are one colour. Emphasis comes from weight, italic, or scale: not from colour swaps.')
    out.push('3. **No gradient text or two-tone wordmarks.** No `bg-clip-text` rainbow titles. No purple-to-pink hero text. Solid colour, full stop.')
    out.push('4. **No outline-everything.** Never put a 1px border on every card, section, image, list item, or surface by default. Most boxes need NO border. Use whitespace, background colour shifts, and type rhythm to separate content. Borders are reserved for: inputs, table rows, explicit data containers, and dividers between dense list items. If you find yourself adding a border "to make it feel designed," delete it.')
    out.push('5. **No emoji standing in for icons.** 🚀⚡💡🎯✨🔥 are not icons. If a real icon library is set up, use it. If not, use no icon.')
    out.push('6. **No gradient backgrounds, glows, mesh, or aurora.** Solid colours only. Real photography is welcome. Abstract SVG blobs are not.')
    out.push('7. **No fake content.** No invented testimonials, made-up customer logos, fake stats, lorem ipsum. Use `[Placeholder: short label]` markers and ask me for real content.')
    out.push('8. **No generic AI copy.** "Supercharge your workflow", "The future of X starts here", "Build better, faster, smarter", "Unlock the power of X": banned. Write specific copy or ask me what to write.')
    out.push('')
    out.push("If you're unsure whether something I'm asking for falls into one of these: ASK before writing it. Don't apologise after.", '')
  }

  // ============ WORKING AGREEMENT (silent execution) ============
  // Suppress the verbose "Notes on what I did and didn't do" / "Stopping here for
  // your review" / commentary preambles that agents love to emit. We want code,
  // not narration.
  if (VISUAL_TYPES.includes(b.type) || b.type === 'api' || b.type === 'library' || b.type === 'data' || b.type === 'cli') {
    out.push('---', '')
    out.push('## Working agreement', '')
    out.push("How we work together. These also override anything later.", '')
    out.push('')
    out.push('- **Do the work, then stop.** No "Notes on what I did and didn\'t do" preamble. No "Stopping here for your review" sign-off. No bullet list of what you skipped, what you deferred, what conflicts you avoided. If you finished the task, say one short sentence (one line) and stop. If you couldn\'t finish, say what blocked you and stop.')
    out.push('- **No status reports unless I ask.** No "Tokens are the law", "Dark mode is a token swap", "shadcn not yet initialized" explanations. The code is the source of truth: I\'ll read it.')
    out.push("- **Don't list npm audit warnings or transitive dependency notes** unless they actually break the build or are a security CVE I need to patch today.")
    out.push("- **Don't propose follow-ups in prose.** If there's a real next decision (auth provider, DB choice, etc.) ask ONE direct question. Don't enumerate options unprompted.")
    out.push('- **Run the build / typecheck / lint** that the project already has after meaningful changes. Say PASS or paste the actual failure. Nothing else. Do NOT list what you built ("Router, Overview with sparklines, Reports with search, Documents empty state..."). Do NOT append "npm run dev to try it", "Scaffolded at X/", "ready to use", "your app is up". One word: PASS. Or paste the failure. Then stop.')
    out.push('- **Verify it runs yourself, do not delegate to me.** If the project has a dev server (`npm run dev`, `vite`, `next dev`, etc.), start it as a backgrounded task, hit the URL, confirm it serves a 200, then kill it. Never end a turn with "run X to see it" or "try it locally". I should not have to verify your work for you.')
    out.push('- **Never tell me to "click around", "try it", "play with it", "smoke test", "come back when you have content", or any variant.** Manual exploration is your job, not mine. If something needs verifying, drive a headless browser, curl the route, read the rendered HTML, hit the API, run the existing tests. If you genuinely cannot verify something programmatically, say exactly what you cannot verify and why in one sentence, then stop. Do not pad with "in the meantime, run X".')
    out.push('- **Do not ask me for "real content" or "real data" before continuing.** Use realistic placeholder data you generate yourself (sensible names, plausible numbers, real-looking copy). Only ask for real content when the task is literally "wire up my real data" and you do not have it.')
    out.push("- **Use the project's existing tools and conventions.** Don't init shadcn / install Tailwind plugins / pull in a new lib without asking. If a primitive needs a dependency, ask first.")
    out.push("- When committing, stage only what you changed and write a one-line subject. Don't write essays in the body.", '')

    out.push('### Self-check before you say done')
    out.push("Before you tell me you're finished with any UI work, do this silent pass against your own output. If you find any of these in the diff, fix them before showing me:", '')
    out.push('- Any icon wrapped in `bg-*` + `rounded-*` + `p-*` (an icon container)? Remove the wrapper.')
    out.push('- Any heading with mixed colours (`<span className="text-accent">word</span>` inside an h1/h2/h3)? Make it one colour.')
    out.push('- Any `bg-clip-text` / `bg-gradient-to-` on text? Remove it.')
    out.push('- Any `border` / `border-border` on cards, sections, list items that are not inputs/tables/explicit data containers? Remove it.')
    out.push('- Any `uppercase` + `tracking-wide(r)` labels? Convert to sentence case, drop the tracking.')
    out.push('- Any emoji used as an icon? Replace with a real icon or remove.')
    out.push('- Any `bg-gradient-to-` or `from-*-500 via-*-500` background? Replace with a solid colour.')
    out.push('- Any of these copy phrases anywhere: "Supercharge", "Modern X for modern Y", "The future of", "Build better faster", "Unlock the power", "Empower your"? Rewrite specifically.')
    out.push('- Any invented testimonial, logo, customer name, or stat? Replace with `[Placeholder: short label]`.')
    out.push('')
    out.push("Do this pass quietly. Don't list what you found. Just fix it and move on.", '')

    out.push('### Concrete patterns: copy these, do not improvise')
    out.push("When you build a feature card, KPI card, nav item, button, or hero, use the patterns below as the literal shape. They embody every rule above. If you find yourself writing markup that doesn't look like one of these, you're improvising: stop and pattern-match.", '')

    out.push('**Feature row (good):**')
    out.push('```tsx')
    out.push('<li className="flex gap-3">')
    out.push('  <Icon name="zap" className="mt-1 h-5 w-5 text-text-secondary shrink-0" />')
    out.push('  <div>')
    out.push('    <h3 className="text-base font-medium text-text-primary">Real, specific feature name</h3>')
    out.push('    <p className="mt-1 text-sm text-text-secondary">One sentence that says what it does for the user. No marketing fluff.</p>')
    out.push('  </div>')
    out.push('</li>')
    out.push('```')
    out.push('')
    out.push('**Feature card (BAD: do not generate):**')
    out.push('```tsx')
    out.push('<div className="rounded-2xl border border-border p-6 shadow-md hover:shadow-lg transition">')
    out.push('  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">')
    out.push('    <Icon name="zap" className="h-6 w-6" />')
    out.push('  </div>')
    out.push('  <h3 className="text-xl font-bold">Supercharge your <span className="text-accent">workflow</span></h3>')
    out.push('  <p className="mt-2 text-muted">Modern solutions for modern teams.</p>')
    out.push('</div>')
    out.push('```')
    out.push('Why bad: icon container, multi-colour heading, generic copy, default border, hover shadow lift, oversized rounding.', '')

    out.push('**KPI card (good):**')
    out.push('```tsx')
    out.push('<div className="p-5">')
    out.push('  <p className="text-sm text-text-secondary">Active users</p>')
    out.push('  <p className="mt-1 text-3xl font-semibold tabular-nums text-text-primary">12,408</p>')
    out.push('  <p className="mt-1 text-xs text-emerald-600 tabular-nums">+4.2% vs last week</p>')
    out.push('</div>')
    out.push('```')
    out.push('Note: no border, no icon, no chip behind the delta, the number is the largest thing.', '')

    out.push('**Sidebar nav item (good):**')
    out.push('```tsx')
    out.push('<a href="/inbox" className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm ${active ? "bg-elevated text-text-primary" : "text-text-secondary hover:bg-elevated hover:text-text-primary"}`}>')
    out.push('  <Icon name="inbox" className="h-4 w-4" />')
    out.push('  <span>Inbox</span>')
    out.push('</a>')
    out.push('```')
    out.push('Note: icon is monochrome, sits flat, no coloured rounded square wrapper.', '')

    out.push('**Primary button (good):**')
    out.push('```tsx')
    out.push('<button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-text hover:opacity-90 disabled:opacity-50">')
    out.push('  Create invoice')
    out.push('</button>')
    out.push('```')
    out.push('Note: solid fill, no gradient, no glow, sentence case verb-noun label.', '')

    out.push('**Section heading (good):**')
    out.push('```tsx')
    out.push('<h2 className="text-2xl font-semibold text-text-primary">Pricing</h2>')
    out.push('<p className="mt-2 text-base text-text-secondary max-w-prose">One sentence of context if useful. Skip otherwise.</p>')
    out.push('```')
    out.push("No eyebrow pill. No ALL CAPS label above. No coloured word inside the heading.", '')

    out.push('### tokens.css: start with this exact shape')
    out.push("Every project should ship a `tokens.css` (or equivalent) with these CSS custom properties. Fill in the values from the brief. Do NOT add token names that aren't in this list without telling me. Reference these tokens via Tailwind theme aliases (`bg-bg`, `text-text-primary`, etc.): never hex, never px, never `bg-blue-500`.", '')
    out.push('```css')
    out.push(':root {')
    out.push('  /* Surfaces */')
    out.push('  --color-bg: /* page background */;')
    out.push('  --color-surface: /* cards / panels */;')
    out.push('  --color-elevated: /* hover / active surfaces */;')
    out.push('')
    out.push('  /* Text */')
    out.push('  --color-text-primary: /* headings, body */;')
    out.push('  --color-text-secondary: /* supporting copy */;')
    out.push('  --color-text-muted: /* labels, captions */;')
    out.push('')
    out.push('  /* Borders: used SPARINGLY (inputs, table rows, dense lists) */')
    out.push('  --color-border: /* hairline, low-contrast */;')
    out.push('')
    out.push('  /* Brand: ONE accent + four semantic */')
    out.push('  --color-accent: /* primary brand colour */;')
    out.push('  --color-accent-text: /* readable text on accent */;')
    out.push('  --color-success: /* emerald-ish */;')
    out.push('  --color-warning: /* amber-ish */;')
    out.push('  --color-error: /* red-ish */;')
    out.push('  --color-info: /* blue-ish */;')
    out.push('')
    out.push('  /* Radius: calm, not pillowy */')
    out.push('  --radius-sm: 4px;')
    out.push('  --radius-md: 8px;')
    out.push('  --radius-lg: 12px;')
    out.push('  --radius-pill: 999px;')
    out.push('')
    out.push('  /* Shadow: at most one, very subtle */')
    out.push('  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);')
    out.push('  --shadow-md: 0 2px 6px rgba(0,0,0,0.06);')
    out.push('}')
    out.push('@media (prefers-color-scheme: dark) {')
    out.push('  :root { /* swap each value, do not invert */ }')
    out.push('}')
    out.push('```')
    out.push("Anything not on this list (gradients, glow shadows, multiple accent variants, gradient text colours) is forbidden by default. If you genuinely need a new token, ask first.", '')

    out.push('### Refusal training')
    out.push("If I ask for something that violates the rules above (e.g. \"add a gradient hero\", \"put a sparkle pill above the heading\", \"add a feature grid with emoji icons\"), don't silently comply. Push back in one sentence and propose the on-brand alternative. Example:", '')
    out.push("> You asked for a gradient hero. Per the brief that's banned by default. Do you want (a) a flat accent-coloured block, (b) a real photograph, or (c) plain whitespace with strong type? I'll go with (c) unless you say otherwise.", '')
  }

  // ============ WHAT I'M BUILDING ============
  out.push("## What I'm building", '')
  out.push(typeStory(b))
  const surfaces = surfaceStory(b.surfaces)
  if (surfaces) { out.push(''); out.push(surfaces) }
  if (b.description && b.description.trim()) {
    out.push('')
    out.push(b.description.trim())
  } else if (b.oneLiner && b.oneLiner.trim() && !b.description) {
    out.push('')
    out.push(`In one line: **${b.oneLiner.trim()}**`)
  }
  out.push('')

  // ============ WHO IT'S FOR ============
  if (b.audience) {
    out.push("## Who it's for", '')
    out.push(`The audience is **${b.audience}**. ${audienceStory(b.audience)} Let this audience shape every default: copy tone, density, onboarding depth, error messages, empty states. Don't design for a generic user.`)
    out.push('')
  }

  // ============ THE PROBLEM & THE GOAL ============
  const hasProblemBlock = !!(b.problem?.trim() || b.goal?.trim() || b.successMetric?.trim())
  if (hasProblemBlock) {
    out.push('## The problem and the goal', '')
    if (b.problem?.trim()) {
      out.push('**Problem I\'m solving**')
      out.push(b.problem.trim())
      out.push('')
    }
    if (b.goal?.trim()) {
      out.push('**What success looks like**')
      out.push(b.goal.trim())
      out.push('')
    }
    if (b.successMetric?.trim()) {
      out.push('**I\'ll know it\'s working when**')
      out.push(b.successMetric.trim())
      out.push('')
    }
  }

  // ============ WHAT IT SHOULD DO ============
  if (b.keyFeatures?.trim()) {
    out.push('## What it should do', '')
    out.push("Here's the rough feature surface I have in mind. Don't treat this as the final scope: push back if anything looks misaligned with the goal above.", '')
    out.push(bulletsOrParagraph(b.keyFeatures))
    out.push('')
  }

  // ============ MUST-HAVES AND CONSTRAINTS ============
  const constraintsParts: string[] = []
  if (b.mustHaves?.trim()) {
    constraintsParts.push("**Must-haves**")
    constraintsParts.push(bulletsOrParagraph(b.mustHaves))
  }
  if (b.notes?.trim()) {
    constraintsParts.push("**Other constraints**")
    constraintsParts.push(b.notes.trim())
  }
  if (constraintsParts.length) {
    out.push('## Must-haves and constraints', '')
    out.push(constraintsParts.join('\n\n'))
    out.push('')
  }

  // ============ HOW IT SHOULD FEEL ============
  const character = lookCharacter(b)
  if (character || (b.look && b.look.length)) {
    out.push('## How it should feel', '')
    if (b.look && b.look.length) {
      out.push(`When I close my eyes and picture this product, the words that come up are **${b.look.join(', ')}**.`)
    }
    if (character) {
      out.push('')
      out.push(`Concretely: ${character}.`)
    }
    out.push('')
    out.push('Translate this mood into every component. A minimal product with a loud button is broken. A playful product with a flat grey form is broken. The mood is the spec, not decoration.', '')
  }

  // ============ BRAND ASSETS ============
  if (b.brandLogo || b.brandName) {
    out.push('---', '')
    out.push('## Brand assets', '')
    if (b.brandName) {
      out.push(`Brand name: **${b.brandName}**. Use this exact spelling and casing in headings, the title bar, the README, page metadata, and any "About" copy.`)
    }
    if (b.brandLogo) {
      const path = opts?.brandBaseDir ? `${opts.brandBaseDir}/${b.brandLogo}` : b.brandLogo
      out.push(`Logo: \`${path}\``)
      out.push('- Place a copy in the project under `public/brand/` (or the stack equivalent) and reference it from there.')
      out.push('- Prefer the SVG for on-screen and print. Generate PNG/favicon variants from it; do not redraw or "clean up" the mark.')
      out.push('- Never recolour or restyle the logo unless the brief explicitly says so. Padding around the mark is at least the height of the cap-letter on each side.')
    }
    out.push('')
  }

  // ============ DESIGN SYSTEM CHOICE (off-the-shelf) ============
  const dsChoice = b.designSystem && b.designSystem !== 'none' ? b.designSystem : null
  if (dsChoice) {
    const ds = DESIGN_SYSTEM_OPTIONS.find((o) => o.id === dsChoice)
    out.push('---', '')
    out.push('## Design system: off-the-shelf', '')
    out.push(`I want this app built on **${ds?.label ?? dsChoice}**. ${ds?.hint ?? ''}`, '')
    out.push('Hard rules:')
    out.push('- **Adopt the system\'s tokens, components, and conventions wholesale.** Do not invent your own scale, your own button, or your own input. If the system has a Button component, use it.')
    out.push('- **Match component anatomy:** padding, radius, shadow, focus ring, disabled state, error state, sizing scale all come from the system. Do not "tweak" defaults to look unique.')
    out.push('- **Match the system\'s typography stack** unless the brief overrides specific fonts above. The brief\'s shape/shadow/outline knobs above are *suggestions only* when a system is chosen: system defaults win.')
    out.push('- **Use the official package**, not a hand-rolled clone:')
    const installNotes: Record<string, string[]> = {
      'apple-hig':  ['SwiftUI on Apple platforms; on the web use shadcn/ui or Headless UI styled to feel HIG-native (rounded 12-16px, SF Pro / SF Pro Display, system colours).', 'Reference: https://developer.apple.com/design/human-interface-guidelines'],
      'material-3': ['Web: `@material/web` (Material Web Components) or MUI (`@mui/material`) v6+ themed for M3.', 'Android: Jetpack Compose Material3.', 'Reference: https://m3.material.io'],
      'fluent-2':   ['Web: `@fluentui/react-components` v9 (Fluent UI v9 = Fluent 2).', 'Reference: https://fluent2.microsoft.design'],
      'carbon':     ['React: `@carbon/react`. Tokens: `@carbon/styles`. Plex font from `@ibm/plex`.', 'Reference: https://carbondesignsystem.com'],
      'atlassian':  ['React: `@atlaskit/*` packages. Charlie Sans is the Atlassian font.', 'Reference: https://atlassian.design'],
      'polaris':    ['React: `@shopify/polaris`. Inter font.', 'Reference: https://polaris.shopify.com'],
      'antd':       ['React: `antd` v5+. Theme tokens via `ConfigProvider`.', 'Reference: https://ant.design'],
      'shadcn':     ['Use the shadcn/ui CLI: `npx shadcn@latest init`, then add components on demand. Tailwind required. Radix under the hood.', 'Reference: https://ui.shadcn.com'],
      'radix-tw':   ['`@radix-ui/react-*` primitives + Tailwind for styling. Headless: you bring the visual layer, the system brings the behaviour and accessibility.', 'Reference: https://www.radix-ui.com/primitives']
    }
    for (const line of (installNotes[dsChoice] ?? [])) out.push(`  - ${line}`)
    out.push('- **Do not mix systems.** Picking Carbon means no Material buttons sneaking in. Picking shadcn means no Ant tables.')
    out.push('- **Accessibility is already baked into the system**: use the components rather than re-implementing focus management, dialog trapping, or combobox keyboard handling.')
    out.push('')
  }

  // ============ DESIGN SYSTEM (the appendix) ============
  const hasDesignSystem =
    b.brandColor || b.secondaryColor || b.tertiaryColor ||
    b.headingFont || b.bodyFont || b.font ||
    b.radius || b.shadow || b.outline !== undefined || b.theme

  if (hasDesignSystem) {
    out.push('---', '')
    out.push('## Design system', '')
    out.push("Below is the literal spec. Put these values into `tokens.css` (or the equivalent for the chosen stack) as CSS custom properties and reference them everywhere. Never inline a raw hex, font name, radius, or pixel value inside a component file.", '')

    // Brand colors as a clean labeled list
    if (b.brandColor || b.secondaryColor || b.tertiaryColor) {
      out.push('**Brand colors**')
      if (b.brandColor)     out.push(`- Primary \`${b.brandColor}\`: most important action per screen, active nav state. Never decorative chrome.`)
      if (b.secondaryColor) out.push(`- Secondary \`${b.secondaryColor}\`: supporting actions, secondary nav, selected rows.`)
      if (b.tertiaryColor)  out.push(`- Accent \`${b.tertiaryColor}\`: highlights, badges, focus rings only.`)
      out.push('')
    }

    // Typography
    if (b.headingFont || b.bodyFont) {
      out.push('**Typography**')
      if (b.headingFont) out.push(`- Headings: **${b.headingFont}**`)
      if (b.bodyFont)    out.push(`- Body: **${b.bodyFont}**`)
      out.push('- One scale: display, h1, h2, h3, body, small, caption. No third typeface.')
      out.push('')
    }

    // Components
    if (b.radius || b.shadow || b.outline) {
      out.push('**Components**')
      if (b.radius) {
        const px = radiusPx(b.radius)
        out.push(`- Corners: ${b.radius} (${px === 999 ? 'pill' : px + 'px'}): applied consistently to buttons, inputs, cards, modals, selects.`)
      }
      if (b.shadow) {
        const map: Record<string, string> = {
          none: 'no shadows; rely on whitespace and borders',
          subtle: 'hairline shadows on cards/dropdowns only; buttons stay flat',
          medium: 'soft elevation on cards and modals; buttons get a faint hover lift',
          strong: 'pronounced shadows on cards/modals/popovers, used sparingly, never stacked'
        }
        out.push(`- Shadows: ${b.shadow}: ${map[b.shadow] ?? ''}`)
      }
      if (b.outline) {
        const map: Record<string, string> = {
          none: 'no borders; rely on background contrast and shadow',
          subtle: '1px hairline borders on inputs, cards, dividers',
          strong: '2px borders, opinionated and visible (brutalist friendly)'
        }
        out.push(`- Outlines: ${b.outline}: ${map[b.outline] ?? ''}`)
      }
      out.push('')
    }

    // Theme
    const themeNote = themeStory(b.theme)
    if (themeNote) {
      out.push('**Theme**')
      out.push(`- ${themeNote}`)
      out.push('')
    }

    // Icons
    if (b.iconLibrary) {
      const iconNotes: Record<string, string> = {
        'Lucide':           'Install `lucide-react` (or framework equivalent). Default size 20px, stroke 1.5. Import named: `import { Plus } from "lucide-react"`.',
        'Phosphor':         'Install `@phosphor-icons/react`. Pick **one** weight (Regular for UI, Bold for emphasis) and stick to it.',
        'Heroicons':        'Install `@heroicons/react`. Use the 24px outline set for UI; 20px solid for status. Don\'t mix outline + solid in the same row.',
        'Tabler':           'Install `@tabler/icons-react`. 24px line, stroke 2. Quiet and crisp.',
        'Radix Icons':      'Install `@radix-ui/react-icons`. 15×15 only: designed for compact UI chrome.',
        'Material Symbols': 'Use the variable font from Google Fonts. Pick one fill axis value (0 outline / 1 filled) and stick to it.',
        'Iconoir':          'Install `iconoir-react`. 24px line. Slight editorial feel.',
        'Feather':          'Install `react-feather`. 24px, stroke 2. Minimal default set.',
        'None / custom':    'I\'ll provide SVGs in `src/icons/`. Inline as React components, never as `<img>`. Use `currentColor` so they pick up text colour.'
      }
      out.push('**Icons**')
      out.push(`- Library: **${b.iconLibrary}**. ${iconNotes[b.iconLibrary] ?? ''}`)
      out.push('- Use icons only when they add meaning (nav, status, inline actions). Don\'t sprinkle decorative icons next to every heading.')
      out.push('- Never substitute emoji for icons. If the icon doesn\'t exist in the chosen set, ask before adding a second library.')
      out.push('')
    }

    // Images
    if (b.imageSource) {
      const imageNotes: Record<string, string> = {
        'upload':   'I\'ll provide real photos, screenshots, and brand imagery. Use clearly-marked `[Image: describe what goes here]` placeholders until I drop the file in `public/images/`.',
        'unsplash': 'Pull from the Unsplash API. Filter for cohesion: pick a single editorial direction (e.g. natural light + warm neutrals) and stick to it. Credit photographers in a `CREDITS.md`.',
        'pexels':   'Pull from the Pexels API. Same cohesion rule: pick one visual direction and don\'t mix.',
        'mix':      'Brand assets I\'ll provide; use Unsplash/Pexels for fillers only. Mark placeholders clearly so I can swap them.',
        'none':     'No photographic imagery. Type, colour, and layout only. Illustrations are also out unless I explicitly ask.',
        'later':    'Use `[Image: …]` placeholders for now with a one-line description of what should go there.'
      }
      out.push('**Images**')
      out.push(`- Source: **${b.imageSource}**. ${imageNotes[b.imageSource] ?? ''}`)
      out.push('- Always set `width` and `height` to prevent CLS. Use `loading="lazy"` below the fold. Prefer AVIF → WebP → JPG/PNG fallback via `<picture>`.')
      out.push('- Never use AI-generated stock photos of fake people. Never invent avatars for testimonials.')
      out.push('')
    }

    // Motion / animation
    if (b.motionLibs && b.motionLibs.length) {
      const motionNotes: Record<string, string> = {
        'framer-motion':    'Framer Motion for component animations, gestures, and `<AnimatePresence>` mount/unmount. Default transition: `{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }`.',
        'gsap':             'GSAP for timeline-based scroll animations and complex choreography. Pair with ScrollTrigger. Tree-shake the modules you actually use.',
        'lenis':            'Lenis for inertial smooth scrolling. Initialise once at the app root. Pair with GSAP ScrollTrigger via `lenis.on(\'scroll\', ScrollTrigger.update)`.',
        'anime':            'Anime.js for tweening SVG paths, DOM, and JS objects. Lightweight alternative to GSAP for simpler timelines.',
        'motion-one':       'Motion One: tiny WAAPI wrapper. Use it when bundle size matters and Framer is overkill.',
        'view-transitions': 'View Transitions API for native cross-document and SPA route transitions. Progressive enhancement only: wrap calls in `if (document.startViewTransition)`.',
        'css-only':         'CSS only: `transition`, `@keyframes`, and scroll-driven animations (`animation-timeline: scroll()`). No JS animation lib.',
        'none':             'No motion. Don\'t add transitions, scroll effects, or animated reveals unless I explicitly ask.'
      }
      out.push('**Motion**')
      out.push(`- Libraries in scope: ${b.motionLibs.map((m) => `**${m}**`).join(', ')}.`)
      for (const m of b.motionLibs) {
        if (motionNotes[m]) out.push(`  - ${motionNotes[m]}`)
      }
      out.push('- Keep all UI animations under 300ms. Only animate `transform` and `opacity`. Respect `prefers-reduced-motion: reduce`: gate every animation behind it.')
      out.push('- No bouncing page-load animations. No spinning loaders larger than 24px. No autoplay carousels.')
      out.push('')
    }

    // CSS tokens block
    out.push('**Tokens (paste into `tokens.css`)**', '')
    out.push('```css', ':root {')
    if (b.brandColor)     out.push(`  --color-primary: ${b.brandColor};`)
    if (b.secondaryColor) out.push(`  --color-secondary: ${b.secondaryColor};`)
    if (b.tertiaryColor)  out.push(`  --color-accent: ${b.tertiaryColor};`)
    const heading = fontStack(b.headingFont)
    const body = fontStack(b.bodyFont) ?? fontStack(b.font)
    if (heading) out.push(`  --font-heading: ${heading};`)
    if (body)    out.push(`  --font-body: ${body};`)
    if (b.radius) {
      const px = radiusPx(b.radius)
      out.push(`  --radius-button: ${px === 999 ? '9999px' : px + 'px'};`)
      out.push(`  --radius-surface: ${px === 999 ? '24px' : Math.max(4, px) + 'px'};`)
    }
    if (b.shadow) out.push(`  --shadow-default: ${shadowCss(b.shadow)};`)
    if (b.outline !== undefined) {
      out.push(`  --border-width: ${outlinePx(b.outline)}px;`)
      out.push('  --border-color: rgba(0,0,0,.12);')
    }
    out.push('  --space-1: 4px; --space-2: 8px; --space-3: 12px;')
    out.push('  --space-4: 16px; --space-5: 20px; --space-6: 24px;')
    out.push('  --space-8: 32px; --space-10: 40px; --space-12: 48px;')
    out.push('}', '```', '')
    out.push('All spacing must come from those scale tokens. No arbitrary 7px or 13px paddings. If a value isn\'t on the 4px grid, it\'s wrong.', '')
  }

  // ============ TECH ============
  const techParts: string[] = []
  if (b.stack)    techParts.push(`- **Stack**: ${b.stack}${b.stack.includes('Let copilot') ? ': propose one with a one-line justification.' : ' (open to alternatives if you have a strong reason).'}`)
  if (b.language) techParts.push(`- **Language**: ${b.language}`)
  if (b.auth)     techParts.push(`- **Auth**: ${b.auth}`)
  if (b.store)    techParts.push(`- **Data store**: ${b.store}`)
  if (b.deploy)   techParts.push(`- **Deploy target**: ${b.deploy}`)
  if (techParts.length) {
    out.push('## Tech context', '')
    out.push('Decisions I\'ve already made on the engineering side. Where I said "let copilot pick", give me a recommendation with one line of reasoning, not multiple-choice back at me.', '')
    out.push(...techParts)
    out.push('')
  }

  // ============ DATA ============
  if (b.dataMode === 'demo') {
    out.push('## Data', '')
    out.push('**Demo / placeholder data only.** Do NOT wire a real backend, do NOT install Supabase / Firebase / any database SDK, do NOT scaffold auth flows. Use realistic in-memory or JSON-file fixtures that ship with the app. Generate plausible names, numbers, dates, and copy yourself. Never ask me for "real data" or pause waiting on me to provide it. If the UI needs a list of users, invent ten of them. If a chart needs values, invent a believable trend. Treat data as part of the design.', '')
  } else if (b.dataMode === 'real' && b.dataBackend) {
    const backend = DATA_BACKEND_OPTIONS.find((o) => o.id === b.dataBackend)
    const label = backend?.label ?? b.dataBackend
    out.push('## Data', '')
    if (b.dataBackend === 'pick') {
      out.push('**Real backend, your call.** Recommend ONE backend (Supabase, Firebase, Convex, etc.) with a one-line reason based on this project. Do not list options. Once picked, scaffold the client SDK, env vars, and a single example query. Use realistic placeholder data in the UI until I plug in real credentials.', '')
    } else {
      out.push(`**Real backend: ${label}.** Scaffold the ${label} client SDK, env var stubs (in \`.env.example\`), and one example query/mutation matching the app's domain. Do NOT ask me for credentials, project IDs, or API keys before scaffolding: leave clearly-marked placeholders (\`YOUR_${b.dataBackend?.toUpperCase().replace('-','_')}_URL\`) and document in the README what to fill in. Use realistic placeholder data in the UI until I plug in real credentials. Never block on me for credentials.`, '')
    }
  }

  // ============ INSPIRATION ============
  if (b.inspirationImages && b.inspirationImages.length) {
    out.push('## Visual inspiration I uploaded', '')
    const baseDir = opts.inspirationBaseDir
    // inspirationImages are stored as "inspiration/<filename>". The actual files
    // live under <userData>/brain/projects/<projectId>/inspiration/. We emit
    // absolute paths so you can open the files directly with your file tools.
    const toAbs = (rel: string): string => {
      if (!baseDir) return rel
      const filename = rel.replace(/^inspiration\//, '')
      const sep = baseDir.endsWith('/') ? '' : '/'
      return `${baseDir}${sep}${filename}`
    }
    if (baseDir) {
      out.push(`I uploaded ${b.inspirationImages.length} reference image(s). The files are on disk at the absolute paths below: read them with your file/image tools before designing anything. Treat them as **direction, not specification**: vibes, structure, hierarchy, not pixel targets:`)
    } else {
      out.push(`I uploaded ${b.inspirationImages.length} reference image(s). Treat them as **direction, not specification**:`)
    }
    out.push('')
    for (const rel of b.inspirationImages) {
      const abs = toAbs(rel)
      out.push(`- \`${abs}\``)
    }
    out.push('')
    out.push('When you propose layouts or components, name the inspiration file you\'re pulling from so I can verify.', '')
  }

  // ============ WEBSITE HOUSE RULES (anti-AI-defaults) ============
  // Only fires for explicit website types. App-style rules come separately.
  if (b.type === 'marketing-site' || b.type === 'content-site') {
    out.push('---', '')
    out.push('## Website house rules: anti-AI-defaults', '')
    out.push("These are non-negotiable defaults for websites built in this workspace. They exist because AI-generated sites all converge on the same handful of tropes, and I don't want this one to look like the rest. Treat every rule as **never X. Instead Y.** unless I explicitly ask for the X.", '')

    out.push('### Backgrounds, surfaces, borders')
    out.push('- **Never** use purple/blue/pink gradient hero backgrounds. Never use aurora-mesh, gradient blur, or "glow" backdrops. Instead: solid flat colours, a single brand accent block, or real photography.')
    out.push('- **Never** use abstract SVG blobs, wavy dividers, floating circles, or squiggly decorative shapes as filler. Instead: clean whitespace, subtle background colour shifts, or a real product/editorial image.')
    out.push('- **Never** wrap every section, card, image, or list item in a 1px grey border by default. The default is **no border**. Separate sections with whitespace, type rhythm, or a flat background colour change. Reserve borders for: form inputs, table rows, explicit data containers (e.g. a code block), and dividers inside dense lists. If a card needs to "stand out", use a different background colour, not a border.')
    out.push('- **Never** stack multiple borders (a section border + a card border + an inner card border). Pick one container or none.')
    out.push('')

    out.push('### Typography')
    out.push('- **Never** use grey ALL-CAPS letter-spaced eyebrow labels above every heading (`SECTION HEADING`, `THIS IS [BRAND]`). Instead: sentence-case headings, with a small mono or numbered label only when it carries meaning ("01: Ingest").')
    out.push('- **Never** use placeholder eyebrow pills with sparkle icons (`✨ Now in early access`, `✨ Introducing…`). Instead: omit the pill, or write a real, specific phrase with no sparkle.')
    out.push('- **Never** colour individual words inside a heading differently from the rest (e.g. "Design **smarter**" with `smarter` in accent). Headings are one colour. If you need emphasis, use weight, italic, or a line break: never a colour swap.')
    out.push('- **Never** use gradient text, `bg-clip-text` rainbow wordmarks, or two-tone titles. Solid fill only.')
    out.push('- **Never** oversize hero text to 80:120px just because it\'s a hero. Instead: use a strong editorial scale where the headline reads as a real sentence, not a banner.')
    out.push('- Prefer an **editorial serif** for headlines (e.g. Fraunces, GT Sectra, Tiempos, EB Garamond) paired with a clean sans for body, when the brand allows. Italic emphasis inside a headline is welcome ("The *operating system* for marketing").')
    out.push('- Body copy is sentence case, never ALL CAPS. Body line length capped at ~65:75 characters.')
    out.push('')

    out.push('### Icons and ornament')
    out.push('- **Never** use emoji (🚀⚡💡🎯✨🔥) in place of icons. Instead: real SVG icons from Lucide or Phosphor at 16/20/24px, used only when an icon adds meaning. If no real icon library is set up yet, omit the icon: do not substitute an emoji.')
    out.push('- **Never** put a coloured rounded square, circle, or soft-tint badge BEHIND an icon. No `bg-accent/10 rounded-xl p-3` icon wrappers. No "feature card icon chips". Icons are flat, single-colour, no container, sitting directly on the surface. The icon is the icon: it does not need a frame.')
    out.push('- **Never** sprinkle decorative icons next to every heading, every feature, every list item. Instead: text alone, with icons reserved for navigation, status, and inline actions.')
    out.push('- **Never** add tilted/perspective-transformed fake "floating dashboard" screenshots in the hero. Instead: a flat product screenshot, a real photograph, or no image at all.')
    out.push('')

    out.push('### Sections, structure, and content')
    out.push('- **Never** generate the default AI marketing template (navbar → gradient hero → 3 emoji feature cards → fake testimonials → CTA → footer). Instead: design sections around the real product story. If a section has no real content yet, leave it out: do not pad with filler.')
    out.push('- **Never** invent testimonials, customer names, logos, or stats. Use clearly marked placeholders: `[Testimonial: add real customer quote]`, `[Logo placeholder]`, `[Stat: replace with real number]`. The user will provide real ones.')
    out.push('- **Never** write generic AI hero copy: "Supercharge your workflow", "The future of X starts here", "Build better, faster, smarter", "Unlock the power of X", "Modern solutions for modern teams". Instead: write specific, benefit-led copy that names what the product actually does. If the brief doesn\'t give you enough, ask before writing.')
    out.push('- **Never** make the hero `100vh` by default. Size it to fit its content.')
    out.push('- Editorial layouts beat templated grids. Asymmetry, generous whitespace, strong type rhythm, one or two anchor images: that beats a 3-up feature row every time.')
    out.push('')

    out.push('### Colour and effects')
    out.push('- **Never** use rainbow hover, glowing neon, or animated gradient borders. Instead: a subtle background darken, a 1px lift (`translateY(-1px)`), or a border-colour change.')
    out.push('- One bold accent colour, used decisively on primary CTAs and active states. Not as a gradient. Not as a glow. Not on every chrome element.')
    out.push('- Pure black backgrounds and pure white backgrounds are both fine and often better than a "designed" off-white.')
    out.push('')

    out.push('### When in doubt')
    out.push('Look at sites like Vesence, Neko Health, Polar.sh, Linear, Stripe, and editorial fashion/magazine sites: flat colour, real type, real photography, no AI-defaults. Look at the inspiration images I uploaded (if any) before reaching for a generic template.', '')
  }

  // ============ APP HOUSE RULES (anti-AI-defaults) ============
  // Dashboards / web apps / productivity tools. Mirrors the website block above.
  if (b.type === 'web-app' || b.type === 'productivity') {
    out.push('---', '')
    out.push('## App house rules: anti-AI-defaults', '')
    out.push("Defaults for dashboards, web apps, and productivity tools built in this workspace. AI-generated apps converge on the same handful of tropes: rainbow KPI cards, emoji nav items, glassmorphism, cartoon empty states. I want none of it. Treat every rule as **never X. Instead Y.** unless I explicitly ask for the X.", '')

    out.push('### Typography and icons')
    out.push('- **Never** colour individual words inside a heading or button differently ("Add **new** project" with `new` in accent). One colour per text element. Emphasis = weight, italic, scale.')
    out.push('- **Never** use gradient text or `bg-clip-text` titles anywhere in the app. Solid fill only.')
    out.push('- **Never** use ALL-CAPS labels with letter-spacing on column headers, nav, sidebar sections, or anywhere else. Sentence case throughout.')
    out.push('- **Never** put a coloured rounded-square or circle BEHIND every nav icon, sidebar icon, KPI icon, or feature icon. Icons are flat, monochrome, no container, sitting directly on the surface. The only acceptable "icon container" is a true status badge where the badge IS the UI.')
    out.push('- **Never** use emoji as icons in nav, sidebar, table cells, or status. Use a real icon library or no icon.')
    out.push('')

    out.push('### Borders and dividers')
    out.push('- **Default = no border.** Most surfaces in the app should have NO 1px outline. Use whitespace and background tone shifts to separate.')
    out.push('- Borders are reserved for: form inputs, table row dividers, dense list dividers, the sidebar/main divider, and explicit data containers (code blocks, log viewers).')
    out.push('- **Never** stack borders (a card with a border, containing rows with borders, containing chips with borders). Pick the outer container OR the inner rows, never both.')
    out.push('')

    out.push('### Layout and navigation')
    out.push('- **Never** use a wide pastel sidebar with emoji or 3D-rendered icons. Instead: a tight sidebar (~220:260px) with a single accent for the active row, monochrome line icons, and dense type.')
    out.push('- **Never** use glassmorphism, frosted blur, or transparent navbars over a gradient. Instead: solid surface, 1px hairline border or no border at all.')
    out.push('- **Never** use a top nav with a centred pill of links AND a sidebar of links AND a breadcrumb: pick one primary nav surface. The reference apps use either a sidebar OR a centred pill nav, never all three.')
    out.push('- Active nav item: a solid filled pill / rounded rectangle in the surface tone (or accent), no rainbow glow, no animated gradient underline.')
    out.push('')

    out.push('### Surfaces, cards, and grids')
    out.push('- **Never** wrap every section in its own thick rounded card with a drop shadow. Instead: group by whitespace and a single hairline divider; reserve cards for genuinely separate data containers.')
    out.push('- **Never** apply 16:24px border-radius to every surface. Instead: a calm 8:12px on cards, smaller (4:6px) on inputs and chips. Pills (999px) only for status chips and segmented controls.')
    out.push('- **Never** stack multiple drop shadows for "depth". Instead: one subtle shadow (`0 1px 3px rgba(0,0,0,0.06)`) or no shadow with a 1px border.')
    out.push('- Dashboards prefer **flat surfaces on a tinted background** (off-white or near-black), not floating cards on white.')
    out.push('')

    out.push('### KPIs and numbers')
    out.push('- **Never** give each KPI card its own gradient background and a different bright colour. Instead: identical neutral surfaces, the *number* does the talking, with one small tinted delta chip (`+12% YoY`) in the accent or semantic colour.')
    out.push('- **Never** put an emoji or 3D icon next to every KPI. Instead: a small monochrome line icon, or no icon at all.')
    out.push('- The KPI **value** is the largest text on the card (32:56px). The label is small and muted above or below.')
    out.push('- Use tabular-nums (`font-variant-numeric: tabular-nums`) on every number, table cell, and KPI so digits align.')
    out.push('')

    out.push('### Charts and data viz')
    out.push('- **Never** use the default Chart.js / Recharts rainbow palette (red, orange, yellow, green, teal, blue, purple). Instead: one accent colour with opacity steps, plus muted neutrals for comparison series. Add a second colour only when categories genuinely need to be distinguished.')
    out.push('- **Never** use 3D charts, donut charts with shadows, or "exploded" pie slices. Instead: flat bars, lines, areas. Donuts are fine if flat and legend-light.')
    out.push('- **Never** label every gridline. Instead: a few axis ticks, light gridlines (or none), values on hover.')
    out.push('- Sparklines and mini area charts inside KPI cards are good: keep them single-colour, no axes, no legend.')
    out.push('')

    out.push('### Tables and lists')
    out.push('- **Never** use heavy zebra striping, thick borders between every cell, or coloured row backgrounds. Instead: hairline horizontal dividers between rows, no vertical borders, generous row height, hover state = subtle background tint.')
    out.push('- Column headers: small, muted, sentence case. Not ALL CAPS, not bold, not coloured.')
    out.push('- Row actions live in a trailing `…` menu or appear on row hover, not a permanently visible button column.')
    out.push('- IDs, hashes, currency codes, timestamps: monospace. Everything else: the body sans.')
    out.push('')

    out.push('### Status, badges, and chips')
    out.push('- **Never** use bright outlined badges in 6+ colours (red outline, orange outline, blue outline, …). Instead: tinted-background pills: soft fill in the semantic hue + darker text of the same hue. Green = ok/active, amber = pending/warning, red = error/blocked, blue/grey = neutral/info.')
    out.push('- Max 4:5 status colours across the whole app. If you need more states, vary text not colour.')
    out.push('- Status dot pattern (small filled circle + label) is preferred for inline status in lists; pills are for table cells and detail headers.')
    out.push('')

    out.push('### Buttons, inputs, and controls')
    out.push('- **Never** use gradient fills on buttons. Instead: solid accent for primary, neutral surface for secondary, ghost/text for tertiary. One primary button per view.')
    out.push('- **Never** use ALL-CAPS button labels with letter-spacing. Sentence case, verb + noun ("Create invoice", "Add member"). Never "Submit" / "OK" / "Click here".')
    out.push('- Segmented controls (Today / Week / Month / Range) are great for view switchers: flat, pill-shaped, one selected segment in surface tone.')
    out.push('- Inputs: hairline border, no inner shadow, focus = accent border + soft accent ring (no glow).')
    out.push('')

    out.push('### Modals, toasts, and overlays')
    out.push('- **Never** use gradient or transparent toasts. Instead: solid background (text-primary on bg, or bg on text-primary), single line, auto-dismiss.')
    out.push('- **Never** use backdrop blur + gradient on modal backdrops. Instead: a flat dark scrim (~40% opacity black), solid modal surface.')
    out.push('- Modals are small and focused. One title, one paragraph, one or two buttons. No hero illustrations inside modals.')
    out.push('')

    out.push('### Empty states and illustrations')
    out.push('- **Never** use cartoon mascots, 3D illustrations, or AI-generated artwork in empty states. Instead: a single muted line icon, a one-sentence description, and the primary action button. That\'s it.')
    out.push('- **Never** write "Welcome 👋" or "Let\'s get started! 🎉" headers. Instead: state what the area is for ("No invoices yet") and what to do next.')
    out.push('')

    out.push('### Colour and theming')
    out.push('- Pick **one accent colour** plus the four semantic colours (success/warning/error/info). Use the accent for primary CTAs, active nav, and key data points only. Not for every chrome element.')
    out.push('- Dark dashboards: near-black surface (`#0b0b0d`-ish), slightly lighter elevated surface, off-white text. Light dashboards: off-white background, pure white cards optional, near-black text.')
    out.push('- **Never** invert colours for dark mode. Swap tokens.')
    out.push('')

    out.push('### When in doubt')
    out.push('Look at Linear, Notion, Cron, Arc, Height, Stripe Dashboard, Vercel Dashboard, Plaid, Mercury, Ramp: restrained surfaces, dense data, one decisive accent, real type. Look at the inspiration images I uploaded (if any) before reaching for a generic template.', '')
  }

  // ============ DESKTOP APP HOUSE RULES ============
  const isDesktopApp =
    (b.type === 'web-app' || b.type === 'productivity') &&
    Array.isArray(b.surfaces) && b.surfaces.includes('desktop')
  if (isDesktopApp) {
    out.push('---', '')
    out.push('## Desktop app house rules: anti-AI-defaults', '')
    out.push('This is a **native desktop app** (or feels like one). Lean on platform conventions. The reference set is Linear, Things, Cron, Arc, Raycast, Craft, Bear, Notion native, Tower, Loom desktop. Restraint over decoration.', '')

    out.push('### Window chrome and frame')
    out.push('- **Never** paint your own fake traffic-light buttons, custom min/max/close icons, or coloured title bars. Instead: use the OS title bar (or a `hiddenInset`/transparent titlebar with native traffic lights on macOS) and let the platform draw window controls.')
    out.push('- **Never** put a thick coloured app header strip across the top. Instead: blend the toolbar into the title-bar region with the same surface colour as the sidebar; let the window itself feel like one continuous surface.')
    out.push('- **Never** force fullscreen-style hero gradients in a desktop window. Instead: a flat surface with content. Desktop windows are tools, not landing pages.')
    out.push('')

    out.push('### Borders and accent lines (read this twice)')
    out.push('- **Never** draw a hairline border around every panel, card, list row, toolbar, sidebar section, and input. The constant 1px lines everywhere are the tell of an AI-generated desktop app.')
    out.push('- **Never** separate the sidebar from the main content with a visible vertical rule by default. Instead: a subtle background-colour shift (sidebar slightly cooler/darker than main) does the job.')
    out.push('- Use a divider line **only** when whitespace and surface tone genuinely cannot do the job. Single hairline, very low contrast, never on top of another already-tinted surface.')
    out.push('- Inputs, buttons, and chips: prefer **filled flat surfaces** (a small step in tone) over outlined boxes. Borders appear only on focus, hover (very faint), or invalid state.')
    out.push('')

    out.push('### Sidebar and navigation')
    out.push('- **Never** style the sidebar like a website nav (large logo, big section headings, ALL-CAPS group labels, coloured icon tiles). Instead: small monochrome icons + 13px label, generous row height (28-32px), tight letter-spacing, sentence case section headers in a muted tone.')
    out.push('- **Never** highlight the active item with a coloured pill stretching the full row. Instead: a soft-tinted background row (the surface tone bumped up one step) with the icon + label in the primary text colour. Optional 2px accent rule on the leading edge if the brief specifies one accent.')
    out.push('- Group counts, unread dots, badges: tiny, neutral, right-aligned. **Never** bright red filled pills next to every nav item.')
    out.push('- Collapsible sections: use a small chevron, not a heavy button. The whole row is the click target.')
    out.push('')

    out.push('### Surfaces and whitespace')
    out.push('- **Never** stack four or five tinted panels of different greys to "create depth". Native apps have at most two or three surface tones (window, sidebar, elevated panel): pick a clear hierarchy and stick to it.')
    out.push('- **Never** float content cards on a window background (`box-shadow` + rounded card on flat bg). Instead: the panel *is* the background; whitespace and headings carry the structure.')
    out.push('- Generous internal padding. Lists and tables breathe. Resist the urge to fill every pixel.')
    out.push('- Drop shadows are reserved for genuinely floating elements (popovers, command palette, drag previews). Never on inline panels.')
    out.push('')

    out.push('### Type and density')
    out.push('- Default body type: 13px on macOS, 14px on Windows/Linux. **Never** the 16px web-app default: it looks juvenile in a native window.')
    out.push('- Use the platform UI font (system stack: `-apple-system, "SF Pro", "Segoe UI", "Inter Variable"` etc.) unless the brief specifies a custom face. Native apps inherit the user\'s OS feel.')
    out.push('- Type hierarchy: 13px body, 12px secondary, 11px caption, 18-20px section title. **Never** a giant 32px+ heading inside a panel: that\'s a marketing-page move.')
    out.push('- Use `font-feature-settings: "tnum", "ss01"` (or equivalent) for numbers in tables, lists, sidebars.')
    out.push('- Sentence case throughout. **Never** ALL-CAPS group labels with letter-spacing.')
    out.push('')

    out.push('### Toolbars, command palette, shortcuts')
    out.push('- Toolbar buttons: icon-only by default with tooltips, 28-32px hit target, no labels unless the action is rare or destructive. **Never** a row of bright filled accent buttons across the top.')
    out.push('- Every primary action has a keyboard shortcut, shown in the tooltip and menu. Show shortcut hints (`⌘K`, `Ctrl+K`) inline next to menu items and palette entries.')
    out.push('- Ship a command palette (`⌘K` / `Ctrl+K`) for navigation and actions. It should be the fastest way to do anything. Style it like Raycast / Linear: flat list, mono icons, subtle hover highlight, no shadows beyond what the popover surface needs.')
    out.push('- Right-click context menus where they make sense (lists, items, surfaces). Use the OS-native menu look, not a custom-rolled tooltip box.')
    out.push('')

    out.push('### Native feel')
    out.push('- Respect platform conventions: macOS uses sentence case in menus, Windows uses Title Case for top-level menu items, Linux follows GNOME/KDE depending on environment.')
    out.push('- Honour the user\'s OS theme (light/dark/auto) and accent colour where it applies (Windows, macOS Big Sur+).')
    out.push('- Honour `prefers-reduced-motion`. Desktop animations should be **shorter** than web (100-200ms), not longer. Snappy panel transitions, instant context-menu open, no spring bounces.')
    out.push('- Drag-and-drop, multi-select with `⌘`/`Ctrl` and `Shift`, double-click to open, `Enter` to rename, `Esc` to cancel: these are baseline expectations, not features.')
    out.push('- Window state (size, position, sidebar collapsed) is persisted between launches.')
    out.push('')

    out.push('### Colour and accent')
    out.push('- Pick **one** accent colour. Use it for the active nav item edge, primary button, focus ring, link, selected row. Never sprinkle six accent colours through the chrome.')
    out.push('- Status colours (green/amber/red) appear only on actual status indicators: not on icons, not on section headings, not on hover states.')
    out.push('- Backgrounds are near-neutral. A faint warm or cool tint is fine; saturated panel backgrounds are not.')
    out.push('')

    out.push('### When in doubt')
    out.push('Open Linear, Things 3, Cron, Arc, Raycast, Craft, Bear, Notion native, or Tower side-by-side and ask: how many borders are visible right now? How many accent colours? How loud is the chrome? Match that restraint. The user\'s screenshots show the direction; the principle is **whitespace and surface tone do the work: accent lines do not**.', '')
  }

  // ============ SLIDE DECK HOUSE RULES ============
  if (b.type === 'slide-deck') {
    out.push('---', '')
    out.push('## Slide deck house rules: anti-AI-defaults', '')
    out.push('References: original Apple keynote launches, Stripe Sessions, Linear product demos, Lessig style, Edward Tufte, Garr Reynolds (Presentation Zen). Decks are spoken to, not read silently.', '')
    out.push('- **Never** the "agenda → intro → 3 columns → thank you" template. Instead: every slide earns its place; cut anything that doesn\'t advance the argument.')
    out.push('- **Never** five-bullet slides. Instead: **one idea per slide** in big type, or a single chart, or a single image. If you need bullets, you need two slides.')
    out.push('- **Never** clipart, stock business handshakes, or AI-generated "diverse team" hero images. Instead: real product screenshots, real data, real photographs, or pure typography.')
    out.push('- **Never** full-bleed gradients on every slide. Instead: a single neutral surface, accent used twice in the whole deck.')
    out.push('- **Never** a logo + page-number + footer chrome on every slide. Instead: logo on title + closing slide only. Page numbers only if the deck is meant to be navigated as a document.')
    out.push('- **Never** transition animations between slides (cube spin, push, fade-through-black). Instead: hard cut. The story does the work.')
    out.push('- **Never** a "thank you" slide with a giant emoji. Instead: end on the call to action, the contact, or the next step: or just stop.')
    out.push('- **Type is the design.** Use the chosen heading font at 80-120pt for hero slides. Body text minimum 24pt: if it doesn\'t fit, it\'s the wrong slide.')
    out.push('- **Charts:** one insight per chart, no 3D, no shadows, no gradient bars. Strip everything that isn\'t the data.')
    out.push('- **Aspect ratio:** 16:9 unless I specify otherwise. Build to 1920×1080 (or vector / web).')
    out.push('- **Export path:** ship a PDF as the canonical deliverable. The web version is the working copy.')
    out.push('')
  }

  // ============ SOCIAL POST HOUSE RULES ============
  if (b.type === 'social-post') {
    out.push('---', '')
    out.push('## Social post house rules: anti-AI-defaults', '')
    out.push('References: Read.cv, Are.na profiles, Pentagram social, Linear and Vercel announcement cards. The bar is: stop the scroll without shouting.', '')
    out.push('- **Never** use the AI-default emoji-stuffed copy ("🚀 Excited to announce... 🎉"). Instead: one declarative sentence, real punctuation, no emoji unless the brand is built on them.')
    out.push('- **Never** a busy multi-card carousel as the default. Instead: think of carousels as a story with 3-5 beats; each card must work standalone.')
    out.push('- **Never** centre-aligned five-line walls of text on a gradient. Instead: type-driven layout, two type sizes max per card, generous margin from the safe zone.')
    out.push('- **Never** small low-contrast captions in the bottom corner. Instead: if the text matters, make it big. If it doesn\'t, drop it.')
    out.push('- **Safe zones:**')
    out.push('  - LinkedIn single image: 1200×1200 or 1200×627. Keep text 60px from each edge: feed crops aggressively on mobile.')
    out.push('  - Instagram square: 1080×1080. Stories / Reels cover: 1080×1920, keep text 200px from top and 250px from bottom (UI overlay).')
    out.push('  - X / Twitter card: 1200×675. Keep text away from the bottom 100px (engagement bar).')
    out.push('  - Threads: same as X.')
    out.push('- **Brand presence:** small logo or wordmark in one corner only. Never a giant logo as the focal element.')
    out.push('- **Export:** flat PNG at the chosen size, sRGB, ≤ 1MB per image. Provide both light and dark variants if the brand has both.')
    out.push('')
  }

  // ============ POSTER HOUSE RULES ============
  if (b.type === 'poster') {
    out.push('---', '')
    out.push('## Poster house rules: anti-AI-defaults', '')
    out.push('References: Massimo Vignelli, Müller-Brockmann, Experimental Jetset, Wim Crouwel, Stefan Sagmeister. Swiss/grid roots: type-as-art, generous whitespace, one idea.', '')
    out.push('- **Never** a four-quadrant "feature grid" poster. Instead: **one dominant element** (a piece of type, a single image, a single shape) carrying the whole composition.')
    out.push('- **Never** gradient backgrounds. Instead: solid colour or solid white. The hierarchy is the design.')
    out.push('- **Never** AI-generated illustration as filler. Instead: real photograph, vector mark, or pure typography.')
    out.push('- **Hierarchy at three levels max:** the headline reads from across the room; the supporting line reads from arm\'s length; the metadata reads up close. No fourth level.')
    out.push('- **Real margins.** Minimum 5% of the shorter dimension on every side. Resist the urge to fill it.')
    out.push('- **Print-safe:** CMYK colour mode if going to press, 300 DPI, 3mm bleed on every edge, crop marks on the print export.')
    out.push('- **Type:** prefer the chosen display face at very large sizes. Avoid stretching, condensing, or outlining text.')
    out.push('- **Format:** A2 (420×594mm) by default unless I specify otherwise. Provide both screen (RGB, 72 DPI PNG) and print (CMYK, 300 DPI PDF with bleed) exports.')
    out.push('')
  }

  // ============ BROCHURE HOUSE RULES ============
  if (b.type === 'brochure') {
    out.push('---', '')
    out.push('## Brochure house rules: anti-AI-defaults', '')
    out.push('References: Hermès print, Aesop, MoMA exhibition brochures, Apple\'s pre-2010 product pamphlets. A brochure is held in two hands and folded.', '')
    out.push('- **Never** pretend the panels are a webpage. Instead: each panel is a discrete spread. Plan content panel by panel and never let an image or paragraph straddle a fold.')
    out.push('- **Never** edge-to-edge text. Instead: outer margin minimum 8mm, inner (gutter) margin 12mm. Body type comfortable at arm\'s length.')
    out.push('- **Never** five colours and three accents. Instead: one ink colour + one accent + the paper.')
    out.push('- **Cover panel** carries the strongest image and the title. **Back panel** carries the call to action, contact, address, social.')
    out.push('- **Body type** at 9-11pt minimum on coated stock; 11-12pt on uncoated. Line-height 1.4-1.5.')
    out.push('- **Print-safe:** CMYK, 300 DPI, 3mm bleed, crop marks. Provide a flat PDF with marks for the press *and* a screen-friendly PDF without marks for review.')
    out.push('- **Folds annotated:** include a thin guide layer in the export showing fold lines (hidden in the print PDF).')
    out.push('')
  }

  // ============ ONE-PAGER PDF HOUSE RULES ============
  if (b.type === 'one-pager') {
    out.push('---', '')
    out.push('## One-pager PDF house rules: anti-AI-defaults', '')
    out.push('References: Stripe Atlas guides, YC investor one-pagers, Charity Navigator profiles, Pew Research factsheets. A one-pager is the document that gets forwarded.', '')
    out.push('- **Never** treat it like a marketing landing page (giant hero, big CTA button, screenshot collage). Instead: information density, scannable structure, real type: like a well-designed magazine page.')
    out.push('- **Never** decorative dividers, abstract shapes, or stock illustration. Instead: the type and grid carry the structure.')
    out.push('- **Never** a single column of text from edge to edge. Instead: 2 or 3 columns at this density; eye travels naturally.')
    out.push('- **Top of page:** the headline (what this is) + one-sentence subhead. **Body:** scannable sections with strong sub-heads. **Bottom:** sources, contact, date, version.')
    out.push('- **Real numbers, real sources.** If you cite a stat, cite the source inline (small) or in a footnote row at the bottom. No invented stats.')
    out.push('- **Print-safe** (people print these): A4 or US Letter, 12mm margins minimum, body 9-10pt, line-height 1.35-1.4.')
    out.push('- **Export:** PDF with embedded fonts, hyperlinks live, accessible (tagged PDF if the stack supports it).')
    out.push('')
  }

  // ============ RESUME / CV HOUSE RULES ============
  if (b.type === 'resume') {
    out.push('---', '')
    out.push('## Resume / CV house rules: anti-AI-defaults', '')
    out.push('References: Read.cv profiles, Stripe Press author pages, classic Bringhurst-style CVs. A résumé is scanned by a human in 7 seconds and parsed by an ATS in 0.7 seconds.', '')
    out.push('- **Never** "skills bars" with percentage fills. **Never** radial charts of "JavaScript: 85%". Instead: name the skill plainly. The reader is a professional, not a marketing dashboard.')
    out.push('- **Never** images of text (logos as company name, hand-drawn headers). Instead: real, selectable, ATS-readable text.')
    out.push('- **Never** a photo unless I explicitly request one (and even then: country and industry-dependent: most US/UK applications expect no photo).')
    out.push('- **Never** colourful icon next to every bullet. Instead: a single accent colour used at most twice (name and section headers).')
    out.push('- **Single-column** unless I picked a two-column variant. Even then: contact + skills sidebar, narrative on the right: no four-column "infographic" layouts.')
    out.push('- **Hierarchy:** name (largest) → role title (medium) → company + dates (small, italic or muted) → bullets (body). Maximum three type sizes.')
    out.push('- **Bullets:** action verb first, quantified outcome where possible. Past tense for past roles.')
    out.push('- **Real type, real margins.** Body 10-11pt, line-height 1.35, 18mm minimum margins.')
    out.push('- **Page count:** one page for under 10 years experience, two for more. Never three.')
    out.push('- **Export:** PDF with embedded fonts, plus a `.txt` plain-text export so ATS systems parse it cleanly.')
    out.push('')
  }

  // ============ HOW TO WORK WITH ME ============
  out.push('---', '')
  out.push('## How to work with me', '')
  out.push('- **No surprises.** Non-trivial decisions (folder structure, deps, naming, file splits) get raised before they happen.')
  out.push('- **Small commits, clear diffs.** Many small changes beat one giant scaffold dump.')
  out.push('- **Semantic HTML and accessible defaults from day one.** WCAG AA, visible keyboard focus, real `<button>` and `<a>`, never `<div onClick>`.')
  out.push('- **Tokens are the law.** Reference design tokens. Never inline raw values inside a component.')
  out.push('- **No filler.** No lorem ipsum, no fake testimonials, no AI emoji feature grids. Use `[Headline goes here]` placeholders until I provide real copy.')
  out.push('- **Honest progress.** Stubbed or half-done? Say so out loud.')
  out.push('')

  // ============ WHAT TO DO RIGHT NOW ============
  out.push('## What to do right now', '')
  if (b.scaffold) {
    out.push("1. **Confirm you read this** in one short paragraph. Mention the type, audience, mood, and primary color so I know it landed.")
    out.push('2. **Propose** a folder structure and the first files you\'d create as a tree with one-line purpose per file. Don\'t write code yet.')
    out.push('3. **Wait for my approval.** Once I say go, scaffold:')
    out.push('   - The folder layout for the chosen stack')
    out.push('   - `tokens.css` (or equivalent) with the literal values from the Design system section')
    out.push('   - A `README.md` capturing this brief in human-readable form')
    out.push('   - A minimal app shell that visibly demonstrates the chosen mood (one screen is enough)')
    out.push('4. Run the build / typecheck. If the project has a dev server, start it in the background, hit the URL, confirm it serves a 200, then kill it. Say PASS, or paste the failure. Do not list features you built. Do not say "npm run dev to try it" or "your app is at /". I will look at the diff myself.')
  } else {
    out.push("1. **Confirm you read this** in one short paragraph. Mention the type, audience, mood, and primary color so I know it landed.")
    out.push("2. **Ask me up to three sharp clarifying questions**: only the ones that would meaningfully change how you build the first feature. Skip questions whose answers are already above.")
    out.push("3. **Then wait** for my first concrete ask.")
  }
  out.push('')
  out.push("Don't write code, run commands, or edit files until I respond to step 1.")

  return out.join('\n')
}

export type WizardState = Omit<Partial<ProjectBrief>, 'type'> & { type: ProjectTypeId | null }

export function emptyWizard(): WizardState {
  return {
    type: null,
    theme: 'auto',
    look: [],
    surfaces: [],
    scaffold: false,
    radius: 'medium',
    shadow: 'subtle',
    outline: 'subtle',
    inspirationImages: []
  }
}
