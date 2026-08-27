/**
 * The library as something Form can subscribe to.
 *
 * Form already has the right idea: a file publishes its variables under a
 * name, other files enable it, and re-publishing under the same name replaces
 * the snapshot so everyone gets the new values. That is exactly the shape a
 * shared library needs, so the token library borrows it rather than inventing
 * a second mechanism that means the same thing.
 *
 * One collection with a mode per theme, not one collection per theme. A Form
 * file that wants dark should flip a mode, not swap every binding it made.
 *
 * Lives in the renderer because Form's variables do. The parts that can be
 * argued about without a browser are in shared/tokens/bridges.ts.
 */

import type { TokenStudio } from '../../../../shared/tokens/types'
import { resolveAll } from '../../../../shared/tokens/resolve'
import { formVarType } from '../../../../shared/tokens/bridges'
import type { VarMode, VarType, VarValue, Variable, VariableCollection } from '../variables'
import { newCollectionId, newModeId, newVariableId } from '../variables'
import { publishLibrary, type PublishedLibrary } from '../library'

function literal(type: VarType, value: unknown): VarValue | null {
  if (type === 'color' || type === 'string') return typeof value === 'string' ? value : null
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const n = parseFloat(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

/**
 * The library as one collection, with a mode per theme.
 *
 * A variable is named by its dot path with slashes, because that is how Form
 * groups a long list into something scrollable, and the library's paths
 * already carry the grouping somebody chose.
 *
 * Primitives are left behind. A Form file binding a fill to `neutral/900` has
 * reached past the library into its workings, which is the habit the library
 * exists to break.
 */
export function toFormCollection(studio: TokenStudio, libraryId?: string): VariableCollection {
  const themes = studio.themes.length ? studio.themes : [{ id: 'default', name: 'Default' }]
  // Bound to a library, every id is derived from what it stands for, so
  // rebuilding the collection tomorrow produces the same ids as today and the
  // bindings a file already made keep pointing at the same colour. Random ids
  // would make every re-sync a silent unbinding.
  const modes: VarMode[] = themes.map((t) =>
    libraryId ? { id: `tokmode:${libraryId}:${t.id}`, name: t.name } : { id: newModeId(), name: t.name }
  )

  // Built per path so a token missing from one theme still lands, carrying the
  // value it does have. A hole in one mode is better than a missing variable.
  const rows = new Map<string, { type: VarType; values: Record<string, VarValue> }>()
  themes.forEach((theme, i) => {
    for (const [path, hit] of resolveAll(studio, theme.id)) {
      if (hit.token.tier === 'primitive') continue
      const vt = formVarType(hit.token.type)
      if (!vt) continue
      const v = literal(vt, hit.value)
      if (v === null) continue
      const row = rows.get(path) ?? { type: vt, values: {} }
      if (row.type !== vt) continue
      row.values[modes[i].id] = v
      rows.set(path, row)
    }
  })

  const variables: Variable[] = [...rows.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([path, row]) => ({
      id: libraryId ? `tokvar:${libraryId}:${path}` : newVariableId(),
      name: path.replace(/\./g, '/'),
      type: row.type,
      values: row.values
    }))

  return {
    id: libraryId ? `tokcol:${libraryId}` : newCollectionId(),
    name: studio.name,
    modes,
    activeMode: modes[themes.findIndex((t) => t.id === studio.activeTheme)]?.id ?? modes[0].id,
    variables,
    ...(libraryId ? { fromTokens: libraryId } : {})
  }
}

/**
 * Put a bound library into a file's collections, replacing the last copy.
 *
 * Matched on which library it came from rather than on name or id, so renaming
 * the library updates the collection instead of growing a second one. The
 * file's own collections are left exactly as they were.
 */
export function syncTokensCollection(
  collections: VariableCollection[],
  studio: TokenStudio | null,
  libraryId: string | null
): VariableCollection[] {
  // Every derived collection goes, not just this library's: a file has one
  // binding, so a collection from a library it is no longer bound to is a
  // stale copy of somebody else's colours.
  const kept = collections.filter((c) => !c.fromTokens)
  if (!studio || !libraryId) return kept
  const built = toFormCollection(studio, libraryId)
  const at = collections.findIndex((c) => c.fromTokens === libraryId)
  // Whatever mode the file was last looking at, not whatever the library screen
  // happens to be showing: a file put into dark should stay in dark.
  const before = at >= 0 ? collections[at] : null
  if (before && built.modes.some((m) => m.id === before.activeMode)) built.activeMode = before.activeMode
  if (at < 0) return [...kept, built]
  const out = [...kept]
  out.splice(Math.min(at, out.length), 0, built)
  return out
}

/**
 * Publish the library so any Form file can enable it.
 *
 * No styles: colour and text styles are a second way to say what a variable
 * already says, and shipping both would let a file bind to one and read the
 * other. Variables win because they carry themes.
 */
export function publishToForm(studio: TokenStudio): PublishedLibrary[] {
  return publishLibrary(studio.name, [toFormCollection(studio)], { colors: [], text: [], effects: [] })
}

/**
 * Whether a re-sync actually changed anything.
 *
 * Opening a file must not mark it as edited. Without this the sync writes an
 * identical collection back on every open, the auto-save fires, and the file's
 * modified time creeps forward for a change nobody made.
 */
export function sameCollections(a: VariableCollection[], b: VariableCollection[]): boolean {
  return a.length === b.length && JSON.stringify(a) === JSON.stringify(b)
}
