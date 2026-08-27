// Brand sets: the colours and typefaces a piece is built from.
//
// A brand outlives any one piece. Setting the same four colours again in
// every new document is the sort of work a tool is supposed to remove, so
// the sets live in the database beside the pieces rather than inside them,
// and a piece that uses one keeps its own copy of the value — a document
// that referred to a set would break the day the set was deleted.
//
// Which set is in use is a view preference, not data, so it sits in
// localStorage: it should follow the person rather than travel with a file.

import { useCallback, useEffect, useState } from 'react'
import { hydrateStudio } from '../../../../shared/tokens/types'
import { brandItems } from '../../../../shared/tokens/bridges'

export type BrandKind = 'colours' | 'fonts'

export type BrandSet = {
  id: string
  kind: string
  name: string
  items: string[]
}

/**
 * The set every install starts with.
 *
 * Not written to the database, and not editable, so there is always
 * something to fall back to — including on the first run, before anyone has
 * made a set, and after the last one has been deleted.
 */
export const CORE_SETS: Record<BrandKind, BrandSet> = {
  colours: {
    id: 'core',
    kind: 'colours',
    name: 'System',
    items: ['#000000', '#ffffff', '#c9ccd1', '#2f6bff']
  },
  fonts: {
    id: 'core',
    kind: 'fonts',
    name: 'System',
    items: ['DM Sans', 'Space Grotesk', 'JetBrains Mono']
  }
}

/**
 * The sets a token library offers, one per theme.
 *
 * A library is the shared source of truth, so it appears here rather than
 * being copied here: the set is derived on load, and a colour changed in the
 * library is a different swatch the next time this panel opens. That is the
 * whole difference between this and pressing "Send to Motion", which took a
 * snapshot and left the two to drift.
 *
 * Read-only for the same reason. Editing a swatch here would edit it in one
 * piece and nowhere else, which is exactly the drift the library exists to
 * stop; "New" still copies one into a set of your own.
 */
const TOKENS_PREFIX = "tokens:"

export function libraryBrandSets(
  rows: Array<{ id: string; name: string; studio: unknown }>,
  kind: BrandKind
): BrandSet[] {
  const out: BrandSet[] = []
  for (const row of rows) {
    // Hydration guarantees at least one theme, so every library has at least
    // one row here and none goes missing for want of theming.
    const studio = hydrateStudio(row.studio)
    for (const theme of studio.themes) {
      const items = brandItems(studio, theme.id)[kind]
      if (items.length === 0) continue
      out.push({
        id: `${TOKENS_PREFIX}${row.id}:${theme.id}`,
        kind,
        name: `${row.name} · ${theme.name}`,
        items
      })
    }
  }
  return out
}

async function tokenSets(kind: BrandKind): Promise<BrandSet[]> {
  try {
    return libraryBrandSets(await window.terminal42.tokens.list(), kind)
  } catch {
    // A library that will not load should not cost the panel its own sets.
    return []
  }
}

/** Whether a set is a view onto a library rather than a set of its own. */
export function isTokensSet(id: string): boolean {
  return id.startsWith(TOKENS_PREFIX)
}

function activeKey(kind: BrandKind): string {
  return `t42.motion.brand.${kind}`
}

function readActive(kind: BrandKind): string {
  try {
    return localStorage.getItem(activeKey(kind)) ?? 'core'
  } catch {
    return 'core'
  }
}

function writeActive(kind: BrandKind, id: string): void {
  try { localStorage.setItem(activeKey(kind), id) } catch { /* private mode */ }
}

export type BrandLibrary = {
  sets: BrandSet[]
  active: BrandSet
  activeId: string
  choose: (id: string) => void
  create: (name: string) => Promise<void>
  update: (patch: { name?: string; items?: string[] }) => Promise<void>
  remove: () => Promise<void>
  /** The core set and any library view cannot be renamed, emptied or deleted. */
  readOnly: boolean
  /** Why the active set cannot be edited, said in full, or null if it can. */
  readOnlyWhy: string | null
}

export function useBrandLibrary(kind: BrandKind): BrandLibrary {
  const core = CORE_SETS[kind]
  const [sets, setSets] = useState<BrandSet[]>([core])
  const [activeId, setActiveId] = useState<string>(() => readActive(kind))

  const load = useCallback(async (): Promise<BrandSet[]> => {
    const [rows, tokens] = await Promise.all([
      window.terminal42.motion.brandSets(kind),
      tokenSets(kind)
    ])
    const all = [
      core,
      ...tokens,
      ...rows.map((r) => ({ id: r.id, kind: r.kind, name: r.name, items: r.items }))
    ]
    setSets(all)
    return all
  }, [kind, core])

  useEffect(() => {
    void load().then((all) => {
      // A set can be deleted from another window, or the file can be older
      // than the preference; falling back keeps the panel showing something
      // rather than an empty selector.
      if (!all.some((s) => s.id === readActive(kind))) setActiveId('core')
    })
  }, [load, kind])

  const active = sets.find((s) => s.id === activeId) ?? core

  const choose = useCallback((id: string): void => {
    setActiveId(id)
    writeActive(kind, id)
  }, [kind])

  const create = useCallback(async (name: string): Promise<void> => {
    const row = await window.terminal42.motion.saveBrandSet({
      kind,
      name,
      // Started from whatever is on screen, because a new set is nearly
      // always a variation on the one you were looking at.
      items: [...active.items]
    })
    await load()
    choose(row.id)
  }, [kind, active.items, load, choose])

  const update = useCallback(async (patch: { name?: string; items?: string[] }): Promise<void> => {
    if (active.id === 'core' || isTokensSet(active.id)) return
    await window.terminal42.motion.saveBrandSet({
      id: active.id,
      kind,
      name: patch.name ?? active.name,
      items: patch.items ?? active.items
    })
    await load()
  }, [active, kind, load])

  const remove = useCallback(async (): Promise<void> => {
    if (active.id === 'core' || isTokensSet(active.id)) return
    await window.terminal42.motion.deleteBrandSet(active.id)
    choose('core')
    await load()
  }, [active.id, choose, load])

  return {
    sets,
    active,
    activeId: active.id,
    choose,
    create,
    update,
    remove,
    readOnly: active.id === 'core' || isTokensSet(active.id),
    readOnlyWhy: isTokensSet(active.id)
      ? 'This comes from a token library, so it changes when the library does. Press New to start a set of your own from it.'
      : active.id === 'core'
        ? 'The system set is always here and cannot be edited. Make a set of your own to add to it.'
        : null
  }
}

/** The active colours, for anything that only wants to read them. */
export function useBrandColours(): string[] {
  const { active } = useBrandLibrary('colours')
  return active.items.length > 0 ? active.items : CORE_SETS.colours.items
}
