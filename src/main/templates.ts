// Studio42 Starter Kit templates.
//
// We fetch the list of starters from a public GitHub repo on demand (cached
// for the app session), and materialise a chosen starter by shallow-cloning
// the repo into a local cache once and then copying the relevant subfolder
// into the destination directory. Each call creates a brand-new copy: the
// cache repo is read-only as far as the user is concerned.

import { ipcMain, BrowserWindow, app } from 'electron'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { tmpdir } from 'os'
import { importDesignFromFolder } from './designStore'

const REPO = 'akwasijr/Studio42Starkit'
const REPO_GIT = `https://github.com/${REPO}.git`
const STARTERS_DIR = 'starters'

export type TemplateInfo = {
  id: string
  name: string
  displayName: string
  description: string
  // Used for the small thumb badge in the picker.
  category: 'industry' | 'fluent' | 'consumer' | 'dashboard' | 'other'
}

// Map id → friendly display name. Falls back to title-cased id for anything
// new the repo grows in the future.
const DISPLAY_OVERRIDES: Record<string, { name: string; description: string; category: TemplateInfo['category'] }> = {
  'consumer-app': { name: 'Consumer app', description: 'Mobile-first consumer product shell.', category: 'consumer' },
  'dashboard': { name: 'Dashboard', description: 'Generic analytics dashboard scaffold.', category: 'dashboard' },
  'fluent-enterprise-dashboard': { name: 'Fluent: Enterprise dashboard', description: 'Microsoft Fluent enterprise dashboard.', category: 'fluent' },
  'fluent-internal-tools': { name: 'Fluent: Internal tools', description: 'Internal tooling kit on Fluent.', category: 'fluent' },
  'fluent-teams-app': { name: 'Fluent: Teams app', description: 'Teams-style app shell on Fluent.', category: 'fluent' },
  'industry-banking': { name: 'Banking', description: 'Banking & financial services starter.', category: 'industry' },
  'industry-ceo-dashboard': { name: 'CEO dashboard', description: 'Executive board-level dashboard.', category: 'industry' },
  'industry-education-higher': { name: 'Higher education', description: 'University / higher-ed starter.', category: 'industry' },
  'industry-education-k12': { name: 'K-12 education', description: 'Schools & K-12 starter.', category: 'industry' },
  'industry-energy': { name: 'Energy', description: 'Energy & oil/gas starter.', category: 'industry' },
  'industry-government': { name: 'Government', description: 'Public sector starter.', category: 'industry' },
  'industry-healthcare': { name: 'Healthcare', description: 'Care delivery / payer / provider starter.', category: 'industry' },
  'industry-insurance': { name: 'Insurance', description: 'Insurance carrier / broker starter.', category: 'industry' },
  'industry-pharma': { name: 'Pharma', description: 'Pharmaceutical / life sciences starter.', category: 'industry' },
  'industry-retail': { name: 'Retail', description: 'Retail & e-commerce starter.', category: 'industry' },
  'industry-smart-factory': { name: 'Smart factory', description: 'Manufacturing & IoT starter.', category: 'industry' },
  'industry-supply-chain': { name: 'Supply chain', description: 'Logistics & supply chain starter.', category: 'industry' },
  'industry-sustainability': { name: 'Sustainability', description: 'ESG & sustainability reporting starter.', category: 'industry' },
  'industry-telco': { name: 'Telco', description: 'Telecommunications operator starter.', category: 'industry' },
  'industry-utilities': { name: 'Utilities', description: 'Water / electric utilities starter.', category: 'industry' }
}

function titleCase(slug: string): string {
  return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function describeId(id: string): { displayName: string; description: string; category: TemplateInfo['category'] } {
  const o = DISPLAY_OVERRIDES[id]
  if (o) return { displayName: o.name, description: o.description, category: o.category }
  return { displayName: titleCase(id), description: 'Starter template.', category: 'other' }
}

function templateCacheRoot(): string {
  return join(app.getPath('userData'), 'template-cache')
}
function repoCachePath(): string {
  return join(templateCacheRoot(), 'Studio42Starkit')
}

function run(cmd: string, args: string[], opts: { cwd?: string } = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd: opts.cwd, env: process.env })
    let stdout = ''
    let stderr = ''
    p.stdout.on('data', (d) => { stdout += d.toString() })
    p.stderr.on('data', (d) => { stderr += d.toString() })
    p.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
    p.on('error', () => resolve({ code: 1, stdout, stderr }))
  })
}

let cloneInFlight: Promise<void> | null = null
// How long a checked-out cache is trusted before we go back to the network.
// Matches the template list's own cache: refreshing the files more often than
// the list that describes them buys nothing.
const REPO_FRESH_MS = 60 * 60 * 1000
let repoRefreshedAt = 0

async function ensureRepoCache(): Promise<void> {
  if (cloneInFlight) return cloneInFlight
  cloneInFlight = (async () => {
    const dir = repoCachePath()
    await fs.mkdir(templateCacheRoot(), { recursive: true })
    if (existsSync(join(dir, '.git'))) {
      // A fetch and reset against this repo takes minutes, and it used to run
      // on every single call — including once per template copy, where it sat
      // behind a click with nothing on screen to explain the wait.
      if (Date.now() - repoRefreshedAt < REPO_FRESH_MS) return
      // Best-effort fast pull. Failure is non-fatal: we keep the existing cache.
      await run('git', ['-C', dir, 'fetch', '--depth=1', 'origin', 'main'])
      await run('git', ['-C', dir, 'reset', '--hard', 'origin/main'])
      repoRefreshedAt = Date.now()
      return
    }
    await fs.rm(dir, { recursive: true, force: true })
    // Try gh first (handles private repos), fall back to git
    const ghResult = await run('gh', ['repo', 'clone', REPO, dir, '--', '--depth=1'])
    if (ghResult.code !== 0) {
      const gitResult = await run('git', ['clone', '--depth=1', REPO_GIT, dir])
      if (gitResult.code !== 0) throw new Error(`Clone failed: ${gitResult.stderr || ghResult.stderr}`)
    }
    repoRefreshedAt = Date.now()
  })()
  try {
    await cloneInFlight
  } finally {
    cloneInFlight = null
  }
}

let listCache: { items: TemplateInfo[]; ts: number } | null = null
const LIST_CACHE_MS = 60 * 60 * 1000

export async function listTemplates(): Promise<TemplateInfo[]> {
  if (listCache && Date.now() - listCache.ts < LIST_CACHE_MS) return listCache.items
  await ensureRepoCache()
  const startersDir = join(repoCachePath(), STARTERS_DIR)
  let entries: string[] = []
  try {
    entries = await fs.readdir(startersDir)
  } catch {
    entries = []
  }
  const items: TemplateInfo[] = []
  for (const name of entries) {
    if (name.startsWith('.')) continue
    const full = join(startersDir, name)
    let stat
    try {
      stat = await fs.stat(full)
    } catch {
      continue
    }
    if (!stat.isDirectory()) continue
    const meta = describeId(name)
    items.push({
      id: name,
      name,
      displayName: meta.displayName,
      description: meta.description,
      category: meta.category
    })
  }
  // Industry on top, then fluent, then dashboard/consumer, then other; alpha within group.
  const order = { industry: 0, fluent: 1, dashboard: 2, consumer: 3, other: 4 }
  items.sort((a, b) => {
    const da = order[a.category]
    const db = order[b.category]
    return da - db || a.displayName.localeCompare(b.displayName)
  })
  listCache = { items, ts: Date.now() }
  return items
}

async function copyTemplateInto(templateId: string, destDir: string): Promise<void> {
  await ensureRepoCache()
  const src = join(repoCachePath(), STARTERS_DIR, templateId)
  if (!existsSync(src)) throw new Error(`Template "${templateId}" not found in starters/`)
  await fs.mkdir(destDir, { recursive: true })
  // Use cp -R for speed and to preserve nested files/symlinks. fs.cp also works
  // on Node ≥ 16.7 but cp is more battle-tested for big trees on macOS.
  const r = await run('cp', ['-R', `${src}/.`, destDir])
  if (r.code !== 0) throw new Error(`copy failed: ${r.stderr}`)
}

async function _uniqueDestDir(parent: string, baseName: string): Promise<string> {
  let candidate = join(parent, baseName)
  if (!existsSync(candidate)) return candidate
  for (let i = 2; i < 1000; i++) {
    candidate = join(parent, `${baseName}-${i}`)
    if (!existsSync(candidate)) return candidate
  }
  return join(parent, `${baseName}-${randomUUID().slice(0, 6)}`)
}

export function registerTemplatesIpc(_getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('templates:list', async () => {
    try {
      return await listTemplates()
    } catch (e) {
      return { error: String((e as Error).message || e) }
    }
  })

  // Take a copy of a template as a design of your own.
  //
  // "Use this template" opens a wizard and asks what you are building.
  // Duplicating is the other thing people want: the same starter, in their own
  // list, unchanged and ready to open. The files go through a scratch folder
  // and then the normal import path, so the copy gets its first version and
  // entry page detected exactly like any other imported project.
  ipcMain.handle('templates:copyToDesign', async (_e, args: { templateId: string; title: string }) => {
    const scratch = join(tmpdir(), `t42-template-${randomUUID().slice(0, 8)}`)
    try {
      await copyTemplateInto(args.templateId, scratch)
      const design = await importDesignFromFolder(scratch, args.title)
      return { ok: true as const, design }
    } catch (e) {
      return { ok: false as const, error: String((e as Error).message || e) }
    } finally {
      await fs.rm(scratch, { recursive: true, force: true }).catch(() => {})
    }
  })

  // Materialise a template's files into a destination cwd (typically a
  // freshly-created design's cwd). Returns ok if everything copied.
  ipcMain.handle('templates:materialize', async (_e, args: { templateId: string; destDir: string }) => {
    try {
      await copyTemplateInto(args.templateId, args.destDir)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String((e as Error).message || e) }
    }
  })
}
