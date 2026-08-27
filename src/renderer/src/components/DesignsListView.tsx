import { useEffect, useMemo, useRef, useState } from 'react'
import { takeTokensRequest } from '../lib/tokens/openLatch'
import { formatAge } from '../lib/formatAge'
import type { Design, DesignBrief, DesignGroup, TemplateInfo } from '../../../preload/index'
import { DesignWizard } from './DesignWizard'
import { TokensView } from './tokens/TokensView'
import { TemplatesGallery } from './TemplatesGallery'
import { DesignSystemView } from './DesignSystemView'
import { DesignSystemWizard } from './DesignSystemWizard'
import { type DesignSystem, upsertSystem } from '../lib/designSystem'
import { IconClose, IconEdit, IconPlus, IconSearch, IconTrash } from './icons'

// Pretty labels for the kind-group filter chips at the top of the page.
const GROUP_LABEL: Record<DesignGroup, string> = {
  web: 'Web', app: 'App', presentation: 'Decks', content: 'Content',
  print: 'Print', data: 'Data', social: 'Social', figma: 'Figma', other: 'Other'
}
// Display order for the chip row. Keeps the most common kinds on the left.
const GROUP_ORDER: DesignGroup[] = ['web', 'app', 'presentation', 'content', 'print', 'data', 'social', 'figma', 'other']
type TypeFilter = 'all' | 'form' | DesignGroup | 'system' | 'templates' | 'tokens'

/**
 * Which family of files this list is showing. Forms (the freeform canvas) and
 * web/app experiences are different enough tools that mixing them in one list
 * was confusing, so each gets its own top-level rail tab and its own list.
 */
export type DesignScope = 'form' | 'design'

export function DesignsListView({
  onOpen,
  seed,
  onSeedConsumed,
  scope = 'design'
}: {
  onOpen: (design: Design) => void
  seed?: { idea: string } | null
  onSeedConsumed?: () => void
  scope?: DesignScope
}): JSX.Element {
  const [designs, setDesigns] = useState<Design[]>([])
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardTarget, setWizardTarget] = useState<'html' | 'figma'>('html')
  const [wizardInitialIdea, setWizardInitialIdea] = useState<string>('')
  const [wizardStarter, setWizardStarter] = useState<TemplateInfo | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Design | null>(null)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => (localStorage.getItem('t42-designs-view') === 'list' ? 'list' : 'grid'))
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const showsDesigns = typeFilter !== 'system' && typeFilter !== 'tokens' && typeFilter !== 'templates'
  // An open token library asks for the whole page, so the list chrome steps
  // aside rather than the library squeezing itself into what is left.
  const [tokensFull, setTokensFull] = useState(false)

  // Cross-tab trigger: anything, including a chat reply, can dispatch
  // 't42:tokens-open' to land on the library list. The library is meant to be
  // the answer to "what is our blue", and an answer you have to navigate to
  // twice is one people stop asking for.
  useEffect(() => {
    if (takeTokensRequest()) setTypeFilter('tokens')
    const onOpen = (): void => setTypeFilter('tokens')
    window.addEventListener('t42:tokens-open', onOpen)
    return () => window.removeEventListener('t42:tokens-open', onOpen)
  }, [])
  // Project folders: client/project organisation, stored renderer-side.
  const [folderFilter, setFolderFilter] = useState<string>('all')
  const [folders, setFolders] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('t42-design-folders') || '[]') } catch { return [] } })
  const [designFolders, setDesignFolders] = useState<Record<string, string>>(() => { try { return JSON.parse(localStorage.getItem('t42-design-folder-map') || '{}') } catch { return {} } })
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  // Single "New design" menu: form sizes, other design types, and new folder.
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const newMenuRef = useRef<HTMLDivElement>(null)
  const [dsWizardOpen, setDsWizardOpen] = useState(false)
  const [pendingDsId, setPendingDsId] = useState<string | null>(null)

  useEffect(() => {
    if (!newMenuOpen) return
    const handler = (e: MouseEvent): void => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) setNewMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [newMenuOpen])

  const searchRef = useRef<HTMLInputElement>(null)
  // Auto-focus the input the moment search is opened, and auto-collapse
  // when the user blurs it without typing anything.
  useEffect(() => {
    if (searchOpen) {
      const id = setTimeout(() => searchRef.current?.focus(), 30)
      return () => clearTimeout(id)
    }
    return
  }, [searchOpen])

  useEffect(() => {
    void refresh()
  }, [])

  // When a cross-tab caller (e.g. ProjectWorkspace's "Spin off as design")
  // sets a seed, open the wizard with that idea pre-filled.
  useEffect(() => {
    if (!seed) return
    setWizardInitialIdea(seed.idea ?? '')
    setWizardTarget('html')
    setWizardOpen(true)
    onSeedConsumed?.()
  }, [seed, onSeedConsumed])

  const refresh = async (): Promise<void> => {
    const list = await window.terminal42.designs.list()
    setDesigns(list)
  }

  const handleWizardComplete = async (brief: DesignBrief, kickoff: string): Promise<void> => {
    if (creating) return
    setCreating(true)
    try {
      const starter = wizardStarter
      const createOpts = starter
        ? { brief, title: `${starter.displayName} starter` }
        : { brief }
      const d = await window.terminal42.designs.create(createOpts)
      // Starter-template flow: materialise the chosen Studio42 starter
      // into the design's cwd before sending the kickoff so the model
      // can read the existing files.
      if (starter) {
        const r = await window.terminal42.templates.materialize({ templateId: starter.id, destDir: d.cwd })
        if (!r.ok) {
          try { await window.terminal42.designs.delete(d.id) } catch {}
          setWizardOpen(false)
          setWizardStarter(null)
          return
        }
        await window.terminal42.designs.createStarterVersion(d.id, brief.idea ?? kickoff).catch(() => null)
      }
      // If the wizard stashed a template file on the global, upload it
      // into the design's cwd before kicking off so the model can read it.
      const pending = (window as unknown as { __t42PendingTemplate?: File }).__t42PendingTemplate
      if (pending && brief.templateFile) {
        try {
          const buf = await pending.arrayBuffer()
          await window.terminal42.designs.uploadTemplate(d.id, pending.name, buf)
        } catch {}
        ;(window as unknown as { __t42PendingTemplate?: File }).__t42PendingTemplate = undefined
      }
      // Same pattern for reference images uploaded on the inspiration page.
      // The wizard stored the actual File objects on __t42PendingRefs; here
      // we pipe each one through the IPC handler which writes it into
      // ./_refs/ and updates the brief.inspirationImages list with the
      // sanitised disk filename. The wizard's own list of original names
      // is discarded: the brief on the design row is the source of truth.
      const pendingRefs = (window as unknown as { __t42PendingRefs?: File[] }).__t42PendingRefs ?? []
      if (pendingRefs.length) {
        for (const f of pendingRefs) {
          try {
            const buf = await f.arrayBuffer()
            await window.terminal42.designs.uploadInspiration(d.id, f.name, buf)
          } catch {}
        }
        ;(window as unknown as { __t42PendingRefs?: File[] }).__t42PendingRefs = []
      }
      setWizardOpen(false)
      setWizardStarter(null)
      await refresh()
      onOpen(d)
      // Read the figma destination off the brief: the wizard wrote it
      // into the brief via the figma page when target='figma'.
      const fb = brief as DesignBrief & { figmaMode?: 'newFile' | 'existingFile'; figmaTargetUrl?: string; target?: 'html' | 'figma' }
      const settings = await window.terminal42.settings.get().catch(() => null)
      const defaultModel = settings?.defaultModel ?? null
      if (fb.target === 'figma') {
        const description = `${kickoff}\n\nBrief summary:\n${summariseBriefBits(brief).map((b) => `- ${b}`).join('\n')}`
        void window.terminal42.designs.figmaFromScratch(d.id, description, {
          mode: fb.figmaMode ?? 'newFile',
          fileUrl: fb.figmaTargetUrl ?? null
        })
      } else {
        void window.terminal42.designs.send(d.id, kickoff, defaultModel)
      }
    } finally {
      setCreating(false)
    }
  }

  const remove = async (d: Design): Promise<void> => {
    await window.terminal42.designs.delete(d.id)
    setConfirmDelete(null)
    await refresh()
  }

  const openHtmlWizard = (): void => {
    setWizardTarget('html')
    setWizardInitialIdea('')
    setWizardOpen(true)
  }
  const createFreeform = async (preset?: { w: number; h: number }): Promise<void> => {
    if (creating) return
    const brief = {
      v: 1 as const,
      kind: 'freeform' as const,
      kindLabel: 'Form',
      group: 'other' as const,
      fidelity: 'highfidelity' as const,
      createdAt: Date.now(),
    } as DesignBrief
    const d = await window.terminal42.designs.create({ title: 'Untitled canvas', brief })
    // Seed the chosen starting artboard size so the new canvas opens at that preset.
    if (preset) {
      try {
        const seed = { v: 2, pages: [{ id: 'p1', name: 'Page 1' }], activePage: 'p1', perPage: { p1: { objects: [], artboards: [{ id: 'ab1', name: 'Artboard 1', x: 0, y: 0, w: preset.w, h: preset.h, bg: '#ffffff' }], activeAb: 'ab1' } } }
        localStorage.setItem(`t42-freeform:${d.id}`, JSON.stringify(seed))
      } catch { /* ignore quota */ }
    }
    onOpen(d)
  }

  const createFromTemplate = (t: TemplateInfo): void => {
    if (creating) return
    setWizardStarter(t)
    setWizardTarget('html')
    setWizardInitialIdea('')
    setWizardOpen(true)
  }

  // Build a minimal one-line bullet list of brief facts so the figma flow
  // gets the same context the HTML flow gets via its prefix.
  function summariseBriefBits(b: DesignBrief): string[] {
    const out: string[] = []
    out.push(`Type: ${b.kindLabel}${b.subtype ? ` (${b.subtype})` : ''}`)
    if (b.lookLabel) out.push(`Look: ${b.lookLabel}`)
    if (b.audience) out.push(`Audience: ${b.audience}`)
    if (b.paletteLabel && b.paletteColors?.length) out.push(`Palette: ${b.paletteLabel} (${b.paletteColors.join(', ')})`)
    if (b.primaryColor) out.push(`Primary: ${b.primaryColor}`)
    if (b.secondaryColor) out.push(`Secondary: ${b.secondaryColor}`)
    if (b.accentColor) out.push(`Accent: ${b.accentColor}`)
    if (b.fontHeading) out.push(`Heading font: ${b.fontHeading}`)
    if (b.fontBody && b.fontBody !== b.fontHeading) out.push(`Body font: ${b.fontBody}`)
    if (b.iconLibraryLabel) out.push(`Icons: ${b.iconLibraryLabel}${b.iconStyleLabel ? ` (${b.iconStyleLabel})` : ''}`)
    if (b.theme) out.push(`Theme: ${b.theme}`)
    if (b.density) out.push(`Density: ${b.density}`)
    if (b.idea) out.push(`Idea: ${b.idea}`)
    return out
  }

  // Persist folders + the design→folder map.
  useEffect(() => { try { localStorage.setItem('t42-design-folders', JSON.stringify(folders)) } catch { /* quota */ } }, [folders])
  useEffect(() => { try { localStorage.setItem('t42-design-folder-map', JSON.stringify(designFolders)) } catch { /* quota */ } }, [designFolders])
  const createFolder = (name: string): void => {
    const v = name.trim()
    setNewFolderName(''); setNewFolderOpen(false)
    if (!v || folders.includes(v)) return
    setFolders((f) => [...f, v]); setFolderFilter(v)
  }
  const assignFolder = (id: string, folder: string | null): void => setDesignFolders((m) => {
    const next = { ...m }
    if (folder) next[id] = folder; else delete next[id]
    return next
  })
  const removeFolder = (name: string): void => {
    setFolders((f) => f.filter((x) => x !== name))
    setDesignFolders((m) => { const next = { ...m }; for (const k of Object.keys(next)) if (next[k] === name) delete next[k]; return next })
    if (folderFilter === name) setFolderFilter('all')
  }
  const folderCount = (name: string): number => Object.values(designFolders).filter((x) => x === name).length

  // Only the files belonging to this scope. Everything downstream (type pills,
  // folder counts, buckets) works from this list, never the raw one.
  const isForm = (d: Design): boolean => d.brief?.kind === 'freeform'
  const scoped = useMemo(
    () => designs.filter((d) => (scope === 'form' ? isForm(d) : !isForm(d))),
    [designs, scope]
  )

  // Which file types are present, so the type pills only show real options.
  const presentTypes = useMemo(() => {
    const s = new Set<DesignGroup>()
    for (const d of scoped) s.add((d.brief?.group ?? 'other') as DesignGroup)
    return { groups: GROUP_ORDER.filter((g) => s.has(g)) }
  }, [scoped])

  const allLabel = scope === 'form' ? 'All forms' : 'All designs'
  const heading = typeFilter === 'system' ? 'Design systems' : typeFilter === 'tokens' ? 'Tokens' : typeFilter === 'templates' ? 'Templates' : folderFilter !== 'all' ? folderFilter : allLabel

  // Apply type + folder + search, then bucket by recency.
  const buckets = useMemo(() => {
    const q = search.trim().toLowerCase()
    const isGroup = typeFilter !== 'all' && typeFilter !== 'form' && typeFilter !== 'system' && typeFilter !== 'templates' && typeFilter !== 'tokens'
    const visible = scoped.filter((d) => {
      if (isGroup && (d.brief?.group ?? 'other') !== typeFilter) return false
      if (folderFilter !== 'all' && designFolders[d.id] !== folderFilter) return false
      if (!q) return true
      const hay = [d.title, d.brief?.kindLabel ?? '', d.brief?.subtype ?? '', d.brief?.idea ?? '', d.brief?.audience ?? '', d.brief?.lookLabel ?? ''].join(' ').toLowerCase()
      return hay.includes(q)
    })

    const now = Date.now()
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
    const startOfYesterday = startOfToday.getTime() - 86400000
    const sevenDays = now - 7 * 86400000
    const thirtyDays = now - 30 * 86400000

    const out: Array<{ id: string; label: string; items: Design[] }> = [
      { id: 'today',      label: 'Today',          items: [] },
      { id: 'yesterday',  label: 'Yesterday',      items: [] },
      { id: 'this-week',  label: 'Earlier this week', items: [] },
      { id: 'this-month', label: 'Earlier this month', items: [] },
      { id: 'older',      label: 'Older',          items: [] }
    ]
    for (const d of visible) {
      const t = d.lastActiveAt
      if (t >= startOfToday.getTime())   out[0].items.push(d)
      else if (t >= startOfYesterday)    out[1].items.push(d)
      else if (t >= sevenDays)           out[2].items.push(d)
      else if (t >= thirtyDays)          out[3].items.push(d)
      else                               out[4].items.push(d)
    }
    for (const b of out) b.items.sort((a, c) => c.lastActiveAt - a.lastActiveAt)
    return out.filter((b) => b.items.length > 0)
  }, [scoped, search, typeFilter, folderFilter, designFolders])

  return (
    <div className={['h-full w-full bg-bg', tokensFull ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'].join(' ')}>
      <div className={tokensFull ? 'flex h-full min-h-0 flex-col' : 'mx-auto max-w-6xl px-8 pt-10'}>
        {!tokensFull && (
        <div className="sticky top-0 z-10 bg-bg pb-4">
          <header className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold text-text-primary">{heading}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div ref={newMenuRef} className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setNewMenuOpen((o) => !o)}
                disabled={creating}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-action px-3 py-1.5 text-[13px] font-medium text-action-text transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <IconPlus size={13} />
                <span>{creating ? 'Creating\u2026' : scope === 'form' ? 'New form' : 'New design'}</span>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="-mr-0.5 ml-0.5 opacity-80"><path d="M4 6l4 4 4-4" /></svg>
              </button>
              {newMenuOpen && (
                <div className="t42-menu absolute right-0 top-full z-30 mt-1.5 w-60 overflow-hidden rounded-lg bg-raised py-1 shadow-overlay">
                  {scope === 'form' ? (
                    <button type="button" onClick={() => { setNewMenuOpen(false); void createFreeform() }} className="flex w-full items-center px-3 py-2 text-left text-[12.5px] font-medium text-text-primary hover:bg-elevated">Blank form</button>
                  ) : (
                    [
                      { label: 'Design system', onClick: () => { setNewMenuOpen(false); setDsWizardOpen(true) } },
                      { label: 'Web experience', onClick: () => { setNewMenuOpen(false); openHtmlWizard() } },
                      { label: 'App', onClick: () => { setNewMenuOpen(false); openHtmlWizard() } }
                    ].map((o) => (
                      <button key={o.label} type="button" onClick={o.onClick} className="flex w-full items-center px-3 py-2 text-left text-[12.5px] font-medium text-text-primary hover:bg-elevated">
                        {o.label}
                      </button>
                    ))
                  )}
                  <div className="my-1" />
                  <button type="button" onClick={() => { setNewMenuOpen(false); setNewFolderOpen(true) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-medium text-text-primary hover:bg-elevated">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5.5V12a1 1 0 001 1h10a1 1 0 001-1V6.5a1 1 0 00-1-1H8L6.5 4H3a1 1 0 00-1 1.5z"/></svg>
                    New folder
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(scope === 'design' || presentTypes.groups.length > 0) && (
          <div className="inline-flex shrink-0 flex-wrap items-center gap-1 rounded-lg bg-sunken p-1">
            <ViewPill active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>{allLabel}</ViewPill>
            {presentTypes.groups.map((g) => (
              <ViewPill key={g} active={typeFilter === g} onClick={() => setTypeFilter(g)}>{GROUP_LABEL[g]}</ViewPill>
            ))}
            {scope === 'design' && (
              <>
                <span className="mx-1.5" />
                <ViewPill active={typeFilter === 'system'} onClick={() => setTypeFilter('system')}>Design systems</ViewPill>
                <ViewPill active={typeFilter === 'tokens'} onClick={() => setTypeFilter('tokens')}>Tokens</ViewPill>
                <ViewPill active={typeFilter === 'templates'} onClick={() => setTypeFilter('templates')}>Templates</ViewPill>
              </>
            )}
          </div>
          )}
          <div className="ml-auto flex items-center gap-2">
              {/* The toggle only means something where a list of designs is on
                  screen; design systems, tokens and templates draw themselves
                  and ignored it, which made the control look broken. */}
              {showsDesigns && (
              <div className="inline-flex items-center gap-0.5 rounded-md bg-elevated p-0.5">
                <button type="button" onClick={() => { setViewMode('grid'); localStorage.setItem('t42-designs-view', 'grid') }} title="Grid view" aria-label="Grid view"
                  className={['grid h-7 w-7 place-items-center rounded transition-colors', viewMode === 'grid' ? 'bg-bg text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'].join(' ')}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></svg>
                </button>
                <button type="button" onClick={() => { setViewMode('list'); localStorage.setItem('t42-designs-view', 'list') }} title="List view" aria-label="List view"
                  className={['grid h-7 w-7 place-items-center rounded transition-colors', viewMode === 'list' ? 'bg-bg text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'].join(' ')}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M5 4h9M5 8h9M5 12h9" /><circle cx="2.5" cy="4" r="0.9" fill="currentColor" stroke="none" /><circle cx="2.5" cy="8" r="0.9" fill="currentColor" stroke="none" /><circle cx="2.5" cy="12" r="0.9" fill="currentColor" stroke="none" /></svg>
                </button>
              </div>
              )}
              <div
                className={[
                  'flex items-center overflow-hidden rounded-md bg-elevated transition-[width,background-color] duration-300 ease-out',
                  searchOpen ? 'w-[260px]' : 'w-8 hover:bg-elevated/70'
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (searchOpen && !search) setSearchOpen(false)
                    else setSearchOpen(true)
                  }}
                  aria-label={searchOpen ? 'Close search' : 'Search designs'}
                  title={searchOpen ? 'Close search' : 'Search designs'}
                  className="grid h-8 w-8 shrink-0 place-items-center text-text-muted transition-colors hover:text-text-primary"
                >
                  <IconSearch size={13} />
                </button>
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onBlur={() => { if (!search) setSearchOpen(false) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setSearch(''); setSearchOpen(false); searchRef.current?.blur() }
                  }}
                  placeholder={'Search'}
                  tabIndex={searchOpen ? 0 : -1}
                  className={[
                    'min-w-0 flex-1 bg-transparent py-1.5 pr-1 text-[12.5px] text-text-primary caret-text-primary placeholder:text-text-muted/70 outline-none transition-opacity duration-200 focus:outline-none focus-visible:outline-none',
                    searchOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                  ].join(' ')}
                />
                {searchOpen && search && (
                  <button
                    type="button"
                    onClick={() => { setSearch(''); searchRef.current?.focus() }}
                    aria-label="Clear search"
                    className="mr-1 grid h-5 w-5 shrink-0 place-items-center rounded text-text-muted hover:bg-elevated/60 hover:text-text-primary"
                  >
                    <IconClose size={9} />
                  </button>
                )}
              </div>
          </div>
        </div>
        {typeFilter !== 'system' && typeFilter !== 'templates' && typeFilter !== 'tokens' && (folders.length > 0 || newFolderOpen) && (
          <div className="-mt-1 mb-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-medium text-text-muted">Folders</span>
            <FolderChip active={folderFilter === 'all'} onClick={() => setFolderFilter('all')} label="All" />
            {folders.map((f) => (
              <FolderChip key={f} active={folderFilter === f} onClick={() => setFolderFilter(f)} label={f} count={folderCount(f)} onRemove={() => removeFolder(f)} />
            ))}
            {newFolderOpen && (
              <input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createFolder(newFolderName); if (e.key === 'Escape') { setNewFolderOpen(false); setNewFolderName('') } }}
                onBlur={() => createFolder(newFolderName)} placeholder="Folder name…"
                className="w-36 rounded-md bg-elevated px-2 py-1 text-[12px] text-text-primary focus:outline-none" />
            )}
          </div>
        )}
        </div>
        )}

        <div className={tokensFull ? 'min-h-0 flex-1' : 'pb-10'}>
        {typeFilter === 'system' ? (
          <DesignSystemView openSystemId={pendingDsId} onConsumeOpen={() => setPendingDsId(null)} />
        ) : typeFilter === 'tokens' ? (
          <TokensView onFullPage={setTokensFull} />
        ) : typeFilter === 'templates' ? (
          <TemplatesGallery onUse={createFromTemplate} />
        ) : designs.length === 0 ? (
          <EmptyState noun={scope === 'form' ? 'form' : 'design'} onCreate={() => { if (scope === 'form') void createFreeform(); else openHtmlWizard() }} />
        ) : (
          <>
            {buckets.length === 0 ? (
              <div className="rounded-xl bg-surface/40 px-6 py-10 text-center text-[13px] text-text-muted">
                No {scope === 'form' ? 'forms' : 'designs'} match.
              </div>
            ) : viewMode === 'list' ? (
              <div className="overflow-hidden">
                {/* table header */}
                <div className="grid grid-cols-[minmax(0,1fr)_140px_140px_160px] items-center gap-4 px-3 pb-2 text-[11.5px] font-medium text-text-muted">
                  <span>Name</span><span>Edited</span><span>Created</span><span>Created by</span>
                </div>
                {buckets.flatMap((b) => b.items).map((d) => (
                  <DesignRow key={d.id} design={d} onOpen={() => onOpen(d)} onDelete={() => setConfirmDelete(d)} folders={folders} folder={designFolders[d.id] ?? null} onAssign={assignFolder} />
                ))}
              </div>
            ) : (
              <div className="space-y-7">
                {buckets.map((b) => (
                  <section key={b.id}>
                    <h2 className="mb-2.5 text-[11.5px] font-medium text-text-muted">
                      {b.label}
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {b.items.map((d) => (
                        <DesignCard
                          key={d.id}
                          design={d}
                          onOpen={() => onOpen(d)}
                          onDelete={() => setConfirmDelete(d)}
                          folders={folders}
                          folder={designFolders[d.id] ?? null}
                          onAssign={assignFolder}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}

        {confirmDelete && (
          <ConfirmDelete
            design={confirmDelete}
            onCancel={() => setConfirmDelete(null)}
            onConfirm={() => void remove(confirmDelete)}
          />
        )}
        </div>

        {wizardOpen && (
          <DesignWizard
            initialIdea={wizardInitialIdea}
            target={wizardTarget}
            starterTemplate={wizardStarter ?? undefined}
            creating={creating}
            onCancel={() => { if (!creating) { setWizardOpen(false); setWizardInitialIdea(''); setWizardStarter(null) } }}
            onComplete={(brief, kickoff) => void handleWizardComplete(brief, kickoff)}
          />
        )}
        {dsWizardOpen && (
          <DesignSystemWizard
            onCancel={() => setDsWizardOpen(false)}
            onComplete={(gen: DesignSystem) => { upsertSystem(gen); setDsWizardOpen(false); setTypeFilter('system'); setPendingDsId(gen.id) }}
          />
        )}
      </div>
    </div>
  )
}

function FolderChip({ active, onClick, label, count, onRemove }: { active: boolean; onClick: () => void; label: string; count?: number; onRemove?: () => void }): JSX.Element {
  return (
    <span className={['group inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] transition-colors', active ? 'bg-elevated text-text-primary' : 'text-text-secondary hover:bg-elevated/60 hover:text-text-primary'].join(' ')}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5">
        {onRemove
          ? <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 4.5a1 1 0 0 1 1-1h3l1.2 1.2H13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" /></svg>
          : <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 4h5l1 1.5h6v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" opacity="0.0" /><rect x="2" y="3.5" width="12" height="9.5" rx="1.2" /></svg>}
        <span>{label}</span>
        {count != null && count > 0 && <span className="text-[10px] text-text-muted">{count}</span>}
      </button>
      {onRemove && <button type="button" onClick={onRemove} title="Delete folder" className="grid h-3.5 w-3.5 place-items-center rounded text-text-muted opacity-0 hover:text-error group-hover:opacity-100"><IconClose size={8} /></button>}
    </span>
  )
}

/** A small folder-assignment menu shared by the grid card and list row. */
function FolderAssign({ id, current, folders, onAssign }: { id: string; current: string | null; folders: string[]; onAssign: (id: string, folder: string | null) => void }): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent): void => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }} title={current ? `In folder: ${current}` : 'Move to folder'}
        className={['grid h-7 w-7 place-items-center rounded-md hover:bg-bg', current ? 'text-text-secondary' : 'text-text-muted'].join(' ')}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="3.5" width="12" height="9.5" rx="1.2" /><path d="M2 6h12" /></svg>
      </button>
      {open && (
        <div className="t42-menu absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-lg bg-raised py-1 shadow-overlay">
          <div className="px-3 py-1 text-[11px] font-medium text-text-muted">Move to folder</div>
          <button type="button" onClick={(e) => { e.stopPropagation(); onAssign(id, null); setOpen(false) }} className={['flex w-full items-center px-3 py-1.5 text-left text-[12px] hover:bg-elevated', !current ? 'text-text-primary' : 'text-text-secondary'].join(' ')}>No folder</button>
          {folders.map((f) => (
            <button key={f} type="button" onClick={(e) => { e.stopPropagation(); onAssign(id, f); setOpen(false) }} className={['flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] hover:bg-elevated', current === f ? 'text-text-primary' : 'text-text-secondary'].join(' ')}>
              <span className="truncate">{f}</span>{current === f && <span>✓</span>}
            </button>
          ))}
          {folders.length === 0 && <div className="px-3 py-1.5 text-[11.5px] text-text-muted">No folders yet</div>}
        </div>
      )}
    </div>
  )
}

function EmptyState({ noun, onCreate }: { noun: 'form' | 'design'; onCreate: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-elevated text-accent">
        <IconEdit size={20} />
      </div>
      <h2 className="text-[15px] font-medium text-text-primary">No {noun}s yet</h2>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-action px-3 py-1.5 text-[13px] font-medium text-action-text transition-opacity hover:opacity-90"
      >
        <IconPlus size={13} />
        <span>Create your first {noun}</span>
      </button>
    </div>
  )
}

function ViewPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
        active ? 'bg-raised text-text-primary shadow-row' : 'text-text-secondary hover:text-text-primary'
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function DesignCard({ design, onOpen, onDelete, folders, folder, onAssign }: {
  design: Design
  onOpen: () => void
  onDelete: () => void
  folders: string[]
  folder: string | null
  onAssign: (id: string, folder: string | null) => void
}): JSX.Element {
  const ageLabel = formatAge(design.lastActiveAt)
  // Lazily fetch the latest version so the card can render a real preview
  // (iframe of the HTML, or PDF preview for pptx). Falls back to the
  // pencil placeholder if no version exists yet.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewKind, setPreviewKind] = useState<'html' | 'pptx' | null>(null)
  useEffect(() => {
    let cancelled = false
    void window.terminal42.designs.listVersions(design.id).then((vs) => {
      if (cancelled) return
      const latest = vs[vs.length - 1]
      if (!latest) { setPreviewUrl(null); setPreviewKind(null); return }
      // Prefer the rendered .pdf for pptx versions; fall back to the .pptx
      // url which won't render natively.
      if (latest.kind === 'pptx') {
        setPreviewUrl(latest.previewUrl ?? null)
        setPreviewKind('pptx')
      } else {
        setPreviewUrl(latest.fileUrl)
        setPreviewKind('html')
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [design.id, design.currentVersion, design.lastActiveAt])

  return (
    <div className="group relative flex w-full flex-col gap-3 rounded-xl bg-surface p-4 transition-colors hover:bg-elevated">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full min-w-0 flex-1 flex-col gap-3 text-left"
      >
        <div className="relative h-32 w-full overflow-hidden rounded-lg bg-elevated">
          {previewUrl
            ? (
              <div className="pointer-events-none absolute left-0 top-0 origin-top-left bg-white"
                style={{
                  // Render at 1280 x 800 logical and scale to ~280 px wide
                  // (card width minus padding) so the preview reads as a
                  // proper screenshot of the design.
                  width: 1280,
                  height: 800,
                  transform: 'scale(0.22)',
                  transformOrigin: 'top left'
                }}
              >
                <iframe
                  src={previewUrl}
                  title={design.title}
                  scrolling="no"
                  className="block h-full w-full border-0 bg-white"
                />
              </div>
            )
            : (
              <div className="grid h-full w-full place-items-center text-text-muted transition-colors group-hover:text-accent">
                <IconEdit size={22} />
              </div>
            )}
          {previewKind === 'pptx' && (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/40 px-1.5 py-0.5 text-[9.5px] font-medium text-white">
              pptx
            </span>
          )}
        </div>
        <div className="w-full min-w-0">
          <div className="block w-full truncate text-[14px] font-medium text-text-primary">
            {design.title}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-text-muted">
            <span>{ageLabel}</span>
            {folder && <><span>·</span><span className="truncate text-text-secondary">{folder}</span></>}
          </div>
        </div>
      </button>
      <TokensFlag designId={design.id} />
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <FolderAssign id={design.id} current={folder} folders={folders} onAssign={onAssign} />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Delete design"
          className="grid h-7 w-7 place-items-center rounded-md text-text-muted hover:bg-elevated hover:text-error"
        >
          <IconTrash size={11} />
        </button>
      </div>
    </div>
  )
}

/** A single design as a table row (list view): thumbnail + name, edited, created, author. */
function DesignRow({ design, onOpen, onDelete, folders, folder, onAssign }: { design: Design; onOpen: () => void; onDelete: () => void; folders: string[]; folder: string | null; onAssign: (id: string, folder: string | null) => void }): JSX.Element {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void window.terminal42.designs.listVersions(design.id).then((vs) => {
      if (cancelled) return
      const latest = vs[vs.length - 1]
      setPreviewUrl(latest && latest.kind !== 'pptx' ? latest.fileUrl : latest?.previewUrl ?? null)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [design.id, design.currentVersion, design.lastActiveAt])
  return (
    <div className="group grid grid-cols-[minmax(0,1fr)_140px_140px_160px] items-center gap-4 rounded-lg px-3 py-2 transition-colors hover:bg-elevated">
      <div className="flex min-w-0 items-center gap-2">
      <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-3 text-left">
        <span className="relative grid h-10 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-elevated text-text-muted">
          {previewUrl
            ? <div className="pointer-events-none absolute left-0 top-0 origin-top-left bg-white" style={{ width: 1280, height: 800, transform: 'scale(0.044)', transformOrigin: 'top left' }}><iframe src={previewUrl} title={design.title} scrolling="no" className="block h-full w-full border-0 bg-white" /></div>
            : <IconEdit size={14} />}
        </span>
        <span className="min-w-0 truncate text-[13.5px] font-medium text-text-primary">{design.title}</span>
      </button>
      <TokensFlag designId={design.id} />
      </div>
      <span className="truncate text-[12px] text-text-muted">{formatAge(design.lastActiveAt)}</span>
      <span className="truncate text-[12px] text-text-muted">{formatAge(design.createdAt)}</span>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-text-muted">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-elevated text-[9px] font-semibold text-text-secondary">You</span>
          {folder && <span className="truncate text-text-secondary">{folder}</span>}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <FolderAssign id={design.id} current={folder} folders={folders} onAssign={onAssign} />
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete() }} title="Delete design" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-muted hover:bg-bg hover:text-error">
            <IconTrash size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Says so when the library a design was built against has moved since.
 *
 * Renders nothing at all in every other case, which is nearly every design
 * nearly all of the time. A row that always carried a "library: fine" chip
 * would train everyone to stop reading the column, and then the one row that
 * mattered would be invisible too.
 *
 * Re-syncing rewrites the token files beside the design, which is the entire
 * fix for a design that used the variables. One that inlined a hex instead
 * cannot be fixed by new files, so what could not be relinked is reported
 * rather than quietly dropped — the chip stays, saying how many, instead of
 * disappearing and implying the job is done.
 */
function TokensFlag({ designId }: { designId: string }): JSX.Element | null {
  const [moved, setMoved] = useState(false)
  const [missing, setMissing] = useState(false)
  const [name, setName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [stuck, setStuck] = useState<string[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.terminal42.designs.tokensStatus(designId).then((s) => {
      if (cancelled) return
      setMoved(s.bound && s.moved)
      setMissing(s.missing)
      setName(s.name)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [designId])

  const resync = async (): Promise<void> => {
    setBusy(true)
    try {
      const r = await window.terminal42.designs.resyncTokens(designId)
      if (r.ok) {
        setMoved(false)
        setStuck(r.stuck.length > 0 ? r.stuck : null)
      }
    } finally {
      setBusy(false)
    }
  }

  if (stuck) {
    return (
      <span
        title={stuck.join('\n')}
        className="shrink-0 self-start rounded-full bg-elevated px-2 py-0.5 text-[10.5px] text-text-secondary"
      >
        {stuck.length === 1 ? '1 value off the library' : `${stuck.length} values off the library`}
      </span>
    )
  }
  if (missing) {
    // Not a button: there is nothing here to put right in one click, since the
    // library it wants no longer exists. Saying so is the whole job.
    return (
      <span
        title="This design is bound to a library that has been deleted, so nothing from it is being put in the prompt or checked. Bind it to another one."
        className="shrink-0 self-start rounded-full bg-elevated px-2 py-0.5 text-[10.5px] text-text-secondary"
      >
        Library missing
      </span>
    )
  }
  if (!moved) return null
  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => { e.stopPropagation(); void resync() }}
      title={name ? `${name} has changed since this design was built. Rewrite its token files.` : undefined}
      className="shrink-0 self-start rounded-full bg-elevated px-2 py-0.5 text-[10.5px] text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-60"
    >
      {busy ? 'Re-syncing…' : 'Library updated · Re-sync'}
    </button>
  )
}

function ConfirmDelete({ design, onCancel, onConfirm }: {
  design: Design
  onCancel: () => void
  onConfirm: () => void
}): JSX.Element {
  return (
    <div className="t42-scrim fixed inset-0 z-50 grid place-items-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-raised p-5 shadow-overlay">
        <h3 className="text-[15px] font-medium text-text-primary">Delete this design?</h3>
        <p className="mt-1.5 text-[13px] text-text-muted">
          “{design.title}” and all its versions will be removed permanently.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-[13px] text-text-secondary hover:bg-elevated hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-error px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

