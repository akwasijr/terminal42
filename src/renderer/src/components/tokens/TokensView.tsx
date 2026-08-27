// Basis: the shared library a team and its agents both work from.
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
import { TokensSetup } from './TokensSetup'
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
  enforcementOf,
  type Enforcement
} from '../../../../shared/tokens/types'
import { flatten, problems, resolve, type Problem } from '../../../../shared/tokens/resolve'
import { familiesOf, leafOf, SECTIONS, sectionOf, type Family, type SectionId } from '../../../../shared/tokens/groups'
import { addToken, blankValue, deleteToken, renameToken, setAlias, setTokenValue } from '../../../../shared/tokens/edit'
import { bridgeSummary, brandItems } from '../../../../shared/tokens/bridges'
import { publishToForm } from '../../lib/tokens/toForm'
import { TokenInspector } from './TokenInspector'
import { ColorPicker, type PickerRequest } from '../ColorPicker'

type StudioRow = { id: string; name: string; studio: unknown; updatedAt: number }

export function TokensView(): React.JSX.Element {
  const [rows, setRows] = useState<StudioRow[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [studio, setStudio] = useState<TokenStudio | null>(null)
  const [loading, setLoading] = useState(true)
  const [setupOpen, setSetupOpen] = useState(false)

  const refresh = async (): Promise<void> => {
    const list = (await window.terminal42.tokens.list()) as StudioRow[]
    setRows(list)
    setLoading(false)
  }
  useEffect(() => {
    void refresh()
  }, [])

  const create = async (built: TokenStudio): Promise<void> => {
    const row = await window.terminal42.tokens.create(built.name, built)
    setSetupOpen(false)
    await refresh()
    setOpenId(row.id)
    setStudio(built)
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
      <div className="flex items-center justify-between gap-3 pb-3">
        <p className="text-[12.5px] text-text-muted">
          One place your colours, sizes and type are decided, and everything else agrees with.
        </p>
        <button
          type="button"
          onClick={() => setSetupOpen(true)}
          className="shrink-0 rounded-md bg-action px-3 py-1.5 text-[13px] font-medium text-action-text hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          New basis
        </button>
      </div>

      {loading ? null : rows.length === 0 ? (
        <p className="rounded-panel bg-surface px-4 py-10 text-center text-[12.5px] text-text-muted">
          Nothing yet. A basis is where a look stops being a habit and starts being a decision
          you can point at.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {rows.map((r) => (
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
              <button
                type="button"
                onClick={() => void remove(r.id)}
                aria-label={`Delete ${r.name}`}
                className="absolute right-2 top-2 rounded-sm px-1.5 py-1 text-[10.5px] text-text-muted opacity-0 hover:text-error focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 group-hover:opacity-100"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {setupOpen ? (
        <TokensSetup onCancel={() => setSetupOpen(false)} onCreate={(s) => void create(s)} />
      ) : null}
    </div>
  )
}

function countTokens(raw: unknown): number {
  return hydrateStudio(raw).sets.reduce((n, s) => n + s.tokens.length, 0)
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

/**
 * How tall the editor can be without the page scrolling behind it.
 *
 * The shell has to be pinned for any of this to work, and pinning needs a
 * definite height. The surrounding page is a normal scrolling document, so
 * rather than guess at a constant that breaks the moment a header changes,
 * the editor measures where it starts and takes the rest of the window.
 */
function useFillHeight(): [React.RefObject<HTMLDivElement>, number | undefined] {
  const ref = useRef<HTMLDivElement>(null)
  const [h, setH] = useState<number | undefined>(undefined)
  useEffect(() => {
    const read = (): void => {
      const el = ref.current
      if (!el) return
      setH(Math.max(360, window.innerHeight - el.getBoundingClientRect().top - 24))
    }
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])
  return [ref, h]
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
  const [here, setHere] = useState<SectionId>('colour')
  const [shell, height] = useFillHeight()
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
    const el = root?.querySelector<HTMLElement>(`#basis-${id}`)
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
      for (const el of root.querySelectorAll<HTMLElement>('[id^="basis-"]')) {
        if (el.getBoundingClientRect().top <= edge) at = el.id.replace('basis-', '') as SectionId
      }
      setHere(at ?? (root.querySelector('[id^="basis-"]')?.id.replace('basis-', '') as SectionId))
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

  return (
    <div ref={shell} style={{ height }} className="flex flex-col gap-2">
      <header className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm px-1.5 py-1 text-[11.5px] text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Back
        </button>
        <input
          value={studio.name}
          onChange={(e) => onRename(e.target.value)}
          aria-label="Library name"
          className="w-52 min-w-0 rounded-sm bg-transparent px-1 py-0.5 text-[13px] text-text-primary hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        />

        <div className="ml-1 flex items-center gap-1">
          {studio.themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange({ ...studio, activeTheme: t.id })}
              aria-pressed={t.id === themeId}
              className={`rounded-full px-2.5 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                t.id === themeId
                  ? 'bg-raised text-text-primary'
                  : 'text-text-muted hover:bg-raised hover:text-text-secondary'
              }`}
            >
              {t.name}
            </button>
          ))}
          <button
            type="button"
            onClick={addTheme}
            aria-label="Add a theme"
            className="rounded-full px-2 py-1 text-[12px] leading-none text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            +
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a token"
            aria-label="Find a token"
            className="w-40 rounded-md bg-surface px-2.5 py-1 text-[11.5px] text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          />
          <EnforcementPicker studio={studio} onChange={onChange} />
          <SendTo studio={studio} themeId={themeId} onDone={(msg) => {
            setNote(msg)
            window.setTimeout(() => setNote(null), 4000)
          }} />
          <button
            type="button"
            onClick={() => void exportFiles()}
            className="rounded-md bg-action px-2.5 py-1 text-[11.5px] font-medium text-action-text hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Export
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-2">
        <nav
          aria-label="Sections"
          className="flex w-36 shrink-0 flex-col gap-0.5 overflow-y-auto rounded-panel bg-surface p-2"
        >
          {filled.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jump(s.id)}
              aria-current={here === s.id ? 'true' : undefined}
              className={`rounded-sm px-2 py-1 text-left text-[11.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                here === s.id
                  ? 'bg-raised text-text-primary'
                  : 'text-text-muted hover:bg-raised hover:text-text-secondary'
              }`}
            >
              {s.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowSets((v) => !v)}
            aria-expanded={showSets}
            className="mt-3 rounded-sm px-2 py-1 text-left text-[11.5px] text-text-muted transition-colors hover:bg-raised hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Sets
          </button>
          {showSets ? (
            <ul className="flex flex-col gap-0.5">
              {[...studio.sets]
                .sort((a, b) => a.order - b.order)
                .map((s) => {
                  const state = studio.themes.find((t) => t.id === themeId)?.sets[s.id] ?? 'off'
                  return (
                    <li
                      key={s.id}
                      className="group/set flex items-center gap-1 rounded-sm px-2 py-1 hover:bg-raised"
                    >
                      <span className="min-w-0 flex-1 truncate text-[11px] text-text-secondary">
                        {s.name}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => setAdding({ setId: s.id, rect: e.currentTarget.getBoundingClientRect() })}
                        aria-label={`Add a token to ${s.name}`}
                        className="rounded-sm px-1 text-[12px] leading-none text-text-muted opacity-0 hover:text-text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 group-hover/set:opacity-100"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSetState(
                            s.id,
                            state === 'enabled' ? 'source' : state === 'source' ? 'off' : 'enabled'
                          )
                        }
                        aria-label={`${s.name} is ${STATE_WORD[state]}`}
                        title={STATE_NOTE[state]}
                        className={`h-2.5 w-2.5 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${STATE_DOT[state]}`}
                      />
                    </li>
                  )
                })}
              <li>
                <button
                  type="button"
                  onClick={addSet}
                  className="w-full rounded-sm px-2 py-1 text-left text-[11px] text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  Add a set
                </button>
              </li>
            </ul>
          ) : null}
        </nav>

        <div
          ref={scroller}
          className="min-w-0 flex-1 overflow-y-auto rounded-panel bg-surface"
        >
          {filled.length === 0 ? (
            <p className="px-2 py-16 text-center text-[12px] text-text-muted">
              {onlyProblems ? 'Nothing wrong here.' : search ? 'No token by that name.' : 'Nothing in this theme yet.'}
            </p>
          ) : (
            filled.map((s) => (
              <section key={s.id} id={`basis-${s.id}`}>
                <div className="sticky top-0 z-10 flex items-center gap-2 bg-surface px-3 py-2">
                  <h2 className="text-[12.5px] font-medium text-text-primary">{s.label}</h2>
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
                <div className="flex flex-col gap-3 px-3 pb-5">
                  {visible(s.id).map((f) => (
                    <FamilyRow
                      key={f.id}
                      family={f}
                      hideLabel={f.label.toLowerCase() === s.label.toLowerCase()}
                      map={map}
                      related={related}
                      selected={selected}
                      onSelect={(p) => setSelected((c) => (c === p ? null : p))}
                    />
                  ))}
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
              remove: () => {
                onChange(deleteToken(studio, selectedToken.setId, selectedToken.token.path))
                setSelected(null)
              }
            }}
          />
        ) : null}
      </div>

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
  onSelect
}: {
  family: Family
  /** True when the family name only repeats the section name above it. */
  hideLabel?: boolean
  map: Hits
  related: Set<string> | null
  selected: string | null
  onSelect: (path: string) => void
}): React.JSX.Element {
  // A family with nothing to do with the selection is left alone rather than
  // greyed. Dimming every unrelated token across six sections made the whole
  // library look switched off; dimming only inside a family that is partly
  // involved says the useful half of the same thing.
  const involved = related !== null && family.paths.some((p) => related.has(p))
  const dimmed = (p: string): boolean => involved && !related.has(p)

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
                onClick={() => onSelect(path)}
                aria-label={`${path}, ${hex}`}
                aria-pressed={selected === path}
                style={{ background: hex }}
                className={`group/step relative min-w-0 flex-1 transition-opacity focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60 ${
                  dimmed(path) ? 'opacity-40' : 'opacity-100'
                } ${selected === path ? 'ring-2 ring-inset ring-accent' : ''}`}
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
                <li key={path} className="w-full">
                  <button
                    type="button"
                    data-token-swatch=""
                    data-token-path={path}
                    onClick={() => onSelect(path)}
                    aria-pressed={selected === path}
                    className={`flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                      dimmed(path) ? 'opacity-40' : 'opacity-100'
                    } ${selected === path ? 'bg-raised' : 'hover:bg-raised'}`}
                  >
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <Specimen token={hit.token} value={r.ok ? r.value : null} />
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[10.5px] text-text-secondary">{leafOf(path)}</span>
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
                  onClick={() => onSelect(path)}
                  aria-pressed={selected === path}
                  className={`w-[104px] rounded-md p-1.5 text-left transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    dimmed(path) ? 'opacity-40' : 'opacity-100'
                  } ${selected === path ? 'bg-raised' : 'hover:bg-raised'}`}
                >
                  <TokenMark token={hit.token} value={r.ok ? r.value : null} />
                  <span className="mt-1.5 block truncate text-[10.5px] text-text-secondary">
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
  off: 'bg-transparent ring-1 ring-inset ring-border-strong'
}
const STATE_WORD: Record<string, string> = { enabled: 'exported', source: 'a source', off: 'off' }
const STATE_NOTE: Record<string, string> = {
  enabled: 'Exported. Press to make it a source.',
  source: 'Resolvable but not exported. Press to switch it off.',
  off: 'Off. Press to export it.'
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
        const r = Math.min(24, Math.abs(num(value)))
        return (
          <span className="grid h-12 place-items-center rounded-md bg-sunken">
            <span
              style={{ borderRadius: r }}
              className="block h-8 w-8 bg-accent/25 ring-1 ring-inset ring-accent"
            />
          </span>
        )
      }
      return (
        <span className="flex h-12 items-center rounded-md bg-sunken px-1.5">
          <span
            style={{ width: Math.max(2, Math.min(72, Math.abs(num(value)))) }}
            className="block h-1.5 rounded-full bg-accent"
          />
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
            <path d={path} stroke="currentColor" strokeWidth="1.5" className="text-accent" />
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
        <span className="grid h-12 place-items-center rounded-md bg-sunken">
          <span style={{ boxShadow: shadow }} className="block h-6 w-6 rounded-[4px] bg-surface" />
        </span>
      )
    }
    case 'opacity':
      return (
        <span className="grid h-12 place-items-center rounded-md bg-sunken">
          <span
            style={{ opacity: parseFloat(String(value)) || 0 }}
            className="block h-6 w-6 rounded-full bg-accent"
          />
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
 */
const SPECIMEN = new Set<Token['type']>([
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

function Specimen({ token, value }: { token: Token; value: TokenValue | null }): React.JSX.Element {
  const v = value ?? token.value
  switch (token.type) {
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
      <p className="px-1 text-[11px] text-text-secondary" role="status">
        {note}
      </p>
    )
  }
  if (found.length === 0) return null
  return (
    <div className="flex items-center gap-2 px-1">
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
 * How hard this library leans on the designs bound to it.
 *
 * Three words rather than a switch, because the middle rung is the point: a
 * two-state "enforce on/off" would force a team to choose between being told
 * nothing and having a turn spent on their behalf, and most teams want to see
 * the drift first and decide.
 *
 * Worded as what happens, not as a level name, because "check" means nothing
 * on its own and the whole feature turns on knowing what it does.
 */
function EnforcementPicker({ studio, onChange }: { studio: TokenStudio; onChange: (s: TokenStudio) => void }): JSX.Element {
  const current = enforcementOf(studio)
  const options: { id: Enforcement; label: string; hint: string }[] = [
    { id: 'advise', label: 'Advise', hint: 'Put the token names in the prompt and leave it there.' },
    { id: 'check', label: 'Check', hint: 'Also count and name anything that came out off the library.' },
    { id: 'block', label: 'Fix', hint: 'Also ask for the off-library values to be replaced.' }
  ]
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.hint}
          aria-pressed={o.id === current}
          onClick={() => onChange({ ...studio, enforcement: o.id })}
          className={`rounded-sm px-2 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
            o.id === current ? 'bg-raised text-text-primary' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function SendTo({
  studio, themeId, onDone
}: {
  studio: TokenStudio
  themeId: string | null
  onDone: (message: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)
  const counts = useMemo(() => bridgeSummary(studio, themeId), [studio, themeId])

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent): void => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

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

  const row = 'flex w-full items-baseline justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-[11.5px] text-text-primary hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60'

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-md bg-surface px-2.5 py-1 text-[11.5px] text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        Send to
      </button>
      {open && (
        <div
          role="menu"
          className="t42-menu absolute right-0 top-full z-30 mt-1 w-64 rounded-panel bg-elevated p-1 shadow-lg ring-1 ring-border"
        >
          <button type="button" role="menuitem" className={row} onClick={toForm}>
            <span>Form</span>
            <span className="text-[10.5px] text-text-muted">{counts.variables} variables</span>
          </button>
          <button type="button" role="menuitem" className={row} onClick={() => void toMotion()}>
            <span>Motion</span>
            <span className="text-[10.5px] text-text-muted">
              {counts.colours} colours, {counts.fonts} typefaces
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
