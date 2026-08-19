// Figma-style design variables. A document holds a set of variable collections;
// each collection defines one or more "modes" (e.g. Light/Dark, Mobile/Desktop)
// and a set of variables. A variable stores one value per mode. Values are either
// a literal (color hex / number / string / boolean) or an alias pointing at another
// variable (resolved transitively). Object fields bind to a variable by id; at
// render time the bound field is replaced with the variable's value for the
// collection's active mode.

import type { FObj } from './freeformTypes'

export type VarType = 'color' | 'number' | 'string' | 'boolean'

/** An alias value: this variable defers to another variable (by id). */
export interface VarAlias {
  alias: string
}

export type VarLiteral = string | number | boolean
export type VarValue = VarLiteral | VarAlias

export function isAlias(v: VarValue | undefined): v is VarAlias {
  return !!v && typeof v === 'object' && 'alias' in v
}

export interface Variable {
  id: string
  name: string
  type: VarType
  /** value per modeId; missing modes fall back to the collection's first mode. */
  values: Record<string, VarValue>
  description?: string
  /** Optional per-platform names used when the variable is surfaced in code. */
  codeSyntax?: { web?: string; android?: string; ios?: string }
  /** Which property groups this variable may bind to. Empty/undefined = every
   * property of its type (Figma calls this "All" scopes). */
  scopes?: VarScope[]
}

export interface VarMode {
  id: string
  name: string
}

export interface VariableCollection {
  id: string
  name: string
  modes: VarMode[]
  /** mode used when resolving values for the canvas. */
  activeMode: string
  variables: Variable[]
}

// ── id helpers ──────────────────────────────────────────────────────────────
let vcounter = 0
function uid(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${(vcounter++).toString(36)}`
}
export const newCollectionId = (): string => uid('vc')
export const newModeId = (): string => uid('vm')
export const newVariableId = (): string => uid('var')

// ── defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_FOR: Record<VarType, VarLiteral> = {
  color: '#3b82f6',
  number: 0,
  string: '',
  boolean: false,
}

export function defaultValueFor(type: VarType): VarLiteral {
  return DEFAULT_FOR[type]
}

/** A starter collection with a single mode so the panel is never empty. */
export function makeCollection(name = 'Collection 1'): VariableCollection {
  const mode: VarMode = { id: newModeId(), name: 'Mode 1' }
  return { id: newCollectionId(), name, modes: [mode], activeMode: mode.id, variables: [] }
}

export function makeVariable(type: VarType, name: string, modes: VarMode[]): Variable {
  const values: Record<string, VarValue> = {}
  for (const m of modes) values[m.id] = defaultValueFor(type)
  return { id: newVariableId(), name, type, values }
}

// ── lookup + resolution ───────────────────────────────────────────────────────
export interface VarLookup {
  collection: VariableCollection
  variable: Variable
}

export function findVariable(collections: VariableCollection[], id: string): VarLookup | null {
  for (const c of collections) {
    const v = c.variables.find((x) => x.id === id)
    if (v) return { collection: c, variable: v }
  }
  return null
}

/** A per-collection mode override map (collectionId → modeId), used so a frame
 * can render its subtree in a different mode than the document default. */
export type ModeOverrides = Record<string, string>

/** The raw value of a variable for the effective mode of its collection (no alias
 * following). `modeOverrides` lets a caller pin a collection to a specific mode;
 * otherwise the collection's default (active) mode is used. */
function rawValue(c: VariableCollection, v: Variable, modeOverrides?: ModeOverrides): VarValue | undefined {
  const modeId = modeOverrides?.[c.id] ?? c.activeMode
  const val = v.values[modeId]
  if (val !== undefined) return val
  // fall back to the first mode that has a value
  for (const m of c.modes) if (v.values[m.id] !== undefined) return v.values[m.id]
  return undefined
}

/**
 * Resolve a variable id to a concrete literal for the current modes, following
 * aliases. Returns null on a missing variable, a broken alias, or an alias cycle.
 */
export function resolveVarValue(
  collections: VariableCollection[],
  id: string,
  modeOverrides?: ModeOverrides,
  seen: Set<string> = new Set(),
): VarLiteral | null {
  if (seen.has(id)) return null
  seen.add(id)
  const found = findVariable(collections, id)
  if (!found) return null
  const val = rawValue(found.collection, found.variable, modeOverrides)
  if (val === undefined) return null
  if (isAlias(val)) return resolveVarValue(collections, val.alias, modeOverrides, seen)
  return val
}

/** The variable type a given object field expects (color vs number). */
export type BindField =
  | 'fill' | 'stroke' | 'color' | 'borderColor' | 'shadowColor'
  | 'radius' | 'opacity' | 'fontSize' | 'strokeWidth' | 'letterSpacing' | 'lineHeight'
  | 'layoutGap' | 'layoutPadding' | 'layoutPadX' | 'layoutPadY'
  | 'text' | 'fontFamily' | 'visible'

const COLOR_FIELDS: BindField[] = ['fill', 'stroke', 'color', 'borderColor', 'shadowColor']
const STRING_FIELDS: BindField[] = ['text', 'fontFamily']
const BOOL_FIELDS: BindField[] = ['visible']

export function fieldVarType(field: BindField): VarType {
  if (COLOR_FIELDS.includes(field)) return 'color'
  if (STRING_FIELDS.includes(field)) return 'string'
  if (BOOL_FIELDS.includes(field)) return 'boolean'
  return 'number'
}

/** Human label for a bindable field (inspector tooltip / popover heading). */
export const FIELD_LABEL: Record<BindField, string> = {
  fill: 'Fill', stroke: 'Stroke', color: 'Text color', borderColor: 'Border color', shadowColor: 'Shadow color',
  radius: 'Corner radius', opacity: 'Opacity', fontSize: 'Font size', strokeWidth: 'Stroke width',
  letterSpacing: 'Letter spacing', lineHeight: 'Line height',
  layoutGap: 'Gap', layoutPadding: 'Padding', layoutPadX: 'Padding X', layoutPadY: 'Padding Y',
  text: 'Text content', fontFamily: 'Font family', visible: 'Visibility',
}

// ── scoping ─────────────────────────────────────────────────────────────────
// A scope limits which properties a variable may bind to (Figma's "Scoping").
// Each scope covers a set of bindable fields. A variable with no scopes is
// treated as "All" and can bind to any field of its type.
export type VarScope =
  | 'fillColor' | 'strokeColor' | 'textColor' | 'effectColor'
  | 'cornerRadius' | 'sizeGap' | 'strokeWidth' | 'opacity' | 'typography'

const SCOPE_FIELDS: Record<VarScope, BindField[]> = {
  fillColor: ['fill', 'borderColor'],
  strokeColor: ['stroke'],
  textColor: ['color'],
  effectColor: ['shadowColor'],
  cornerRadius: ['radius'],
  sizeGap: ['layoutGap', 'layoutPadding', 'layoutPadX', 'layoutPadY'],
  strokeWidth: ['strokeWidth'],
  opacity: ['opacity'],
  typography: ['fontSize', 'letterSpacing', 'lineHeight'],
}

/** Human label for a scope (edit modal + tooltips). */
export const SCOPE_LABEL: Record<VarScope, string> = {
  fillColor: 'Frame & shape fill', strokeColor: 'Stroke', textColor: 'Text', effectColor: 'Effects',
  cornerRadius: 'Corner radius', sizeGap: 'Size, gap & padding', strokeWidth: 'Stroke width',
  opacity: 'Opacity', typography: 'Typography',
}

/** Scopes offered for a given variable type, in display order. */
export function scopesForType(type: VarType): VarScope[] {
  if (type === 'color') return ['fillColor', 'strokeColor', 'textColor', 'effectColor']
  if (type === 'number') return ['cornerRadius', 'sizeGap', 'strokeWidth', 'opacity', 'typography']
  return []
}

/** Whether a variable (with its optional scopes) may bind to a field. */
export function variableAllowsField(v: Variable, field: BindField): boolean {
  if (fieldVarType(field) !== v.type) return false
  if (!v.scopes || v.scopes.length === 0) return true
  return v.scopes.some((s) => SCOPE_FIELDS[s].includes(field))
}

/** Variables (across collections) that may bind to a given field, respecting scope. */
export function variablesForField(
  collections: VariableCollection[],
  field: BindField,
): { collection: VariableCollection; variable: Variable }[] {
  const out: { collection: VariableCollection; variable: Variable }[] = []
  for (const c of collections) for (const v of c.variables) if (variableAllowsField(v, field)) out.push({ collection: c, variable: v })
  return out
}

/**
 * Apply an object's variable bindings, returning a shallow clone with bound fields
 * replaced by their resolved values for the active modes. Returns the same object
 * (no clone) when it has no usable bindings, so referential equality is preserved
 * for unbound objects.
 */
export function resolveObject(o: FObj, collections: VariableCollection[], modeOverrides?: ModeOverrides): FObj {
  const bindings = o.bindings
  if (!bindings) return o
  let out: FObj | null = null
  for (const key of Object.keys(bindings) as BindField[]) {
    const varId = bindings[key]
    if (!varId) continue
    const val = resolveVarValue(collections, varId, modeOverrides)
    if (val === null) continue
    const want = fieldVarType(key)
    if (want === 'color' && typeof val !== 'string') continue
    if (want === 'number' && typeof val !== 'number') continue
    if (want === 'string' && typeof val !== 'string') continue
    if (want === 'boolean' && typeof val !== 'boolean') continue
    if (!out) out = { ...o }
    ;(out as unknown as Record<string, VarLiteral>)[key] = val
    // a bound colour fill must render as a solid paint
    if (key === 'fill') { out.fillEnabled = true; out.fillMode = 'solid' }
    if (key === 'stroke') { out.strokeEnabled = true; out.strokeMode = 'solid' }
  }
  return out ?? o
}

/** Effective variable-mode overrides for an object: walk from the farthest ancestor
 * down to the object itself so the nearest override for each collection wins. */
export function effectiveVarModes(o: FObj, byId: Map<string, FObj>): ModeOverrides | undefined {
  const chain: FObj[] = []
  let cur: FObj | undefined = o
  for (let g = 0; cur && g < 32; g++) { chain.push(cur); cur = cur.parent ? byId.get(cur.parent) : undefined }
  let out: ModeOverrides | undefined
  for (let i = chain.length - 1; i >= 0; i--) {
    const vm = chain[i].varModes
    if (vm && Object.keys(vm).length) out = { ...(out ?? {}), ...vm }
  }
  return out
}

/** Map every object through {@link resolveObject}, honouring per-frame mode
 * overrides inherited through the parent chain. */
export function resolveObjects(objects: FObj[], collections: VariableCollection[]): FObj[] {
  if (!collections.length) return objects
  const hasModeOverrides = objects.some((o) => o.varModes && Object.keys(o.varModes).length)
  if (!hasModeOverrides) return objects.map((o) => resolveObject(o, collections))
  const byId = new Map(objects.map((o) => [o.id, o]))
  return objects.map((o) => resolveObject(o, collections, effectiveVarModes(o, byId)))
}

/** Variables in all collections matching a type, for a binding popover. */
export function variablesOfType(
  collections: VariableCollection[],
  type: VarType,
): { collection: VariableCollection; variable: Variable }[] {
  const out: { collection: VariableCollection; variable: Variable }[] = []
  for (const c of collections) for (const v of c.variables) if (v.type === type) out.push({ collection: c, variable: v })
  return out
}

/** Fully-qualified display name "Collection / Variable" for a variable id. */
export function variableLabel(collections: VariableCollection[], id: string): string | null {
  const f = findVariable(collections, id)
  if (!f) return null
  return f.variable.name
}

/** Split a "/"-delimited variable name into its group path and leaf name, e.g.
 * "background/card/rest" → { group: ["background","card"], leaf: "rest" }. */
export function splitVarName(name: string): { group: string[]; leaf: string } {
  const parts = name.split('/').map((p) => p.trim()).filter(Boolean)
  if (parts.length <= 1) return { group: [], leaf: name.trim() || name }
  return { group: parts.slice(0, -1), leaf: parts[parts.length - 1] }
}

/** A copied variable, ready to paste into any collection. Values are resolved to
 * concrete literals (one per source mode) so paste never produces broken aliases. */
export interface VarClip {
  type: VarType
  name: string
  values: VarLiteral[]
}

/** A collection-unique variable name, appending " copy" (then a counter) as needed. */
export function uniqueVarName(c: VariableCollection, base: string): string {
  const taken = new Set(c.variables.map((v) => v.name))
  if (!taken.has(base)) return base
  let candidate = `${base} copy`
  let n = 2
  while (taken.has(candidate)) candidate = `${base} copy ${n++}`
  return candidate
}

/** A variable plus its computed group path, sorted so shared groups cluster. */
export interface GroupedVar {
  variable: Variable
  group: string[]
  leaf: string
}

/** Sort a collection's variables by name and annotate each with its group path,
 * so a table can insert a header row whenever the group path changes. */
export function groupedVariables(variables: Variable[]): GroupedVar[] {
  return variables
    .map((variable) => ({ variable, ...splitVarName(variable.name) }))
    .sort((a, b) => a.variable.name.localeCompare(b.variable.name, undefined, { numeric: true }))
}

/** The distinct top-level (and nested) group paths present in a collection, for a
 * groups navigation tree. Each entry is a "/"-joined path with a variable count. */
export function variableGroups(variables: Variable[]): { path: string; depth: number; count: number }[] {
  const counts = new Map<string, number>()
  for (const v of variables) {
    const { group } = splitVarName(v.name)
    for (let i = 0; i < group.length; i++) {
      const path = group.slice(0, i + 1).join('/')
      counts.set(path, (counts.get(path) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([path, count]) => ({ path, depth: path.split('/').length - 1, count }))
}
