// Public design domain types, extracted from design.ts so the runtime module
// stays focused on IPC/process logic. These are pure type declarations with no
// runtime dependencies.

export type DesignRole = 'user' | 'assistant' | 'system'
export type DesignStatus = 'pending' | 'streaming' | 'done' | 'error' | 'cancelled'

export type DesignToolCall = {
  id: string
  name: string
  input?: string
  status: 'running' | 'done' | 'error'
  summary?: string
}

export type DesignMessage = {
  id: string
  designId: string
  role: DesignRole
  content: string
  toolCalls: DesignToolCall[]
  status: DesignStatus
  createdAt: number
}

export type DesignKind =
  | 'landing' | 'app-screen' | 'dashboard' | 'pricing' | 'login' | 'email' | 'hero' | 'component'
  | 'pitch-deck' | 'talk-slides' | 'sales-deck' | 'workshop-deck'
  | 'blog-post' | 'resume' | 'one-pager' | 'brochure' | 'case-study'
  | 'poster' | 'flyer' | 'invitation' | 'business-card' | 'certificate'
  | 'infographic' | 'report' | 'chart'
  | 'social-post' | 'social-story' | 'cover-image' | 'ad-banner'
  | 'design-system' | 'component-library' | 'wireframe' | 'mood-board' | 'style-tile' | 'user-flow' | 'sitemap'
  | 'freeform'
  | 'blank'

export type DesignGroup = 'web' | 'presentation' | 'content' | 'print' | 'data' | 'social' | 'figma' | 'other'
export type DesignFidelity = 'wireframe' | 'highfidelity'

export type DesignBrief = {
  v: 1
  kind: DesignKind
  kindLabel: string
  group: DesignGroup
  subtype?: string | null
  surface?: 'mobile' | 'tablet' | 'desktop' | 'responsive' | null
  fidelity: DesignFidelity
  look?: string | null
  lookLabel?: string | null
  designSystem?: string | null
  designSystemLabel?: string | null
  /**
   * The token library this design is bound to, and which of its themes.
   *
   * Optional because a design made before libraries existed has none and must
   * keep generating exactly as it did. When present the generation prompt
   * carries the library's names and the folder carries its files.
   */
  basisId?: string | null
  basisThemeId?: string | null
  /**
   * The fingerprint of the library as it was when this design last had the
   * files written beside it.
   *
   * Kept so the app can say "the library moved" without storing a copy of the
   * library on every design. Absent on a design generated before stamping
   * existed, which reads as "no opinion" rather than as drift: claiming a
   * design is stale on no evidence is worse than saying nothing.
   */
  basisStamp?: string | null
  audience?: string | null
  paletteId?: string | null
  paletteLabel?: string | null
  paletteColors?: string[] | null
  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
  fontPairId?: string | null
  fontPrimary?: string | null
  fontSecondary?: string | null
  fontTertiary?: string | null
  fontPrimaryLabel?: string | null
  fontSecondaryLabel?: string | null
  fontTertiaryLabel?: string | null
  fontHeading?: string | null
  fontBody?: string | null
  customFonts?: string | null
  iconLibraryId?: string | null
  iconLibraryLabel?: string | null
  iconStyleId?: string | null
  iconStyleLabel?: string | null
  theme?: 'light' | 'dark' | 'auto' | 'both' | null
  density?: 'compact' | 'comfortable' | 'spacious' | null
  spacing?: 'tight' | 'standard' | 'spacious' | null
  grid?: '4col' | '8col' | '12col' | '16col' | 'flex' | null
  motion?: 'none' | 'subtle' | 'expressive' | null
  customMotion?: string | null
  stack?: string | null
  stackLabel?: string | null
  customStack?: string | null
  shapeRadius?: 'sharp' | 'soft' | 'rounded' | 'pill' | null
  shapeRadiusLabel?: string | null
  shapeShadow?: 'none' | 'subtle' | 'medium' | 'strong' | null
  shapeShadowLabel?: string | null
  shapeBorders?: 'none' | 'thin' | 'standard' | 'strong' | null
  shapeBordersLabel?: string | null
  shapeSurface?: 'filled' | 'outlined' | 'glass' | 'neumorphic' | 'gradient' | null
  shapeSurfaceLabel?: string | null
  secondaryButton?: 'outlined' | 'ghost' | 'soft' | 'neutral' | 'accent' | 'underline' | 'same-as-primary' | null
  secondaryButtonLabel?: string | null
  inspiration?: string | null
  figmaUrl?: string | null
  templateFile?: string | null
  useTemplateLook?: boolean
  idea?: string | null
  contextDescription?: string | null
  contextProblem?: string | null
  contextGoal?: string | null
  contextKeyFeatures?: string | null
  contextSuccess?: string | null
  inspirationImages?: string[] | null
  planNotes?: string | null
  aiRules?: Record<string, boolean> | null
  customAvoid?: string | null
  decisions?: string[] | null
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

export type Design = {
  id: string
  title: string
  cwd: string
  copilotSessionId: string | null
  currentVersion: string | null
  brief: DesignBrief | null
  createdAt: number
  lastActiveAt: number
}

export type DesignVersion = {
  id: string
  designId: string
  fileName: string
  filePath: string
  fileUrl: string
  size: number
  modifiedAt: number
  kind?: 'html' | 'pptx'
  /** When kind === 'pptx', the file URL of the converted .pdf preview if it exists. */
  previewUrl?: string | null
}

export type DesignProgressStep = {
  id: string
  label: string
  status: 'running' | 'done' | 'error'
  startedAt: number
}

/**
 * What the list needs to know about a design's library, and nothing more.
 *
 * `bound` is false for a design with no library and for one whose library has
 * been deleted, because from the list's point of view they are the same thing:
 * there is nothing to show and nothing to re-sync.
 */
export type BasisStatus = {
  bound: boolean
  name: string | null
  moved: boolean
  /**
   * The design names a library that is no longer there.
   *
   * Distinct from `bound: false`, which means nobody ever asked for one. A
   * design in this state still says it is bound everywhere else in the app,
   * while nothing is being put in its prompt and nothing is being checked, so
   * it has to be able to say so.
   */
  missing: boolean
}
