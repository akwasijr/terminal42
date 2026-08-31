// Tokens: the shared library a team and its agents both work from.
//
// A token is a value with a name, and of the two the value is the one you
// recognise. So a colour is drawn as a colour, a spacing as a bar at its true
// width, a size as a line of type set at it. The name goes underneath, small.
// A tree of dot paths would be truthful and useless.
//
// The screen is organised by category, not by tier, because nobody arrives
// thinking "show me the semantic tier": they arrive needing a colour, or
// wanting to know what the body font is. Tier is a lens inside each category
// instead, and it opens on the names people actually reference rather than on
// the raw shelf underneath them.
//
// A family is drawn once. Eleven steps of a ramp are one strip, not eleven
// tiles, which is the difference between a library and a wall of colour.
//
// Selecting a token dims everything except what it points at and what points
// at it. That one gesture is the whole idea of aliasing, and it teaches it
// faster than any amount of writing on the subject.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Vibe } from '../../lib/designSystem'
import { CardMenu, ConfirmDelete } from '../CardMenu'
import { FolderBar } from '../FolderBar'
import { useFolders } from '../../lib/designFolders'
import { TokensSetup } from './TokensSetup'
import { takeNewTokensRequest, takeNewTokensFeel, takeLibraryRequest } from '../../lib/tokens/openLatch'
import {
  hydrateStudio,
  isAlias,
  aliasTarget,
  TIERS,
  TOKEN_TYPES,
  type TokenType,
  type Tier,
  type Token,
  type TokenStudio,
  type TokenValue,
  type SetState,
  cssOptionsOf,
  countTokens as countStudioTokens,
  enforcementOf,
  type CssOptions,
  type Enforcement
} from '../../../../shared/tokens/types'
import { toCSS } from '../../../../shared/tokens/export'
import { flatten, problems, resolve, type Problem } from '../../../../shared/tokens/resolve'
import { familiesOf, leafOf, SECTIONS, sectionOf, type Family, type SectionId } from '../../../../shared/tokens/groups'
import { addToken, blankValue, deleteToken, renameToken, setAlias, setDeprecated, setTokenValue } from '../../../../shared/tokens/edit'
import {
  bulkDelete,
  bulkMove,
  bulkRename,
  bulkRetire,
  bulkRetype,
  sweepNote,
  type BulkResult
} from '../../../../shared/tokens/bulk'
import { bridgeSummary, brandItems } from '../../../../shared/tokens/bridges'
import { coverageAcross, gapsBySection } from '../../../../shared/tokens/coverage'
import { fillGaps, fillNote } from '../../../../shared/tokens/harden'
import { cloneStudio } from '../../../../shared/tokens/scaffold'
import {
  folderState,
  renameFolder,
  renameSet,
  setFolderState,
  treeOfSets,
  type SetNode
} from '../../../../shared/tokens/sets'
import { fromTokensText } from '../../../../shared/tokens/import'
import { tokenLibrariesChanged } from '../../lib/tokens/useTokenLibraries'
import { publishToForm } from '../../lib/tokens/toForm'
import { TokenInspector } from './TokenInspector'
import { ColorPicker, type PickerRequest } from '../ColorPicker'

type StudioRow = { id: string; name: string; studio: unknown; updatedAt: number }

export function TokensView({ onFullPage }: { onFullPage?: (full: boolean) => void }): React.JSX.Element {
  const [rows, setRows] = useState<StudioRow[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [studio, setStudio] = useState<TokenStudio | null>(null)
  const [loading, setLoading] = useState(true)
  const [setupOpen, setSetupOpen] = useState(false)
  const [startFrom, setStartFrom] = useState<Vibe | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<StudioRow | null>(null)
  const [importNote, setImportNote] = useState<string | null>(null)
  // Token libraries keep their own folders, separate from the ones over
  // designs: a folder called "Acme" here is not the one over the decks.
  const folderStore = useFolders('tokens')
  const [folderFilter, setFolderFilter] = useState('all')
  const [addingFolder, setAddingFolder] = useState(false)
  const ownedHere = (id: string): boolean => rows.some((r) => r.id === id)
  const visible = folderFilter === 'all' ? rows : rows.filter((r) => folderStore.folderOf(r.id) === folderFilter)

  const refresh = async (): Promise<void> => {
    const list = (await window.terminal42.tokens.list()) as StudioRow[]
    setRows(list)
    setLoading(false)
    // Chat, Motion and the canvas each hold their own copy of this list, and
    // some of them mount once for a whole session. Tell them.
    tokenLibrariesChanged()
  }
  useEffect(() => {
    void refresh()
  }, [])

  // Starting a library is a New action, and New lives in one button at the top
  // of the page. That button is in the designs list, which cannot reach in
  // here, so it knocks and this answers. Kept alongside 't42:tokens-open',
  // which is the same arrangement for getting to the list in the first place.
  useEffect(() => {
    const onNew = (): void => {
      // Drains the latch as well, so a press heard live here does not leave a
      // request behind that reopens the setup the next time this mounts.
      takeNewTokensRequest()
      setStartFrom((takeNewTokensFeel() as Vibe | null) ?? null)
      setOpenId(null)
      setSetupOpen(true)
    }
    // A template can name the feel it wants the wizard to open on.
    const onNewFrom = (e: Event): void => {
      const vibe = (e as CustomEvent<{ vibe?: Vibe }>).detail?.vibe
      setStartFrom(vibe ?? null)
      setOpenId(null)
      setSetupOpen(true)
    }
    // A design system knows which library it stands on, and had no way to send
    // anybody there: the menu offered to make a second one instead. Heard live
    // and taken on mount, because the tab switch happens first and this screen
    // is not listening yet when the request is made.
    const openLibrary = (id: string): void => {
      setSetupOpen(false)
      void (async () => {
        try {
          const row = await window.terminal42.tokens.get(id)
          if (!row) return
          setOpenId(row.id)
          setStudio(hydrateStudio(row.studio))
        } catch { /* a library that will not open is left closed */ }
      })()
    }
    const onOpenLibrary = (e: Event): void => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id ?? takeLibraryRequest()
      if (id) openLibrary(id)
    }
    const waiting = takeLibraryRequest()
    if (waiting) openLibrary(waiting)
    window.addEventListener('t42:tokens-open-library', onOpenLibrary as EventListener)
    window.addEventListener('t42:tokens-new-from', onNewFrom as EventListener)
    // Something outside this view can add a library — duplicating a template
    // does. Without this the list only caught up on a remount, which happened
    // to be true and would have stopped being true silently.
    const onChanged = (): void => { void refresh() }
    window.addEventListener('t42:tokens-changed', onChanged)
    // Taken on mount as well as heard live, because the first press arrives
    // before this component exists: the tab has to switch first.
    if (takeNewTokensRequest()) { setStartFrom((takeNewTokensFeel() as Vibe | null) ?? null); setOpenId(null); setSetupOpen(true) }
    window.addEventListener('t42:tokens-new', onNew)
    return () => {
      window.removeEventListener('t42:tokens-new', onNew)
      window.removeEventListener('t42:tokens-new-from', onNewFrom as EventListener)
      window.removeEventListener('t42:tokens-open-library', onOpenLibrary as EventListener)
      window.removeEventListener('t42:tokens-changed', onChanged)
    }
  }, [])

  // An open library takes the whole page: the surrounding tab chrome belongs to
  // a list of designs, and a library is not one of them. Told, not assumed, so
  // the page that owns the padding is the page that drops it.
  const full = openId !== null && studio !== null
  const tellFull = useRef(onFullPage)
  tellFull.current = onFullPage
  useEffect(() => {
    tellFull.current?.(full)
    return () => tellFull.current?.(false)
  }, [full])

  const create = async (built: TokenStudio): Promise<void> => {
    const row = await window.terminal42.tokens.create(built.name, built)
    setSetupOpen(false)
    await refresh()
    setOpenId(row.id)
    setStudio(built)
  }

  // Cloning is the third way a library starts, next to a feel and a brief:
  // you liked one that exists and want to move away from it a little.
  const duplicate = async (row: StudioRow): Promise<void> => {
    const copy = cloneStudio(hydrateStudio(row.studio), `${row.name} copy`)
    await window.terminal42.tokens.create(copy.name, copy)
    await refresh()
  }

  // A file is read here rather than through the main process: a token file is
  // small, the renderer can read it, and one less hop is one less thing to
  // keep in step.
  const bringIn = async (file: File): Promise<void> => {
    const name = file.name.replace(/\.json$/i, '') || 'Imported'
    const { studio: built, notes } = fromTokensText(await file.text(), name)
    setImportNote(notes.length > 0 ? notes.join(' ') : null)
    if (built.sets.every((x) => x.tokens.length === 0)) return
    await create(built)
  }

  const remove = async (id: string): Promise<void> => {
    await window.terminal42.tokens.delete(id)
    await refresh()
  }

  // Every change is written straight through. A studio is small, and there is
  // no save button anywhere else in this app.
  const patch = (next: TokenStudio): void => {
    setStudio(next)
    if (openId) void window.terminal42.tokens.save(openId, next)
  }

  if (openId && studio) {
    return (
      <StudioEditor
        studio={studio}
        onChange={patch}
        onRename={(name) => {
          patch({ ...studio, name })
          void window.terminal42.tokens.rename(openId, name)
        }}
        onClose={() => {
          setOpenId(null)
          setStudio(null)
          void refresh()
        }}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-3 pb-3">
        <button
          type="button"
          onClick={() => setAddingFolder(true)}
          className="shrink-0 rounded-md px-3 py-1.5 text-[13px] text-text-secondary hover:bg-raised hover:text-text-primary"
        >
          New folder
        </button>
        <label className="shrink-0 cursor-pointer rounded-md px-3 py-1.5 text-[13px] text-text-secondary hover:bg-raised hover:text-text-primary focus-within:ring-2 focus-within:ring-accent/60">
          Import
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void bringIn(file)
            }}
          />
        </label>
      </div>

      {importNote ? (
        <p className="mb-3 rounded-md bg-surface px-3 py-2 text-[11.5px] text-text-secondary">{importNote}</p>
      ) : null}

      <FolderBar
        folders={folderStore.folders}
        filter={folderFilter}
        onFilter={setFolderFilter}
        count={(f) => folderStore.count(f, ownedHere)}
        onCreate={(name) => { if (folderStore.create(name)) setFolderFilter(name.trim()) }}
        onRemove={(name) => { folderStore.remove(name, ownedHere); if (folderFilter === name) setFolderFilter('all') }}
        adding={addingFolder}
        onAddingChange={setAddingFolder}
      />

      {loading ? null : rows.length === 0 ? (
        <p className="rounded-panel bg-surface px-4 py-10 text-center text-[12.5px] text-text-muted">
          Nothing yet. A token library is where a look stops being a habit and starts being a decision
          you can point at.
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-panel bg-surface px-4 py-10 text-center text-[12.5px] text-text-muted">
          No libraries in {folderFilter}.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {visible.map((r) => (
            <li key={r.id} className="group relative">
              <button
                type="button"
                onClick={() => {
                  setOpenId(r.id)
                  setStudio(hydrateStudio(r.studio))
                }}
                className="w-full rounded-panel bg-surface p-3 text-left hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <StudioMark studio={hydrateStudio(r.studio)} />
                <span className="mt-2 block truncate text-[12.5px] text-text-primary">{r.name}</span>
                <span className="block text-[11px] text-text-muted">{countTokens(r.studio)} tokens</span>
              </button>
              <CardMenu
                label={r.name}
                actions={[
                  { label: 'Duplicate', onSelect: () => void duplicate(r) },
                  ...folderStore.folders.map((f) => ({
                    label: folderStore.folderOf(r.id) === f ? `Remove from ${f}` : `Move to ${f}`,
                    onSelect: () => folderStore.assign(r.id, folderStore.folderOf(r.id) === f ? null : f)
                  })),
                  { label: 'Delete', danger: true, onSelect: () => setConfirmDelete(r) }
                ]}
              />
            </li>
          ))}
        </ul>
      )}

      {setupOpen ? (
        <TokensSetup
          startFrom={startFrom ?? undefined}
          onCancel={() => { setSetupOpen(false); setStartFrom(null) }}
          onCreate={(s) => { void create(s); setStartFrom(null) }}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDelete
          name={confirmDelete.name}
          kind="library"
          note="Anything bound to it will fall back to its own values."
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            void remove(confirmDelete.id)
            setConfirmDelete(null)
          }}
        />
      ) : null}
    </div>
  )
}

function countTokens(raw: unknown): number {
  return countStudioTokens(hydrateStudio(raw))
}

/** The first few colours of a studio, so the list is recognisable at a glance. */
function StudioMark({ studio }: { studio: TokenStudio }): React.JSX.Element {
  const map = flatten(studio, studio.activeTheme)
  // Semantic colours first, because they are the ones that carry the brand.
  // Taking whatever came first in the map gives eight shades of a button.
  const wanted = ['colour.brand', 'colour.accent', 'colour.support', 'colour.positive', 'colour.caution', 'colour.critical', 'colour.surface', 'colour.text.primary']
  const seen = new Set<string>()
  const colours: string[] = []
  const take = (path: string): void => {
    if (colours.length === 8 || seen.has(path)) return
    const hit = map.get(path)
    if (!hit || hit.token.type !== 'color') return
    const r = resolve(map, path)
    if (r.ok && typeof r.value === 'string') {
      seen.add(path)
      colours.push(r.value)
    }
  }
  for (const path of wanted) take(path)
  for (const path of map.keys()) take(path)
  if (colours.length === 0) return <span className="block h-10 rounded-md bg-sunken" />
  return (
    <span className="flex h-10 overflow-hidden rounded-md">
      {colours.map((c, i) => (
        <span key={`${c}-${i}`} style={{ background: c }} className="flex-1" />
      ))}
    </span>
  )
}

/** The three ways to look at a category. `use` is the default and the point. */
type Lens = 'use' | 'raw' | 'all'

const LENS_LABEL: Record<Lens, string> = { use: 'In use', raw: 'Raw', all: 'All' }

function StudioEditor({
  studio,
  onChange,
  onRename,
  onClose
}: {
  studio: TokenStudio
  onChange: (s: TokenStudio) => void
  onRename: (name: string) => void
  onClose: () => void
}): React.JSX.Element {
  const [lens, setLens] = useState<Record<string, Lens>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickerRequest | null>(null)
  const [adding, setAdding] = useState<{ setId: string; rect: DOMRect } | null>(null)
  const [onlyProblems, setOnlyProblems] = useState(false)
  const [search, setSearch] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [showSets, setShowSets] = useState(false)
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [here, setHere] = useState<SectionId>('colour')
  const scroller = useRef<HTMLDivElement>(null)

  const themeId = studio.activeTheme
  const map = useMemo(() => flatten(studio, themeId), [studio, themeId])
  const found = useMemo(() => problems(studio, themeId), [studio, themeId])
  const problemPaths = useMemo(() => new Set(found.map((p) => p.path)), [found])

  const selectedToken = selected ? (map.get(selected) ?? null) : null
  const selectedResolved = useMemo(() => {
    if (!selected) return null
    const r = resolve(map, selected)
    return r.ok ? r.value : null
  }, [map, selected])

  // What the selection points at, and what points at it. Everything else is
  // dimmed rather than hidden, so the shape of the set stays visible.
  const related = useMemo(() => {
    if (!selected) return null
    const set = new Set<string>([selected])
    for (const p of resolve(map, selected).through) set.add(p)
    // Walked to a fixed point rather than in one pass, so a component token
    // three aliases above the selection still lights up.
    for (let pass = 0; pass < 8; pass++) {
      let grew = false
      for (const [path, hit] of map) {
        if (set.has(path)) continue
        const target = aliasTarget(hit.token.value)
        if (target && set.has(target)) {
          set.add(path)
          grew = true
        }
      }
      if (!grew) break
    }
    return set
  }, [map, selected])

  /** Every token of the theme, split into the sections, before the lens. */
  const sections = useMemo(() => {
    const by = new Map<SectionId, Array<{ path: string; type: TokenType; tier: Tier }>>()
    const needle = search.trim().toLowerCase()
    for (const [path, hit] of map) {
      if (onlyProblems && !problemPaths.has(path)) continue
      if (needle && !path.toLowerCase().includes(needle)) continue
      const id = sectionOf(hit.token)
      const list = by.get(id)
      const entry = { path, type: hit.token.type, tier: hit.token.tier }
      if (list) list.push(entry)
      else by.set(id, [entry])
    }
    return by
  }, [map, onlyProblems, problemPaths, search])

  const lensOf = (id: SectionId): Lens => lens[id] ?? 'use'

  const visible = (id: SectionId): Family[] => {
    const all = sections.get(id) ?? []
    const l = lensOf(id)
    const kept =
      l === 'all'
        ? all
        : l === 'raw'
          ? all.filter((t) => t.tier === 'primitive')
          : all.filter((t) => t.tier !== 'primitive')
    // A search or a problem filter is an explicit request; honouring the lens
    // on top of it would hide the very thing that was asked for.
    return familiesOf(kept.length === 0 && (search || onlyProblems) ? all : kept)
  }

  const jump = (id: SectionId): void => {
    setHere(id)
    const root = scroller.current
    const el = root?.querySelector<HTMLElement>(`#tokens-${id}`)
    if (!root || !el) return
    // Scrolled by hand rather than with scrollIntoView, which walks every
    // scrollable ancestor and so dragged the whole page up, taking the header
    // and the nav with it. Only this box should move.
    //
    // Measured from the rendered rectangles rather than from offsetTop, which
    // is quoted against whichever ancestor happens to be positioned. The
    // section headers are sticky, and sticky is positioned, so the two figures
    // are read from different origins.
    const delta = el.getBoundingClientRect().top - root.getBoundingClientRect().top
    root.scrollTo({ top: root.scrollTop + delta, behavior: 'smooth' })
  }

  // Which section the reader is actually in, so the nav is a position rather
  // than a memory of the last thing clicked.
  //
  // Read from the scroll position rather than from an intersection observer:
  // "the last section whose top has passed the top of the view" is exactly
  // the question being asked, and an observer only ever answers it indirectly,
  // through a margin that has to be tuned and is wrong on the first paint.
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const read = (): void => {
      const edge = root.getBoundingClientRect().top + 4
      let at: SectionId | null = null
      for (const el of root.querySelectorAll<HTMLElement>('[id^="tokens-"]')) {
        if (el.getBoundingClientRect().top <= edge) at = el.id.replace('tokens-', '') as SectionId
      }
      setHere(at ?? (root.querySelector('[id^="tokens-"]')?.id.replace('tokens-', '') as SectionId))
    }
    read()
    root.addEventListener('scroll', read, { passive: true })
    return () => root.removeEventListener('scroll', read)
  }, [sections])

  const setSetState = (setId: string, state: 'off' | 'source' | 'enabled'): void => {
    onChange({
      ...studio,
      themes: studio.themes.map((t) =>
        t.id === themeId ? { ...t, sets: { ...t.sets, [setId]: state } } : t
      )
    })
  }

  const addSet = (): void => {
    const id = `s${Math.random().toString(36).slice(2, 9)}`
    onChange({
      ...studio,
      sets: [
        ...studio.sets,
        { id, name: `Set ${studio.sets.length + 1}`, order: studio.sets.length, tokens: [] }
      ],
      themes: studio.themes.map((t) => ({
        ...t,
        sets: { ...t.sets, [id]: t.id === themeId ? 'enabled' : 'off' }
      }))
    })
  }

  const addTheme = (): void => {
    const id = `t${Math.random().toString(36).slice(2, 9)}`
    const from = studio.themes.find((t) => t.id === themeId)
    onChange({
      ...studio,
      themes: [
        ...studio.themes,
        { id, name: `Theme ${studio.themes.length + 1}`, sets: { ...(from?.sets ?? {}) } }
      ],
      activeTheme: id
    })
  }

  const exportFiles = async (): Promise<void> => {
    const res = await window.terminal42.tokens.export(studio, themeId)
    setNote(
      res.ok ? `Written to ${res.paths[0].replace(/\/[^/]+$/, '')}` : (res.error ?? 'Nothing written.')
    )
    window.setTimeout(() => setNote(null), 4000)
  }

  const filled = SECTIONS.filter((s) => (sections.get(s.id) ?? []).length > 0)

  // What the library has not decided yet.
  //
  // This used to be a chip in the header reading "Complete", which told you
  // nothing about where the gaps were and sat next to two other chips nobody
  // could read either. The count now hangs off the section it belongs to, so
  // the answer to "not decided where?" is on screen without opening anything.
  //
  // Every theme, not the one showing: a library with layers in Light and none
  // in Dark is not complete, and saying so only when somebody happens to
  // switch theme is how the gap survives.
  const gaps = useMemo(() => {
    const by = new Map<SectionId, { label: string; why: string }[]>()
    for (const g of gapsBySection(coverageAcross(studio))) {
      by.set(g.section, g.missing.map((m) => ({ label: m.check.label, why: m.check.why })))
    }
    return by
  }, [studio])
  const gapCount = useMemo(
    () => [...gaps.values()].reduce((a, b) => a + b.length, 0),
    [gaps]
  )

  const fillTheGaps = (): void => {
    const result = fillGaps(studio, themeId)
    if (result.added.length === 0) return
    onChange(result.studio)
    setNote(fillNote(result))
    window.setTimeout(() => setNote(null), 5000)
  }

  // Gathering tokens up for a sweep. A gathered token is not the selection:
  // the inspector is for one token at a time and showing it alongside a
  // sweep would be two answers to the question of what "this" means.
  const picks = useMemo(
    () =>
      [...marked].flatMap((path) => {
        const hit = map.get(path)
        return hit ? [{ setId: hit.setId, path }] : []
      }),
    [marked, map]
  )

  const shown = useMemo(
    () => filled.flatMap((s) => visible(s.id).flatMap((f) => f.paths)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sections, lens, search, onlyProblems]
  )

  const mark = (path: string): void =>
    setMarked((c) => {
      const next = new Set(c)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const sweep = (result: BulkResult, verb: string): void => {
    onChange(result.studio)
    setMarked(new Set())
    setNote(sweepNote(result, verb))
    window.setTimeout(() => setNote(null), 5000)
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-bg">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 px-6 py-3">
        <button
          type="button"
          onClick={onClose}
          className="-ml-1.5 inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] font-medium text-text-muted transition-colors hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9.5 3.5L5 8l4.5 4.5" />
          </svg>
          Tokens
        </button>
        <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
        <input
          value={studio.name}
          onChange={(e) => onRename(e.target.value)}
          aria-label="Library name"
          className="w-44 min-w-0 rounded-md bg-transparent px-1.5 py-1 text-[15px] font-semibold text-text-primary hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        />

        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-sunken p-1">
          {studio.themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange({ ...studio, activeTheme: t.id })}
              aria-pressed={t.id === themeId}
              className={`rounded-md px-2.5 py-1 text-[11.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                t.id === themeId
                  ? 'bg-bg text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {t.name}
            </button>
          ))}
          <button
            type="button"
            onClick={addTheme}
            aria-label="Add a theme"
            title="Add a theme"
            className="rounded-md px-2 py-1 text-[12px] leading-none text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            +
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <EnforcementPicker
            level={enforcementOf(studio)}
            onPick={(enforcement) => onChange({ ...studio, enforcement })}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a token"
            aria-label="Find a token"
            className="w-40 rounded-md bg-elevated px-2.5 py-1.5 text-[12px] text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          />
          <ExportMenu
            studio={studio}
            themeId={themeId}
            onChange={(css) => onChange({ ...studio, css })}
            onWrite={() => void exportFiles()}
            onDone={(msg) => {
              setNote(msg)
              window.setTimeout(() => setNote(null), 4000)
            }}
          />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 gap-4 px-6 py-4">
        <nav
          aria-label="Sections"
          className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto"
        >
          {filled.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jump(s.id)}
              aria-current={here === s.id ? 'true' : undefined}
              className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                here === s.id
                  ? 'bg-elevated font-medium text-text-primary'
                  : 'text-text-muted hover:bg-elevated/60 hover:text-text-primary'
              }`}
            >
              <span className="truncate">{s.label}</span>
              {(gaps.get(s.id)?.length ?? 0) > 0 && (
                <span
                  title={`${gaps.get(s.id)?.length} not decided yet`}
                  className="shrink-0 text-[10.5px] tabular-nums text-warning"
                >
                  {gaps.get(s.id)?.length}
                </span>
              )}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowSets((v) => !v)}
            aria-expanded={showSets}
            className="mt-4 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-text-muted transition-colors hover:bg-elevated/60 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform duration-200 ${showSets ? 'rotate-90' : ''}`}><path d="M6 3.5L10.5 8 6 12.5" /></svg>
            Sets
          </button>
          {showSets ? (
            <SetTree
              nodes={treeOfSets(studio.sets)}
              depth={0}
              stateOf={(id) => studio.themes.find((t) => t.id === themeId)?.sets[id] ?? 'off'}
              folderStateOf={(node) => folderState(studio, themeId, node)}
              onCycleSet={(id, state) =>
                setSetState(id, state === 'enabled' ? 'source' : state === 'source' ? 'off' : 'enabled')
              }
              onCycleFolder={(node, state) =>
                onChange(
                  setFolderState(
                    studio,
                    themeId,
                    node,
                    state === 'enabled' ? 'source' : state === 'source' ? 'off' : 'enabled'
                  )
                )
              }
              onRenameSet={(id, to) => onChange(renameSet(studio, id, to))}
              onRenameFolder={(path, to) => onChange(renameFolder(studio, path, to))}
              onAdd={(id, rect) => setAdding({ setId: id, rect })}
              trailing={
                <li>
                  <button
                    type="button"
                    onClick={addSet}
                    className="w-full rounded-md px-2.5 py-1 text-left text-[11px] text-text-muted hover:bg-elevated/60 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    Add a set
                  </button>
                </li>
              }
            />
          ) : null}
        </nav>

        <div
          ref={scroller}
          className="min-w-0 flex-1 overflow-y-auto rounded-panel bg-surface pb-2"
        >
          {gapCount > 0 && (
            <div className="flex items-baseline gap-3 px-4 pt-3 text-[11.5px]">
              <span className="text-text-muted">
                {gapCount} {gapCount === 1 ? 'thing' : 'things'} not decided yet
              </span>
              <button
                type="button"
                onClick={fillTheGaps}
                className="rounded-sm text-text-secondary underline decoration-border underline-offset-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                {gapCount === 1 ? 'Decide it from what is here' : 'Decide them from what is here'}
              </button>
            </div>
          )}
          {filled.length === 0 ? (
            <p className="px-2 py-16 text-center text-[12px] text-text-muted">
              {onlyProblems ? 'Nothing wrong here.' : search ? 'No token by that name.' : 'Nothing in this theme yet.'}
            </p>
          ) : (
            filled.map((s) => (
              <section key={s.id} id={`tokens-${s.id}`}>
                <div className="sticky top-0 z-10 flex items-center gap-2 bg-surface px-4 py-3">
                  <h2 className="text-[13px] font-semibold text-text-primary">{s.label}</h2>
                  <div className="ml-auto flex items-center gap-0.5">
                    {(['use', 'raw', 'all'] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLens((c) => ({ ...c, [s.id]: l }))}
                        aria-pressed={lensOf(s.id) === l}
                        className={`rounded-sm px-1.5 py-0.5 text-[10.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                          lensOf(s.id) === l
                            ? 'bg-raised text-text-primary'
                            : 'text-text-muted hover:text-text-secondary'
                        }`}
                      >
                        {LENS_LABEL[l]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-4 px-4 pb-6">
                  {visible(s.id).map((f) => (
                    <FamilyRow
                      key={f.id}
                      family={f}
                      hideLabel={f.label.toLowerCase() === s.label.toLowerCase()}
                      map={map}
                      related={related}
                      selected={selected}
                      marked={marked}
                      onSelect={(p, additive) => {
                        if (additive || marked.size > 0) {
                          setSelected(null)
                          mark(p)
                          return
                        }
                        setSelected((c) => (c === p ? null : p))
                      }}
                    />
                  ))}
                  {(gaps.get(s.id) ?? []).length > 0 && (
                    <div>
                      <p className="mb-1 text-[11px] text-text-muted">Not decided yet</p>
                      <ul className="flex flex-wrap gap-x-3 gap-y-1">
                        {(gaps.get(s.id) ?? []).map((g) => (
                          <li
                            key={g.label}
                            title={g.why}
                            className="text-[11.5px] text-text-secondary"
                          >
                            {g.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            ))
          )}
        </div>

        {selectedToken ? (
          <TokenInspector
            studio={studio}
            token={selectedToken.token}
            setName={studio.sets.find((x) => x.id === selectedToken.setId)?.name ?? ''}
            resolved={selectedResolved}
            onClose={() => setSelected(null)}
            onPickColour={(hex, rect, cb) =>
              setPicker({
                value: hex,
                opacity: 1,
                anchor: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
                onChange: (next) => cb(next),
                onClose: () => setPicker(null)
              })
            }
            edit={{
              rename: (to) => onChange(renameToken(studio, selectedToken.setId, selectedToken.token.path, to)),
              setValue: (v) => onChange(setTokenValue(studio, selectedToken.setId, selectedToken.token.path, v)),
              setTarget: (target) =>
                onChange(
                  setAlias(
                    studio,
                    selectedToken.setId,
                    selectedToken.token.path,
                    target,
                    selectedResolved !== null && typeof selectedResolved !== 'object'
                      ? selectedResolved
                      : blankValue(selectedToken.token.type)
                  )
                ),
              setDeprecated: (d) =>
                onChange(setDeprecated(studio, selectedToken.setId, selectedToken.token.path, d)),
              remove: () => {
                onChange(deleteToken(studio, selectedToken.setId, selectedToken.token.path))
                setSelected(null)
              }
            }}
          />
        ) : null}
      </div>

      {marked.size > 0 ? (
        <SweepBar
          count={marked.size}
          sets={studio.sets.map((s) => ({ id: s.id, name: s.name }))}
          onSelectAll={() => setMarked(new Set(shown))}
          onClear={() => setMarked(new Set())}
          onDelete={() => sweep(bulkDelete(studio, picks), 'Deleted')}
          onRetire={(message) =>
            sweep(bulkRetire(studio, picks, { severity: 'warning', message }), 'Retired')
          }
          onMove={(setId) => sweep(bulkMove(studio, picks, setId), 'Moved')}
          onRetype={(type) => sweep(bulkRetype(studio, picks, type), 'Retyped')}
          onRename={(from, to) => sweep(bulkRename(studio, picks, from, to), 'Renamed')}
        />
      ) : null}

      {adding ? (
        <TypeMenu
          rect={adding.rect}
          onClose={() => setAdding(null)}
          onPick={(type, tier) => {
            const set = studio.sets.find((x) => x.id === adding.setId)
            const stem = type === 'color' ? 'colour' : type === 'dimension' ? 'space' : type
            const built = addToken(studio, adding.setId, type, tier, `${(set?.name ?? 'new').toLowerCase()}.${stem}`)
            onChange(built.studio)
            setAdding(null)
            setSelected(built.path)
          }}
        />
      ) : null}

      {picker ? (
        <div data-colour-picker="">
          <ColorPicker req={picker} />
        </div>
      ) : null}

      <ProblemLine
        found={found}
        showing={onlyProblems}
        onToggle={() => setOnlyProblems((v) => !v)}
        note={note}
      />
    </div>
  )
}

type Hits = Map<string, { token: Token; setId: string }>

/**
 * The bar that appears once tokens have been gathered up.
 *
 * It sits over the library rather than beside it, because a sweep is a thing
 * you are in the middle of, not a panel you consult. Each action that needs
 * an answer opens a small tray in place: asking for the answer up front, in
 * five permanent fields, would make the common case — retire these, delete
 * these — read like a form.
 */
function SweepBar({
  count,
  sets,
  onSelectAll,
  onClear,
  onDelete,
  onRetire,
  onMove,
  onRetype,
  onRename
}: {
  count: number
  sets: { id: string; name: string }[]
  onSelectAll: () => void
  onClear: () => void
  onDelete: () => void
  onRetire: (message: string) => void
  onMove: (setId: string) => void
  onRetype: (type: TokenType) => void
  onRename: (from: string, to: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState<'move' | 'type' | 'name' | 'retire' | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [why, setWhy] = useState('')

  const tray = (which: typeof open): void => setOpen((c) => (c === which ? null : which))

  const action =
    'rounded-md px-2.5 py-1 text-[11.5px] text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60'
  const field =
    'w-32 rounded-md border border-border bg-bg px-2 py-1 text-[11.5px] text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60'
  const go =
    'rounded-md bg-accent px-2.5 py-1 text-[11.5px] font-medium text-accent-text transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-40'

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-6">
      <div className="pointer-events-auto max-w-full rounded-panel border border-border bg-surface shadow-overlay">
        <div className="flex flex-wrap items-center gap-1 px-3 py-2">
          <span className="mr-1 text-[11.5px] font-medium text-text-primary">
            {count === 1 ? '1 token' : `${count} tokens`}
          </span>
          <button type="button" className={action} onClick={() => tray('move')} aria-expanded={open === 'move'}>
            Move
          </button>
          <button type="button" className={action} onClick={() => tray('type')} aria-expanded={open === 'type'}>
            Type
          </button>
          <button type="button" className={action} onClick={() => tray('name')} aria-expanded={open === 'name'}>
            Rename
          </button>
          <button type="button" className={action} onClick={() => tray('retire')} aria-expanded={open === 'retire'}>
            Retire
          </button>
          <button
            type="button"
            className="rounded-md px-2.5 py-1 text-[11.5px] text-error transition-colors hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            onClick={onDelete}
          >
            Delete
          </button>
          <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
          <button type="button" className={action} onClick={onSelectAll}>
            All shown
          </button>
          <button type="button" className={action} onClick={onClear}>
            Done
          </button>
        </div>

        {open === 'move' ? (
          <div className="flex flex-wrap items-center gap-1 border-t border-border/60 px-3 py-2">
            {sets.map((s) => (
              <button key={s.id} type="button" className={action} onClick={() => onMove(s.id)}>
                {s.name}
              </button>
            ))}
          </div>
        ) : null}

        {open === 'type' ? (
          <div className="flex max-h-32 flex-wrap items-center gap-1 overflow-y-auto border-t border-border/60 px-3 py-2">
            {TOKEN_TYPES.map((t) => (
              <button key={t} type="button" className={action} onClick={() => onRetype(t)}>
                {t}
              </button>
            ))}
          </div>
        ) : null}

        {open === 'name' ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-3 py-2">
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="brand."
              aria-label="Text to replace"
              className={field}
            />
            <span className="text-[11.5px] text-text-muted">becomes</span>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="accent."
              aria-label="Text to put there instead"
              className={field}
            />
            <button type="button" className={go} disabled={from.length === 0} onClick={() => onRename(from, to)}>
              Rename
            </button>
          </div>
        ) : null}

        {open === 'retire' ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-3 py-2">
            <input
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Use colour.text instead"
              aria-label="What to use instead"
              className={`${field} w-56`}
            />
            <button type="button" className={go} onClick={() => onRetire(why)}>
              Retire
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * One family, drawn once.
 *
 * A ramp is a strip of fused segments rather than eleven tiles, because a
 * ramp is one decision and eleven tiles is eleven. Everything else is a row
 * of marks with their names under them.
 */
function FamilyRow({
  family,
  hideLabel,
  map,
  related,
  selected,
  marked,
  onSelect
}: {
  family: Family
  /** True when the family name only repeats the section name above it. */
  hideLabel?: boolean
  map: Hits
  related: Set<string> | null
  selected: string | null
  /** Paths gathered up for a sweep. Empty when nothing is being gathered. */
  marked: Set<string>
  onSelect: (path: string, additive: boolean) => void
}): React.JSX.Element {
  // A family with nothing to do with the selection is left alone rather than
  // greyed. Dimming every unrelated token across six sections made the whole
  // library look switched off; dimming only inside a family that is partly
  // involved says the useful half of the same thing.
  const involved = related !== null && family.paths.some((p) => related.has(p))
  // What the selection is not about is set back rather than faded out.
  //
  // Fading the whole tile was the obvious thing and it made the labels
  // unreadable: text at 40% opacity lands near 1.7:1 against the panel, where
  // 4.5:1 is the floor, and no opacity high enough to be legible is low
  // enough to read as dimmed. So the specimen — a shape, which no contrast
  // rule governs — carries the dimming, and the words stay at full strength
  // in a colour chosen to clear AA on every surface.
  const dimmed = (p: string): boolean => involved && !related.has(p)
  const dimMark = (p: string): string => (dimmed(p) ? 'opacity-40' : 'opacity-100')
  const dimText = (p: string): string => (dimmed(p) ? 'text-text-muted' : 'text-text-secondary')
  const on = (p: string): boolean => marked.has(p)
  // A gathered token is ringed the same way a selected one is, since it is
  // the same statement — "this one" — made about several at once.
  const ring = (p: string): string =>
    selected === p || on(p) ? 'ring-2 ring-inset ring-accent' : ''
  const press = (e: React.MouseEvent, path: string): void =>
    onSelect(path, e.metaKey || e.ctrlKey || e.shiftKey)

  return (
    <div>
      {hideLabel ? null : <p className="mb-1 text-[10.5px] text-text-muted">{family.label}</p>}
      {family.ramp ? (
        <div className="flex h-9 overflow-hidden rounded-md">
          {family.paths.map((path) => {
            const r = resolve(map, path)
            const hex = r.ok && typeof r.value === 'string' ? r.value : 'transparent'
            return (
              <button
                key={path}
                type="button"
                data-token-swatch=""
                data-token-path={path}
                title={`${path} · ${hex}`}
                onClick={(e) => press(e, path)}
                aria-label={`${path}, ${hex}`}
                aria-pressed={selected === path || on(path)}
                style={{ background: hex }}
                className={`group/step relative min-w-0 flex-1 transition-opacity focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60 ${dimMark(
                  path
                )} ${ring(path)}`}
              >
                <span className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[8.5px] font-medium text-text-primary opacity-0 mix-blend-difference transition-opacity group-hover/step:opacity-100">
                  {leafOf(path)}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {family.paths.map((path) => {
            const hit = map.get(path)
            if (!hit) return null
            const r = resolve(map, path)
            const wide = SPECIMEN.has(hit.token.type)
            const caption = isAlias(hit.token.value)
              ? aliasTarget(hit.token.value)
              : shortValue(r.ok ? r.value : hit.token.value)
            if (wide) {
              return (
                <li key={path} className="w-full max-w-[560px]">
                  <button
                    type="button"
                    data-token-swatch=""
                    data-token-path={path}
                    onClick={(e) => press(e, path)}
                    aria-pressed={selected === path || on(path)}
                    className={`flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                      selected === path || on(path) ? 'bg-raised' : 'hover:bg-raised'
                    } ${on(path) ? 'ring-2 ring-inset ring-accent' : ''}`}
                  >
                    <span className={`min-w-0 flex-1 overflow-hidden transition-opacity ${dimMark(path)}`}>
                      <Specimen token={hit.token} value={r.ok ? r.value : null} />
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className={`block text-[10.5px] ${
                          hit.token.deprecated ? 'text-text-muted line-through' : dimText(path)
                        }`}
                        title={hit.token.deprecated?.message ?? undefined}
                      >
                        {leafOf(path)}
                      </span>
                      <span className="block text-[9.5px] text-text-muted">{caption}</span>
                    </span>
                  </button>
                </li>
              )
            }
            return (
              <li key={path}>
                <button
                  type="button"
                  data-token-swatch=""
                  data-token-path={path}
                  onClick={(e) => press(e, path)}
                  aria-pressed={selected === path || on(path)}
                  className={`w-[104px] rounded-md p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    selected === path || on(path) ? 'bg-raised' : 'hover:bg-raised'
                  } ${on(path) ? 'ring-2 ring-inset ring-accent' : ''}`}
                >
                  <span className={`block transition-opacity ${dimMark(path)}`}>
                    <TokenMark token={hit.token} value={r.ok ? r.value : null} />
                  </span>
                  <span
                    className={`mt-1.5 block truncate text-[10.5px] ${
                      hit.token.deprecated ? 'text-text-muted line-through' : dimText(path)
                    }`}
                    title={hit.token.deprecated?.message ?? undefined}
                  >
                    {leafOf(path)}
                  </span>
                  <span className="block truncate text-[9.5px] text-text-muted">{caption}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const STATE_DOT: Record<string, string> = {
  enabled: 'bg-accent',
  source: 'bg-text-muted',
  off: 'bg-transparent ring-1 ring-inset ring-border-strong',
  mixed: 'bg-gradient-to-br from-accent to-transparent ring-1 ring-inset ring-border-strong'
}
const STATE_WORD: Record<string, string> = {
  enabled: 'exported',
  source: 'a source',
  off: 'off',
  mixed: 'part one thing and part another'
}
const STATE_NOTE: Record<string, string> = {
  enabled: 'Exported. Press to make it a source.',
  source: 'Resolvable but not exported. Press to switch it off.',
  off: 'Off. Press to export it.',
  mixed: 'The sets inside disagree. Press to export them all.'
}

/**
 * The sets, as folders.
 *
 * Drawn from the names rather than from any structure of its own, so the
 * only way to move a set is to rename it, which is also the only way anyone
 * would think to try.
 */
function SetTree({
  nodes,
  depth,
  stateOf,
  folderStateOf,
  onCycleSet,
  onCycleFolder,
  onRenameSet,
  onRenameFolder,
  onAdd,
  trailing
}: {
  nodes: SetNode[]
  depth: number
  stateOf: (setId: string) => SetState
  folderStateOf: (node: SetNode) => SetState | 'mixed'
  onCycleSet: (setId: string, state: SetState) => void
  onCycleFolder: (node: SetNode, state: SetState | 'mixed') => void
  onRenameSet: (setId: string, to: string) => void
  onRenameFolder: (path: string, to: string) => void
  onAdd: (setId: string, rect: DOMRect) => void
  trailing?: React.ReactNode
}): React.JSX.Element {
  const [shut, setShut] = useState<Set<string>>(new Set())

  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((node) => {
        const pad = { paddingLeft: `${10 + depth * 10}px` }
        if (node.kind === 'folder') {
          const state = folderStateOf(node)
          const closed = shut.has(node.path)
          return (
            <li key={`f:${node.path}`}>
              <div
                className="group/set flex items-center gap-1 rounded-md py-1 pr-2.5 hover:bg-elevated/60"
                style={pad}
              >
                <button
                  type="button"
                  onClick={() =>
                    setShut((c) => {
                      const next = new Set(c)
                      if (next.has(node.path)) next.delete(node.path)
                      else next.add(node.path)
                      return next
                    })
                  }
                  aria-expanded={!closed}
                  aria-label={`${node.name} folder`}
                  className="shrink-0 rounded-sm text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform duration-200 ${closed ? '' : 'rotate-90'}`}><path d="M6 3.5L10.5 8 6 12.5" /></svg>
                </button>
                <NameField
                  value={node.name}
                  label={`Folder name, ${node.path}`}
                  onCommit={(to) => onRenameFolder(node.path, to)}
                  className="font-medium text-text-primary"
                />
                <button
                  type="button"
                  onClick={() => onCycleFolder(node, state)}
                  aria-label={`${node.name} is ${STATE_WORD[state]}`}
                  title={STATE_NOTE[state]}
                  className={`h-2.5 w-2.5 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${STATE_DOT[state]}`}
                />
              </div>
              {closed ? null : (
                <SetTree
                  nodes={node.children}
                  depth={depth + 1}
                  stateOf={stateOf}
                  folderStateOf={folderStateOf}
                  onCycleSet={onCycleSet}
                  onCycleFolder={onCycleFolder}
                  onRenameSet={onRenameSet}
                  onRenameFolder={onRenameFolder}
                  onAdd={onAdd}
                />
              )}
            </li>
          )
        }

        const state = stateOf(node.set.id)
        return (
          <li
            key={node.set.id}
            className="group/set flex items-center gap-1 rounded-md py-1 pr-2.5 hover:bg-elevated/60"
            style={pad}
          >
            <NameField
              value={node.set.name}
              shown={node.name}
              label={`Set name, ${node.set.name}`}
              onCommit={(to) => onRenameSet(node.set.id, to)}
              className="text-text-secondary"
            />
            <button
              type="button"
              onClick={(e) => onAdd(node.set.id, e.currentTarget.getBoundingClientRect())}
              aria-label={`Add a token to ${node.name}`}
              className="rounded-sm px-1 text-[12px] leading-none text-text-muted opacity-0 hover:text-text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 group-hover/set:opacity-100"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => onCycleSet(node.set.id, state)}
              aria-label={`${node.name} is ${STATE_WORD[state]}`}
              title={STATE_NOTE[state]}
              className={`h-2.5 w-2.5 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${STATE_DOT[state]}`}
            />
          </li>
        )
      })}
      {trailing}
    </ul>
  )
}

/**
 * A name you can edit in place.
 *
 * It shows the short name and offers the full path once you are in it, so a
 * set reads as `Light` in its folder but can still be moved somewhere else
 * by typing where it should go.
 */
function NameField({
  value,
  shown,
  label,
  onCommit,
  className
}: {
  value: string
  shown?: string
  label: string
  onCommit: (to: string) => void
  className: string
}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <input
      value={draft ?? shown ?? value}
      aria-label={label}
      onFocus={() => setDraft(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== value) onCommit(draft)
        setDraft(null)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setDraft(value)
          e.currentTarget.blur()
        }
      }}
      className={`min-w-0 flex-1 truncate rounded-sm bg-transparent px-1 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${className}`}
    />
  )
}

/** A shape dimension that is a line's thickness rather than a corner's size. */
const STROKE_STEM = /(^|\.)(stroke|border)(\.|$)/i

/** A spacing token that sits inside something rather than between two things. */
const PAD_STEM = /(^|\.)(pad|padding|inset|padx|pady)(\.|$)/i

/**
 * A spacing value in the pixels the specimen should draw.
 *
 * True to size where the tile has room, so 4 and 8 are honestly half and
 * whole. Past that it compresses instead of clamping — a clamp made every
 * large step draw identically, which is the one thing a specimen must not do.
 */
function spaceScale(v: number): number {
  const a = Math.abs(v)
  if (a <= 24) return Math.max(2, a)
  return Math.min(56, 24 + (a - 24) * 0.45)
}

/** Tokens Studio writes `original`; CSS has no such word for "leave it". */
function cssTextCase(v: string): 'none' | 'uppercase' | 'lowercase' | 'capitalize' {
  const k = v.toLowerCase()
  if (k === 'uppercase' || k === 'lowercase' || k === 'capitalize') return k
  return 'none'
}

function shortValue(v: TokenValue | null): string {
  if (v === null) return 'unresolved'
  if (typeof v === 'object') return Object.values(v).slice(0, 3).join(' ')
  return String(v)
}

/** A token drawn as the thing it is. */
function TokenMark({ token, value }: { token: Token; value: TokenValue | null }): React.JSX.Element {
  if (value === null) {
    return (
      <span className="grid h-12 place-items-center rounded-md bg-sunken text-[10px] text-error">
        broken
      </span>
    )
  }
  switch (token.type) {
    case 'color':
      return (
        <span
          style={{ background: String(value) }}
          className="block h-12 rounded-md ring-1 ring-inset ring-black/10"
        />
      )
    case 'dimension': {
      // A corner is not a distance between two things, so drawing it as a bar
      // says nothing. Drawn as the corner it is, you can see the difference
      // between 8 and 12 without reading either number.
      if (sectionOf(token) === 'shape') {
        // A border width is not a corner either. Drawn as a rounded square it
        // looked exactly like a radius token, which is how `stroke.hairline`
        // came to be indistinguishable from `corner.pill`.
        if (STROKE_STEM.test(token.path)) {
          const w = Math.max(1, Math.min(10, Math.abs(num(value))))
          return (
            <span className="grid h-12 place-items-center rounded-md bg-sunken">
              <span style={{ height: w }} className="block w-9 rounded-[1px] bg-text-primary/80" />
            </span>
          )
        }
        // Shown as the corner of something larger, running off the tile,
        // which is what a radius actually is. A whole rounded rectangle
        // turns into a circle as the number grows, so every large radius
        // ends up looking the same as every other.
        const r = Math.min(28, Math.abs(num(value)))
        return (
          <span className="relative block h-12 overflow-hidden rounded-md bg-sunken">
            <span
              style={{ borderTopLeftRadius: r }}
              className="absolute bottom-[-20%] left-[22%] right-[-20%] top-[22%] bg-text-primary/15"
            />
          </span>
        )
      }
      // Spacing is not a length, it is a distance between two things, and a
      // lone bar in a box says neither. Worse, the bar was clamped, so every
      // value past the cap drew the same width: a 64 and a 96 were the same
      // picture. Drawn as the thing it does — the space between two blocks,
      // or the inset around one — the number is legible without reading it.
      const px = spaceScale(num(value))
      if (PAD_STEM.test(token.path)) {
        return (
          <span className="grid h-12 place-items-center rounded-md bg-sunken">
            <span
              style={{ padding: Math.max(1, Math.round(px / 2)) }}
              className="rounded-[3px] bg-accent/30"
            >
              <span className="block h-4 w-7 rounded-[2px] bg-text-primary/35" />
            </span>
          </span>
        )
      }
      return (
        <span className="flex h-12 items-center justify-center rounded-md bg-sunken px-2">
          <span className="h-7 w-2.5 shrink-0 rounded-l-[2px] bg-text-primary/35" />
          <span style={{ width: px }} className="h-7 shrink-0 bg-accent/30" />
          <span className="h-7 w-2.5 shrink-0 rounded-r-[2px] bg-text-primary/35" />
        </span>
      )
    }
    case 'letterSpacing':
      return (
        <span className="flex h-12 items-center rounded-md bg-sunken px-1.5">
          <span
            style={{ letterSpacing: String(value) }}
            className="text-[13px] text-text-primary"
          >
            Aa
          </span>
        </span>
      )
    case 'fontSize':
      return (
        <span className="grid h-12 place-items-center overflow-hidden rounded-md bg-sunken">
          <span
            style={{ fontSize: Math.min(28, parseFloat(String(value)) || 12) }}
            className="leading-none text-text-primary"
          >
            Aa
          </span>
        </span>
      )
    case 'fontFamily':
      return (
        <span className="grid h-12 place-items-center overflow-hidden rounded-md bg-sunken">
          <span style={{ fontFamily: String(value) }} className="text-[16px] leading-none text-text-primary">
            Aa
          </span>
        </span>
      )
    case 'fontWeight':
      return (
        <span className="grid h-12 place-items-center rounded-md bg-sunken">
          <span
            style={{ fontWeight: parseFloat(String(value)) || 400 }}
            className="text-[16px] leading-none text-text-primary"
          >
            Aa
          </span>
        </span>
      )
    case 'typography': {
      // A text style only means anything set. Six numbers on a tile is a
      // puzzle; one line of real words in the actual family, size, weight,
      // leading and tracking is the decision itself.
      const t = (typeof value === 'object' ? value : {}) as Record<string, string | number>
      const size = Math.min(44, num(t.fontSize) || 16)
      return (
        <span className="flex min-h-12 items-center overflow-hidden rounded-md bg-sunken px-3 py-2">
          <span
            style={{
              fontFamily: String(t.fontFamily ?? 'inherit'),
              fontSize: size,
              fontWeight: num(t.fontWeight) || 400,
              lineHeight: num(t.lineHeight) || 1.4,
              letterSpacing: String(t.letterSpacing ?? 'normal')
            }}
            className="block truncate text-text-primary"
          >
            The quick brown fox
          </span>
        </span>
      )
    }
    case 'cubicBezier': {
      // The curve, drawn. A list of four numbers says nothing about whether a
      // move will feel like it starts fast or ends soft.
      const c = (typeof value === 'object' ? value : {}) as Record<string, string | number>
      const path = `M 0 40 C ${num(c.x1) * 60} ${40 - num(c.y1) * 40} ${num(c.x2) * 60} ${40 - num(c.y2) * 40} 60 0`
      return (
        <span className="grid h-12 place-items-center rounded-md bg-sunken">
          <svg width="60" height="40" viewBox="0 0 60 40" fill="none" aria-hidden="true">
            <path d={path} stroke="currentColor" strokeWidth="1.5" className="text-text-secondary" />
          </svg>
        </span>
      )
    }
    case 'duration': {
      const ms = num(value)
      return (
        <span className="grid h-12 place-items-center rounded-md bg-sunken">
          <span className="text-[13px] tabular-nums text-text-primary">{ms}ms</span>
        </span>
      )
    }
    case 'shadow': {
      const s = (typeof value === 'object' ? value : {}) as Record<string, string | number>
      const shadow = `${num(s.x)}px ${num(s.y)}px ${num(s.blur)}px ${num(s.spread)}px ${s.color ?? 'transparent'}`
      return (
        <span className="grid h-12 place-items-center rounded-md bg-bg">
          <span style={{ boxShadow: shadow }} className="block h-7 w-14 rounded-[5px] bg-surface" />
        </span>
      )
    }
    case 'opacity':
      return (
        <span className="grid h-12 place-items-center rounded-md bg-sunken">
          <span
            style={{ opacity: parseFloat(String(value)) || 0 }}
            className="block h-6 w-6 rounded-full bg-text-primary"
          />
        </span>
      )
    case 'gradient':
      return <span style={{ background: String(value) }} className="block h-12 rounded-md" />
    case 'boolean': {
      const on = String(value) === 'true' || value === 1
      return (
        <span className="grid h-12 place-items-center rounded-md bg-sunken">
          <span
            className={`block h-2.5 w-2.5 rounded-full ${on ? 'bg-text-primary' : 'bg-text-muted/40'}`}
            aria-hidden="true"
          />
        </span>
      )
    }
    case 'text':
      return (
        <span className="grid h-12 place-items-center overflow-hidden rounded-md bg-sunken px-2">
          <span className="block truncate text-[12px] text-text-primary">{String(value) || '—'}</span>
        </span>
      )
    case 'asset': {
      // An asset is a path until it is a picture. Shown as the picture where
      // it loads, because that is the only way to tell two logos apart.
      const src = String(value)
      return (
        <span className="grid h-12 place-items-center overflow-hidden rounded-md bg-sunken px-1">
          {/^(https?:|data:|file:|\/)/i.test(src) ? (
            <img src={src} alt="" className="max-h-10 max-w-full object-contain" />
          ) : (
            <span className="block truncate font-mono text-[10px] text-text-secondary">{src || '—'}</span>
          )}
        </span>
      )
    }
    case 'textCase':
      return (
        <span className="grid h-12 place-items-center rounded-md bg-sunken">
          <span
            style={{ textTransform: cssTextCase(String(value)) }}
            className="text-[13px] leading-none text-text-primary"
          >
            Aa bc
          </span>
        </span>
      )
    case 'textDecoration':
      return (
        <span className="grid h-12 place-items-center rounded-md bg-sunken">
          <span
            style={{ textDecoration: String(value) === 'none' ? 'none' : String(value) }}
            className="text-[13px] leading-none text-text-primary"
          >
            Aa bc
          </span>
        </span>
      )
    default:
      return (
        <span className="grid h-12 place-items-center overflow-hidden rounded-md bg-sunken px-1 font-mono text-[10px] text-text-secondary">
          {shortValue(value)}
        </span>
      )
  }
}

/**
 * Token types that are shown as a specimen across the full width rather than
 * on a tile.
 *
 * A type scale is the one thing in a library whose whole meaning is relative.
 * Set eight sizes in eight equal squares, each clamped to fit, and the ramp —
 * the only decision the scale records — is the first thing thrown away. The
 * same goes for a family: "Aa" in Inter and "Aa" in Space Grotesk are the same
 * two letters, while the words "Space Grotesk" set in Space Grotesk say what
 * the token is and what it looks like at once.
 *
 * Motion is the same argument taken to its end. 200ms printed on a tile is a
 * number nobody can feel, and a curve drawn as a line is a shape nobody can
 * feel either. Both are decisions about time, so both are shown in time: the
 * whole point of `time.slow` is that it is slower than `time.fast`, and you
 * find that out by watching them next to each other.
 */
const SPECIMEN = new Set<Token['type']>([
  'duration',
  'cubicBezier',
  'typography',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'lineHeight',
  'letterSpacing'
])

const WEIGHT_NAME: Record<number, string> = {
  100: 'Thin',
  200: 'Extra light',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semibold',
  700: 'Bold',
  800: 'Extra bold',
  900: 'Black'
}

/** The largest a specimen is allowed to be drawn, so one token cannot own the screen. */
const MAX_SPECIMEN = 46

/**
 * A dot that travels a rail, so a length of time can be watched rather than read.
 *
 * Every duration in a library travels the same rail, which is what makes the
 * row comparable: the distance is fixed, so the only thing that differs
 * between two tokens is how long the crossing takes. The pause afterwards is
 * as long as the longest sensible duration, so a slow token and a fast one
 * stay in step and the row reads as one clock rather than a dozen.
 */
function TimeRail({ ms, easing }: { ms: number; easing?: string }): React.JSX.Element {
  const dot = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = dot.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const travel = Math.max(60, Math.min(1200, ms))
    const total = travel + 900
    const anim = el.animate(
      [
        { left: '0%', offset: 0, easing: easing ?? 'linear' },
        { left: '100%', offset: travel / total },
        { left: '100%', offset: 1 }
      ],
      { duration: total, iterations: Infinity }
    )
    return () => anim.cancel()
  }, [ms, easing])
  return (
    <span className="relative block h-1.5 w-full rounded-full bg-sunken">
      <span
        ref={dot}
        className="absolute top-1/2 block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-primary"
        style={{ left: 0 }}
      />
    </span>
  )
}

function bezier(v: TokenValue | null): { x1: number; y1: number; x2: number; y2: number } {
  const c = (typeof v === 'object' && v ? v : {}) as Record<string, string | number>
  return { x1: num(c.x1), y1: num(c.y1), x2: num(c.x2), y2: num(c.y2) }
}

function Specimen({ token, value }: { token: Token; value: TokenValue | null }): React.JSX.Element {
  const v = value ?? token.value
  switch (token.type) {
    case 'duration': {
      const ms = num(v as string | number)
      return (
        <span className="flex items-center gap-3 py-1">
          <span className="w-12 shrink-0 tabular-nums text-[11px] text-text-secondary">{ms}ms</span>
          <span className="min-w-0 max-w-[280px] flex-1">
            <TimeRail ms={ms} />
          </span>
        </span>
      )
    }
    case 'cubicBezier': {
      const c = bezier(v)
      const css = `cubic-bezier(${c.x1}, ${c.y1}, ${c.x2}, ${c.y2})`
      // The curve and the movement together, because each answers what the
      // other cannot: the drawing shows the shape of the whole crossing, the
      // dot shows what that shape does to something you are watching.
      return (
        <span className="flex items-center gap-3 py-1">
          <svg width="52" height="30" viewBox="0 0 60 40" fill="none" aria-hidden="true" className="shrink-0">
            <path d="M 0 40 L 60 40" stroke="currentColor" strokeWidth="1" className="text-border" />
            <path
              d={`M 0 40 C ${c.x1 * 60} ${40 - c.y1 * 40} ${c.x2 * 60} ${40 - c.y2 * 40} 60 0`}
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-text-secondary"
            />
          </svg>
          <span className="min-w-0 max-w-[280px] flex-1">
            <TimeRail ms={700} easing={css} />
          </span>
        </span>
      )
    }
    case 'fontSize': {
      const px = num(v as string | number)
      return (
        <span
          style={{ fontSize: Math.min(MAX_SPECIMEN, px || 12) }}
          className="block truncate leading-tight text-text-primary"
        >
          The quick brown fox
        </span>
      )
    }
    case 'fontFamily': {
      const family = String(v)
      return (
        <span style={{ fontFamily: family }} className="block truncate text-[22px] leading-tight text-text-primary">
          {family.split(',')[0].replace(/["']/g, '')}
        </span>
      )
    }
    case 'fontWeight': {
      const w = num(v as string | number) || 400
      return (
        <span style={{ fontWeight: w }} className="block truncate text-[20px] leading-tight text-text-primary">
          {WEIGHT_NAME[w] ?? String(w)}
        </span>
      )
    }
    case 'lineHeight': {
      // Leading is a gap between lines, so it takes two lines to show one.
      const lh = num(v as string | number) || 1.4
      return (
        <span style={{ lineHeight: lh }} className="block text-[12px] text-text-primary">
          Leading is the space a paragraph
          <br />
          leaves between one line and the next.
        </span>
      )
    }
    case 'letterSpacing':
      return (
        <span style={{ letterSpacing: String(v) }} className="block truncate text-[20px] leading-tight text-text-primary">
          Tracking
        </span>
      )
    case 'typography': {
      const s = (typeof v === 'object' ? v : {}) as Record<string, string | number>
      return (
        <span
          style={{
            fontFamily: String(s.fontFamily ?? 'inherit'),
            fontSize: Math.min(MAX_SPECIMEN, num(s.fontSize) || 16),
            fontWeight: num(s.fontWeight) || 400,
            lineHeight: num(s.lineHeight) || 1.3,
            letterSpacing: String(s.letterSpacing ?? 'normal')
          }}
          className="block truncate text-text-primary"
        >
          The quick brown fox
        </span>
      )
    }
    default:
      return <TokenMark token={token} value={value} />
  }
}

function num(v: TokenValue | string | number | undefined): number {
  return typeof v === 'number' ? v : parseFloat(String(v ?? 0)) || 0
}

/**
 * The line under the library: a passing note, or what does not resolve.
 *
 * Silent when there is nothing wrong. An all-clear that is on screen all the
 * time is not read as an all-clear, only as furniture — and it takes up the
 * one place the app has to say something has broken.
 */
function ProblemLine({
  found,
  showing,
  onToggle,
  note
}: {
  found: Problem[]
  showing: boolean
  onToggle: () => void
  note: string | null
}): React.JSX.Element | null {
  if (note) {
    return (
      <p className="shrink-0 border-t border-border/60 px-6 py-2 text-[11.5px] text-text-secondary" role="status">
        {note}
      </p>
    )
  }
  if (found.length === 0) return null
  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-border/60 px-6 py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={showing}
        className={`rounded-sm px-1.5 py-0.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
          showing
            ? 'bg-raised text-text-primary'
            : 'text-text-muted hover:bg-raised hover:text-text-primary'
        }`}
      >
        {found.length} to fix
      </button>
      <span className="truncate text-[11px] text-text-muted">
        {found[0].path}: {found[0].note}
      </span>
    </div>
  )
}

/**
 * What kind of token to add.
 *
 * Type and tier together, because they are one decision: nobody adds a
 * colour without already knowing whether it is a raw one or a named use.
 */
function TypeMenu({
  rect,
  onPick,
  onClose
}: {
  rect: DOMRect
  onPick: (type: TokenType, tier: Tier) => void
  onClose: () => void
}): React.JSX.Element {
  const [tier, setTier] = useState<Tier>('primitive')
  useEffect(() => {
    const away = (): void => onClose()
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    // A frame late, so the click that opened this does not close it.
    const t = window.setTimeout(() => window.addEventListener('mousedown', away), 0)
    window.addEventListener('keydown', key)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('mousedown', away)
      window.removeEventListener('keydown', key)
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-label="Add a token"
      onMouseDown={(e) => e.stopPropagation()}
      style={{ left: rect.left, top: Math.min(rect.bottom + 6, window.innerHeight - 280), width: 200 }}
      className="fixed z-40 rounded-panel bg-elevated p-2 shadow-lg"
    >
      <div className="flex items-center gap-1 px-1 pb-1.5">
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTier(t)}
            aria-pressed={tier === t}
            className={`rounded-md px-1.5 py-0.5 text-[10.5px] capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
              tier === t ? 'bg-raised text-text-primary' : 'text-text-muted hover:bg-raised hover:text-text-secondary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <ul className="grid max-h-52 grid-cols-2 gap-0.5 overflow-y-auto">
        {TOKEN_TYPES.map((t) => (
          <li key={t}>
            <button
              type="button"
              onClick={() => onPick(t, tier)}
              className="w-full truncate rounded-sm px-1.5 py-1 text-left text-[11px] text-text-secondary hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              {t}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Sending the library somewhere it will be used.
 *
 * A library nobody can reach from the screen they are working on is a second
 * place to look rather than a single source of truth, so this is the door out.
 * Each destination says what would arrive before it is chosen, because "send
 * to Motion" and "send 14 colours and 3 typefaces to Motion" are different
 * offers, and the second one is the only one somebody can decline sensibly.
 *
 * Both destinations replace rather than merge. Two half-updated palettes is
 * the failure this whole feature exists to stop.
 */
/**
 * How the stylesheet gets written.
 *
 * A library is exported into a codebase that has already decided what its
 * variables look like. Handing it names in our house style means the export
 * is edited by hand once and then never re-exported, so the shape of the file
 * is asked here rather than assumed. The line at the bottom shows a real name
 * from the library as it will be written, because nobody can hold "camel plus
 * a prefix" in their head and be sure.
 */
/**
 * The one way out of a library.
 *
 * Export used to be two controls split in half, then one menu, and next to it
 * a separate "Send to" that also took the library somewhere -- so the answer
 * to "how do I use these?" was spread across two buttons and neither said
 * what it would produce. It is one menu now, and every destination names both
 * where it goes and what arrives there. "Export" with no object is not a
 * sentence anybody can act on.
 */
/**
 * What this library asks of the designs bound to it.
 *
 * The three rungs were built and wired through the auto-lint pass, and then
 * nothing anywhere could set them: every library made in the app started on
 * the bottom rung and stayed there, so a team that wanted its values enforced
 * had no way to say so.
 */
const LEVELS: { id: Enforcement; label: string; hint: string }[] = [
  { id: 'advise', label: 'Advise', hint: 'Ask for these values, accept what comes back' },
  { id: 'check', label: 'Check', hint: 'Report values that are off this library' },
  { id: 'block', label: 'Block', hint: 'Fix values that are off this library' }
]

function EnforcementPicker({
  level,
  onPick
}: {
  level: Enforcement
  onPick: (level: Enforcement) => void
}): React.JSX.Element {
  return (
    <div className="t42-seg" role="group" aria-label="What this library asks of designs">
      {LEVELS.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => onPick(l.id)}
          data-active={l.id === level}
          aria-pressed={l.id === level}
          title={l.hint}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}

function ExportMenu({
  studio,
  themeId,
  onChange,
  onWrite,
  onDone
}: {
  studio: TokenStudio
  themeId: string | null
  onChange: (o: CssOptions) => void
  onWrite: () => void
  onDone: (message: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)
  const options = cssOptionsOf(studio.css)
  const counts = useMemo(() => bridgeSummary(studio, themeId), [studio, themeId])

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent): void => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const field =
    'w-full rounded-md border border-border bg-bg px-2 py-1 text-[11.5px] text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60'
  const label = 'block text-[10.5px] text-text-muted'

  const copy = async (): Promise<void> => {
    const css = toCSS(studio, themeId)
    await navigator.clipboard.writeText(css)
    const names = css.split('\n').filter((l) => l.includes(': ')).length
    setOpen(false)
    onDone(`${names} names copied. Paste them at a coding agent and ask it to use these.`)
  }

  // Both destinations replace rather than merge. Two half-updated palettes is
  // the failure this whole bridge exists to stop.
  const toForm = (): void => {
    setOpen(false)
    if (counts.variables === 0) { onDone('Nothing to send yet.'); return }
    publishToForm(studio)
    onDone(`Published to Form as ${studio.name}. Enable it from a file's Libraries panel.`)
  }

  const toMotion = async (): Promise<void> => {
    setOpen(false)
    const { colours, fonts } = brandItems(studio, themeId)
    if (colours.length === 0 && fonts.length === 0) { onDone('Nothing to send yet.'); return }
    const existing = await window.terminal42.motion.brandSets()
    const put = async (kind: 'colours' | 'fonts', items: string[]): Promise<void> => {
      if (!items.length) return
      const was = existing.find((s) => s.kind === kind && s.name === studio.name)
      await window.terminal42.motion.saveBrandSet({ id: was?.id, kind, name: studio.name, items })
    }
    await put('colours', colours)
    await put('fonts', fonts)
    onDone(`Sent ${counts.colours} colours and ${counts.fonts} typefaces to Motion.`)
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-md bg-action px-3 py-1.5 text-[12px] font-medium text-action-text hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        Export
      </button>
      {open && (
        <div className="t42-menu absolute right-0 top-full z-30 mt-1 w-72 rounded-panel bg-elevated p-3 shadow-lg ring-1 ring-border">
          <div className="flex flex-col gap-2.5">
            <p className="text-[10.5px] text-text-muted">
              As a stylesheet &mdash; CSS custom properties.
            </p>
            <div className="flex gap-2">
              <label className="min-w-0 flex-1">
                <span className={label}>Prefix</span>
                <input
                  value={options.prefix}
                  onChange={(e) => onChange({ ...options, prefix: e.target.value })}
                  placeholder="none"
                  aria-label="Variable prefix"
                  className={field}
                />
              </label>
              <label className="min-w-0 flex-1">
                <span className={label}>Attached to</span>
                <input
                  value={options.selector}
                  onChange={(e) => onChange({ ...options, selector: e.target.value })}
                  placeholder=":root"
                  aria-label="Root selector"
                  className={field}
                />
              </label>
            </div>

            <div>
              <span className={label}>Names</span>
              <div className="mt-0.5 flex items-center gap-0.5 rounded-md bg-surface p-0.5">
                {(['kebab', 'camel', 'snake'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={options.casing === c}
                    onClick={() => onChange({ ...options, casing: c })}
                    className={`flex-1 rounded-sm px-2 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                      options.casing === c
                        ? 'bg-raised text-text-primary'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {CASE_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>

            <label>
              <span className={label}>Cascade layer</span>
              <input
                value={options.layer}
                onChange={(e) => onChange({ ...options, layer: e.target.value })}
                placeholder="none"
                aria-label="Cascade layer"
                className={field}
              />
            </label>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={options.allThemes}
                onChange={(e) => onChange({ ...options, allThemes: e.target.checked })}
                className="mt-0.5 accent-accent"
              />
              <span className="text-[11.5px] text-text-secondary">
                Write every theme
                <span className="block text-[10.5px] text-text-muted">
                  The others go under <code>[data-theme]</code>, which is how they are switched.
                </span>
              </span>
            </label>

            <p className="rounded-md bg-surface px-2 py-1.5 font-mono text-[10.5px] text-text-secondary">
              {sampleCss(options)}
            </p>

            <div className="flex gap-2 border-t border-border pt-2.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onWrite()
                }}
                className="flex-1 rounded-md bg-action px-3 py-1.5 text-[11.5px] font-medium text-action-text hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                Save a .css file
              </button>
              <button
                type="button"
                onClick={() => void copy()}
                className="flex-1 rounded-md bg-surface px-3 py-1.5 text-[11.5px] text-text-primary hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                Copy it
              </button>
            </div>

            <div className="border-t border-border pt-2.5">
              <p className="text-[10.5px] text-text-muted">Or into the rest of Terminal 42</p>
              <button type="button" onClick={toForm} className={DESTINATION}>
                <span>Form</span>
                <span className="text-[10.5px] text-text-muted">
                  {counts.variables} variables, to style a file
                </span>
              </button>
              <button type="button" onClick={() => void toMotion()} className={DESTINATION}>
                <span>Motion</span>
                <span className="text-[10.5px] text-text-muted">
                  {counts.colours} colours and {counts.fonts} typefaces, as a brand set
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const CASE_LABEL: Record<string, string> = { kebab: 'a-b', camel: 'aB', snake: 'a_b' }

const DESTINATION =
  'mt-1 flex w-full flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left text-[11.5px] text-text-primary hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60'

/** One real name, spelled the way the options say, so the choice is legible. */
function sampleCss(options: CssOptions): string {
  const sample: TokenStudio = {
    id: 'sample',
    name: 'sample',
    sets: [
      {
        id: 's',
        name: 'S',
        order: 0,
        tokens: [
          { id: '1', path: 'colour.text.primary', type: 'color', value: '#111111', tier: 'semantic' }
        ]
      }
    ],
    themes: [{ id: 't', name: 'Theme', sets: { s: 'enabled' } }],
    activeTheme: 't',
    css: options
  }
  return (
    toCSS(sample, 't')
      .split('\n')
      .find((l) => l.includes('--'))
      ?.trim() ?? ''
  )
}
