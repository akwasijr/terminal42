import { ipcMain } from 'electron'
import { getDb } from './db'
import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'

// Project Brief: per-project intent + visual preferences gathered via the
// new-project starter wizard. The brief is a ONE-SHOT project starter:
//   - Stored as structured JSON in settings_kv (key = `brief:v1:<projectId>`)
//     so the wizard can be re-opened and edited.
//   - Used by the renderer to build a rich, narrative kickoff prompt that is
//     autotyped into the FIRST Copilot session for the project.
//
// The brief is intentionally NOT merged into the brain. The brain is for
// ongoing memory captured during work; the brief is a kickoff document. We do
// not want the brief to be re-prefixed onto every future Copilot turn.

export type ProjectBrief = {
  v: 1
  type: string
  typeLabel: string
  subType?: string
  audience?: string
  look?: string[]
  lookNote?: string
  brandColor?: string
  secondaryColor?: string
  tertiaryColor?: string
  headingFont?: string
  bodyFont?: string
  font?: string
  motionLibs?: string[]
  iconLibrary?: string
  imageSource?: string
  designSystem?: string
  brandLogo?: string
  brandName?: string
  radius?: 'square' | 'subtle' | 'medium' | 'rounded' | 'pill'
  shadow?: 'none' | 'subtle' | 'medium' | 'strong'
  outline?: 'none' | 'subtle' | 'strong'
  theme?: 'light' | 'dark' | 'auto' | 'both'
  surfaces?: string[]
  stack?: string
  language?: string
  auth?: string
  store?: string
  deploy?: string
  oneLiner?: string
  description?: string
  problem?: string
  goal?: string
  keyFeatures?: string
  mustHaves?: string
  successMetric?: string
  notes?: string
  scaffold?: boolean
  inspirationImages?: string[]
  createdAt: number
}

const KEY = (projectId: string) => `brief:v1:${projectId}`

function kvGet(key: string): string | null {
  const r = getDb().prepare('SELECT value FROM settings_kv WHERE key = ?').get(key) as { value: string } | undefined
  return r?.value ?? null
}

function kvSet(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings_kv (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value)
}

function kvDelete(key: string): void {
  getDb().prepare('DELETE FROM settings_kv WHERE key = ?').run(key)
}

export function loadBrief(projectId: string): ProjectBrief | null {
  const raw = kvGet(KEY(projectId))
  if (!raw) return null
  try { return JSON.parse(raw) as ProjectBrief } catch { return null }
}

function brainProjectFile(projectId: string): string {
  return join(app.getPath('userData'), 'brain', 'projects', `${projectId}.md`)
}

const BRIEF_BEGIN = '<!-- t42-brief:begin -->'
const BRIEF_END = '<!-- t42-brief:end -->'

// Strip any legacy brief block from the project brain file. Older versions of
// the wizard merged the brief into the brain, which caused the cramped
// `Style preferences: ...` preface to appear on every session. We no longer
// write briefs to the brain; this just cleans up files left behind.
async function stripLegacyBriefFromBrain(projectId: string): Promise<void> {
  const path = brainProjectFile(projectId)
  let existing = ''
  try { existing = await fs.readFile(path, 'utf8') } catch { return }
  const begin = existing.indexOf(BRIEF_BEGIN)
  const end = existing.indexOf(BRIEF_END)
  if (begin === -1 || end === -1 || end <= begin) return
  const cleaned = (existing.slice(0, begin) + existing.slice(end + BRIEF_END.length)).trim()
  if (cleaned) {
    await fs.writeFile(path, cleaned + '\n', 'utf8')
  } else {
    try { await fs.unlink(path) } catch {}
  }
}

export async function saveBrief(projectId: string, brief: ProjectBrief): Promise<void> {
  kvSet(KEY(projectId), JSON.stringify(brief))
  // Make sure no stale brief block lingers in the project brain. The kickoff
  // prompt (built in the renderer) is the only place the brief content goes.
  await stripLegacyBriefFromBrain(projectId)
}

export async function clearBrief(projectId: string): Promise<void> {
  kvDelete(KEY(projectId))
  await stripLegacyBriefFromBrain(projectId)
}

function inspirationDir(projectId: string): string {
  return join(app.getPath('userData'), 'brain', 'projects', projectId, 'inspiration')
}

function safeName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return base || 'image'
}

const ALLOWED_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'])
const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif'
}

export function registerBriefIpc(): void {
  ipcMain.handle('brief:save', async (_e, args: { projectId: string; brief: ProjectBrief }) => {
    await saveBrief(args.projectId, { ...args.brief, createdAt: args.brief.createdAt || Date.now() })
    return { ok: true }
  })
  ipcMain.handle('brief:load', (_e, projectId: string) => {
    return loadBrief(projectId)
  })
  ipcMain.handle('brief:clear', async (_e, projectId: string) => {
    await clearBrief(projectId)
    return { ok: true }
  })

  ipcMain.handle('brief:upload-inspiration', async (_e, args: { projectId: string; name: string; bytes: ArrayBuffer }) => {
    try {
      const ext = (args.name.split('.').pop() || '').toLowerCase()
      if (!ALLOWED_EXT.has(ext)) return { ok: false, error: 'Unsupported file type' }
      const dir = inspirationDir(args.projectId)
      await fs.mkdir(dir, { recursive: true })
      const stamp = Date.now().toString(36)
      const fname = `${stamp}-${safeName(args.name)}`
      const target = join(dir, fname)
      await fs.writeFile(target, Buffer.from(args.bytes))
      return { ok: true, relativePath: `inspiration/${fname}` }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('brief:delete-inspiration', async (_e, args: { projectId: string; relativePath: string }) => {
    try {
      if (args.relativePath.includes('..')) return { ok: false }
      const dir = join(app.getPath('userData'), 'brain', 'projects', args.projectId)
      await fs.unlink(join(dir, args.relativePath))
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })

  ipcMain.handle('brief:inspiration-data-url', async (_e, args: { projectId: string; relativePath: string }) => {
    try {
      if (args.relativePath.includes('..')) return null
      const dir = join(app.getPath('userData'), 'brain', 'projects', args.projectId)
      const buf = await fs.readFile(join(dir, args.relativePath))
      const ext = (args.relativePath.split('.').pop() || '').toLowerCase()
      const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream'
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch {
      return null
    }
  })

  ipcMain.handle('brief:inspiration-dir', (_e, projectId: string) => {
    return inspirationDir(projectId)
  })

  // ----- Brand assets (logo) -----
  ipcMain.handle('brief:upload-brand-logo', async (_e, args: { projectId: string; name: string; bytes: ArrayBuffer }) => {
    try {
      const ext = (args.name.split('.').pop() || '').toLowerCase()
      if (!ALLOWED_EXT.has(ext)) return { ok: false, error: 'Unsupported file type' }
      const dir = brandDir(args.projectId)
      await fs.mkdir(dir, { recursive: true })
      const stamp = Date.now().toString(36)
      const fname = `${stamp}-${safeName(args.name)}`
      const target = join(dir, fname)
      await fs.writeFile(target, Buffer.from(args.bytes))
      return { ok: true, relativePath: `brand/${fname}` }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('brief:delete-brand-logo', async (_e, args: { projectId: string; relativePath: string }) => {
    try {
      if (args.relativePath.includes('..')) return { ok: false }
      const dir = join(app.getPath('userData'), 'brain', 'projects', args.projectId)
      await fs.unlink(join(dir, args.relativePath))
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })

  ipcMain.handle('brief:brand-data-url', async (_e, args: { projectId: string; relativePath: string }) => {
    try {
      if (args.relativePath.includes('..')) return null
      const dir = join(app.getPath('userData'), 'brain', 'projects', args.projectId)
      const buf = await fs.readFile(join(dir, args.relativePath))
      const ext = (args.relativePath.split('.').pop() || '').toLowerCase()
      const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream'
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch {
      return null
    }
  })

  ipcMain.handle('brief:brand-dir', (_e, projectId: string) => {
    return brandDir(projectId)
  })
}

function brandDir(projectId: string): string {
  return join(app.getPath('userData'), 'brain', 'projects', projectId, 'brand')
}
