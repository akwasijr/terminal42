// Design Styles — reusable, named bundles of visual properties, distinct from
// variables. Where a variable is a single-value token (one value per mode, can be
// aliased and scoped), a style groups several properties that are applied together:
//   • Color style  — one paint (a solid colour, optionally backed by a colour variable)
//   • Text style   — font family / size / weight / line-height / letter-spacing / italic
//   • Effect style — a set of layer effects (shadows / blurs)
// Applying a style writes its resolved values onto the object and records the style
// id in `styleRefs`; editing the style re-syncs every object that references it.
// Styles are document-scoped and persisted alongside variables in the design.

import type { FObj, Effect } from './freeformTypes'
import { newEffectId } from './freeformTypes'
import { resolveVarValue, type VariableCollection } from './variables'

export type StyleType = 'color' | 'text' | 'effect'

/** A named paint. `colorVar` (a colour variable id) takes precedence over `color`. */
export interface ColorStyle {
  id: string
  name: string
  color: string
  colorVar?: string
}

export interface TextStyle {
  id: string
  name: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  lineHeight: number
  letterSpacing: number
  italic: boolean
}

export interface EffectStyle {
  id: string
  name: string
  effects: Effect[]
}

/** The document's local styles, grouped by type (mirrors Figma's Local styles). */
export interface StyleLibrary {
  colors: ColorStyle[]
  text: TextStyle[]
  effects: EffectStyle[]
}

/** Which style slots an object may reference (one per style type). */
export interface StyleRefs {
  fill?: string
  text?: string
  effect?: string
}

// ── id helpers ──────────────────────────────────────────────────────────────
let scounter = 0
function sid(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${(scounter++).toString(36)}`
}
export const newColorStyleId = (): string => sid('cst')
export const newTextStyleId = (): string => sid('tst')
export const newEffectStyleId = (): string => sid('est')

export function makeStyleLibrary(): StyleLibrary {
  return { colors: [], text: [], effects: [] }
}

/** Normalise a possibly-partial persisted library so every bucket is an array. */
export function normalizeLibrary(lib: Partial<StyleLibrary> | undefined | null): StyleLibrary {
  return {
    colors: Array.isArray(lib?.colors) ? lib!.colors : [],
    text: Array.isArray(lib?.text) ? lib!.text : [],
    effects: Array.isArray(lib?.effects) ? lib!.effects : [],
  }
}

export function isLibraryEmpty(lib: StyleLibrary): boolean {
  return !lib.colors.length && !lib.text.length && !lib.effects.length
}

// ── lookup ────────────────────────────────────────────────────────────────────
export function findColorStyle(lib: StyleLibrary, id: string | undefined): ColorStyle | undefined {
  return id ? lib.colors.find((s) => s.id === id) : undefined
}
export function findTextStyle(lib: StyleLibrary, id: string | undefined): TextStyle | undefined {
  return id ? lib.text.find((s) => s.id === id) : undefined
}
export function findEffectStyle(lib: StyleLibrary, id: string | undefined): EffectStyle | undefined {
  return id ? lib.effects.find((s) => s.id === id) : undefined
}

/** The concrete hex a colour style resolves to (following its variable, if any). */
export function resolveColorStyle(
  lib: StyleLibrary,
  collections: VariableCollection[],
  id: string | undefined,
): string | null {
  const s = findColorStyle(lib, id)
  if (!s) return null
  if (s.colorVar) {
    const v = resolveVarValue(collections, s.colorVar)
    if (typeof v === 'string') return v
  }
  return s.color
}

// ── create from an object ──────────────────────────────────────────────────────
/** Seed a colour style from an object's fill (or text colour for text objects). */
export function colorStyleFromObj(o: FObj | undefined, name: string): ColorStyle {
  const color = o ? (o.type === 'text' ? o.color : o.fill) || '#3b82f6' : '#3b82f6'
  return { id: newColorStyleId(), name, color }
}

export function textStyleFromObj(o: FObj | undefined, name: string): TextStyle {
  return {
    id: newTextStyleId(),
    name,
    fontFamily: o?.fontFamily ?? 'System sans',
    fontSize: o?.fontSize ?? 16,
    fontWeight: o?.fontWeight ?? 500,
    lineHeight: o?.lineHeight ?? 1.3,
    letterSpacing: o?.letterSpacing ?? 0,
    italic: o?.italic ?? false,
  }
}

export function effectStyleFromObj(o: FObj | undefined, name: string): EffectStyle {
  const src = o?.effects ?? []
  // deep-copy so the style owns its own effects (fresh ids)
  const effects = src.map((e) => ({ ...e, id: newEffectId() }))
  return { id: newEffectStyleId(), name, effects }
}

// ── apply a style to an object ─────────────────────────────────────────────────
/** Object field patch that applies a colour style to the fill / text colour. */
export function applyColorStyle(o: FObj, s: ColorStyle, hex: string): Partial<FObj> {
  const refs: StyleRefs = { ...(o.styleRefs ?? {}), fill: s.id }
  if (o.type === 'text') return { color: hex, styleRefs: refs }
  return { fill: hex, fillEnabled: true, fillMode: 'solid', styleRefs: refs }
}

export function applyTextStyle(o: FObj, s: TextStyle): Partial<FObj> {
  return {
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    italic: s.italic,
    styleRefs: { ...(o.styleRefs ?? {}), text: s.id },
  }
}

export function applyEffectStyle(o: FObj, s: EffectStyle): Partial<FObj> {
  const effects = s.effects.map((e) => ({ ...e, id: newEffectId() }))
  return { effects, styleRefs: { ...(o.styleRefs ?? {}), effect: s.id } }
}

// ── naming ──────────────────────────────────────────────────────────────────
const bucketFor = (lib: StyleLibrary, type: StyleType): { name: string }[] =>
  type === 'color' ? lib.colors : type === 'text' ? lib.text : lib.effects

/** A library-unique style name within its type bucket. */
export function uniqueStyleName(lib: StyleLibrary, type: StyleType, base: string): string {
  const taken = new Set(bucketFor(lib, type).map((s) => s.name))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

/** Split a "/"-delimited style name into group path + leaf (mirrors variables). */
export function splitStyleName(name: string): { group: string[]; leaf: string } {
  const parts = name.split('/').map((p) => p.trim()).filter(Boolean)
  if (parts.length <= 1) return { group: [], leaf: name.trim() || name }
  return { group: parts.slice(0, -1), leaf: parts[parts.length - 1] }
}
