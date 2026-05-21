import { ipcMain, app, BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { join, basename } from 'path'
import { spawn } from 'child_process'
import { readMemory, writeMemory } from './memory'
import { gatherEvidence, onInsightsRunComplete } from './insights'
import { getSettings } from './settings'
import { stripAnsi } from './ansi'

export type SkillFormat = 'prompt' | 'persona' | 'clip' | 'recipe'
export type SkillScope = { kind: 'always' } | { kind: 'manual' } | { kind: 'project'; projectId: string }

export type Skill = {
  id: string                // relative path: <folder>/<filename.md>
  folder: 'prompts' | 'personas' | 'clips' | 'recipes' | 'lib'
  name: string
  body: string              // body WITHOUT frontmatter
  format: SkillFormat
  tags: string[]
  scope: SkillScope
  updatedAt: number
}

const FOLDERS = ['prompts', 'personas', 'clips', 'recipes', 'lib'] as const

function safeName(s: string): string {
  return s.replace(/[/\\:?*"<>|]/g, '-').slice(0, 80)
}

function root(): string {
  return join(app.getPath('userData'), 'skills')
}

async function ensureRoot(): Promise<void> {
  for (const f of FOLDERS) {
    await fs.mkdir(join(root(), f), { recursive: true })
  }
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/

type Frontmatter = {
  format?: SkillFormat
  tags?: string[]
  scope?: string             // "always" | "manual" | "project:<id>"
}

function parseFrontmatter(raw: string): { meta: Frontmatter; body: string } {
  const m = raw.match(FRONTMATTER_RE)
  if (!m) return { meta: {}, body: raw }
  const fmText = m[1]
  const body = m[2]
  const meta: Frontmatter = {}
  for (const line of fmText.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let val: string = line.slice(idx + 1).trim()
    if (key === 'tags') {
      // [a, b, c] or comma-separated
      val = val.replace(/^\[|\]$/g, '').trim()
      meta.tags = val
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    } else if (key === 'format') {
      const f = val.replace(/^["']|["']$/g, '')
      if (f === 'prompt' || f === 'persona' || f === 'clip' || f === 'recipe') meta.format = f
    } else if (key === 'scope') {
      meta.scope = val.replace(/^["']|["']$/g, '')
    }
  }
  return { meta, body }
}

function buildFrontmatter(s: { format: SkillFormat; tags: string[]; scope: SkillScope }): string {
  const scopeStr = s.scope.kind === 'project' ? `project:${s.scope.projectId}` : s.scope.kind
  const tagsStr = s.tags.length === 0 ? '[]' : `[${s.tags.map((t) => JSON.stringify(t)).join(', ')}]`
  return `---\nformat: ${s.format}\ntags: ${tagsStr}\nscope: ${scopeStr}\n---\n`
}

function inferFormatFromFolder(folder: string): SkillFormat {
  switch (folder) {
    case 'prompts': return 'prompt'
    case 'personas': return 'persona'
    case 'clips': return 'clip'
    case 'recipes': return 'recipe'
    default: return 'prompt'
  }
}

function decodeScope(s: string | undefined): SkillScope {
  if (!s) return { kind: 'manual' }
  if (s === 'always') return { kind: 'always' }
  if (s === 'manual') return { kind: 'manual' }
  if (s.startsWith('project:')) return { kind: 'project', projectId: s.slice('project:'.length) }
  return { kind: 'manual' }
}

async function readSkillFile(folder: string, file: string): Promise<Skill | null> {
  if (!file.endsWith('.md')) return null
  const full = join(root(), folder, file)
  try {
    const raw = await fs.readFile(full, 'utf8')
    const stat = await fs.stat(full)
    const { meta, body } = parseFrontmatter(raw)
    return {
      id: `${folder}/${file}`,
      folder: folder as Skill['folder'],
      name: basename(file, '.md'),
      body,
      format: meta.format ?? inferFormatFromFolder(folder),
      tags: meta.tags ?? [],
      scope: decodeScope(meta.scope),
      updatedAt: stat.mtimeMs
    }
  } catch {
    return null
  }
}

export async function listAllSkills(): Promise<Skill[]> {
  await ensureRoot()
  const out: Skill[] = []
  for (const folder of FOLDERS) {
    let entries: string[] = []
    try { entries = await fs.readdir(join(root(), folder)) } catch { continue }
    for (const e of entries) {
      const s = await readSkillFile(folder, e)
      if (s) out.push(s)
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getApplicableSkills(projectId: string | null): Promise<Skill[]> {
  const all = await listAllSkills()
  return all.filter((s) => {
    if (s.scope.kind === 'always') return true
    if (s.scope.kind === 'project' && projectId && s.scope.projectId === projectId) return true
    return false
  })
}

const SKILLS_HEADING = '## Skills'

function replaceOrAppendSection(content: string, heading: string, block: string): string {
  const lines = content.split('\n')
  // Find ALL occurrences of the heading (in case duplicates exist) and remove them.
  const ranges: Array<[number, number]> = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === heading) {
      let end = lines.length
      for (let j = i + 1; j < lines.length; j++) {
        if (/^## /.test(lines[j])) { end = j; break }
      }
      ranges.push([i, end])
      i = end - 1
    }
  }
  if (ranges.length === 0) {
    return content.trimEnd() + '\n\n' + block.trimEnd() + '\n'
  }
  // Remove all existing sections (back-to-front so indices stay valid).
  for (const [start, end] of [...ranges].reverse()) {
    lines.splice(start, end - start)
  }
  // Insert the new block at the position of the FIRST removed section.
  const insertAt = ranges[0][0]
  const blockLines = block.trimEnd().split('\n')
  // Ensure a blank line before the block if needed.
  if (insertAt > 0 && lines[insertAt - 1] && lines[insertAt - 1].trim() !== '') {
    blockLines.unshift('')
  }
  lines.splice(insertAt, 0, ...blockLines, '')
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

async function syncSkillsToBrain(): Promise<void> {
  try {
    const all = await listAllSkills()
    let block: string
    if (all.length === 0) {
      block = `${SKILLS_HEADING}\n_No skills yet: create them in the Skills tab._\n`
    } else {
      const byScope = new Map<string, Skill[]>()
      for (const s of all) {
        const k = s.scope.kind === 'project' ? `Project · ${s.scope.projectId}` : s.scope.kind === 'always' ? 'Always' : 'Manual'
        if (!byScope.has(k)) byScope.set(k, [])
        byScope.get(k)!.push(s)
      }
      const sections: string[] = []
      for (const [scope, items] of byScope) {
        sections.push(`**${scope}**`)
        for (const s of items) {
          const tagStr = s.tags.length > 0 ? ` _#${s.tags.join(' #')}_` : ''
          sections.push(`- ${s.name} _(${s.format})_${tagStr}`)
        }
      }
      block =
        `${SKILLS_HEADING}\n_Auto-mirrored from your Skills library: edit there, not here._\n` +
        sections.join('\n') +
        '\n'
    }
    const cur = await readMemory()
    const next = replaceOrAppendSection(cur, SKILLS_HEADING, block)
    if (next !== cur) await writeMemory(next)
  } catch {
    // best-effort
  }
}

type SaveArgs = {
  oldId?: string                 // existing id to replace (folder/file.md)
  folder?: Skill['folder']       // default 'lib'
  name: string
  body: string
  format: SkillFormat
  tags: string[]
  scope: SkillScope
}

async function saveSkill(args: SaveArgs): Promise<Skill> {
  await ensureRoot()
  const folder: Skill['folder'] = args.folder ?? 'lib'
  const file = `${safeName(args.name) || 'untitled'}.md`
  const full = join(root(), folder, file)
  const fm = buildFrontmatter({ format: args.format, tags: args.tags, scope: args.scope })
  await fs.writeFile(full, fm + args.body, 'utf8')
  if (args.oldId && args.oldId !== `${folder}/${file}`) {
    const [oldFolder, oldFile] = args.oldId.split('/')
    if (oldFolder && oldFile) {
      try { await fs.unlink(join(root(), oldFolder, oldFile)) } catch {}
    }
  }
  const stat = await fs.stat(full)
  void syncSkillsToBrain()
  return {
    id: `${folder}/${file}`,
    folder,
    name: args.name,
    body: args.body,
    format: args.format,
    tags: args.tags,
    scope: args.scope,
    updatedAt: stat.mtimeMs
  }
}

async function removeSkill(id: string): Promise<void> {
  const [folder, file] = id.split('/')
  if (!folder || !file) return
  try { await fs.unlink(join(root(), folder, file)) } catch {}
  void syncSkillsToBrain()
}

// ============ PROPOSED SKILLS ============

export type ProposedSkill = {
  id: string
  name: string
  body: string
  format: SkillFormat
  tags: string[]
  reason: string
  evidence: string
  createdAt: number
}

const PROPOSED_DIR = 'proposed'

async function ensureProposedRoot(): Promise<void> {
  await fs.mkdir(join(root(), PROPOSED_DIR), { recursive: true })
}

function proposedFile(name: string): string {
  return join(root(), PROPOSED_DIR, `${safeName(name) || 'untitled'}.md`)
}

function buildProposedFrontmatter(p: { format: SkillFormat; tags: string[]; reason: string; evidence: string }): string {
  const tagsStr = p.tags.length === 0 ? '[]' : `[${p.tags.map((t) => JSON.stringify(t)).join(', ')}]`
  // Evidence may contain newlines; encode as JSON string so the parser stays simple.
  return `---\nformat: ${p.format}\ntags: ${tagsStr}\nreason: ${JSON.stringify(p.reason)}\nevidence: ${JSON.stringify(p.evidence)}\n---\n`
}

function parseProposedFrontmatter(raw: string): { meta: { format?: SkillFormat; tags?: string[]; reason?: string; evidence?: string }; body: string } {
  const m = raw.match(FRONTMATTER_RE)
  if (!m) return { meta: {}, body: raw }
  const fmText = m[1]
  const body = m[2]
  const meta: { format?: SkillFormat; tags?: string[]; reason?: string; evidence?: string } = {}
  for (const line of fmText.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const val = line.slice(idx + 1).trim()
    if (key === 'tags') {
      const inner = val.replace(/^\[|\]$/g, '').trim()
      meta.tags = inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    } else if (key === 'format') {
      const f = val.replace(/^["']|["']$/g, '')
      if (f === 'prompt' || f === 'persona' || f === 'clip' || f === 'recipe') meta.format = f
    } else if (key === 'reason' || key === 'evidence') {
      try { meta[key] = JSON.parse(val) } catch { meta[key] = val }
    }
  }
  return { meta, body }
}

export async function listProposed(): Promise<ProposedSkill[]> {
  await ensureProposedRoot()
  let entries: string[] = []
  try { entries = await fs.readdir(join(root(), PROPOSED_DIR)) } catch { return [] }
  const out: ProposedSkill[] = []
  for (const e of entries) {
    if (!e.endsWith('.md')) continue
    try {
      const raw = await fs.readFile(join(root(), PROPOSED_DIR, e), 'utf8')
      const stat = await fs.stat(join(root(), PROPOSED_DIR, e))
      const { meta, body } = parseProposedFrontmatter(raw)
      out.push({
        id: `${PROPOSED_DIR}/${e}`,
        name: basename(e, '.md'),
        body: body.trim(),
        format: meta.format ?? 'prompt',
        tags: meta.tags ?? [],
        reason: meta.reason ?? '',
        evidence: meta.evidence ?? '',
        createdAt: stat.mtimeMs
      })
    } catch {}
  }
  return out.sort((a, b) => b.createdAt - a.createdAt)
}

async function discardProposed(id: string): Promise<void> {
  const [folder, file] = id.split('/')
  if (folder !== PROPOSED_DIR || !file) return
  try { await fs.unlink(join(root(), folder, file)) } catch {}
}

async function acceptProposed(id: string, targetFolder: Skill['folder']): Promise<void> {
  const [folder, file] = id.split('/')
  if (folder !== PROPOSED_DIR || !file) return
  const raw = await fs.readFile(join(root(), folder, file), 'utf8')
  const { meta, body } = parseProposedFrontmatter(raw)
  const name = basename(file, '.md')
  await saveSkill({
    folder: targetFolder,
    name,
    body: body.trim(),
    format: meta.format ?? 'prompt',
    tags: meta.tags ?? [],
    scope: { kind: 'always' }
  })
  await discardProposed(id)
}

function notifyProposalsChanged(getWindow: () => BrowserWindow | null): void {
  const w = getWindow()
  if (w && !w.isDestroyed()) {
    try { w.webContents.send('skills:proposals-changed') } catch {}
  }
}

function tryParseJsonArray(text: string): unknown[] | null {
  // Find first [ ... last ] in case copilot wrapped its reply in prose.
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) return null
  const slice = text.slice(start, end + 1)
  try {
    const v = JSON.parse(slice)
    return Array.isArray(v) ? v : null
  } catch {
    return null
  }
}

const PROPOSE_PROMPT = `You are reviewing the user's recent terminal activity, their saved Skills library, and their personal knowledge file (Brain).

Your task: identify NEW reusable skills the user has demonstrated but has NOT yet captured as a Skill card. A "skill" here means a concrete, repeatable capability or pattern they applied (a useful prompt they reuse, a persona they've adopted, a code snippet they've used in 2+ contexts, or a multi-step recipe).

Output ONLY a JSON array (no prose, no code fences). Each entry has these exact fields:
- "name": short kebab-case-safe title (max 60 chars)
- "format": one of "prompt" | "persona" | "clip" | "recipe"
- "body": the actual reusable content (a prompt template, persona description, code snippet, or recipe steps). 1-30 lines.
- "tags": 1-4 short lowercase tags
- "reason": one sentence on why you think this is a real skill of theirs
- "evidence": short verbatim snippet from the activity that triggered this proposal (max 200 chars)

Rules:
- Output 0-5 items. If nothing new, output [].
- Only propose skills the user has clearly USED, not skills they merely mentioned.
- Skip anything that overlaps with an existing Skill in their library (check the inventory).
- No secrets, credentials, file paths under /Users, or org-internal data.
- Skills must be reusable across projects, not project-specific glue.

EVIDENCE:
__EVIDENCE__`

async function runProposalScan(getWindow: () => BrowserWindow | null): Promise<{ ok: boolean; added: number; error?: string }> {
  try {
    const evidence = await gatherEvidence()
    const settings = getSettings()
    const model = settings.defaultModel
    const prompt = PROPOSE_PROMPT.replace('__EVIDENCE__', evidence)

    const args = ['-p', prompt, '--allow-all-tools', '--no-color', '--model', model]
    const child = spawn('copilot', args, {
      cwd: app.getPath('home'),
      env: { ...process.env, NO_COLOR: '1', TERM: 'dumb' },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let out = ''
    let err = ''
    child.stdout.on('data', (d) => { out += d.toString() })
    child.stderr.on('data', (d) => { err += d.toString() })

    const exitCode: number = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        try { child.kill('SIGTERM') } catch {}
        resolve(124)
      }, 4 * 60 * 1000)
      child.on('exit', (code) => { clearTimeout(timer); resolve(code ?? 0) })
      child.on('error', () => { clearTimeout(timer); resolve(1) })
    })

    if (exitCode !== 0) {
      return { ok: false, added: 0, error: `copilot exited ${exitCode}: ${err.trim().slice(0, 300) || out.trim().slice(0, 300)}` }
    }

    const arr = tryParseJsonArray(stripAnsi(out))
    if (!arr || arr.length === 0) return { ok: true, added: 0 }

    await ensureProposedRoot()
    const existingProposed = new Set((await listProposed()).map((p) => p.name.toLowerCase()))
    const existingSkills = new Set((await listAllSkills()).map((s) => s.name.toLowerCase()))

    let added = 0
    for (const raw of arr.slice(0, 5)) {
      if (typeof raw !== 'object' || raw === null) continue
      const r = raw as Record<string, unknown>
      const name = String(r.name ?? '').trim()
      if (!name) continue
      const key = name.toLowerCase()
      if (existingProposed.has(key) || existingSkills.has(key)) continue

      const fmt = String(r.format ?? 'prompt')
      const format: SkillFormat = (fmt === 'prompt' || fmt === 'persona' || fmt === 'clip' || fmt === 'recipe') ? fmt : 'prompt'
      const body = String(r.body ?? '').trim()
      if (!body) continue
      const tags = Array.isArray(r.tags) ? r.tags.map((t) => String(t)).filter(Boolean).slice(0, 4) : []
      const reason = String(r.reason ?? '').trim().slice(0, 240)
      const evidenceSnippet = String(r.evidence ?? '').trim().slice(0, 240)

      const fm = buildProposedFrontmatter({ format, tags, reason, evidence: evidenceSnippet })
      await fs.writeFile(proposedFile(name), fm + body, 'utf8')
      added++
    }

    if (added > 0) notifyProposalsChanged(getWindow)
    return { ok: true, added }
  } catch (e) {
    return { ok: false, added: 0, error: e instanceof Error ? e.message : String(e) }
  }
}

export function registerSkillsIpc(getWindow?: () => BrowserWindow | null): void {
  const wnd = getWindow ?? (() => null)

  ipcMain.handle('skills:list-all', async () => listAllSkills())

  ipcMain.handle('skills:save', async (_e, args: SaveArgs) => saveSkill(args))

  ipcMain.handle('skills:remove', async (_e, args: { id: string }) => {
    await removeSkill(args.id)
    return { ok: true }
  })

  ipcMain.handle('skills:applicable', async (_e, args: { projectId: string | null }) =>
    getApplicableSkills(args.projectId)
  )

  ipcMain.handle('skills:root', async () => {
    await ensureRoot()
    return root()
  })

  ipcMain.handle('skills:list-proposed', async () => listProposed())

  ipcMain.handle('skills:accept-proposed', async (_e, args: { id: string; folder: Skill['folder'] }) => {
    await acceptProposed(args.id, args.folder)
    notifyProposalsChanged(wnd)
    return { ok: true }
  })

  ipcMain.handle('skills:discard-proposed', async (_e, args: { id: string }) => {
    await discardProposed(args.id)
    notifyProposalsChanged(wnd)
    return { ok: true }
  })

  ipcMain.handle('skills:propose-now', async () => runProposalScan(wnd))

  // Hook into insights cadence so proposals refresh when insights run.
  onInsightsRunComplete(async () => {
    await runProposalScan(wnd)
  })

  // Initial sync (runs once at startup so the Brain is up-to-date)
  void syncSkillsToBrain()
}
