// The token studio: a grid of what the tokens look like, not a tree of names.
//
// A token is a value with a name, and of the two the value is the one you
// recognise. So a colour is drawn as a colour, a spacing as a bar at its true
// width, a size as a line of type set at it. The name goes underneath, small.
// A tree of dot paths would be truthful and useless.
//
// Tier is a filter rather than a folder, because a token belongs to exactly
// one tier and nothing on screen is ever more than one level deep.
//
// Selecting a token dims everything except what it points at and what points
// at it. That one gesture is the whole idea of aliasing, and it teaches it
// faster than any amount of writing on the subject.

import { useEffect, useMemo, useState } from 'react'
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
  type TokenValue
} from '../../../../shared/tokens/types'
import { flatten, problems, resolve, type Problem } from '../../../../shared/tokens/resolve'
import { addToken, blankValue, deleteToken, renameToken, setAlias, setTokenValue } from '../../../../shared/tokens/edit'
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
          Colours, sizes and type as named values, layered into themes.
        </p>
        <button
          type="button"
          onClick={() => setSetupOpen(true)}
          className="shrink-0 rounded-md bg-action px-3 py-1.5 text-[13px] font-medium text-action-text hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          New tokens
        </button>
      </div>

      {loading ? null : rows.length === 0 ? (
        <p className="rounded-panel bg-surface px-4 py-10 text-center text-[12.5px] text-text-muted">
          Nothing yet. A set of tokens is where a look stops being a habit and starts being a
          decision you can point at.
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
  const [tier, setTier] = useState<Tier | 'all'>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickerRequest | null>(null)
  const [adding, setAdding] = useState<{ setId: string; rect: DOMRect } | null>(null)
  const [onlyProblems, setOnlyProblems] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const themeId = studio.activeTheme
  const map = useMemo(() => flatten(studio, themeId), [studio, themeId])
  const found = useMemo(() => problems(studio, themeId), [studio, themeId])
  const problemPaths = useMemo(() => new Set(found.map((p) => p.path)), [found])

  const paths = useMemo(() => {
    return [...map.keys()].sort().filter((p) => {
      if (onlyProblems && !problemPaths.has(p)) return false
      if (tier !== 'all' && map.get(p)?.token.tier !== tier) return false
      return true
    })
  }, [map, tier, onlyProblems, problemPaths])

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

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center gap-2">
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
          aria-label="Studio name"
          className="w-56 min-w-0 rounded-sm bg-transparent px-1 py-0.5 text-[13px] text-text-primary hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        />

        <div className="ml-2 flex items-center gap-1">
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

        <div className="ml-auto flex items-center gap-1">
          {(['all', ...TIERS] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              aria-pressed={tier === t}
              className={`rounded-md px-2 py-1 text-[11px] capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                tier === t
                  ? 'bg-raised text-text-primary'
                  : 'text-text-muted hover:bg-raised hover:text-text-secondary'
              }`}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void exportFiles()}
            className="ml-2 rounded-md bg-action px-2.5 py-1 text-[11.5px] font-medium text-action-text hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Export
          </button>
        </div>
      </header>

      <div className="flex min-h-0 gap-3">
        <aside className="w-48 shrink-0 rounded-panel bg-surface p-2">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-[11px] text-text-secondary">Sets</span>
            <button
              type="button"
              onClick={addSet}
              aria-label="Add a set"
              className="rounded-sm px-1.5 text-[12px] leading-none text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              +
            </button>
          </div>
          <ul className="flex flex-col gap-0.5">
            {[...studio.sets]
              .sort((a, b) => a.order - b.order)
              .map((s) => {
                const state = studio.themes.find((t) => t.id === themeId)?.sets[s.id] ?? 'off'
                return (
                  <li
                    key={s.id}
                    className="group/set flex items-center gap-1 rounded-sm px-1.5 py-1 hover:bg-raised"
                  >
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-text-secondary">
                      {s.name}
                    </span>
                    <span className="text-[10px] tabular-nums text-text-muted">{s.tokens.length}</span>
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
                      className={`h-3 w-3 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${STATE_DOT[state]}`}
                    />
                  </li>
                )
              })}
          </ul>
        </aside>

        <section className="min-w-0 flex-1 rounded-panel bg-surface p-3">
          {paths.length === 0 ? (
            <p className="px-2 py-10 text-center text-[12px] text-text-muted">
              {onlyProblems ? 'Nothing wrong here.' : 'No tokens in this theme yet.'}
            </p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
              {paths.map((path) => {
                const hit = map.get(path)
                if (!hit) return null
                const r = resolve(map, path)
                const dim = related !== null && !related.has(path)
                return (
                  <li key={path}>
                    <button
                      type="button"
                      data-token-swatch=""
                      data-token-path={path}
                      onClick={() => setSelected((c) => (c === path ? null : path))}
                      aria-pressed={selected === path}
                      className={`w-full rounded-md p-1 text-left transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                        dim ? 'opacity-25' : 'opacity-100'
                      } ${selected === path ? 'bg-raised' : 'hover:bg-raised'}`}
                    >
                      <TokenMark token={hit.token} value={r.ok ? r.value : null} />
                      <span className="mt-1.5 block truncate text-[10.5px] text-text-secondary">
                        {leaf(path)}
                      </span>
                      <span className="block truncate text-[9.5px] text-text-muted">
                        {isAlias(hit.token.value)
                          ? aliasTarget(hit.token.value)
                          : shortValue(r.ok ? r.value : hit.token.value)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
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

/** Enough of a dot path to tell two tokens apart, without the whole of it. */
function leaf(path: string): string {
  const parts = path.split('.')
  return parts.length > 1 ? parts.slice(-2).join('.') : path
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
    case 'dimension':
    case 'letterSpacing':
      return (
        <span className="flex h-12 items-center rounded-md bg-sunken px-1.5">
          <span
            style={{ width: Math.max(2, Math.min(72, Math.abs(parseFloat(String(value))) || 0)) }}
            className="block h-1.5 rounded-full bg-accent"
          />
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

function num(v: string | number | undefined): number {
  return typeof v === 'number' ? v : parseFloat(String(v ?? 0)) || 0
}

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
}): React.JSX.Element {
  if (note) {
    return (
      <p className="px-1 text-[11px] text-text-secondary" role="status">
        {note}
      </p>
    )
  }
  if (found.length === 0) {
    return <p className="px-1 text-[11px] text-text-muted">Everything resolves.</p>
  }
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
