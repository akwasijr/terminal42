import { useEffect, useMemo, useState } from 'react'
import type { Skill, SkillFormat, SkillScope, ProposedSkill } from '../../../preload/index'
import {
  IconPlus,
  IconClose,
  IconTerminal,
  IconChat,
  IconUser,
  IconCode,
  IconWorkflow,
  IconSearch,
  IconTrash,
  IconCheck,
  IconSparkle,
  IconChevronRight
} from './icons'
import { StarterPackModal } from './StarterPackModal'
import { STARTER_PACK } from './starterPack'

const FORMAT_LABEL: Record<SkillFormat, string> = {
  prompt: 'Prompt',
  persona: 'Persona',
  clip: 'Code clip',
  recipe: 'Recipe'
}
const FORMAT_LABEL_PLURAL: Record<SkillFormat, string> = {
  prompt: 'Prompts',
  persona: 'Personas',
  clip: 'Code clips',
  recipe: 'Recipes'
}
const FORMAT_ICON: Record<SkillFormat, typeof IconChat> = {
  prompt: IconChat,
  persona: IconUser,
  clip: IconCode,
  recipe: IconWorkflow
}
const FORMAT_TINT: Record<SkillFormat, string> = {
  prompt: 'text-accent',
  persona: 'text-violet-400',
  clip: 'text-emerald-400',
  recipe: 'text-amber-400'
}

function extractVariables(body: string): string[] {
  const set = new Set<string>()
  const re = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) set.add(m[1])
  return Array.from(set)
}

function applyVariables(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_full, name: string) => values[name] ?? '')
}

function bodyPreview(body: string, max = 110): string {
  const flat = body.replace(/^---[\s\S]*?---/, '').replace(/[#*`>_\-]/g, '').replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  return flat.slice(0, max).trimEnd() + '…'
}

type Project = { id: string; name: string }

export function SkillsView({
  activeSessionId,
  onJumpToTerminal,
  activeProjectId
}: {
  activeSessionId?: string | null
  onJumpToTerminal?: () => void
  activeProjectId?: string | null
}) {
  const [items, setItems] = useState<Skill[]>([])
  const [proposed, setProposed] = useState<ProposedSkill[]>([])
  const [scanning, setScanning] = useState(false)
  const [editing, setEditing] = useState<Skill | null | 'new'>(null)
  const [draftName, setDraftName] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [draftFormat, setDraftFormat] = useState<SkillFormat>('prompt')
  const [draftTags, setDraftTags] = useState<string[]>([])
  const [draftScope, setDraftScope] = useState<SkillScope>({ kind: 'manual' })
  const [tagInput, setTagInput] = useState('')

  const [query, setQuery] = useState('')
  const [filterFormat, setFilterFormat] = useState<SkillFormat | 'all'>('all')
  const [filterTag, setFilterTag] = useState<string | null>(null)

  const [insertedAt, setInsertedAt] = useState<number | null>(null)
  const [varDialog, setVarDialog] = useState<{ vars: string[]; values: Record<string, string> } | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [showStarterPack, setShowStarterPack] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const refresh = async () => {
    const list = await window.terminal42.skills.listAll()
    setItems(list)
    try {
      const prop = await window.terminal42.skills.listProposed()
      setProposed(prop)
    } catch {}
  }

  useEffect(() => {
    void refresh()
    void window.terminal42.projects.list().then((ps) => setProjects(ps as Project[]))
    const off = window.terminal42.skills.onProposalsChanged(() => { void refresh() })
    return () => { try { off?.() } catch {} }
  }, [])

  const acceptProposed = async (p: ProposedSkill) => {
    const folder: Skill['folder'] =
      p.format === 'persona' ? 'personas' :
      p.format === 'clip' ? 'clips' :
      p.format === 'recipe' ? 'recipes' : 'prompts'
    await window.terminal42.skills.acceptProposed(p.id, folder)
    setToast(`Added "${p.name}" to your Skills`)
    await refresh()
  }

  const discardProposed = async (p: ProposedSkill) => {
    await window.terminal42.skills.discardProposed(p.id)
    await refresh()
  }

  const scanNow = async () => {
    setScanning(true)
    try {
      const r = await window.terminal42.skills.proposeNow()
      if (r.ok) {
        setToast(r.added > 0 ? `Found ${r.added} new skill${r.added === 1 ? '' : 's'}` : 'No new skills found')
      } else {
        setToast(r.error ?? 'Scan failed')
      }
      await refresh()
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (editing && editing !== 'new') {
      setDraftName(editing.name)
      setDraftBody(editing.body)
      setDraftFormat(editing.format)
      setDraftTags(editing.tags)
      setDraftScope(editing.scope)
    } else if (editing === 'new') {
      setDraftName('')
      setDraftBody('')
      setDraftFormat('prompt')
      setDraftTags([])
      setDraftScope({ kind: 'manual' })
      setSavedAt(null)
    }
  }, [editing])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((s) => {
      if (filterFormat !== 'all' && s.format !== filterFormat) return false
      if (filterTag && !s.tags.includes(filterTag)) return false
      if (q && !s.name.toLowerCase().includes(q) && !s.body.toLowerCase().includes(q) && !s.tags.some((t) => t.includes(q))) return false
      return true
    })
  }, [items, query, filterFormat, filterTag])

  const counts = useMemo(() => {
    const c: Record<SkillFormat | 'all', number> = { all: items.length, prompt: 0, persona: 0, clip: 0, recipe: 0 }
    for (const s of items) c[s.format]++
    return c
  }, [items])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const s of items) for (const t of s.tags) set.add(t)
    return Array.from(set).sort()
  }, [items])

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? id.slice(0, 8)
  const draftVariables = useMemo(() => extractVariables(draftBody), [draftBody])

  const newOne = () => setEditing('new')
  const closeEditor = () => {
    setEditing(null)
    setSavedAt(null)
    setInsertedAt(null)
  }

  const save = async () => {
    if (!draftName.trim()) return
    const saved = await window.terminal42.skills.save({
      oldId: editing && editing !== 'new' ? editing.id : undefined,
      name: draftName.trim(),
      body: draftBody,
      format: draftFormat,
      tags: draftTags,
      scope: draftScope
    })
    setSavedAt(Date.now())
    await refresh()
    setEditing(saved)
  }

  const remove = async () => {
    if (!editing || editing === 'new') return
    await window.terminal42.skills.remove(editing.id)
    closeEditor()
    await refresh()
  }

  const addTag = (t: string) => {
    const tag = t.trim().toLowerCase()
    if (!tag || draftTags.includes(tag)) return
    setDraftTags([...draftTags, tag])
    setTagInput('')
  }
  const removeTag = (t: string) => setDraftTags(draftTags.filter((x) => x !== t))

  const insertIntoTerminal = async () => {
    if (!activeSessionId || !draftBody.trim()) return
    const vars = extractVariables(draftBody)
    if (vars.length > 0) {
      const initial: Record<string, string> = {}
      for (const v of vars) initial[v] = ''
      setVarDialog({ vars, values: initial })
      return
    }
    await window.terminal42.pty.write(activeSessionId, draftBody + '\r')
    setInsertedAt(Date.now())
    onJumpToTerminal?.()
  }

  const insertWithValues = async () => {
    if (!activeSessionId || !varDialog) return
    const filled = applyVariables(draftBody, varDialog.values)
    await window.terminal42.pty.write(activeSessionId, filled + '\r')
    setVarDialog(null)
    setInsertedAt(Date.now())
    onJumpToTerminal?.()
  }

  const canInsert = !!activeSessionId && !!draftBody.trim()

  // ───────── render: editor ─────────
  if (editing) {
    return (
      <main className="relative flex flex-1 flex-col overflow-hidden bg-bg">
        {/* Editor header */}
        <div className="flex items-center justify-between gap-3 px-6 py-3">
          <button
            type="button"
            onClick={closeEditor}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span aria-hidden>←</span> Back to library
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void insertIntoTerminal()}
              disabled={!canInsert}
              title={!activeSessionId ? 'Open a terminal session first' : 'Send to active terminal'}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-text-primary hover:bg-elevated disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <IconTerminal size={12} /> Insert
            </button>
            {editing !== 'new' && (
              <button
                type="button"
                onClick={() => void remove()}
                className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] text-text-secondary hover:bg-rose-500/10 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <IconTrash size={12} /> Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => void save()}
              disabled={!draftName.trim()}
              className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-text disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            >
              Save
            </button>
          </div>
        </div>

        {/* Title + format */}
        <div className="flex items-start gap-3 px-6 pt-5 pb-3">
          <select
            value={draftFormat}
            onChange={(e) => setDraftFormat(e.target.value as SkillFormat)}
            className="rounded-md bg-bg px-2 py-1 text-[11px] text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Format"
          >
            <option value="prompt">Prompt</option>
            <option value="persona">Persona</option>
            <option value="clip">Code clip</option>
            <option value="recipe">Recipe</option>
          </select>
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Untitled skill"
            className="flex-1 bg-transparent text-[20px] font-semibold text-text-primary focus:outline-none placeholder:text-text-muted"
            aria-label="Skill name"
            autoFocus={editing === 'new'}
          />
          {savedAt && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-500">
              <IconCheck size={11} /> Saved
            </span>
          )}
        </div>

        {/* Scope + tags */}
        <div className="flex flex-wrap items-center gap-3 bg-surface/40 px-6 py-3 text-[12px]">
          <ScopePicker
            value={draftScope}
            projects={projects}
            activeProjectId={activeProjectId ?? null}
            onChange={setDraftScope}
          />
          <span className="h-4 w-px bg-border" />
          <div className="flex flex-1 flex-wrap items-center gap-1.5 min-w-0">
            <span className="text-text-muted">Tags</span>
            {draftTags.map((t) => (
              <span key={t} className="flex items-center gap-1 rounded-sm bg-elevated px-1.5 py-0.5 text-[11px] text-text-primary">
                #{t}
                <button type="button" onClick={() => removeTag(t)} aria-label={`Remove ${t}`} className="text-text-muted hover:text-text-primary">
                  <IconClose size={9} />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addTag(tagInput)
                } else if (e.key === 'Backspace' && tagInput === '' && draftTags.length > 0) {
                  removeTag(draftTags[draftTags.length - 1])
                }
              }}
              placeholder={draftTags.length === 0 ? 'add tags…' : '+ tag'}
              className="min-w-[80px] flex-1 bg-transparent text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none"
              aria-label="Add tag"
            />
          </div>
        </div>

        {(insertedAt || draftVariables.length > 0) && (
          <div
            key={insertedAt ?? 'vars'}
            role="status"
            aria-live="polite"
            className="flex flex-wrap items-center gap-2 bg-surface/30 px-6 py-2 text-[12px] text-text-secondary"
          >
            {insertedAt ? (
              <span>✓ Sent to active terminal session.</span>
            ) : (
              <>
                <span className="text-text-muted">Variables:</span>
                {draftVariables.map((v) => (
                  <code key={v} className="rounded-sm bg-bg px-1.5 py-0.5 text-[11px]">
                    {`{{${v}}}`}
                  </code>
                ))}
              </>
            )}
          </div>
        )}

        <textarea
          value={draftBody}
          onChange={(e) => setDraftBody(e.target.value)}
          placeholder={
            draftFormat === 'recipe'
              ? '# My recipe\n\n## Step 1\nFirst prompt to send…\n\n## Step 2\nSecond prompt…'
              : draftFormat === 'persona'
              ? 'You are a senior reviewer who…'
              : 'Write your ' + FORMAT_LABEL[draftFormat].toLowerCase() + ' here. Markdown and {{variables}} are fine.'
          }
          className="flex-1 resize-none bg-bg p-6 font-mono text-[13px] leading-relaxed text-text-primary focus:outline-none"
          style={{ userSelect: 'text' }}
          aria-label="Skill body"
        />

        {/* Variable dialog */}
        {varDialog && (
          <div className="absolute inset-0 z-50 grid place-items-center bg-black/40" onClick={() => setVarDialog(null)}>
            <div
              className="w-[420px] rounded-md bg-surface p-5 shadow-lg"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Fill in variables"
            >
              <h3 className="text-[14px] font-semibold text-text-primary">Fill in variables</h3>
              <p className="mt-1 text-[12px] text-text-muted">Values get substituted before sending to the terminal.</p>
              <div className="mt-4 flex flex-col gap-3">
                {varDialog.vars.map((v) => (
                  <label key={v} className="flex flex-col gap-1 text-[12px]">
                    <span className="text-text-secondary">
                      <code className="rounded-sm bg-bg px-1 py-0.5 text-[11px]">{`{{${v}}}`}</code>
                    </span>
                    <input
                      autoFocus={varDialog.vars[0] === v}
                      value={varDialog.values[v] ?? ''}
                      onChange={(e) => setVarDialog({ ...varDialog, values: { ...varDialog.values, [v]: e.target.value } })}
                      className="rounded-sm bg-bg px-2 py-1.5 text-[12px] text-text-primary focus:outline-none focus:border-accent"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVarDialog(null)}
                  className="rounded-md px-3 py-1.5 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void insertWithValues()}
                  className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-text"
                >
                  Insert
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    )
  }

  // ───────── render: library (card grid) ─────────
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-bg">
      {/* Page header */}
      <header className="flex h-[60px] shrink-0 items-center justify-between gap-4 px-6">
        <h1 className="text-[18px] font-semibold leading-tight text-text-primary">Skills</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowStarterPack(true)}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <IconSparkle size={12} /> Starter pack
          </button>
          <button
            type="button"
            onClick={newOne}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          >
            <IconPlus size={12} /> New skill
          </button>
        </div>
      </header>

      {/* Filter tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div role="tablist" aria-label="Filter by format" className="flex flex-wrap items-center gap-1">
          <FormatTab label="All" count={counts.all} active={filterFormat === 'all'} onClick={() => setFilterFormat('all')} />
          {(['prompt', 'persona', 'clip', 'recipe'] as SkillFormat[]).map((f) => (
            <FormatTab key={f} label={FORMAT_LABEL_PLURAL[f]} count={counts[f]} active={filterFormat === f} onClick={() => setFilterFormat(f)} />
          ))}
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-surface px-2 py-1.5 text-[12px] w-[260px]">
          <IconSearch size={11} className="text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills…"
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none"
            aria-label="Search skills"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-text-muted hover:text-text-primary">
              <IconClose size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Active tag filter chip */}
      {filterTag && (
        <div className="flex items-center gap-2 px-8 pt-3 text-[11px]">
          <span className="text-text-muted">Filtering by tag</span>
          <button
            type="button"
            onClick={() => setFilterTag(null)}
            className="flex items-center gap-1 rounded-sm bg-accent/10 px-1.5 py-0.5 text-accent"
          >
            #{filterTag} <IconClose size={9} />
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {proposed.length > 0 && (
          <section className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconSparkle size={14} className="text-accent" />
                <h3 className="text-[13px] font-semibold text-text-primary">Suggested by Brain</h3>
                <span className="text-[11px] text-text-muted">
                  {proposed.length} new from your recent work
                </span>
              </div>
              <button
                type="button"
                onClick={scanNow}
                disabled={scanning}
                className="text-[11px] text-text-secondary hover:text-text-primary disabled:opacity-40"
              >
                {scanning ? 'Scanning…' : 'Scan again'}
              </button>
            </div>
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
            >
              {proposed.map((p) => (
                <ProposedCard
                  key={p.id}
                  proposed={p}
                  onAccept={() => void acceptProposed(p)}
                  onDiscard={() => void discardProposed(p)}
                />
              ))}
            </div>
          </section>
        )}

        {proposed.length === 0 && items.length > 0 && (
          <div className="mb-6 flex items-center justify-end">
            <button
              type="button"
              onClick={scanNow}
              disabled={scanning}
              className="flex items-center gap-1.5 text-[11px] text-text-secondary hover:text-text-primary disabled:opacity-40"
            >
              <IconSparkle size={12} />
              {scanning ? 'Scanning your work…' : 'Scan my work for new skills'}
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState onStarterPack={() => setShowStarterPack(true)} onNew={newOne} />
        ) : filtered.length === 0 ? (
          <div className="grid h-full place-items-center text-[13px] text-text-muted">
            No skills match your filters.
          </div>
        ) : (
          <>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
            >
              {filtered.map((s) => (
                <SkillCard
                  key={s.id}
                  skill={s}
                  projectName={s.scope.kind === 'project' ? projectName(s.scope.projectId) : undefined}
                  onOpen={() => setEditing(s)}
                  onTagClick={(t) => setFilterTag(t)}
                />
              ))}
            </div>

            {allTags.length > 0 && (
              <div className="mt-10 border-t border-border pt-5">
                <div className="mb-2 text-[10px] font-semibold text-text-muted">Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFilterTag(filterTag === t ? null : t)}
                      className={
                        'rounded-sm px-2 py-0.5 text-[11px] ' +
                        (filterTag === t
                          ? 'bg-accent text-accent-text'
                          : 'bg-elevated text-text-secondary hover:text-text-primary')
                      }
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-text-primary px-3 py-1.5 text-[12px] text-bg shadow-lg"
        >
          {toast}
        </div>
      )}

      {/* Starter pack modal */}
      {showStarterPack && (
        <StarterPackModal
          existing={items}
          onClose={() => setShowStarterPack(false)}
          onInstalled={(count) => {
            setShowStarterPack(false)
            void refresh()
            if (count > 0) setToast(`Installed ${count} skill${count === 1 ? '' : 's'}`)
            else setToast('Nothing new to install')
          }}
        />
      )}
    </main>
  )
}

// ───────── subcomponents ─────────

function FormatTab({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
        (active
          ? 'border-accent/40 bg-accent/10 text-text-primary'
          : 'border-border bg-transparent text-text-secondary hover:bg-elevated hover:text-text-primary')
      }
    >
      <span>{label}</span>
      <span className={'rounded px-1 text-[10px] ' + (active ? 'bg-accent/20 text-accent' : 'bg-elevated text-text-muted')}>{count}</span>
    </button>
  )
}

function SkillCard({
  skill,
  projectName,
  onOpen,
  onTagClick
}: {
  skill: Skill
  projectName?: string
  onOpen: () => void
  onTagClick: (t: string) => void
}) {
  const Icon = FORMAT_ICON[skill.format]
  const tint = FORMAT_TINT[skill.format]
  const preview = bodyPreview(skill.body)
  const vars = extractVariables(skill.body)

  let scopeBadge: { dot: string; label: string; tone: string } | null = null
  if (skill.scope.kind === 'always') scopeBadge = { dot: 'bg-emerald-500', label: 'Always applied', tone: 'text-emerald-500' }
  else if (skill.scope.kind === 'project') scopeBadge = { dot: 'bg-accent', label: `Project · ${projectName ?? skill.scope.projectId}`, tone: 'text-accent' }

  return (
    <article
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Open ${skill.name}`}
      className="group flex cursor-pointer flex-col gap-2 rounded-lg bg-surface p-4 transition-colors hover:border-accent/40 hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <Icon size={12} className={tint} />
          <span>{FORMAT_LABEL[skill.format]}</span>
        </div>
        <IconChevronRight size={11} className="text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {/* Title */}
      <h3 className="truncate text-[14px] font-semibold text-text-primary">{skill.name}</h3>

      {/* Description */}
      <p className="text-[12px] leading-relaxed text-text-secondary line-clamp-2 min-h-[34px]">{preview || <span className="text-text-muted italic">Empty</span>}</p>

      {/* Footer: tags + scope/vars */}
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {skill.tags.slice(0, 3).map((t) => (
          <button
            key={t}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onTagClick(t)
            }}
            className="rounded-sm bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted hover:text-text-primary"
          >
            #{t}
          </button>
        ))}
        {skill.tags.length > 3 && (
          <span className="text-[10px] text-text-muted">+{skill.tags.length - 3}</span>
        )}
        {vars.length > 0 && (
          <span className="ml-auto rounded-sm bg-bg px-1.5 py-0.5 text-[10px] text-text-muted" title={`${vars.length} variable${vars.length === 1 ? '' : 's'}`}>
            {vars.length} var{vars.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Scope badge row */}
      {scopeBadge && (
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className={'h-1.5 w-1.5 rounded-full ' + scopeBadge.dot} aria-hidden />
          <span className={scopeBadge.tone}>{scopeBadge.label}</span>
        </div>
      )}
    </article>
  )
}

function EmptyState({ onStarterPack, onNew }: { onStarterPack: () => void; onNew: () => void }) {
  return (
    <div className="mx-auto grid max-w-2xl place-items-center gap-5 py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-surface text-accent">
        <IconSparkle size={20} />
      </div>
      <div>
        <h2 className="text-[16px] font-semibold text-text-primary">No skills yet</h2>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-text-muted">
          Skills are reusable prompts, personas, code clips, and recipes. Install the starter pack
          to get going with {STARTER_PACK.length} curated skills, or write your own from scratch.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onStarterPack}
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        >
          <IconSparkle size={12} /> Browse starter pack
        </button>
        <button
          type="button"
          onClick={onNew}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] text-text-primary hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <IconPlus size={12} /> New skill
        </button>
      </div>
    </div>
  )
}

function ScopePicker({
  value,
  projects,
  activeProjectId,
  onChange
}: {
  value: SkillScope
  projects: { id: string; name: string }[]
  activeProjectId: string | null
  onChange: (s: SkillScope) => void
}) {
  const kind = value.kind
  const projectId = value.kind === 'project' ? value.projectId : activeProjectId ?? projects[0]?.id ?? ''
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-text-muted">Scope</span>
      <div role="radiogroup" aria-label="Skill scope" className="flex overflow-hidden rounded-md ">
        {(['manual', 'always', 'project'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => {
              if (k === 'project') onChange({ kind: 'project', projectId })
              else onChange({ kind: k })
            }}
            className={
              'px-2 py-1 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ' +
              (kind === k
                ? 'bg-elevated font-medium text-text-primary'
                : 'text-text-secondary hover:bg-elevated hover:text-text-primary')
            }
          >
            {k === 'manual' ? 'Manual' : k === 'always' ? 'Always' : 'Project'}
          </button>
        ))}
      </div>
      {kind === 'project' && (
        <select
          value={projectId}
          onChange={(e) => onChange({ kind: 'project', projectId: e.target.value })}
          className="rounded-md bg-bg px-2 py-1 text-[11px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Choose project"
        >
          {projects.length === 0 ? <option value="">No projects yet</option> : null}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}

function ProposedCard({
  proposed,
  onAccept,
  onDiscard
}: {
  proposed: ProposedSkill
  onAccept: () => void
  onDiscard: () => void
}) {
  const Icon = FORMAT_ICON[proposed.format]
  const tint = FORMAT_TINT[proposed.format]
  return (
    <div className="group rounded-md bg-accent/5 p-3 ring-1 ring-accent/20 transition-colors hover:bg-accent/10">
      <div className="flex items-start gap-2">
        <Icon size={14} className={`${tint} mt-0.5 flex-shrink-0`} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-text-primary">{proposed.name}</div>
          {proposed.reason && (
            <div className="mt-0.5 text-[11px] text-text-secondary">{proposed.reason}</div>
          )}
          {proposed.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {proposed.tags.map((t) => (
                <span key={t} className="rounded-sm bg-surface px-1.5 py-0.5 text-[10px] text-text-muted">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onDiscard}
          className="rounded px-2 py-1 text-[11px] text-text-secondary hover:bg-surface hover:text-text-primary"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="flex items-center gap-1 rounded bg-accent px-2 py-1 text-[11px] font-medium text-accent-text hover:opacity-90"
        >
          <IconCheck size={11} />
          Accept
        </button>
      </div>
    </div>
  )
}
