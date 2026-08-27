// Sets in folders.
//
// A studio outgrows a flat list of sets quickly: the moment there is a set
// per brand and a set per theme, `Nike Light`, `Nike Dark`, `Adidas Light`,
// `Adidas Dark` is a list you have to read rather than a shape you can see.
//
// Rather than add a parent field, a folder is written into the name with a
// slash, the way a token's own group is. That means nesting arrives for free
// from anything imported, since the plugin format already names sets that
// way, it survives export without a new field, and a set is moved between
// folders by renaming it, which is the only operation there could be.

import type { SetState, TokenSet, TokenStudio } from './types'

export type SetNode =
  | { kind: 'folder'; name: string; path: string; children: SetNode[] }
  | { kind: 'set'; name: string; set: TokenSet }

/** The last part of a slash path, which is what a set is called. */
export function leafName(name: string): string {
  const parts = name.split('/')
  return parts[parts.length - 1].trim() || name
}

/** The folder a set sits in, or an empty string when it sits at the top. */
export function folderOf(name: string): string {
  const at = name.lastIndexOf('/')
  return at === -1 ? '' : name.slice(0, at)
}

/**
 * The sets arranged as folders.
 *
 * Order is kept: a folder appears where its first set appears, and sets keep
 * their stacking order inside it. Sorting folders by name instead would put
 * the tree at odds with the stack it is drawing, and the stack is what
 * decides which value wins.
 */
export function treeOfSets(sets: TokenSet[]): SetNode[] {
  const roots: SetNode[] = []
  const folders = new Map<string, SetNode & { kind: 'folder' }>()

  const folderAt = (path: string): SetNode & { kind: 'folder' } => {
    const found = folders.get(path)
    if (found) return found
    const at = path.lastIndexOf('/')
    const node: SetNode & { kind: 'folder' } = {
      kind: 'folder',
      name: path.slice(at + 1),
      path,
      children: []
    }
    folders.set(path, node)
    if (at === -1) roots.push(node)
    else folderAt(path.slice(0, at)).children.push(node)
    return node
  }

  for (const set of [...sets].sort((a, b) => a.order - b.order)) {
    const parent = folderOf(set.name)
    const leaf: SetNode = { kind: 'set', name: leafName(set.name), set }
    if (parent === '') roots.push(leaf)
    else folderAt(parent).children.push(leaf)
  }
  return roots
}

/** Every set under a node, however deep. */
export function setsUnder(node: SetNode): TokenSet[] {
  if (node.kind === 'set') return [node.set]
  return node.children.flatMap(setsUnder)
}

/**
 * What state a folder is in.
 *
 * `mixed` is a real answer, not a failure to have one: a brand folder with
 * its palette on source and its semantics enabled is correctly set up, and
 * showing it as one or the other would be a lie about half of it.
 */
export function folderState(
  studio: TokenStudio,
  themeId: string | null,
  node: SetNode
): SetState | 'mixed' {
  const theme = studio.themes.find((t) => t.id === themeId)
  const states = setsUnder(node).map((s) => theme?.sets[s.id] ?? 'off')
  if (states.length === 0) return 'off'
  return states.every((s) => s === states[0]) ? states[0] : 'mixed'
}

/** Put every set under a node into the same state. */
export function setFolderState(
  studio: TokenStudio,
  themeId: string | null,
  node: SetNode,
  state: SetState
): TokenStudio {
  const ids = new Set(setsUnder(node).map((s) => s.id))
  return {
    ...studio,
    themes: studio.themes.map((t) =>
      t.id === themeId
        ? { ...t, sets: { ...t.sets, ...Object.fromEntries([...ids].map((id) => [id, state])) } }
        : t
    )
  }
}

/**
 * Rename a set, which is also how a set is moved between folders.
 *
 * Slashes are kept, since they are the whole point, but an empty name or one
 * that collides with another set is refused: two sets with the same full name
 * would be indistinguishable in the tree and in any file written out of it.
 */
export function renameSet(studio: TokenStudio, setId: string, to: string): TokenStudio {
  const clean = to
    .split('/')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join('/')
  if (clean.length === 0) return studio
  if (studio.sets.some((s) => s.id !== setId && s.name === clean)) return studio
  return { ...studio, sets: studio.sets.map((s) => (s.id === setId ? { ...s, name: clean } : s)) }
}

/**
 * Rename a folder, carrying everything inside it.
 *
 * Done as a prefix rewrite on the set names rather than by walking the tree,
 * because the tree is derived from those names and the names are the thing
 * that has to end up right.
 */
export function renameFolder(studio: TokenStudio, path: string, to: string): TokenStudio {
  const at = path.lastIndexOf('/')
  const leaf = to.trim().replace(/\//g, ' ')
  if (leaf.length === 0) return studio
  const next = at === -1 ? leaf : `${path.slice(0, at)}/${leaf}`
  if (next === path) return studio
  return {
    ...studio,
    sets: studio.sets.map((s) =>
      s.name === path || s.name.startsWith(`${path}/`)
        ? { ...s, name: `${next}${s.name.slice(path.length)}` }
        : s
    )
  }
}
