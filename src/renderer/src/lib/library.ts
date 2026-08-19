// Shared library publishing. A design (file) can publish its variable collections
// and styles as a named library stored app-wide (localStorage), so other files can
// pull those assets in. This mirrors Figma's "publish a library" → other files
// "enable" it and consume its variables/styles. Components are already shared
// app-wide through design systems, so this layer covers variables + styles.

import type { VariableCollection } from './variables'
import { uniqueCollectionName } from './dtcg'
import type { StyleLibrary, ColorStyle, TextStyle, EffectStyle } from './styles'
import { normalizeLibrary, uniqueStyleName } from './styles'

export interface PublishedLibrary {
  id: string
  name: string
  publishedAt: number
  collections: VariableCollection[]
  styles: StyleLibrary
}

const KEY = 'terminal42:libraries:v1'

export function loadLibraries(): PublishedLibrary[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as PublishedLibrary[]
    return Array.isArray(arr) ? arr.map((l) => ({ ...l, styles: normalizeLibrary(l.styles) })) : []
  } catch { return [] }
}

export function saveLibraries(libs: PublishedLibrary[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(libs)) } catch { /* quota */ }
}

/** Publish (or re-publish) a library under a file name. Re-publishing by the same
 * name replaces the previous snapshot so consumers get the latest values. */
export function publishLibrary(
  name: string,
  collections: VariableCollection[],
  styles: StyleLibrary,
): PublishedLibrary[] {
  const libs = loadLibraries()
  const snapshot: PublishedLibrary = {
    id: `lib${Date.now().toString(36)}`,
    name: name.trim() || 'Untitled library',
    publishedAt: Date.now(),
    // deep-clone so later edits in the source file don't mutate the published copy
    collections: JSON.parse(JSON.stringify(collections)),
    styles: JSON.parse(JSON.stringify(normalizeLibrary(styles))),
  }
  const idx = libs.findIndex((l) => l.name === snapshot.name)
  if (idx >= 0) { snapshot.id = libs[idx].id; libs[idx] = snapshot } else libs.push(snapshot)
  saveLibraries(libs)
  return libs
}

export function deleteLibrary(id: string): PublishedLibrary[] {
  const libs = loadLibraries().filter((l) => l.id !== id)
  saveLibraries(libs)
  return libs
}

export function totalAssets(l: PublishedLibrary): { vars: number; styles: number } {
  const vars = l.collections.reduce((n, c) => n + c.variables.length, 0)
  const styles = l.styles.colors.length + l.styles.text.length + l.styles.effects.length
  return { vars, styles }
}

/** Merge a published library's collections + styles into a file's existing assets,
 * de-duplicating names (new ids are kept). Returns the merged results. */
export function mergeLibraryInto(
  lib: PublishedLibrary,
  collections: VariableCollection[],
  styles: StyleLibrary,
): { collections: VariableCollection[]; styles: StyleLibrary } {
  const mergedCols = [...collections]
  for (const c of JSON.parse(JSON.stringify(lib.collections)) as VariableCollection[]) {
    c.name = uniqueCollectionName(mergedCols, c.name)
    mergedCols.push(c)
  }
  const base = normalizeLibrary(styles)
  const out: StyleLibrary = { colors: [...base.colors], text: [...base.text], effects: [...base.effects] }
  for (const s of lib.styles.colors) out.colors.push({ ...s, name: uniqueStyleName(out, 'color', s.name) } as ColorStyle)
  for (const s of lib.styles.text) out.text.push({ ...s, name: uniqueStyleName(out, 'text', s.name) } as TextStyle)
  for (const s of lib.styles.effects) out.effects.push({ ...s, name: uniqueStyleName(out, 'effect', s.name) } as EffectStyle)
  return { collections: mergedCols, styles: out }
}
