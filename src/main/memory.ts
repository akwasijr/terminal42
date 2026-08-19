import { ipcMain, app, shell, BrowserWindow } from 'electron'
import { promises as fs, watch as fsWatch, type FSWatcher } from 'fs'
import { join } from 'path'
import { getDb } from './db'
import { indexMemoryMarkdown, recallMemory, type MemoryRecallOptions, type MemoryRecallResult } from './memoryRecall'

export type PersonaId = string

export type Persona = {
  id: PersonaId
  label: string
  description: string
  builtIn: boolean
}

const PERSONAS: Persona[] = [
  { id: 'me',         label: 'Me',         description: 'Your private personal Brain',                builtIn: true },
  { id: 'designer',   label: 'Designer',   description: 'Visual taste, design system, UX patterns',   builtIn: true },
  { id: 'engineer',   label: 'Engineer',   description: 'Stack, conventions, architecture decisions', builtIn: true },
  { id: 'pm',         label: 'PM',         description: 'Roadmaps, priorities, stakeholders',         builtIn: true },
  { id: 'researcher', label: 'Researcher', description: 'Sources, findings, evidence, references',    builtIn: true }
]

const SEEDS: Record<PersonaId, string> = {
  me: `# My Brain

A living markdown file. Edit it directly, capture insights from your terminal sessions, or let Copilot update it for you.

## How I work
- 

## What I'm working on
- 

## Things I'm learning
- 

## People & projects
- 

## Captured from sessions
- 
`,
  designer: `# Designer Brain

Visual taste, design system, and UX preferences I want every project to follow.

## Visual taste
- 

## Design system rules
- 

## Components I reach for
- 

## Anti-patterns to avoid
- 

## Captured from sessions
- 
`,
  engineer: `# Engineer Brain

Tech stack, code conventions, and architectural defaults.

## Preferred stack
- 

## Code conventions
- 

## Patterns I follow
- 

## Things to avoid
- 

## Captured from sessions
- 
`,
  pm: `# PM Brain

Roadmap thinking, priorities, and stakeholder context.

## Current priorities
- 

## North-star metrics
- 

## Stakeholders & teams
- 

## Decisions log
- 

## Captured from sessions
- 
`,
  researcher: `# Researcher Brain

Sources, findings, references, and methods.

## Open questions
- 

## Key sources
- 

## Findings
- 

## Methods I trust
- 

## Captured from sessions
- 
`
}

const ACTIVE_KEY = 'personas:activeId'

function getActivePersonaId(): PersonaId {
  try {
    const r = getDb().prepare('SELECT value FROM settings_kv WHERE key = ?').get(ACTIVE_KEY) as { value: string } | undefined
    if (r && PERSONAS.some((p) => p.id === r.value)) return r.value
  } catch {}
  return 'me'
}

function setActivePersonaId(id: PersonaId): void {
  if (!PERSONAS.some((p) => p.id === id)) return
  try {
    getDb().prepare(
      'INSERT INTO settings_kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(ACTIVE_KEY, id)
  } catch {}
}

function personaDir(id: PersonaId): string {
  return join(app.getPath('userData'), 'personas', id)
}

function personaMemoryPath(id: PersonaId): string {
  return join(personaDir(id), 'memory.md')
}

function legacyMemoryPath(): string {
  return join(app.getPath('userData'), 'memory.md')
}

function memoryPath(): string {
  return personaMemoryPath(getActivePersonaId())
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

async function ensureExists(): Promise<void> {
  const id = getActivePersonaId()
  const p = personaMemoryPath(id)
  if (await fileExists(p)) return

  await fs.mkdir(personaDir(id), { recursive: true })

  // Migrate legacy memory.md → personas/me/memory.md on first 'me' read
  if (id === 'me' && await fileExists(legacyMemoryPath())) {
    try {
      const body = await fs.readFile(legacyMemoryPath(), 'utf8')
      await fs.writeFile(p, body, 'utf8')
      indexQuietly(id, body)
      // Leave legacy file in place for safety; future writes go to persona path
      return
    } catch {}
  }

  const seed = SEEDS[id] ?? SEEDS.me
  await fs.writeFile(p, seed, 'utf8')
  indexQuietly(id, seed)
}

// Indexing is an enhancement on top of the Brain file. The file is always
// written first, so a failure here must never surface as a failed save.
function indexQuietly(personaId: string, body: string): void {
  try {
    indexMemoryMarkdown(personaId, body)
  } catch {}
}

export async function readMemory(): Promise<string> {
  await ensureExists()
  return fs.readFile(memoryPath(), 'utf8')
}

export async function writeMemory(body: string): Promise<void> {
  await ensureExists()
  await fs.writeFile(memoryPath(), body, 'utf8')
  indexQuietly(getActivePersonaId(), body)
}

/**
 * Indexes every persona's Brain on startup.
 *
 * The recall index was only ever written on save, so Brain content that
 * predates the index simply was not in it: recall returned nothing and the
 * whole feature looked broken while appearing wired up. Indexing is a diff
 * against stored content hashes, so re-running it each launch is cheap and
 * also self-heals an index deleted or corrupted out from under us.
 */
export async function backfillMemoryIndex(): Promise<void> {
  for (const persona of PERSONAS) {
    try {
      const body = await fs.readFile(personaMemoryPath(persona.id), 'utf8')
      if (body.trim()) indexQuietly(persona.id, body)
    } catch {
      // A persona with no Brain file yet is normal, not an error.
    }
  }
}

export function recallBrain(query: string, options: MemoryRecallOptions = {}): MemoryRecallResult[] {
  if (!query.trim()) return []
  return recallMemory(query, options)
}

function parseRecallArgs(args: unknown): ({ query: string } & MemoryRecallOptions) | null {
  if (!args || typeof args !== 'object') return null
  const candidate = args as { query?: unknown; limit?: unknown; minScore?: unknown; personaIds?: unknown }
  if (typeof candidate.query !== 'string') return null
  return {
    query: candidate.query,
    limit: typeof candidate.limit === 'number' ? candidate.limit : undefined,
    minScore: typeof candidate.minScore === 'number' ? candidate.minScore : undefined,
    personaIds: Array.isArray(candidate.personaIds)
      ? candidate.personaIds.filter((id): id is string => typeof id === 'string')
      : undefined
  }
}

export async function captureToMemory(text: string, source?: string): Promise<void> {
  if (!text || !text.trim()) return
  const cur = await readMemory()
  const stamp = new Date().toLocaleString()
  const trimmed = text.trim().replace(/\s+/g, ' ')
  const sourceTag = source ? ` _(${source})_` : ''
  const entry = `- ${trimmed}${sourceTag}: _${stamp}_`
  const HEADING = '## Captured from sessions'
  const idx = cur.indexOf(HEADING)
  let next: string
  if (idx === -1) {
    next = cur.trimEnd() + `\n\n${HEADING}\n${entry}\n`
  } else {
    const headingEnd = cur.indexOf('\n', idx) + 1
    next = cur.slice(0, headingEnd) + entry + '\n' + cur.slice(headingEnd)
  }
  await writeMemory(next)
}

let watcher: FSWatcher | null = null
let watchTimer: ReturnType<typeof setTimeout> | null = null
let getWindowRef: (() => BrowserWindow | null) | null = null

function notifyChanged(channel: string): void {
  const w = getWindowRef?.()
  if (w && !w.isDestroyed()) {
    try { w.webContents.send(channel) } catch {}
  }
}

function startWatching(): void {
  try { watcher?.close() } catch {}
  watcher = null
  void ensureExists().then(() => {
    try {
      watcher = fsWatch(memoryPath(), { persistent: false }, () => {
        if (watchTimer) clearTimeout(watchTimer)
        watchTimer = setTimeout(() => {
          void fs.readFile(memoryPath(), 'utf8')
            .then((body) => indexQuietly(getActivePersonaId(), body))
            .catch(() => {})
            .finally(() => notifyChanged('memory:changed'))
        }, 150)
      })
    } catch {}
  })
}

export function stopMemoryWatcher(): void {
  try { watcher?.close() } catch {}
  watcher = null
  if (watchTimer) { clearTimeout(watchTimer); watchTimer = null }
}

export function registerMemoryIpc(getWindow: () => BrowserWindow | null): void {
  getWindowRef = getWindow

  ipcMain.handle('memory:read', () => readMemory())
  ipcMain.handle('memory:write', (_e, body: string) => writeMemory(body))
  ipcMain.handle('memory:capture', (_e, args: { text: string; source?: string }) =>
    captureToMemory(args.text, args.source)
  )
  ipcMain.handle('memory:recall', (_e, args: unknown) => {
    const parsed = parseRecallArgs(args)
    return parsed ? recallBrain(parsed.query, parsed) : []
  })
  ipcMain.handle('memory:reveal', async () => {
    await ensureExists()
    shell.showItemInFolder(memoryPath())
  })
  ipcMain.handle('memory:path', () => memoryPath())

  ipcMain.handle('personas:list', () => PERSONAS)
  ipcMain.handle('personas:active', () => getActivePersonaId())
  ipcMain.handle('personas:set-active', async (_e, id: PersonaId) => {
    if (!PERSONAS.some((p) => p.id === id)) return { ok: false }
    setActivePersonaId(id)
    await ensureExists()
    startWatching()
    notifyChanged('memory:changed')
    notifyChanged('personas:changed')
    return { ok: true }
  })

  startWatching()
}
