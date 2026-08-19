// Import / export design variables in the DTCG (Design Tokens Community Group /
// W3C) JSON format. A token file is a tree of groups; each leaf token carries a
// `$type` and `$value` (and optional `$description`). Aliases are written as
// reference strings — `{group.token}` — resolved from the document root.
//
// The W3C spec has no notion of Figma-style "modes", so a collection with more
// than one mode is written as one sub-group per mode, and a small `$extensions`
// block records the collection's mode names + default mode so an import can
// round-trip it. Single-mode collections write their tokens directly.

import {
  type VarType, type VarValue, type Variable, type VariableCollection, type VarMode,
  isAlias, defaultValueFor, newCollectionId, newModeId, newVariableId,
} from './variables'

const EXT_KEY = 'com.terminal42.variables'
const RESERVED = new Set(['$type', '$value', '$description', '$extensions', '$deprecated'])

interface Ext { collection: true; modes: string[]; activeMode: string }
type TokenNode = { $type?: string; $value?: unknown; $description?: string; $extensions?: Record<string, unknown>; [k: string]: unknown }

const TYPE_OUT: Record<VarType, string> = { color: 'color', number: 'number', string: 'string', boolean: 'boolean' }
function typeIn(t: string | undefined, value: unknown): VarType {
  if (t === 'color') return 'color'
  if (t === 'number' || t === 'dimension') return 'number'
  if (t === 'boolean') return 'boolean'
  if (t === 'string' || t === 'fontFamily' || t === 'content') return 'string'
  // infer from the value when $type is absent
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string' && /^#([0-9a-f]{3,8})$/i.test(value.trim())) return 'color'
  return 'string'
}

// ── export ────────────────────────────────────────────────────────────────────

/** A stable dotted path to every variable, used to write alias references. */
function pathIndex(collections: VariableCollection[]): Map<string, { col: VariableCollection; varPath: string }> {
  const idx = new Map<string, { col: VariableCollection; varPath: string }>()
  for (const c of collections) for (const v of c.variables) idx.set(v.id, { col: c, varPath: v.name })
  return idx
}

function refFor(targetId: string, srcModeName: string, idx: Map<string, { col: VariableCollection; varPath: string }>): string | null {
  const t = idx.get(targetId)
  if (!t) return null
  const dotted = t.varPath.split('/').map(seg => seg.trim()).join('.')
  const multi = t.col.modes.length > 1
  if (!multi) return `{${t.col.name}.${dotted}}`
  // prefer a same-named mode on the target, else its default mode
  const mode = t.col.modes.find(m => m.name === srcModeName) ?? t.col.modes.find(m => m.id === t.col.activeMode) ?? t.col.modes[0]
  return `{${t.col.name}.${mode.name}.${dotted}}`
}

function valueOut(v: Variable, value: VarValue | undefined, modeName: string, idx: Map<string, { col: VariableCollection; varPath: string }>): unknown {
  if (value === undefined) return defaultValueFor(v.type)
  if (isAlias(value)) {
    const ref = refFor(value.alias, modeName, idx)
    if (ref) return ref
    return defaultValueFor(v.type)
  }
  return value
}

/** Set a leaf token at a "/"-delimited path inside a group object. */
function setLeaf(root: Record<string, unknown>, varPath: string, leaf: TokenNode): void {
  const parts = varPath.split('/').map(s => s.trim()).filter(Boolean)
  let node = root
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (typeof node[key] !== 'object' || node[key] === null) node[key] = {}
    node = node[key] as Record<string, unknown>
  }
  node[parts[parts.length - 1] || 'value'] = leaf
}

function tokensForMode(c: VariableCollection, modeId: string, modeName: string, idx: Map<string, { col: VariableCollection; varPath: string }>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const v of c.variables) {
    const leaf: TokenNode = { $type: TYPE_OUT[v.type], $value: valueOut(v, v.values[modeId], modeName, idx) }
    if (v.description) leaf.$description = v.description
    if (v.codeSyntax && (v.codeSyntax.web || v.codeSyntax.ios || v.codeSyntax.android)) {
      leaf.$extensions = { [EXT_KEY]: { codeSyntax: v.codeSyntax, scopes: v.scopes } }
    } else if (v.scopes && v.scopes.length) {
      leaf.$extensions = { [EXT_KEY]: { scopes: v.scopes } }
    }
    setLeaf(out, v.name, leaf)
  }
  return out
}

/** Serialise every collection to a DTCG token document (pretty JSON string). */
export function exportDTCG(collections: VariableCollection[]): string {
  const idx = pathIndex(collections)
  const doc: Record<string, unknown> = {}
  for (const c of collections) {
    const ext: Ext = { collection: true, modes: c.modes.map(m => m.name), activeMode: (c.modes.find(m => m.id === c.activeMode) ?? c.modes[0])?.name ?? '' }
    const node: Record<string, unknown> = { $extensions: { [EXT_KEY]: ext } }
    if (c.modes.length <= 1) {
      const m = c.modes[0]
      Object.assign(node, tokensForMode(c, m?.id ?? '', m?.name ?? '', idx))
    } else {
      for (const m of c.modes) node[m.name] = tokensForMode(c, m.id, m.name, idx)
    }
    doc[c.name] = node
  }
  return JSON.stringify(doc, null, 2)
}

// ── import ──────────────────────────────────────────────────────────────────

function isLeaf(n: unknown): n is TokenNode {
  return !!n && typeof n === 'object' && '$value' in (n as object)
}

/** Collect leaf tokens under a group, keyed by their "/"-joined path. */
function collectLeaves(node: Record<string, unknown>, prefix: string[], out: Array<{ path: string[]; leaf: TokenNode }>): void {
  for (const key of Object.keys(node)) {
    if (RESERVED.has(key)) continue
    const child = node[key]
    if (isLeaf(child)) out.push({ path: [...prefix, key], leaf: child })
    else if (child && typeof child === 'object') collectLeaves(child as Record<string, unknown>, [...prefix, key], out)
  }
}

function readExt(node: Record<string, unknown>): { ext?: Ext; leafExt?: { codeSyntax?: Variable['codeSyntax']; scopes?: Variable['scopes'] } } {
  const raw = node.$extensions as Record<string, unknown> | undefined
  const t = raw?.[EXT_KEY] as (Ext & { codeSyntax?: Variable['codeSyntax']; scopes?: Variable['scopes'] }) | undefined
  if (!t) return {}
  if ((t as Ext).collection) return { ext: t as Ext }
  return { leafExt: { codeSyntax: t.codeSyntax, scopes: t.scopes } }
}

interface Pending { variable: Variable; refs: Record<string, string> } // modeId -> reference string

/** Parse a DTCG token document into fresh collections (new ids). References are
 * resolved to aliases in a second pass; unresolved ones fall back to a literal. */
export function importDTCG(text: string): VariableCollection[] {
  const doc = JSON.parse(text) as Record<string, unknown>
  const collections: VariableCollection[] = []
  // dotted-path -> variable id, for resolving `{...}` references afterwards
  const refTargets = new Map<string, string>()
  const pending: Pending[] = []

  for (const colName of Object.keys(doc)) {
    if (RESERVED.has(colName)) continue
    const colNode = doc[colName] as Record<string, unknown>
    if (!colNode || typeof colNode !== 'object') continue
    const { ext } = readExt(colNode)
    const modeNames = ext?.modes?.length ? ext.modes : ['Mode 1']
    const modes: VarMode[] = modeNames.map(n => ({ id: newModeId(), name: n }))
    const activeMode = (modes.find(m => m.name === ext?.activeMode) ?? modes[0]).id
    const collection: VariableCollection = { id: newCollectionId(), name: colName, modes, activeMode, variables: [] }

    // variablePath -> Variable (so multiple modes fill the same variable)
    const byPath = new Map<string, Pending>()
    const ingest = (leaves: Array<{ path: string[]; leaf: TokenNode }>, modeId: string, modeName: string): void => {
      for (const { path, leaf } of leaves) {
        const varPath = path.join('/')
        const type = typeIn(leaf.$type, leaf.$value)
        let p = byPath.get(varPath)
        if (!p) {
          const variable: Variable = { id: newVariableId(), name: varPath, type, values: {} }
          const le = readExt(leaf as Record<string, unknown>).leafExt
          if (le?.codeSyntax) variable.codeSyntax = le.codeSyntax
          if (le?.scopes) variable.scopes = le.scopes
          if (typeof leaf.$description === 'string') variable.description = leaf.$description
          p = { variable, refs: {} }
          byPath.set(varPath, p)
          collection.variables.push(variable)
          refTargets.set(`${colName}.${varPath.split('/').join('.')}`, variable.id)
          if (modes.length > 1) refTargets.set(`${colName}.${modeName}.${varPath.split('/').join('.')}`, variable.id)
        }
        const val = leaf.$value
        if (typeof val === 'string' && /^\{.+\}$/.test(val.trim())) p.refs[modeId] = val.trim().slice(1, -1)
        else p.variable.values[modeId] = val as VarValue
      }
    }

    if (modes.length > 1) {
      for (const m of modes) {
        const modeNode = colNode[m.name]
        if (!modeNode || typeof modeNode !== 'object') continue
        const leaves: Array<{ path: string[]; leaf: TokenNode }> = []
        collectLeaves(modeNode as Record<string, unknown>, [], leaves)
        ingest(leaves, m.id, m.name)
      }
    } else {
      const leaves: Array<{ path: string[]; leaf: TokenNode }> = []
      collectLeaves(colNode, [], leaves)
      ingest(leaves, modes[0].id, modes[0].name)
    }

    for (const p of byPath.values()) pending.push(p)
    collections.push(collection)
  }

  // second pass: turn `{ref}` strings into aliases (or a literal fallback)
  for (const p of pending) {
    for (const modeId of Object.keys(p.refs)) {
      const dotted = p.refs[modeId]
      const targetId = refTargets.get(dotted)
      if (targetId) p.variable.values[modeId] = { alias: targetId }
      else p.variable.values[modeId] = defaultValueFor(p.variable.type)
    }
    // ensure every mode has a value
    for (const c of collections) {
      if (!c.variables.includes(p.variable)) continue
      for (const m of c.modes) if (p.variable.values[m.id] === undefined) p.variable.values[m.id] = defaultValueFor(p.variable.type)
    }
  }

  return collections
}

/** Give an imported collection a name that does not clash with existing ones. */
export function uniqueCollectionName(existing: VariableCollection[], name: string): string {
  const names = new Set(existing.map(c => c.name))
  if (!names.has(name)) return name
  let i = 2
  while (names.has(`${name} ${i}`)) i++
  return `${name} ${i}`
}
