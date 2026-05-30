// Design persistence layer: SQLite + filesystem CRUD for designs, messages,
// and versions. Extracted from design.ts. Pure data/IO — no dependency on the
// run-state machine or BrowserWindow event emission (deleteDesign stays in
// design.ts because it must also cancel in-flight runs and watchers).

import { app } from 'electron'
import { spawn } from 'node:child_process'
import { promises as fs, statSync, existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { getDb } from './db'
import type {
  Design,
  DesignBrief,
  DesignRole,
  DesignStatus,
  DesignToolCall,
  DesignMessage,
  DesignVersion
} from './design.types'

// ─── Paths ────────────────────────────────────────────────────────────────

export function designsRoot(): string {
  return join(app.getPath('userData'), 'designs')
}

export function designCwd(id: string): string {
  return join(designsRoot(), id)
}

// ─── DB helpers ───────────────────────────────────────────────────────────

export function rowToDesign(row: {
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

export function rowToMessage(row: {
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

export function getDesign(id: string): Design | null {
  const row = getDb()
    .prepare('SELECT * FROM designs WHERE id = ?')
    .get(id) as Parameters<typeof rowToDesign>[0] | undefined
  return row ? rowToDesign(row) : null
}

export function listDesigns(): Design[] {
  const rows = getDb()
    .prepare('SELECT * FROM designs ORDER BY last_active_at DESC')
    .all() as Array<Parameters<typeof rowToDesign>[0]>
  return rows.map(rowToDesign)
}

export async function createDesign(opts?: { title?: string; brief?: DesignBrief | null }): Promise<Design> {
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

export async function importDesignFromFolder(folderPath: string, title?: string): Promise<Design> {
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

export async function importDesignFromGit(repoUrl: string, title?: string): Promise<Design> {
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

export async function findEntryHtml(dir: string): Promise<string | null> {
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

export async function copyDir(src: string, dest: string): Promise<void> {
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
export function fixAbsoluteAssetPaths(html: string): string {
  return html
    .replace(/(src|href)="\/(?!\/)/g, '$1="./')
    .replace(/(src|href)='\/(?!\/)/g, "$1='./")
}

export function renameDesign(id: string, title: string): Design | null {
  // Strip em/en-dashes the model loves to inject into auto-generated titles.
  const cleaned = title.replace(/\s*[::]\s*/g, ' - ').replace(/\s+/g, ' ').trim()
  getDb().prepare('UPDATE designs SET title = ?, last_active_at = ? WHERE id = ?')
    .run(cleaned || 'Untitled', Date.now(), id)
  return getDesign(id)
}

export function loadHistory(designId: string): DesignMessage[] {
  const rows = getDb()
    .prepare(`SELECT id, design_id, role, content, tool_calls, status, created_at
              FROM design_messages WHERE design_id = ? ORDER BY created_at ASC, id ASC`)
    .all(designId) as Array<Parameters<typeof rowToMessage>[0]>
  return rows.map(rowToMessage)
}

export function insertMessage(m: DesignMessage): void {
  getDb()
    .prepare(`INSERT INTO design_messages (id, design_id, role, content, tool_calls, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(m.id, m.designId, m.role, m.content, JSON.stringify(m.toolCalls), m.status, m.createdAt)
}

export function updateMessage(m: DesignMessage): void {
  getDb()
    .prepare(`UPDATE design_messages SET content = ?, tool_calls = ?, status = ? WHERE id = ?`)
    .run(m.content, JSON.stringify(m.toolCalls), m.status, m.id)
}

export function saveCopilotResumeId(designId: string, copilotSessionId: string): void {
  getDb()
    .prepare('UPDATE designs SET copilot_session_id = ?, last_active_at = ? WHERE id = ?')
    .run(copilotSessionId, Date.now(), designId)
}

export function setCurrentVersion(designId: string, versionId: string): void {
  getDb().prepare('UPDATE designs SET current_version = ?, last_active_at = ? WHERE id = ?')
    .run(versionId, Date.now(), designId)
}

// ─── Versions ─────────────────────────────────────────────────────────────

export function listVersions(designId: string): DesignVersion[] {
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

export function nextVersionNumber(designId: string): number {
  const versions = listVersions(designId)
  let max = 0
  for (const v of versions) {
    const m = v.id.match(/^v(\d+)$/i)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max + 1
}

export function stripDashes(s: string): string {
  return s.replace(/\s*[::]\s*/g, ' - ').replace(/\s+/g, ' ').trim()
}

export function autoTitleFromText(text: string): string {
  const t = stripDashes(text).split('\n')[0].slice(0, 60)
  return t || 'New design'
}

export function maybeAutoTitle(designId: string, text: string): void {
  const d = getDesign(designId)
  if (!d) return
  if (d.title && d.title !== 'New design' && d.title !== 'Figma design') return
  const next = autoTitleFromText(text)
  if (next && next !== d.title) renameDesign(designId, next)
}
