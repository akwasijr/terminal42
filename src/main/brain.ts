import { ipcMain, app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'

type Layer = 'global' | 'project' | 'session'

const TOGGLE_BEGIN = '<!-- t42-toggles:begin -->'
const TOGGLE_END = '<!-- t42-toggles:end -->'

export type BrainCategory = {
  id: string
  label: string
  rules: { id: string; label: string }[]
}

export const BRAIN_CATEGORIES: BrainCategory[] = [
  {
    id: 'design',
    label: 'Design',
    rules: [
      { id: 'no-gradients', label: 'No gradients' },
      { id: 'no-all-caps', label: 'No ALL CAPS' },
      { id: 'sentence-case', label: 'Sentence case headings' },
      { id: 'one-accent', label: 'One accent color, neutrals everywhere else' },
      { id: 'outlined-toasts', label: 'Outlined toasts, never filled' },
      { id: 'subtle-shadows', label: 'Subtle shadows only, no heavy drop shadows' }
    ]
  },
  {
    id: 'code',
    label: 'Code',
    rules: [
      { id: 'ts-strict', label: 'TypeScript strict mode' },
      { id: 'no-any', label: 'No `any` in TypeScript' },
      { id: 'small-functions', label: 'Small focused functions' },
      { id: 'tests-first', label: 'Tests before implementation' }
    ]
  },
  {
    id: 'communication',
    label: 'Communication',
    rules: [
      { id: 'concise', label: 'Concise replies' },
      { id: 'no-emoji', label: 'No emoji in UI or replies' },
      { id: 'explain-first', label: 'Explain the plan before coding' }
    ]
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    rules: [
      { id: 'wcag-aa', label: 'WCAG AA contrast minimum' },
      { id: 'focus-rings', label: 'Visible focus rings on all interactive elements' },
      { id: 'reduced-motion', label: 'Respect prefers-reduced-motion' }
    ]
  },
  {
    id: 'tooling',
    label: 'Tooling',
    rules: [
      { id: 'prefer-pnpm', label: 'Prefer pnpm over npm' },
      { id: 'use-vite', label: 'Use Vite for new web projects' }
    ]
  }
]

function brainDir(): string {
  return join(app.getPath('userData'), 'brain')
}

function fileFor(layer: Layer, projectId?: string | null, sessionId?: string | null): string {
  if (layer === 'global') return join(brainDir(), 'global.md')
  if (layer === 'project') return join(brainDir(), 'projects', `${projectId || 'unknown'}.md`)
  return join(brainDir(), 'sessions', `${sessionId || 'unknown'}.md`)
}

async function readFile(path: string): Promise<string> {
  try {
    return await fs.readFile(path, 'utf8')
  } catch {
    return ''
  }
}

async function writeFileSafe(path: string, body: string): Promise<void> {
  await fs.mkdir(join(path, '..'), { recursive: true })
  await fs.writeFile(path, body, 'utf8')
}

function buildToggleBlock(activeRuleIds: string[]): string {
  if (activeRuleIds.length === 0) return ''
  const set = new Set(activeRuleIds)
  const lines: string[] = []
  for (const cat of BRAIN_CATEGORIES) {
    const active = cat.rules.filter((r) => set.has(r.id))
    if (active.length === 0) continue
    lines.push(`### ${cat.label}`)
    for (const r of active) lines.push(`- ${r.label}`)
    lines.push('')
  }
  return `${TOGGLE_BEGIN}\n${lines.join('\n').trim()}\n${TOGGLE_END}`
}

function splitToggles(body: string): { toggles: string; freeform: string } {
  const begin = body.indexOf(TOGGLE_BEGIN)
  const end = body.indexOf(TOGGLE_END)
  if (begin === -1 || end === -1 || end < begin) return { toggles: '', freeform: body.trim() }
  const toggles = body.slice(begin, end + TOGGLE_END.length)
  const freeform = (body.slice(0, begin) + body.slice(end + TOGGLE_END.length)).trim()
  return { toggles, freeform }
}

function extractActiveRuleIds(toggles: string): string[] {
  if (!toggles) return []
  const labelToId = new Map<string, string>()
  for (const c of BRAIN_CATEGORIES) for (const r of c.rules) labelToId.set(r.label, r.id)
  const ids: string[] = []
  for (const line of toggles.split('\n')) {
    const m = line.match(/^-\s+(.+?)\s*$/)
    if (m) {
      const id = labelToId.get(m[1].trim())
      if (id) ids.push(id)
    }
  }
  return ids
}

export type BrainLayer = {
  layer: Layer
  activeRuleIds: string[]
  freeform: string
}

export async function readLayer(
  layer: Layer,
  projectId?: string | null,
  sessionId?: string | null
): Promise<BrainLayer> {
  const body = await readFile(fileFor(layer, projectId, sessionId))
  const split = splitToggles(body)
  return { layer, activeRuleIds: extractActiveRuleIds(split.toggles), freeform: split.freeform }
}

async function writeLayer(
  layer: Layer,
  projectId: string | null,
  sessionId: string | null,
  data: { activeRuleIds: string[]; freeform: string }
): Promise<void> {
  const block = buildToggleBlock(data.activeRuleIds)
  const body = [data.freeform.trim(), block].filter(Boolean).join('\n\n').trim() + '\n'
  await writeFileSafe(fileFor(layer, projectId, sessionId), body)
}

export async function mergedBrain(
  projectId: string | null,
  sessionId: string | null
): Promise<{ ruleIds: string[]; markdown: string; ruleCount: number }> {
  const g = await readLayer('global')
  const p = projectId ? await readLayer('project', projectId) : { activeRuleIds: [], freeform: '' }
  const s = sessionId ? await readLayer('session', null, sessionId) : { activeRuleIds: [], freeform: '' }
  const ruleIds = Array.from(new Set([...g.activeRuleIds, ...p.activeRuleIds, ...s.activeRuleIds]))
  const sections: string[] = []
  if (ruleIds.length > 0) sections.push(buildToggleBlock(ruleIds).replaceAll(TOGGLE_BEGIN, '').replaceAll(TOGGLE_END, '').trim())
  if (g.freeform) sections.push(`## Global notes\n${g.freeform}`)
  if (p.freeform) sections.push(`## Project notes\n${p.freeform}`)
  if (s.freeform) sections.push(`## Session notes\n${s.freeform}`)
  const markdown = sections.join('\n\n').trim()
  return { ruleIds, markdown, ruleCount: ruleIds.length }
}

export function flattenForPrompt(markdown: string): string {
  if (!markdown) return ''
  const lines = markdown.split('\n').map((l) => l.trim()).filter(Boolean)
  const rules: string[] = []
  let currentSection = ''
  for (const line of lines) {
    if (line.startsWith('### ')) {
      currentSection = line.slice(4).trim()
    } else if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim()
    } else if (line.startsWith('- ')) {
      const item = line.slice(2).trim()
      rules.push(currentSection ? `${currentSection}: ${item}` : item)
    } else if (line && !line.startsWith('#') && !line.startsWith('<!--')) {
      rules.push(line)
    }
  }
  return rules.join('; ')
}

export function registerBrainIpc(): void {
  ipcMain.handle('brain:read', async (_e, args: { layer: Layer; projectId?: string | null; sessionId?: string | null }) => {
    return readLayer(args.layer, args.projectId, args.sessionId)
  })

  ipcMain.handle(
    'brain:write',
    async (
      _e,
      args: { layer: Layer; projectId: string | null; sessionId: string | null; activeRuleIds: string[]; freeform: string }
    ) => {
      await writeLayer(args.layer, args.projectId, args.sessionId, {
        activeRuleIds: args.activeRuleIds,
        freeform: args.freeform
      })
      return { ok: true }
    }
  )

  ipcMain.handle('brain:merged', async (_e, args: { projectId: string | null; sessionId: string | null }) => {
    const m = await mergedBrain(args.projectId, args.sessionId)
    return { ...m, flat: flattenForPrompt(m.markdown) }
  })

  ipcMain.handle('brain:categories', () => BRAIN_CATEGORIES)
}
