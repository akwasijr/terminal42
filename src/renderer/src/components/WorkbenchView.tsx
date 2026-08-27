import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Skill, SkillFormat, SkillScope, RecipeSchedule, Recipe } from '../../../preload/index'
import { CATEGORIES, categorize, type Category } from './categorize'
import { STARTER_PACK, type StarterSkill } from './starterPack'
import {
  IconPlus, IconClose, IconTerminal, IconChat, IconUser, IconCode, IconWorkflow,
  IconSearch, IconTrash, IconClock, IconPlay, IconRefresh
} from './icons'

type FilterKind = 'all' | 'skill' | 'recipe' | 'starter'
type Entry =
  | { kind: 'installed'; id: string; name: string; format: SkillFormat; body: string; skill: Skill }
  | { kind: 'starter'; id: string; name: string; format: SkillFormat; body: string; starter: StarterSkill }

const SKILL_FORMATS: SkillFormat[] = ['prompt', 'persona', 'clip']
const FORMAT_LABEL: Record<SkillFormat, string> = {
  prompt: 'Prompt', persona: 'Persona', clip: 'Code clip', recipe: 'Recipe'
}
const FORMAT_ICON: Record<SkillFormat, typeof IconChat> = {
  prompt: IconChat, persona: IconUser, clip: IconCode, recipe: IconWorkflow
}
const FORMAT_TINT: Record<SkillFormat, string> = {
  prompt: 'text-accent', persona: 'text-violet-400', clip: 'text-emerald-400', recipe: 'text-amber-400'
}

type Project = { id: string; name: string }


function starterMode(s: StarterSkill): Category {
  const map: Record<string, Category> = {
    'ux-design': 'UX design',
    'ux-research': 'UX research',
    product: 'Product',
    dev: 'Dev',
    productivity: 'Productivity',
    docs: 'Docs & comms',
    misc: 'Misc'
  }
  return map[s.domain] ?? 'Misc'
}

function extractVariables(body: string): string[] {
  const set = new Set<string>()
  const re = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) set.add(m[1])
  return Array.from(set)
}

export function WorkbenchView({
  activeSessionId, onJumpToTerminal, activeProjectId
}: {
  activeSessionId?: string | null
  onJumpToTerminal?: () => void
  activeProjectId?: string | null
}) {
  const [items, setItems] = useState<Skill[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [schedules, setSchedules] = useState<RecipeSchedule[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [editing, setEditing] = useState<Skill | 'new' | null>(null)
  const [creatingType, setCreatingType] = useState<'skill' | 'recipe'>('skill')
  const [filter, setFilter] = useState<FilterKind>('all')
  const [query, setQuery] = useState('')
  const [running, setRunning] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [scheduleFor, setScheduleFor] = useState<Skill | null>(null)
  const [previewStarter, setPreviewStarter] = useState<StarterSkill | null>(null)
  const [installing, setInstalling] = useState(false)

  const installStarter = async (s: StarterSkill, opts?: { thenInsert?: boolean; bodyOverride?: string }): Promise<Skill | null> => {
    setInstalling(true)
    try {
      const folder: Skill['folder'] = s.format === 'recipe' ? 'recipes'
        : s.format === 'persona' ? 'personas'
        : s.format === 'clip' ? 'clips'
        : 'prompts'
      const scope: SkillScope = s.scope === 'always' ? { kind: 'always' } : { kind: 'manual' }
      const saved = await window.terminal42.skills.save({
        folder,
        name: s.name,
        body: opts?.bodyOverride ?? s.body,
        format: s.format,
        tags: s.tags,
        scope
      })
      await refresh()
      setToast(`Installed “${s.name}”`)
      if (opts?.thenInsert) {
        if (saved.format !== 'recipe' && activeSessionId) {
          await window.terminal42.pty.write(activeSessionId, saved.body + '\r')
          onJumpToTerminal?.()
        }
      }
      return saved
    } finally {
      setInstalling(false)
    }
  }

  const refresh = async (): Promise<void> => {
    const [s, r, sc] = await Promise.all([
      window.terminal42.skills.listAll(),
      window.terminal42.recipes.list(),
      window.terminal42.recipes.schedules.list()
    ])
    setItems(s)
    setRecipes(r)
    setSchedules(sc)
  }

  useEffect(() => {
    void refresh()
    void window.terminal42.projects.list().then((ps) => setProjects(ps as Project[]))
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const schedulesByRecipe = useMemo(() => {
    const m: Record<string, RecipeSchedule[]> = {}
    for (const s of schedules) (m[s.recipe_id] ||= []).push(s)
    return m
  }, [schedules])

  const recipeIdByName = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of recipes) m.set(r.name, r.id)
    return m
  }, [recipes])

  const installedNames = useMemo(() => new Set(items.map((s) => s.name.toLowerCase())), [items])

  const allEntries = useMemo<Entry[]>(() => {
    const installed: Entry[] = items.map((s) => ({
      kind: 'installed', id: s.id, name: s.name, format: s.format, body: s.body, skill: s
    }))
    const starters: Entry[] = STARTER_PACK
      .filter((s) => !installedNames.has(s.name.toLowerCase()))
      .map((s) => ({
        kind: 'starter', id: `starter:${s.name}`, name: s.name, format: s.format, body: s.body, starter: s
      }))
    return [...installed, ...starters]
  }, [items, installedNames])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allEntries.filter((e) => {
      const isRecipe = e.format === 'recipe'
      if (filter === 'skill' && isRecipe) return false
      if (filter === 'recipe' && !isRecipe) return false
      if (filter === 'starter' && e.kind !== 'starter') return false
      if (q && !e.name.toLowerCase().includes(q) && !e.body.toLowerCase().includes(q)) return false
      return true
    })
  }, [allEntries, filter, query])

  const grouped = useMemo(() => {
    const m = new Map<Category, Entry[]>()
    for (const c of CATEGORIES) m.set(c, [])
    for (const e of filtered) {
      const cat = e.kind === 'installed' ? categorize(e.name, e.body) : starterMode(e.starter)
      m.get(cat)!.push(e)
    }
    return Array.from(m.entries()).filter(([, v]) => v.length > 0)
  }, [filtered])

  const counts = useMemo(() => {
    let skill = 0, recipe = 0, starter = 0
    for (const e of allEntries) {
      if (e.format === 'recipe') recipe++; else skill++
      if (e.kind === 'starter') starter++
    }
    return { all: allEntries.length, skill, recipe, starter }
  }, [allEntries])

  const newOne = (kind: 'skill' | 'recipe'): void => {
    setCreatingType(kind)
    setEditing('new')
  }

  const insertOrRun = async (s: Skill): Promise<void> => {
    if (s.format === 'recipe') {
      const recipeId = recipeIdByName.get(s.name)
      if (!recipeId) { setToast('Recipe file not found'); return }
      setRunning(s.id)
      const r = await window.terminal42.recipes.run(recipeId)
      setRunning(null)
      setToast(r.ok ? `Ran “${s.name}”` : 'Recipe failed')
      return
    }
    if (!activeSessionId) { setToast('Open a terminal session first'); return }
    const vars = extractVariables(s.body)
    if (vars.length > 0) { setEditing(s); return }
    await window.terminal42.pty.write(activeSessionId, s.body + '\r')
    setToast(`Inserted “${s.name}”`)
    onJumpToTerminal?.()
  }

  if (editing) {
    return (
      <Editor
        editing={editing}
        creatingType={creatingType}
        projects={projects}
        activeProjectId={activeProjectId ?? null}
        activeSessionId={activeSessionId ?? null}
        onClose={() => setEditing(null)}
        onSaved={async (s) => { await refresh(); setEditing(s) }}
        onRemoved={async () => { await refresh(); setEditing(null) }}
        onInserted={() => { setToast('Inserted'); onJumpToTerminal?.() }}
        onScheduleClick={(s) => setScheduleFor(s)}
      />
    )
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header className="flex h-[60px] shrink-0 items-center justify-between gap-4 px-6">
        <h1 className="text-[18px] font-semibold leading-tight text-text-primary">Automations</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Refresh"
            className="grid h-7 w-7 place-items-center rounded-sm text-text-secondary hover:text-text-primary"
          >
            <IconRefresh size={13} />
          </button>
          <NewMenu onPick={newOne} />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto flex max-w-[960px] flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-1.5 rounded-md bg-elevated px-2.5 py-1.5 text-[12px]">
              <IconSearch size={11} className="text-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search automations…"
                className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none"
                aria-label="Search"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="text-text-muted hover:text-text-primary">
                  <IconClose size={10} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <FilterChip label="All" count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
              <FilterChip label="Skills" count={counts.skill} active={filter === 'skill'} onClick={() => setFilter('skill')} />
              <FilterChip label="Recipes" count={counts.recipe} active={filter === 'recipe'} onClick={() => setFilter('recipe')} />
              <FilterChip label="Available" count={counts.starter} active={filter === 'starter'} onClick={() => setFilter('starter')} />
            </div>
          </div>

          {grouped.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-text-muted">
              {query ? 'Nothing matches.' : 'Nothing here yet.'}
            </div>
          ) : (
            grouped.map(([cat, entries]) => (
              <section key={cat} className="flex flex-col gap-2">
                <h2 className="text-[12px] font-medium text-text-muted">{cat}</h2>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {entries.map((e) => (
                    <Card
                      key={e.id}
                      entry={e}
                      schedules={e.kind === 'installed'
                        ? (schedulesByRecipe[recipeIdByName.get(e.name) || ''] || [])
                        : []}
                      running={
                        (e.kind === 'installed' && running === e.id) ||
                        (e.kind === 'starter' && installing && previewStarter?.name === e.name)
                      }
                      onOpen={() => {
                        if (e.kind === 'installed') setEditing(e.skill)
                        else setPreviewStarter(e.starter)
                      }}
                      onRun={() => {
                        if (e.kind === 'installed') void insertOrRun(e.skill)
                      }}
                      onSchedule={() => { if (e.kind === 'installed') setScheduleFor(e.skill) }}
                      onInstall={() => {
                        if (e.kind === 'starter') {
                          setPreviewStarter(e.starter)
                          void installStarter(e.starter).then(() => setPreviewStarter(null))
                        }
                      }}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-md bg-text-primary px-3 py-1.5 text-[12px] text-bg shadow">
          {toast}
        </div>
      )}

      {scheduleFor && (
        <ScheduleDialog
          skill={scheduleFor}
          recipeId={recipeIdByName.get(scheduleFor.name) || null}
          existing={schedulesByRecipe[recipeIdByName.get(scheduleFor.name) || ''] || []}
          onClose={() => setScheduleFor(null)}
          onChanged={() => void refresh()}
        />
      )}

      {previewStarter && (
        <StarterPreview
          starter={previewStarter}
          installing={installing}
          canInsert={previewStarter.format !== 'recipe' && !!activeSessionId}
          onClose={() => setPreviewStarter(null)}
          onInstall={async (b) => { await installStarter(previewStarter, { bodyOverride: b }); setPreviewStarter(null) }}
          onInstallAndUse={async (b) => { await installStarter(previewStarter, { thenInsert: true, bodyOverride: b }); setPreviewStarter(null) }}
        />
      )}
    </main>
  )
}

function NewMenu({ onPick }: { onPick: (k: 'skill' | 'recipe') => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md bg-action px-2.5 py-1.5 text-[12px] font-medium text-action-text"
      >
        <IconPlus size={12} /> New
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="t42-menu absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-md bg-raised py-1 shadow-overlay">
            <button
              type="button"
              onClick={() => { onPick('skill'); setOpen(false) }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] hover:bg-bg/50"
            >
              <IconChat size={12} className="text-accent" /> New skill
              <span className="ml-auto text-[10.5px] text-text-muted">Insert</span>
            </button>
            <button
              type="button"
              onClick={() => { onPick('recipe'); setOpen(false) }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] hover:bg-bg/50"
            >
              <IconWorkflow size={12} className="text-amber-400" /> New recipe
              <span className="ml-auto text-[10.5px] text-text-muted">Run / schedule</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function FilterChip({ label, count, active, onClick }: {
  label: string; count: number; active: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-md px-2.5 py-1 text-[12px] transition-colors',
        active ? 'bg-elevated text-text-primary' : 'text-text-muted hover:text-text-secondary'
      ].join(' ')}
    >
      {label} <span className="ml-1 text-[10.5px] tabular-nums opacity-70">{count}</span>
    </button>
  )
}

function Card({
  entry, schedules, running, onOpen, onRun, onSchedule, onInstall
}: {
  entry: Entry
  schedules: RecipeSchedule[]
  running: boolean
  onOpen: () => void
  onRun: () => void
  onSchedule: () => void
  onInstall: () => void
}) {
  const isStarter = entry.kind === 'starter'
  const isRecipe = entry.format === 'recipe'
  const Icon = FORMAT_ICON[entry.format]
  const tint = FORMAT_TINT[entry.format]
  const enabled = schedules.filter((s) => s.enabled).length
  const description = isStarter
    ? entry.starter.description
    : entry.name
  return (
    <div
      className="group relative flex cursor-pointer flex-col gap-2.5 rounded-xl bg-elevated/40 p-4 transition-colors hover:bg-elevated/70"
      onClick={onOpen}
    >
      <Icon size={14} className={['shrink-0', tint].join(' ')} />
      <p className="text-[13px] leading-snug text-text-primary">{description}</p>
      <div
        className="absolute bottom-2.5 right-2.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {!isStarter && isRecipe && (
          <button
            type="button"
            onClick={onSchedule}
            aria-label="Schedule"
            title="Schedule"
            className="grid h-7 w-7 place-items-center rounded-md bg-bg/80 text-text-secondary hover:text-text-primary"
          >
            <IconClock size={11} />
          </button>
        )}
        {isStarter ? (
          <>
            <button
              type="button"
              onClick={onOpen}
              className="rounded-md bg-bg/80 px-2.5 py-1.5 text-[11px] text-text-secondary hover:bg-bg hover:text-text-primary"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={onInstall}
              disabled={running}
              className="flex items-center gap-1 rounded-md bg-action px-2.5 py-1.5 text-[11px] font-medium text-action-text hover:bg-action/90 disabled:opacity-50"
            >
              <IconPlus size={10} />
              {running ? 'Adding…' : 'Add'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onOpen}
              className="rounded-md bg-bg/80 px-2.5 py-1.5 text-[11px] text-text-secondary hover:bg-bg hover:text-text-primary"
            >
              Open
            </button>
            <button
              type="button"
              onClick={onRun}
              disabled={running}
              className="flex items-center gap-1 rounded-md bg-action px-2.5 py-1.5 text-[11px] font-medium text-action-text hover:bg-action/90 disabled:opacity-50"
            >
              {isRecipe ? <IconPlay size={10} /> : <IconTerminal size={10} />}
              {running ? '…' : isRecipe ? 'Run' : 'Insert'}
            </button>
          </>
        )}
      </div>
      {!isStarter && isRecipe && enabled > 0 && (
        <div className="flex items-center gap-1 text-[10.5px] text-text-muted">
          <IconClock size={9} /> Scheduled · {enabled}
        </div>
      )}
    </div>
  )
}

function StarterPreview({
  starter, installing, canInsert, onClose, onInstall, onInstallAndUse
}: {
  starter: StarterSkill
  installing: boolean
  canInsert: boolean
  onClose: () => void
  onInstall: (body: string) => void
  onInstallAndUse: (body: string) => void
}) {
  const Icon = FORMAT_ICON[starter.format]
  const tint = FORMAT_TINT[starter.format]
  const [body, setBody] = useState(starter.body)
  const dirty = body !== starter.body
  const reset = () => setBody(starter.body)
  return (
    <div
      className="t42-scrim fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={starter.name}
        className="flex h-[78vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-raised/95 shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 px-6 py-4">
          <h2 className="truncate text-[16px] font-semibold leading-tight text-text-primary">{starter.name}</h2>
          <div className="flex items-center gap-3 text-[12.5px]">
            <button
              type="button"
              onClick={reset}
              disabled={!dirty}
              className="text-text-muted hover:text-text-secondary disabled:cursor-default disabled:opacity-40"
            >
              Clear
            </button>
            <span title={starter.description} className="grid h-5 w-5 cursor-help place-items-center rounded-full text-text-muted">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-7 w-7 place-items-center rounded-md text-text-secondary hover:bg-bg/40 hover:text-text-primary"
            >
              <IconClose size={13} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            spellCheck={false}
            aria-label={`${starter.name} body`}
            className="h-full w-full resize-none border-0 bg-transparent text-[14px] leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none"
            style={{ userSelect: 'text' }}
          />
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 px-6 py-3.5">
          <div className="flex items-center gap-1 text-[12px] text-text-secondary">
            <Chip>
              <Icon size={11} className={tint} />
              {FORMAT_LABEL[starter.format]}
            </Chip>
            {starter.tags.slice(0, 3).map((t) => (
              <Chip key={t}>#{t}</Chip>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-[12.5px] text-text-secondary hover:bg-bg/40 hover:text-text-primary"
            >
              Cancel
            </button>
            {canInsert && (
              <button
                type="button"
                disabled={installing}
                onClick={() => onInstallAndUse(body)}
                className="rounded-md px-3 py-1.5 text-[12.5px] text-text-secondary hover:bg-bg/40 hover:text-text-primary disabled:opacity-50"
              >
                Add &amp; insert
              </button>
            )}
            <button
              type="button"
              disabled={installing}
              onClick={() => onInstall(body)}
              className="rounded-md bg-bg/60 px-3.5 py-1.5 text-[12.5px] font-medium text-text-primary hover:bg-bg/80 disabled:opacity-50"
            >
              {installing ? 'Adding…' : 'Add'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1 rounded-md bg-bg/40 px-2 py-1 text-[11.5px] text-text-secondary">
      {children}
    </span>
  )
}

function Editor({
  editing, creatingType, projects, activeProjectId, activeSessionId, onClose, onSaved, onRemoved, onInserted, onScheduleClick
}: {
  editing: Skill | 'new'
  creatingType: 'skill' | 'recipe'
  projects: Project[]
  activeProjectId: string | null
  activeSessionId: string | null
  onClose: () => void
  onSaved: (s: Skill) => Promise<void>
  onRemoved: () => Promise<void>
  onInserted: () => void
  onScheduleClick: (s: Skill) => void
}) {
  const isNew = editing === 'new'
  const startFormat: SkillFormat = isNew ? (creatingType === 'recipe' ? 'recipe' : 'prompt') : editing.format
  const startName = isNew ? '' : editing.name
  const startBody = isNew ? (startFormat === 'recipe' ? '# New recipe\n\n## Step 1\n\n' : '') : editing.body
  const startTags = isNew ? [] : editing.tags
  const startScope: SkillScope = isNew ? { kind: 'manual' } : editing.scope

  const [name, setName] = useState(startName)
  const [body, setBody] = useState(startBody)
  const [format, setFormat] = useState<SkillFormat>(startFormat)
  const [tags, setTags] = useState<string[]>(startTags)
  const [scope, setScope] = useState<SkillScope>(startScope)
  const [tagInput, setTagInput] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const isRecipe = format === 'recipe'
  const vars = useMemo(() => extractVariables(body), [body])

  const save = async (): Promise<Skill | null> => {
    if (!name.trim()) return null
    const folder = isRecipe ? 'recipes' : format === 'persona' ? 'personas' : format === 'clip' ? 'clips' : format === 'prompt' ? 'prompts' : 'lib'
    const saved = await window.terminal42.skills.save({
      oldId: !isNew ? editing.id : undefined,
      folder,
      name: name.trim(),
      body,
      format,
      tags,
      scope
    })
    setSavedAt(Date.now())
    await onSaved(saved)
    return saved
  }

  const remove = async (): Promise<void> => {
    if (isNew) return
    await window.terminal42.skills.remove(editing.id)
    await onRemoved()
  }

  const insertOrRun = async (): Promise<void> => {
    const saved = await save()
    if (!saved) return
    if (isRecipe) {
      const recipes = await window.terminal42.recipes.list()
      const recipe = recipes.find((r) => r.name === saved.name)
      if (recipe) await window.terminal42.recipes.run(recipe.id)
      onInserted()
      return
    }
    if (!activeSessionId) return
    const replaced = vars.length === 0 ? body : body
    await window.terminal42.pty.write(activeSessionId, replaced + '\r')
    onInserted()
  }

  const addTag = (t: string): void => {
    const tag = t.trim().toLowerCase()
    if (!tag || tags.includes(tag)) return
    setTags([...tags, tag])
    setTagInput('')
  }

  const projectName = (id: string): string => projects.find((p) => p.id === id)?.name ?? id.slice(0, 8)

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header className="flex h-[60px] shrink-0 items-center justify-between gap-4 px-6">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] text-text-secondary hover:bg-elevated hover:text-text-primary"
        >
          <span aria-hidden>←</span> Back
        </button>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-[11px] text-text-muted">Saved</span>}
          {!isNew && (
            <button
              type="button"
              onClick={() => void remove()}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] text-text-secondary hover:bg-elevated hover:text-rose-500"
            >
              <IconTrash size={11} /> Delete
            </button>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={!name.trim()}
            className="rounded-md bg-action px-3 py-1.5 text-[12px] font-medium text-action-text disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-[760px] flex-col gap-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isRecipe ? 'Recipe title…' : 'Skill title…'}
            className="bg-transparent text-[20px] font-semibold text-text-primary placeholder:text-text-muted focus:outline-none"
            autoFocus={isNew}
          />

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={20}
            placeholder={
              isRecipe
                ? '# Title\n\n> model: claude-sonnet-4.6\n\n## Step 1\nDescribe the first step…\n\n## Step 2\n…'
                : 'Write your prompt, persona, or clip here. Use {{variable}} for inputs.'
            }
            className="resize-y rounded-md bg-elevated/40 px-3 py-3 font-mono text-[12.5px] leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none"
            style={{ userSelect: 'text' }}
          />

          {/* Footer toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as SkillFormat)}
                className="rounded-md bg-elevated px-2 py-1 text-text-primary focus:outline-none"
                title="Type"
              >
                {SKILL_FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
                <option value="recipe">Recipe</option>
              </select>

              <select
                value={scope.kind === 'project' ? `project:${scope.projectId}` : scope.kind}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === 'always' || v === 'manual') setScope({ kind: v })
                  else setScope({ kind: 'project', projectId: v.replace('project:', '') })
                }}
                className="rounded-md bg-elevated px-2 py-1 text-text-primary focus:outline-none"
                title="Scope"
              >
                <option value="manual">Manual scope</option>
                <option value="always">Always available</option>
                {projects.map((p) => (
                  <option key={p.id} value={`project:${p.id}`}>Project · {p.name}</option>
                ))}
              </select>

              {isRecipe && !isNew && (
                <button
                  type="button"
                  onClick={() => onScheduleClick(editing)}
                  className="flex items-center gap-1 rounded-md bg-elevated px-2 py-1 text-text-secondary hover:text-text-primary"
                >
                  <IconClock size={10} /> Schedule
                </button>
              )}

              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-md bg-elevated/60 px-1.5 py-0.5 text-text-secondary">
                  #{t}
                  <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                    <IconClose size={8} />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }}
                placeholder="+ tag"
                className="w-20 bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none"
              />

              {vars.length > 0 && (
                <span className="text-[10.5px] text-text-muted">{vars.length} variable{vars.length === 1 ? '' : 's'}</span>
              )}
              {scope.kind === 'project' && (
                <span className="text-[10.5px] text-text-muted">→ {projectName(scope.projectId)}</span>
              )}
              {activeProjectId && scope.kind !== 'project' && (
                <button
                  type="button"
                  onClick={() => setScope({ kind: 'project', projectId: activeProjectId })}
                  className="text-[10.5px] text-accent hover:underline"
                >
                  Scope to current project
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => void insertOrRun()}
              className="flex items-center gap-1.5 rounded-md bg-elevated px-2.5 py-1 text-[11.5px] text-text-primary hover:bg-elevated/80"
              title={isRecipe ? 'Save and run' : 'Save and insert'}
            >
              {isRecipe ? <IconPlay size={10} /> : <IconTerminal size={10} />}
              {isRecipe ? 'Run' : 'Insert'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

function ScheduleDialog({
  skill, recipeId, existing, onClose, onChanged
}: {
  skill: Skill
  recipeId: string | null
  existing: RecipeSchedule[]
  onClose: () => void
  onChanged: () => void
}) {
  const [kind, setKind] = useState<'daily' | 'weekdays' | 'interval'>('daily')
  const [hour, setHour] = useState(9)
  const [minute, setMinute] = useState(0)
  const [intervalMinutes, setIntervalMinutes] = useState(60)
  const [busy, setBusy] = useState(false)

  const add = async (): Promise<void> => {
    if (!recipeId) return
    setBusy(true)
    await window.terminal42.recipes.schedules.upsert({
      recipeId,
      kind,
      hour: kind === 'interval' ? null : hour,
      minute: kind === 'interval' ? null : minute,
      intervalMinutes: kind === 'interval' ? intervalMinutes : null,
      enabled: true
    })
    setBusy(false)
    onChanged()
  }

  const remove = async (id: string): Promise<void> => {
    await window.terminal42.recipes.schedules.remove(id)
    onChanged()
  }

  const toggle = async (id: string, enabled: boolean): Promise<void> => {
    await window.terminal42.recipes.schedules.toggle(id, enabled)
    onChanged()
  }

  return (
    <div
      className="t42-scrim fixed inset-0 z-[60] grid place-items-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-[440px] rounded-lg bg-bg p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-text-primary">Schedule “{skill.name}”</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text-primary">
            <IconClose size={11} />
          </button>
        </div>

        {!recipeId ? (
          <div className="text-[12px] text-text-muted">Save the recipe first to enable scheduling.</div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-3 gap-1 rounded-md bg-elevated p-1 text-[12px]">
              {(['daily', 'weekdays', 'interval'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={[
                    'rounded-sm px-2 py-1 capitalize',
                    kind === k ? 'bg-bg text-text-primary' : 'text-text-secondary hover:text-text-primary'
                  ].join(' ')}
                >
                  {k}
                </button>
              ))}
            </div>

            {kind === 'interval' ? (
              <label className="flex items-center gap-2 text-[12px] text-text-secondary">
                Every
                <input
                  type="number" min={5} max={1440}
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(parseInt(e.target.value) || 60)}
                  className="w-20 rounded-md bg-elevated px-2 py-1 text-text-primary focus:outline-none"
                />
                minutes
              </label>
            ) : (
              <div className="flex items-center gap-2 text-[12px] text-text-secondary">
                At
                <input
                  type="number" min={0} max={23}
                  value={hour}
                  onChange={(e) => setHour(parseInt(e.target.value) || 0)}
                  className="w-16 rounded-md bg-elevated px-2 py-1 text-text-primary focus:outline-none"
                />
                :
                <input
                  type="number" min={0} max={59}
                  value={minute}
                  onChange={(e) => setMinute(parseInt(e.target.value) || 0)}
                  className="w-16 rounded-md bg-elevated px-2 py-1 text-text-primary focus:outline-none"
                />
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void add()}
                disabled={busy}
                className="rounded-md bg-action px-3 py-1.5 text-[12px] font-medium text-action-text disabled:opacity-50"
              >
                Add schedule
              </button>
            </div>

            {existing.length > 0 && (
              <div className="mt-4 flex flex-col gap-1.5 pt-3">
                {existing.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-[12px]">
                    <span className="text-text-primary">
                      {s.kind === 'interval'
                        ? `Every ${s.interval_minutes}m`
                        : `${s.kind === 'weekdays' ? 'Weekdays' : 'Daily'} at ${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void toggle(s.id, !s.enabled)}
                        className="text-[11px] text-text-secondary hover:text-text-primary"
                      >
                        {s.enabled ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(s.id)}
                        aria-label="Remove schedule"
                        className="text-text-muted hover:text-rose-500"
                      >
                        <IconTrash size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
