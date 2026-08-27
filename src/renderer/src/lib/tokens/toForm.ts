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
export function toFormCollection(studio: TokenStudio): VariableCollection {
  const themes = studio.themes.length ? studio.themes : [{ id: 'default', name: 'Default' }]
  const modes: VarMode[] = themes.map((t) => ({ id: newModeId(), name: t.name }))

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
      id: newVariableId(),
      name: path.replace(/\./g, '/'),
      type: row.type,
      values: row.values
    }))

  return {
    id: newCollectionId(),
    name: studio.name,
    modes,
    activeMode: modes[themes.findIndex((t) => t.id === studio.activeTheme)]?.id ?? modes[0].id,
    variables
  }
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
