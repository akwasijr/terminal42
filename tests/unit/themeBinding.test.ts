import { describe, it, expect } from 'vitest'
import { compileTree, type UINode } from '../../src/renderer/src/lib/uiTree'
import { themeColorRoles, bindObjectToTokens, buildFieldMaps, numberTokens, type FieldMaps, type NumberMaps } from '../../src/renderer/src/lib/themeBinding'
import { makeCollection, makeVariable, resolveObjects, type VariableCollection } from '../../src/renderer/src/lib/variables'
import { DEFAULT_KIT } from '../../src/renderer/src/lib/uiKit'
import { makeObject } from '../../src/renderer/src/lib/freeformTypes'

// Mirror FreeformCanvas.ensureTheme: build a "Theme" collection from a kit plus a
// role-name→varId map, then derive the per-field binding maps from it.
function themeFromKit(kit = DEFAULT_KIT): { collection: VariableCollection; maps: FieldMaps } {
  const col = makeCollection('Theme')
  const modeId = col.activeMode
  const roleVarId = new Map<string, string>()
  for (const { name, hex } of themeColorRoles(kit)) {
    const v = makeVariable('color', name, col.modes)
    v.values[modeId] = hex
    col.variables.push(v)
    roleVarId.set(name, v.id)
  }
  return { collection: col, maps: buildFieldMaps(kit, roleVarId) }
}

describe('uiTree — multi-line text height (overlap fix)', () => {
  it('reserves real height for a wrapping heading so the next element does not overlap', () => {
    const heading = 'This is a long hero heading that will certainly wrap onto several lines'
    const tree: UINode = {
      stack: 'y', gap: 12, pad: 0, children: [
        { text: heading, fontSize: 28, fontWeight: 700 }, // no explicit h → measured
        { text: 'Body', h: 20 },
      ],
    }
    const specs = compileTree(tree, { width: 200 })
    const texts = specs.filter((s) => s.type === 'text')
    const head = texts[0], body = texts[1]
    expect(head.h!).toBeGreaterThan(Math.round(28 * 1.35)) // more than a single line
    expect(body.y!).toBeGreaterThanOrEqual(head.y! + head.h! + 12) // stacked below, no overlap
  })
})

describe('themeBinding — AI design wired to Theme tokens', () => {
  it('surfaces the kit palette as colour variables', () => {
    const { collection } = themeFromKit()
    const names = collection.variables.map((v) => v.name)
    expect(names).toContain('Accent')
    expect(names).toContain('Text')
    expect(names).toContain('Background')
    expect(collection.variables.every((v) => v.type === 'color')).toBe(true)
  })

  it('binds an object fill to the matching token and follows edits to it', () => {
    const { collection, maps } = themeFromKit()
    const o = { ...makeObject('rect', 0, 0), fill: DEFAULT_KIT.accent, fillEnabled: true, fillMode: 'solid' as const }
    const bound = bindObjectToTokens(o, maps)
    expect(bound.bindings?.fill).toBeTruthy()

    // Editing the Accent token recolours the bound object.
    const accentVar = collection.variables.find((v) => v.name === 'Accent')!
    accentVar.values[collection.activeMode] = '#ff0000'
    const [resolved] = resolveObjects([bound], [collection])
    expect(resolved.fill).toBe('#ff0000')
  })

  it('binds a text colour and an icon stroke to the field-appropriate token', () => {
    const { collection, maps } = themeFromKit()
    // Text uses the `color` field; a muted body colour → the "Muted" token.
    const txt = { ...makeObject('text', 0, 0), color: DEFAULT_KIT.muted }
    const boundTxt = bindObjectToTokens(txt, maps)
    const muted = collection.variables.find((v) => v.name === 'Muted')!
    expect(boundTxt.bindings?.color).toBe(muted.id)
    // An icon path uses the `stroke` field; a faint stroke → the "Faint" token.
    const icon = { ...makeObject('path', 0, 0), strokeEnabled: true, stroke: DEFAULT_KIT.faint }
    const boundIcon = bindObjectToTokens(icon, maps)
    const faint = collection.variables.find((v) => v.name === 'Faint')!
    expect(boundIcon.bindings?.stroke).toBe(faint.id)
  })

  it('builds radius/type number tokens and binds radius + font size by value', () => {
    const objs = [
      { ...makeObject('rect', 0, 0), radius: 12 },
      { ...makeObject('frame', 0, 0), radius: 20 },
      { ...makeObject('text', 0, 0), fontSize: 14 },
      { ...makeObject('text', 0, 0), fontSize: 28 },
    ]
    const { radius, fontSize } = numberTokens(objs)
    expect(radius.map((t) => t.name)).toEqual(['Radius / sm', 'Radius / md'])
    expect(fontSize.map((t) => t.name)).toEqual(['Text / Caption', 'Text / Small'])

    const nums: NumberMaps = {
      radius: new Map(radius.map((t) => [t.value, `v-${t.value}`])),
      fontSize: new Map(fontSize.map((t) => [t.value, `f-${t.value}`])),
    }
    const emptyMaps: FieldMaps = { fill: new Map(), color: new Map(), stroke: new Map(), shadowColor: new Map() }
    const boundRect = bindObjectToTokens({ ...makeObject('rect', 0, 0), radius: 12 }, emptyMaps, nums)
    expect(boundRect.bindings?.radius).toBe('v-12')
    const boundText = bindObjectToTokens({ ...makeObject('text', 0, 0), fontSize: 28 }, emptyMaps, nums)
    expect(boundText.bindings?.fontSize).toBe('f-28')
  })

  it('leaves gradient fills and non-token colours untouched', () => {
    const { maps } = themeFromKit()
    const grad = { ...makeObject('rect', 0, 0), fill: DEFAULT_KIT.accent, fillEnabled: true, fillMode: 'gradient' as const }
    expect(bindObjectToTokens(grad, maps).bindings?.fill).toBeUndefined()
    const other = { ...makeObject('rect', 0, 0), fill: '#123456', fillEnabled: true, fillMode: 'solid' as const }
    expect(bindObjectToTokens(other, maps).bindings?.fill).toBeUndefined()
  })
})
