// Design System model — a small, app-wide set of design tokens (colors, type,
// spacing, radii, shadow, motion) generated from a short questionnaire and then
// editable. Persisted in localStorage so it is shared across the whole app
// (including Form). Kept deliberately light so the app stays fast.

import { AI_RULES, defaultAiRules, formatRulesForPrompt, type AiRules } from './aiRules'

export type Vibe = 'minimal' | 'professional' | 'bold' | 'playful' | 'soft' | 'elegant' | 'brutalist' | 'technical' | 'luxe'
export type Corners = 'sharp' | 'rounded' | 'pill'
/** Granular corner shape (research-informed: Carbon-angular → Apple-squircle). */
export type CornerStyle = 'angular' | 'slight' | 'rounded' | 'curved' | 'full' | 'squircle'
/** How container/box edges are drawn. */
export type BorderStyle = 'outlined' | 'subtle' | 'none'
/** Icon rendering style for the system. */
export type IconStyle = 'outlined' | 'filled' | 'duotone' | 'sharp'
export type ColorMood = 'warm' | 'cool' | 'neutral' | 'vibrant' | 'muted'
export type BaseTheme = 'light' | 'dark'
export type ScaleChoice = 'compact' | 'balanced' | 'expressive'
export type Density = 'compact' | 'cozy' | 'comfortable' | 'spacious'
export type Elevation = 'flat' | 'subtle' | 'elevated'
export type MotionStyle = 'none' | 'subtle' | 'expressive'
/** How a system fills its buttons/accents (a personality cue). */
export type FillStyle = 'solid' | 'tint' | 'outline'

/** A "feel" is a complete personality preset: distinct fonts, shape, colors and
 * treatment, informed by well-known systems (Vercel/Linear, Stripe, Duolingo,
 * IBM Plex, editorial serif, Gumroad brutalist, GitHub/terminal, luxury). */
export interface FeelPreset {
  label: string
  blurb: string
  headingFont: string
  bodyFont: string
  cornerStyle: CornerStyle
  borderStyle: BorderStyle
  iconStyle: IconStyle
  density: Density
  scale: ScaleChoice
  elevation: Elevation
  motionStyle: MotionStyle
  fill: FillStyle
  headingWeight: number
  btnWeight: number
  primary: string
  secondary: string
  tertiary: string
}

export const FEEL_PRESETS: Record<Vibe, FeelPreset> = {
  minimal: { label: 'Minimal', blurb: 'Neutral, calm, lots of space', headingFont: 'Geist', bodyFont: 'Geist', cornerStyle: 'slight', borderStyle: 'subtle', iconStyle: 'outlined', density: 'comfortable', scale: 'balanced', elevation: 'flat', motionStyle: 'subtle', fill: 'solid', headingWeight: 600, btnWeight: 500, primary: '#18181b', secondary: '#71717a', tertiary: '#2563eb' },
  professional: { label: 'Professional', blurb: 'Structured, corporate, accessible', headingFont: 'IBM Plex Sans', bodyFont: 'IBM Plex Sans', cornerStyle: 'slight', borderStyle: 'outlined', iconStyle: 'outlined', density: 'cozy', scale: 'compact', elevation: 'subtle', motionStyle: 'subtle', fill: 'solid', headingWeight: 600, btnWeight: 500, primary: '#0f62fe', secondary: '#393939', tertiary: '#0072c3' },
  bold: { label: 'Bold', blurb: 'High contrast, confident, dramatic', headingFont: 'Space Grotesk', bodyFont: 'Inter', cornerStyle: 'rounded', borderStyle: 'none', iconStyle: 'filled', density: 'comfortable', scale: 'expressive', elevation: 'elevated', motionStyle: 'expressive', fill: 'solid', headingWeight: 700, btnWeight: 700, primary: '#4338ca', secondary: '#0a2540', tertiary: '#06b6d4' },
  playful: { label: 'Playful', blurb: 'Rounded, bright and friendly', headingFont: 'DM Sans', bodyFont: 'DM Sans', cornerStyle: 'full', borderStyle: 'none', iconStyle: 'filled', density: 'comfortable', scale: 'balanced', elevation: 'subtle', motionStyle: 'expressive', fill: 'tint', headingWeight: 700, btnWeight: 600, primary: '#16a34a', secondary: '#f97316', tertiary: '#a855f7' },
  soft: { label: 'Soft', blurb: 'Gentle pastels, airy and warm', headingFont: 'Plus Jakarta Sans', bodyFont: 'Plus Jakarta Sans', cornerStyle: 'curved', borderStyle: 'none', iconStyle: 'duotone', density: 'spacious', scale: 'balanced', elevation: 'subtle', motionStyle: 'subtle', fill: 'tint', headingWeight: 600, btnWeight: 500, primary: '#7c6cf3', secondary: '#ec4899', tertiary: '#14b8a6' },
  elegant: { label: 'Elegant', blurb: 'Editorial serif, refined and quiet', headingFont: 'Fraunces', bodyFont: 'Source Serif Pro', cornerStyle: 'angular', borderStyle: 'subtle', iconStyle: 'outlined', density: 'spacious', scale: 'expressive', elevation: 'flat', motionStyle: 'subtle', fill: 'outline', headingWeight: 600, btnWeight: 500, primary: '#1c1917', secondary: '#78716c', tertiary: '#b45309' },
  brutalist: { label: 'Brutalist', blurb: 'Raw, angular, high-contrast', headingFont: 'Space Grotesk', bodyFont: 'JetBrains Mono', cornerStyle: 'angular', borderStyle: 'outlined', iconStyle: 'sharp', density: 'compact', scale: 'expressive', elevation: 'flat', motionStyle: 'none', fill: 'solid', headingWeight: 700, btnWeight: 700, primary: '#000000', secondary: '#e11d48', tertiary: '#eab308' },
  technical: { label: 'Technical', blurb: 'Dense, mono, developer-grade', headingFont: 'Geist', bodyFont: 'Geist Mono', cornerStyle: 'slight', borderStyle: 'outlined', iconStyle: 'sharp', density: 'compact', scale: 'compact', elevation: 'flat', motionStyle: 'subtle', fill: 'solid', headingWeight: 600, btnWeight: 500, primary: '#1f883d', secondary: '#57606a', tertiary: '#0969da' },
  luxe: { label: 'Luxe', blurb: 'Black and gold, spacious, premium', headingFont: 'Playfair Display', bodyFont: 'Plus Jakarta Sans', cornerStyle: 'angular', borderStyle: 'subtle', iconStyle: 'outlined', density: 'spacious', scale: 'expressive', elevation: 'flat', motionStyle: 'subtle', fill: 'outline', headingWeight: 600, btnWeight: 500, primary: '#0c0a09', secondary: '#a16207', tertiary: '#44403c' }
}

/** The render treatment (fill + weights) for a feel, used by component previews. */
export function feelLook(vibe: Vibe): { fill: FillStyle; btnWeight: number; headingWeight: number } {
  const f = FEEL_PRESETS[vibe] ?? FEEL_PRESETS.minimal
  return { fill: f.fill, btnWeight: f.btnWeight, headingWeight: f.headingWeight }
}


/** The brief a design system is generated from (shown on the Overview page). */
export interface DSBrief {
  purpose: string
  style: string
  branding: string
  logo?: string
  shots?: string[]
  /** optional name of the reference UI the screenshots are from */
  refName?: string
  /** the brand/company name shown inside generated components */
  brandName?: string
}

/** Style signals deduced client-side from reference screenshots (the AI is text-only). */
export interface RefProfile {
  base: BaseTheme
  tone: 'vibrant' | 'muted' | 'neutral'
  palette: string[]
}

/**
 * One component the system has decided it has.
 *
 * A design system that lists `Button` and stops has documented a word. What
 * makes it usable is the variants — the four buttons a person must choose
 * between — and the states, because every argument about a component is
 * really an argument about what it looks like when it is disabled.
 */
export interface DSComponent {
  /** The key into the component catalogue, e.g. `Button`. */
  id: string
  /** Which of it exist here: Primary, Secondary, Destructive. */
  variants: string[]
  /** Default, Hover, Focus, Active, Disabled, Loading. */
  states: string[]
  /** When to reach for it, and when not to. */
  usage?: string
  /** What it must do for a keyboard and a screen reader. */
  accessibility?: string
  /** A snippet showing it in use. */
  code?: string
}

/**
 * A pattern is several components arranged to do one job.
 *
 * Sign-up is not a component and never will be: it is a form, some feedback
 * and a link, agreed once so that the second sign-up screen matches the first.
 */
export interface DSPattern {
  id: string
  name: string
  /** The components it is built from, by their catalogue ids. */
  uses: string[]
  notes?: string
}

/** How the page itself is arranged, above and around any component. */
export interface DSLayout {
  id: string
  name: string
  notes?: string
}

/**
 * The written rules, kept apart from the AI rules.
 *
 * `AiRules` are toggles a generator obeys. These are sentences a person
 * reads, and the two are not interchangeable: "never use emoji as icons" can
 * be enforced, "prefer the active voice" can only be explained.
 */
export interface DSGuidelines {
  componentUsage?: string
  accessibility?: string
  content?: string
  interaction?: string
  responsive?: string
  /** Paired sentences: what to do, and the thing people keep doing instead. */
  dos?: string[]
  donts?: string[]
}

/** Short documentation notes per foundation, written by the AI (or left empty). */
export interface DSDocs {
  overview?: string
  colors?: string
  typography?: string
  spacing?: string
  radius?: string
  elevation?: string
  motion?: string
  grid?: string
  icons?: string
}

export interface DesignSystem {
  id: string
  name: string
  vibe: Vibe
  productType?: string
  personality?: string[]
  notes?: string
  /** the brief the system was generated from (Overview page) */
  brief?: DSBrief
  /** AI-written documentation notes per foundation */
  docs?: DSDocs
  /** anti-AI-default rules enforced when generating with this system */
  rules?: AiRules
  /**
   * The token library this system stands on.
   *
   * A system without one is a system whose colours came from nowhere and
   * agree with nothing. Every system made from now on gets a library, and the
   * values below are read back out of it rather than kept as a second
   * original — see `applyStudioToSystem`. Optional only because systems saved
   * before this existed are still on disk.
   */
  tokensId?: string
  /** Which theme of that library the system is drawn in. */
  tokensThemeId?: string
  /** The components this system says it has, with their variants and states. */
  components?: DSComponent[]
  /** Jobs made of several components, agreed once. */
  patterns?: DSPattern[]
  /** How the page is arranged around all of it. */
  layouts?: DSLayout[]
  /** The rules a person reads, as opposed to the ones a generator obeys. */
  guidelines?: DSGuidelines
  base: BaseTheme
  colors: {
    primary: string
    secondary: string
    tertiary: string
    bg: string
    surface: string
    text: string
    textMuted: string
    border: string
    success: string
    warning: string
    error: string
    info: string
  }
  font: { family: string; heading: string }
  /** type scale in px */
  type: { xs: number; sm: number; base: number; md: number; lg: number; xl: number; xxl: number; xxxl: number }
  weights: { regular: number; medium: number; semibold: number; bold: number }
  /** spacing scale in px (4px grid) */
  spacing: number[]
  radii: { sm: number; md: number; lg: number; pill: number }
  shadow: 'off' | 'subtle' | 'medium' | 'strong'
  /** chosen corner shape + how boxes are outlined (drive every component preview) */
  cornerStyle?: CornerStyle
  borderStyle?: BorderStyle
  iconStyle?: IconStyle
  density?: Density
  motion: { fast: number; normal: number; slow: number; easing: string }
}

/** Radii per granular corner style. Squircle reuses curved radii + a continuous-corner flag. */
const CORNER_STYLE_RADII: Record<CornerStyle, DesignSystem['radii']> = {
  angular: { sm: 1, md: 2, lg: 3, pill: 999 },
  slight: { sm: 3, md: 5, lg: 8, pill: 999 },
  rounded: { sm: 6, md: 10, lg: 16, pill: 999 },
  curved: { sm: 10, md: 16, lg: 24, pill: 999 },
  full: { sm: 14, md: 22, lg: 32, pill: 999 },
  squircle: { sm: 8, md: 14, lg: 22, pill: 999 }
}

/** Map a legacy 3-way corners value onto the granular scale (for migration). */
export function cornerStyleFromCorners(c: Corners | undefined): CornerStyle {
  return c === 'sharp' ? 'angular' : c === 'pill' ? 'full' : 'rounded'
}
/** The radii preset for a granular corner style (used for live dashboard edits). */
export function radiiForCorner(c: CornerStyle): DesignSystem['radii'] {
  return CORNER_STYLE_RADII[c]
}

const SCALE_RATIO: Record<ScaleChoice, number> = { compact: 1.2, balanced: 1.25, expressive: 1.333 }

const DENSITY_SPACING: Record<Density, number[]> = {
  compact: [2, 4, 8, 12, 16, 24, 32, 48, 64],
  cozy: [4, 8, 12, 16, 20, 28, 40, 56, 80],
  comfortable: [4, 8, 12, 16, 24, 32, 48, 64, 96],
  spacious: [4, 8, 16, 24, 32, 48, 64, 96, 128]
}
const DENSITY_BASE: Record<Density, number> = { compact: 14, cozy: 15, comfortable: 16, spacious: 17 }

const MOTION_DEF: Record<MotionStyle, DesignSystem['motion']> = {
  none: { fast: 0, normal: 0, slow: 0, easing: 'linear' },
  subtle: { fast: 120, normal: 200, slow: 300, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  expressive: { fast: 180, normal: 280, slow: 440, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
}

const ELEVATION_SHADOW: Record<Elevation, DesignSystem['shadow']> = { flat: 'off', subtle: 'subtle', elevated: 'medium' }

const LIGHT = { bg: '#ffffff', surface: '#f8fafc', text: '#0f172a', textMuted: '#64748b', border: '#e2e8f0' }
const DARK = { bg: '#0b0f17', surface: '#111827', text: '#f1f5f9', textMuted: '#94a3b8', border: '#1f2937' }

/** Build a type scale around a base using a modular ratio. */
function typeScale(base: number, ratio: number): DesignSystem['type'] {
  const up = (n: number): number => Math.round(base * Math.pow(ratio, n))
  return { xs: Math.round(base * 0.8), sm: Math.round(base * 0.9), base, md: up(1), lg: up(2), xl: up(3), xxl: up(4), xxxl: up(5) }
}

export interface SystemAnswers {
  name: string
  vibe: Vibe
  primary: string
  secondary: string
  tertiary: string
  base: BaseTheme
  headingFont: string
  bodyFont: string
  cornerStyle: CornerStyle
  borderStyle: BorderStyle
  iconStyle: IconStyle
  density: Density
  /** type scale ratio + elevation + motion (atomic-design controls) */
  scale: ScaleChoice
  elevation: Elevation
  motionStyle: MotionStyle
  /** anti-AI-default rule toggles */
  rules: AiRules
  notes: string
  /** brief fields (Phase 2 AI-orchestrated creation) */
  purpose: string
  style: string
  branding: string
  logo?: string
  shots?: string[]
  /** optional name of the reference UI (drives company-style conventions) */
  refName: string
  /** brand/company name rendered inside generated components */
  brandName: string
}

/** Choose the closest feel for a reference's deduced base + tone. */
export function feelFromProfile(p: RefProfile): Vibe {
  if (p.base === 'dark') return p.tone === 'vibrant' ? 'bold' : 'technical'
  if (p.tone === 'vibrant') return 'playful'
  if (p.tone === 'muted') return 'soft'
  return 'minimal'
}

/** Apply a reference profile: closest feel for structure, the reference's own colours + base. */
export function applyReference(a: SystemAnswers, p: RefProfile): SystemAnswers {
  const next = applyFeel(a, feelFromProfile(p))
  return {
    ...next, base: p.base,
    primary: p.palette[0] ?? next.primary,
    secondary: p.palette[1] ?? next.secondary,
    tertiary: p.palette[2] ?? next.tertiary
  }
}

let idc = 0
export function newSystemId(): string {
  return `ds${Date.now().toString(36)}${(idc++).toString(36)}${Math.floor(Math.random() * 1e3).toString(36)}`
}

/** Apply a feel preset to the current answers (fonts, shape, colors, treatment). */
export function applyFeel(a: SystemAnswers, vibe: Vibe): SystemAnswers {
  const f = FEEL_PRESETS[vibe]
  return {
    ...a, vibe,
    headingFont: f.headingFont, bodyFont: f.bodyFont,
    cornerStyle: f.cornerStyle, borderStyle: f.borderStyle, iconStyle: f.iconStyle,
    density: f.density, scale: f.scale, elevation: f.elevation, motionStyle: f.motionStyle,
    primary: f.primary, secondary: f.secondary, tertiary: f.tertiary
  }
}

// ── Vision analysis (real: images passed to the model via --attachment) ───────
const VIBE_VALUES = Object.keys(FEEL_PRESETS) as Vibe[]

/** Prompt asking a vision model to read the attached UI screenshots and map them to our tokens. */
export function buildVisionPrompt(): string {
  return [
    'You are a senior design engineer. Carefully study the attached UI screenshot(s) and reverse-engineer the design system they came from. Do NOT default to generic values — read what the screenshots ACTUALLY show, and be decisive.',
    '',
    'Look closely and decide each of these:',
    '- Corner radius: are corners sharp/square, slightly rounded (~4px), rounded (~8-12px), very rounded (~16-24px), fully rounded / pill, or squircle? Buttons and cards that look like pills or very round must map to "full" or "curved", not "rounded".',
    '- Typography: is it a sans-serif, a serif, a monospace, or a display face? Name the closest well-known family.',
    '- Density / spacing: is the layout tight/compact, balanced, or airy/spacious?',
    '- Borders & elevation: do cards/inputs have visible outlines, soft drop shadows, or are they flat?',
    '- Icons: thin outlined line icons, solid filled, or sharp/angular?',
    '- Light or dark interface.',
    '- The real brand + accent colours: sample actual hex values from the pixels (the dominant brand colour, secondary, and an accent).',
    '- If the screenshots clearly belong to a known product or company, name it.',
    '',
    'Return ONLY a JSON object (no prose, no markdown fence) with this exact shape:',
    '{',
    '  "product": "recognised product or company name, else empty string",',
    `  "feel": one of ${VIBE_VALUES.join(' | ')},`,
    '  "base": "light" | "dark",',
    '  "headingFont": "closest font family name (e.g. Inter, Geist, IBM Plex Sans, Space Grotesk, DM Sans, Plus Jakarta Sans, Fraunces, Playfair Display, JetBrains Mono)",',
    '  "bodyFont": "closest font family name",',
    '  "cornerStyle": "angular" | "slight" | "rounded" | "curved" | "full" | "squircle",',
    '  "borderStyle": "outlined" | "subtle" | "none",',
    '  "density": "compact" | "cozy" | "comfortable" | "spacious",',
    '  "elevation": "flat" | "subtle" | "elevated",',
    '  "iconStyle": "outlined" | "filled" | "duotone" | "sharp",',
    '  "colors": { "primary": "#RRGGBB", "secondary": "#RRGGBB", "tertiary": "#RRGGBB", "success": "#RRGGBB", "warning": "#RRGGBB", "error": "#RRGGBB", "info": "#RRGGBB" },',
    '  "notes": "one short sentence describing the style"',
    '}',
    'All colours must be 6-digit hex. Be specific and faithful to the screenshots, not to safe defaults.'
  ].join('\n')
}

function oneOf<T extends string>(v: unknown, vals: readonly T[], cur: T): T {
  return typeof v === 'string' && (vals as readonly string[]).includes(v) ? (v as T) : cur
}

/** Map a parsed vision analysis onto the answers (validating every field). */
export function applyVisionAnalysis(a: SystemAnswers, parsed: unknown): SystemAnswers {
  if (!parsed || typeof parsed !== 'object') return a
  const p = parsed as Record<string, unknown>
  const out: SystemAnswers = { ...a }
  out.vibe = oneOf(p.feel, VIBE_VALUES, out.vibe)
  out.base = oneOf(p.base, ['light', 'dark'] as const, out.base)
  out.cornerStyle = oneOf(p.cornerStyle, ['angular', 'slight', 'rounded', 'curved', 'full', 'squircle'] as const, out.cornerStyle)
  out.borderStyle = oneOf(p.borderStyle, ['outlined', 'subtle', 'none'] as const, out.borderStyle)
  out.density = oneOf(p.density, ['compact', 'cozy', 'comfortable', 'spacious'] as const, out.density)
  out.elevation = oneOf(p.elevation, ['flat', 'subtle', 'elevated'] as const, out.elevation)
  out.iconStyle = oneOf(p.iconStyle, ['outlined', 'filled', 'duotone', 'sharp'] as const, out.iconStyle)
  if (typeof p.headingFont === 'string' && p.headingFont.trim()) out.headingFont = p.headingFont.trim().slice(0, 40)
  if (typeof p.bodyFont === 'string' && p.bodyFont.trim()) out.bodyFont = p.bodyFont.trim().slice(0, 40)
  const c = p.colors
  if (c && typeof c === 'object') {
    const cc = c as Record<string, unknown>
    for (const k of ['primary', 'secondary', 'tertiary'] as const) {
      const v = cc[k]
      if (typeof v === 'string' && hex6.test(v.trim())) out[k] = v.trim()
    }
  }
  if (typeof p.product === 'string' && p.product.trim()) out.refName = p.product.trim().slice(0, 60)
  if (typeof p.notes === 'string' && p.notes.trim()) out.style = p.notes.trim().slice(0, 200)
  return out
}

/** Deterministically generate a full design system from the questionnaire. */
export function generateSystem(a: SystemAnswers): DesignSystem {
  const surf = a.base === 'dark' ? DARK : LIGHT
  const brief: DSBrief | undefined =
    a.purpose.trim() || a.style.trim() || a.branding.trim() || a.logo || (a.shots && a.shots.length) || a.refName.trim() || a.brandName.trim()
      ? { purpose: a.purpose.trim(), style: a.style.trim(), branding: a.branding.trim(), logo: a.logo, shots: a.shots, refName: a.refName.trim() || undefined, brandName: a.brandName.trim() || undefined }
      : undefined
  return {
    id: newSystemId(),
    name: a.name.trim() || 'My design system',
    vibe: a.vibe,
    notes: a.notes.trim() || undefined,
    brief,
    base: a.base,
    colors: {
      primary: a.primary,
      secondary: a.secondary,
      tertiary: a.tertiary,
      bg: surf.bg,
      surface: surf.surface,
      text: surf.text,
      textMuted: surf.textMuted,
      border: surf.border,
      success: '#16a34a',
      warning: '#d97706',
      error: '#dc2626',
      info: '#2563eb'
    },
    font: { family: a.bodyFont || 'Plus Jakarta Sans', heading: a.headingFont || a.bodyFont || 'Plus Jakarta Sans' },
    type: typeScale(DENSITY_BASE[a.density], SCALE_RATIO[a.scale ?? FEEL_PRESETS[a.vibe].scale]),
    weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    spacing: DENSITY_SPACING[a.density],
    radii: CORNER_STYLE_RADII[a.cornerStyle],
    cornerStyle: a.cornerStyle,
    borderStyle: a.borderStyle,
    iconStyle: a.iconStyle,
    density: a.density,
    shadow: ELEVATION_SHADOW[a.elevation] ?? ELEVATION_SHADOW[FEEL_PRESETS[a.vibe].elevation],
    motion: MOTION_DEF[a.motionStyle] ?? MOTION_DEF[FEEL_PRESETS[a.vibe].motionStyle],
    rules: a.rules
  }
}

export const DEFAULT_ANSWERS: SystemAnswers = {
  name: '', vibe: 'minimal', primary: '#0e7490', secondary: '#475569', tertiary: '#ea580c',
  base: 'light', headingFont: 'Plus Jakarta Sans', bodyFont: 'Plus Jakarta Sans',
  cornerStyle: 'rounded', borderStyle: 'outlined', iconStyle: 'outlined', density: 'comfortable', scale: 'balanced', elevation: 'subtle', motionStyle: 'subtle',
  rules: defaultAiRules(), notes: '',
  purpose: '', style: '', branding: '', logo: undefined, shots: undefined, refName: '', brandName: ''
}

/** Rule ids relevant to a design system (subset shown in the wizard + fed to the AI). */
export const DS_RULE_IDS: string[] = [
  'no-gradients', 'flat-surfaces', 'no-card-outlines', 'one-dominant-color', 'no-default-palette',
  'no-emoji-icons', 'no-icon-containers', 'no-all-caps', 'distinct-fonts', 'avoid-default-serif',
  'no-em-dash', 'no-unsolicited-subtext', 'subtle-motion', 'reduced-motion', 'a11y-contrast'
]
/** The design-system rules in catalog order (for the wizard toggle UI). */
export const DS_RULES = AI_RULES.filter((r) => DS_RULE_IDS.includes(r.id))
/** Active (enabled) DS rule ids for a given toggle map. */
export function dsActiveRuleIds(rules: AiRules | undefined): string[] {
  return DS_RULE_IDS.filter((id) => !rules || rules[id] !== false)
}

const KEY = 't42-design-systems'
const LEGACY_KEY = 't42-design-system'

function valid(s: unknown): s is DesignSystem {
  return !!s && typeof s === 'object' && 'colors' in (s as Record<string, unknown>) && 'type' in (s as Record<string, unknown>)
}

/** Load the whole collection of design systems (migrating any legacy single one). */
export function loadSystems(): DesignSystem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr.filter(valid)
    }
    // migrate a legacy single design system into the collection
    const old = localStorage.getItem(LEGACY_KEY)
    if (old) {
      const s = JSON.parse(old)
      if (valid(s)) {
        const withId: DesignSystem = { ...s, id: s.id || newSystemId() }
        saveSystems([withId])
        localStorage.removeItem(LEGACY_KEY)
        return [withId]
      }
    }
    return []
  } catch {
    return []
  }
}

export function saveSystems(list: DesignSystem[]): DesignSystem[] {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* ignore */ }
  return list
}

/** Insert or update a single system in the collection. */
export function upsertSystem(s: DesignSystem): DesignSystem[] {
  const list = loadSystems()
  const i = list.findIndex((x) => x.id === s.id)
  if (i >= 0) list[i] = s
  else list.push(s)
  return saveSystems(list)
}

export function deleteSystem(id: string): DesignSystem[] {
  return saveSystems(loadSystems().filter((s) => s.id !== id))
}

export const SHADOW_CSS: Record<DesignSystem['shadow'], string> = {
  off: 'none',
  subtle: '0 1px 3px rgba(15,23,42,0.08)',
  medium: '0 4px 12px rgba(15,23,42,0.10)',
  strong: '0 12px 32px rgba(15,23,42,0.16)'
}

/** Return a copy of the system with its neutral surfaces swapped to a base theme
 * (keeps the brand + semantic colors). Used by the component preview theme toggle. */
export function applyBase(s: DesignSystem, base: BaseTheme): DesignSystem {
  const n = base === 'dark' ? DARK : LIGHT
  return { ...s, base, colors: { ...s.colors, bg: n.bg, surface: n.surface, text: n.text, textMuted: n.textMuted, border: n.border } }
}

// ── AI orchestration ─────────────────────────────────────────────────────────
// canvas.assist is text-only, so uploaded images are reduced to a palette client-
// side and passed as hex. The AI refines the brand/semantic palette and writes the
// documentation notes; structural tokens stay deterministic (from the user's
// explicit vibe / density / corners choices) for safety + speed.

const hex6 = /^#[0-9a-fA-F]{6}$/

/**
 * What a system already stands on, for the prompt.
 *
 * A system built on a library has had its colour, type and shape answered
 * before the model is asked anything. Without this the model is handed the
 * wizard's untouched defaults and writes documentation about them: a system
 * whose primary is a sage green got a colour page reading "teal primary with
 * slate neutral", which is not a small wording problem, it is the page lying
 * about the system it documents.
 */
export type SystemBasis = {
  /** The library's name, so the docs can say what this stands on. */
  name: string
  /** The library's resolved values, as `formatTokensForPrompt` writes them. */
  tokens: string
  patterns?: string[]
  layouts?: string[]
  components?: string[]
}

/** Build the strict-JSON prompt sent to canvas.assist for a design system brief. */
export function buildSystemPrompt(a: SystemAnswers, palette: string[], basis?: SystemBasis | null): string {
  const pal = palette.filter((c) => hex6.test(c)).slice(0, 6)
  const lines = [
    'You are a senior design-systems lead. Read the brief and produce a refined brand palette and concise documentation for a design system.',
    '',
    'Brief:',
    `- Name: ${a.name.trim() || '(unnamed)'}`,
    `- Purpose / product / audience: ${a.purpose.trim() || '(not given)'}`,
    `- Style direction: ${a.style.trim() || a.vibe}`,
    `- Branding notes: ${a.branding.trim() || '(none)'}`,
    `- Overall vibe: ${a.vibe}`,
    `- Base theme: ${a.base}`,
    basis ? '' : `- Chosen brand colors: primary ${a.primary}, secondary ${a.secondary}, tertiary ${a.tertiary}`,
    basis ? '' : (pal.length ? `- Colors sampled from the uploaded logo/screenshots: ${pal.join(', ')}` : '- No image colors provided'),
    basis ? '' : `- Heading font: ${a.headingFont}; Body font: ${a.bodyFont}`,
    basis ? '' : `- Corners: ${a.cornerStyle}; Borders: ${a.borderStyle}; Icons: ${a.iconStyle}; Density: ${a.density}; Type scale: ${a.scale}; Elevation: ${a.elevation}; Motion: ${a.motionStyle}`,
    basis ? `- Icons: ${a.iconStyle}` : '',
    a.notes.trim() ? `- Extra notes: ${a.notes.trim()}` : '',
    (a.shots && a.shots.length) ? `- Reference UI screenshots were provided (${a.shots.length}). Match their look closely: keep the palette above and the ${a.base} base faithful to the references, and choose tokens that fit that style. Only fall back to sensible defaults where the references give no signal (for example exact fonts or motion).` : '',
    a.refName.trim() ? `- The user says the references resemble: ${a.refName.trim()}. Follow that product's known visual conventions where appropriate.` : '',
    ...(basis ? basisLines(basis) : []),
    '',
    formatRulesForPrompt(dsActiveRuleIds(a.rules)),
    '',
    'Return ONLY a JSON object (no prose, no markdown fence) with this exact shape:',
    '{',
    '  "name": "short refined name (optional, keep theirs if good)",',
    basis ? '' : '  "colors": { "primary": "#RRGGBB", "secondary": "#RRGGBB", "tertiary": "#RRGGBB", "success": "#RRGGBB", "warning": "#RRGGBB", "error": "#RRGGBB", "info": "#RRGGBB" },',
    '  "docs": {',
    '    "overview": "One short sentence: what this system is for.",',
    '    "colors": "One short sentence on palette roles.",',
    '    "typography": "One short sentence on the type approach.",',
    '    "spacing": "One short sentence on spacing rhythm.",',
    '    "radius": "One short sentence on corner usage.",',
    '    "elevation": "One short sentence on elevation usage.",',
    '    "motion": "One short sentence on motion intent.",',
    '    "grid": "One short sentence on how layouts are aligned.",',
    '    "icons": "One short sentence on the icon style."',
    '  }',
    '}',
    basis
      ? 'Rules: the values above are already decided and you may not change or propose any. Describe what is there, in words a designer would say out loud: write the real colors, font names and numbers (for example "sage green", "#7b8b7c", "Lato", "8px"), never a token or CSS variable name such as --colour-brand, and never a color the library does not contain. Each doc value must be ONE short, plain sentence (max ~16 words), specific to THIS system, no marketing fluff, no all-caps, no dashes of any kind (no em or en dashes), use commas or the word "to" instead.'
      : 'Rules: keep brand colors close to the chosen/sampled ones unless they clash with the brief. All colors must be 6-digit hex. Each doc value must be ONE short, plain sentence (max ~16 words), specific to THIS brief, no marketing fluff, no all-caps, no dashes of any kind (no em or en dashes), use commas or the word "to" instead.'
  ]
  return lines.filter(Boolean).join('\n')
}

/** The library and the coverage, written out under the brief. */
function basisLines(basis: SystemBasis): string[] {
  const out: string[] = [
    '',
    `This system stands on the token library "${basis.name}". Its values are already decided:`,
    basis.tokens
  ]
  if (basis.components?.length) out.push(`- Components it documents: ${basis.components.join(', ')}`)
  if (basis.patterns?.length) out.push(`- Patterns it covers: ${basis.patterns.join(', ')}`)
  if (basis.layouts?.length) out.push(`- Layouts it covers: ${basis.layouts.join(', ')}`)
  return out
}

function cleanDocStr(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim().replace(/\s*[\u2013\u2014]\s*/g, ' - ').replace(/[\u2013\u2014]/g, '-') // no em/en dashes
  // A sentence that recites variable names ("combines --colour-brand and
  // --colour-background") documents nothing a reader could not already see in
  // the token table. No note is better than a note that says the same thing twice.
  if (/--[a-z0-9]+(-[a-z0-9]+)+/i.test(t)) return undefined
  return t ? t.slice(0, 180) : undefined
}

/** Merge a parsed AI result onto a deterministic base system. Invalid fields are ignored. */
export function applyAiSystem(base: DesignSystem, parsed: unknown, opts?: { colors?: boolean; name?: boolean }): DesignSystem {
  if (!parsed || typeof parsed !== 'object') return base
  const applyColors = opts?.colors !== false
  // A name the user typed is an answer, not a gap. Someone who calls their
  // system "Basis probe" and gets back "Teal" has been told their answer did
  // not count, and has to rename it by hand to undo a step they never asked
  // for. The model only gets to name the ones nobody named.
  const applyName = opts?.name !== false
  const p = parsed as Record<string, unknown>
  const out: DesignSystem = { ...base, colors: { ...base.colors } }
  if (applyName && typeof p.name === 'string' && p.name.trim()) out.name = p.name.trim().slice(0, 60)
  const c = p.colors
  if (applyColors && c && typeof c === 'object') {
    for (const k of ['primary', 'secondary', 'tertiary', 'success', 'warning', 'error', 'info'] as const) {
      const v = (c as Record<string, unknown>)[k]
      if (typeof v === 'string' && hex6.test(v.trim())) out.colors[k] = v.trim()
    }
  }
  const d = p.docs
  if (d && typeof d === 'object') {
    const dd = d as Record<string, unknown>
    const docs: DSDocs = {
      overview: cleanDocStr(dd.overview), colors: cleanDocStr(dd.colors), typography: cleanDocStr(dd.typography),
      spacing: cleanDocStr(dd.spacing), radius: cleanDocStr(dd.radius), elevation: cleanDocStr(dd.elevation),
      motion: cleanDocStr(dd.motion), grid: cleanDocStr(dd.grid), icons: cleanDocStr(dd.icons)
    }
    if (Object.values(docs).some(Boolean)) out.docs = docs
  }
  return out
}

/** Extract a small JSON object from a (possibly fenced / chatty) model reply. */
export function parseSystemReply(raw: string): unknown {
  let s = raw.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) s = fence[1].trim()
  const start = s.indexOf('{')
  if (start < 0) return null
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(s.slice(start, i + 1)) } catch { return null } } }
  }
  return null
}
