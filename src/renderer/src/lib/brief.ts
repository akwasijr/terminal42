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


// Prompt-building functions — stripped for public release.
// Implement your own kickoff prompt builder here.

export type KickoffOptions = {
  figmaTarget?: boolean
  useFigma?: boolean
  starterTemplate?: string | null
}

export function buildKickoffPrompt(b: ProjectBrief, opts: KickoffOptions = {}): string {
  // Build your own design prompt from the brief here.
  const parts: string[] = []
  if (b.idea) parts.push(b.idea)
  if (b.kindLabel) parts.push(`Type: ${b.kindLabel}`)
  if (b.lookLabel) parts.push(`Look: ${b.lookLabel}`)
  if (b.audience) parts.push(`Audience: ${b.audience}`)
  return parts.join('\n')
}

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
