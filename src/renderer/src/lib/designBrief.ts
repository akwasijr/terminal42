// Design wizard option lists, types, helpers.
// Mirrors src/lib/brief.ts in spirit but design-specific.

export type DesignKind =
  // Web: public-facing
  | 'website' | 'landing' | 'email'
  // App: signed-in product UI
  | 'app' | 'dashboard' | 'component-library'
  // Presentation
  | 'pitch-deck' | 'talk-slides' | 'sales-deck' | 'workshop-deck'
  // Content
  | 'blog-post' | 'resume' | 'one-pager' | 'brochure' | 'case-study'
  // Print
  | 'poster' | 'flyer' | 'invitation' | 'business-card' | 'certificate'
  // Data
  | 'infographic' | 'report' | 'chart'
  // Social
  | 'social-post' | 'social-story' | 'cover-image' | 'ad-banner'
  // Figma / design
  | 'design-system' | 'wireframe' | 'mood-board' | 'style-tile' | 'user-flow' | 'sitemap'
  // Other
  | 'blank'
  // Deprecated kinds: kept in the union so old briefs in the DB still parse.
  // They never appear in DESIGN_KINDS so the wizard won't surface them.
  | 'app-screen' | 'pricing' | 'login' | 'hero' | 'component'

export type DesignGroup = 'web' | 'app' | 'presentation' | 'content' | 'print' | 'data' | 'social' | 'figma' | 'other'

export type DesignKindDef = {
  id: DesignKind
  label: string
  group: DesignGroup
  // Page gating: undefined means "use the default for this concept", which
  // is conservative (most pages OFF). Set true to surface, false to force off.
  hasSurfaces?: boolean       // mobile / tablet / desktop choice
  hasMotion?: boolean         // animation / transitions choice
  hasTheme?: boolean          // light/dark/auto choice: only digital UI
  hasDensity?: boolean        // density choice (compact/comfortable/spacious): for content-heavy decks/articles
  hasSpacing?: boolean        // precision spacing scale + grid choice: for apps, dashboards, design-system, figma kinds
  hasAudience?: boolean       // who's it for (defaults to true)
  hasLook?: boolean           // look & feel: defaults to true
  hasPalette?: boolean        // brand palette: defaults to true
  hasFonts?: boolean          // typography pair: defaults to true
  hasIcons?: boolean          // icon library + style: defaults to true on most kinds
  hasFidelity?: boolean       // wireframe vs polished: only meaningful for UI / layouts
  hasStack?: boolean          // pick a tech stack (React, Vue, plain HTML…): web/app/figma kinds
  hasShape?: boolean          // shape language (radius, shadow, borders): visual UI kinds
  fixedFidelity?: 'wireframe' | 'highfidelity' // some kinds are intrinsically one or the other
  subtypes?: string[]
  /** When true, the subtype question accepts multiple selections and stores them
   *  as a comma-joined string. Useful for kinds like app-screen / login / design-
   *  system / wireframe / component / email where users typically want several. */
  multiSubtype?: boolean
  /** Per-kind label override for the subtype page heading. Defaults to "What kind exactly?". */
  subtypeLabel?: string
}

// Defaults applied when the per-kind flag is undefined.
const DEFAULT_HAS = {
  hasLook: true,
  hasAudience: true,
  hasPalette: true,
  hasFonts: true,
  hasIcons: true,
  hasFidelity: false,  // Fidelity is OFF by default: only kinds where
                       // wireframe-vs-polished is a real choice opt in.
  hasStack: false,     // Stack is OFF by default: only web/app/figma kinds opt in.
  hasShape: true       // Shape language applies to most visual designs.
}

export function flag(def: DesignKindDef, key: keyof typeof DEFAULT_HAS): boolean {
  const v = def[key as keyof DesignKindDef]
  if (typeof v === 'boolean') return v
  return DEFAULT_HAS[key]
}

export const DESIGN_KINDS: DesignKindDef[] = [
  // ─── Web: public-facing site / marketing ───────────────────────────────
  // Whole-experience kinds: a Website is multiple sections in one page (or
  // a small set of pages); a Landing page is a single page when that's all
  // you need; Email is its own beast.
  { id: 'website',  label: 'Website',      group: 'web',
    hasSurfaces: true, hasMotion: true, hasTheme: true, hasStack: true },
  { id: 'landing',  label: 'Landing page', group: 'web',
    hasSurfaces: true, hasMotion: true, hasTheme: true, hasStack: true },
  { id: 'email',    label: 'Email',        group: 'web',
    // Email body: fixed 600px width, no JS, no density/motion/fidelity/icons.
    hasIcons: false },

  // ─── App: signed-in product UI (whole experiences) ─────────────────────
  // App = full product flow on one canvas (nav + key screens + states).
  // Dashboard = single primary view. Component library = all variants.
  { id: 'app',                label: 'App',                group: 'app',
    hasSurfaces: true, hasMotion: true, hasTheme: true, hasSpacing: true, hasStack: true },
  { id: 'dashboard',          label: 'Dashboard',          group: 'app',
    hasSurfaces: true, hasMotion: true, hasTheme: true, hasSpacing: true, hasStack: true },
  { id: 'component-library',  label: 'Component library',  group: 'app',
    // Component sets: variants/states matter; look/audience aren't a vibe
    // choice (they belong to the parent design system).
    hasTheme: true, hasSpacing: true, hasMotion: true, hasStack: true,
    hasLook: false },

  // ─── Presentation: single-composition slides ───────────────────────────
  // Always polished. No surface (slides are 16:9). No theme (decks pick
  // their own scheme). No density. Look + palette + fonts + audience all
  // matter (deck for investors vs deck for a workshop is very different).
  // Icons are optional on slides, leave on.
  { id: 'pitch-deck',     label: 'Pitch deck',     group: 'presentation' },
  { id: 'talk-slides',    label: 'Talk slides',    group: 'presentation' },
  { id: 'sales-deck',     label: 'Sales deck',     group: 'presentation' },
  { id: 'workshop-deck',  label: 'Workshop deck',  group: 'presentation' },

  // ─── Content: long-form documents ──────────────────────────────────────
  { id: 'blog-post',  label: 'Blog post',  group: 'content',
    // Article: theme matters, icons usually not used in article body.
    hasTheme: true, hasIcons: false },
  { id: 'case-study', label: 'Case study', group: 'content',
    hasTheme: true },
  { id: 'resume',     label: 'Resume',     group: 'content',
    // Always polished: no fidelity/audience choice. Look is strong axis.
    hasAudience: false },
  { id: 'one-pager',  label: 'One-pager',  group: 'content' },
  { id: 'brochure',   label: 'Brochure',   group: 'content' },

  // ─── Print / event: paper artboards ────────────────────────────────────
  { id: 'poster',         label: 'Poster',         group: 'print',
    hasIcons: false },
  { id: 'flyer',          label: 'Flyer',          group: 'print' },
  { id: 'invitation',     label: 'Invitation',     group: 'print',
    // Always finished art. Audience doesn't apply (it's for the recipient).
    hasAudience: false, hasIcons: false },
  { id: 'business-card',  label: 'Business card',  group: 'print',
    // Template-driven: no look/font choice (paired with the card style).
    hasAudience: false, hasLook: false, hasFonts: false, hasIcons: false },
  { id: 'certificate',    label: 'Certificate',    group: 'print',
    hasAudience: false, hasIcons: false },

  // ─── Data: visualisation. Theme/motion/density not meaningful ──────────
  { id: 'infographic', label: 'Infographic',  group: 'data',
    // Audience matters (technical vs general). Font choice is structural.
    hasFonts: false },
  { id: 'report',      label: 'Annual report', group: 'data' },
  { id: 'chart',       label: 'Chart',        group: 'data',
    // A chart is its own style world: no look/audience/font/icon choice.
    hasAudience: false, hasLook: false, hasFonts: false, hasIcons: false, hasShape: false },

  // ─── Social: single tile / banner. No theme/density/motion ─────────────
  { id: 'social-post',  label: 'Social post',   group: 'social' },
  { id: 'social-story', label: 'Story',         group: 'social' },
  { id: 'cover-image',  label: 'Cover image',   group: 'social',
    // Cover banner: no audience question, it's for the channel's followers.
    hasAudience: false },
  { id: 'ad-banner',    label: 'Ad banner',     group: 'social' },

  // ─── Figma / design: design-system & UX-research deliverables ──────────
  // These are the kinds you'd typically build in Figma (not "another website").
  { id: 'design-system',     label: 'Design system',     group: 'figma',
    hasTheme: true, hasSpacing: true, hasStack: true,
    subtypes: ['Foundations', 'Components', 'Patterns', 'Brand'] },
  // 'component-library' lives in the App group above (whole component set
  // for an app), not here: Figma group covers UX-research deliverables.
  { id: 'wireframe',         label: 'Wireframe',         group: 'figma',
    // Wireframe = grayscale + boxes: no look/audience/palette/fonts/icon question.
    hasSurfaces: true, hasFonts: false, hasPalette: false, hasLook: false, hasAudience: false, hasIcons: false, hasShape: false,
    fixedFidelity: 'wireframe',
    subtypes: ['Landing', 'App screen', 'Dashboard', 'Mobile flow'] },
  { id: 'mood-board',        label: 'Mood board',        group: 'figma',
    // The mood board IS the look: no separate look/font question.
    hasFonts: false, hasLook: false, hasIcons: false, hasShape: false },
  { id: 'style-tile',        label: 'Style tile',        group: 'figma',
    hasTheme: true },
  { id: 'user-flow',         label: 'User flow',         group: 'figma',
    // Boxes + arrows: no look/audience/palette/font/icon question.
    hasFonts: false, hasPalette: false, hasLook: false, hasAudience: false, hasIcons: false, hasShape: false },
  { id: 'sitemap',           label: 'Sitemap',           group: 'figma',
    hasFonts: false, hasPalette: false, hasLook: false, hasAudience: false, hasIcons: false, hasShape: false },

  // ─── Other ──────────────────────────────────────────────────────────────
  { id: 'blank', label: 'Blank canvas', group: 'other',
    hasLook: false, hasAudience: false, hasPalette: false, hasFonts: false, hasIcons: false, hasShape: false }
]

export const GROUP_LABELS: Record<DesignGroup, string> = {
  web: 'Web',
  app: 'App',
  presentation: 'Presentation',
  content: 'Content',
  print: 'Print & event',
  data: 'Data',
  social: 'Social',
  figma: 'Design system',
  other: 'Other'
}

// ─── Look & feel ────────────────────────────────────────────────────────────

export type LookId =
  | 'minimal' | 'bold' | 'playful' | 'editorial' | 'brutalist' | 'luxe' | 'friendly'
  | 'retro' | 'futuristic' | 'modern' | 'organic' | 'technical' | 'monochrome' | 'hand-drawn'

export const LOOK_OPTIONS: Array<{ id: LookId; label: string; hint: string }> = [
  { id: 'minimal',    label: 'Minimal',    hint: 'Lots of whitespace, restrained' },
  { id: 'bold',       label: 'Bold',       hint: 'Big type, strong contrast' },
  { id: 'modern',     label: 'Modern',     hint: 'Crisp, geometric, current' },
  { id: 'editorial',  label: 'Editorial',  hint: 'Magazine-like, type driven' },
  { id: 'playful',    label: 'Playful',    hint: 'Rounded, color rich, friendly' },
  { id: 'friendly',   label: 'Friendly',   hint: 'Warm, approachable' },
  { id: 'luxe',       label: 'Luxe',       hint: 'Generous spacing, fine type' },
  { id: 'brutalist',  label: 'Brutalist',  hint: 'Stark, raw, opinionated' },
  { id: 'organic',    label: 'Organic',    hint: 'Soft shapes, natural feel' },
  { id: 'technical',  label: 'Technical',  hint: 'Engineering, mono, grids' },
  { id: 'monochrome', label: 'Monochrome', hint: 'Black, white and one accent' },
  { id: 'retro',      label: 'Retro',      hint: '70s / 80s / 90s vibe' },
  { id: 'futuristic', label: 'Futuristic', hint: 'Glassy, neon, sci-fi' },
  { id: 'hand-drawn', label: 'Hand-drawn', hint: 'Sketchy, imperfect, human' }
]

// Established design systems the user can plug into. When picked, the model
// is told to follow that system's component anatomy, spacing, type scale and
// motion conventions, overriding the wizard's individual look/shape/density
// answers. List intentionally curated to ones with strong public docs.
export const DESIGN_SYSTEMS: Array<{ id: string; label: string; hint: string }> = [
  { id: 'material-3',   label: 'Material 3 · Google',                 hint: 'Android & web' },
  { id: 'apple-hig',    label: 'Apple HIG · Apple',                   hint: 'iOS, macOS conventions' },
  { id: 'fluent-2',     label: 'Fluent 2 · Microsoft',                hint: 'Web & native, M365' },
  { id: 'carbon',       label: 'Carbon · IBM',                        hint: 'Enterprise system' },
  { id: 'spectrum',     label: 'Spectrum · Adobe',                    hint: 'Creative tools' },
  { id: 'polaris',      label: 'Polaris · Shopify',                   hint: 'Admin & merchant UI' },
  { id: 'primer',       label: 'Primer · GitHub',                     hint: 'GitHub product UI' },
  { id: 'atlassian',    label: 'Atlassian Design · Atlassian',        hint: 'Jira, Confluence' },
  { id: 'lightning',    label: 'Lightning · Salesforce',              hint: 'CRM, dense data' },
  { id: 'base-web',     label: 'Base Web · Uber',                     hint: 'React, themable' },
  { id: 'pajamas',      label: 'Pajamas · GitLab',                    hint: 'GitLab product UI' },
  { id: 'evergreen',    label: 'Evergreen · Segment',                 hint: 'React, business apps' },
  { id: 'garden',       label: 'Garden · Zendesk',                    hint: 'Support tools' },
  { id: 'canvas',       label: 'Canvas · Workday',                    hint: 'HR/Finance enterprise' },
  { id: 'forge',        label: 'Paste · Twilio',                      hint: 'Comms platform' },
  { id: 'helios',       label: 'Helios · HashiCorp',                  hint: 'DevOps tools' },
  { id: 'geist',        label: 'Geist · Vercel',                      hint: 'Modern, mono-led' },
  { id: 'backpack',     label: 'Backpack · Skyscanner',               hint: 'Travel, motion-rich' },
  { id: 'nord',         label: 'Nord · Trivago',                      hint: 'Travel, data dense' },
  { id: 'orbit',        label: 'Orbit · Kiwi.com',                    hint: 'Travel booking' },
  { id: 'lexicon',      label: 'Lexicon · Liferay',                   hint: 'Enterprise portal' },
  { id: 'photon',       label: 'Photon · Mozilla',                    hint: 'Firefox UI' },
  { id: 'gel',          label: 'GEL · BBC',                           hint: 'Editorial, accessible' },
  { id: 'uswds',        label: 'USWDS · U.S. Government',             hint: 'Civic, accessible' },
  { id: 'gov-uk',       label: 'GOV.UK Design System · UK Government', hint: 'Plain, accessible' },
  { id: 'ant-design',   label: 'Ant Design · Ant Group',              hint: 'Dense data UIs' },
  { id: 'arco',         label: 'Arco Design · ByteDance',             hint: 'Enterprise React' },
  { id: 'shadcn',       label: 'shadcn/ui · shadcn',                  hint: 'Radix + Tailwind' },
  { id: 'tailwind-ui',  label: 'Tailwind UI · Tailwind Labs',         hint: 'Marketing & app' },
  { id: 'radix',        label: 'Radix UI · WorkOS',                   hint: 'Unstyled primitives' },
  { id: 'chakra',       label: 'Chakra UI · Chakra',                  hint: 'Accessible primitives' },
  { id: 'mantine',      label: 'Mantine · Mantine',                   hint: 'Hooks-first React' },
  { id: 'park-ui',      label: 'Park UI · Cschroeter',                hint: 'Ark + Panda CSS' },
  { id: 'nextui',       label: 'NextUI · NextUI',                     hint: 'React + Tailwind' },
  { id: 'mui',          label: 'MUI · MUI',                           hint: 'Material in React' },
  { id: 'bootstrap',    label: 'Bootstrap 5 · Bootstrap Team',        hint: 'Classic CSS framework' },
  { id: 'bulma',        label: 'Bulma · Jeremy Thomas',               hint: 'Flexbox-based CSS' },
  { id: 'audi',         label: 'Audi UI · Audi',                      hint: 'Premium automotive' },
  { id: 'salt',         label: 'Salt · JPMorgan',                     hint: 'Financial enterprise' }
]



// ─── Tech stack ─────────────────────────────────────────────────────────────
// Engineering scaffold the design will be built in. Drives import stubs, file
// structure and the "library this should fit into" mental model. Mostly
// relevant for web/app/figma kinds; not surfaced for print/social/content.

export type StackId =
  | 'plain' | 'react-tailwind' | 'react-css' | 'next-tailwind'
  | 'vue-tailwind' | 'svelte' | 'astro' | 'flutter' | 'swiftui'

export const STACK_OPTIONS: Array<{ id: StackId; label: string; hint: string }> = [
  { id: 'plain',           label: 'Plain HTML/CSS',  hint: 'No framework, hand-written' },
  { id: 'react-tailwind',  label: 'React + Tailwind',hint: 'Components + utility classes' },
  { id: 'react-css',       label: 'React + CSS',     hint: 'CSS Modules / styled-components' },
  { id: 'next-tailwind',   label: 'Next.js',         hint: 'App Router + Tailwind' },
  { id: 'vue-tailwind',    label: 'Vue + Tailwind',  hint: 'Single-file components' },
  { id: 'svelte',          label: 'Svelte',          hint: 'SvelteKit, scoped styles' },
  { id: 'astro',           label: 'Astro',           hint: 'Content-first, islands' },
  { id: 'flutter',         label: 'Flutter',         hint: 'Cross-platform widgets' },
  { id: 'swiftui',         label: 'SwiftUI',         hint: 'Native iOS / macOS' }
]

// ─── Shape language ─────────────────────────────────────────────────────────
// The geometric DNA of the design: how round corners are, how heavy shadows
// fall, how borders read. Overridable by a chosen design system but useful
// when the user has an opinion (or the design system slot is empty).

export type RadiusId = 'sharp' | 'soft' | 'rounded' | 'pill'
export type ShadowId = 'none'  | 'subtle' | 'medium' | 'strong'
export type BorderId = 'none'  | 'thin'   | 'standard' | 'strong'
export type SurfaceShapeId = 'filled' | 'outlined' | 'glass' | 'neumorphic' | 'gradient'
export type SecondaryButtonId =
  | 'outlined'
  | 'ghost'
  | 'soft'
  | 'neutral'
  | 'accent'
  | 'underline'
  | 'same-as-primary'

export const RADIUS_OPTIONS: Array<{ id: RadiusId; label: string; hint: string }> = [
  { id: 'sharp',   label: 'Sharp',   hint: '0px corners, hard edges' },
  { id: 'soft',    label: 'Soft',    hint: '4px, gently rounded' },
  { id: 'rounded', label: 'Rounded', hint: '12px, friendly' },
  { id: 'pill',    label: 'Pill',    hint: 'Fully rounded buttons' }
]

export const SHADOW_OPTIONS: Array<{ id: ShadowId; label: string; hint: string }> = [
  { id: 'none',   label: 'None',   hint: 'Flat, no elevation' },
  { id: 'subtle', label: 'Subtle', hint: 'Tiny lift, barely there' },
  { id: 'medium', label: 'Medium', hint: 'Cards float clearly' },
  { id: 'strong', label: 'Strong', hint: 'Pronounced depth, dramatic' }
]

export const BORDER_OPTIONS: Array<{ id: BorderId; label: string; hint: string }> = [
  { id: 'none',     label: 'None',     hint: 'Surfaces only, no strokes' },
  { id: 'thin',     label: 'Thin',     hint: '1px hairlines' },
  { id: 'standard', label: 'Standard', hint: '1.5px, visible structure' },
  { id: 'strong',   label: 'Strong',   hint: '2-3px, brutalist outlines' }
]

export const SURFACE_SHAPE_OPTIONS: Array<{ id: SurfaceShapeId; label: string; hint: string }> = [
  { id: 'filled',     label: 'Filled',     hint: 'Solid background fills' },
  { id: 'outlined',   label: 'Outlined',   hint: 'Transparent fills, stroke only' },
  { id: 'glass',      label: 'Glass',      hint: 'Translucent with backdrop blur' },
  { id: 'neumorphic', label: 'Soft / neumorphic', hint: 'Recessed, soft inner shadows' },
  { id: 'gradient',   label: 'Gradient',   hint: 'Subtle gradients on surfaces' }
]

export const SECONDARY_BUTTON_OPTIONS: Array<{ id: SecondaryButtonId; label: string; hint: string }> = [
  { id: 'outlined',        label: 'Outlined',         hint: 'Transparent fill, 1-1.5px border in primary color, primary color text' },
  { id: 'ghost',           label: 'Ghost (text only)', hint: 'No fill, no border, just colored text — hover gets a subtle bg tint' },
  { id: 'soft',            label: 'Soft / tinted',    hint: 'Light tint of the primary color as fill, primary color text, no border' },
  { id: 'neutral',         label: 'Neutral filled',   hint: 'Surface gray fill, primary text color, no border (Material-style "tonal")' },
  { id: 'accent',          label: 'Accent color',     hint: 'Filled with the secondary/accent brand color, white text' },
  { id: 'underline',       label: 'Underlined link',  hint: 'Inline text-style with an underline — minimal, editorial' },
  { id: 'same-as-primary', label: 'Same as primary (no distinction)', hint: 'Treat secondary actions identically to primary (rare; use only if intentional)' }
]

// ─── Audience ───────────────────────────────────────────────────────────────

export const AUDIENCE_OPTIONS = [
  'Just me', 'Consumers', 'Developers', 'Designers', 'Businesses',
  'Investors', 'Internal team', 'Open source community'
]

// ─── Palettes ───────────────────────────────────────────────────────────────

export type Palette = {
  id: string
  label: string
  /** Family for prompt context: single-hue / complementary / analogous / triadic / neutral. */
  scheme: 'neutral' | 'monochromatic' | 'analogous' | 'complementary' | 'triadic' | 'split-complementary'
  /** Always 4 colors in this exact order: ink (deepest), brand (primary action), accent (highlight), paper (page bg). */
  colors: [string, string, string, string]
}
// 24 palettes built from real colour-theory relationships rather than random
// hex picks. Every palette follows the same 4-step ladder so the wizard can
// safely map: ink → text/heading, brand → primary action, accent → highlight,
// paper → page background. Within each palette the brand and accent are
// chosen for adequate WCAG contrast against paper.
export const PALETTES: Palette[] = [
  // ── Neutral foundations ─────────────────────────────────────────────────
  { id: 'monochrome',   label: 'Monochrome',    scheme: 'neutral',         colors: ['#0a0a0a', '#404040', '#a3a3a3', '#fafafa'] },
  { id: 'paper',        label: 'Paper',         scheme: 'neutral',         colors: ['#1c1917', '#57534e', '#d6d3d1', '#fafaf9'] },
  { id: 'slate',        label: 'Slate',         scheme: 'neutral',         colors: ['#0f172a', '#475569', '#cbd5e1', '#f8fafc'] },

  // ── Single-hue (monochromatic): cool ───────────────────────────────────
  { id: 'indigo',       label: 'Indigo',        scheme: 'monochromatic',   colors: ['#1e1b4b', '#4f46e5', '#a5b4fc', '#eef2ff'] },
  { id: 'cobalt',       label: 'Cobalt',        scheme: 'monochromatic',   colors: ['#172554', '#2563eb', '#93c5fd', '#eff6ff'] },
  { id: 'ocean',        label: 'Ocean',         scheme: 'monochromatic',   colors: ['#0c4a6e', '#0284c7', '#7dd3fc', '#f0f9ff'] },
  { id: 'arctic',       label: 'Arctic',        scheme: 'monochromatic',   colors: ['#164e63', '#06b6d4', '#a5f3fc', '#ecfeff'] },

  // ── Single-hue (monochromatic): green ──────────────────────────────────
  { id: 'forest',       label: 'Forest',        scheme: 'monochromatic',   colors: ['#14532d', '#16a34a', '#bbf7d0', '#f0fdf4'] },
  { id: 'mint',         label: 'Mint',          scheme: 'monochromatic',   colors: ['#064e3b', '#10b981', '#a7f3d0', '#ecfdf5'] },
  { id: 'olive',        label: 'Olive',         scheme: 'monochromatic',   colors: ['#3f3f0c', '#84a13b', '#d9e0a3', '#f7f9ec'] },

  // ── Single-hue (monochromatic): warm ───────────────────────────────────
  { id: 'amber',        label: 'Amber',         scheme: 'monochromatic',   colors: ['#78350f', '#d97706', '#fcd34d', '#fffbeb'] },
  { id: 'terracotta',   label: 'Terracotta',    scheme: 'monochromatic',   colors: ['#3f1d10', '#c2410c', '#fdba74', '#fff7ed'] },
  { id: 'wine',         label: 'Wine',          scheme: 'monochromatic',   colors: ['#450a0a', '#9f1239', '#fda4af', '#fef2f2'] },
  { id: 'rose',         label: 'Rose',          scheme: 'monochromatic',   colors: ['#831843', '#e11d48', '#fbcfe8', '#fff1f2'] },

  // ── Single-hue (monochromatic): purple ─────────────────────────────────
  { id: 'plum',         label: 'Plum',          scheme: 'monochromatic',   colors: ['#3b0764', '#7c3aed', '#c4b5fd', '#faf5ff'] },
  { id: 'lavender',     label: 'Lavender',      scheme: 'monochromatic',   colors: ['#312e81', '#8b5cf6', '#ddd6fe', '#f5f3ff'] },
  { id: 'magenta',      label: 'Magenta',       scheme: 'monochromatic',   colors: ['#581c87', '#c026d3', '#f0abfc', '#fdf4ff'] },

  // ── Analogous (3 neighbouring hues + paper) ─────────────────────────────
  { id: 'sunset',       label: 'Sunset',        scheme: 'analogous',       colors: ['#7c2d12', '#f97316', '#fbbf24', '#fff7ed'] }, // red→orange→yellow
  { id: 'meadow',       label: 'Meadow',        scheme: 'analogous',       colors: ['#365314', '#65a30d', '#d9f99d', '#f7fee7'] }, // green→lime→light
  { id: 'tide',         label: 'Tide',          scheme: 'analogous',       colors: ['#134e4a', '#14b8a6', '#67e8f9', '#ecfeff'] }, // teal→cyan

  // ── Complementary (opposite hues: high contrast pairings) ──────────────
  { id: 'editorial',    label: 'Editorial',     scheme: 'complementary',   colors: ['#0f172a', '#2563eb', '#f59e0b', '#fafaf9'] }, // blue ↔ amber
  { id: 'botanic',      label: 'Botanic',       scheme: 'complementary',   colors: ['#14532d', '#15803d', '#db2777', '#fafaf9'] }, // green ↔ magenta

  // ── Triadic (3 hues 120° apart) ─────────────────────────────────────────
  { id: 'primary-triad',label: 'Primary triad', scheme: 'triadic',         colors: ['#0f172a', '#dc2626', '#facc15', '#f8fafc'] }, // red, yellow + slate ink (blue completes via tokens)
  { id: 'studio',       label: 'Studio',        scheme: 'triadic',         colors: ['#1e1b4b', '#7c3aed', '#22c55e', '#fafaf9'] }, // violet, green, (orange via accentColor)

  // ── Brand-style ────────────────────────────────────────────────────────
  { id: 'corporate',    label: 'Corporate',     scheme: 'monochromatic',   colors: ['#0f172a', '#1e40af', '#94a3b8', '#f1f5f9'] },
  { id: 'startup',      label: 'Startup',       scheme: 'split-complementary', colors: ['#0f172a', '#22c55e', '#facc15', '#f8fafc'] },
  { id: 'high-contrast',label: 'High contrast', scheme: 'complementary',   colors: ['#000000', '#ef4444', '#facc15', '#ffffff'] }
]

// ─── Font pairings ──────────────────────────────────────────────────────────

export type FontPair = { id: string; label: string; heading: string; body: string; headingStack: string; bodyStack: string }
export const FONT_PAIRS: FontPair[] = [
  // Single-family modern sans
  { id: 'geist-geist',          label: 'Geist',                 heading: 'Geist',           body: 'Geist',           headingStack: '"Geist", system-ui, sans-serif',          bodyStack: '"Geist", system-ui, sans-serif' },
  { id: 'jakarta-jakarta',      label: 'Jakarta',               heading: 'Plus Jakarta',    body: 'Plus Jakarta',    headingStack: '"Plus Jakarta Sans", system-ui, sans-serif', bodyStack: '"Plus Jakarta Sans", system-ui, sans-serif' },
  { id: 'satoshi-satoshi',      label: 'Satoshi',               heading: 'Satoshi',         body: 'Satoshi',         headingStack: '"Satoshi", system-ui, sans-serif',        bodyStack: '"Satoshi", system-ui, sans-serif' },
  { id: 'manrope-manrope',      label: 'Manrope',               heading: 'Manrope',         body: 'Manrope',         headingStack: '"Manrope", system-ui, sans-serif',        bodyStack: '"Manrope", system-ui, sans-serif' },
  { id: 'outfit-outfit',        label: 'Outfit',                heading: 'Outfit',          body: 'Outfit',          headingStack: '"Outfit", system-ui, sans-serif',         bodyStack: '"Outfit", system-ui, sans-serif' },
  { id: 'switzer-switzer',      label: 'Switzer',               heading: 'Switzer',         body: 'Switzer',         headingStack: '"Switzer", system-ui, sans-serif',        bodyStack: '"Switzer", system-ui, sans-serif' },
  { id: 'general-general',      label: 'General Sans',          heading: 'General Sans',    body: 'General Sans',    headingStack: '"General Sans", system-ui, sans-serif',   bodyStack: '"General Sans", system-ui, sans-serif' },
  { id: 'inter-inter',          label: 'Inter',                 heading: 'Inter',           body: 'Inter',           headingStack: '"Inter", system-ui, sans-serif',          bodyStack: '"Inter", system-ui, sans-serif' },
  { id: 'sora-sora',            label: 'Sora',                  heading: 'Sora',            body: 'Sora',            headingStack: '"Sora", system-ui, sans-serif',           bodyStack: '"Sora", system-ui, sans-serif' },
  { id: 'space-grotesk',        label: 'Space Grotesk',         heading: 'Space Grotesk',   body: 'Space Grotesk',   headingStack: '"Space Grotesk", system-ui, sans-serif',  bodyStack: '"Space Grotesk", system-ui, sans-serif' },
  { id: 'ibm-plex',             label: 'IBM Plex',              heading: 'IBM Plex Sans',   body: 'IBM Plex Sans',   headingStack: '"IBM Plex Sans", system-ui, sans-serif',  bodyStack: '"IBM Plex Sans", system-ui, sans-serif' },
  // Display sans
  { id: 'cabinet-inter',        label: 'Cabinet Grotesk',       heading: 'Cabinet Grotesk', body: 'Inter',           headingStack: '"Cabinet Grotesk", system-ui, sans-serif', bodyStack: '"Inter", system-ui, sans-serif' },
  { id: 'tan-mon-cheri',        label: 'Tan Mon Cheri',         heading: 'Tan Mon Cheri',   body: 'Inter',           headingStack: '"Tan Mon Cheri", Georgia, serif',         bodyStack: '"Inter", system-ui, sans-serif' },
  { id: 'clash-display',        label: 'Clash Display',         heading: 'Clash Display',   body: 'Inter',           headingStack: '"Clash Display", system-ui, sans-serif',  bodyStack: '"Inter", system-ui, sans-serif' },
  { id: 'array-clash',          label: 'Array',                 heading: 'Array',           body: 'Inter',           headingStack: '"Array", system-ui, sans-serif',          bodyStack: '"Inter", system-ui, sans-serif' },
  // Serif display + sans body
  { id: 'fraunces-inter',       label: 'Fraunces · Inter',      heading: 'Fraunces',        body: 'Inter',           headingStack: '"Fraunces", Georgia, serif',              bodyStack: '"Inter", system-ui, sans-serif' },
  { id: 'recoleta-inter',       label: 'Recoleta · Inter',      heading: 'Recoleta',        body: 'Inter',           headingStack: '"Recoleta", Georgia, serif',              bodyStack: '"Inter", system-ui, sans-serif' },
  { id: 'playfair-dm',          label: 'Playfair · DM Sans',    heading: 'Playfair Display',body: 'DM Sans',         headingStack: '"Playfair Display", Georgia, serif',      bodyStack: '"DM Sans", system-ui, sans-serif' },
  { id: 'cormorant-jakarta',    label: 'Cormorant · Jakarta',   heading: 'Cormorant Garamond', body: 'Plus Jakarta', headingStack: '"Cormorant Garamond", Georgia, serif',    bodyStack: '"Plus Jakarta Sans", system-ui, sans-serif' },
  { id: 'gambarino-satoshi',    label: 'Gambarino · Satoshi',   heading: 'Gambarino',       body: 'Satoshi',         headingStack: '"Gambarino", Georgia, serif',             bodyStack: '"Satoshi", system-ui, sans-serif' },
  { id: 'editorial-newsreader', label: 'Editorial · Newsreader',heading: 'Editorial New',   body: 'Newsreader',      headingStack: '"Editorial New", Georgia, serif',         bodyStack: '"Newsreader", Georgia, serif' },
  { id: 'instrument-inter',     label: 'Instrument · Inter',    heading: 'Instrument Serif',body: 'Inter',           headingStack: '"Instrument Serif", Georgia, serif',      bodyStack: '"Inter", system-ui, sans-serif' },
  // All-serif
  { id: 'newsreader-news',      label: 'Newsreader',            heading: 'Newsreader',      body: 'Newsreader',      headingStack: '"Newsreader", Georgia, serif',            bodyStack: '"Newsreader", Georgia, serif' },
  { id: 'lora-lora',            label: 'Lora',                  heading: 'Lora',            body: 'Lora',            headingStack: '"Lora", Georgia, serif',                  bodyStack: '"Lora", Georgia, serif' },
  // Mono
  { id: 'mono-mono',            label: 'JetBrains Mono',        heading: 'JetBrains Mono',  body: 'JetBrains Mono',  headingStack: '"JetBrains Mono", ui-monospace, monospace', bodyStack: '"JetBrains Mono", ui-monospace, monospace' },
  { id: 'commitmono-inter',     label: 'Commit Mono · Inter',   heading: 'Commit Mono',     body: 'Inter',           headingStack: '"Commit Mono", ui-monospace, monospace',  bodyStack: '"Inter", system-ui, sans-serif' }
]

// ─── Fonts (flat list, used by the new multi-role dropdown UI) ───────────
// Single-family entries the user picks individually for primary / secondary
// / tertiary roles. Far longer than FONT_PAIRS because dropdowns scale.

export type FontFamily = {
  id: string
  label: string
  /** CSS font-family stack including fallbacks. */
  stack: string
  /** Loose grouping for the dropdown headers. */
  group: 'sans' | 'display' | 'serif' | 'mono'
}

export const FONT_FAMILIES: FontFamily[] = [
  // ── Sans (modern UI workhorses)
  { id: 'geist',          label: 'Geist',                stack: '"Geist", system-ui, sans-serif',                  group: 'sans' },
  { id: 'inter',          label: 'Inter',                stack: '"Inter", system-ui, sans-serif',                  group: 'sans' },
  { id: 'inter-tight',    label: 'Inter Tight',          stack: '"Inter Tight", "Inter", system-ui, sans-serif',   group: 'sans' },
  { id: 'jakarta',        label: 'Plus Jakarta Sans',    stack: '"Plus Jakarta Sans", system-ui, sans-serif',      group: 'sans' },
  { id: 'satoshi',        label: 'Satoshi',              stack: '"Satoshi", system-ui, sans-serif',                group: 'sans' },
  { id: 'manrope',        label: 'Manrope',              stack: '"Manrope", system-ui, sans-serif',                group: 'sans' },
  { id: 'outfit',         label: 'Outfit',               stack: '"Outfit", system-ui, sans-serif',                 group: 'sans' },
  { id: 'switzer',        label: 'Switzer',              stack: '"Switzer", system-ui, sans-serif',                group: 'sans' },
  { id: 'general-sans',   label: 'General Sans',         stack: '"General Sans", system-ui, sans-serif',           group: 'sans' },
  { id: 'sora',           label: 'Sora',                 stack: '"Sora", system-ui, sans-serif',                   group: 'sans' },
  { id: 'space-grotesk',  label: 'Space Grotesk',        stack: '"Space Grotesk", system-ui, sans-serif',          group: 'sans' },
  { id: 'ibm-plex-sans',  label: 'IBM Plex Sans',        stack: '"IBM Plex Sans", system-ui, sans-serif',          group: 'sans' },
  { id: 'dm-sans',        label: 'DM Sans',              stack: '"DM Sans", system-ui, sans-serif',                group: 'sans' },
  { id: 'work-sans',      label: 'Work Sans',            stack: '"Work Sans", system-ui, sans-serif',              group: 'sans' },
  { id: 'figtree',        label: 'Figtree',              stack: '"Figtree", system-ui, sans-serif',                group: 'sans' },
  { id: 'be-vietnam',     label: 'Be Vietnam Pro',       stack: '"Be Vietnam Pro", system-ui, sans-serif',         group: 'sans' },
  { id: 'urbanist',       label: 'Urbanist',             stack: '"Urbanist", system-ui, sans-serif',               group: 'sans' },
  // ── Display (big-headline sans / quirky)
  { id: 'cabinet-grotesk',label: 'Cabinet Grotesk',      stack: '"Cabinet Grotesk", system-ui, sans-serif',        group: 'display' },
  { id: 'clash-display',  label: 'Clash Display',        stack: '"Clash Display", system-ui, sans-serif',          group: 'display' },
  { id: 'array',          label: 'Array',                stack: '"Array", system-ui, sans-serif',                  group: 'display' },
  { id: 'tan-mon-cheri',  label: 'Tan Mon Cheri',        stack: '"Tan Mon Cheri", Georgia, serif',                 group: 'display' },
  { id: 'gambarino',      label: 'Gambarino',            stack: '"Gambarino", Georgia, serif',                     group: 'display' },
  { id: 'tanker',         label: 'Tanker',               stack: '"Tanker", system-ui, sans-serif',                 group: 'display' },
  { id: 'boldonse',       label: 'Boldonse',             stack: '"Boldonse", system-ui, sans-serif',               group: 'display' },
  { id: 'monument',       label: 'Monument Extended',    stack: '"Monument Extended", system-ui, sans-serif',      group: 'display' },
  { id: 'space-mono-display', label: 'Space Mono',       stack: '"Space Mono", ui-monospace, monospace',           group: 'display' },
  // ── Serif (display + body)
  { id: 'fraunces',       label: 'Fraunces',             stack: '"Fraunces", Georgia, serif',                      group: 'serif' },
  { id: 'recoleta',       label: 'Recoleta',             stack: '"Recoleta", Georgia, serif',                      group: 'serif' },
  { id: 'playfair',       label: 'Playfair Display',     stack: '"Playfair Display", Georgia, serif',              group: 'serif' },
  { id: 'cormorant',      label: 'Cormorant Garamond',   stack: '"Cormorant Garamond", Georgia, serif',            group: 'serif' },
  { id: 'instrument-serif', label: 'Instrument Serif',   stack: '"Instrument Serif", Georgia, serif',              group: 'serif' },
  { id: 'editorial-new',  label: 'Editorial New',        stack: '"Editorial New", Georgia, serif',                 group: 'serif' },
  { id: 'newsreader',     label: 'Newsreader',           stack: '"Newsreader", Georgia, serif',                    group: 'serif' },
  { id: 'lora',           label: 'Lora',                 stack: '"Lora", Georgia, serif',                          group: 'serif' },
  { id: 'spectral',       label: 'Spectral',             stack: '"Spectral", Georgia, serif',                      group: 'serif' },
  { id: 'crimson-pro',    label: 'Crimson Pro',          stack: '"Crimson Pro", Georgia, serif',                   group: 'serif' },
  { id: 'libre-caslon',   label: 'Libre Caslon Text',    stack: '"Libre Caslon Text", Georgia, serif',             group: 'serif' },
  { id: 'eb-garamond',    label: 'EB Garamond',          stack: '"EB Garamond", Georgia, serif',                   group: 'serif' },
  { id: 'source-serif',   label: 'Source Serif 4',       stack: '"Source Serif 4", Georgia, serif',                group: 'serif' },
  // ── Mono
  { id: 'jetbrains-mono', label: 'JetBrains Mono',       stack: '"JetBrains Mono", ui-monospace, monospace',       group: 'mono' },
  { id: 'commit-mono',    label: 'Commit Mono',          stack: '"Commit Mono", ui-monospace, monospace',          group: 'mono' },
  { id: 'fira-code',      label: 'Fira Code',            stack: '"Fira Code", ui-monospace, monospace',            group: 'mono' },
  { id: 'ibm-plex-mono',  label: 'IBM Plex Mono',        stack: '"IBM Plex Mono", ui-monospace, monospace',        group: 'mono' },
  { id: 'space-mono',     label: 'Space Mono',           stack: '"Space Mono", ui-monospace, monospace',           group: 'mono' },
  { id: 'dm-mono',        label: 'DM Mono',              stack: '"DM Mono", ui-monospace, monospace',              group: 'mono' },
  { id: 'geist-mono',     label: 'Geist Mono',           stack: '"Geist Mono", ui-monospace, monospace',           group: 'mono' }
]

export const FONT_FAMILY_GROUPS: Array<{ id: FontFamily['group']; label: string }> = [
  { id: 'sans',    label: 'Sans-serif' },
  { id: 'display', label: 'Display' },
  { id: 'serif',   label: 'Serif' },
  { id: 'mono',    label: 'Monospace' }
]

export function fontFamilyById(id: string | null): FontFamily | null {
  if (!id) return null
  return FONT_FAMILIES.find((f) => f.id === id) ?? null
}

// ─── Icons ──────────────────────────────────────────────────────────────────

export type IconLibraryId =
  | 'lucide' | 'phosphor' | 'heroicons' | 'tabler' | 'remix' | 'feather'
  | 'material-symbols' | 'iconoir' | 'none'
export type IconStyleId = 'outline' | 'filled' | 'duotone' | 'mixed'

export const ICON_LIBRARIES: Array<{
  id: IconLibraryId
  label: string
  hint: string
  // Which style toggles are meaningful for this library.
  styles: IconStyleId[]
  cdn?: string  // For the prompt: model can <link> to this CSS / use this NPM package.
}> = [
  { id: 'lucide',           label: 'Lucide',           hint: 'Clean line icons (Feather successor)',
    styles: ['outline'], cdn: 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js' },
  { id: 'phosphor',         label: 'Phosphor',         hint: 'Flexible: outline, filled, duotone',
    styles: ['outline', 'filled', 'duotone', 'mixed'], cdn: 'https://unpkg.com/@phosphor-icons/web' },
  { id: 'heroicons',        label: 'Heroicons',        hint: 'By Tailwind: outline + filled',
    styles: ['outline', 'filled', 'mixed'], cdn: 'https://unpkg.com/heroicons' },
  { id: 'tabler',           label: 'Tabler',           hint: 'Big set, very consistent',
    styles: ['outline', 'filled', 'mixed'], cdn: 'https://unpkg.com/@tabler/icons-webfont/tabler-icons.min.css' },
  { id: 'remix',            label: 'Remix',            hint: 'Outline + filled, neutral feel',
    styles: ['outline', 'filled', 'mixed'], cdn: 'https://cdn.jsdelivr.net/npm/remixicon/fonts/remixicon.css' },
  { id: 'feather',          label: 'Feather',          hint: 'Minimal line icons',
    styles: ['outline'], cdn: 'https://unpkg.com/feather-icons' },
  { id: 'material-symbols', label: 'Material Symbols', hint: 'Google: outline / filled / sharp',
    styles: ['outline', 'filled', 'mixed'], cdn: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined' },
  { id: 'iconoir',          label: 'Iconoir',          hint: 'Friendly outline icons',
    styles: ['outline'], cdn: 'https://cdn.jsdelivr.net/gh/iconoir-icons/iconoir/css/iconoir.css' },
  { id: 'none',             label: 'No icons',         hint: 'Skip icons entirely', styles: [] }
]

export const ICON_STYLES: Array<{ id: IconStyleId; label: string; hint: string }> = [
  { id: 'outline', label: 'Outlined', hint: 'Stroked lines, default modern feel' },
  { id: 'filled',  label: 'Filled',   hint: 'Solid shapes, more visual weight' },
  { id: 'duotone', label: 'Duotone',  hint: 'Two-tone: accent + neutral' },
  { id: 'mixed',   label: 'Mixed',    hint: 'Outline by default, filled when active' }
]

// ─── Theme / density / motion / fidelity / surfaces ─────────────────────────

export const THEME_OPTIONS: Array<{ id: 'light' | 'dark' | 'auto' | 'both'; label: string }> = [
  { id: 'light', label: 'Light' },
  { id: 'dark',  label: 'Dark' },
  { id: 'auto',  label: 'Auto (system)' },
  { id: 'both',  label: 'Both with toggle' }
]

export const DENSITY_OPTIONS: Array<{ id: 'compact' | 'comfortable' | 'spacious'; label: string; hint: string }> = [
  { id: 'compact',     label: 'Compact',     hint: 'Tight spacing, info-dense' },
  { id: 'comfortable', label: 'Comfortable', hint: 'Balanced default' },
  { id: 'spacious',    label: 'Spacious',    hint: 'Generous whitespace' }
]

// Precision spacing scale: chooses the underlying 4/8px grid step that
// every padding, margin and gap snaps to. Used on apps + figma kinds where
// pixel discipline matters (a 13px margin is a regression).
export const SPACING_OPTIONS: Array<{ id: 'tight' | 'standard' | 'spacious'; label: string; hint: string; base: 4 | 8; allowed: number[] }> = [
  { id: 'tight',    label: 'Tight 4px',    hint: 'Dense product UI. 4 / 8 / 12 / 16',          base: 4, allowed: [4, 8, 12, 16, 20, 24, 32] },
  { id: 'standard', label: 'Standard 8px', hint: 'Default web/app rhythm. 8 / 16 / 24 / 32',   base: 8, allowed: [4, 8, 16, 24, 32, 40, 48, 64] },
  { id: 'spacious', label: 'Spacious 8px', hint: 'Marketing and presentation density. 16 / 24 / 32 / 48 / 64', base: 8, allowed: [16, 24, 32, 48, 64, 80, 96] }
]

// Grid choice: how many columns the canvas / page is divided into. Mostly
// matters for layouts that need to align across rows of cards or sections.
export const GRID_OPTIONS: Array<{ id: '4col' | '8col' | '12col' | '16col' | 'flex'; label: string; hint: string; columns: number }> = [
  { id: '4col',  label: '4 columns',  hint: 'Mobile-first / simple layouts',     columns: 4 },
  { id: '8col',  label: '8 columns',  hint: 'Tablet-friendly grids',             columns: 8 },
  { id: '12col', label: '12 columns', hint: 'Standard responsive web/app grid',  columns: 12 },
  { id: '16col', label: '16 columns', hint: 'Dense dashboards / data tables',    columns: 16 },
  { id: 'flex',  label: 'No fixed grid', hint: 'Free-form, snap to spacing only', columns: 0 }
]

export const MOTION_OPTIONS: Array<{ id: 'none' | 'subtle' | 'expressive'; label: string; hint: string }> = [
  { id: 'none',       label: 'None',       hint: 'Static. No transitions.' },
  { id: 'subtle',     label: 'Subtle',     hint: 'Quiet hover and reveal' },
  { id: 'expressive', label: 'Expressive', hint: 'Big motion, scroll-triggered' }
]

export const FIDELITY_OPTIONS: Array<{ id: 'wireframe' | 'highfidelity'; label: string; hint: string }> = [
  { id: 'wireframe',    label: 'Wireframe',     hint: 'Grayscale, layout focused' },
  { id: 'highfidelity', label: 'High fidelity', hint: 'Polished, branded, real assets' }
]

export const SURFACE_OPTIONS: Array<{ id: 'mobile' | 'tablet' | 'desktop' | 'responsive'; label: string }> = [
  { id: 'mobile',     label: 'Mobile' },
  { id: 'tablet',     label: 'Tablet' },
  { id: 'desktop',    label: 'Desktop' },
  { id: 'responsive', label: 'Responsive (all)' }
]

// ─── State + brief shape ────────────────────────────────────────────────────

import type { AiRules } from './aiRules'
import { defaultAiRules, loadGlobalAiRules } from './aiRules'

export type DesignWizardState = {
  category: DesignGroup | null
  kind: DesignKind | null
  subtype: string | null
  surface: 'mobile' | 'tablet' | 'desktop' | 'responsive' | null
  fidelity: 'wireframe' | 'highfidelity'
  look: LookId | null
  /** Free-text override when the user picks "I'll describe…" on the Look page. */
  customLook: string | null
  /** Established design system the user wants to follow. When set, it
   *  overrides the per-axis shape/density/motion answers. */
  designSystem: string | null
  audience: string | null
  paletteId: string | null
  primaryColor: string | null
  secondaryColor: string | null
  accentColor: string | null
  fontPairId: string | null
  /** New multi-role typography: primary (headings), secondary (body),
   *  tertiary (accent / mono / pull-quotes: optional). Each is a font
   *  family id from FONT_FAMILIES. */
  fontPrimary: string | null
  fontSecondary: string | null
  fontTertiary: string | null
  /** Free-text override when the user wants to use multiple fonts and
   *  describe what each is for (e.g. "Cormorant for hero, Geist for body,
   *  JetBrains Mono for code blocks"). */
  customFonts: string | null
  iconLibraryId: IconLibraryId | null
  iconStyleId: IconStyleId | null
  theme: 'light' | 'dark' | 'auto' | 'both' | null
  density: 'compact' | 'comfortable' | 'spacious' | null
  /** Precision spacing scale (apps + figma kinds, replaces density). */
  spacing: 'tight' | 'standard' | 'spacious' | null
  /** Underlying column grid for layouts that need precision. */
  grid: '4col' | '8col' | '12col' | '16col' | 'flex' | null
  motion: 'none' | 'subtle' | 'expressive' | null
  /** Free-text override when the user picks "I'll describe" on the Motion page. */
  customMotion: string | null
  /** Tech stack the design will plug into. Drives import stubs + structure. */
  stack: StackId | null
  /** Free-text override when the user picks "I'll describe" on the Stack page. */
  customStack: string | null
  /** Shape language: governs corner radius, shadow weight, border width
   *  across the design. Overridable by a chosen design system. */
  shapeRadius: RadiusId | null
  shapeShadow: ShadowId | null
  shapeBorders: BorderId | null
  shapeSurface: SurfaceShapeId | null
  /** Visual treatment of secondary buttons (next to a filled primary). */
  secondaryButton: SecondaryButtonId | null
  inspiration: string
  figmaUrl: string
  templateFile: string | null   // basename relative to design cwd, e.g. 'template.pptx'
  /** When true + a template is attached, the wizard SKIPS the design
   *  pages (look/palette/fonts/icons/theme/density/motion) and the brief
   *  carries no design overrides. The prompt then tells the model the
   *  template IS the design: only content changes per the user's idea. */
  useTemplateLook: boolean
  idea: string
  /** Background context (collapsible block on the idea page). All optional :
   *  the user fills any of these to give the model richer "why this exists"
   *  context. Mirrors the BriefWizard's guided prompts. */
  contextDescription: string
  contextProblem: string
  contextGoal: string
  contextKeyFeatures: string
  contextSuccess: string
  /** Reference images uploaded on the inspiration page. Each entry is a
   *  basename written to `_refs/` inside the design cwd. The actual File
   *  objects sit on `window.__t42PendingRefs` until the design is created. */
  inspirationImages: string[]
  /** Last-mile adjustments the user wrote on the Summary page. Appended to
   *  the prompt as "ADJUSTMENTS" so the model treats them as the most
   *  recent overrides. Designed to save a generation cycle: the user can
   *  read the plan, type "make the cards smaller" or "drop the chart
   *  section", and skip a wasted first build. */
  planNotes: string
  aiRules: AiRules              // anti-AI defaults: start from global, can override per design
  /** Free-text list of things the user wants the model to avoid, one per
   *  line. Appended to the AI rules block in the prompt. */
  customAvoid: string
  // Per-question "Decide for me" markers. When a key is true, the wizard
  // skipped picking a value and the model is expected to choose.
  decisions: Partial<Record<'audience' | 'look' | 'density' | 'motion' | 'theme' | 'subtype' | 'stack' | 'shape', true>>
  // Target: 'html' (default) or 'figma'. When 'figma', the kickoff goes
  // through figmaFromScratch instead of the regular HTML send, and a
  // 'figma' page is added at the end of the wizard for file destination.
  target: 'html' | 'figma'
  figmaMode: 'newFile' | 'existingFile'
  figmaTargetUrl: string
  /** When set, the wizard runs in "starter template" mode: only the idea
   *  + palette pages are shown, and the caller materialises the named
   *  starter into the new design's cwd before kickoff. */
  starterTemplateId: string | null
  starterTemplateName: string | null
}

export function emptyDesignState(): DesignWizardState {
  return {
    category: null, kind: null, subtype: null, surface: null, fidelity: 'highfidelity',
    look: null, customLook: null, designSystem: null, audience: null,
    paletteId: null, primaryColor: null, secondaryColor: null, accentColor: null,
    fontPairId: null, fontPrimary: null, fontSecondary: null, fontTertiary: null, customFonts: null, iconLibraryId: null, iconStyleId: null, theme: null, density: null, spacing: null, grid: null, motion: null, customMotion: null,
    stack: null, customStack: null,
    shapeRadius: null, shapeShadow: null, shapeBorders: null, shapeSurface: null,
    secondaryButton: null,
    inspiration: '', figmaUrl: '', templateFile: null, useTemplateLook: false, idea: '',
    contextDescription: '', contextProblem: '', contextGoal: '', contextKeyFeatures: '', contextSuccess: '',
    inspirationImages: [],
    planNotes: '',
    aiRules: typeof window !== 'undefined' ? loadGlobalAiRules() : defaultAiRules(),
    customAvoid: '',
    decisions: {},
    target: 'html', figmaMode: 'newFile', figmaTargetUrl: '',
    starterTemplateId: null, starterTemplateName: null
  }
}

// Used by main process; keep the brief flat so it serialises cleanly.
export type DesignBrief = {
  v: 1
  kind: DesignKind
  kindLabel: string
  group: DesignGroup
  subtype?: string | null
  surface?: 'mobile' | 'tablet' | 'desktop' | 'responsive' | null
  fidelity: 'wireframe' | 'highfidelity'
  look?: LookId | null
  lookLabel?: string | null
  /** Established design system slug + label. */
  designSystem?: string | null
  designSystemLabel?: string | null
  audience?: string | null
  paletteId?: string | null
  paletteLabel?: string | null
  paletteColors?: string[] | null
  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
  fontPairId?: string | null
  /** New typography roles. */
  fontPrimary?: string | null
  fontSecondary?: string | null
  fontTertiary?: string | null
  fontPrimaryLabel?: string | null
  fontSecondaryLabel?: string | null
  fontTertiaryLabel?: string | null
  fontHeading?: string | null
  fontBody?: string | null
  /** When set, free-text user description of multi-font usage. The model
   *  uses this verbatim instead of the heading/body pair. */
  customFonts?: string | null
  iconLibraryId?: IconLibraryId | null
  iconLibraryLabel?: string | null
  iconStyleId?: IconStyleId | null
  iconStyleLabel?: string | null
  theme?: 'light' | 'dark' | 'auto' | 'both' | null
  density?: 'compact' | 'comfortable' | 'spacious' | null
  spacing?: 'tight' | 'standard' | 'spacious' | null
  grid?: '4col' | '8col' | '12col' | '16col' | 'flex' | null
  motion?: 'none' | 'subtle' | 'expressive' | null
  customMotion?: string | null
  /** Tech stack picked in the wizard. */
  stack?: StackId | null
  stackLabel?: string | null
  customStack?: string | null
  /** Shape language. */
  shapeRadius?: RadiusId | null
  shapeRadiusLabel?: string | null
  shapeShadow?: ShadowId | null
  shapeShadowLabel?: string | null
  shapeBorders?: BorderId | null
  shapeBordersLabel?: string | null
  shapeSurface?: SurfaceShapeId | null
  shapeSurfaceLabel?: string | null
  /** Secondary button treatment. */
  secondaryButton?: SecondaryButtonId | null
  secondaryButtonLabel?: string | null
  inspiration?: string | null
  figmaUrl?: string | null
  templateFile?: string | null
  /** When true, ignore all design fields below: the template is the
   *  design and only the user's idea controls content. */
  useTemplateLook?: boolean
  idea?: string | null
  /** Background context fields. Each may be empty. */
  contextDescription?: string | null
  contextProblem?: string | null
  contextGoal?: string | null
  contextKeyFeatures?: string | null
  contextSuccess?: string | null
  /** Reference image basenames (relative to design cwd `_refs/`). */
  inspirationImages?: string[] | null
  planNotes?: string | null
  aiRules?: AiRules | null   // anti-AI rule state at the time of design creation
  customAvoid?: string | null
  decisions?: string[] | null  // names of fields the user asked the model to choose
  target?: 'html' | 'figma'
  figmaMode?: 'newFile' | 'existingFile'
  figmaTargetUrl?: string | null
  /** When set, this design was bootstrapped from a Studio42 starter
   *  template. The starter's files already live in the design cwd; the
   *  model must adapt them, not rebuild from scratch. */
  starterTemplateId?: string | null
  starterTemplateName?: string | null
  createdAt: number
}

export function stateToBrief(s: DesignWizardState): DesignBrief | null {
  if (!s.kind) return null
  const def = DESIGN_KINDS.find((k) => k.id === s.kind)!
  // Template-takes-everything mode: drop all design fields so the brief
  // can't compete with the actual template's theme.
  const useTpl = s.useTemplateLook && !!s.templateFile
  const hasPal  = !useTpl && flag(def, 'hasPalette')
  const hasFont = !useTpl && flag(def, 'hasFonts')
  const hasIcon = !useTpl && flag(def, 'hasIcons')
  const hasLk   = !useTpl && flag(def, 'hasLook')
  const hasAud  = flag(def, 'hasAudience')
  const hasStk  = !useTpl && flag(def, 'hasStack')
  const hasShp  = !useTpl && flag(def, 'hasShape')
  const palette = hasPal && s.paletteId ? PALETTES.find((p) => p.id === s.paletteId) : null
  const pair    = hasFont && s.fontPairId ? FONT_PAIRS.find((f) => f.id === s.fontPairId) : null
  const lib     = hasIcon && s.iconLibraryId ? ICON_LIBRARIES.find((l) => l.id === s.iconLibraryId) : null
  const istyle  = hasIcon && s.iconStyleId ? ICON_STYLES.find((x) => x.id === s.iconStyleId) : null
  const lookDef = hasLk   && s.look ? LOOK_OPTIONS.find((l) => l.id === s.look) : null
  // Fidelity: respect fixedFidelity, fall back to user choice or 'highfidelity'.
  const fidelity: 'wireframe' | 'highfidelity' =
    def.fixedFidelity ?? (flag(def, 'hasFidelity') ? s.fidelity : 'highfidelity')
  return {
    v: 1,
    kind: s.kind,
    kindLabel: def.label,
    group: def.group,
    subtype: s.subtype || null,
    surface: def.hasSurfaces ? s.surface : null,
    fidelity,
    look: hasLk ? s.look : null,
    lookLabel: (s.customLook && s.customLook.trim()) || (lookDef?.label ?? null),
    designSystem: hasLk ? s.designSystem : null,
    designSystemLabel: hasLk && s.designSystem
      ? (DESIGN_SYSTEMS.find((d) => d.id === s.designSystem)?.label ?? s.designSystem)
      : null,
    audience: hasAud ? s.audience : null,
    paletteId: hasPal ? s.paletteId : null,
    paletteLabel: palette?.label ?? null,
    paletteColors: palette?.colors ?? null,
    primaryColor: hasPal ? s.primaryColor : null,
    secondaryColor: hasPal ? s.secondaryColor : null,
    accentColor: hasPal ? s.accentColor : null,
    fontPairId: hasFont ? s.fontPairId : null,
    fontPrimary: hasFont ? s.fontPrimary : null,
    fontSecondary: hasFont ? s.fontSecondary : null,
    fontTertiary: hasFont ? s.fontTertiary : null,
    fontPrimaryLabel: hasFont ? (fontFamilyById(s.fontPrimary)?.label ?? null) : null,
    fontSecondaryLabel: hasFont ? (fontFamilyById(s.fontSecondary)?.label ?? null) : null,
    fontTertiaryLabel: hasFont ? (fontFamilyById(s.fontTertiary)?.label ?? null) : null,
    // Back-compat: derive heading/body from the new role fields (or fall
    // back to the old pair when nothing's been picked in the new UI).
    fontHeading: hasFont
      ? (fontFamilyById(s.fontPrimary)?.label ?? pair?.heading ?? null)
      : null,
    fontBody: hasFont
      ? (fontFamilyById(s.fontSecondary)?.label ?? pair?.body ?? null)
      : null,
    customFonts: hasFont ? (s.customFonts?.trim() || null) : null,
    iconLibraryId: hasIcon ? s.iconLibraryId : null,
    iconLibraryLabel: lib?.label ?? null,
    iconStyleId: hasIcon ? s.iconStyleId : null,
    iconStyleLabel: istyle?.label ?? null,
    theme: useTpl ? null : (def.hasTheme ? s.theme : null),
    density: useTpl ? null : (def.hasDensity ? s.density : null),
    spacing: useTpl ? null : (def.hasSpacing ? s.spacing : null),
    grid:    useTpl ? null : (def.hasSpacing ? s.grid    : null),
    motion: useTpl ? null : (def.hasMotion ? s.motion : null),
    customMotion: useTpl ? null : (def.hasMotion ? (s.customMotion?.trim() || null) : null),
    stack: hasStk ? s.stack : null,
    stackLabel: hasStk && s.stack ? (STACK_OPTIONS.find((x) => x.id === s.stack)?.label ?? null) : null,
    customStack: hasStk ? (s.customStack?.trim() || null) : null,
    shapeRadius:  hasShp ? s.shapeRadius  : null,
    shapeRadiusLabel:  hasShp && s.shapeRadius  ? (RADIUS_OPTIONS.find((x) => x.id === s.shapeRadius)?.label  ?? null) : null,
    shapeShadow:  hasShp ? s.shapeShadow  : null,
    shapeShadowLabel:  hasShp && s.shapeShadow  ? (SHADOW_OPTIONS.find((x) => x.id === s.shapeShadow)?.label  ?? null) : null,
    shapeBorders: hasShp ? s.shapeBorders : null,
    shapeBordersLabel: hasShp && s.shapeBorders ? (BORDER_OPTIONS.find((x) => x.id === s.shapeBorders)?.label ?? null) : null,
    shapeSurface: hasShp ? s.shapeSurface : null,
    shapeSurfaceLabel: hasShp && s.shapeSurface ? (SURFACE_SHAPE_OPTIONS.find((x) => x.id === s.shapeSurface)?.label ?? null) : null,
    secondaryButton: hasShp ? s.secondaryButton : null,
    secondaryButtonLabel: hasShp && s.secondaryButton ? (SECONDARY_BUTTON_OPTIONS.find((x) => x.id === s.secondaryButton)?.label ?? null) : null,
    inspiration: s.inspiration.trim() || null,
    figmaUrl: s.figmaUrl.trim() || null,
    templateFile: s.templateFile,
    useTemplateLook: useTpl,
    idea: s.idea.trim() || null,
    contextDescription: s.contextDescription.trim() || null,
    contextProblem:     s.contextProblem.trim()     || null,
    contextGoal:        s.contextGoal.trim()        || null,
    contextKeyFeatures: s.contextKeyFeatures.trim() || null,
    contextSuccess:     s.contextSuccess.trim()     || null,
    inspirationImages:  (s.inspirationImages ?? []).slice(),
    planNotes:          s.planNotes.trim() || null,
    aiRules: s.aiRules,
    customAvoid:        s.customAvoid.trim() || null,
    decisions: Object.keys(s.decisions ?? {}).filter((k) => (s.decisions as Record<string, true>)[k]),
    target: s.target,
    figmaMode: s.figmaMode,
    figmaTargetUrl: s.figmaTargetUrl.trim() || null,
    starterTemplateId:   s.starterTemplateId,
    starterTemplateName: s.starterTemplateName,
    createdAt: Date.now()
  }
}

// Pages derived from selected category + kind. Conditional pages dropped early.
export type WizardPage =
  | 'category' | 'kind' | 'subtype' | 'surface' | 'fidelity' | 'stack' | 'look' | 'shape' | 'audience'
  | 'palette' | 'fonts' | 'icons' | 'theme' | 'density' | 'spacing' | 'grid'
  | 'motion' | 'inspiration' | 'idea'
  | 'defaults' | 'figma' | 'summary'

export function pagesForState(s: {
  category: DesignGroup | null
  kind: DesignKind | null
  target?: 'html' | 'figma'
  templateFile?: string | null
  useTemplateLook?: boolean
  starterTemplateId?: string | null
}): WizardPage[] {
  // Studio42 starter template flow: skip every design question. The
  // template owns all visual decisions; the user only supplies project
  // context (idea) and optional brand colours.
  if (s.starterTemplateId) return ['idea', 'palette', 'summary']
  if (!s.category) return ['category']
  if (!s.kind) return ['category', 'kind']
  if (s.kind === 'blank') return ['category', 'kind']
  const def = DESIGN_KINDS.find((k) => k.id === s.kind)!

  // When the user uploaded a template AND ticked "Use everything from
  // template", the template IS the design: drop every design question.
  const useTpl = !!s.useTemplateLook && !!s.templateFile

  // Streamlined website flow: a real site does not need the surface, fidelity,
  // stack, shape, icons, density/spacing/grid, motion or inspiration steps
  // (responsive layout, flat surfaces and the motion engine are handled for
  // you now). Keep only the decisions that actually shape a site: type, look,
  // palette, fonts and theme, then the brief and the AI defaults.
  if (!useTpl && s.category === 'web' && s.target !== 'figma') {
    const lean: WizardPage[] = ['category', 'kind']
    if (def.subtypes && def.subtypes.length) lean.push('subtype')
    if (flag(def, 'hasLook')) lean.push('look')
    if (flag(def, 'hasPalette')) lean.push('palette')
    if (flag(def, 'hasFonts')) lean.push('fonts')
    if (def.hasTheme) lean.push('theme')
    lean.push('idea', 'defaults', 'summary')
    return lean
  }

  const pages: WizardPage[] = ['category', 'kind']
  if (def.subtypes && def.subtypes.length) pages.push('subtype')
  // Surface (responsive breakpoints) doesn't apply when the output is
  // static Figma frames: drop it.
  if (def.hasSurfaces && s.target !== 'figma') pages.push('surface')
  if (flag(def, 'hasFidelity')) pages.push('fidelity')

  // (useTpl is computed above.) When the template owns the design we drop every
  // design question; audience, idea and AI defaults still shape content not visuals.

  // Stack sits next to fidelity: both are engineering-level scaffold.
  if (!useTpl && flag(def, 'hasStack') && s.target !== 'figma') pages.push('stack')
  if (!useTpl && flag(def, 'hasLook')) pages.push('look')
  // Shape sits right after Look: same vibe family (visual DNA).
  if (!useTpl && flag(def, 'hasShape')) pages.push('shape')
  // Audience moved into the Idea page's Background context block: skip the
  // dedicated page entirely. The hasAudience flag is preserved on kinds in
  // case we surface it elsewhere (summary, etc.) but no audience step.
  if (!useTpl && flag(def, 'hasPalette')) pages.push('palette')
  if (!useTpl && flag(def, 'hasFonts')) pages.push('fonts')
  if (!useTpl && flag(def, 'hasIcons')) pages.push('icons')
  // Theme + density/spacing + motion don't apply to static Figma frames.
  if (!useTpl && def.hasTheme && s.target !== 'figma') pages.push('theme')
  if (!useTpl && def.hasDensity && s.target !== 'figma') pages.push('density')
  // Spacing + grid replace density on precision kinds (apps + figma).
  if (!useTpl && def.hasSpacing) pages.push('spacing', 'grid')
  if (!useTpl && def.hasMotion && s.target !== 'figma') pages.push('motion')
  pages.push('inspiration', 'idea', 'defaults')
  if (s.target === 'figma') pages.push('figma')
  pages.push('summary')
  return pages
}

export const PAGE_TITLES: Record<WizardPage, string> = {
  category:    'What are you designing?',
  kind:        'Pick a type',
  subtype:     'What kind exactly?',
  surface:     'Where will it run?',
  fidelity:    'Wireframe or polished?',
  stack:       'Tech stack',
  look:        'Look and feel',
  shape:       'Shape',
  audience:    'Who is this for?',
  palette:     'Color palette',
  fonts:       'Typography',
  icons:       'Icons',
  theme:       'Light or dark?',
  density:     'Density',
  spacing:     'Spacing',
  grid:        'Grid',
  motion:      'Motion',
  inspiration: 'Inspiration',
  idea:        'Describe your idea',
  defaults:    'AI defaults',
  figma:       'Figma destination',
  summary:     'Ready to start'
}

export function defaultTitle(b: DesignBrief): string {
  const fid = b.fidelity === 'wireframe' ? 'Wireframe' : ''
  const sub = b.subtype ? ` · ${b.subtype}` : ''
  return `${fid ? fid + ' ' : ''}${b.kindLabel}${sub}`.trim()
}
