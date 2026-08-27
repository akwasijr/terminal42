import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { SessionInsights } from '../shared/sessionInsights'
import type { MotionRecord, MotionLayoutRecord, MotionBentoRecord, BrandSetRecord } from '../main/motion'
import type { TokenStudioRecord } from '../main/tokens'

export type { SessionInsights }

export type Project = {
  id: string
  name: string
  path: string
  color: string | null
  created_at: number
  last_opened_at: number
  auto_launch_copilot: number
}

export type Session = {
  id: string
  project_id: string | null
  title: string
  copilot_session_id: string | null
  model: string | null
  pinned: number
  created_at: number
  last_active_at: number
  title_locked: number
}

export type ComposerEntry = { id: number; body: string; created_at: number }

export type ChatToolCall = {
  id: string
  name: string
  input?: string
  status: 'running' | 'done' | 'error'
  summary?: string
}

/** A page a turn wrote, worth showing rather than describing. `path` is
 *  absolute when the tool gave an absolute path, otherwise relative to `cwd`. */
export type ChatArtifact = {
  sessionId: string
  path: string
  cwd: string
  // Set when the turn started a local server for this page. The page must be
  // opened through it: loaded from disk, its own requests fail.
  serverOrigin?: string | null
}

export type ChatFileChange = {
  path: string
  status: 'added' | 'modified' | 'deleted'
  additions: number
  deletions: number
  binary: boolean
}

export type ChatDiff = {
  files: ChatFileChange[]
  additions: number
  deletions: number
}

export type ChatMessage = {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls: ChatToolCall[]
  status: 'pending' | 'streaming' | 'done' | 'error' | 'cancelled'
  createdAt: number
  diff?: ChatDiff | null
  undone?: boolean
}

export type DesignVersion = {
  id: string
  designId: string
  fileName: string
  filePath: string
  fileUrl: string
  size: number
  modifiedAt: number
  /** 'html' (default) or 'pptx': drives how the canvas renders this version. */
  kind?: 'html' | 'pptx'
  /** When kind === 'pptx', file URL of the converted .pdf preview if it exists. */
  previewUrl?: string | null
}

/** Whether a design's token library has moved under it since it was built. */
export type TokensStatus = {
  bound: boolean
  name: string | null
  moved: boolean
  /** The design names a library that is no longer there. */
  missing: boolean
}

export type DesignProgressStep = {
  id: string
  label: string
  status: 'running' | 'done' | 'error'
  startedAt: number
}

export type DesignKind =
  | 'website' | 'landing' | 'email'
  | 'app' | 'dashboard' | 'component-library'
  | 'pitch-deck' | 'talk-slides' | 'sales-deck' | 'workshop-deck'
  | 'blog-post' | 'resume' | 'one-pager' | 'brochure' | 'case-study'
  | 'poster' | 'flyer' | 'invitation' | 'business-card' | 'certificate'
  | 'infographic' | 'report' | 'chart'
  | 'social-post' | 'social-story' | 'cover-image' | 'ad-banner'
  | 'design-system' | 'wireframe' | 'mood-board' | 'style-tile' | 'user-flow' | 'sitemap'
  | 'freeform'
  | 'blank'
  // Deprecated: old briefs only.
  | 'app-screen' | 'pricing' | 'login' | 'hero' | 'component'

export type DesignGroup = 'web' | 'app' | 'presentation' | 'content' | 'print' | 'data' | 'social' | 'figma' | 'other'
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
  decisions?: string[] | null
  target?: 'html' | 'figma'
  figmaMode?: 'newFile' | 'existingFile'
  figmaTargetUrl?: string | null
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
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls: DesignToolCall[]
  status: 'pending' | 'streaming' | 'done' | 'error' | 'cancelled'
  createdAt: number
}

// ----- Loom (research/synthesis workspace) -------------------------------

export type Loom = {
  id: string
  title: string
  cwd: string
  summary: string | null
  responseStyle: string | null
  templateId: string | null
  copilotSessionId: string | null
  projectId: string | null
  createdAt: number
  lastActiveAt: number
}

export type LoomSourceKind = 'paste' | 'url' | 'file' | 'folder' | 'session'

export type LoomSource = {
  id: string
  loomId: string
  kind: LoomSourceKind | string
  title: string
  originUrl: string | null
  originPath: string | null
  originRefType: string | null
  originRefId: string | null
  mimeType: string | null
  byteSize: number | null
  charCount: number | null
  summary: string | null
  status: 'pending' | 'ready' | 'error' | string
  summaryStatus: 'pending' | 'running' | 'done' | 'error' | 'skipped' | string
  error: string | null
  included: boolean
  createdAt: number
  updatedAt: number
}

export type LoomToolCall = {
  id: string
  name: string
  input?: string
  status: 'running' | 'done' | 'error'
  summary?: string
}

export type LoomMessage = {
  id: string
  loomId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls: LoomToolCall[]
  status: 'pending' | 'streaming' | 'done' | 'error' | 'cancelled' | string
  citations: { index: number; sourceId: string; sourceTitle: string }[]
  createdAt: number
}

export type LoomNote = {
  id: string
  loomId: string
  title: string | null
  body: string
  sourceMessageId: string | null
  isSource: boolean
  createdAt: number
  updatedAt: number
}

export type LoomTemplateId =
  | 'blank' | 'ux-research' | 'software' | 'ai-engineer' | 'sales' | 'product'

export type LoomTemplate = {
  id: LoomTemplateId
  name: string
  tagline: string
  responseStyle: string
  suggestedSources: { kind: 'paste' | 'url' | 'file' | 'folder' | 'session'; label: string }[]
  featuredArtifacts: LoomArtifactKind[]
  starterQuestions: string[]
}

export type LoomArtifactKind =
  | 'briefing' | 'summary' | 'report' | 'notes' | 'faq' | 'outline'
  | 'mindmap' | 'timeline' | 'flashcards' | 'quiz' | 'datatable'
  | 'infographic' | 'slide-deck'
  // UX Research persona
  | 'quote-bank' | 'themes' | 'persona' | 'journey-map' | 'insight-report'
  | 'custom'

export type LoomArtifact = {
  id: string
  loomId: string
  kind: LoomArtifactKind | string
  title: string
  contentPath: string | null
  contentInline: string | null
  status: 'pending' | 'running' | 'done' | 'error' | string
  error: string | null
  designId: string | null
  createdAt: number
  updatedAt: number
}

export type PreviewCommand = {
  id: string
  project_id: string
  name: string
  command: string
  framework: string | null
  preferred_port: number | null
  created_at: number
}

export type RunningPreview = {
  id: string
  commandId: string
  projectId: string
  name: string
  pid: number
  port: number | null
  url: string | null
  cwd: string
  startedAt: number
}

export type SkillFormat = 'prompt' | 'persona' | 'clip' | 'recipe'
export type SkillScope = { kind: 'always' } | { kind: 'manual' } | { kind: 'project'; projectId: string }
export type Skill = {
  id: string
  folder: 'prompts' | 'personas' | 'clips' | 'recipes' | 'lib'
  name: string
  body: string
  format: SkillFormat
  tags: string[]
  scope: SkillScope
  updatedAt: number
}
export type ProposedSkill = {
  id: string                  // proposed/<filename>.md
  name: string
  body: string
  format: SkillFormat
  tags: string[]
  reason: string              // why the system thinks you have this skill
  evidence: string            // snippet from terminal/brain that triggered it
  createdAt: number
}

export type Recipe = {
  id: string
  name: string
  steps: { prompt: string }[]
  model?: string
  cwd?: string
}

export type RecipeSchedule = {
  id: string
  recipe_id: string
  kind: 'daily' | 'weekdays' | 'interval'
  hour: number | null
  minute: number | null
  interval_minutes: number | null
  enabled: number
  last_run_at: number | null
  next_run_at: number
  created_at: number
}

export type InboxEntry = {
  id: string
  title: string
  body: string
  kind: string
  read: number
  created_at: number
}

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked'
export type Task = {
  source: string
  text: string
  done: boolean
  status?: TaskStatus
  description?: string | null
  id?: string
}
export type CopilotSessionInfo = {
  id: string
  name: string
  cwd: string | null
  updatedAt: number
  counts: { in_progress: number; pending: number; done: number; blocked: number; total: number }
}

export type ContextUsage = {
  inputTokens: number
  outputTokens: number
  model: string | null
  contextLimit: number
  percent: number
  source: 'shutdown' | 'truncation' | 'compaction' | null
  sourceTimestamp: string | null
}

export type ActivityProjectCard = {
  projectId: string | null
  projectName: string
  projectPath: string | null
  sessionCount: number
  lastActivityAt: number
  totalTokens: number
  lastModel: string | null
  lastTaskTitle: string | null
}
export type ActivityTimelineItem = {
  at: number
  copilotSessionId: string
  projectName: string
  role: 'user' | 'assistant'
  snippet: string
  model: string | null
}
export type ActivityBackground = {
  sessions: Array<{
    sessionId: string
    pid: number
    cwd: string
    projectId: string | null
    projectName: string
    copilotSessionId: string | null
    startedAt: number
    lastActivity: string
  }>
  previews: Array<{
    id: string
    name: string
    projectId: string
    projectName: string
    url: string | null
    port: number | null
    startedAt: number
  }>
  schedules: Array<{
    id: string
    recipeId: string
    recipeName: string
    description: string
    nextRunAt: number | null
  }>
}
export type ActivitySummary = {
  metrics: {
    tokensUsedToday: number
    sessionsActiveToday: number
    premiumRequestsToday: number
    activePreviewCount: number
  }
  sparkline: { date: string; tokens: number }[]
  background: ActivityBackground
  projects: ActivityProjectCard[]
  timeline: ActivityTimelineItem[]
}

export type LiveSession = {
  id: string
  pid: number
  cwd: string
  command: string
  startedAt: number
  copilotSessionId: string | null
  lastActivity: string
}

export type ExternalCopilotProc = {
  pid: number
  command: string
  cwd: string | null
  startedAt: number | null
}

export type BrainLayer = {
  layer: 'global' | 'project' | 'session'
  activeRuleIds: string[]
  freeform: string
}

export type BrainCategory = {
  id: string
  label: string
  rules: { id: string; label: string }[]
}

export type ProjectBrief = {
  v: 1
  type: string
  typeLabel: string
  subType?: string
  audience?: string
  look?: string[]
  lookNote?: string
  brandColor?: string         // primary
  secondaryColor?: string
  tertiaryColor?: string
  headingFont?: string
  bodyFont?: string
  font?: string               // legacy single-font (kept for back-compat)
  iconLibrary?: string        // Lucide, Phosphor, Heroicons, etc.
  imageSource?: string        // 'upload' | 'unsplash' | 'pexels' | 'mix' | 'none'
  motionLibs?: string[]       // Framer Motion, GSAP, Lenis, etc.
  designSystem?: string       // Apple HIG, Material 3, Fluent 2, IBM Carbon, etc.
  brandLogo?: string          // relative path under brain/projects/<id>/brand/
  brandName?: string          // display name of the brand
  radius?: 'square' | 'subtle' | 'medium' | 'rounded' | 'pill'
  shadow?: 'none' | 'subtle' | 'medium' | 'strong'
  outline?: 'none' | 'subtle' | 'strong'
  theme?: 'light' | 'dark' | 'auto' | 'both'
  surfaces?: string[]   // e.g. ['mobile','desktop']: target form factors
  stack?: string
  language?: string
  auth?: string
  store?: string
  deploy?: string
  dataMode?: 'demo' | 'real'  // 'demo' = use placeholder data, no backend; 'real' = wire a backend
  dataBackend?: string        // 'supabase' | 'firebase' | 'azure' | 'aws-amplify' | 'planetscale' | 'convex' | 'sqlite' | 'rest' | 'pick'
  oneLiner?: string
  description?: string
  problem?: string
  goal?: string
  keyFeatures?: string
  mustHaves?: string
  successMetric?: string
  notes?: string
  scaffold?: boolean
  inspirationImages?: string[]   // relative paths under brain/projects/<id>/inspiration/
  createdAt: number
}

export type PlaintextTokenState = {
  enabled: boolean
  ok: boolean
  path: string
}

export type Settings = {
  notifyAfterSeconds: number
  notifyCooldownSeconds: number
  defaultModel: string
  notificationsEnabled: boolean
  brainAutoApply: boolean
  accentColor: string
  translucentSidebar: boolean
  approvalPolicy: 'on-request' | 'suggest' | 'auto-edit' | 'full-auto'
  sandboxMode: 'read-only' | 'workspace-write' | 'danger'
  completionNotifyMode: 'always' | 'unfocused' | 'off'
  permissionNotifications: boolean
  questionNotifications: boolean
  defaultFigmaFile: string
  terminalFontSize: number
  terminalFontFamily: string
  terminalCursorStyle: 'bar' | 'block' | 'underline'
  terminalCursorBlink: boolean
  terminalLineHeight: number
  terminalCopyOnSelect: boolean
  autoContinueEnabled: boolean
}

const onChannel = <T,>(channel: string, cb: (payload: T) => void): (() => void) => {
  const handler = (_e: unknown, payload: T): void => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

export type TemplateInfo = {
  id: string
  name: string
  displayName: string
  description: string
  category: 'industry' | 'fluent' | 'consumer' | 'dashboard' | 'other'
}

const api = {
  platform: process.platform,
  appVersion: '0.1.0',
  pty: {
    spawn: (id: string, opts?: { cwd?: string; cols?: number; rows?: number; command?: string; commandArgs?: string[]; label?: string }) =>
      ipcRenderer.invoke('pty:spawn', { id, ...opts }) as Promise<{ ok: boolean; existing?: boolean; pid?: number; copilotSessionId?: string | null }>,
    write: (id: string, data: string) => ipcRenderer.invoke('pty:write', { id, data }),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke('pty:resize', { id, cols, rows }),
    kill: (id: string) => ipcRenderer.invoke('pty:kill', { id }),
    list: (): Promise<LiveSession[]> => ipcRenderer.invoke('pty:list'),
    listExternal: (): Promise<ExternalCopilotProc[]> => ipcRenderer.invoke('pty:listExternal'),
    status: (id: string): Promise<{ copilotSessionId: string | null; lastActivity: string } | null> =>
      ipcRenderer.invoke('pty:status', id),
    onData: (id: string, cb: (data: string) => void) => onChannel(`pty:data:${id}`, cb),
    scrollback: (id: string): Promise<string> => ipcRenderer.invoke('pty:scrollback', id),
    savedScrollback: (id: string): Promise<string> => ipcRenderer.invoke('pty:savedScrollback', id),
    onExit: (id: string, cb: (code: number) => void) => onChannel(`pty:exit:${id}`, cb),
    onActivity: (id: string, cb: (line: string) => void) => onChannel(`pty:activity:${id}`, cb),
    activityHistory: (id: string): Promise<{ line: string; at: number }[]> =>
      ipcRenderer.invoke('pty:activityHistory', id),
    onActivityHistory: (id: string, cb: (history: { line: string; at: number }[]) => void) =>
      onChannel(`pty:activityHistory:${id}`, cb),
    onLinked: (cb: (payload: { id: string; copilotSessionId: string }) => void) =>
      onChannel('pty:linked', cb)
  },
  projects: {
    list: (): Promise<Project[]> => ipcRenderer.invoke('projects:list'),
    add: (): Promise<Project | null> => ipcRenderer.invoke('projects:add'),
    touch: (id: string) => ipcRenderer.invoke('projects:touch', id),
    remove: (id: string) => ipcRenderer.invoke('projects:remove', id),
    rename: (id: string, name: string) => ipcRenderer.invoke('projects:rename', { id, name }),
    setAutoLaunch: (id: string, auto: boolean) =>
      ipcRenderer.invoke('projects:set-auto-launch', { id, auto })
  },
  templates: {
    list: (): Promise<TemplateInfo[] | { error: string }> => ipcRenderer.invoke('templates:list'),
    materialize: (
      args: { templateId: string; destDir: string }
    ): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('templates:materialize', args),
    previewGet: (id: string): Promise<string | null> =>
      ipcRenderer.invoke('templates:preview:get', { id }),
    previewStatus: (id: string): Promise<{ hasPreview: boolean; generating: boolean }> =>
      ipcRenderer.invoke('templates:preview:status', { id }),
    previewGenerate: (id: string): Promise<{ ok: boolean; dataUrl?: string | null; error?: string }> =>
      ipcRenderer.invoke('templates:preview:generate', { id }),
    previewRegenerate: (id: string): Promise<{ ok: boolean; dataUrl?: string | null; error?: string }> =>
      ipcRenderer.invoke('templates:preview:regenerate', { id }),
    onPreviewProgress: (cb: (p: { id: string; msg: string; pct: number | null }) => void) =>
      onChannel('templates:preview:progress', cb)
  },
  sessions: {
    list: (projectId: string | null): Promise<Session[]> =>
      ipcRenderer.invoke('sessions:list', projectId),
    get: (id: string): Promise<Session | undefined> => ipcRenderer.invoke('sessions:get', id),
    create: (projectId: string | null, title?: string): Promise<Session> =>
      ipcRenderer.invoke('sessions:create', { projectId, title }),
    rename: (id: string, title: string, lock = true) =>
      ipcRenderer.invoke('sessions:rename', { id, title, lock }),
    autoTitle: (id: string, firstInput: string): Promise<{ ok: boolean; title?: string }> =>
      ipcRenderer.invoke('sessions:auto-title', { id, firstInput }),
    linkCopilot: (id: string, copilotSessionId: string) =>
      ipcRenderer.invoke('sessions:link-copilot', { id, copilotSessionId }),
    pin: (id: string, pinned: boolean) => ipcRenderer.invoke('sessions:pin', { id, pinned }),
    remove: (id: string) => ipcRenderer.invoke('sessions:remove', id),
    touch: (id: string) => ipcRenderer.invoke('sessions:touch', id),
    setModel: (id: string, model: string) => ipcRenderer.invoke('sessions:set-model', { id, model }),
    tailLog: (id: string, maxBytes?: number): Promise<{ body: string; lastAt: number | null }> =>
      ipcRenderer.invoke('sessions:tail-log', { id, maxBytes })
  },
  composer: {
    saveDraft: (sessionId: string, body: string) =>
      ipcRenderer.invoke('composer:save-draft', { sessionId, body }),
    getDraft: (sessionId: string): Promise<string> =>
      ipcRenderer.invoke('composer:get-draft', sessionId),
    pushHistory: (sessionId: string, body: string) =>
      ipcRenderer.invoke('composer:push-history', { sessionId, body }),
    history: (sessionId: string): Promise<ComposerEntry[]> =>
      ipcRenderer.invoke('composer:history', sessionId)
  },
  identity: {
    greetingName: () => ipcRenderer.invoke('identity:greetingName') as Promise<string | null>
  },
  chat: {
    send: (sessionId: string, text: string, model?: string | null, prefix?: string | null, agentMode?: 'interactive' | 'plan' | 'autopilot') =>
      ipcRenderer.invoke('chat:send', { sessionId, text, model, prefix, agentMode }) as Promise<{ ok: boolean; error?: string }>,
    cancel: (sessionId: string) => ipcRenderer.invoke('chat:cancel', sessionId) as Promise<{ ok: boolean }>,
    history: (sessionId: string) => ipcRenderer.invoke('chat:history', sessionId) as Promise<ChatMessage[]>,
    clear: (sessionId: string) => ipcRenderer.invoke('chat:clear', sessionId) as Promise<{ ok: boolean }>,
    isBusy: (sessionId: string) => ipcRenderer.invoke('chat:isBusy', sessionId) as Promise<boolean>,
    undo: (messageId: string) =>
      ipcRenderer.invoke('chat:undo', messageId) as Promise<{ ok: boolean; reverted: string[]; error?: string }>,
    turnFiles: (messageId: string) =>
      ipcRenderer.invoke('chat:turnFiles', messageId) as Promise<{
        ok: boolean
        files: Array<{ path: string; status: string; additions: number; deletions: number; binary: boolean }>
        additions: number
        deletions: number
        error?: string
      }>,
    fileDiff: (messageId: string, path: string) =>
      ipcRenderer.invoke('chat:fileDiff', { messageId, path }) as Promise<{ ok: boolean; before: string | null; after: string | null; error?: string }>,
    onArtifact: (cb: (d: ChatArtifact) => void) => {
      const handler = (_e: unknown, d: ChatArtifact): void => cb(d)
      ipcRenderer.on('chat:artifact', handler)
      return () => ipcRenderer.removeListener('chat:artifact', handler)
    },
    onDiff: (cb: (d: { sessionId: string; messageId: string; diff: ChatDiff }) => void) => {
      const handler = (_e: unknown, d: { sessionId: string; messageId: string; diff: ChatDiff }): void => cb(d)
      ipcRenderer.on('chat:diff', handler)
      return () => ipcRenderer.removeListener('chat:diff', handler)
    },
    onMessage: (cb: (m: ChatMessage) => void) => {
      const handler = (_e: unknown, m: ChatMessage): void => cb(m)
      ipcRenderer.on('chat:message', handler)
      return () => ipcRenderer.removeListener('chat:message', handler)
    },
    onDelta: (cb: (d: { sessionId: string; messageId: string; delta: string }) => void) => {
      const handler = (_e: unknown, d: { sessionId: string; messageId: string; delta: string }): void => cb(d)
      ipcRenderer.on('chat:delta', handler)
      return () => ipcRenderer.removeListener('chat:delta', handler)
    },
    onTool: (cb: (d: { sessionId: string; tool: ChatToolCall }) => void) => {
      const handler = (_e: unknown, d: { sessionId: string; tool: ChatToolCall }): void => cb(d)
      ipcRenderer.on('chat:tool', handler)
      return () => ipcRenderer.removeListener('chat:tool', handler)
    },
    onStart: (cb: (d: { sessionId: string }) => void) => {
      const handler = (_e: unknown, d: { sessionId: string }): void => cb(d)
      ipcRenderer.on('chat:start', handler)
      return () => ipcRenderer.removeListener('chat:start', handler)
    },
    onDone: (cb: (d: { sessionId: string; exitCode: number }) => void) => {
      const handler = (_e: unknown, d: { sessionId: string; exitCode: number }): void => cb(d)
      ipcRenderer.on('chat:done', handler)
      return () => ipcRenderer.removeListener('chat:done', handler)
    }
  },
  canvas: {
    assist: (prompt: string, model?: string | null) =>
      ipcRenderer.invoke('canvas:assist', { prompt, model }) as Promise<{ ok: true; text: string } | { ok: false; error: string }>,
    assistVision: (prompt: string, images: string[], model?: string | null) =>
      ipcRenderer.invoke('canvas:assistVision', { prompt, images, model }) as Promise<{ ok: true; text: string } | { ok: false; error: string }>,
    readClipboardHTML: () => ipcRenderer.invoke('canvas:readClipboardHTML') as Promise<string>,
  },
  motion: {
    list: () => ipcRenderer.invoke('motion:list') as Promise<MotionRecord[]>,
    get: (id: string) => ipcRenderer.invoke('motion:get', id) as Promise<MotionRecord | null>,
    create: (title: string, doc: unknown) =>
      ipcRenderer.invoke('motion:create', { title, doc }) as Promise<MotionRecord>,
    save: (id: string, doc: unknown, thumbnail?: string | null) =>
      ipcRenderer.invoke('motion:save', { id, doc, thumbnail }) as Promise<boolean>,
    rename: (id: string, title: string) =>
      ipcRenderer.invoke('motion:rename', { id, title }) as Promise<boolean>,
    delete: (id: string) => ipcRenderer.invoke('motion:delete', id) as Promise<boolean>,
    layouts: () => ipcRenderer.invoke('motion:layouts') as Promise<MotionLayoutRecord[]>,
    saveLayout: (name: string, componentId: string, doc: unknown, thumbnail?: string | null) =>
      ipcRenderer.invoke('motion:saveLayout', { name, componentId, doc, thumbnail }) as Promise<MotionLayoutRecord>,
    deleteLayout: (id: string) => ipcRenderer.invoke('motion:deleteLayout', id) as Promise<boolean>,
    addImages: (paths: string[]): Promise<{ ok: boolean; images: Array<{ id: string; name: string; path: string; dataUrl: string }> }> =>
      ipcRenderer.invoke('motion:addImages', paths),
    importImages: () =>
      ipcRenderer.invoke('motion:importImages') as Promise<{ ok: boolean; images: Array<{ id: string; name: string; path: string; dataUrl: string }> }>,
    readImage: (path: string) => ipcRenderer.invoke('motion:readImage', path) as Promise<string | null>,
    brandSets: (kind?: string) =>
      ipcRenderer.invoke('motion:brandSets', kind) as Promise<BrandSetRecord[]>,
    saveBrandSet: (args: { id?: string; kind: string; name: string; items: string[] }) =>
      ipcRenderer.invoke('motion:saveBrandSet', args) as Promise<BrandSetRecord>,
    deleteBrandSet: (id: string) => ipcRenderer.invoke('motion:deleteBrandSet', id) as Promise<boolean>,
    bentos: () => ipcRenderer.invoke('motion:bentos') as Promise<MotionBentoRecord[]>,
    saveBento: (name: string, images: MotionBentoRecord['images']) =>
      ipcRenderer.invoke('motion:saveBento', { name, images }) as Promise<MotionBentoRecord>,
    deleteBento: (id: string) => ipcRenderer.invoke('motion:deleteBento', id) as Promise<boolean>,
    storeImage: (name: string, base64: string) =>
      ipcRenderer.invoke('motion:storeImage', { name, base64 }) as Promise<
        { ok: true; image: { id: string; name: string; path: string; dataUrl: string } } | { ok: false }
      >,
    exportFile: (fileName: string, base64: string) =>
      ipcRenderer.invoke('motion:exportFile', { fileName, base64 }) as Promise<{ ok: boolean; path?: string }>
  },

  tokens: {
    list: () => ipcRenderer.invoke('tokens:list') as Promise<TokenStudioRecord[]>,
    get: (id: string) => ipcRenderer.invoke('tokens:get', id) as Promise<TokenStudioRecord | null>,
    create: (name: string, studio: unknown) =>
      ipcRenderer.invoke('tokens:create', { name, studio }) as Promise<TokenStudioRecord>,
    save: (id: string, studio: unknown) =>
      ipcRenderer.invoke('tokens:save', { id, studio }) as Promise<boolean>,
    rename: (id: string, name: string) =>
      ipcRenderer.invoke('tokens:rename', { id, name }) as Promise<boolean>,
    delete: (id: string) => ipcRenderer.invoke('tokens:delete', id) as Promise<boolean>,
    export: (studio: unknown, themeId: string | null, dir?: string | null) =>
      ipcRenderer.invoke('tokens:export', { studio, themeId, dir }) as Promise<
        { ok: true; paths: string[] } | { ok: false; error?: string }
      >
  },

  designs: {
    list: () => ipcRenderer.invoke('designs:list') as Promise<Design[]>,
    get: (id: string) => ipcRenderer.invoke('designs:get', id) as Promise<Design | null>,
    create: (opts?: { title?: string; brief?: DesignBrief | null }) => ipcRenderer.invoke('designs:create', opts) as Promise<Design>,
    createStarterVersion: (designId: string, userText?: string | null) =>
      ipcRenderer.invoke('designs:createStarterVersion', { designId, userText }) as Promise<{ ok: boolean; error?: string; latest: DesignVersion | null; versions: DesignVersion[] }>,
    rename: (id: string, title: string) => ipcRenderer.invoke('designs:rename', { id, title }) as Promise<Design | null>,
    applyEdit: (designId: string, blockId: string, css: string, tag?: 'style' | 'script') =>
      ipcRenderer.invoke('designs:applyEdit', { designId, blockId, css, tag }) as Promise<{ ok: boolean; latest: DesignVersion | null; versions: DesignVersion[]; error?: string }>,
    writeHtml: (designId: string, html: string) =>
      ipcRenderer.invoke('designs:writeHtml', { designId, html }) as Promise<{ ok: boolean; latest: DesignVersion | null; versions: DesignVersion[]; error?: string }>,
    delete: (id: string) => ipcRenderer.invoke('designs:delete', id) as Promise<{ ok: boolean }>,
    importFolder: () =>
      ipcRenderer.invoke('designs:importFolder') as Promise<{ ok: boolean; design?: Design; error?: string }>,
    importGit: (url: string, title?: string) =>
      ipcRenderer.invoke('designs:importGit', { url, title }) as Promise<{ ok: boolean; design?: Design; error?: string }>,
    send: (designId: string, text: string, model?: string | null, agentMode?: 'interactive' | 'plan' | 'autopilot', displayText?: string | null) =>
      ipcRenderer.invoke('designs:send', { designId, text, model, agentMode, displayText }) as Promise<{ ok: boolean; error?: string; accepted?: boolean }>,
    sendToFigma: (designId: string, opts?: { mode?: 'newFile' | 'existingFile'; fileUrl?: string | null; pageName?: string | null }) =>
      ipcRenderer.invoke('designs:sendToFigma', { designId, ...(opts ?? {}) }) as Promise<{ ok: boolean; error?: string }>,
    figmaFromScratch: (designId: string, description: string, opts?: { mode?: 'newFile' | 'existingFile'; fileUrl?: string | null }) =>
      ipcRenderer.invoke('designs:figmaFromScratch', { designId, description, ...(opts ?? {}) }) as Promise<{ ok: boolean; error?: string }>,
    previewPrompt: (brief: DesignBrief | null) =>
      ipcRenderer.invoke('designs:previewPrompt', { brief }) as Promise<{ prompt: string }>,
    tokensStatus: (designId: string) =>
      ipcRenderer.invoke('designs:tokensStatus', designId) as Promise<TokensStatus>,
    resyncTokens: (designId: string) =>
      ipcRenderer.invoke('designs:resyncTokens', designId) as
        Promise<{ ok: true; stuck: string[] } | { ok: false; error: string }>,
    cancel: (designId: string) => ipcRenderer.invoke('designs:cancel', designId) as Promise<{ ok: boolean }>,
    isBusy: (designId: string) => ipcRenderer.invoke('designs:isBusy', designId) as Promise<boolean>,
    history: (designId: string) => ipcRenderer.invoke('designs:history', designId) as Promise<DesignMessage[]>,
    listVersions: (designId: string) => ipcRenderer.invoke('designs:listVersions', designId) as Promise<DesignVersion[]>,
    readVersion: (designId: string, fileName: string) =>
      ipcRenderer.invoke('designs:readVersion', designId, fileName) as Promise<{ ok: true; content: string } | { ok: false; error: string }>,
    watch: (designId: string) => ipcRenderer.invoke('designs:watch', designId) as Promise<{ ok: boolean }>,
    unwatch: (designId: string) => ipcRenderer.invoke('designs:unwatch', designId) as Promise<{ ok: boolean }>,
    revealLatest: (designId: string) => ipcRenderer.invoke('designs:revealLatest', designId) as Promise<{ ok: boolean }>,
    openExternal: (fileUrl: string) => ipcRenderer.invoke('designs:openExternal', fileUrl) as Promise<{ ok: boolean }>,
    formats: (designId: string) => ipcRenderer.invoke('designs:formats', designId) as Promise<Array<'html' | 'pdf' | 'png' | 'pptx'>>,
    canFigma: (designId: string) => ipcRenderer.invoke('designs:canFigma', designId) as Promise<boolean>,
    export: (designId: string, format: 'html' | 'pdf' | 'png' | 'pptx') =>
      ipcRenderer.invoke('designs:export', { designId, format }) as Promise<{ ok: true; path: string } | { ok: false; error: string }>,
    uploadTemplate: (designId: string, name: string, bytes: ArrayBuffer | Uint8Array) =>
      ipcRenderer.invoke('designs:uploadTemplate', { designId, name, bytes }) as Promise<{ ok: true; filename: string } | { ok: false; error: string }>,
    uploadInspiration: (designId: string, name: string, bytes: ArrayBuffer | Uint8Array) =>
      ipcRenderer.invoke('designs:uploadInspiration', { designId, name, bytes }) as Promise<{ ok: true; filename: string } | { ok: false; error: string }>,
    removeAttachment: (designId: string, filename: string) =>
      ipcRenderer.invoke('designs:removeAttachment', { designId, filename }) as Promise<{ ok: true } | { ok: false; error: string }>,
    inspirationDataUrl: (designId: string, filename: string) =>
      ipcRenderer.invoke('designs:inspirationDataUrl', { designId, filename }) as Promise<string | null>,
    onMessage: (cb: (m: DesignMessage) => void) => {
      const handler = (_e: unknown, m: DesignMessage): void => cb(m)
      ipcRenderer.on('design:message', handler)
      return () => ipcRenderer.removeListener('design:message', handler)
    },
    onDelta: (cb: (d: { designId: string; messageId: string; delta: string }) => void) => {
      const handler = (_e: unknown, d: { designId: string; messageId: string; delta: string }): void => cb(d)
      ipcRenderer.on('design:delta', handler)
      return () => ipcRenderer.removeListener('design:delta', handler)
    },
    onTool: (cb: (d: { designId: string; tool: DesignToolCall }) => void) => {
      const handler = (_e: unknown, d: { designId: string; tool: DesignToolCall }): void => cb(d)
      ipcRenderer.on('design:tool', handler)
      return () => ipcRenderer.removeListener('design:tool', handler)
    },
    onStart: (cb: (d: { designId: string }) => void) => {
      const handler = (_e: unknown, d: { designId: string }): void => cb(d)
      ipcRenderer.on('design:start', handler)
      return () => ipcRenderer.removeListener('design:start', handler)
    },
    onDone: (cb: (d: { designId: string; exitCode: number }) => void) => {
      const handler = (_e: unknown, d: { designId: string; exitCode: number }): void => cb(d)
      ipcRenderer.on('design:done', handler)
      return () => ipcRenderer.removeListener('design:done', handler)
    },
    onPhase: (cb: (d: { designId: string; phase: string }) => void) => {
      const handler = (_e: unknown, d: { designId: string; phase: string }): void => cb(d)
      ipcRenderer.on('design:phase', handler)
      return () => ipcRenderer.removeListener('design:phase', handler)
    },
    onProgress: (cb: (d: { designId: string; steps: DesignProgressStep[] }) => void) => {
      const handler = (_e: unknown, d: { designId: string; steps: DesignProgressStep[] }): void => cb(d)
      ipcRenderer.on('design:progress', handler)
      return () => ipcRenderer.removeListener('design:progress', handler)
    },
    onVersion: (cb: (d: { designId: string; latest: DesignVersion | null; versions: DesignVersion[] }) => void) => {
      const handler = (_e: unknown, d: { designId: string; latest: DesignVersion | null; versions: DesignVersion[] }): void => cb(d)
      ipcRenderer.on('design:version', handler)
      return () => ipcRenderer.removeListener('design:version', handler)
    }
  },
  looms: {
    list: () => ipcRenderer.invoke('looms:list') as Promise<Loom[]>,
    get: (id: string) => ipcRenderer.invoke('looms:get', id) as Promise<Loom | null>,
    create: (opts?: { title?: string | null; templateId?: string | null }) => ipcRenderer.invoke('looms:create', opts) as Promise<Loom>,
    listTemplates: () => ipcRenderer.invoke('looms:listTemplates') as Promise<LoomTemplate[]>,
    rename: (id: string, title: string) => ipcRenderer.invoke('looms:rename', { id, title }) as Promise<Loom | null>,
    delete: (id: string) => ipcRenderer.invoke('looms:delete', id) as Promise<{ ok: boolean }>,
    setResponseStyle: (id: string, style: string | null) =>
      ipcRenderer.invoke('looms:setResponseStyle', { id, style }) as Promise<Loom | null>,

    listSources: (loomId: string) => ipcRenderer.invoke('looms:listSources', loomId) as Promise<LoomSource[]>,
    addPasteSource: (loomId: string, text: string, title?: string | null) =>
      ipcRenderer.invoke('looms:addPasteSource', { loomId, text, title }) as Promise<{ ok: true; source: LoomSource } | { ok: false; error: string }>,
    addUrlSource: (loomId: string, url: string) =>
      ipcRenderer.invoke('looms:addUrlSource', { loomId, url }) as Promise<{ ok: true; source: LoomSource } | { ok: false; error: string }>,
    addFileSource: (loomId: string, path?: string) =>
      ipcRenderer.invoke('looms:addFileSource', { loomId, path }) as Promise<{ ok: true; source: LoomSource } | { ok: false; error: string }>,
    addFolderSource: (loomId: string, path?: string) =>
      ipcRenderer.invoke('looms:addFolderSource', { loomId, path }) as Promise<{ ok: true; folder: LoomSource; files: LoomSource[]; truncated: boolean; skipped: number } | { ok: false; error: string }>,
    retrySummary: (sourceId: string) => ipcRenderer.invoke('looms:retrySummary', sourceId) as Promise<{ ok: boolean; error?: string }>,
    setIncluded: (sourceId: string, included: boolean) =>
      ipcRenderer.invoke('looms:setIncluded', { sourceId, included }) as Promise<LoomSource | null>,
    setIncludedBulk: (loomId: string, sourceIds: string[], included: boolean) =>
      ipcRenderer.invoke('looms:setIncludedBulk', { loomId, sourceIds, included }) as Promise<{ ok: boolean }>,
    deleteSource: (sourceId: string) => ipcRenderer.invoke('looms:deleteSource', sourceId) as Promise<{ ok: boolean }>,

    listMessages: (loomId: string) => ipcRenderer.invoke('looms:listMessages', loomId) as Promise<LoomMessage[]>,
    send: (loomId: string, text: string, opts?: { model?: string | null; agentMode?: 'interactive' | 'plan' | 'autopilot' }) =>
      ipcRenderer.invoke('looms:send', { loomId, text, model: opts?.model, agentMode: opts?.agentMode }) as Promise<{ ok: boolean; error?: string }>,
    cancel: (loomId: string) => ipcRenderer.invoke('looms:cancel', loomId) as Promise<{ ok: boolean }>,
    isBusy: (loomId: string) => ipcRenderer.invoke('looms:isBusy', loomId) as Promise<boolean>,

    listNotes: (loomId: string) => ipcRenderer.invoke('looms:listNotes', loomId) as Promise<LoomNote[]>,
    saveNote: (loomId: string, body: string, opts?: { title?: string | null; sourceMessageId?: string | null }) =>
      ipcRenderer.invoke('looms:saveNote', { loomId, body, title: opts?.title ?? null, sourceMessageId: opts?.sourceMessageId ?? null }) as Promise<LoomNote>,
    deleteNote: (noteId: string, loomId: string) => ipcRenderer.invoke('looms:deleteNote', { noteId, loomId }) as Promise<{ ok: boolean }>,

    listArtifacts: (loomId: string) => ipcRenderer.invoke('looms:listArtifacts', loomId) as Promise<LoomArtifact[]>,
    generateArtifact: (loomId: string, kind: LoomArtifactKind, customization?: string | null) =>
      ipcRenderer.invoke('looms:generateArtifact', { loomId, kind, customization }) as Promise<{ ok: boolean; artifactId?: string; error?: string }>,
    deleteArtifact: (artifactId: string) =>
      ipcRenderer.invoke('looms:deleteArtifact', artifactId) as Promise<{ ok: boolean; error?: string }>,
    retryArtifact: (artifactId: string) =>
      ipcRenderer.invoke('looms:retryArtifact', artifactId) as Promise<{ ok: boolean; artifactId?: string; error?: string }>,
    synthesize: (loomId: string) =>
      ipcRenderer.invoke('looms:synthesize', loomId) as Promise<{ ok: boolean; error?: string }>,
    readArtifact: (artifactId: string) =>
      ipcRenderer.invoke('looms:readArtifact', artifactId) as Promise<{ ok: true; artifact: LoomArtifact; content: string } | { ok: false; error: string }>,
    openLoomFolder: (loomId: string) => ipcRenderer.invoke('looms:openLoomFolder', loomId) as Promise<{ ok: boolean; dir?: string; error?: string }>,

    onMessage: (cb: (d: { loomId: string; message: LoomMessage }) => void) => {
      const handler = (_e: unknown, d: { loomId: string; message: LoomMessage }): void => cb(d)
      ipcRenderer.on('loom:message', handler)
      return () => ipcRenderer.removeListener('loom:message', handler)
    },
    onDelta: (cb: (d: { loomId: string; messageId: string; delta: string }) => void) => {
      const handler = (_e: unknown, d: { loomId: string; messageId: string; delta: string }): void => cb(d)
      ipcRenderer.on('loom:delta', handler)
      return () => ipcRenderer.removeListener('loom:delta', handler)
    },
    onStart: (cb: (d: { loomId: string }) => void) => {
      const handler = (_e: unknown, d: { loomId: string }): void => cb(d)
      ipcRenderer.on('loom:start', handler)
      return () => ipcRenderer.removeListener('loom:start', handler)
    },
    onDone: (cb: (d: { loomId: string; exitCode: number; rateLimitMessage: string | null }) => void) => {
      const handler = (_e: unknown, d: { loomId: string; exitCode: number; rateLimitMessage: string | null }): void => cb(d)
      ipcRenderer.on('loom:done', handler)
      return () => ipcRenderer.removeListener('loom:done', handler)
    },
    onSource: (cb: (d: { loomId: string; source: LoomSource }) => void) => {
      const handler = (_e: unknown, d: { loomId: string; source: LoomSource }): void => cb(d)
      ipcRenderer.on('loom:source', handler)
      return () => ipcRenderer.removeListener('loom:source', handler)
    },
    onSourceDeleted: (cb: (d: { loomId: string; sourceId: string }) => void) => {
      const handler = (_e: unknown, d: { loomId: string; sourceId: string }): void => cb(d)
      ipcRenderer.on('loom:sourceDeleted', handler)
      return () => ipcRenderer.removeListener('loom:sourceDeleted', handler)
    },
    onArtifact: (cb: (d: { loomId: string; artifact: LoomArtifact }) => void) => {
      const handler = (_e: unknown, d: { loomId: string; artifact: LoomArtifact }): void => cb(d)
      ipcRenderer.on('loom:artifact', handler)
      return () => ipcRenderer.removeListener('loom:artifact', handler)
    },
    onArtifactDeleted: (cb: (d: { loomId: string; artifactId: string }) => void) => {
      const handler = (_e: unknown, d: { loomId: string; artifactId: string }): void => cb(d)
      ipcRenderer.on('loom:artifactDeleted', handler)
      return () => ipcRenderer.removeListener('loom:artifactDeleted', handler)
    },
    onSynthesize: (cb: (d: { loomId: string; step: number; total: number; kind: LoomArtifactKind | null; status: 'start' | 'running' | 'step-done' | 'done' | 'error'; error?: string }) => void) => {
      const handler = (_e: unknown, d: { loomId: string; step: number; total: number; kind: LoomArtifactKind | null; status: 'start' | 'running' | 'step-done' | 'done' | 'error'; error?: string }): void => cb(d)
      ipcRenderer.on('loom:synthesize', handler)
      return () => ipcRenderer.removeListener('loom:synthesize', handler)
    },
    onNotice: (cb: (d: { loomId: string; kind: string; subkind?: string; detail?: string }) => void) => {
      const handler = (_e: unknown, d: { loomId: string; kind: string; subkind?: string; detail?: string }): void => cb(d)
      ipcRenderer.on('loom:notice', handler)
      return () => ipcRenderer.removeListener('loom:notice', handler)
    }
  },
  preview: {
    list: (projectId: string): Promise<PreviewCommand[]> =>
      ipcRenderer.invoke('preview:list', projectId),
    add: (
      projectId: string,
      name: string,
      command: string,
      framework: string | null,
      preferredPort: number | null
    ): Promise<PreviewCommand> =>
      ipcRenderer.invoke('preview:add', { projectId, name, command, framework, preferredPort }),
    remove: (id: string) => ipcRenderer.invoke('preview:remove', id),
    running: (): Promise<RunningPreview[]> => ipcRenderer.invoke('preview:running'),
    start: (commandId: string, cwd: string) => ipcRenderer.invoke('preview:start', { commandId, cwd }),
    stop: (id: string) => ipcRenderer.invoke('preview:stop', id),
    restart: (id: string) => ipcRenderer.invoke('preview:restart', id),
    open: (id: string) => ipcRenderer.invoke('preview:open', id),
    onReady: (cb: (payload: { id: string; url: string; port: number }) => void) =>
      onChannel('preview:ready', cb),
    onData: (id: string, cb: (data: string) => void) => onChannel(`preview:data:${id}`, cb),
    onExit: (id: string, cb: (code: number) => void) => onChannel(`preview:exit:${id}`, cb)
  },
  skills: {
    listAll: (): Promise<Skill[]> => ipcRenderer.invoke('skills:list-all'),
    save: (args: {
      oldId?: string
      folder?: Skill['folder']
      name: string
      body: string
      format: SkillFormat
      tags: string[]
      scope: SkillScope
    }): Promise<Skill> => ipcRenderer.invoke('skills:save', args),
    remove: (id: string) => ipcRenderer.invoke('skills:remove', { id }),
    applicable: (projectId: string | null): Promise<Skill[]> =>
      ipcRenderer.invoke('skills:applicable', { projectId }),
    root: (): Promise<string> => ipcRenderer.invoke('skills:root'),
    listProposed: (): Promise<ProposedSkill[]> => ipcRenderer.invoke('skills:list-proposed'),
    acceptProposed: (id: string, folder: Skill['folder']): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('skills:accept-proposed', { id, folder }),
    discardProposed: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('skills:discard-proposed', { id }),
    proposeNow: (): Promise<{ ok: boolean; added: number; error?: string }> =>
      ipcRenderer.invoke('skills:propose-now'),
    onProposalsChanged: (cb: () => void) => onChannel('skills:proposals-changed', cb)
  },
  recipes: {
    list: (): Promise<Recipe[]> => ipcRenderer.invoke('recipes:list'),
    run: (id: string): Promise<{ ok: boolean; entryId?: string; error?: string }> =>
      ipcRenderer.invoke('recipes:run', id),
    schedules: {
      list: (recipeId?: string | null): Promise<RecipeSchedule[]> =>
        ipcRenderer.invoke('schedules:list', recipeId ?? null),
      upsert: (payload: {
        id?: string
        recipeId: string
        kind: 'daily' | 'weekdays' | 'interval'
        hour?: number | null
        minute?: number | null
        intervalMinutes?: number | null
        enabled?: boolean
      }): Promise<{ id: string; nextRunAt: number }> =>
        ipcRenderer.invoke('schedules:upsert', payload),
      remove: (id: string) => ipcRenderer.invoke('schedules:remove', id),
      toggle: (id: string, enabled: boolean) =>
        ipcRenderer.invoke('schedules:toggle', { id, enabled })
    }
  },
  inbox: {
    list: (): Promise<InboxEntry[]> => ipcRenderer.invoke('inbox:list'),
    markRead: (id: string) => ipcRenderer.invoke('inbox:mark-read', id),
    remove: (id: string) => ipcRenderer.invoke('inbox:remove', id),
    unreadCount: (): Promise<number> => ipcRenderer.invoke('inbox:unread-count'),
    onNew: (cb: (payload: { id: string }) => void) => onChannel('inbox:new', cb)
  },
  brain: {
    read: (
      layer: 'global' | 'project' | 'session',
      projectId?: string | null,
      sessionId?: string | null
    ): Promise<BrainLayer> => ipcRenderer.invoke('brain:read', { layer, projectId, sessionId }),
    write: (
      layer: 'global' | 'project' | 'session',
      projectId: string | null,
      sessionId: string | null,
      activeRuleIds: string[],
      freeform: string
    ) => ipcRenderer.invoke('brain:write', { layer, projectId, sessionId, activeRuleIds, freeform }),
    merged: (
      projectId: string | null,
      sessionId: string | null
    ): Promise<{ ruleIds: string[]; markdown: string; ruleCount: number; flat: string }> =>
      ipcRenderer.invoke('brain:merged', { projectId, sessionId }),
    categories: (): Promise<BrainCategory[]> => ipcRenderer.invoke('brain:categories')
  },
  brief: {
    save: (projectId: string, brief: ProjectBrief) =>
      ipcRenderer.invoke('brief:save', { projectId, brief }) as Promise<{ ok: boolean }>,
    load: (projectId: string): Promise<ProjectBrief | null> =>
      ipcRenderer.invoke('brief:load', projectId),
    clear: (projectId: string) => ipcRenderer.invoke('brief:clear', projectId),
    uploadInspiration: (
      projectId: string,
      file: { name: string; bytes: ArrayBuffer }
    ): Promise<{ ok: boolean; relativePath?: string; error?: string }> =>
      ipcRenderer.invoke('brief:upload-inspiration', { projectId, name: file.name, bytes: file.bytes }),
    deleteInspiration: (projectId: string, relativePath: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('brief:delete-inspiration', { projectId, relativePath }),
    inspirationDataUrl: (projectId: string, relativePath: string): Promise<string | null> =>
      ipcRenderer.invoke('brief:inspiration-data-url', { projectId, relativePath }),
    inspirationDir: (projectId: string): Promise<string> =>
      ipcRenderer.invoke('brief:inspiration-dir', projectId),
    uploadBrandLogo: (
      projectId: string,
      file: { name: string; bytes: ArrayBuffer }
    ): Promise<{ ok: boolean; relativePath?: string; error?: string }> =>
      ipcRenderer.invoke('brief:upload-brand-logo', { projectId, name: file.name, bytes: file.bytes }),
    deleteBrandLogo: (projectId: string, relativePath: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('brief:delete-brand-logo', { projectId, relativePath }),
    brandDataUrl: (projectId: string, relativePath: string): Promise<string | null> =>
      ipcRenderer.invoke('brief:brand-data-url', { projectId, relativePath }),
    brandDir: (projectId: string): Promise<string> =>
      ipcRenderer.invoke('brief:brand-dir', projectId)
  },
  tasks: {
    read: (copilotSessionId?: string | null): Promise<Task[]> =>
      ipcRenderer.invoke('tasks:read', copilotSessionId ?? null),
    listSessions: (): Promise<CopilotSessionInfo[]> => ipcRenderer.invoke('tasks:listSessions'),
    onUpdate: (cb: (tasks: Task[]) => void) => onChannel('tasks:update', cb),
    onUpdateFor: (copilotSessionId: string, cb: (tasks: Task[]) => void) =>
      onChannel(`tasks:update:${copilotSessionId}`, cb),
    onSessionsChanged: (cb: (sessions: CopilotSessionInfo[]) => void) =>
      onChannel('tasks:sessionsChanged', cb)
  },
  sessionInsights: {
    get: (
      copilotSessionId: string | null,
      terminalSessionId?: string | null
    ): Promise<SessionInsights> =>
      ipcRenderer.invoke('sessionInsights:get', copilotSessionId, terminalSessionId ?? null)
  },
  copilot: {
    contextUsage: (copilotSessionId: string | null): Promise<ContextUsage | null> =>
      ipcRenderer.invoke('copilot:contextUsage', copilotSessionId),
    onContextUsage: (copilotSessionId: string, cb: (u: ContextUsage) => void) =>
      onChannel(`copilot:contextUsage:${copilotSessionId}`, cb)
  },
  activity: {
    summary: (): Promise<ActivitySummary> => ipcRenderer.invoke('activity:summary'),
    stopSession: (sessionId: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('activity:stopSession', sessionId),
    stopPreview: (previewId: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('activity:stopPreview', previewId)
  },
  search: {
    logs: (query: string) => ipcRenderer.invoke('search:logs', { query }),
    history: (query: string): Promise<{
      sessions: { id: string; title: string; project_id: string; last_active_at: number }[]
      projects: { id: string; name: string; path: string }[]
    }> => ipcRenderer.invoke('search:history', { query })
  },
  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
    set: <K extends keyof Settings>(key: K, value: Settings[K]) =>
      ipcRenderer.invoke('settings:set', { key, value }),
    openConfigToml: (): Promise<{ ok: boolean; path: string }> => ipcRenderer.invoke('settings:openConfigToml'),
    getPlaintextToken: (): Promise<PlaintextTokenState> =>
      ipcRenderer.invoke('copilotCli:getPlaintextToken'),
    setPlaintextToken: (enabled: boolean): Promise<PlaintextTokenState> =>
      ipcRenderer.invoke('copilotCli:setPlaintextToken', enabled)
  },
  notify: {
    show: (title: string, body: string) => ipcRenderer.invoke('notify:show', { title, body })
  },
  shell: {
    openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('shell:openExternal', url),
    // Synchronous: returns the on-disk path for a File from a drag-drop or
    // file-input event. Renderer can't call electron.webUtils directly under
    // contextIsolation; this bridge exposes the function safely.
    getPathForFile: (file: File): string => {
      try { return webUtils.getPathForFile(file) } catch { return '' }
    }
  },
  browser: {
    clearStorage: (scope: 'cookies' | 'cache' | 'all'): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('browser:clearStorage', scope),
    resolveUrl: (args: { projectId: string | null; sessionId: string | null; initialUrl?: string | null }): Promise<{
      url: string | null
      source: 'init' | 'scoped-session' | 'scoped-project' | 'live-preview' | 'none'
      projectId: string | null
    }> => ipcRenderer.invoke('browser:url:resolve', args),
    setUrl: (args: { projectId: string; sessionId: string | null; url: string }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('browser:url:set', args),
    clearUrls: (projectId: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('browser:url:clear', { projectId }),
    getOpen: (projectId: string): Promise<{ isOpen: boolean; hasPreference: boolean }> =>
      ipcRenderer.invoke('browser:open:get', { projectId }),
    setOpen: (projectId: string, isOpen: boolean): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('browser:open:set', { projectId, isOpen })
  },
  viztweak: {
    status: (projectId: string): Promise<{
      installed: boolean
      hasComponent: boolean
      hasMcp: boolean
      projectPath: string | null
      framework?: string
      entryFile?: string | null
    }> => ipcRenderer.invoke('viztweak:status', projectId),
    bootstrap: (projectId: string): Promise<{
      ok: boolean
      steps: Array<{ kind: string; ok: boolean; message: string; file?: string }>
    }> => ipcRenderer.invoke('viztweak:bootstrap', projectId)
  },
  memory: {
    read: (): Promise<string> => ipcRenderer.invoke('memory:read'),
    write: (body: string) => ipcRenderer.invoke('memory:write', body),
    capture: (text: string, source?: string) =>
      ipcRenderer.invoke('memory:capture', { text, source }),
    reveal: () => ipcRenderer.invoke('memory:reveal'),
    path: (): Promise<string> => ipcRenderer.invoke('memory:path'),
    onChanged: (cb: () => void) => onChannel<void>('memory:changed', cb)
  },
  personas: {
    list: (): Promise<Array<{ id: string; label: string; description: string; builtIn: boolean }>> =>
      ipcRenderer.invoke('personas:list'),
    active: (): Promise<string> => ipcRenderer.invoke('personas:active'),
    setActive: (id: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('personas:set-active', id),
    onChanged: (cb: () => void) => onChannel<void>('personas:changed', cb)
  },
  files: {
    pick: (opts?: { multi?: boolean; images?: boolean }): Promise<string[]> =>
      ipcRenderer.invoke('files:pick', opts ?? {})
  },
  voice: {
    transcribe: (bytes: ArrayBuffer | Uint8Array, mimeType: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> =>
      ipcRenderer.invoke('voice:transcribe', { bytes, mimeType })
  },
  system: {
    revealFolder: (path: string): Promise<boolean> =>
      ipcRenderer.invoke('system:revealFolder', path),
    exportFile: (defaultName: string, content: string): Promise<{ ok: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke('system:exportFile', { defaultName, content })
  },
  git: {
    status: (cwd: string): Promise<{
      isRepo: boolean
      branch: string | null
      hasRemote: boolean
      remoteUrl: string | null
      hasUpstream: boolean
      ahead: number
      behind: number
      dirty: boolean
      lastPushAt: number | null
      error?: string
    }> => ipcRenderer.invoke('git:status', cwd),
    init: (cwd: string): Promise<{ ok: boolean; code: number; stdout: string; stderr: string; branch?: string }> =>
      ipcRenderer.invoke('git:init', cwd),
    addRemote: (cwd: string, url: string): Promise<{ ok: boolean; code: number; stdout: string; stderr: string }> =>
      ipcRenderer.invoke('git:addRemote', { cwd, url }),
    commitAll: (cwd: string, message: string): Promise<{ ok: boolean; code: number; stdout: string; stderr: string }> =>
      ipcRenderer.invoke('git:commitAll', { cwd, message }),
    push: (cwd: string, opts?: { setUpstream?: boolean; branch?: string | null }): Promise<{ ok: boolean; code: number; stdout: string; stderr: string }> =>
      ipcRenderer.invoke('git:push', opts ? { cwd, ...opts } : cwd),
    pull: (cwd: string): Promise<{ ok: boolean; code: number; stdout: string; stderr: string }> =>
      ipcRenderer.invoke('git:pull', cwd)
  },
  insights: {
    state: (): Promise<{ cadence: 'off' | 'daily' | '3d' | 'weekly'; lastRunAt: number; lastStatus: 'idle' | 'running' | 'ok' | 'error'; lastSummary: string; lastError: string }> =>
      ipcRenderer.invoke('insights:state'),
    setCadence: (cadence: 'off' | 'daily' | '3d' | 'weekly') =>
      ipcRenderer.invoke('insights:set-cadence', cadence),
    runNow: (): Promise<{ ok: boolean; summary?: string; error?: string }> =>
      ipcRenderer.invoke('insights:run-now'),
    onState: (cb: (s: { cadence: string; lastRunAt: number; lastStatus: string; lastSummary: string; lastError: string }) => void) =>
      onChannel<{ cadence: string; lastRunAt: number; lastStatus: string; lastSummary: string; lastError: string }>('insights:state', cb)
  },
  models: {
    list: (): Promise<{ id: string; label: string; group: string }[]> =>
      ipcRenderer.invoke('models:list'),
    refresh: (): Promise<{ id: string; label: string; group: string }[]> =>
      ipcRenderer.invoke('models:refresh'),
    status: (): Promise<{ count: number; lastError: string | null; refreshing: boolean }> =>
      ipcRenderer.invoke('models:status'),
    onUpdated: (cb: (models: { id: string; label: string; group: string }[]) => void) =>
      onChannel<{ id: string; label: string; group: string }[]>('models:updated', cb)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('terminal42', api)
  } catch (e) {
    console.error(e)
  }
}

export type Terminal42Api = typeof api
