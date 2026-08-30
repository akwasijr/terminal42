/**
 * Folders, scoped to the section they were made in.
 *
 * There used to be one flat list shared by every type. A folder called "Acme"
 * made while looking at decks also hung over tokens, over apps and over
 * websites, which is not organisation — it is one drawer with a different
 * label on the front each time you look.
 *
 * A folder now belongs to a section. The thing→folder map stays global,
 * because a thing belongs to exactly one folder wherever you are standing; it
 * is only the list of folders on offer that is scoped.
 *
 * This is a module-level store rather than state inside one component because
 * two lists now show folders — designs and token libraries — and each would
 * hold the whole scope map. If each kept its own copy, whichever saved last
 * would erase the other's folders.
 */
import { useCallback, useSyncExternalStore } from 'react'

/** A section key: a DesignGroup, or 'tokens' / 'system' / 'all'. */
export type FolderScope = string

const LEGACY_KEY = 't42-design-folders'
const KEY = 't42-design-folders-v2'
const MAP_KEY = 't42-design-folder-map'

export type FoldersByScope = Record<FolderScope, string[]>

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota */
  }
}

let folders: FoldersByScope = readJSON<FoldersByScope>(KEY, {})
let assignments: Record<string, string> = readJSON<Record<string, string>>(MAP_KEY, {})
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function getFolders(): FoldersByScope {
  return folders
}

export function getAssignments(): Record<string, string> {
  return assignments
}

function setFolders(next: FoldersByScope): void {
  folders = next
  write(KEY, next)
  emit()
}

function setAssignments(next: Record<string, string>): void {
  assignments = next
  write(MAP_KEY, next)
  emit()
}

export function listFolders(scope: FolderScope): string[] {
  return folders[scope] ?? []
}

export function createFolder(scope: FolderScope, name: string): boolean {
  const v = name.trim()
  if (!v || listFolders(scope).includes(v)) return false
  setFolders({ ...folders, [scope]: [...listFolders(scope), v] })
  return true
}

/**
 * Remove a folder from one section.
 *
 * `owns` decides which assignments go with it. Only the things in this section
 * are unassigned: the same folder name may be in use elsewhere, and emptying
 * that one too would be a surprise nobody asked for.
 */
export function removeFolder(scope: FolderScope, name: string, owns: (id: string) => boolean): void {
  setFolders({ ...folders, [scope]: listFolders(scope).filter((f) => f !== name) })
  const next = { ...assignments }
  let touched = false
  for (const id of Object.keys(next)) {
    if (next[id] === name && owns(id)) {
      delete next[id]
      touched = true
    }
  }
  if (touched) setAssignments(next)
}

export function assignFolder(id: string, folder: string | null): void {
  const next = { ...assignments }
  if (folder) next[id] = folder
  else delete next[id]
  setAssignments(next)
}

/** Whether an old flat list is still waiting to be moved across. */
export function hasLegacyFolders(): boolean {
  if (localStorage.getItem(KEY)) return false
  return readJSON<string[]>(LEGACY_KEY, []).length > 0
}

/**
 * Move the old flat list into the sections its things actually occupy.
 *
 * Dropping the lot into one scope would be simpler and would hide every
 * folder somebody had made, since they would look for them where their work
 * is. So each old folder is placed in the sections of the things assigned to
 * it; a folder with nothing in it has no section to infer, and goes to 'all'
 * where it is at least still visible.
 */
export function migrateLegacyFolders(scopeOf: (id: string) => FolderScope | null): void {
  const legacy = readJSON<string[]>(LEGACY_KEY, [])
  const out: FoldersByScope = { ...folders }
  const add = (scope: FolderScope, name: string): void => {
    const list = out[scope] ? [...out[scope]] : []
    if (!list.includes(name)) list.push(name)
    out[scope] = list
  }

  for (const name of legacy) {
    const scopes = new Set<FolderScope>()
    for (const [id, folder] of Object.entries(assignments)) {
      if (folder !== name) continue
      const s = scopeOf(id)
      if (s) scopes.add(s)
    }
    if (scopes.size === 0) add('all', name)
    else for (const s of scopes) add(s, name)
  }

  setFolders(out)
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* ignore */
  }
}

export type FoldersApi = {
  folders: string[]
  assignments: Record<string, string>
  create: (name: string) => boolean
  remove: (name: string, owns: (id: string) => boolean) => void
  assign: (id: string, folder: string | null) => void
  folderOf: (id: string) => string | null
  count: (name: string, owns: (id: string) => boolean) => number
}

/** Everything a list needs to show and edit the folders of one section. */
export function useFolders(scope: FolderScope): FoldersApi {
  const all = useSyncExternalStore(subscribe, getFolders, getFolders)
  const map = useSyncExternalStore(subscribe, getAssignments, getAssignments)
  return {
    folders: all[scope] ?? [],
    assignments: map,
    create: useCallback((name: string) => createFolder(scope, name), [scope]),
    remove: useCallback(
      (name: string, owns: (id: string) => boolean) => removeFolder(scope, name, owns),
      [scope]
    ),
    assign: assignFolder,
    folderOf: (id: string) => map[id] ?? null,
    count: (name: string, owns: (id: string) => boolean) =>
      Object.entries(map).filter(([id, f]) => f === name && owns(id)).length
  }
}
