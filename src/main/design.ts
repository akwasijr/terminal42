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
    const css = `\n<style id="t42-template-fallback-theme">\n:root {\n  ${b.primaryColor ? `--t42-primary: ${b.primaryColor};` : ''}\n  ${b.secondaryColor ? `--t42-secondary: ${b.secondaryColor};` : ''}\n  ${b.accentColor ? `--t42-accent: ${b.accentColor};` : ''}\n}\n${opts.addWatermark ? `body::before {\n  content: \"${escapeCssString((b.idea || userText || '').slice(0, 120))}\";\n  position: fixed;\n  right: 16px;\n  bottom: 16px;\n  z-index: 2147483647;\n  max-width: 360px;\n  padding: 10px 12px;\n  border-radius: 12px;\n  color: #ffffff;\n  background: ${b.primaryColor ?? '#111827'};\n  font: 500 12px/1.4 system-ui, sans-serif;\n  box-shadow: 0 8px 24px rgba(0,0,0,.18);\n  pointer-events: none;\n}` : ''}\n</style>\n`
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

function summariseBrief(b: DesignBrief | null): string {
  if (!b) return ''
  const bits: string[] = []
  bits.push(`Type: ${b.kindLabel}${b.subtype ? ` (${b.subtype})` : ''}`)
  if (b.surface) bits.push(`Surface: ${b.surface}`)
  bits.push(`Fidelity: ${b.fidelity === 'wireframe' ? 'Wireframe (low-fidelity, grayscale, layout-focused, no real imagery)' : 'High fidelity (polished, branded, real imagery)'}`)
  if (b.lookLabel) bits.push(`Look: ${b.lookLabel}`)
  if (b.audience) bits.push(`Audience: ${b.audience}`)
  if (b.paletteLabel && b.paletteColors?.length) {
    bits.push(`Palette: ${b.paletteLabel} (${b.paletteColors.join(', ')})`)
  }
  if (b.primaryColor)   bits.push(`Primary: ${b.primaryColor}`)
  if (b.secondaryColor) bits.push(`Secondary: ${b.secondaryColor}`)
  if (b.accentColor)    bits.push(`Accent: ${b.accentColor}`)
  if (b.fontHeading || b.fontBody) {
    bits.push(`Type: ${b.fontHeading ?? '-'}${b.fontBody && b.fontBody !== b.fontHeading ? ' / ' + b.fontBody : ''}`)
  }
  if (b.theme) {
    const themeShort: Record<string, string> = {
      light: 'light only',
      dark:  'dark only',
      auto:  'auto (follow OS via prefers-color-scheme)',
      both:  'BOTH light + dark with a working manual toggle in the header (data-theme attr + localStorage persist)',
    }
    bits.push(`Theme: ${themeShort[b.theme] ?? b.theme}`)
  }
  if (b.density) bits.push(`Density: ${b.density}`)
  if (b.spacing) bits.push(`Spacing: ${b.spacing}`)
  if (b.grid)    bits.push(`Grid: ${b.grid}`)
  if (b.motion) bits.push(`Motion: ${b.motion}`)
  if (b.customMotion) bits.push(`Motion notes: ${b.customMotion}`)
  if (b.figmaUrl)    bits.push(`Figma: ${b.figmaUrl}`)
  if (b.inspiration) bits.push(`Inspiration: ${b.inspiration}`)
  return bits.join(' · ')
}

// Per-kind format spec: the model needs to know whether to render a
// responsive web page, a stack of 16:9 slides, an A4 poster, a 1080×1080
// social tile, etc. Without this every output became another web page.
function formatSpec(kind: string | undefined): string {
  switch (kind) {
    case 'pitch-deck':
    case 'sales-deck':
    case 'talk-slides':
    case 'workshop-deck':
      return 'Render as a STACK of 8 to 10 16:9 slides. ABSOLUTE MINIMUM: 6 slides: a deck with fewer is wrong, regenerate. Each slide MUST be a direct child of <body> wrapped in <section class="slide">. DO NOT wrap slides in any container. DO NOT set body display, padding, or background: the viewer controls layout. Each .slide is width:100%; height:100%; box-sizing:border-box with its own padding/background/content. Standard pitch-deck order: Cover · Problem · Solution · Product · Market · Traction · Business model · Team · Ask · Closing. Each slide ≤ 8-word headline + ≤ 30 words supporting text. Prefer numbers, single SVG charts, and big keywords over paragraphs. Whitespace and visual hierarchy carry the meaning, not prose.'

    case 'poster':
      return 'Render as a single A3-portrait poster (1240×1754px artboard) centered on a neutral page background. ONE bold headline, optional sub, key date/place, big visual or symbol. ≤ 25 words total of text. Composition first; not a webpage.'
    case 'flyer':
      return 'Render as a single A5 flyer (740×1050px artboard) centered on a neutral background. Headline, 2:4 short bullets, CTA. ≤ 60 words of text total. Single page composition.'
    case 'invitation':
      return 'Render as a single 5×7 inch invitation card (1500×2100px artboard) centered on a neutral background. Decorative, balanced, single composition. Names + date + place + RSVP: that is all. ≤ 30 words.'
    case 'business-card':
      return 'Render as a single 3.5×2 inch business card (1050×600px artboard) centered on a neutral background. Show front and back side-by-side. Front: name + role + brand mark. Back: contact details. ≤ 20 words total.'
    case 'certificate':
      return 'Render as a single A4-landscape certificate centered on a neutral background. Heading "CERTIFICATE OF …" + recipient name + body sentence + signature/seal area + date. ≤ 50 words.'

    case 'social-post':
      return 'Render as a single 1080×1080 square tile centered on a neutral page background. ONE strong headline + optional supporting line + one icon/illustration. ≤ 20 words total.'
    case 'social-story':
      return 'Render as a single 1080×1920 vertical story centered on a neutral page background. Big visual + short headline at top or bottom. ≤ 20 words.'
    case 'cover-image':
      return 'Render as a single 1500×500 cover image centered on a neutral page background. Background imagery/pattern + tagline + brand mark. ≤ 12 words.'
    case 'ad-banner':
      return 'Render as a 728×90 leaderboard banner. Logo + ≤ 8-word value prop + small CTA button. Tight, scannable, minimal.'

    case 'email':
      return 'Render as a 600px-wide email centered on a neutral page wrapper. Inline-style-friendly: avoid flexbox-only layouts, no JS. Header + clear hero + 1:3 short paragraphs + CTA button + plain footer. Email body, not a marketing page.'
    case 'infographic':
      return 'Render as a tall single-column infographic (800px wide, content as long as needed). 4:6 stacked numbered sections, each section: stat or icon + 1-line label. Use SVG charts where relevant. Whitespace + numbers tell the story; avoid paragraphs.'
    case 'report':
      return 'Render as a multi-page A4-portrait annual report: each <section class="page"> is 794×1123px stacked vertically with gaps between. Cover page + 3:5 content pages with consistent margins. Mix of charts, callout numbers and short body paragraphs (no walls of text).'
    case 'chart':
      return 'Render as a single SVG chart (≈800×500px) centered on a neutral background. Title above, optional one-line caption below, axis labels with units. No surrounding marketing chrome.'

    case 'blog-post':
      return 'Render as an article page: single column, max-width 720px, generous reading line-height. Title + author/date meta + 4:8 short paragraphs + at most one pull-quote. Standard responsive web layout.'
    case 'resume':
      return 'Render as a single A4-portrait resume (794×1123px). Header (name + role + contact) + 3:5 sections (Experience / Skills / Education / etc.). Compact, scannable; no marketing copy.'
    case 'one-pager':
      return 'Render as a single A4-portrait one-pager. ONE concept on one page: headline + short summary + 3:5 supporting points + footer. Tight, single composition, not a website.'
    case 'brochure':
      return 'Render as a tri-fold brochure: three 297×210mm panels (each ~744×525px) side-by-side as one wide artboard. Cover panel + inside spread. Each panel has a clear heading + ≤ 60 words.'
    case 'case-study':
      return 'Render as a long-form case study article: single column, max-width 760px. Title + summary block (Client / Role / Year) + 3:4 sections with subheads. Generous spacing. Standard responsive layout.'

    case 'component':
      return 'Render the component(s) on a neutral page background, multiple states/variants laid out in a clean grid (Default / Hover / Active / Disabled etc). No surrounding marketing page chrome. Show the component, not a website around it.'

    // ─── Figma / design-system deliverables ─────────────────────────────
    case 'design-system':
      return 'Render as a single-page DESIGN SYSTEM reference. Sections, in this exact order: (1) Brand colors swatch row with hex labels (primary, secondary, accent, neutrals 50:900 scale). (2) Type scale showing Display / H1 / H2 / H3 / Body / Small with sample text for each. (3) Spacing scale (4 / 8 / 12 / 16 / 24 / 32 / 48 / 64) shown as labelled bars. (4) Radius scale (sm/md/lg/xl/full) shown as labelled tiles. (5) Component samples: Button (primary/secondary/ghost/disabled), Input (default/focus/error), Badge, Card, Modal preview. White or light-neutral background. Reference document, not a marketing page.'
    case 'component-library':
      return 'Render a COMPONENT LIBRARY page. A grid of UI components, each shown with all their states laid out next to each other. Default / Hover / Focus / Active / Disabled / Error where applicable. Section headers above each component family (Buttons, Inputs, Selects, Toggles, Cards, etc). Code-style label under each variant (e.g. "Primary · md · default"). Reference document, not a marketing page.'
    case 'wireframe':
      return 'Render a LOW-FIDELITY WIREFRAME of a screen. STRICT rules: greyscale only (white/grey/black, no brand colors), 1px dashed grey strokes for content blocks, lorem-ipsum text, simple rectangle placeholders for images (with diagonal X), generic icon glyphs as plain squares. NO real imagery, NO finished colors, NO drop shadows, NO polish. The point is structure + hierarchy, not aesthetics.'
    case 'mood-board':
      return 'Render a MOOD BOARD as a 4×3 grid of reference tiles centered on a neutral background. Mix: 6 photographic tiles (Unsplash CDN: pull category-relevant images by query), 3 colour swatch tiles (with hex labels), 2 typography sample tiles ("Aa" + family name + 2-line specimen), 1 texture tile. Each tile rounded-sm with a small caption underneath. NO text-heavy content, NO marketing copy.'
    case 'style-tile':
      return 'Render a single STYLE TILE (~1100×1400px artboard) showing the brand at a glance: large logo/wordmark area, primary/secondary/accent swatch row, type pairing sample (display family + body family with sample sentences), button samples (primary/secondary), texture or pattern swatch, key adjectives row. Single composition; like a brand cover sheet.'
    case 'user-flow':
      return 'Render a USER FLOW DIAGRAM as an SVG canvas. Boxes (rounded rect, 160×80) for screens: labelled with screen name + 1-line description. Diamonds for decisions. Arrows between with action labels (e.g. "Sign up", "Forgot password"). Layout left→right or top→bottom. Single neutral background, no surrounding chrome. Functional diagram, not a webpage.'
    case 'sitemap':
      return 'Render a SITEMAP as an SVG tree. Root node at top, children below connected by lines. Each node a rounded rectangle with the page name + (optional) a small icon and one-line summary. 3:4 levels deep. Single neutral background, no marketing chrome.'

    // Web: websites and landing pages
    case 'website':
      return 'Render as a multi-section WEBSITE on one long page (or several stacked sections separated visually). Include sticky nav, hero, 3-5 content sections (features / social proof / pricing / testimonials / CTA / footer as appropriate). Responsive at 360 / 768 / 1280px. Standard semantic structure (header/main/footer). This is a whole site experience, not a single section.'
    case 'landing':
      return 'Single-page landing page. Hero at top, 2-4 supporting sections, footer. Responsive at 360 / 768 / 1280px. Standard semantic structure. Avoid wall-of-text marketing copy: short headlines, scannable feature blurbs.'

    // App: full product experience on one canvas (not just one screen)
    case 'app':
      return [
        'Render as a full PRODUCT / APP experience.',
        'Include: a sidebar (or top nav) with multiple destinations, AND a primary view area on the right (or below).',
        'CRITICAL — page-by-page navigation, NOT scroll: every nav item is a REAL working page. Clicking a nav item HIDES the current page and SHOWS the new one in the same view area. Only ONE page is visible at a time. Implement with: each section gets `data-page="inbox"` etc., default visible page is hidden via `display:none` for the others, a tiny click handler on `[data-nav]` links sets `display:block` on the matching `[data-page]` and `display:none` on the rest, and adds the active state to the clicked nav item. NO smooth-scrolling between sections. NO IntersectionObserver. NO long single canvas with everything stacked. The user clicks Inbox → only Inbox shows; clicks Reports → Inbox disappears, Reports appears.',
        'Each page must have real content that fits its name: Inbox = a list of messages with sender + preview + time; Reports = a chart and a download row; Settings = grouped rows of toggles/inputs; Team = a member list with roles; etc. Pick 2-3 representative rows / cards / states per page, never lorem ipsum.',
        'Optionally include 1-2 secondary states (modal open, empty state, detail panel) on the default visible page.'
      ].join(' ')
    case 'dashboard':
      return [
        'Render as a real dashboard PRODUCT, not a marketing page.',
        'Sidebar (or top nav), top header (search + user), and a primary view that defaults to the main dashboard (KPI row of 3-4 cards, 1-2 charts, a recent activity table).',
        'CRITICAL — page-by-page navigation, NOT scroll: every sidebar nav item is a REAL page. Clicking a nav item HIDES the current page and SHOWS the new one in the SAME view area. Only ONE page visible at a time. Implement with `data-page="reports"` on each section, `display:none` on inactive pages, and a tiny click handler on `[data-nav]` that swaps visibility + active state. NO smooth-scrolling between sections, NO IntersectionObserver, NO long stacked canvas. Reports nav → only the Reports page is visible.',
        'Each nav destination must be a real page with representative content (chart + table + filter row, etc.). No placeholder pages, no "coming soon".'
      ].join(' ')

    // Deprecated kinds: kept rendering as plain responsive pages for old briefs
    case 'app-screen':
    case 'pricing':
    case 'login':
    case 'hero':
      return 'Responsive web page at 360 / 768 / 1280px. body fills the viewport; layout adapts at common breakpoints. Standard semantic structure (header/main/footer). Avoid wall-of-text marketing copy: short headlines, scannable feature blurbs.'

    default:
      return 'Render appropriately for the kind. If unsure, use a single centered artboard on a neutral page background: not a generic marketing webpage.'
  }
}

type PlanSeedStep = { id: string; title: string }

// Derive the user-facing checklist of binding picks from the brief. Each
// item here is something the user EXPLICITLY chose in the wizard — the
// model must visibly honor it in the output. The plan UI renders these as
// the checklist so the user can see their picks being enforced.
//
// Conflict policy: design-system pick wins over conflicting look /
// density / spacing / grid picks (per user instruction). When a design
// system is set, we drop those secondary steps to avoid contradiction.
function buildEnforcementPlan(brief: DesignBrief | null): PlanSeedStep[] {
  const out: PlanSeedStep[] = []
  if (!brief) {
    out.push({ id: 'build', title: 'Build design' })
    out.push({ id: 'verify', title: 'Self-check' })
    return out
  }

  const hasDs = !!brief.designSystem
  const push = (id: string, title: string): void => {
    if (!out.some((s) => s.id === id)) out.push({ id, title: title.length > 48 ? title.slice(0, 45) + '…' : title })
  }

  // Anchors: kind + design system always show first if present.
  if (brief.kindLabel) push('kind', `Build ${brief.kindLabel.toLowerCase()}`)
  if (hasDs) push('system', `Follow ${brief.designSystemLabel ?? brief.designSystem} system`)

  // Look / density / spacing / grid — suppressed under a design system to
  // avoid contradiction (the system owns these dimensions).
  if (!hasDs) {
    if (brief.lookLabel) push('look', `Match ${brief.lookLabel.toLowerCase()} look`)
    if (brief.density) push('density', `${cap(brief.density)} density`)
  }

  // Palette: include if user picked any brand color or palette.
  if (brief.primaryColor || brief.secondaryColor || brief.accentColor || brief.paletteColors?.length) {
    const bits: string[] = []
    if (brief.primaryColor) bits.push(brief.primaryColor)
    if (brief.accentColor && brief.accentColor !== brief.primaryColor) bits.push(brief.accentColor)
    push('palette', bits.length ? `Apply palette (${bits.join(' / ')})` : 'Apply chosen palette')
  }

  // Typography: heading family is the user-visible anchor.
  if (brief.customFonts) {
    push('fonts', 'Use chosen fonts')
  } else if (brief.fontHeading || brief.fontBody) {
    const heading = brief.fontHeading ?? brief.fontBody ?? ''
    push('fonts', heading ? `Use ${heading} headings` : 'Use chosen fonts')
  }

  // Theme — only call out when user picked dark or both (light is the default).
  if (brief.theme === 'both') push('theme', 'Wire light/dark toggle')
  else if (brief.theme === 'dark') push('theme', 'Dark theme only')
  else if (brief.theme === 'auto') push('theme', 'Auto (OS) theme')

  // Icons.
  if (brief.iconLibraryId === 'none') push('icons', 'No icons')
  else if (brief.iconLibraryLabel) push('icons', `Use ${brief.iconLibraryLabel} icons`)

  // Shape facets — only when non-default and not under a design system.
  if (!hasDs) {
    if (brief.shapeRadius) push('radius', `${cap(brief.shapeRadius)} corners`)
    if (brief.shapeShadow && brief.shapeShadow !== 'subtle') push('shadow', `${cap(brief.shapeShadow)} shadows`)
  }

  // Fidelity — only call out wireframe (it's a visible mode switch).
  if (brief.fidelity === 'wireframe') push('fidelity', 'Wireframe fidelity')

  // AI rules — single condensed line listing the top picks the user enabled.
  const r = brief.aiRules ?? null
  const ruleOn = (id: string): boolean => r == null || r[id] !== false
  const avoidBits: string[] = []
  if (ruleOn('noEmojiIcons')) avoidBits.push('emoji')
  if (ruleOn('noGradients')) avoidBits.push('gradients')
  if (ruleOn('noAllCaps')) avoidBits.push('ALL CAPS')
  if (ruleOn('noBlobs')) avoidBits.push('blobs')
  if (avoidBits.length) push('rules', `Avoid ${avoidBits.slice(0, 3).join(', ')}`)

  // Adjustments — last-mile notes the user typed on the summary page.
  if (brief.planNotes && brief.planNotes.trim()) {
    const short = brief.planNotes.trim().split(/\s+/).slice(0, 4).join(' ')
    push('adjust', `Apply: ${short}…`)
  }

  // Always end with the actual build + self-check steps.
  push('build', 'Write design file')
  push('verify', 'Self-check')

  // Cap at 8 — too many checkboxes is noise. Keep build + verify always.
  if (out.length > 8) {
    const keep = out.filter((s) => s.id === 'build' || s.id === 'verify')
    const others = out.filter((s) => s.id !== 'build' && s.id !== 'verify').slice(0, 8 - keep.length)
    return [...others, ...keep]
  }
  return out
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function planningProtocolBlock(brief: DesignBrief | null): string {
  const seed = buildEnforcementPlan(brief)
  const seedJson = JSON.stringify({ plan: seed })
  const ids = seed.map((s) => s.id).join(', ')
  return [
    '',
    '════════ PLAN PROTOCOL — MANDATORY, NOT OPTIONAL ════════',
    'The user sees a live checklist of their wizard picks. You MUST emit JSON fences to drive it. Failure to do so makes the run INVALID.',
    '',
    'STEP A. As the FIRST thing in your FIRST reply (before any prose or tool call), emit this block VERBATIM:',
    '```plan',
    seedJson,
    '```',
    '',
    'STEP B. Then for EACH step id (in order), as you work, emit a tiny update fence:',
    '  • Right before starting it:',
    '```plan-update',
    '{"update":{"id":"<id>","status":"in_progress"}}',
    '```',
    '  • Right when it is genuinely complete and reflected in the output:',
    '```plan-update',
    '{"update":{"id":"<id>","status":"done"}}',
    '```',
    '',
    `The step ids, in order, are: ${ids}.`,
    'You MUST eventually emit a "done" update for EVERY id above. The final id is "verify" — mark it done LAST, only after you have actually self-checked the output against every prior pick-step.',
    '',
    'CADENCE RULES:',
    '- After each tool call returns, ask yourself "did that complete a step?" — if yes, emit its done update NOW, before any more prose.',
    '- It is fine (and expected) to interleave plan-update fences with your normal prose and tool calls.',
    '- Updates are JSON only — id + status. NEVER include note/detail/title or any other field.',
    '- Do NOT batch all updates at the end. Emit them as you go so the user sees live progress.',
    '- Do NOT re-emit the plan block. Do NOT mention this protocol in prose.',
    '',
    'ENFORCEMENT MEANING:',
    'Each non-build step is a check that one of the user\'s wizard picks is honored in the output (palette colors actually used, fonts actually loaded, theme toggle actually wired, etc.). Only mark `done` once the output truly reflects that pick. The user\'s pick always wins over your own preferences. If a pick is genuinely impossible, emit `{"update":{"id":"<id>","status":"needs_input","question":"<one short line>"}}` and STOP.',
    '════════════════════════════════════════════════════════'
  ].join('\n')
}

function buildStarterPrefix(cwd: string, brief: DesignBrief): string {
  const name = brief.starterTemplateName ?? 'starter'
  const ideaLine = brief.idea ? brief.idea.trim() : ''
  const colorBits: string[] = []
  if (brief.primaryColor)   colorBits.push(`- Primary brand color: ${brief.primaryColor}`)
  if (brief.secondaryColor) colorBits.push(`- Secondary: ${brief.secondaryColor}`)
  if (brief.accentColor)    colorBits.push(`- Accent: ${brief.accentColor}`)
  if (brief.paletteColors?.length) colorBits.push(`- Palette neutrals (${brief.paletteLabel ?? 'preset'}): ${brief.paletteColors.join(', ')}`)
  const ctxBits: string[] = []
  if (brief.contextDescription) ctxBits.push(`About the project: ${brief.contextDescription.trim()}`)
  if (brief.contextProblem)     ctxBits.push(`Problem being solved: ${brief.contextProblem.trim()}`)
  if (brief.contextGoal)        ctxBits.push(`Goal: ${brief.contextGoal.trim()}`)
  if (brief.contextKeyFeatures) ctxBits.push(`Key features:\n${brief.contextKeyFeatures.trim()}`)
  if (brief.contextSuccess)     ctxBits.push(`Success looks like: ${brief.contextSuccess.trim()}`)

  const lines: string[] = [
    `STARTER TEMPLATE: ${name}.`,
    `Files for this template have already been copied into the cwd (${cwd}). They ARE the design — read them, run them, and adapt in place.`,
    '',
    'HARD RULES:',
    '- DO NOT delete, rename, or rebuild the existing files from scratch.',
    '- DO NOT create v001.html or any new top-level page. Edit what is already here.',
    '- PRESERVE the visual structure: layout, component composition, navigation, page hierarchy, animations, fonts.',
    '- Allowed changes: brand color tokens (CSS variables / theme files), copy / strings / labels, sample data, and small content swaps so the screens reflect the user\'s project.',
    '',
    'STEP 1 — Inspect:',
    '- `ls -la` and read package.json to learn the framework + entry points.',
    '- Open the main layout / page / theme files. Identify where colors and copy live (CSS variables, tailwind config, theme provider, content arrays).',
    '',
    'STEP 2 — Adapt to the brief:'
  ]
  if (colorBits.length) {
    lines.push(
      'Recolor to match the brand palette:',
      ...colorBits,
      '- Update the design tokens / CSS variables / tailwind config in one place — do NOT hard-code colors at component sites.'
    )
  } else {
    lines.push('No new palette specified — keep the template\'s existing colors as-is.')
  }
  if (ctxBits.length || ideaLine) {
    lines.push('', 'Rewrite copy + sample content to match this project context:')
    if (ideaLine) lines.push(`- ${ideaLine}`)
    for (const b of ctxBits) lines.push(`- ${b}`)
  }
  lines.push(
    '',
    'STEP 3 — Verify:',
    '- After edits, briefly summarise what files you changed and which colors / copy were swapped.',
    '- DO NOT regenerate or restyle UI components beyond the changes above.'
  )
  lines.push(planningProtocolBlock(brief))
  return lines.join('\n')
}

function buildPrefix(versionFileName: string, brief: DesignBrief | null, previousVersionFileName: string | null = null, pptxFacts: PptxFacts | null = null): string {
  const ideaLine = brief?.idea ? brief.idea.trim() : ''
  const format = formatSpec(brief?.kind)
  const isPptxEdit = !!brief?.templateFile
    && brief.templateFile.toLowerCase().endsWith('.pptx')
    && !!brief.useTemplateLook
    && versionFileName.toLowerCase().endsWith('.pptx')

  const lines: string[] = []

  // ─── PPT EDIT MODE: produce a .pptx by editing the template's XMLs in
  //     place. The template's slide masters / layouts / theme are NEVER
  //     touched, which is why look & feel is guaranteed.
  if (isPptxEdit && brief?.templateFile) {
    const slideMap = pptxFacts
      ? pptxFacts.slides.map((s) =>
          `    slide${s.index}.xml: [${s.layoutName ?? '?'}]${s.title ? ` "${s.title.slice(0, 60)}"` : ''}${s.body ? ` (body: "${s.body.slice(0, 80)}${s.body.length > 80 ? '…' : ''}")` : ''}`
        ).join('\n')
      : ''
    lines.push(
      `PPT EDIT MODE: Output is a .pptx (./${versionFileName}), NOT an HTML file.`,
      '',
      'You are editing the template\'s XMLs in place. The slide masters, layouts, theme and shape geometry are PRESERVED automatically because you never recreate them: you just swap the text inside the existing slide XMLs.',
      '',
      'Required workflow (run as bash steps, do NOT skip any):',
      '',
      `  # 1. Clone the template into a working build dir`,
      `  rm -rf _build && mkdir _build`,
      `  cp ./${brief.templateFile} ./${versionFileName}      # the file we'll re-zip into`,
      `  (cd _build && unzip -o ../${brief.templateFile} > /dev/null)`,
      '',
      `  # 2. Edit ppt/slides/slideN.xml for each slide whose content changes.`,
      `  # The text lives inside <a:t>...</a:t> runs. Use sed/awk/python: whichever you trust to preserve the surrounding XML tags.`,
      `  # Example: replace one title in slide1.xml with python (XML-safe escape via .replace + html.escape):`,
      `  python3 - <<'PY'`,
      `import re, html`,
      `path = '_build/ppt/slides/slide1.xml'`,
      `xml = open(path, encoding='utf-8').read()`,
      `# replace the first <a:t>...</a:t> on the title placeholder`,
      `xml = re.sub(r'(<a:t[^>]*>)([^<]*)(</a:t>)', lambda m, n=[0]: (n.append(0) or m.group(1) + html.escape("New title here") + m.group(3)) if not n.pop(0) else m.group(0), xml, count=1)`,
      `open(path, 'w', encoding='utf-8').write(xml)`,
      `PY`,
      '',
      `  # 3. Re-zip _build/ back into the .pptx (must use cd to avoid leading dir in zip).`,
      `  (cd _build && zip -r -X ../${versionFileName} . > /dev/null)`,
      '',
      `  # 4. Sanity check: file should be valid:`,
      `  unzip -p ./${versionFileName} ppt/presentation.xml | head -c 80`,
      '',
      'CRITICAL rules:',
      '  - Do NOT change ppt/theme/*, ppt/slideMasters/*, ppt/slideLayouts/*: touch only ppt/slides/slideN.xml.',
      '  - Inside slide XMLs, change ONLY <a:t>...</a:t> text content. Do NOT change <a:pPr>, <a:rPr>, <p:sp>, <a:xfrm>, fills, or anything else.',
      '  - Preserve <a:t> count per slide where possible. If the original slide has 3 bullets, output 3 bullets (not 2, not 5).',
      '  - HTML-escape user content via &amp; &lt; &gt; &quot;: XML is strict.',
      '  - Do NOT write any HTML file. The output is the .pptx only.',
      '',
      previousVersionFileName
        ? `If ./${previousVersionFileName} exists from a previous turn, this is an iteration. Either copy ${previousVersionFileName} as the starting point (instead of the template) and edit further, OR re-edit the template fresh per the user's full instruction. Pick whichever produces a smaller diff.`
        : `This is the first version. Start from ./${brief.templateFile}.`,
      '',
      'After writing the .pptx, reply with at most 4 bullets describing which slides changed and what content went in. NO HTML in chat.',
      ''
    )
    if (pptxFacts) {
      lines.push('Slide map (from the pre-extracted facts):', slideMap, '')
    }
    return lines.join('\n')
  }

  // ─── TEMPLATE GATE: runs BEFORE the write instruction so the model
  //     can't rush past it and generate from the brief alone.
  if (brief?.templateFile) {
    const ext = (brief.templateFile.split('.').pop() ?? '').toLowerCase()
    const useTpl = !!brief.useTemplateLook
    if (useTpl) {
      lines.push(
        `STOP: TEMPLATE IS THE DESIGN. The user uploaded ./${brief.templateFile} and ticked "Use everything from this template". The template's colours, fonts, layouts, slide order and visual structure are LAW. You may NOT introduce different colours, different fonts, different layouts. Only the CONTENT (headlines, body text, bullet text) changes per the user's idea below.`,
        '',
        'Read this exactly:',
        `  - "Look like the template" means: every hex colour you write must come from the template's theme. Every font-family you write must be the template's heading or body face (with system fallback). Every slide layout you produce must mirror the template's slides 1:1 in count, order, structure, proportions and emphasis. The brief above carries no design overrides: even if it did, ignore them.`,
        '  - "Only swap content" means: the user will tell you below what story to put on each slide. Map their content onto the existing template structure. Word counts roughly match (a 6-word title stays a 6-word title). Bullet counts match. Image placeholders stay where they were.',
        ''
      )
    } else {
      lines.push(
        `STOP: TEMPLATE ATTACHED. The user uploaded ./${brief.templateFile} and expects you to follow it. You MUST read this file BEFORE writing anything.`,
        '',
        `If ./${brief.templateFile} does not exist in the cwd, REPLY ONE BULLET asking the user to re-attach it. Do NOT write any HTML in that case. Do NOT proceed.`,
        ''
      )
    }
    if (ext === 'pptx') {
      // If we pre-extracted facts on the main process, inline them so the
      // model has CONCRETE values (slide count, exact hex palette, fonts,
      // per-slide layout names + titles) without having to parse XML.
      if (pptxFacts) {
        lines.push(...pptxFactsToPrompt(pptxFacts), '')
        if (useTpl) {
          lines.push(
            'These facts ARE the design contract: you do not need to re-extract anything. Build the HTML using these exact values:',
            '  - Define :root CSS variables for every theme colour above. Reference them everywhere; introduce no other hex values.',
            '  - body { font-family: <bodyFont>, system-ui, sans-serif; } and h1..h4 { font-family: <headingFont>, ... }. Do NOT default to Inter/DM Sans.',
            '  - Generate exactly the listed slide count, in order, mapping each <section class="slide"> to the layout named in the facts.',
            '  - For each slide, take the user\'s new content and place it in the same structural slots (title placeholder -> <h1>, body placeholder -> <ul>/<p>). Word counts roughly match the originals listed above.',
            '  - For images, reference _tpl/ppt/media/<file> from the listed media files; use a flat tinted rectangle if a slide has no listed image.',
            ''
          )
        } else {
          lines.push(
            'Use these as your starting point. The user\'s wizard answers can override (e.g. if they picked a different palette). When in doubt, prefer the template values.',
            ''
          )
        }
      }
      lines.push(
        'If you need MORE detail than the facts above (specific shape positions, run-by-run formatting), the unzipped tree is at _tpl/: you may inspect it. The required reads were already done.',
        '  ls _tpl/ppt/slides/                # confirm slide count matches',
        '  cat _tpl/ppt/slideLayouts/*.xml    # full layout definitions',
        ''
      )
      if (useTpl) {
        lines.push(
          'CRITICAL constraints because "Use everything from template" is on:',
          '  - Define :root --primary/--secondary/--accent etc with the EXACT theme hex values listed in the facts. No other hex values anywhere.',
          '  - body font-family = the theme bodyFont; h1..h4 = the theme headingFont. No Inter/DM Sans defaults.',
          '  - Generate exactly N slides where N = the slide count above. One <section class="slide"> per template slide, in the same order, mapped to the same layout.',
          '  - Per-slide layout fidelity: title slide -> centered big title + small subtitle. Title+content -> top title + content block below. Two-content -> title + 2-column body. Section header -> centered eyebrow + giant section title. Match the template\'s emphasis (bold runs stay bold, italic stays italic).',
          '  - Image placeholders: where the template has an image, render an <img> pointing at _tpl/ppt/media/<file> if present, OR a tinted rectangle of the same proportions if not.',
          '  - DO NOT add a new color, gradient, eyebrow pill, fake testimonial, or anything not in the original template. The template owns the visual language.',
          ''
        )
      }
    } else if (ext === 'docx' || ext === 'xlsx') {
      lines.push(
        'Run these reads first:',
        `  mkdir -p _tpl && (cd _tpl && unzip -o ../${brief.templateFile} > /dev/null)`,
        `  cat _tpl/word/document.xml _tpl/word/theme/theme1.xml  # or xl/sharedStrings.xml + xl/theme/*.xml`,
        '',
        'Before writing the HTML, REPORT in chat: section/heading list, theme palette hex values, theme fonts.',
        ''
      )
    } else if (ext === 'pdf') {
      lines.push(
        `Run pdftotext ./${brief.templateFile} - to extract text. Note page count, headings, structure.`,
        'Before writing the HTML, REPORT in chat: page count, headings, structure, dominant typography vibe.',
        ''
      )
    } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      lines.push(
        `Open ./${brief.templateFile} as a reference image. Before writing the HTML, REPORT in chat: dominant colour palette (hex eyeball values), dominant typography vibe, layout structure (grid / hero / cards / etc).`,
        ''
      )
    } else {
      lines.push(`Read ./${brief.templateFile} fully. Before writing the HTML, REPORT in chat what you found.`, '')
    }
  }

  lines.push(
    `Write ONE self-contained HTML file named "${versionFileName}" to the cwd NOW. No subdirs, no other files, no questions.`,
    `Format: ${format}`,
    '',
    'PROMPT FIDELITY: every brief field below (design system, look, palette, fonts, theme, density, spacing, grid, motion, audience, idea, adjustments) is binding, not a hint. Read every block in order before writing. Do NOT start from a generic SaaS template and "tweak it" toward the brief — start from the brief and only add what it asks for. A reviewer will reject any element that contradicts a brief field. Re-read once after writing to verify each pick is reflected.',
    '',
    `WRITE STRATEGY: use \`create\` ONCE to write ./${versionFileName} with the full document. If \`create\` errors, fall back to bash heredoc (\`cat > ${versionFileName} <<'__EOF__' ...\`). Pick ONE write path, ship the file, then reply with the 4-bullet diff. Do NOT re-open to "polish".`
  )

  // ─── DESIGN FOUNDATION (loudest signal) ─────────────────────────────────
  // The look + design-system picks were previously buried as one-liners deep
  // inside the BRIEF block. The model treated them as flavor text and shipped
  // a generic SaaS dashboard with the brand colors swapped in. This block
  // sits at the TOP and emits concrete CSS-level anatomy directives so the
  // model can't ignore the look. Skipped on iteration (preserve previous
  // design DNA) and on PPT edit mode (template wins).
  if (!previousVersionFileName && !isPptxEdit) {
    const foundation = buildFoundationBlock({
      designSystem: brief?.designSystem ?? null,
      designSystemLabel: brief?.designSystemLabel ?? null,
      look: brief?.look ?? null,
      lookLabel: brief?.lookLabel ?? null,
    })
    if (foundation) {
      lines.push('', foundation)
    }
  }

  // ─── ITERATION MODE ─────────────────────────────────────────────────────
  // When there's a previous version, the user is iterating, not asking for
  // a fresh design. Tell the model explicitly to read the previous file and
  // apply ONLY the requested changes: otherwise it tends to start from
  // scratch and lose all the edits the user has accumulated.
  if (previousVersionFileName) {
    lines.push(
      '',
      `ITERATION: follow-up. Read ./${previousVersionFileName} FIRST (latest version). Apply ONLY the user's latest requested changes. Preserve EVERY other detail (layout, copy, colors, fonts, sections, components). Do NOT redesign from scratch. Save as ./${versionFileName}. Small request => small diff.`
    )
  }

  // ─── HARD STYLE CONTRACT ────────────────────────────────────────────────
  // Anti-AI rules. Each rule has a default-ON state but can be relaxed per
  // design via brief.aiRules. The wizard surfaces these as toggles.
  const aiRuleLines = aiRulePromptLines(brief?.aiRules)
  const customAvoidLines = (brief?.customAvoid ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim().replace(/^[-*•]\s*/, ''))
    .filter(Boolean)
  if (aiRuleLines.length || customAvoidLines.length) {
    lines.push(
      '',
      'STYLE CONTRACT (hard, not preferences):',
      ...aiRuleLines.map((s) => `- ${s}`),
      ...customAvoidLines.map((s) => `- Avoid: ${s}`),
      '',
      'BASELINE (non-negotiable):',
      '- Semantic HTML (header/nav/main/section/article/aside/footer/button/a/ul/li). No `<div onClick>`.',
      '- Tokens via `:root` CSS vars for every colour/font/radius/spacing/shadow. No raw hex/px/font-family in components.',
      '- 4px grid only: {4,8,12,16,20,24,32,40,48,64,80,96}px.',
      '- One layout per container (flex|grid|absolute). `max-width`, never fixed `width`.',
      '- Every interactive: default+hover+focus-visible(2px outline,2px offset)+active+disabled. >=44px targets.',
      '- Type scale >=4 levels. Body lh 1.4-1.6, heading 1.2-1.3. Para <=65ch. `text-wrap:balance` on h1-h3.',
      '- WCAG AA (>=4.5:1 text, >=3:1 UI). Never pure #000 on white.',
      '- Images: width+height+`loading="lazy"`+alt (decorative `alt=""`).',
      '- Respect `prefers-reduced-motion`. Animations <=300ms, transform+opacity only.',
      '- RESPONSIVE: mobile-first. MUST render cleanly at 320/375/768/1024/1280px without horizontal scroll, overflow, broken grids, or clipped text. `box-sizing: border-box` on the page. `max-width:100%` on images/iframes/videos. `clamp()`/`min()`/`max()` for fluid type+spacing. Card grids: `grid-template-columns: repeat(auto-fit, minmax(min(280px,100%),1fr))`. At <=768px: collapse columns to 1, sidebar -> top-bar/hamburger, tables -> card stacks. Include `<meta name="viewport" content="width=device-width, initial-scale=1">`. Mentally check 360px before saving.',
      '- PAGES, NOT SCROLL: when there is any nav (sidebar, top-tabs, segmented control), items SWAP a single content area, NOT smooth-scroll through stacked sections. Only ONE page visible at a time. Use `data-page="..."` sections + `display:none/block` toggling. NO IntersectionObserver, NO `scroll-behavior:smooth`, NO long stacked canvas (except when kind is explicitly "website"/"landing").',
      '- Terse: heading without sub-line, stat with its number, row with its action. One separation signal per surface; effects on hover/active only.'
    )
  }

  // ─── REFERENCE PATTERNS (silent foundations) ───────────────────────────
  // Pull 1-2 distilled "design DNA" recipes from the Studio42Starkit
  // collection. Skip when the user has chosen a formal design system or
  // pinned a template file: those win. Skip on iteration: don't second-guess
  // an existing design. The recipes are guidance about composition / mood /
  // palette, not strict overrides — brand colors and fonts below take precedence.
  if (!brief?.designSystem && !brief?.templateFile && !previousVersionFileName) {
    const recipes = pickRecipes(brief?.kind ?? null, brief?.idea ?? null, 2)
    const recipeBlock = formatRecipesForPrompt(recipes)
    if (recipeBlock) {
      lines.push('', recipeBlock)
    }
  }

  // ─── BRAND COLORS: strict, with the actual hex values ─────────────────
  // Suppressed when a template file is set: the template's theme palette
  // wins, otherwise the model gets contradictory instructions.
  if (!brief?.templateFile) {
    const colorLines = colorContract(brief)
    if (colorLines.length) {
      lines.push('', 'BRAND COLORS: use ONLY these values:', ...colorLines)
    }
  }

  // Type: same reason: template fonts win over wizard fonts.
  if (brief?.customFonts && !brief?.templateFile) {
    lines.push(
      '',
      `TYPE: the user wants multiple fonts, used as follows. Load each face via Google Fonts or Bunny Fonts CDN. Do not substitute Inter as a default for any of them:`,
      `${brief.customFonts}`
    )
  } else if ((brief?.fontHeading || brief?.fontBody || brief?.fontTertiaryLabel) && !brief?.templateFile) {
    const heading = brief.fontHeading ?? brief.fontBody
    const body = brief.fontBody ?? brief.fontHeading
    const tertiary = brief.fontTertiaryLabel ?? null
    const typeLines = [
      '',
      `TYPE: use these exact families:`,
      `- Primary (headings, h1:h4): ${heading} (load via Google Fonts or Bunny Fonts CDN if needed)`
    ]
    if (body) typeLines.push(body !== heading ? `- Secondary (body, paragraph): ${body}` : `- Secondary (body): same as primary (${body})`)
    if (tertiary) typeLines.push(`- Tertiary (accent / pull-quotes / mono / labels): ${tertiary}`)
    typeLines.push('- Do NOT substitute Inter or another fallback as the primary face. System fallback after the chosen face is fine.')
    lines.push(...typeLines)
  }

  // Icons: library + style preference. The model uses these to pick the
  // CDN/script tag and which variant of each icon to render.
  if (brief?.iconLibraryId && brief.iconLibraryId !== 'none') {
    const styleNote = brief.iconStyleId === 'filled'  ? 'Use the FILLED / solid variants throughout.'
                    : brief.iconStyleId === 'duotone' ? 'Use the DUOTONE variants: primary tone is the brand accent, secondary is a muted neutral.'
                    : brief.iconStyleId === 'mixed'   ? 'Use OUTLINE variants by default; switch to FILLED for active/selected states only.'
                    :                                   'Use the OUTLINE variants throughout: consistent stroke width, no mixing with filled.'
    const cdnHint =
      brief.iconLibraryId === 'lucide'           ? 'Lucide: `<script src="https://unpkg.com/lucide@latest"></script>` then `<i data-lucide="check"></i>` and `lucide.createIcons()`. Or import as inline SVG from the lucide.dev catalogue.' :
      brief.iconLibraryId === 'phosphor'         ? 'Phosphor: `<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@latest/src/regular/style.css" />` (or `/fill/` etc.) then `<i class="ph ph-check"></i>` (`ph-fill`, `ph-duotone` for variants).' :
      brief.iconLibraryId === 'heroicons'        ? 'Heroicons: inline SVG from heroicons.com. Use the `outline/` set or `solid/` set per the chosen style.' :
      brief.iconLibraryId === 'tabler'           ? 'Tabler: `<link rel="stylesheet" href="https://unpkg.com/@tabler/icons-webfont/tabler-icons.min.css" />` then `<i class="ti ti-check"></i>` (or `ti-filled-` prefix).' :
      brief.iconLibraryId === 'remix'            ? 'Remix: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/remixicon@4/fonts/remixicon.css" />` then `<i class="ri-check-line"></i>` (or `-fill`).' :
      brief.iconLibraryId === 'feather'          ? 'Feather: `<script src="https://unpkg.com/feather-icons"></script>` then `<i data-feather="check"></i>` and `feather.replace()`.' :
      brief.iconLibraryId === 'material-symbols' ? 'Material Symbols: `<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />` (or Filled / Sharp) then `<span class="material-symbols-outlined">check</span>`. Set `font-variation-settings: \'FILL\' 0` (outline) or `1` (filled).' :
                                                   'Iconoir: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/iconoir-icons/iconoir/css/iconoir.css" />` then `<i class="iconoir-check"></i>`.'
    lines.push(
      '',
      `ICONS: use ${brief.iconLibraryLabel}.`,
      `- ${cdnHint}`,
      `- ${styleNote}`,
      '- Do NOT mix icon libraries. Do NOT substitute emoji. Inline SVG copied from the library is also fine.'
    )
  } else if (brief?.iconLibraryId === 'none') {
    lines.push('', 'ICONS: no icon library. Do NOT use icons in the design at all (no SVGs in feature lists, no symbols in nav). Use type and whitespace to carry meaning.')
  }

  // Other brief details (fidelity, look, audience, theme, density, motion, etc.)
  const summary = summariseBriefForPrompt(brief)
  if (summary.length) {
    lines.push('', 'BRIEF (apply all):', ...summary.map((s) => `- ${s}`))
  }

  if (brief?.figmaUrl) {
    lines.push(
      '',
      `Figma reference: ${brief.figmaUrl}`,
      'Before writing the file, call the figma MCP tools (figma_get_design_context, figma_get_screenshot, figma_get_metadata, figma_get_variable_defs) on the URL above to read the actual design. Match its layout, colors, type and component structure as closely as you can in HTML/CSS. If figma tools are unavailable, note that in the reply bullets.'
    )
  }

  if (brief?.templateFile) {
    const ext = (brief.templateFile.split('.').pop() ?? '').toLowerCase()
    const lines2: string[] = ['', `Template file: ./${brief.templateFile}`]
    if (ext === 'pptx') {
      lines2.push(
        '',
        'TEMPLATE FIDELITY (PPTX): this is the single most important thing. The user wants you to KEEP THE LOOK AND FEEL of this deck and only change the content. Treat the template as ground truth; treat the brief above as guidance.',
        '',
        'Step 1: Extract:',
        `  mkdir -p _tpl && (cd _tpl && unzip -o ../${brief.templateFile} > /dev/null)`,
        '',
        'Step 2: Read the visual language. Do NOT skim. Open and parse:',
        '  - _tpl/ppt/presentation.xml : slide size (sldSz cx,cy in EMUs; 16:9 is 12192000×6858000), slide IDs/order',
        '  - _tpl/ppt/theme/theme1.xml : clrScheme (dk1, lt1, dk2, lt2, accent1..6, hlink) AND fontScheme (majorFont/minorFont latin typeface). Convert clrScheme srgbClr values to #RRGGBB hex; you will use these EXACT hex values for every colour in the output. Use the majorFont typeface for headings and minorFont typeface for body, with system fallbacks.',
        '  - _tpl/ppt/slideMasters/*.xml + _tpl/ppt/slideLayouts/*.xml: read the layout names and the placeholder positions / sizes / fills / strokes. Note which layouts the deck actually uses.',
        '  - _tpl/ppt/slides/slide*.xml: for each slide, capture: (a) the slide number, (b) the layout it references (slideLayoutN), (c) every <a:t> text run with its containing paragraph alignment, (d) shape positions (off x/y, ext cx/cy in EMUs: divide by 9525 to get pixels at 96dpi), (e) shape fills, (f) bullet/paragraph indent levels.',
        '  - _tpl/ppt/media/*: image files used in the deck. Copy any you reference into the design cwd so they can be served.',
        '',
        'Step 3: Author the new HTML deck:',
        '  - Output ONE <section class="slide"> per template slide, in the SAME order, with the SAME slide count. If the user asks for more slides, ADD them at the end after replicating the existing ones. If they ask for fewer, do not silently drop: keep all and just rewrite content.',
        '  - Use the EXACT theme hex colours (from clrScheme above) for backgrounds, text, accents, borders. Define them as CSS variables in :root. Do not introduce any colour outside the theme palette.',
        '  - Use the EXACT theme fonts (from fontScheme above). Load via Google Fonts / Bunny Fonts CDN if needed. Do NOT substitute Inter or any other family.',
        '  - Match each slide\'s layout: title slide stays a title slide, "title + content" stays "title + content", "two-content" stays "two-content", "section header" stays a section header. Position blocks proportionally to the original.',
        '  - Match the deck\'s aspect ratio (16:9 → 1920×1080; 4:3 → 1440×1080) on every .slide. body { display:flex; flex-direction:row; overflow-x:auto; height:100vh } so slides sit side-by-side.',
        '  - Replicate template imagery: if a slide has a logo/photo placeholder, render an <img> pointing at the copied file in the cwd, OR render a tinted rectangle of the same size as a placeholder.',
        '',
        'Step 4: Swap content per the user request, keep everything else:',
        '  - Rewrite headlines/body text with the user\'s topic. Keep word counts roughly equal (a 6-word title stays a 6-word title, not a 30-word one).',
        '  - Preserve bullet structure (3 bullets in template → 3 bullets in output). Keep emphasis (bold runs stay bold, italic stays italic).',
        '',
        'Step 5: Reply with a 4-bullet diff describing exactly which slides got new content and which template elements you preserved (theme colours, fonts, layouts, images).'
      )
    } else if (ext === 'docx' || ext === 'xlsx') {
      lines2.push(`This is an Office Open XML file (zip archive). Extract first:`)
      lines2.push(`  mkdir -p _tpl && (cd _tpl && unzip -o ../${brief.templateFile} > /dev/null)`)
      lines2.push(`Inspect word/document.xml or xl/sharedStrings.xml for content; word/theme/*.xml or xl/theme/*.xml for the colour palette and fonts. Use those EXACT hex values and font families in your HTML output. Match the document's section order, heading hierarchy and tone.`)
    } else if (ext === 'pdf') {
      lines2.push('Use pdftotext (or mutool draw) to extract text + structure. Capture each page\'s headings/sections and reproduce them faithfully. If the PDF is a deck, render one <section class="slide"> per page.')
    } else if (ext === 'html' || ext === 'htm') {
      lines2.push(`Read this HTML directly. Treat it as the content + style starting point: preserve its structure, palette and copy where they fit the brief.`)
    } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      lines2.push(`This is a reference image showing the desired look. Match its colour palette, type, layout and composition as closely as you can.`)
    } else if (['md', 'markdown', 'txt'].includes(ext)) {
      lines2.push(`Read this text/markdown directly. Use its content verbatim where appropriate; treat its headings as your sections.`)
    } else {
      lines2.push(`Read this file using your file tools. Extract whatever structure / text / styling you can and apply it to the output.`)
    }
    lines2.push('', `After reading the template, briefly note in your reply bullets which template elements you preserved (theme colours, fonts, slide count, layouts, imagery).`)
    lines.push(...lines2)
  }

  if (ideaLine) lines.push('', `IDEA: ${ideaLine}`)

  // ─── ADJUSTMENTS (highest-priority overrides) ──────────────────────────
  // Last-mile notes the user typed on the Summary page just before clicking
  // Build. They override anything earlier in the brief and are the freshest
  // signal of what the user actually wants. Treated as binding instructions.
  if (brief?.planNotes && brief.planNotes.trim()) {
    lines.push(
      '',
      'ADJUSTMENTS (highest priority, override anything above):',
      brief.planNotes.trim()
    )
  }

  // ─── BACKGROUND CONTEXT ─────────────────────────────────────────────────
  // Optional fields the user filled in to give the model the WHY behind the
  // design. Each one only emitted if non-empty. The model should weave
  // these into copy choices, not paste them verbatim.
  const ctxBits: string[] = []
  if (brief?.contextDescription) ctxBits.push(`About the project: ${brief.contextDescription.trim()}`)
  if (brief?.contextProblem)     ctxBits.push(`Problem being solved: ${brief.contextProblem.trim()}`)
  if (brief?.contextGoal)        ctxBits.push(`Goal: ${brief.contextGoal.trim()}`)
  if (brief?.contextKeyFeatures) ctxBits.push(`Key features / things to include :\n${brief.contextKeyFeatures.trim()}`)
  if (brief?.contextSuccess)     ctxBits.push(`What success looks like: ${brief.contextSuccess.trim()}`)
  if (ctxBits.length) {
    lines.push(
      '',
      'BACKGROUND CONTEXT: use this to ground the copy and content choices. Do NOT paste these strings verbatim into the design; rewrite them as the actual headlines, body copy, feature labels, and CTAs the design needs:',
      ...ctxBits.map((b) => `- ${b}`)
    )
  }

  // ─── REFERENCE FILES ───────────────────────────────────────────────────
  // Look-and-feel screenshots and context files the user dropped.
  // They live in `_refs/<basename>` inside the design cwd. Tell the model
  // to actually inspect them before drafting.
  const refs = brief?.inspirationImages ?? []
  if (refs.length) {
    lines.push(
      '',
      `REFERENCE FILES: the user uploaded ${refs.length} reference${refs.length === 1 ? '' : 's'} into ./_refs/. Inspect EACH one before writing. Images inform layout, palette, type, and component patterns; documents/code inform content and constraints. Do not copy any single reference 1:1. Files:`,
      ...refs.map((r) => `- ./_refs/${r}`)
    )
  }

  // ─── TWEAK SPEC: declarative panel ─────────────────────────────────────
  // Skipped for figma target (no inline HTML to host the script tag) and
  // for static print artefacts where the panel doesn't apply.
  const wantsTweakSpec = brief?.target !== 'figma'
    && brief?.kind !== 'sitemap' && brief?.kind !== 'user-flow'
  if (wantsTweakSpec) {
    lines.push(
      '',
      'TWEAK SPEC: add `<script id="t42-tweak-spec" type="application/json">` in <head> with 3-6 controls bound to CSS variables you define.',
      'Schema: `{ "groups":[{ "name":"...","controls":[{"id":"...","label":"...","type":"color|slider|checkbox|toggle|select","default":...,"cssVar":"--..."}]}]}`. Sliders need min/max/step (+ unit). Toggle/select need options. Color defaults must come from the brand palette above. Theme toggles also key off `[data-theme="dark"]` in CSS.'
    )
  }

  // Decisions: fields the user explicitly asked the model to choose.
  // Surface them so Copilot picks deliberately rather than hitting defaults.
  const decisions = brief?.decisions ?? []
  if (decisions.length) {
    const decisionLabels: Record<string, string> = {
      audience: 'audience (who this is for)',
      look: 'look & feel direction',
      density: 'UI density (compact / comfortable / spacious)',
      motion: 'motion level (none / subtle / expressive)',
      theme: 'theme (light / dark / both)',
      subtype: 'specific flavour'
    }
    lines.push(
      '',
      'DECIDE FOR ME: the user explicitly asked you to pick these. Do not skip them; choose deliberately and call out your choice in the reply bullets:',
      ...decisions.map((d) => `- ${decisionLabels[d] ?? d}`)
    )
  }

  // ─── PRE-WRITE SELF-CHECK ───────────────────────────────────────────────
  // Combined into ONE short list, grouped by category. The model is
  // instructed once to scan its draft against this list before writing.
  const r = brief?.aiRules ?? null
  const ruleOn = (id: string): boolean => r == null || r[id] !== false
  const checks: string[] = []
  // Visual / chrome
  if (ruleOn('noGradients'))     checks.push('- No `linear-/radial-/conic-gradient(`. Solid fills only.')
  if (ruleOn('noHeavyShadow'))   checks.push('- No `box-shadow` with opacity > 0.15 or blur > 12px.')
  if (ruleOn('noEmojiIcons'))    checks.push('- No emoji as section/feature icons. Use SVG or omit.')
  if (ruleOn('noAccentLines'))   checks.push('- No coloured edge-stripe (`border-l-4` etc.) on alerts/banners/callouts. No 2-6px decorative bars near headings.')
  if (ruleOn('noExcessOutlines'))checks.push('- Floating + tinted surfaces (toast, banner, alert, popover) get ONE signal: fill or shadow, never a ring AND never a stripe. Cards: at most ONE of {border, shadow, elevated bg}. If >50% of boxes have a border, prune.')
  if (ruleOn('noIconContainers'))checks.push('- No `bg-{color}-100 rounded-full p-2` discs around small icons. Icon stands alone.')
  if (ruleOn('noAiSparkleIcons'))checks.push('- No sparkle/wand/AI-badge icons except on actual AI triggers.')
  if (ruleOn('noBlobs'))         checks.push('- No decorative blobs / aurora bg / squiggles.')
  if (ruleOn('noFloatingDashboard')) checks.push('- No tilted fake-dashboard hero shots.')
  // Copy
  if (ruleOn('noAllCaps'))       checks.push('- No `text-transform: uppercase` runs > 2 words. Sentence/Title case.')
  if (ruleOn('noEmDashes'))      checks.push('- No U+2014 / U+2013 in text.')
  if (ruleOn('noEyebrowPills'))  checks.push('- No pill/chip directly above hero h1.')
  if (ruleOn('noEmphasisColor'))checks.push('- No mid-heading colour shift on one word.')
  if (ruleOn('noVerboseText'))   checks.push('- No subtitle paraphrasing the heading. No "Below you can / Here you can / Welcome to" intros. Stat cards = label + value, never label + value + descriptive line.')
  if (ruleOn('noGenericHero'))   checks.push('- No generic AI marketing copy ("Supercharge", "Modern X for Y", "The future of", "Empower", "Unlock the power", "Build better/faster/smarter", "Everything you need").')
  // Content
  if (ruleOn('noFakeTestimonials')) checks.push('- No fake testimonials with invented names. Use `[testimonial]` placeholder.')
  if (ruleOn('noFakeStats'))     checks.push('- No invented stats. Use `[stat]` placeholder.')
  if (ruleOn('noFakeMeta'))      checks.push('- No invented version pills / BETA NEW PRO chips / breadcrumbs / "Last updated" stamps.')
  // Tokens / a11y / always-on
  if (ruleOn('noInter') && !brief?.templateFile) checks.push('- No `font-family: Inter` first (unless picked).')
  if (!brief?.templateFile)      checks.push('- Every hex must be from the brand palette (or #fff/#000). No invented colours.')
  checks.push('- No `<div onClick>` / `<div role="button">`. Use real `<button>`.')
  checks.push('- All spacing on {4,8,12,16,20,24,32,40,48,64,80,96}px.')
  checks.push('- Every interactive has `:focus-visible` (2px outline + 2px offset).')
  checks.push('- Every `<img>` has `alt` + `width` + `height` + `loading="lazy"` below the fold.')
  if (checks.length) {
    lines.push('', 'PRE-WRITE CHECKS (scan your draft once before writing; fix in place):', ...checks)
  }

  lines.push('', 'Reply with AT MOST 4 short bullets. Do not paste the HTML in chat.')
  lines.push(planningProtocolBlock(brief))

  return lines.join('\n')
}

// Hex values the model should NEVER use unless explicitly asked. Common
// AI-default brand colors that leak into every untreated prompt.
const FORBIDDEN_HEX = ['#5b47fb', '#7c3aed', '#8b5cf6', '#6366f1', '#a855f7', '#9333ea', '#3b82f6', '#2563eb']

function colorContract(brief: DesignBrief | null): string[] {
  if (!brief) return []
  const out: string[] = []
  if (brief.primaryColor)   out.push(`- Primary:   ${brief.primaryColor}  (use as the dominant brand color, CSS var --primary)`)
  if (brief.secondaryColor) out.push(`- Secondary: ${brief.secondaryColor}  (supporting brand color, CSS var --secondary)`)
  if (brief.accentColor)    out.push(`- Accent:    ${brief.accentColor}  (highlights, CTAs, important states, CSS var --accent)`)
  if (brief.paletteColors?.length) {
    out.push(`- Palette neutrals (${brief.paletteLabel ?? 'preset'}): ${brief.paletteColors.join(', ')} : derive backgrounds, surfaces, borders and text from these, do NOT introduce other neutrals`)
  }
  if (out.length) {
    out.push('- You MAY use #ffffff, #000000, and tints/shades of the brand colors (lighter/darker) for surfaces and text. Nothing else.')
    out.push(`- Do NOT use AI-default purples/indigos/blues such as ${FORBIDDEN_HEX.slice(0, 4).join(', ')}: these are forbidden unless explicitly asked.`)
  }
  return out
}

// Same as summariseBrief but returns an array (one bullet per item) and
// excludes color/font (they get their own dedicated blocks above).
function summariseBriefForPrompt(b: DesignBrief | null): string[] {
  if (!b) return []
  const bits: string[] = []
  bits.push(`Type: ${b.kindLabel}${b.subtype ? ` (${b.subtype})` : ''}`)
  if (b.surface) bits.push(`Surface: ${b.surface}`)
  bits.push(`Fidelity: ${b.fidelity === 'wireframe'
    ? 'Wireframe (grayscale, dashed strokes, no real imagery, no finished colors)'
    : 'High fidelity (polished, branded with above colors, real imagery via Unsplash CDN OK)'}`)
  if (b.designSystemLabel || b.designSystem) {
    bits.push(`Design system: ${b.designSystemLabel ?? b.designSystem} (follow its component anatomy, spacing/type scale, motion; overrides conflicting look/shape/density picks)`)
  }
  if (b.lookLabel) bits.push(`Look: ${b.lookLabel} (commit visibly; no default SaaS-minimal)`)
  if (b.audience) bits.push(`Audience: ${b.audience}`)
  if (b.theme) {
    const themeFull: Record<string, string> = {
      light: 'light only — do NOT include a dark mode toggle, do NOT add @media (prefers-color-scheme: dark) rules',
      dark:  'dark only — do NOT include a light mode toggle, do NOT add @media (prefers-color-scheme: light) rules',
      auto:  'auto (follows OS via @media (prefers-color-scheme: dark)) — no manual toggle button',
      both:  'light AND dark with a working MANUAL toggle (non-negotiable): (1) define BOTH palettes as CSS vars under `:root` (light) and `[data-theme="dark"]` (dark) — every color via var(); (2) visible toggle in the header (sun/moon icon or "Light/Dark"); (3) onclick flips `document.documentElement.dataset.theme` and persists to `localStorage.theme`; (4) on load read `localStorage.theme` else fall back to `matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"`; (5) toggle MUST visibly change the page — mentally click before saving.',
    }
    bits.push(`Theme: ${themeFull[b.theme] ?? b.theme}`)
  }
  if (b.density) bits.push(`Density: ${b.density}`)
  if (b.spacing) {
    const map: Record<string, string> = {
      tight:    'tight 4px scale: snap to {4,8,12,16,20,24,32}px; dense info-rich UI',
      standard: 'standard 8px scale: snap to {4,8,16,24,32,40,48,64}px',
      spacious: 'spacious 8px scale: snap to {16,24,32,48,64,80,96}px; marketing-grade whitespace'
    }
    bits.push(`Spacing scale: ${map[b.spacing] ?? b.spacing}`)
  }
  if (b.grid) {
    const map: Record<string, string> = {
      '4col':  '4-col (mobile-first)',
      '8col':  '8-col (tablet)',
      '12col': '12-col (standard responsive)',
      '16col': '16-col (dense dashboards/tables)',
      flex:    'no fixed columns; snap to spacing scale only'
    }
    bits.push(`Grid: ${map[b.grid] ?? b.grid}`)
  }
  if (b.motion) bits.push(`Motion: ${b.motion}${b.motion === 'none' ? ' (no transitions, no hover anims beyond color)' : ''}`)
  if (b.customMotion) bits.push(`Motion notes (verbatim): ${b.customMotion}`)
  if (b.stackLabel || b.stack) {
    const stackId = (b.stack ?? '').toLowerCase()
    const isHtmlNative = !stackId || stackId === 'html' || stackId === 'plain' || stackId === 'vanilla'
    if (isHtmlNative) {
      bits.push(`Stack: ${b.stackLabel ?? b.stack}`)
    } else {
      bits.push(`Stack: ${b.stackLabel ?? b.stack} — the deliverable is still ONE self-contained HTML file (that\'s the canvas constraint), so don\'t emit .astro/.vue/.svelte/.tsx files. Instead borrow the AESTHETIC and idioms typical of ${b.stackLabel ?? b.stack} apps: layout patterns, component shapes, naming, spacing, what an "${b.stackLabel ?? b.stack} app" looks like in the wild. Make it visually distinguishable from a generic "html + css" output.`)
    }
  }
  if (b.customStack) bits.push(`Stack notes (verbatim): ${b.customStack}`)
  if (b.shapeRadius) {
    const map: Record<string, string> = {
      sharp:   'sharp 0px on cards/buttons/inputs',
      soft:    '~4px surfaces; pill only for chips/avatars',
      rounded: '~12px cards/panels, ~8px buttons/inputs',
      pill:    'pill buttons/inputs (9999px), ~16px cards'
    }
    bits.push(`Corner radius: ${map[b.shapeRadius] ?? b.shapeRadius}`)
  }
  if (b.shapeShadow) {
    const map: Record<string, string> = {
      none:   'no shadows; borders/surfaces separate',
      subtle: '0 1px 2px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.08)',
      medium: '0 4px 8px rgba(0,0,0,.08); cards float',
      strong: '0 12px 32px rgba(0,0,0,.16); pronounced depth'
    }
    bits.push(`Shadows: ${map[b.shapeShadow] ?? b.shapeShadow}`)
  }
  if (b.shapeBorders) {
    const map: Record<string, string> = {
      none:     'no borders; shadow/bg only',
      thin:     '1px hairlines on cards/inputs/dividers',
      standard: '1.5px on inputs/cards',
      strong:   '2-3px outlines (brutalist/editorial)'
    }
    bits.push(`Borders: ${map[b.shapeBorders] ?? b.shapeBorders}`)
  }
  if (b.shapeSurface) {
    const map: Record<string, string> = {
      filled:     'filled (solid bg)',
      outlined:   'outlined (transparent fills, borders only)',
      glass:      'glass (translucent + backdrop-filter blur ~12px)',
      neumorphic: 'neumorphic (matching tones, soft inner+outer shadows)',
      gradient:   'gradient (subtle linear, low chroma ~10%)'
    }
    bits.push(`Surface: ${map[b.shapeSurface] ?? b.shapeSurface}`)
  }
  if (b.secondaryButton) {
    const map: Record<string, string> = {
      outlined:          'Secondary buttons = OUTLINED: transparent background, 1.5px border in primary color, primary color text. On hover: subtle bg tint. Use everywhere a secondary action sits next to a filled primary (Cancel next to Save, Learn more next to Get started, etc.).',
      ghost:             'Secondary buttons = GHOST: no background, no border, just primary-color text with weight ≥500. On hover: light bg tint (4-8% primary). Use for tertiary inline actions and toolbar items too.',
      soft:              'Secondary buttons = SOFT/TINTED: background is a light tint (~10-12% alpha) of the primary color, primary color text, no border. Sits between primary and ghost in visual weight.',
      neutral:           'Secondary buttons = NEUTRAL FILLED: surface gray fill (var(--surface) or the elevated bg token), primary text color, no border. Material-style "tonal" feel. Primary stays brand-colored.',
      accent:            'Secondary buttons = ACCENT-COLORED: filled with the SECONDARY brand color (var(--secondary)), white or contrast text. Two-tone button system: primary in primary brand color, secondary in secondary brand color.',
      underline:         'Secondary buttons = UNDERLINED LINK: rendered inline as styled text (no padding box), primary color, with underline on hover or always-on. Editorial / minimal feel. Reserve filled buttons for the primary action only.',
      'same-as-primary': 'Secondary buttons = SAME AS PRIMARY (no visual distinction). Both rendered identically. Only use this when the user explicitly wants no hierarchy between actions — rare.'
    }
    bits.push(map[b.secondaryButton] ?? `Secondary buttons: ${b.secondaryButton}`)
  }
  if (b.inspiration) bits.push(`Inspiration: ${b.inspiration}`)
  return bits
}

// ─── Send (subprocess + JSONL streaming) ──────────────────────────────────

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
  const violations = lintHtml(html, d.brief?.aiRules ?? null)
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

  const safeBase = (d.title || 'design').replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '') || 'design'
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
