// Wire an AI-generated design to a real design system. After the generator lays a
// screen out with a palette (the "kit"), we mirror that palette into a "Theme"
// variable collection and bind every generated object's colour fields to those
// tokens — so the Variables tab fills in and editing a token live-recolours the
// canvas, instead of the design being a pile of hard-coded hexes.

import type { FObj } from './freeformTypes'
import type { Kit } from './uiKit'

/** The full set of colour roles surfaced as Theme variables. This mirrors the
 * whole kit palette (not just the "big" roles) so icons (faint/muted strokes),
 * cards, dividers and subtle surfaces all bind — the earlier one-off only covered
 * seven roles and left ~40% of a generated screen unbound. */
export function themeColorRoles(kit: Kit): { name: string; hex: string }[] {
  return [
    { name: 'Accent', hex: kit.accent },
    { name: 'On accent', hex: kit.onAccent },
    { name: 'Text', hex: kit.ink },
    { name: 'Muted', hex: kit.muted },
    { name: 'Faint', hex: kit.faint },
    { name: 'Surface', hex: kit.surface },
    { name: 'Card', hex: kit.card },
    { name: 'Background', hex: kit.bg },
    { name: 'Border', hex: kit.border },
  ]
}

/** A curated dark-neutral palette for the Theme's Dark mode. The brand accent (and
 * its readable on-accent ink) are preserved; only the neutral ramp is swapped — a
 * proper dark theme, not a naive inversion. Same role names as
 * {@link themeColorRoles} so the two modes line up by name. */
export function themeColorRolesDark(kit: Kit): { name: string; hex: string }[] {
  return [
    { name: 'Accent', hex: kit.accent },
    { name: 'On accent', hex: kit.onAccent },
    { name: 'Text', hex: '#f3f4f6' },
    { name: 'Muted', hex: '#9aa4b2' },
    { name: 'Faint', hex: '#6b7480' },
    { name: 'Surface', hex: '#12161f' },
    { name: 'Card', hex: '#1a1f2b' },
    { name: 'Background', hex: '#0b0e14' },
    { name: 'Border', hex: '#2a3040' },
  ]
}

/** Which roles a given field may bind to, most-preferred first. This is what makes
 * binding scalable instead of a hex race: when two roles share a hex (e.g. Card and
 * Background are both white in the default kit), the role that is *semantically*
 * right for the field wins — a white text colour binds to "On accent", a white fill
 * binds to a surface role, a grey stroke binds to "Border"/"Faint", etc. */
const FIELD_ROLES: Record<'fill' | 'color' | 'stroke' | 'shadowColor', string[]> = {
  fill: ['Accent', 'Surface', 'Background', 'Card', 'Border'],
  color: ['Text', 'Muted', 'Faint', 'On accent', 'Accent'],
  stroke: ['Border', 'Faint', 'Muted', 'Accent', 'On accent'],
  shadowColor: ['Accent', 'Border', 'Text'],
}

export type BindableColorField = keyof typeof FIELD_ROLES

/** Per-field hex→variableId maps built from the Theme's role→variableId mapping.
 * Binding a field means "look its current hex up in that field's map". */
export type FieldMaps = Record<BindableColorField, Map<string, string>>

/** Number-token maps: an object's radius / font size → the variable id whose value
 * equals it. Populated from {@link numberTokens}. */
export interface NumberMaps {
  radius: Map<number, string>
  fontSize: Map<number, string>
}

// Semantic scale labels, applied by ascending value so tokens read like a real
// design system ("Radius / md", "Text / Heading") rather than raw numbers.
const RADIUS_NAMES = ['sm', 'md', 'lg', 'xl', '2xl', '3xl']
const TYPE_NAMES = ['Caption', 'Small', 'Body', 'Body large', 'Subheading', 'Heading', 'Title', 'Display', 'Display large']

export interface NumberToken { value: number; name: string }

/** Derive corner-radius and type-scale number tokens from the actual values used in
 * a generated design. One token per distinct value (values are already snapped to a
 * canonical scale by the QA lint), named by ascending rank so editing e.g. "Text /
 * Body" rescales every body text at once. Fully-round (pill) radii and radius-0 are
 * left literal — they don't need a token. */
export function numberTokens(objects: FObj[]): { radius: NumberToken[]; fontSize: NumberToken[] } {
  const radii = new Set<number>()
  const sizes = new Set<number>()
  for (const o of objects) {
    if ((o.type === 'frame' || o.type === 'rect') && typeof o.radius === 'number' && o.radius > 0 && o.radius < 9999) radii.add(o.radius)
    if (o.type === 'text' && typeof o.fontSize === 'number' && o.fontSize > 0) sizes.add(o.fontSize)
  }
  const radius = [...radii].sort((a, b) => a - b).map((value, i) => ({ value, name: `Radius / ${RADIUS_NAMES[i] ?? `r${i + 1}`}` }))
  const fontSize = [...sizes].sort((a, b) => a - b).map((value, i) => ({ value, name: `Text / ${TYPE_NAMES[i] ?? `t${i + 1}`}` }))
  return { radius, fontSize }
}

/** Build the per-field binding maps from a kit and a role-name→variableId map
 * (as returned by ensureTheme). First matching role per hex wins within a field. */
export function buildFieldMaps(kit: Kit, roleVarId: Map<string, string>): FieldMaps {
  const roleHex = new Map(themeColorRoles(kit).map((r) => [r.name, r.hex.toLowerCase()]))
  const build = (order: string[]): Map<string, string> => {
    const m = new Map<string, string>()
    for (const role of order) {
      const hex = roleHex.get(role)
      const id = roleVarId.get(role)
      if (hex && id && !m.has(hex)) m.set(hex, id)
    }
    return m
  }
  return {
    fill: build(FIELD_ROLES.fill),
    color: build(FIELD_ROLES.color),
    stroke: build(FIELD_ROLES.stroke),
    shadowColor: build(FIELD_ROLES.shadowColor),
  }
}

/** Bind an object's colour fields to Theme variables, choosing the right token per
 * field (fill vs text colour vs icon stroke vs shadow), and (when number maps are
 * given) its corner radius and font size to the type/radius scale tokens.
 * Gradient/image fills are skipped; text colour only binds on text; strokes bind
 * only when enabled. Existing bindings are preserved. Returns the same object when
 * nothing changed. */
export function bindObjectToTokens(o: FObj, maps: FieldMaps, nums?: NumberMaps): FObj {
  const b: Record<string, string> = { ...(o.bindings ?? {}) }
  let changed = false
  const claim = (field: BindableColorField, hex: string | undefined, ok: boolean): void => {
    if (!ok || typeof hex !== 'string') return
    const id = maps[field].get(hex.toLowerCase())
    if (id && b[field] !== id) { b[field] = id; changed = true }
  }
  claim('fill', o.fill, o.fillEnabled !== false && o.fillMode !== 'gradient' && o.fillMode !== 'image')
  claim('color', o.color, o.type === 'text')
  claim('stroke', o.stroke, o.strokeEnabled === true)
  claim('shadowColor', o.shadowColor, o.shadow === true)
  if (nums) {
    if ((o.type === 'frame' || o.type === 'rect') && typeof o.radius === 'number') {
      const id = nums.radius.get(o.radius)
      if (id && b.radius !== id) { b.radius = id; changed = true }
    }
    if (o.type === 'text' && typeof o.fontSize === 'number') {
      const id = nums.fontSize.get(o.fontSize)
      if (id && b.fontSize !== id) { b.fontSize = id; changed = true }
    }
  }
  return changed ? { ...o, bindings: b } : o
}
