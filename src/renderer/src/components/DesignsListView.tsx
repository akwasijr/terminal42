import { useEffect, useMemo, useRef, useState } from 'react'
import type { Design, DesignBrief, DesignGroup, TemplateInfo } from '../../../preload/index'
import { DesignWizard } from './DesignWizard'
import { TemplatesGallery } from './TemplatesGallery'
import { IconClose, IconEdit, IconPlus, IconSearch, IconTrash } from './icons'

// Pretty labels for the kind-group filter chips at the top of the page.
const GROUP_LABEL: Record<DesignGroup, string> = {
  web: 'Web', app: 'App', presentation: 'Decks', content: 'Content',
  print: 'Print', data: 'Data', social: 'Social', figma: 'Figma', other: 'Other'
}
// Display order for the chip row. Keeps the most common kinds on the left.
const GROUP_ORDER: DesignGroup[] = ['web', 'app', 'presentation', 'content', 'print', 'data', 'social', 'figma', 'other']

export function DesignsListView({
  onOpen,
  seed,
  onSeedConsumed
}: {
  onOpen: (design: Design) => void
  seed?: { idea: string } | null
  onSeedConsumed?: () => void
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
  const [groupFilter, setGroupFilter] = useState<DesignGroup | 'all'>('all')
  // Top-level view mode: the user's own designs vs. the templates gallery.
  const [view, setView] = useState<'mine' | 'templates'>('mine')
  // Import
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const [importingGit, setImportingGit] = useState(false)
  const [gitUrl, setGitUrl] = useState('')
  const importMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!importMenuOpen) return
    const handler = (e: MouseEvent): void => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) setImportMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [importMenuOpen])

  const importFromFolder = async (): Promise<void> => {
    setImportMenuOpen(false)
    try {
      const res = await window.terminal42.designs.importFolder()
      if (res.ok && res.design) {
        await refresh()
        onOpen(res.design)
      } else if (res.error && res.error !== 'Cancelled') {
        alert(`Import failed: ${res.error}`)
      }
    } catch (err) {
      alert(`Import failed: ${String(err)}`)
    }
  }

  const importFromGit = async (): Promise<void> => {
    const url = gitUrl.trim()
    if (!url) return
    setImportingGit(true)
    try {
      const res = await window.terminal42.designs.importGit(url)
      if (res.ok && res.design) {
        setImportMenuOpen(false)
        setGitUrl('')
        await refresh()
        onOpen(res.design)
      } else {
        alert(`Import failed: ${res.error ?? 'Unknown error'}`)
      }
    } catch (err) {
      alert(`Import failed: ${String(err)}`)
    } finally {
      setImportingGit(false)
    }
  }
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

  const openFigmaWizard = (): void => {
    setWizardTarget('figma')
    setWizardInitialIdea('')
    setWizardOpen(true)
  }
  const openHtmlWizard = (): void => {
    setWizardTarget('html')
    setWizardInitialIdea('')
    setWizardOpen(true)
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

  // Counts per group for the filter-chip badges.
  const groupCounts = useMemo<Record<DesignGroup | 'all', number>>(() => {
    const out: Record<string, number> = { all: designs.length }
    for (const g of GROUP_ORDER) out[g] = 0
    for (const d of designs) {
      const g = (d.brief?.group ?? 'other') as DesignGroup
      out[g] = (out[g] ?? 0) + 1
    }
    return out as Record<DesignGroup | 'all', number>
  }, [designs])

  // Apply search + group filter, then bucket by recency.
  const buckets = useMemo(() => {
    const q = search.trim().toLowerCase()
    const visible = designs.filter((d) => {
      if (groupFilter !== 'all' && (d.brief?.group ?? 'other') !== groupFilter) return false
      if (!q) return true
      const hay = [
        d.title,
        d.brief?.kindLabel ?? '',
        d.brief?.subtype ?? '',
        d.brief?.idea ?? '',
        d.brief?.audience ?? '',
        d.brief?.lookLabel ?? ''
      ].join(' ').toLowerCase()
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
    // Sort each bucket by lastActiveAt descending.
    for (const b of out) b.items.sort((a, c) => c.lastActiveAt - a.lastActiveAt)
    return out.filter((b) => b.items.length > 0)
  }, [designs, search, groupFilter])

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden bg-bg">
      <div className="mx-auto max-w-6xl px-8 pt-10">
        <div className="sticky top-0 z-10 bg-bg pb-4">
          <header className="mb-4 flex items-center justify-between gap-4">
          <h1 className="text-[20px] font-semibold text-text-primary">Design</h1>
          <div className="flex items-center gap-2">
            <div className="relative" ref={importMenuRef}>
              <button
                type="button"
                onClick={() => setImportMenuOpen((o) => !o)}
                className="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-elevated px-3 py-1.5 text-[13px] font-medium text-text-primary transition-colors hover:bg-elevated/70"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12v1h10v-1"/></svg>
                Import
              </button>
              {importMenuOpen && (
                <div className="absolute right-0 top-full z-30 mt-1 w-[300px] rounded-lg bg-elevated p-1.5 shadow-lg">
                  {/* Local */}
                  <button
                    type="button"
                    onClick={() => void importFromFolder()}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left outline-none hover:bg-surface"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-bg text-text-muted">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5.5V12a1 1 0 001 1h10a1 1 0 001-1V6.5a1 1 0 00-1-1H8L6.5 4H3a1 1 0 00-1 1.5z"/></svg>
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[12.5px] font-medium text-text-primary">Local folder</span>
                      <span className="text-[11px] text-text-muted">Import from your machine</span>
                    </div>
                  </button>

                  {/* Git */}
                  <div className="mt-1 rounded-md px-3 py-2.5">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-bg text-text-muted">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M15.698 7.287L8.712.302a1.03 1.03 0 00-1.457 0l-1.45 1.45 1.84 1.84a1.223 1.223 0 011.55 1.56l1.773 1.774a1.224 1.224 0 11-.733.684L8.535 5.91v4.202a1.224 1.224 0 11-1.007-.02V5.834a1.224 1.224 0 01-.664-1.606L5.05 2.415.302 7.163a1.03 1.03 0 000 1.457l6.986 6.986a1.03 1.03 0 001.457 0l6.953-6.953a1.031 1.031 0 000-1.457z"/></svg>
                      </span>
                      <div className="flex flex-col">
                        <span className="text-[12.5px] font-medium text-text-primary">Git repository</span>
                        <span className="text-[11px] text-text-muted">Clone from a URL</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={gitUrl}
                        onChange={(e) => setGitUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void importFromGit() }}
                        placeholder="https://github.com/user/repo"
                        className="flex-1 rounded-md bg-bg px-2.5 py-1.5 text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void importFromGit()}
                        disabled={!gitUrl.trim() || importingGit}
                        className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-text transition-opacity hover:opacity-90 disabled:opacity-40"
                      >
                        {importingGit ? 'Cloning…' : 'Clone'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={openFigmaWizard}
              disabled={creating}
              title="Build directly in Figma: full wizard, then straight to a Figma file via MCP"
              className="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-elevated px-3 py-1.5 text-[13px] font-medium text-text-primary transition-colors hover:bg-elevated/70 disabled:opacity-50"
            >
              <FigmaPillSm />
              <span>Build in Figma</span>
            </button>
            <button
              type="button"
              onClick={openHtmlWizard}
              disabled={creating}
              className="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-text transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <IconPlus size={13} />
              <span>{creating ? 'Creating\u2026' : 'New design'}</span>
            </button>
          </div>
        </header>

        {/* View toggle: My designs / Templates */}
        <div className="mb-2 inline-flex items-center gap-1 rounded-lg bg-elevated p-1">
          <ViewPill active={view === 'mine'} onClick={() => setView('mine')}>My designs</ViewPill>
          <ViewPill active={view === 'templates'} onClick={() => setView('templates')}>Templates</ViewPill>
        </div>
        </div>

        <div className="pb-10">
        {view === 'templates' ? (
          <TemplatesGallery onUse={createFromTemplate} />
        ) : designs.length === 0 ? (
          <EmptyState onCreate={openHtmlWizard} />
        ) : (
          <>
            {/* Toolbar: search icon -> expanding pill, kind-group filter chips.
                The chips no longer carry counts (cleaner). The search icon
                expands smoothly to a full input on click; clicking the X
                clears + collapses. */}
            <div className="mb-5 flex items-center gap-2">
              {/* Filter chips */}
              <div className="flex flex-1 flex-wrap items-center gap-1">
                <FilterChip
                  label="All"
                  active={groupFilter === 'all'}
                  onClick={() => setGroupFilter('all')}
                />
                {GROUP_ORDER.filter((g) => groupCounts[g] > 0).map((g) => (
                  <FilterChip
                    key={g}
                    label={GROUP_LABEL[g]}
                    active={groupFilter === g}
                    onClick={() => setGroupFilter(g)}
                  />
                ))}
              </div>

              {/* Search: collapsed = icon button, expanded = animated pill */}
              <div
                className={[
                  'flex items-center overflow-hidden rounded-md bg-elevated transition-[width,background-color] duration-300 ease-out',
                  searchOpen ? 'w-[280px]' : 'w-8 hover:bg-elevated/70'
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
                  placeholder={'Search by title, idea, audience\u2026'}
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

            {buckets.length === 0 ? (
              <div className="rounded-xl bg-surface/40 px-6 py-10 text-center text-[13px] text-text-muted">
                No designs match.
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
      </div>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-elevated text-accent">
        <IconEdit size={20} />
      </div>
      <h2 className="text-[15px] font-medium text-text-primary">No designs yet</h2>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-text transition-opacity hover:opacity-90"
      >
        <IconPlus size={13} />
        <span>Create your first design</span>
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
        active ? 'bg-bg text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function DesignCard({ design, onOpen, onDelete }: {
  design: Design
  onOpen: () => void
  onDelete: () => void
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
            {design.currentVersion && <><span>·</span><span>{design.currentVersion}</span></>}
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        title="Delete design"
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-text-muted opacity-0 transition-opacity hover:bg-elevated hover:text-error group-hover:opacity-100"
      >
        <IconTrash size={11} />
      </button>
    </div>
  )
}

function ConfirmDelete({ design, onCancel, onConfirm }: {
  design: Design
  onCancel: () => void
  onConfirm: () => void
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-surface p-5 shadow-xl">
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

function formatAge(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

function FilterChip({ label, active, onClick }: {
  label: string
  active: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center rounded-md px-2.5 py-1 text-[11.5px] transition-colors',
        active
          ? 'bg-accent/15 text-accent'
          : 'bg-elevated/60 text-text-secondary hover:bg-elevated hover:text-text-primary'
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function FigmaPillSm(): JSX.Element {
  return (
    <svg width="11" height="13" viewBox="0 0 24 32" aria-hidden="true">
      <path fill="#F24E1E" d="M8 0a4 4 0 0 0 0 8h4V0H8z" />
      <path fill="#A259FF" d="M8 8a4 4 0 0 0 0 8h4V8H8z" />
      <path fill="#0ACF83" d="M8 16a4 4 0 0 0 0 8h4v-8H8z" />
      <path fill="#FF7262" d="M12 0h4a4 4 0 0 1 0 8h-4V0z" />
      <circle fill="#1ABCFE" cx="16" cy="12" r="4" />
    </svg>
  )
}
