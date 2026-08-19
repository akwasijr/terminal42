import { describe, it, expect } from 'vitest'
import {
  makeCollection,
  makeVariable,
  resolveVarValue,
  resolveObject,
  variablesOfType,
  fieldVarType,
  type VariableCollection,
} from '../../src/renderer/src/lib/variables'
import { makeObject } from '../../src/renderer/src/lib/freeformTypes'

function colorCollection(): { col: VariableCollection; modeA: string; modeB: string } {
  const col = makeCollection('Theme')
  const modeA = col.modes[0].id
  col.modes.push({ id: 'modeB', name: 'Dark' })
  const modeB = 'modeB'
  const bg = makeVariable('color', 'bg', col.modes)
  bg.values[modeA] = '#ffffff'
  bg.values[modeB] = '#000000'
  col.variables.push(bg)
  return { col, modeA, modeB }
}

describe('resolveVarValue', () => {
  it('resolves a literal for the active mode', () => {
    const { col, modeA, modeB } = colorCollection()
    const id = col.variables[0].id
    col.activeMode = modeA
    expect(resolveVarValue([col], id)).toBe('#ffffff')
    col.activeMode = modeB
    expect(resolveVarValue([col], id)).toBe('#000000')
  })

  it('follows an alias chain', () => {
    const { col, modeA } = colorCollection()
    col.activeMode = modeA
    const base = col.variables[0]
    const surface = makeVariable('color', 'surface', col.modes)
    surface.values[modeA] = { alias: base.id }
    col.variables.push(surface)
    expect(resolveVarValue([col], surface.id)).toBe('#ffffff')
  })

  it('returns null on an alias cycle', () => {
    const col = makeCollection()
    const m = col.modes[0].id
    const a = makeVariable('color', 'a', col.modes)
    const b = makeVariable('color', 'b', col.modes)
    a.values[m] = { alias: b.id }
    b.values[m] = { alias: a.id }
    col.variables.push(a, b)
    expect(resolveVarValue([col], a.id)).toBeNull()
  })

  it('returns null for a missing variable', () => {
    const col = makeCollection()
    expect(resolveVarValue([col], 'nope')).toBeNull()
  })
})

describe('resolveObject', () => {
  it('replaces a bound fill colour and forces a solid paint', () => {
    const { col, modeB } = colorCollection()
    col.activeMode = modeB
    const o = makeObject('rect', 0, 0)
    o.fillMode = 'gradient'
    o.bindings = { fill: col.variables[0].id }
    const r = resolveObject(o, [col])
    expect(r.fill).toBe('#000000')
    expect(r.fillMode).toBe('solid')
    expect(r.fillEnabled).toBe(true)
    // original untouched
    expect(o.fill).not.toBe('#000000')
  })

  it('replaces a bound numeric prop', () => {
    const col = makeCollection()
    const m = col.modes[0].id
    const radius = makeVariable('number', 'md', col.modes)
    radius.values[m] = 12
    col.variables.push(radius)
    const o = makeObject('rect', 0, 0)
    o.bindings = { radius: radius.id }
    expect(resolveObject(o, [col]).radius).toBe(12)
  })

  it('ignores a type mismatch (number var bound to colour field)', () => {
    const col = makeCollection()
    const m = col.modes[0].id
    const num = makeVariable('number', 'n', col.modes)
    num.values[m] = 5
    col.variables.push(num)
    const o = makeObject('rect', 0, 0)
    const before = o.fill
    o.bindings = { fill: num.id }
    expect(resolveObject(o, [col]).fill).toBe(before)
  })

  it('returns the same reference when there are no bindings', () => {
    const col = makeCollection()
    const o = makeObject('rect', 0, 0)
    expect(resolveObject(o, [col])).toBe(o)
  })
})

describe('helpers', () => {
  it('fieldVarType maps colour vs number fields', () => {
    expect(fieldVarType('fill')).toBe('color')
    expect(fieldVarType('radius')).toBe('number')
  })

  it('variablesOfType filters by type', () => {
    const col = makeCollection()
    col.variables.push(makeVariable('color', 'c', col.modes), makeVariable('number', 'n', col.modes))
    expect(variablesOfType([col], 'color')).toHaveLength(1)
    expect(variablesOfType([col], 'number')).toHaveLength(1)
  })
})
