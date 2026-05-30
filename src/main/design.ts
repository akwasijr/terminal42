import { ipcMain, BrowserWindow, app, shell, dialog } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { promises as fs, watch as fsWatch, type FSWatcher, statSync, existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { getDb } from './db'
import { extractPptxFacts, pptxFactsToPrompt, type PptxFacts } from './pptx'
import { pptxToPdf } from './render'
import { getSettings } from './settings'
import { pickRecipes, formatRecipesForPrompt } from './starterRecipes'
import { lintHtml, buildFixPrompt } from './lintHtml'
import { buildFoundationBlock } from './designFoundation'

// ─── Types ────────────────────────────────────────────────────────────────

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

// ─── Run state ────────────────────────────────────────────────────────────

export type DesignProgressStep = {
  id: string
  label: string
  status: 'running' | 'done' | 'error'
  startedAt: number
}

type RunState = {
  child: ChildProcess
  assistantMsgId: string | null
  buffer: string
  toolCalls: Map<string, DesignToolCall>
  cancelled: boolean
  progress: Map<string, DesignProgressStep>
  progressOrder: string[]
  isAutoFix: boolean
  doneEmitted: boolean
  // Retry context: if Copilot rejects the chosen --model (one-shot mode does
  // not auto-fall-back), we re-send the same prompt without --model. If THAT
  // gets rate-limited and the error is eligible for auto-switch, we retry
  // once more with --model auto.
  requestedModel: string | null
  originalText: string
  originalOpts: { skipPrefix?: boolean; useFigma?: boolean; freshSession?: boolean; agentMode?: 'interactive' | 'plan' | 'autopilot'; isAutoFix?: boolean; displayText?: string | null }
  isModelFallback: boolean
  isAutoFallback: boolean
  rateLimitMessage: string | null
  rateLimitAutoEligible: boolean
}

const running = new Map<string, RunState>()

// Single cleanup path for a finished/aborted run. Identity-guarded so a
// late cleanup (e.g. SIGKILL timeout, child 'error' event) can't delete a
// NEWER run that started in the meantime. Also idempotent so we never emit
// `design:done` twice if both 'error' and 'close' fire for the same child.
function finalizeRun(
  win: BrowserWindow | null,
  designId: string,
  state: RunState,
  exitCode: number
): void {
  if (running.get(designId) !== state) return
  running.delete(designId)
  if (state.doneEmitted) return
  state.doneEmitted = true
  emit(win, 'design:done', { designId, exitCode })
}
const watchers = new Map<string, FSWatcher>()

// ─── Paths ────────────────────────────────────────────────────────────────

function designsRoot(): string {
  return join(app.getPath('userData'), 'designs')
}

function designCwd(id: string): string {
  return join(designsRoot(), id)
}

// ─── DB helpers ───────────────────────────────────────────────────────────

function rowToDesign(row: {
  id: string; title: string; cwd: string; copilot_session_id: string | null;
  current_version: string | null; brief: string | null; created_at: number; last_active_at: number
}): Design {
  let brief: DesignBrief | null = null
  if (row.brief) { try { brief = JSON.parse(row.brief) as DesignBrief } catch {} }
  return {
    id: row.id, title: row.title, cwd: row.cwd, copilotSessionId: row.copilot_session_id,
    currentVersion: row.current_version, brief,
    createdAt: row.created_at, lastActiveAt: row.last_active_at
  }
}

function rowToMessage(row: {
  id: string; design_id: string; role: DesignRole; content: string;
  tool_calls: string | null; status: DesignStatus; created_at: number
}): DesignMessage {
  let toolCalls: DesignToolCall[] = []
  if (row.tool_calls) {
    try { toolCalls = JSON.parse(row.tool_calls) } catch {}
  }
  return {
    id: row.id, designId: row.design_id, role: row.role, content: row.content,
    toolCalls, status: row.status, createdAt: row.created_at
  }
}

function getDesign(id: string): Design | null {
  const row = getDb()
    .prepare('SELECT * FROM designs WHERE id = ?')
    .get(id) as Parameters<typeof rowToDesign>[0] | undefined
  return row ? rowToDesign(row) : null
}

function listDesigns(): Design[] {
  const rows = getDb()
    .prepare('SELECT * FROM designs ORDER BY last_active_at DESC')
    .all() as Array<Parameters<typeof rowToDesign>[0]>
  return rows.map(rowToDesign)
}

async function createDesign(opts?: { title?: string; brief?: DesignBrief | null }): Promise<Design> {
  const id = randomUUID()
  const now = Date.now()
  const cwd = designCwd(id)
  await fs.mkdir(cwd, { recursive: true })
  const brief = opts?.brief ?? null
  const titleFromBrief = brief
    ? `${brief.fidelity === 'wireframe' ? 'Wireframe ' : ''}${brief.kindLabel}${brief.subtype ? ` · ${brief.subtype}` : ''}`
    : null
  const finalTitle = opts?.title?.trim() || titleFromBrief || 'New design'
  getDb()
    .prepare(`INSERT INTO designs (id, title, cwd, copilot_session_id, current_version, brief, created_at, last_active_at)
              VALUES (?, ?, ?, NULL, NULL, ?, ?, ?)`)
    .run(id, finalTitle, cwd, brief ? JSON.stringify(brief) : null, now, now)
  return getDesign(id)!
}

// ─── Import existing project as a design ──────────────────────────────────

async function importDesignFromFolder(folderPath: string, title?: string): Promise<Design> {
  const id = randomUUID()
  const now = Date.now()
  const cwd = designCwd(id)
  await fs.mkdir(cwd, { recursive: true })

  try {
    await copyDir(folderPath, cwd)

    const entryHtml = await findEntryHtml(cwd)
    let currentVersion: string | null = null
    if (entryHtml) {
      let html = await fs.readFile(entryHtml, 'utf8')
      const entryDir = relative(cwd, entryHtml.replace(/\/[^/]+$/, '')) || '.'
      const baseHref = entryDir === '.' ? './' : `./${entryDir}/`
      if (!/<base\s/i.test(html)) {
        html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">`)
      }
      html = fixAbsoluteAssetPaths(html)
      await fs.writeFile(join(cwd, 'v001.html'), html, 'utf8')
      currentVersion = 'v001'
    }

    const folderName = folderPath.split('/').filter(Boolean).pop() ?? 'Imported'
    const finalTitle = title?.trim() || folderName

    getDb()
      .prepare(`INSERT INTO designs (id, title, cwd, copilot_session_id, current_version, brief, created_at, last_active_at)
                VALUES (?, ?, ?, NULL, ?, NULL, ?, ?)`)
      .run(id, finalTitle, cwd, currentVersion, now, now)
    return getDesign(id)!
  } catch (err) {
    // Clean up partial import
    try { await fs.rm(cwd, { recursive: true, force: true }) } catch {}
    throw err
  }
}

async function importDesignFromGit(repoUrl: string, title?: string): Promise<Design> {
  const id = randomUUID()
  const now = Date.now()
  const cwd = designCwd(id)
  await fs.mkdir(cwd, { recursive: true })

  try {
    // Clone the repo (60s timeout)
    await new Promise<void>((resolve, reject) => {
      const isUrl = /^(https?:\/\/|git@)/.test(repoUrl)
      const isShort = !isUrl && /^[^/\s]+\/[^/\s]+$/.test(repoUrl)

      const cmd = isShort ? 'gh' : 'git'
      const args = isShort
        ? ['repo', 'clone', repoUrl, '.', '--', '--depth', '1']
        : ['clone', '--depth', '1', repoUrl, '.']

      const proc = spawn(cmd, args, { cwd, stdio: 'pipe' })
      let stderr = ''
      const timeout = setTimeout(() => {
        proc.kill()
        reject(new Error('Clone timed out after 60s'))
      }, 60_000)
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
      proc.on('close', (code) => {
        clearTimeout(timeout)
        if (code === 0) resolve()
        else reject(new Error(stderr.trim().slice(0, 300) || `Clone failed with code ${code}`))
      })
      proc.on('error', (err) => { clearTimeout(timeout); reject(err) })
    })

    const entryHtml = await findEntryHtml(cwd)
    let currentVersion: string | null = null
    if (entryHtml) {
      let html = await fs.readFile(entryHtml, 'utf8')
      const entryDir = relative(cwd, entryHtml.replace(/\/[^/]+$/, '')) || '.'
      const baseHref = entryDir === '.' ? './' : `./${entryDir}/`
      if (!/<base\s/i.test(html)) {
        html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">`)
      }
      html = fixAbsoluteAssetPaths(html)
      await fs.writeFile(join(cwd, 'v001.html'), html, 'utf8')
      currentVersion = 'v001'
    }

    const repoName = repoUrl.replace(/\.git$/, '').split('/').pop() ?? 'Cloned'
    const finalTitle = title?.trim() || repoName

    getDb()
      .prepare(`INSERT INTO designs (id, title, cwd, copilot_session_id, current_version, brief, created_at, last_active_at)
                VALUES (?, ?, ?, NULL, ?, NULL, ?, ?)`)
      .run(id, finalTitle, cwd, currentVersion, now, now)
    return getDesign(id)!
  } catch (err) {
    try { await fs.rm(cwd, { recursive: true, force: true }) } catch {}
    throw err
  }
}

async function findEntryHtml(dir: string): Promise<string | null> {
  // Check common entry points in order of priority
  const candidates = [
    join(dir, 'dist', 'index.html'),
    join(dir, 'build', 'index.html'),
    join(dir, 'public', 'index.html'),
    join(dir, 'out', 'index.html'),
    join(dir, 'index.html'),
  ]
  for (const p of candidates) {
    try {
      const s = await fs.stat(p)
      if (s.isFile()) return p
    } catch { /* skip */ }
  }
  // Fallback: find any .html file at root level
  try {
    const files = await fs.readdir(dir)
    const html = files.find((f) => f.endsWith('.html') && !f.startsWith('v'))
    if (html) return join(dir, html)
  } catch { /* skip */ }
  return null
}

async function copyDir(src: string, dest: string): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    if (entry.name === '.git' || entry.name === 'node_modules') continue
    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true })
      await copyDir(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

// Convert absolute asset paths (/assets/..., /img/...) to relative (./assets/...)
// so they work when loaded via file:// with a <base href>.
function fixAbsoluteAssetPaths(html: string): string {
  return html
    .replace(/(src|href)="\/(?!\/)/g, '$1="./')
    .replace(/(src|href)='\/(?!\/)/g, "$1='./")
}

function renameDesign(id: string, title: string): Design | null {
  // Strip em/en-dashes the model loves to inject into auto-generated titles.
  const cleaned = title.replace(/\s*[::]\s*/g, ' - ').replace(/\s+/g, ' ').trim()
  getDb().prepare('UPDATE designs SET title = ?, last_active_at = ? WHERE id = ?')
    .run(cleaned || 'Untitled', Date.now(), id)
  return getDesign(id)
}

async function deleteDesign(id: string): Promise<{ ok: boolean }> {
  const d = getDesign(id)
  if (!d) return { ok: false }
  // Cancel any in-flight run, stop watcher
  cancel(id)
  unwatch(id)
  getDb().prepare('DELETE FROM designs WHERE id = ?').run(id)
  // Best-effort delete cwd
  try { await fs.rm(d.cwd, { recursive: true, force: true }) } catch {}
  return { ok: true }
}

function loadHistory(designId: string): DesignMessage[] {
  const rows = getDb()
    .prepare(`SELECT id, design_id, role, content, tool_calls, status, created_at
              FROM design_messages WHERE design_id = ? ORDER BY created_at ASC, id ASC`)
    .all(designId) as Array<Parameters<typeof rowToMessage>[0]>
  return rows.map(rowToMessage)
}

function insertMessage(m: DesignMessage): void {
  getDb()
    .prepare(`INSERT INTO design_messages (id, design_id, role, content, tool_calls, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(m.id, m.designId, m.role, m.content, JSON.stringify(m.toolCalls), m.status, m.createdAt)
}

function updateMessage(m: DesignMessage): void {
  getDb()
    .prepare(`UPDATE design_messages SET content = ?, tool_calls = ?, status = ? WHERE id = ?`)
    .run(m.content, JSON.stringify(m.toolCalls), m.status, m.id)
}

function saveCopilotResumeId(designId: string, copilotSessionId: string): void {
  getDb()
    .prepare('UPDATE designs SET copilot_session_id = ?, last_active_at = ? WHERE id = ?')
    .run(copilotSessionId, Date.now(), designId)
}

function setCurrentVersion(designId: string, versionId: string): void {
  getDb().prepare('UPDATE designs SET current_version = ?, last_active_at = ? WHERE id = ?')
    .run(versionId, Date.now(), designId)
}

// ─── Versions ─────────────────────────────────────────────────────────────

function listVersions(designId: string): DesignVersion[] {
  const d = getDesign(designId)
  if (!d || !existsSync(d.cwd)) return []
  let names: string[] = []
  try { names = readdirSync(d.cwd) } catch { return [] }
  const out: DesignVersion[] = []
  for (const name of names) {
    const lower = name.toLowerCase()
    const isHtml = lower.endsWith('.html')
    const isPptx = lower.endsWith('.pptx')
    if (!isHtml && !isPptx) continue
    // Only list versioned outputs (vNNN.html / vNNN.pptx). Skip
    // template.pptx and other artefacts in the cwd.
    const idCandidate = name.replace(/\.(html|pptx)$/i, '')
    if (!/^v\d+$/i.test(idCandidate)) continue
    const filePath = join(d.cwd, name)
    let s: ReturnType<typeof statSync>
    try { s = statSync(filePath) } catch { continue }
    if (!s.isFile()) continue
    out.push({
      id: idCandidate,
      designId,
      fileName: name,
      filePath,
      fileUrl: pathToFileURL(filePath).toString(),
      size: s.size,
      modifiedAt: s.mtimeMs,
      kind: isPptx ? 'pptx' : 'html',
      // Companion .pdf for pptx previews: written by the soffice render.
      previewUrl: (() => {
        if (!isPptx) return null
        const pdfPath = filePath.replace(/\.pptx$/i, '.pdf')
        try { return statSync(pdfPath).isFile() ? pathToFileURL(pdfPath).toString() : null } catch { return null }
      })()
    } as DesignVersion)
  }
  // If a vNNN exists in BOTH html and pptx form, prefer pptx.
  const byId = new Map<string, DesignVersion>()
  for (const v of out) {
    const cur = byId.get(v.id)
    if (!cur || (v.fileName.endsWith('.pptx') && !cur.fileName.endsWith('.pptx'))) {
      byId.set(v.id, v)
    }
  }
  const merged = Array.from(byId.values())
  merged.sort((a, b) => a.modifiedAt - b.modifiedAt)
  return merged
}

function nextVersionNumber(designId: string): number {
  const versions = listVersions(designId)
  let max = 0
  for (const v of versions) {
    const m = v.id.match(/^v(\d+)$/i)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max + 1
}

async function createStarterTemplateVersion(designId: string, userText: string, opts: { addWatermark?: boolean } = {}): Promise<DesignVersion | null> {
  const d = getDesign(designId)
  if (!d || !d.brief?.starterTemplateId) return null

  const source = existsSync(join(d.cwd, 'dist', 'index.html'))
    ? join(d.cwd, 'dist', 'index.html')
    : existsSync(join(d.cwd, 'index.html'))
      ? join(d.cwd, 'index.html')
      : null
  if (!source) return null

  let html = await fs.readFile(source, 'utf8')
  const baseDir = relative(d.cwd, source.replace(/\/index\.html$/i, '')) || '.'
  const baseHref = baseDir === '.' ? './' : `./${baseDir}/`
  if (!/<base\s/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">`)
  }
  const b = d.brief
  const title = `${b.starterTemplateName ?? 'Starter'} - ${b.idea || userText || 'adapted preview'}`
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
  if (b.primaryColor || b.secondaryColor || b.accentColor) {
    const css = `\n<style id="t42-template-fallback-theme">\n:root {\n  ${b.primaryColor ? `--t42-primary: ${b.primaryColor};` : ''}\n  ${b.secondaryColor ? `--t42-secondary: ${b.secondaryColor};` : ''}\n  ${b.accentColor ? `--t42-accent: ${b.accentColor};` : ''}\n}\n${opts.addWatermark ? `body::before {\n  content: "${escapeCssString((b.idea || userText || '').slice(0, 120))}";\n  position: fixed;\n  right: 16px;\n  bottom: 16px;\n  z-index: 2147483647;\n  max-width: 360px;\n  padding: 10px 12px;\n  border-radius: 12px;\n  color: #ffffff;\n  background: ${b.primaryColor ?? '#111827'};\n  font: 500 12px/1.4 system-ui, sans-serif;\n  box-shadow: 0 8px 24px rgba(0,0,0,.18);\n  pointer-events: none;\n}` : ''}\n</style>\n`
    html = html.replace(/<\/head>/i, `${css}</head>`)
  }

  const nextFile = `v${String(nextVersionNumber(designId)).padStart(3, '0')}.html`
  await fs.writeFile(join(d.cwd, nextFile), html, 'utf8')
  setCurrentVersion(designId, nextFile.replace(/\.html$/i, ''))
  return listVersions(designId).find((v) => v.fileName === nextFile) ?? null
}

async function buildTemplatePreviewFallback(designId: string, userText: string): Promise<DesignVersion | null> {
  return createStarterTemplateVersion(designId, userText, { addWatermark: true })
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function escapeCssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')
}

// ─── Design prefix (built-in for design.send) ─────────────────────────────

// Anti-AI rule definitions. Mirrors src/renderer/src/lib/aiRules.ts. We
// duplicate the prompt lines here so the main process doesn't reach into
// renderer code. When a rule's id is missing or true in brief.aiRules, the
// rule is enforced. When explicitly false, the rule is dropped from the
// prompt (the user has chosen to allow that AI behaviour for this design).
// One-liner per rule, optimised for prompt size. The wizard's aiRules.ts
// keeps the longer educational text for the UI; the model only needs the
// terse directive. Average ~80 chars each.
const AI_RULE_PROMPT_LINES: Record<string, string> = {
  noFakeMeta:           'No invented version pills, BETA/NEW/PRO chips, breadcrumbs, "Last updated" stamps, or bylines.',
  noFakeTestimonials:   'No invented testimonials. Use a placeholder block "[testimonial]" if structurally needed.',
  noFakeStats:          'No invented stats ("10x faster", "trusted by 10,000+", "4.9/5"). Use "[stat]" placeholder.',
  noEmojiIcons:         'No emoji as icons. Use real inline SVG line icons or omit.',
  noAllCaps:            'No spaced ALL-CAPS. Sentence case for body, Title Case for headings. CAPS only on tiny labels (<= 2 words).',
  noGradients:          'No gradients of any kind unless explicitly asked. Solid fills from the brand palette only.',
  noHeavyShadow:        'Subtle shadows only (offset 0 1px, blur 2-4px, 4-8% opacity). No glows, no neon, no stacked, no coloured.',
  noBlobs:              'No decorative blobs, aurora/mesh backgrounds, floating circles, squiggles, or wavy dividers.',
  noFloatingDashboard:  'No tilted/perspective fake dashboard hero shots. Omit or use a flat illustration.',
  noEmojiFeatureGrid:   'No three-column emoji-icon feature grid with lorem-ipsum. Real copy + real SVG icons or omit.',
  noGenericHero:        'No generic AI marketing copy: "Supercharge", "Modern X for modern Y", "The future of X", "Empower", "Unlock the power", "Build better, faster, smarter", "Everything you need to". Be specific.',
  noOversizedHero:      'Heroes fit their content. No 100vh default. No 80px+ headlines unless asked.',
  noInter:              'Do not default to Inter. If unspecified prefer DM Sans, Plus Jakarta, Geist, Satoshi, Space Grotesk, IBM Plex, or Fraunces (display).',
  noEyebrowPills:       'No eyebrow / kicker pills above hero h1 (small dot/icon + tagline chip). Start with the headline.',
  noEmphasisColor:      'No mid-heading colour shift on one or two words. Single-colour headings; emphasise with weight or a sub-line.',
  noEmDashes:           'No em-dashes (U+2014) or en-dashes (U+2013) anywhere. Use commas, periods, colons, ASCII hyphens, or " \u00b7 ".',
  noAccentLines:        'No decorative accent bars: no underline strokes under headings, no glowing rules, no neon strokes, no full-width ticker stripes, no left-edge coloured stripe (border-l-4) on alerts/callouts/banners. Alerts use tinted bg + icon + text only.',
  noVerboseText:        'Cut filler. No descriptive subtitle below a heading ("Revenue / Track your revenue"). No "Below you can / Here you can / Welcome to" intros. No paragraphs added to balance layout. Numbers, rows, charts speak.',
  noIconContainers:     'No coloured tiles around icons (no `bg-blue-100 rounded-full` discs, no soft pastel halos). Icons stand alone in text-muted, brand on hover.',
  noExcessOutlines:     'Default to NO border. Cards: ONE of {1px border, shadow, elevated bg}, never a combo. Floating + tinted surfaces (toast, banner, alert, callout, popover) get fill + maybe shadow, never a ring AND never a left-edge stripe. Sidebar active = bg tint, never outline. Zebra tables drop per-row borders.',
  noAiSparkleIcons:     'No sparkle/wand/star/AI-badge icons sprinkled across the UI. Only on the actual AI trigger button. Section headings get their real semantic icon or none.'
}
// Display order. Rules listed here go into the prompt; anything else in
// brief.aiRules is ignored.
const AI_RULE_ORDER = [
  'noFakeMeta', 'noFakeTestimonials', 'noFakeStats',
  'noEmojiIcons', 'noAllCaps', 'noGradients', 'noHeavyShadow',
  'noBlobs', 'noFloatingDashboard', 'noEmojiFeatureGrid',
  'noGenericHero', 'noOversizedHero', 'noInter',
  'noEyebrowPills', 'noEmphasisColor', 'noEmDashes', 'noAccentLines',
  'noVerboseText', 'noIconContainers', 'noExcessOutlines', 'noAiSparkleIcons'
]

function aiRulePromptLines(rules: Record<string, boolean> | null | undefined): string[] {
  return AI_RULE_ORDER
    .filter((id) => rules == null || rules[id] !== false) // missing = enforced
    .map((id) => AI_RULE_PROMPT_LINES[id])
    .filter(Boolean)
}


// ─── Prompt construction (stripped for public release) ────────────────────
// Implement your own prompt builders here.

function summariseBrief(b: DesignBrief | null): string {
  if (!b) return ''
  return [b.kindLabel, b.subtype, b.lookLabel, b.audience].filter(Boolean).join(' · ')
}

function formatSpec(_kind: string | undefined): string {
  return ''
}

function planningProtocolBlock(_brief: DesignBrief | null): string {
  return ''
}

function buildStarterPrefix(_cwd: string, _brief: DesignBrief): string {
  return ''
}

function buildPrefix(
  _versionFileName: string,
  _brief: DesignBrief | null,
  _previousVersionFileName: string | null = null,
  _pptxFacts: PptxFacts | null = null
): string {
  // Build your own design system prompt here.
  return ''
}

function summariseBriefForPrompt(_b: DesignBrief | null): string[] {
  return []
}

function emit(win: BrowserWindow | null, channel: string, payload: unknown): void {
  // Guard against post-crash sends. After a renderer kill, webContents is
  // still defined but its frame is disposed: calling .send() throws and
  // also produces "Render frame was disposed" noise in main's stderr.
  try {
    if (!win || win.isDestroyed()) return
    const wc = win.webContents
    if (!wc || wc.isDestroyed() || wc.isCrashed?.()) return
    wc.send(channel, payload)
  } catch { /* silenced: renderer gone */ }
}

function processJsonEvent(
  win: BrowserWindow | null,
  designId: string,
  state: RunState,
  evt: { type: string; data?: Record<string, unknown>; sessionId?: string; exitCode?: number }
): void {
  const t = evt.type

  // Capture rate-limit errors so the close handler can either auto-switch
  // to the "auto" model picker or surface a friendly message. Copilot exits
  // cleanly (code 0) after emitting this so a pure exit-code check misses it.
  if (t === 'session.error') {
    const d = (evt.data as { errorType?: string; message?: string; eligibleForAutoSwitch?: boolean }) ?? {}
    if (d.errorType === 'rate_limit') {
      state.rateLimitMessage = typeof d.message === 'string' ? d.message : 'Copilot rate limit reached.'
      state.rateLimitAutoEligible = !!d.eligibleForAutoSwitch
    }
  }

  // Build a structured checklist as the run progresses. Each step is
  // identified by a stable id; status flips from 'running' → 'done' as
  // the corresponding events fire. The renderer displays this as a
  // ✓ / spinner list so the user can see what's actually happening.
  const setStep = (id: string, label: string, status: 'running' | 'done' | 'error'): void => {
    const existing = state.progress.get(id)
    if (!existing) {
      state.progress.set(id, { id, label, status, startedAt: Date.now() })
      state.progressOrder.push(id)
    } else {
      state.progress.set(id, { ...existing, status, label: label || existing.label })
    }
    emit(win, 'design:progress', {
      designId,
      steps: state.progressOrder.map((sid) => state.progress.get(sid)!).filter(Boolean)
    })
  }
  const finishStep = (id: string): void => {
    const s = state.progress.get(id)
    if (s && s.status === 'running') setStep(id, s.label, 'done')
  }

  // Surface startup progress as live phase strings: copilot takes a few
  // seconds spinning up MCP servers / loading tools before the first
  // assistant.message_start, and otherwise the user just stares at "Working…".
  if (t === 'session.mcp_server_status_changed') {
    const data = (evt.data as Record<string, unknown>) ?? {}
    const name = String(data.serverName ?? '')
    const status = String(data.status ?? '')
    if (status === 'connected') {
      setStep('mcp:' + name, `Connected ${name}`, 'done')
    } else if (status === 'connecting') {
      setStep('mcp:' + name, `Connecting ${name}`, 'running')
    } else {
      setStep('mcp:' + name, `${name}: ${status}`, status === 'error' ? 'error' : 'done')
    }
    return
  }
  if (t === 'session.tools_updated') {
    setStep('tools', 'Loaded tools', 'done')
    return
  }
  if (t === 'assistant.turn_start') {
    setStep('think', 'Thinking', 'running')
    return
  }
  if (t === 'assistant.message_start') {
    finishStep('think')
    setStep('reply', 'Writing reply', 'running')
    const id = randomUUID()
    state.assistantMsgId = id
    const msg: DesignMessage = {
      id, designId, role: 'assistant', content: '',
      toolCalls: Array.from(state.toolCalls.values()),
      status: 'streaming', createdAt: Date.now()
    }
    insertMessage(msg)
    emit(win, 'design:message', msg)
    return
  }
  if (t === 'assistant.message_delta') {
    const delta = String((evt.data as Record<string, unknown>)?.deltaContent ?? '')
    if (!delta || !state.assistantMsgId) return
    state.buffer += delta
    emit(win, 'design:delta', { designId, messageId: state.assistantMsgId, delta })
    return
  }
  if (t === 'assistant.message') {
    finishStep('reply')
    const content = String((evt.data as Record<string, unknown>)?.content ?? state.buffer)
    if (!state.assistantMsgId) return
    const msg: DesignMessage = {
      id: state.assistantMsgId, designId, role: 'assistant', content,
      toolCalls: Array.from(state.toolCalls.values()),
      status: 'done', createdAt: Date.now()
    }
    updateMessage(msg)
    emit(win, 'design:message', msg)
    state.buffer = ''
    state.assistantMsgId = null
    return
  }
  if (t === 'tool.execution_start') {
    const data = (evt.data as Record<string, unknown>) ?? {}
    const id = String(data.toolCallId ?? data.id ?? randomUUID())
    const name = String(data.toolName ?? data.name ?? 'tool')
    const args = data.arguments ?? data.input
    const input = args ? JSON.stringify(args).slice(0, 400) : undefined
    state.toolCalls.set(id, { id, name, input, status: 'running' })
    emit(win, 'design:tool', { designId, tool: state.toolCalls.get(id) })
    setStep('tool:' + id, friendlyToolLabel(name, args), 'running')
    return
  }
  if (t === 'tool.execution_complete' || t === 'tool.execution_end' || t === 'tool.result') {
    const data = (evt.data as Record<string, unknown>) ?? {}
    const id = String(data.toolCallId ?? data.id ?? '')
    const existing = state.toolCalls.get(id)
    if (!existing) return
    const isError = data.success === false || data.status === 'error' || data.outcome === 'error'
    existing.status = isError ? 'error' : 'done'
    const result = data.result as { content?: unknown } | undefined
    const summary = result?.content ?? data.summary
    if (summary) existing.summary = String(summary).slice(0, 280)
    state.toolCalls.set(id, existing)
    emit(win, 'design:tool', { designId, tool: existing })
    setStep('tool:' + id, '', isError ? 'error' : 'done')
    return
  }
  if (t === 'result') {
    // Mark any lingering steps as done
    for (const sid of state.progressOrder) {
      const s = state.progress.get(sid)
      if (s && s.status === 'running') setStep(sid, s.label, 'done')
    }
    const copilotSessionId = (evt as { sessionId?: string }).sessionId
    if (copilotSessionId) saveCopilotResumeId(designId, copilotSessionId)
    // NOTE: do NOT emit 'design:done' here. The CLI emits `result` before
    // the child process actually closes, which means `running.has()` is
    // still true. Emitting `design:done` here would flip the renderer's
    // busy state to false, the queue drainer would fire, and the next
    // send() would be rejected with "Another response is in progress" —
    // dropping the user's queued/annotation prompt. `finalizeRun` (called
    // from child 'close') is now the single source of truth for done.
    return
  }
}

// Map raw tool names + arguments to short human labels for the progress
// checklist. Falls back to the tool name as-is.
function friendlyToolLabel(toolName: string, args?: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>
  const path = (a.path ?? a.file ?? a.filePath ?? a.targetPath) as string | undefined
  const baseName = path ? String(path).split('/').filter(Boolean).pop() : undefined
  const lower = (toolName || '').toLowerCase()
  if (lower === 'create' || lower === 'write_file' || lower.includes('write')) return baseName ? `Writing ${baseName}` : 'Writing file'
  if (lower === 'edit' || lower.includes('edit') || lower.includes('replace')) return baseName ? `Editing ${baseName}` : 'Editing file'
  if (lower.includes('read') || lower === 'view') return baseName ? `Reading ${baseName}` : 'Reading file'
  if (lower.includes('grep') || lower.includes('search')) {
    const pat = (a.pattern ?? a.query) as string | undefined
    return pat ? `Searching for "${String(pat).slice(0, 30)}"` : 'Searching'
  }
  if (lower.includes('bash') || lower.includes('shell')) {
    // Surface the actual command (or its head) so the user can see what
    // is being run: much more useful than three identical 'Running shell'
    // lines in a row.
    const cmd = (a.command ?? a.cmd ?? a.script) as string | undefined
    if (cmd) {
      const oneLine = String(cmd).replace(/\s+/g, ' ').trim()
      // Take the first sub-command before && or | so the label stays short.
      const head = oneLine.split(/\s*&&\s*|\s*\|\s*|\s*;\s*/)[0]
      return head.length > 60 ? `Running: ${head.slice(0, 60)}…` : `Running: ${head}`
    }
    return 'Running shell'
  }
  if (lower === 'glob' || lower === 'find' || lower === 'list') return 'Listing files'
  if (lower.startsWith('figma')) {
    // figma-create_new_file → "Figma · create new file"
    const stripped = toolName.replace(/^figma[-_]/i, '').replace(/[-_]/g, ' ')
    return `Figma · ${stripped}`
  }
  return toolName
}

function parseLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try { return JSON.parse(trimmed) as Record<string, unknown> } catch { return null }
}

// Build a per-design AGENTS.md so the Copilot CLI injects template
// constraints into the system prompt automatically: much more sticky than
// a single user-message prompt the model can rush past.
function buildAgentsMd(facts: PptxFacts): string {
  const colors = Object.entries(facts.theme.colors)
  const colorCss = colors.map(([k, v]) => `  --${k}: ${v};`).join('\n')
  const heading = facts.theme.headingFont || 'system-ui'
  const body = facts.theme.bodyFont || 'system-ui'
  const slideLines = facts.slides.map((s) =>
    `${String(s.index).padStart(2, '0')}. [${s.layoutName ?? '?'}] ${s.title ? `"${s.title}"` : '(no title)'}`
  ).join('\n')
  return [
    '# TEMPLATE FIDELITY: STRICT MODE',
    '',
    'This design has a .pptx template attached and the user ticked "Use everything from this template".',
    'You MUST follow the template 1:1 for visuals. Only the CONTENT of each slide changes.',
    '',
    '## Hard rules',
    '',
    `- Output exactly **${facts.slideCount} slides** in the same order, one \`<section class="slide">\` each.`,
    `- Slide artboard size: **${facts.slideWidthPx}×${facts.slideHeightPx}px** (${facts.aspect}). Apply to every \`.slide\`.`,
    '- Use ONLY the theme colours below as `:root` CSS variables. Reference them via `var(--xxx)` everywhere: do NOT hardcode any other hex values.',
    '- Use ONLY the theme fonts below for headings and body. Do NOT default to Inter / DM Sans / etc.',
    '- Do NOT add gradients, eyebrow pills, fake testimonials, fake stats, em-dashes, or any decoration not in the original template.',
    '- Mirror each slide\'s layout: title slide → centered title + subtitle; title+content → top title + body block; two-content → title + 2 columns; section header → centered eyebrow + giant title.',
    '',
    '## CSS scaffold (paste this into `<style>` and only fill in the rest)',
    '',
    '```css',
    ':root {',
    colorCss,
    `  --font-heading: "${heading}", system-ui, sans-serif;`,
    `  --font-body: "${body}", system-ui, sans-serif;`,
    '}',
    'html, body { margin: 0; height: 100vh; overflow: hidden; }',
    'body { display: flex; flex-direction: row; overflow-x: auto; scroll-snap-type: x mandatory; font-family: var(--font-body); }',
    `.slide { flex: 0 0 ${facts.slideWidthPx}px; height: ${facts.slideHeightPx}px; box-sizing: border-box; scroll-snap-align: start; }`,
    'h1, h2, h3, h4 { font-family: var(--font-heading); margin: 0; }',
    '```',
    '',
    '## Per-slide content map',
    '',
    'The user will tell you what to put on each slide. Map their content onto these existing slots: keep word counts roughly equal:',
    '',
    '```',
    slideLines,
    '```',
    '',
    '## Workflow',
    '',
    '1. Read this file (you already are).',
    '2. Read the user\'s idea / instruction.',
    '3. Write the HTML: start with the CSS scaffold above, then write each `<section class="slide">` in order.',
    '4. Reply with at most 4 bullets describing what changed (no HTML in chat).'
  ].join('\n') + '\n'
}

async function send(
  win: BrowserWindow | null,
  designId: string,
  text: string,
  opts: { model?: string | null; skipPrefix?: boolean; useFigma?: boolean; freshSession?: boolean; agentMode?: 'interactive' | 'plan' | 'autopilot'; isAutoFix?: boolean; displayText?: string | null; isModelFallback?: boolean; isAutoFallback?: boolean }
): Promise<{ ok: true } | { ok: false; error: string; accepted?: boolean }> {
  const d = getDesign(designId)
  if (!d) return { ok: false, error: 'Design not found.', accepted: false }
  // Auto-fix runs are triggered from inside the previous run's close
  // handler, BEFORE finalizeRun has had a chance to clear `running`.
  // They are internal continuations of the same logical user request,
  // so allow them through. For all other callers, busy means busy.
  // `accepted: false` tells the renderer the user's text was NOT persisted,
  // so the composer can restore it instead of silently swallowing the input.
  if (running.has(designId) && !opts.isAutoFix && !opts.isModelFallback && !opts.isAutoFallback) {
    return { ok: false, error: 'Another response is in progress.', accepted: false }
  }
  // For auto-fix continuations, clear the stale entry before starting so
  // the new run owns the running slot cleanly.
  if (running.has(designId) && opts.isAutoFix) {
    running.delete(designId)
  }

  const versionNum = nextVersionNumber(designId)
  // PPT EDIT MODE: when useTemplateLook + .pptx, the output is a real
  // .pptx (cloned + XML-edited from the template) instead of a fresh
  // HTML file. The model preserves slide masters/layouts/theme by never
  // recreating them.
  const isPptxEdit = !opts.skipPrefix
    && !!d.brief?.templateFile
    && d.brief.templateFile.toLowerCase().endsWith('.pptx')
    && !!d.brief?.useTemplateLook
  const versionFileName = isPptxEdit
    ? `v${String(versionNum).padStart(3, '0')}.pptx`
    : `v${String(versionNum).padStart(3, '0')}.html`
  // For previous-version reads in iteration mode, look at whatever the
  // last version actually was (could be html or pptx).
  const prior = listVersions(designId)
  const prevVersion = prior[prior.length - 1] ?? null
  const previousVersionFileName = prevVersion?.fileName ?? null

  // If a .pptx template is attached, pre-extract its facts on this side
  // so the LLM doesn't need to parse XML: slide count, hex palette,
  // fonts, per-slide layout/title/body. This is the single biggest
  // hardening lever for template fidelity.
  let pptxFacts: PptxFacts | null = null
  let pptxError: string | null = null
  if (!opts.skipPrefix && d.brief?.templateFile && d.brief.templateFile.toLowerCase().endsWith('.pptx')) {
    try {
      const tplPath = join(d.cwd, d.brief.templateFile)
      pptxFacts = await extractPptxFacts(tplPath, d.cwd)
      // Persist the extracted facts to disk so the model can cat the file
      // back if it doubts the prompt: and so the user can see what we
      // grounded on. Lives next to the unzipped template.
      try {
        const factsLines = pptxFactsToPrompt(pptxFacts)
        await fs.writeFile(join(d.cwd, '_tpl', '_facts.md'), factsLines.join('\n'), 'utf8')
      } catch {}
      // ALSO write a per-design AGENTS.md with template constraints. Copilot
      // CLI reads project-level instructions from cwd automatically and
      // injects them into the system prompt: far more sticky than a one-
      // shot user prompt.
      if (d.brief?.useTemplateLook) {
        try {
          const agentsMd = buildAgentsMd(pptxFacts)
          await fs.writeFile(join(d.cwd, 'AGENTS.md'), agentsMd, 'utf8')
        } catch {}
      }
    } catch (err) {
      console.error('[design] pptx extract failed:', err)
      pptxError = String(err).slice(0, 200)
    }
  }

  const isStarterFirstRun = !opts.skipPrefix
    && !!d.brief?.starterTemplateId
    && !d.copilotSessionId

  // Imported designs have no brief — skip the heavy prefix and just let
  // the user chat naturally. The model can read the HTML from the cwd.
  const isImported = !d.brief && !opts.skipPrefix

  const prefix = opts.skipPrefix || isImported
    ? ''
    : isStarterFirstRun
      ? buildStarterPrefix(d.cwd, d.brief!)
      : buildPrefix(versionFileName, d.brief, previousVersionFileName, pptxFacts)
  const promptText = prefix ? `${prefix}\n\n${text}` : text

  const userMsg: DesignMessage = {
    id: randomUUID(), designId, role: 'user',
    // What the user sees in chat history. Defaults to the same text we
    // send to the model, but external callers (annotations, direct
    // edits, etc.) can supply a clean English-readable version via
    // `displayText` while the model still receives the full prompt with
    // technical context (selectors, style payloads, etc.).
    content: opts.displayText && opts.displayText.trim() ? opts.displayText.trim() : text,
    toolCalls: [], status: 'done', createdAt: Date.now()
  }
  insertMessage(userMsg)
  emit(win, 'design:message', userMsg)

  // Surface what we extracted (or what failed) so the user can see whether
  // the template was actually grounded: saves an hour of guessing.
  if (pptxFacts) {
    const colors = Object.entries(pptxFacts.theme.colors).slice(0, 4)
      .map(([k, v]) => `${k} ${v}`).join('  ')
    const fonts = [pptxFacts.theme.headingFont, pptxFacts.theme.bodyFont].filter(Boolean).join(' / ') || ':'
    const summary = `Template ready · ${pptxFacts.slideCount} slides ${pptxFacts.aspect} · ${fonts} · ${colors}`
    const sysMsg: DesignMessage = {
      id: randomUUID(), designId, role: 'system',
      content: summary, toolCalls: [], status: 'done', createdAt: Date.now()
    }
    insertMessage(sysMsg); emit(win, 'design:message', sysMsg)
  } else if (pptxError) {
    const sysMsg: DesignMessage = {
      id: randomUUID(), designId, role: 'system',
      content: `Template extract failed: ${pptxError}. The model will fall back to unzipping it itself.`,
      toolCalls: [], status: 'done', createdAt: Date.now()
    }
    insertMessage(sysMsg); emit(win, 'design:message', sysMsg)
  }

  // First message of a design: surface the brief so the user can see what
  // configuration was sent to Copilot. Subsequent turns are continuations.
  if (!d.copilotSessionId && d.brief) {
    const briefSummary = summariseBrief(d.brief)
    if (briefSummary) {
      const sysMsg: DesignMessage = {
        id: randomUUID(), designId, role: 'system',
        content: `Brief · ${briefSummary}`,
        toolCalls: [], status: 'done', createdAt: Date.now()
      }
      insertMessage(sysMsg)
      emit(win, 'design:message', sysMsg)
    }
  }

  // Apply mode: prepend a small instruction so the agent's behaviour matches
  // the user's choice, and adjust CLI flags. We can't fully gate the CLI's
  // ask_user from here in interactive mode, so we instead instruct via prompt.
  const mode = opts.agentMode ?? 'interactive'
  let modePrefix = ''
  if (mode === 'plan') {
    modePrefix = 'MODE: PLAN. Before writing or running anything, draft a short numbered plan (3-7 steps) of what you intend to do, then STOP and wait for the user to reply with "go" or edits. Do not call any write/edit/exec tools yet.\n\n'
  } else if (mode === 'autopilot') {
    modePrefix = 'MODE: AUTOPILOT. Execute the full task end-to-end without asking clarifying questions. Make reasonable defaults silently. Only stop on a hard error you cannot recover from.\n\n'
  } else {
    modePrefix = 'MODE: INTERACTIVE. Work in small reversible steps. After each meaningful action (file write, command run, external API call), pause briefly to let the user steer if needed. Prefer asking one short clarifying question over making a wrong assumption.\n\n'
  }

  // Free-form Figma guidance: matches what chat.ts does. Triggers when the
  // user mentions Figma in a regular design-chat turn (not from the
  // dedicated export buttons, which already inject their own full prompt).
  let figmaPrefix = ''
  if (!opts.skipPrefix && /\bfigma\b/i.test(text)) {
    figmaPrefix = [
      'FIGMA AVAILABLE. Two MCP servers can write to Figma. Pick the best path:',
      '  1. figma-write-* (custom server, requires the "MCP WebSocket Client" plugin running in Figma Desktop). Highest fidelity. Probe with figma-write-figma_plugin_status (5s timeout). If it responds, use figma-write-figma_pages / figma_nodes / figma_auto_layout / figma_text / figma_fills / figma_strokes / figma_effects / figma_fonts. For icons use figma-write-figma_svg with SVG fetched from a CDN (Phosphor / Tabler / Lucide / Remix); replace currentColor with the right hex first.',
      '  2. figma-* (official Anthropic + Figma MCP, same backend Claude Code uses, no plugin needed). If the figma-write probe fails, fall back to: figma-whoami → figma-create_new_file → figma-use_figma to run a Plugin API script that builds the design. Inside that script, await figma.loadFontAsync before text, use auto-layout with HUG/FILL sizing, use figma.createNodeFromSvg for icons.',
      'Quality rules either way: real auto-layout frames, real text nodes, real vector icons. Never substitute icons with basic shapes. Never use FIXED sizing on auto-layout frames. No em-dashes (U+2014) in any layer/text — use ASCII "-".',
      ''
    ].join('\n')
  }

  const finalPromptText = figmaPrefix + modePrefix + promptText

  const args: string[] = [
    '--prompt', finalPromptText,
    '--allow-all-tools',
    '--allow-all-paths',
    '--output-format', 'json',
    '--no-color',
    '-C', d.cwd
  ]
  // Plan mode: leave ask_user enabled so the CLI can pause for confirmation.
  // Interactive + autopilot: keep --no-ask-user so the agent never blocks on
  // a clarifying-question prompt (interactive uses prompt-level gating instead).
  if (mode !== 'plan') args.push('--no-ask-user')
  // Only Figma EXPORT runs need explicit reasoning effort to handle Plugin API
  // quirks. For regular HTML/template runs, omit --effort entirely: some model
  // router choices (especially "auto") reject effort configuration and exit 1.
  if (opts.useFigma && opts.model !== 'auto') args.push('--effort', 'medium')
  if (opts.model) args.push('--model', opts.model)
  if (d.copilotSessionId && !opts.freshSession) args.push('--resume', d.copilotSessionId)

  // Disable MCP servers that aren't needed for THIS run. Each enabled
  // MCP server adds startup latency + tool-list bloat the model has to
  // All custom MCP servers (figma, figma-write, viztweak, workiq) have been
  // removed from ~/.copilot/mcp-config.json — Figma work now happens through
  // the model's general HTML / spec generation, not via Plugin API tooling.
  // Nothing to disable here anymore.

  // Defensive: if the target version file somehow already exists (a previous
  // run left a partial write, a manual touch, etc.), delete it now so the
  // model's `create` tool can't fail with "file exists" and trigger a retry
  // loop. The model is told to write THIS exact filename so this never
  // collides with the user's other files.
  if (!opts.skipPrefix && !isStarterFirstRun && versionFileName) {
    try { await fs.unlink(join(d.cwd, versionFileName)) } catch { /* fine if absent */ }
  }

  let child: ChildProcess
  try {
    child = spawn('copilot', args, {
      cwd: d.cwd,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      // Run copilot in its own process group so we can kill the WHOLE
      // tree (copilot + MCP child processes) on cancel via process.kill(-pid).
      // Without this, SIGTERM only hits the copilot wrapper and the MCP
      // children keep working, which is why "Stop" appeared to do nothing.
      detached: true
    })
  } catch (err) {
    const errMsg: DesignMessage = {
      id: randomUUID(), designId, role: 'system',
      content: `Failed to start copilot: ${String(err)}`, toolCalls: [],
      status: 'error', createdAt: Date.now()
    }
    insertMessage(errMsg)
    emit(win, 'design:message', errMsg)
    emit(win, 'design:done', { designId, exitCode: -1 })
    return { ok: false, error: String(err) }
  }

  const state: RunState = {
    child, assistantMsgId: null, buffer: '', toolCalls: new Map(), cancelled: false,
    progress: new Map(), progressOrder: [], isAutoFix: !!opts.isAutoFix,
    doneEmitted: false,
    requestedModel: opts.model ?? null,
    originalText: text,
    originalOpts: {
      skipPrefix: opts.skipPrefix,
      useFigma: opts.useFigma,
      freshSession: opts.freshSession,
      agentMode: opts.agentMode,
      isAutoFix: opts.isAutoFix,
      displayText: opts.displayText
    },
    isModelFallback: !!opts.isModelFallback,
    isAutoFallback: !!opts.isAutoFallback,
    rateLimitMessage: null,
    rateLimitAutoEligible: false
  }
  running.set(designId, state)
  emit(win, 'design:start', { designId })

  let stdoutBuf = ''
  let stderrBuf = ''
  child.stdout?.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString('utf8')
    let nl = stdoutBuf.indexOf('\n')
    while (nl !== -1) {
      const line = stdoutBuf.slice(0, nl)
      stdoutBuf = stdoutBuf.slice(nl + 1)
      const evt = parseLine(line)
      if (evt) processJsonEvent(win, designId, state, evt as Parameters<typeof processJsonEvent>[3])
      nl = stdoutBuf.indexOf('\n')
    }
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8')
    stderrBuf += text
    const line = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(-1)[0]
    if (line && !/electron security warning|download the react devtools/i.test(line)) {
      emit(win, 'design:phase', { designId, phase: line.length > 140 ? line.slice(0, 137) + '...' : line })
    }
  })
  child.on('error', (err) => {
    const errMsg: DesignMessage = {
      id: randomUUID(), designId, role: 'system',
      content: `copilot error: ${String(err)}`, toolCalls: [],
      status: 'error', createdAt: Date.now()
    }
    insertMessage(errMsg)
    emit(win, 'design:message', errMsg)
    // Defensive cleanup: 'error' is not always followed by 'close', and
    // without finalizing here a future send() would block on running.has().
    finalizeRun(win, designId, state, -1)
  })
  child.on('close', async (code) => {
    if (stdoutBuf.trim()) {
      const evt = parseLine(stdoutBuf)
      if (evt) processJsonEvent(win, designId, state, evt as Parameters<typeof processJsonEvent>[3])
    }

    // ─── RATE-LIMIT RECOVERY ────────────────────────────────────────────
    // Copilot emits a session.error with errorType:"rate_limit" and then
    // shuts down cleanly (exit code 0). If the message says we can switch
    // to "auto" (eligibleForAutoSwitch), retry once with --model auto so
    // the user actually gets a response. Only one auto-switch per turn.
    if (state.rateLimitMessage && !state.cancelled && state.rateLimitAutoEligible && !state.isAutoFallback) {
      if (state.assistantMsgId) {
        const msg: DesignMessage = {
          id: state.assistantMsgId, designId, role: 'assistant',
          content: '', toolCalls: [], status: 'cancelled', createdAt: Date.now()
        }
        updateMessage(msg)
        emit(win, 'design:message', msg)
      }
      const notice: DesignMessage = {
        id: randomUUID(), designId, role: 'system',
        content: 'Hit the rate limit on the default model. Retrying with the "auto" picker (uses any model that\'s currently available).',
        toolCalls: [], status: 'done', createdAt: Date.now()
      }
      insertMessage(notice)
      emit(win, 'design:message', notice)
      finalizeRun(win, designId, state, code ?? -1)
      void send(win, designId, state.originalText, { ...state.originalOpts, model: 'auto', isModelFallback: true, isAutoFallback: true })
      return
    }
    // Rate-limit but no auto-switch path available (or auto also rate-limited):
    // surface the message clearly instead of silently exiting.
    if (state.rateLimitMessage && !state.cancelled) {
      if (state.assistantMsgId) {
        const msg: DesignMessage = {
          id: state.assistantMsgId, designId, role: 'assistant',
          content: '', toolCalls: [], status: 'cancelled', createdAt: Date.now()
        }
        updateMessage(msg)
        emit(win, 'design:message', msg)
      }
      const fallback = await buildTemplatePreviewFallback(designId, state.originalText).catch(() => null)
      const errMsg: DesignMessage = {
        id: randomUUID(), designId, role: 'system',
        content: fallback
          ? `Copilot rate limit reached, so I opened the cloned template as ${fallback.fileName} for now. The template files are in this design folder; once quota is available, send another instruction to adapt the copy/colors.\n\n${state.rateLimitMessage}`
          : `Copilot rate limit reached.\n\n${state.rateLimitMessage}`,
        toolCalls: [], status: fallback ? 'done' : 'error', createdAt: Date.now()
      }
      insertMessage(errMsg)
      emit(win, 'design:message', errMsg)
      if (fallback) {
        const versions = listVersions(designId)
        emit(win, 'design:version', { designId, latest: fallback, versions })
      }
      finalizeRun(win, designId, state, code ?? -1)
      return
    }

    // ─── MODEL FALLBACK ─────────────────────────────────────────────────
    // Copilot CLI in one-shot mode (-p / --prompt) does NOT auto-fall-back
    // when --model is unrecognized; it just exits with code 1. Detect that
    // exact failure and transparently retry the same prompt without --model,
    // so the user gets a response instead of a cryptic error. Only retry
    // once (state.isModelFallback guards), and only when the user actually
    // requested a specific model (otherwise there's nothing to drop).
    const modelUnavailable = code !== 0
      && !state.cancelled
      && !!state.requestedModel
      && !state.isModelFallback
      && /from --model flag is not available/i.test(stderrBuf)
    if (modelUnavailable) {
      // Clear the empty assistant message so the retry's new message is
      // the only "live" one for this turn.
      if (state.assistantMsgId) {
        const msg: DesignMessage = {
          id: state.assistantMsgId, designId, role: 'assistant',
          content: '', toolCalls: [], status: 'cancelled', createdAt: Date.now()
        }
        updateMessage(msg)
        emit(win, 'design:message', msg)
      }
      const notice: DesignMessage = {
        id: randomUUID(), designId, role: 'system',
        content: `Model "${state.requestedModel}" isn't available on this Copilot CLI right now — retrying with the default model.`,
        toolCalls: [], status: 'done', createdAt: Date.now()
      }
      insertMessage(notice)
      emit(win, 'design:message', notice)
      finalizeRun(win, designId, state, code ?? -1)
      void send(win, designId, state.originalText, { ...state.originalOpts, model: null, isModelFallback: true })
      return
    }

    if (state.assistantMsgId) {
      const msg: DesignMessage = {
        id: state.assistantMsgId, designId, role: 'assistant',
        content: state.buffer || '(no response)',
        toolCalls: Array.from(state.toolCalls.values()),
        status: state.cancelled ? 'cancelled' : (code === 0 ? 'done' : 'error'),
        createdAt: Date.now()
      }
      updateMessage(msg)
      emit(win, 'design:message', msg)
    }
    if (code !== 0 && !state.cancelled) {
      const tail = stderrBuf.split('\n').filter(Boolean).slice(-3).join('\n')
      if (tail) {
        const errMsg: DesignMessage = {
          id: randomUUID(), designId, role: 'system',
          content: `copilot exited with code ${code}\n${tail}`, toolCalls: [],
          status: 'error', createdAt: Date.now()
        }
        insertMessage(errMsg)
        emit(win, 'design:message', errMsg)
      }
    }

    // ─── AUTO-LINT PASS ──────────────────────────────────────────────────
    // After a successful HTML build, scan the latest version for hard
    // style-rule violations. If any are found, automatically queue a fix
    // turn so the model gets a second pass at obeying the contract. The
    // model frequently ignores the prompt; this is the enforcement layer.
    //
    // Skips: cancelled runs, error exits, pptx outputs, runs that are
    // themselves auto-fixes (one retry only — no infinite loops), and
    // designs where the user has disabled auto-fix in settings.
    if (code === 0 && !state.cancelled && !state.isAutoFix) {
      // Skip auto-lint for imported designs (no brief) — they have their
      // own style choices that shouldn't be overridden by our rules.
      const designForLint = getDesign(designId)
      if (designForLint?.brief) {
        try {
          await runAutoLint(win, designId)
        } catch (err) {
          console.error('[design] auto-lint failed:', err)
        }
      }
    }

    finalizeRun(win, designId, state, code ?? -1)
  })
  return { ok: true }
}

// Read the latest version file, lint it, and if violations are found, fire
// a follow-up "fix" turn that asks the model to save vN+1.html with the
// violations corrected. Marks the new turn so we don't recurse forever.
async function runAutoLint(win: BrowserWindow | null, designId: string): Promise<void> {
  const d = getDesign(designId)
  if (!d) return
  const versions = listVersions(designId)
  const latest = versions[versions.length - 1]
  if (!latest || latest.kind !== 'html') return

  let html = ''
  try {
    html = await fs.readFile(latest.filePath, 'utf8')
  } catch {
    return
  }
  const enforcedRules = d.brief?.aiRules
    ? Object.keys(d.brief.aiRules).filter((id) => d.brief!.aiRules![id] !== false)
    : null
  const violations = lintHtml(html, enforcedRules)
  if (violations.length === 0) return

  const nextNum = (parseInt(latest.id.slice(1), 10) || 0) + 1
  const nextFile = `v${String(nextNum).padStart(3, '0')}.html`
  const fixText = buildFixPrompt(violations, latest.fileName, nextFile)

  // Surface the lint result in the chat as a system message so the user
  // can see what was caught and what's being auto-corrected.
  const sysMsg: DesignMessage = {
    id: randomUUID(),
    designId,
    role: 'system',
    content: `Auto-fix: ${violations.length} style-rule violation${violations.length === 1 ? '' : 's'} detected in ${latest.fileName}. Generating ${nextFile} with corrections…\n\n${violations.map((v) => '• ' + v.message).join('\n')}`,
    toolCalls: [],
    status: 'done',
    createdAt: Date.now(),
  }
  insertMessage(sysMsg)
  emit(win, 'design:message', sysMsg)

  await send(win, designId, fixText, { skipPrefix: true, isAutoFix: true })
}

function cancel(designId: string): boolean {
  const state = running.get(designId)
  if (!state) return false
  state.cancelled = true
  const pid = state.child.pid
  // Kill the WHOLE process group (copilot + every MCP child it spawned).
  // Without -pid, SIGTERM only hits the copilot wrapper and the MCP
  // workers keep streaming, so the run never ends and the Stop button
  // appears stuck.
  try {
    if (pid) process.kill(-pid, 'SIGTERM')
    else state.child.kill('SIGTERM')
  } catch {
    try { state.child.kill('SIGTERM') } catch {}
  }
  setTimeout(() => {
    const s = running.get(designId)
    if (!s) return
    try {
      if (pid) process.kill(-pid, 'SIGKILL')
      else s.child.kill('SIGKILL')
    } catch {
      try { s.child.kill('SIGKILL') } catch {}
    }
    // Final safeguard: if the child is wedged and 'close' never fires (e.g.
    // signals not propagating to the process group), the design would stay
    // "running" forever and every future send() would silently early-return.
    // finalizeRun is identity-guarded so this can't clobber a new run that
    // started cleanly in the meantime.
    setTimeout(() => {
      const current = running.get(designId)
      if (current === state) finalizeRun(null, designId, state, -1)
    }, 2000)
  }, 1500)
  return true
}

// ─── Watcher ──────────────────────────────────────────────────────────────

function watchDesign(getWin: () => BrowserWindow | null, designId: string): void {
  if (watchers.has(designId)) return
  const d = getDesign(designId)
  if (!d) return
  void fs.mkdir(d.cwd, { recursive: true }).then(() => {
    let pending: NodeJS.Timeout | null = null
    // Track in-flight pdf renders so we don't queue duplicates.
    const rendering = new Set<string>()
    const w = fsWatch(d.cwd, { persistent: false }, (_evt, fileName) => {
      if (!fileName) return
      const lower = String(fileName).toLowerCase()
      const isHtml = lower.endsWith('.html')
      const isPptx = lower.endsWith('.pptx')
      if (!isHtml && !isPptx) return

      // When a vNNN.pptx lands, kick off the soffice -> PDF render so the
      // canvas can preview it. The PDF lands as vNNN.pdf in the same dir.
      if (isPptx && /^v\d+\.pptx$/i.test(fileName as string) && !rendering.has(fileName as string)) {
        rendering.add(fileName as string)
        const pptxPath = join(d.cwd, fileName as string)
        // Run async, don't block the watcher. When it completes the PDF
        // will appear in the cwd and trigger another fsWatch event so the
        // canvas refreshes.
        void pptxToPdf(pptxPath).then((pdf) => {
          rendering.delete(fileName as string)
          if (pdf) {
            // Re-emit the version list so the renderer sees previewUrl pop.
            try {
              const versions = listVersions(designId)
              const latest = versions[versions.length - 1] ?? null
              getWin()?.webContents.send('design:version', { designId, latest, versions })
            } catch {}
          }
        }).catch(() => { rendering.delete(fileName as string) })
      }

      if (pending) clearTimeout(pending)
      pending = setTimeout(() => {
        pending = null
        const versions = listVersions(designId)
        const latest = versions[versions.length - 1] ?? null
        if (latest) setCurrentVersion(designId, latest.id)
        try {
          getWin()?.webContents.send('design:version', { designId, latest, versions })
        } catch {}
      }, 250)
    })
    watchers.set(designId, w)
  }).catch(() => {})
}

function unwatch(designId: string): void {
  const w = watchers.get(designId)
  if (!w) return
  try { w.close() } catch {}
  watchers.delete(designId)
}

export function stopAllDesignWatchers(): void {
  for (const [id] of watchers) unwatch(id)
}

export function killAllDesignRuns(): void {
  for (const [id] of running) cancel(id)
}

// ─── Auto-title from first user prompt ────────────────────────────────────

// Strip em/en-dashes the model loves to add. Replace with a regular " - "
// so titles like "Lumen: Home" become "Lumen - Home".
function stripDashes(s: string): string {
  return s.replace(/\s*[::]\s*/g, ' - ').replace(/\s+/g, ' ').trim()
}

function autoTitleFromText(text: string): string {
  const t = stripDashes(text).split('\n')[0].slice(0, 60)
  return t || 'New design'
}

function maybeAutoTitle(designId: string, text: string): void {
  const d = getDesign(designId)
  if (!d) return
  if (d.title && d.title !== 'New design' && d.title !== 'Figma design') return
  const next = autoTitleFromText(text)
  if (next && next !== d.title) renameDesign(designId, next)
}

// ─── Export ───────────────────────────────────────────────────────────────

// Render an HTML file in an off-screen BrowserWindow at a given viewport,
// then run a callback against its webContents to produce bytes (PDF / PNG).
async function renderHtmlOffscreen<T>(
  htmlPath: string,
  viewport: { width: number; height: number },
  produce: (wc: Electron.WebContents) => Promise<T>
): Promise<T> {
  const win = new BrowserWindow({
    show: false,
    width: viewport.width,
    height: viewport.height,
    webPreferences: { offscreen: false, sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  try {
    await win.loadFile(htmlPath)
    // Give CSS / web fonts / images a beat to settle before capture.
    await new Promise((r) => setTimeout(r, 350))
    return await produce(win.webContents)
  } finally {
    try { win.destroy() } catch {}
  }
}

type ExportFormat = 'html' | 'pdf' | 'png' | 'pptx'

function extFor(fmt: ExportFormat): string {
  return fmt === 'pptx' ? 'pptx' : fmt === 'png' ? 'png' : fmt === 'pdf' ? 'pdf' : 'html'
}

async function exportLatest(
  designId: string,
  format: ExportFormat
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const versions = listVersions(designId)
  const latest = versions[versions.length - 1]
  if (!latest) return { ok: false, error: 'No version yet.' }
  const d = getDesign(designId)
  if (!d) return { ok: false, error: 'Design not found.' }

  const safeBase = (d.title || 'design').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'design'
  const defaultName = `${safeBase}-${latest.id}.${extFor(format)}`
  const res = await dialog.showSaveDialog({
    title: `Export as ${format.toUpperCase()}`,
    defaultPath: defaultName
  })
  if (res.canceled || !res.filePath) return { ok: false, error: 'Cancelled.' }
  const out = res.filePath

  try {
    if (format === 'html') {
      await fs.copyFile(latest.filePath, out)
      return { ok: true, path: out }
    }

    // Choose a sensible viewport for the offscreen render. For per-kind
    // formats we already constrain the artboard inside the HTML, so a
    // generous canvas is fine.
    const viewport = viewportForKind(d.brief?.kind)

    if (format === 'pdf') {
      const pdf = await renderHtmlOffscreen(latest.filePath, viewport, (wc) =>
        wc.printToPDF({
          printBackground: true,
          pageSize: pdfPageForKind(d.brief?.kind),
          landscape: pdfLandscapeForKind(d.brief?.kind),
          margins: { top: 0, bottom: 0, left: 0, right: 0 }
        })
      )
      await fs.writeFile(out, pdf)
      return { ok: true, path: out }
    }

    if (format === 'png') {
      const png = await renderHtmlOffscreen(latest.filePath, viewport, async (wc) => {
        const img = await wc.capturePage()
        return img.toPNG()
      })
      await fs.writeFile(out, png)
      return { ok: true, path: out }
    }

    if (format === 'pptx') {
      // Take one PNG per <section class="slide"> and stitch into a deck.
      // We resize the BrowserWindow to each slide's bounding box.
      const pptxgen = (await import('pptxgenjs')).default
      const pres = new pptxgen()
      pres.layout = 'LAYOUT_WIDE' // 13.3 × 7.5 in (16:9)

      const slides = await renderHtmlOffscreen(latest.filePath, { width: 1280, height: 720 }, async (wc) => {
        // Pull bounding rects for every .slide section
        const rects = (await wc.executeJavaScript(`
          (() => {
            const out = [];
            document.querySelectorAll('section.slide, .slide, [data-slide]').forEach((el) => {
              const r = el.getBoundingClientRect();
              out.push({ x: r.x, y: r.y, w: r.width, h: r.height });
            });
            return out;
          })()
        `)) as Array<{ x: number; y: number; w: number; h: number }>
        if (!rects.length) {
          // Fallback: capture whole page as one slide.
          const img = await wc.capturePage()
          return [{ buf: img.toPNG(), w: img.getSize().width, h: img.getSize().height }]
        }
        const out: Array<{ buf: Buffer; w: number; h: number }> = []
        for (const r of rects) {
          // Scroll the slide to the top of the viewport so capturePage gets it
          await wc.executeJavaScript(`window.scrollTo(${r.x}, ${r.y})`)
          await new Promise((res) => setTimeout(res, 80))
          const img = await wc.capturePage({
            x: 0, y: 0,
            width: Math.round(r.w),
            height: Math.round(r.h)
          })
          out.push({ buf: img.toPNG(), w: img.getSize().width, h: img.getSize().height })
        }
        return out
      })

      for (const slide of slides) {
        const s = pres.addSlide()
        const dataUrl = `data:image/png;base64,${slide.buf.toString('base64')}`
        s.addImage({ data: dataUrl, x: 0, y: 0, w: '100%', h: '100%' })
      }
      // pptxgen writeFile returns the actual saved name.
      await pres.writeFile({ fileName: out })
      return { ok: true, path: out }
    }

    return { ok: false, error: `Unsupported format: ${format}` }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

function viewportForKind(kind: string | undefined): { width: number; height: number } {
  switch (kind) {
    case 'social-post':   return { width: 1080, height: 1080 }
    case 'social-story':  return { width: 1080, height: 1920 }
    case 'cover-image':   return { width: 1500, height: 500 }
    case 'ad-banner':     return { width: 728,  height: 90 }
    case 'business-card': return { width: 1050, height: 600 }
    case 'poster':        return { width: 1240, height: 1754 }
    case 'flyer':         return { width: 740,  height: 1050 }
    case 'invitation':    return { width: 1500, height: 2100 }
    case 'certificate':   return { width: 1754, height: 1240 }
    case 'pitch-deck':
    case 'sales-deck':
    case 'talk-slides':
    case 'workshop-deck': return { width: 1280, height: 720 }
    case 'chart':         return { width: 800,  height: 500 }
    case 'a4-portrait':
    case 'resume':
    case 'one-pager':
    case 'report':        return { width: 794,  height: 1123 }
    case 'brochure':      return { width: 2232, height: 1050 }
    case 'email':         return { width: 600,  height: 1400 }
    case 'infographic':   return { width: 800,  height: 2400 }
    default:              return { width: 1280, height: 1600 }
  }
}

function pdfPageForKind(kind: string | undefined): 'A3' | 'A4' | 'A5' | { width: number; height: number } {
  switch (kind) {
    case 'poster':       return 'A3'
    case 'flyer':        return 'A5'
    case 'resume':
    case 'one-pager':
    case 'report':       return 'A4'
    case 'certificate':  return 'A4'
    case 'business-card':return { width: 1050, height: 600 }
    case 'invitation':   return { width: 1500, height: 2100 }
    case 'social-post':  return { width: 1080, height: 1080 }
    case 'social-story': return { width: 1080, height: 1920 }
    default:             return 'A4'
  }
}

function pdfLandscapeForKind(kind: string | undefined): boolean {
  return kind === 'certificate' || kind === 'pitch-deck' || kind === 'sales-deck' ||
         kind === 'talk-slides' || kind === 'workshop-deck' || kind === 'cover-image' ||
         kind === 'ad-banner' || kind === 'brochure'
}

// What formats does each kind sensibly export to?
//
// Rule of thumb:
//   - Interactive web (app screen, dashboard, login, landing, hero,
//     component) → HTML (live) + PNG (screenshot). PDF dumps of an app
//     are garbage — buttons aren't clickable, scroll regions are
//     cropped, and viewport widths are guessed. Same for emails.
//   - Print-oriented work (resume, report, poster, flyer, etc.) → PDF
//     is the primary deliverable.
//   - Decks → PowerPoint + PDF + PNG.
//   - Social / banners → PNG (the only thing platforms accept).
function formatsForKind(kind: string | undefined): ExportFormat[] {
  switch (kind) {
    // Decks
    case 'pitch-deck': case 'sales-deck': case 'talk-slides': case 'workshop-deck':
      return ['pptx', 'pdf', 'png', 'html']

    // Print-first
    case 'poster': case 'flyer': case 'invitation':
    case 'business-card': case 'certificate':
      return ['pdf', 'png', 'html']

    // Social / banners
    case 'social-post': case 'social-story': case 'cover-image': case 'ad-banner':
      return ['png', 'html']

    // Documents (read-only, PDF is the canonical share)
    case 'resume': case 'one-pager': case 'report': case 'brochure':
    case 'case-study': case 'blog-post':
      return ['pdf', 'html']

    // Data visuals
    case 'chart': case 'infographic':
      return ['png', 'pdf', 'html']

    // Interactive web — NO PDF (you can't meaningfully export an app to
    // PDF: scroll, tooltips, hover, dark-mode toggle, modal states all
    // collapse to one frozen frame). PNG screenshot is fine though.
    case 'landing': case 'app-screen': case 'dashboard': case 'pricing':
    case 'login': case 'hero': case 'component':
      return ['html', 'png']

    // Email — HTML only (PDF preview misleads; PNG of a marketing
    // email is useless because clients render their own HTML).
    case 'email':
      return ['html']

    // Design artefacts (system / library / wireframe / mood-board /
    // style-tile / user-flow / sitemap) — HTML viewer + PNG snapshot.
    case 'design-system': case 'component-library': case 'wireframe':
    case 'mood-board': case 'style-tile': case 'user-flow': case 'sitemap':
      return ['html', 'png']

    // Anything else (blank canvas, unknown). Be conservative: HTML
    // always works; offer PNG as a snapshot but skip PDF so we don't
    // suggest a deliverable that won't look right.
    default:
      return ['html', 'png']
  }
}

// Can this design be meaningfully recreated in Figma? Almost everything
// visual can, but for HTML-email kinds the result is just a stack of
// boxes — Figma adds no value and the icons / images won't translate.
// Returning false hides the Figma button for those kinds.
function canExportToFigma(kind: string | undefined): boolean {
  if (!kind) return true
  if (kind === 'email') return false
  return true
}

// ─── IPC ──────────────────────────────────────────────────────────────────

export function registerDesignIpc(getWin: () => BrowserWindow | null): void {
  ipcMain.handle('designs:list', () => listDesigns())
  ipcMain.handle('designs:get', (_e, id: string) => getDesign(id))
  ipcMain.handle('designs:create', async (_e, opts?: { title?: string; brief?: DesignBrief | null }) => createDesign(opts))
  ipcMain.handle('designs:createStarterVersion', async (_e, args: { designId: string; userText?: string | null }) => {
    try {
      const latest = await createStarterTemplateVersion(args.designId, args.userText ?? '')
      const versions = listVersions(args.designId)
      if (latest) getWin()?.webContents.send('design:version', { designId: args.designId, latest, versions })
      return { ok: !!latest, latest, versions }
    } catch (e) {
      return { ok: false, error: String((e as Error).message || e), latest: null, versions: [] }
    }
  })
  ipcMain.handle('designs:rename', (_e, args: { id: string; title: string }) => renameDesign(args.id, args.title))
  ipcMain.handle('designs:delete', async (_e, id: string) => deleteDesign(id))

  ipcMain.handle('designs:importFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || !result.filePaths[0]) return { ok: false, error: 'Cancelled' }
    try {
      const design = await importDesignFromFolder(result.filePaths[0])
      return { ok: true, design }
    } catch (e) {
      return { ok: false, error: String((e as Error).message || e) }
    }
  })

  ipcMain.handle('designs:importGit', async (_e, args: { url: string; title?: string }) => {
    try {
      const design = await importDesignFromGit(args.url, args.title)
      return { ok: true, design }
    } catch (e) {
      return { ok: false, error: String((e as Error).message || e) }
    }
  })

  ipcMain.handle('designs:send', (_e, args: { designId: string; text: string; model?: string | null; agentMode?: 'interactive' | 'plan' | 'autopilot'; displayText?: string | null }) => {
    maybeAutoTitle(args.designId, args.displayText ?? args.text)
    return send(getWin(), args.designId, args.text, {
      model: args.model ?? null,
      agentMode: args.agentMode ?? 'interactive',
      displayText: args.displayText ?? null
    })
  })
  type SendToFigmaArgs = { designId: string; mode?: 'newFile' | 'existingFile'; fileUrl?: string | null; pageName?: string | null }
  type FigmaFromScratchArgs = { designId: string; description: string; mode?: 'newFile' | 'existingFile'; fileUrl?: string | null }

  function extractFigmaKey(input: string): string | null {
    if (!input) return null
    const m = input.match(/figma\.com\/(?:design|file|board|proto)\/([A-Za-z0-9]{8,40})/i)
    return m?.[1] ?? null
  }

  ipcMain.handle('designs:sendToFigma', (_e, args: SendToFigmaArgs) => runSendToFigma(args))
  ipcMain.handle('designs:figmaFromScratch', (_e, args: FigmaFromScratchArgs) => runFigmaFromScratch(args))

  // Returns the full assembled prompt that WOULD be sent to the model for a
  // brief. Used by the wizard's "View prompt" button so the user can see
  // exactly what the LLM will receive (including the STYLE CONTRACT, brand
  // colors, BRIEF bullets, and their idea/notes) before they hit Create.
  ipcMain.handle('designs:previewPrompt', (_e, args: { brief: DesignBrief | null }): { prompt: string } => {
    const brief = args?.brief ?? null
    const versionFileName = brief?.target === 'figma' ? '(figma)' : 'v001.html'
    const ideaPart = brief?.idea ? `\n\n${brief.idea}` : ''
    const userMsg = brief?.target === 'figma'
      ? `Build this in Figma based on the brief.${ideaPart}`
      : `Create v001 based on this brief.${ideaPart}`
    if (brief?.target === 'figma') {
      return { prompt: userMsg + (brief ? `\n\nBrief summary:\n${summariseBriefForPrompt(brief).map((b) => `- ${b}`).join('\n')}` : '') }
    }
    const prefix = buildPrefix(versionFileName, brief, null, null)
    return { prompt: prefix ? `${prefix}\n\n${userMsg}` : userMsg }
  })

  function runSendToFigma(args: SendToFigmaArgs): { ok: boolean; error?: string } | Promise<{ ok: true } | { ok: false; error: string }> {
    const d = getDesign(args.designId)
    if (!d) return { ok: false, error: 'Design not found.' }
    const versions = listVersions(args.designId)
    const latest = versions[versions.length - 1]
    if (!latest) return { ok: false, error: 'Generate at least one version first.' }
    let mode = args.mode ?? 'newFile'
    const kind = d.brief?.kind ?? ''
    const isDeck = ['pitch-deck','sales-deck','talk-slides','workshop-deck'].includes(kind)
    const briefBits: string[] = []
    if (d.brief?.kindLabel) briefBits.push(`Kind: ${d.brief.kindLabel}`)
    if (d.brief?.paletteColors?.length) briefBits.push(`Palette: ${d.brief.paletteColors.join(', ')}`)
    if (d.brief?.fontHeading) briefBits.push(`Heading font: ${d.brief.fontHeading}`)
    if (d.brief?.fontBody) briefBits.push(`Body font: ${d.brief.fontBody}`)

    // Extract a fileKey from any Figma URL the user pasted. Figma URLs
    // come in the forms:
    //   https://www.figma.com/design/{key}/{name}
    //   https://www.figma.com/file/{key}/{name}
    //   https://www.figma.com/board/{key}/{name}    (FigJam)
    //   https://www.figma.com/proto/{key}/{name}
    let fileUrl = (args.fileUrl ?? '').trim()
    let fileKey = extractFigmaKey(fileUrl)

    // Default Figma file: when no explicit fileUrl was passed AND the user
    // has a default file set in Settings, fork into that file instead of
    // creating a fresh one. This avoids the unclaimed-file empty result and
    // lets the agent reuse components from the file's design system.
    if (!fileKey && mode === 'newFile') {
      const defaultRef = (getSettings().defaultFigmaFile ?? '').trim()
      if (defaultRef) {
        fileKey = extractFigmaKey(defaultRef) ?? (/^[A-Za-z0-9]{8,40}$/.test(defaultRef) ? defaultRef : null)
        if (fileKey) {
          mode = 'existingFile'
          fileUrl = defaultRef.startsWith('http') ? defaultRef : `https://www.figma.com/design/${fileKey}/`
        }
      }
    }

    if (mode === 'existingFile' && !fileKey) {
      return { ok: false, error: 'Could not extract a Figma file key from that URL. Expected something like https://www.figma.com/design/ABC123…/MyFile' }
    }

    // Two Figma MCP servers are available. The agent picks the best path:
    //   1. `figma` — the official Anthropic + Figma MCP (same backend Claude
    //      Code's official Figma plugin uses). No separate Figma plugin
    //      install needed; uses your Figma account auth.
    //   2. `figma-write` — your custom MCP that runs against the "MCP
    //      WebSocket Client" plugin in Figma Desktop. Higher fidelity for
    //      icons + tokens but requires the plugin to be open.
    const lines: string[] = []
    lines.push(`You are exporting an HTML design (./${latest.fileName}) into Figma. You have TWO MCP servers available — use the best one for the job:`)
    lines.push(`  - figma-* (official): figma-whoami, figma-create_new_file, figma-use_figma (Plugin API runner), figma-search_design_system, figma-get_screenshot, figma-get_metadata. Same backend Claude Code's official Figma plugin uses.`)
    lines.push(`  - figma-write-* (custom): figma-write-figma_plugin_status, figma-write-figma_svg, figma-write-figma_pages, figma-write-figma_nodes, figma-write-figma_auto_layout, figma-write-figma_text, figma-write-figma_fills, figma-write-figma_strokes, figma-write-figma_effects, figma-write-figma_fonts, figma-write-figma_get_design_state. Requires the "MCP WebSocket Client" plugin running in Figma Desktop.`)
    lines.push('')

    lines.push(`PRECHECK — Pick the path.`)
    lines.push(`  Call figma-write-figma_plugin_status with a 5s timeout.`)
    lines.push(`  - If it responds → use the figma-write-* path (higher fidelity, real SVG icons).`)
    lines.push(`  - If it does NOT respond → fall back to the official figma-* path. Do NOT bother the user — both paths can produce the design.`)
    lines.push('')

    lines.push(`PASS 0 — Read the source.`)
    lines.push(`  Open ./${latest.fileName}. Note layout, palette (hex), heading + body fonts, icon library, image sources, per-section copy.`)
    lines.push(`  If using figma-write: call figma-write-figma_get_design_state to read any __design_tokens__ and __ai_rules__ nodes. If tokens exist, USE THEM (override your own choices).`)
    lines.push('')

    lines.push(`PASS 1 — Set up the file or page.`)
    lines.push(`  figma-write path: figma-write-figma_pages create + name "${d.title}", then activate.`)
    lines.push(`  official path: figma-whoami → get planKey → figma-create_new_file with planKey, editorType "design", fileName "${d.title}". Capture fileKey.`)
    lines.push('')

    lines.push(`PASS 2 — Build the scaffold (auto-layout frames per major section).`)
    lines.push(`  figma-write path: figma-write-figma_nodes (or figma-write-figma_build_page) for one top-level auto-layout frame named "${d.title}" sized to the HTML viewport (1280 wide for app/dashboard, 600 for email). Inside, one auto-layout frame per HTML section. Use figma-write-figma_auto_layout for layoutMode + itemSpacing + padding. Sizing HUG or FILL, never FIXED (except top frame width). clipsContent = false.`)
    lines.push(`  official path: one figma-use_figma call with a Plugin API script that creates the same scaffold via figma.createFrame() + layoutMode/itemSpacing/padding + layoutSizingHorizontal/Vertical = "HUG" or "FILL" + clipsContent = false.`)
    lines.push('')

    lines.push(`PASS 3 — Fonts and text.`)
    lines.push(`  figma-write path: figma-write-figma_fonts to load every font BEFORE creating text. figma-write-figma_text to add headings + body. layoutSizingHorizontal = HUG inside auto-layout parents.`)
    lines.push(`  official path: in your Plugin API script, await figma.loadFontAsync({ family, style }) BEFORE setting characters. Use "Semi Bold" / "Extra Bold" (with the space) for Inter.`)
    lines.push('')

    lines.push(`PASS 4 — Fills, strokes, effects.`)
    lines.push(`  figma-write: figma-write-figma_fills (solid hex from HTML), figma-write-figma_strokes, figma-write-figma_effects (subtle shadows; respect noHeavyShadow).`)
    lines.push(`  official: set fills/strokes/effects directly on nodes inside the same Plugin API script.`)
    lines.push('')

    lines.push(`PASS 5 — Icons (THIS is what makes icons look right).`)
    lines.push(`  Inspect the HTML for icon classes (Phosphor / Tabler / Lucide / Remix / Material Symbols) and inline SVGs. For each:`)
    lines.push(`    - Fetch the SVG markup from the right CDN:`)
    lines.push(`        Phosphor regular: https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/<name>.svg`)
    lines.push(`        Phosphor fill:    https://unpkg.com/@phosphor-icons/core@2.1.1/assets/fill/<name>-fill.svg`)
    lines.push(`        Tabler outline:   https://unpkg.com/@tabler/icons/icons/outline/<name>.svg`)
    lines.push(`        Lucide:           https://unpkg.com/lucide-static@latest/icons/<name>.svg`)
    lines.push(`        Remix:            https://unpkg.com/remixicon@4/icons/System/<name>-line.svg`)
    lines.push(`    - Replace currentColor with the icon's CSS hex BEFORE inserting.`)
    lines.push(`  figma-write path: pass to figma-write-figma_svg with operation "import" + parent + position + size.`)
    lines.push(`  official path: in figma-use_figma, call figma.createNodeFromSvg(svgString); set name "Icon - <name>"; resize; appendChild.`)
    lines.push(`  Real editable vector icons. Do NOT skip and do NOT substitute basic shapes. If a fetch fails, same-sized rectangle in the icon's colour as last resort.`)
    lines.push('')

    lines.push(`PASS 6 — Charts and graphics (REQUIRED if the HTML has any).`)
    lines.push(`  Bar charts → rectangles in an auto-layout row, heights matching source values.`)
    lines.push(`  Line / area → figma-write-figma_vectors (or figma.createVector in official) with the SVG path data already in the HTML.`)
    lines.push(`  Donut / pie → ellipses with arcData per segment.`)
    lines.push(`  Progress bars + status badges → primitive frames with tinted fills.`)
    lines.push(`  Do NOT replace a chart with a single grey rectangle.`)
    lines.push('')

    lines.push(`PASS 7 — Images.`)
    lines.push(`  figma-write: figma-write-figma_images to download + apply as image fill.`)
    lines.push(`  official: figma.createImageAsync(url) → use the imageHash. On fetch failure, same-sized rectangle in the brand secondary colour.`)
    lines.push('')

    lines.push(`PASS 8 — Final check.`)
    lines.push(`  figma-write: figma-write-figma_get_design_state on the new page.`)
    lines.push(`  official: figma-get_screenshot on the top frame.`)
    lines.push(`  Confirm: top frame exists, all sections present, icons rendered (not blanks). If anything wrong, fix and re-check.`)
    lines.push('')

    lines.push(`Anti-patterns to avoid:`)
    lines.push(`  - Do NOT use FIXED sizing on auto-layout frames. Use HUG / FILL.`)
    lines.push(`  - Do NOT skip font loading.`)
    lines.push(`  - Do NOT leave icons as text or basic shapes — always go through figma-write-figma_svg or figma.createNodeFromSvg.`)
    lines.push(`  - Do NOT use em-dashes (U+2014) or en-dashes (U+2013) in any layer/text. Use ASCII "-" or " · ".`)
    lines.push(`  - Respect every __ai_rules__ value if the figma-write path returned any.`)
    lines.push(`  - Do NOT pretend the build succeeded. If a step fails, report it.`)
    if (isDeck) lines.push(`  - Deck: render each <section class="slide"> as its own 1920x1080 frame, laid out left-to-right.`)
    lines.push('')

    lines.push(`Reply with: (1) confirmation that the build is in Figma, (2) one short line per pass describing what was built, (3) anything that fell back to a placeholder. Do NOT save any local HTML files.`)
    void briefBits
    void mode
    void fileKey

    const displayText = mode === 'existingFile' && fileKey
      ? `Exporting "${d.title}" → Figma (existing file)`
      : `Exporting "${d.title}" → Figma (new file)`

    return send(getWin(), args.designId, lines.join('\n'), { model: null, skipPrefix: true, useFigma: true, freshSession: true, displayText })
  } // end runSendToFigma

  // Build directly in Figma: no HTML version is generated. The user's
  // description is sent to Copilot with a Figma-only prompt.
  function runFigmaFromScratch(args: FigmaFromScratchArgs): { ok: boolean; error?: string } | Promise<{ ok: true } | { ok: false; error: string }> {
    const d = getDesign(args.designId)
    if (!d) return { ok: false, error: 'Design not found.' }
    const description = (args.description ?? '').trim()
    if (!description) return { ok: false, error: 'Describe what to build first.' }
    let mode = args.mode ?? 'newFile'
    let fileUrl = (args.fileUrl ?? '').trim()
    let fileKey = extractFigmaKey(fileUrl)

    if (!fileKey && mode === 'newFile') {
      const defaultRef = (getSettings().defaultFigmaFile ?? '').trim()
      if (defaultRef) {
        fileKey = extractFigmaKey(defaultRef) ?? (/^[A-Za-z0-9]{8,40}$/.test(defaultRef) ? defaultRef : null)
        if (fileKey) {
          mode = 'existingFile'
          fileUrl = defaultRef.startsWith('http') ? defaultRef : `https://www.figma.com/design/${fileKey}/`
        }
      }
    }

    if (mode === 'existingFile' && !fileKey) {
      return { ok: false, error: 'Could not extract a Figma file key from that URL.' }
    }
    maybeAutoTitle(args.designId, description)

    const lines: string[] = []
    lines.push(`Build a Figma design from this description using the figma-write MCP server (the one that built the original Terminal42 mockups). Tools are prefixed figma-write-.`)
    lines.push(`Description: ${description}`, '')

    lines.push(`PRECHECK — Connection.`)
    lines.push(`  Call figma-write-figma_plugin_status. If it does NOT respond within a few seconds, STOP and reply: "The Figma plugin isn't connected. Open Figma Desktop, run the 'MCP WebSocket Client' plugin from Plugins → Development, then ask me to retry." Do not call any other tools in that case.`)
    lines.push('')

    lines.push(`PASS 0 — Read tokens.`)
    lines.push(`  Call figma-write-figma_get_design_state to read any __design_tokens__ and __ai_rules__ nodes already in the file. If tokens exist, USE THEM (override your own colour / type / radius / shadow choices).`)
    lines.push('')

    lines.push(`PASS 1 — Set up the page.`)
    lines.push(`  Call figma-write-figma_pages with operation create + name "${d.title}", then activate it.`)
    lines.push('')

    lines.push(`PASS 2 — Pick the visual language.`)
    lines.push(`  If the file has __design_tokens__, use those. Otherwise pick concrete brand colours, typography, spacing and radius that fit the description. Solid fills only, exact hex.`)
    lines.push('')

    lines.push(`PASS 3 — Build the scaffold (auto-layout frames per major section).`)
    lines.push(`  Use figma-write-figma_nodes (or figma-write-figma_build_page) to create one top-level auto-layout frame named "${d.title}" sized to the right viewport (1280 wide for app/dashboard, 600 for email, 1200x800 for landing).`)
    lines.push(`  Inside it, one auto-layout frame per major section.`)
    lines.push(`  Use figma-write-figma_auto_layout for layoutMode + itemSpacing + padding. Sizing must be HUG or FILL, never FIXED (except top frame width).`)
    lines.push('')

    lines.push(`PASS 4 — Fonts and text.`)
    lines.push(`  Call figma-write-figma_fonts to load every font BEFORE creating text. For Inter use "Semi Bold" / "Extra Bold" (with the space).`)
    lines.push(`  Use figma-write-figma_text. Set layoutSizingHorizontal = HUG inside auto-layout parents.`)
    lines.push('')

    lines.push(`PASS 5 — Fills, strokes, effects.`)
    lines.push(`  figma-write-figma_fills, figma-write-figma_strokes, figma-write-figma_effects. Subtle shadows by default; respect noHeavyShadow if set.`)
    lines.push('')

    lines.push(`PASS 6 — Icons via figma-write-figma_svg (THIS makes icons look right).`)
    lines.push(`  For each icon needed, fetch SVG markup from a CDN and pass to figma-write-figma_svg with operation "import":`)
    lines.push(`    - Phosphor: https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/<name>.svg`)
    lines.push(`    - Tabler:   https://unpkg.com/@tabler/icons/icons/outline/<name>.svg`)
    lines.push(`    - Lucide:   https://unpkg.com/lucide-static@latest/icons/<name>.svg`)
    lines.push(`  Replace currentColor with the icon's hex BEFORE calling figma-write-figma_svg. Do NOT substitute basic shapes.`)
    lines.push('')

    lines.push(`PASS 7 — Final check.`)
    lines.push(`  figma-write-figma_get_design_state to confirm: top frame, all sections, real icons (not blanks). Fix anything wrong.`)
    lines.push('')

    lines.push(`Anti-patterns to avoid:`)
    lines.push(`  - Do NOT use FIXED sizing on auto-layout frames. Use HUG / FILL.`)
    lines.push(`  - Do NOT skip font loading.`)
    lines.push(`  - Do NOT leave icons as text or basic shapes — always go through figma-write-figma_svg.`)
    lines.push(`  - Do NOT use em-dashes (U+2014) or en-dashes (U+2013). Use ASCII "-" or " · ".`)
    lines.push(`  - Respect every __ai_rules__ value (no fake testimonials, no eyebrow pills, no emoji icons unless asked).`)
    lines.push(`  - Do NOT pretend the build succeeded. If a step fails, report it.`)
    lines.push('')

    lines.push(`Reply with: (1) confirmation that the build is in Figma, (2) one short line per pass describing what was built, (3) anything that fell back to a placeholder. Do NOT save any local HTML files.`)
    void mode
    void fileKey

    const displayText = mode === 'existingFile' && fileKey
      ? `Building "${d.title}" in Figma (existing file)`
      : `Building "${d.title}" in Figma (new file)`

    return send(getWin(), args.designId, lines.join('\n'), { model: null, skipPrefix: true, useFigma: true, freshSession: true, displayText })
  } // end runFigmaFromScratch

  ipcMain.handle('designs:cancel', (_e, designId: string) => ({ ok: cancel(designId) }))
  ipcMain.handle('designs:isBusy', (_e, designId: string) => running.has(designId))
  ipcMain.handle('designs:history', (_e, designId: string) => loadHistory(designId))

  ipcMain.handle('designs:listVersions', (_e, designId: string) => listVersions(designId))
  ipcMain.handle('designs:readVersion', async (_e, designId: string, fileName: string) => {
    const versions = listVersions(designId)
    const v = versions.find((x) => x.fileName === fileName) ?? null
    if (!v) return { ok: false as const, error: 'Not found' }
    try {
      const content = await fs.readFile(v.filePath, 'utf8')
      // Inject a <base> tag so relative <img src="…"> / <link href="…">
      // references resolve against the design's directory (file://) when
      // we render the document via srcDoc. Without this, browsers resolve
      // relative URLs against about:srcdoc and every local image breaks.
      const d = getDesign(designId)
      const baseHref = d ? pathToFileURL(d.cwd + '/').toString() : ''
      const baseTag = baseHref ? `<base href="${baseHref}">` : ''
      const withBase = baseTag
        ? (/<head[^>]*>/i.test(content)
            ? content.replace(/<head([^>]*)>/i, (_m, attrs) => `<head${attrs}>${baseTag}`)
            : baseTag + content)
        : content
      return { ok: true as const, content: withBase }
    } catch (err) {
      return { ok: false as const, error: String(err) }
    }
  })
  ipcMain.handle('designs:watch', async (_e, designId: string) => {
    watchDesign(getWin, designId)
    return { ok: true }
  })
  ipcMain.handle('designs:unwatch', (_e, designId: string) => { unwatch(designId); return { ok: true } })
  ipcMain.handle('designs:revealLatest', (_e, designId: string) => {
    const versions = listVersions(designId)
    const latest = versions[versions.length - 1]
    if (!latest) return { ok: false }
    try { shell.showItemInFolder(latest.filePath); return { ok: true } } catch { return { ok: false } }
  })
  ipcMain.handle('designs:openExternal', async (_e, fileUrl: string) => {
    if (typeof fileUrl !== 'string') return { ok: false }
    // Confine to the schemes this handler is actually called with (design
    // file:// URLs and http(s) Figma links). The renderer renders untrusted
    // srcDoc design HTML with webSecurity disabled, so reject any other scheme
    // (javascript:, custom protocol handlers, smb:, etc.).
    if (!/^(https?|file):/i.test(fileUrl)) return { ok: false }
    try { await shell.openExternal(fileUrl); return { ok: true } } catch { return { ok: false } }
  })

  // Export the latest version. Format must be one of: html | pdf | png | pptx.
  ipcMain.handle('designs:export', async (_e, args: { designId: string; format: ExportFormat }) =>
    exportLatest(args.designId, args.format))

  // Which formats does this design's kind support?
  ipcMain.handle('designs:formats', (_e, designId: string) => {
    const d = getDesign(designId)
    return formatsForKind(d?.brief?.kind)
  })

  // Can this design's kind meaningfully be pushed into Figma? Renderer
  // uses this to hide the Figma button for kinds where it would just
  // produce noise (e.g. HTML email).
  ipcMain.handle('designs:canFigma', (_e, designId: string) => {
    const d = getDesign(designId)
    return canExportToFigma(d?.brief?.kind)
  })

  // Upload a template file (pptx / pdf / png / docx / html / etc.) into a
  // design's cwd. Saved as `template.<ext>` so the model can find it
  // predictably. Returns the basename it was saved as.
  ipcMain.handle('designs:uploadTemplate', async (_e, args: { designId: string; name: string; bytes: ArrayBuffer | Uint8Array }) => {
    const d = getDesign(args.designId)
    if (!d) return { ok: false as const, error: 'Design not found.' }
    const ext = (args.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const filename = `template.${ext}`
    try {
      await fs.mkdir(d.cwd, { recursive: true })
      const buf = Buffer.from(args.bytes as ArrayBuffer)
      await fs.writeFile(join(d.cwd, filename), buf)
      // Record on the design row so the prompt picks it up next turn. If
      // the design has no brief yet (e.g. blank canvas), bootstrap a
      // minimal one so templateFile is still honoured.
      const brief = d.brief
        ? { ...d.brief, templateFile: filename }
        : { v: 1 as const, kind: 'blank' as DesignKind, kindLabel: 'Blank canvas',
            group: 'other' as DesignGroup, fidelity: 'highfidelity' as const,
            templateFile: filename, createdAt: Date.now() }
      getDb().prepare('UPDATE designs SET brief = ?, last_active_at = ? WHERE id = ?')
        .run(JSON.stringify(brief), Date.now(), args.designId)
      return { ok: true as const, filename }
    } catch (err) {
      return { ok: false as const, error: String(err) }
    }
  })

  // Upload a reference image (PNG / JPG / WebP / GIF / SVG / AVIF) into the
  // design's `_refs/` folder. Returns the basename it was saved as. Names
  // are sanitised + suffixed with a short id to avoid collisions across
  // multiple drops. Updates the design row's brief.inspirationImages so
  // every future send() call picks them up automatically.
  ipcMain.handle('designs:uploadInspiration', async (_e, args: { designId: string; name: string; bytes: ArrayBuffer | Uint8Array }) => {
    const d = getDesign(args.designId)
    if (!d) return { ok: false as const, error: 'Design not found.' }
    const dot = args.name.lastIndexOf('.')
    const rawExt = dot >= 0 ? args.name.slice(dot + 1) : ''
    const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'png'
    const stem = (dot >= 0 ? args.name.slice(0, dot) : args.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'ref'
    const id = Math.random().toString(36).slice(2, 8)
    const filename = `${stem}-${id}.${ext}`
    try {
      const refsDir = join(d.cwd, '_refs')
      await fs.mkdir(refsDir, { recursive: true })
      const buf = Buffer.from(args.bytes as ArrayBuffer)
      await fs.writeFile(join(refsDir, filename), buf)
      // Append to the brief's inspirationImages list so every future prompt
      // picks the file up. Bootstrap a minimal brief if needed.
      const existing: string[] = Array.isArray(d.brief?.inspirationImages) ? (d.brief!.inspirationImages as string[]) : []
      const next = [...existing, filename]
      const brief = d.brief
        ? { ...d.brief, inspirationImages: next }
        : { v: 1 as const, kind: 'blank' as DesignKind, kindLabel: 'Blank canvas',
            group: 'other' as DesignGroup, fidelity: 'highfidelity' as const,
            inspirationImages: next, createdAt: Date.now() }
      getDb().prepare('UPDATE designs SET brief = ?, last_active_at = ? WHERE id = ?')
        .run(JSON.stringify(brief), Date.now(), args.designId)
      return { ok: true as const, filename }
    } catch (err) {
      return { ok: false as const, error: String(err) }
    }
  })

  ipcMain.handle('designs:removeAttachment', async (_e, args: { designId: string; filename: string }) => {
    const d = getDesign(args.designId)
    if (!d) return { ok: false as const, error: 'Design not found.' }
    const safe = args.filename.replace(/[^a-zA-Z0-9._-]/g, '')
    if (!safe) return { ok: false as const, error: 'Invalid file.' }
    try {
      let brief = d.brief
      if (brief?.templateFile === safe) {
        try { await fs.unlink(join(d.cwd, safe)) } catch {}
        brief = { ...brief, templateFile: null }
      } else {
        try { await fs.unlink(join(d.cwd, '_refs', safe)) } catch {}
        const refs = Array.isArray(brief?.inspirationImages) ? brief!.inspirationImages!.filter((f) => f !== safe) : []
        brief = brief
          ? { ...brief, inspirationImages: refs }
          : { v: 1 as const, kind: 'blank' as DesignKind, kindLabel: 'Blank canvas',
              group: 'other' as DesignGroup, fidelity: 'highfidelity' as const,
              inspirationImages: refs, createdAt: Date.now() }
      }
      getDb().prepare('UPDATE designs SET brief = ?, last_active_at = ? WHERE id = ?')
        .run(JSON.stringify(brief), Date.now(), args.designId)
      return { ok: true as const }
    } catch (err) {
      return { ok: false as const, error: String(err) }
    }
  })

  // Returns a base64 data URL for a reference image so the renderer can
  // show a thumbnail without a privileged file:// fetch.
  ipcMain.handle('designs:inspirationDataUrl', async (_e, args: { designId: string; filename: string }): Promise<string | null> => {
    const d = getDesign(args.designId)
    if (!d) return null
    const safe = args.filename.replace(/[^a-zA-Z0-9._-]/g, '')
    if (!safe) return null
    try {
      const buf = await fs.readFile(join(d.cwd, '_refs', safe))
      const ext = safe.split('.').pop()?.toLowerCase() ?? 'png'
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                 : ext === 'webp' ? 'image/webp'
                 : ext === 'gif'  ? 'image/gif'
                 : ext === 'svg'  ? 'image/svg+xml'
                 : ext === 'avif' ? 'image/avif'
                 : 'image/png'
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch { return null }
  })
}
