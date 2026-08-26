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
  /** The core set cannot be renamed, emptied or deleted. */
  readOnly: boolean
}

export function useBrandLibrary(kind: BrandKind): BrandLibrary {
  const core = CORE_SETS[kind]
  const [sets, setSets] = useState<BrandSet[]>([core])
  const [activeId, setActiveId] = useState<string>(() => readActive(kind))

  const load = useCallback(async (): Promise<BrandSet[]> => {
    const rows = await window.terminal42.motion.brandSets(kind)
    const all = [core, ...rows.map((r) => ({ id: r.id, kind: r.kind, name: r.name, items: r.items }))]
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
    if (active.id === 'core') return
    await window.terminal42.motion.saveBrandSet({
      id: active.id,
      kind,
      name: patch.name ?? active.name,
      items: patch.items ?? active.items
    })
    await load()
  }, [active, kind, load])

  const remove = useCallback(async (): Promise<void> => {
    if (active.id === 'core') return
    await window.terminal42.motion.deleteBrandSet(active.id)
    choose('core')
    await load()
  }, [active.id, choose, load])

  return { sets, active, activeId: active.id, choose, create, update, remove, readOnly: active.id === 'core' }
}

/** The active colours, for anything that only wants to read them. */
export function useBrandColours(): string[] {
  const { active } = useBrandLibrary('colours')
  return active.items.length > 0 ? active.items : CORE_SETS.colours.items
}
