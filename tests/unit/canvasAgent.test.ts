import { describe, it, expect } from 'vitest'
import { buildObject, normalizeMotion, parseAgentReply, buildAssistantPrompt } from '../../src/renderer/src/lib/canvasAgent'
import { ICON_PATHS } from '../../src/renderer/src/lib/icons24'

describe('buildObject', () => {
  it('builds a full object from a partial spec, offset into the artboard', () => {
    const o = buildObject({ type: 'rect', x: 10, y: 20, w: 100, h: 50, fill: '#ff0000', radius: 12 }, 200, 300)
    expect(o.type).toBe('rect')
    expect(o.x).toBe(210)
    expect(o.y).toBe(320)
    expect(o.w).toBe(100)
    expect(o.h).toBe(50)
    expect(o.fill).toBe('#ff0000')
    expect(o.radius).toBe(12)
    expect(o.id).toBeTruthy()
    expect(o.visible).toBe(true)
  })
  it('falls back to rect for an unknown type and clamps opacity', () => {
    const o = buildObject({ type: 'bogus' as 'rect', opacity: 5 }, 0, 0)
    expect(o.type).toBe('rect')
    expect(o.opacity).toBe(1)
  })
  it('applies text fields for text objects', () => {
    const o = buildObject({ type: 'text', text: 'Hello', fontSize: 40, align: 'center', color: '#222222' }, 0, 0)
    expect(o.type).toBe('text')
    expect(o.text).toBe('Hello')
    expect(o.fontSize).toBe(40)
    expect(o.align).toBe('center')
    expect(o.color).toBe('#222222')
  })
  it('clamps polygon sides to >= 3', () => {
    expect(buildObject({ type: 'polygon', sides: 1 }, 0, 0).sides).toBe(3)
    expect(buildObject({ type: 'polygon', sides: 6 }, 0, 0).sides).toBe(6)
  })
  it('resolves a named icon to a stroked path in 24-space', () => {
    const o = buildObject({ type: 'rect', icon: 'check' }, 0, 0)
    expect(o.type).toBe('path')
    expect(o.path).toBe(ICON_PATHS.check)
    expect(o.pathViewBox).toBe('0 0 24 24')
    expect(o.strokeEnabled).toBe(true)
    expect(o.fillEnabled).toBe(false)
  })
  it('ignores unknown icon names but keeps explicit path data', () => {
    expect(buildObject({ type: 'rect', icon: 'nope' }, 0, 0).type).toBe('rect')
    const o = buildObject({ type: 'path', path: 'M0 0L1 1', pathViewBox: '0 0 1 1' }, 0, 0)
    expect(o.path).toBe('M0 0L1 1')
    expect(o.pathViewBox).toBe('0 0 1 1')
  })
  it('resolves icon synonyms / suffixes to a library glyph', () => {
    expect(buildObject({ type: 'rect', icon: 'cart' }, 0, 0).path).toBe(ICON_PATHS.bag)
    expect(buildObject({ type: 'rect', icon: 'gear' }, 0, 0).path).toBe(ICON_PATHS.settings)
    expect(buildObject({ type: 'rect', icon: 'Search Icon' }, 0, 0).path).toBe(ICON_PATHS.search)
    expect(buildObject({ type: 'rect', icon: 'magnifying-glass' }, 0, 0).path).toBe(ICON_PATHS.search)
    expect(buildObject({ type: 'rect', icon: 'notifications' }, 0, 0).path).toBe(ICON_PATHS.bell)
  })
})

describe('normalizeMotion', () => {
  it('keeps valid tracks, drops unknown props, assigns key ids', () => {
    const m = normalizeMotion({ duration: 800, tracks: { opacity: [{ t: 0, v: 0 }, { t: 800, v: 1 }], bogus: [{ t: 0, v: 0 }] } })
    expect(m).toBeTruthy()
    expect(m!.duration).toBe(800)
    expect(Object.keys(m!.tracks)).toEqual(['opacity'])
    expect(m!.tracks.opacity!.length).toBe(2)
    expect(m!.tracks.opacity!.every((k) => typeof k.id === 'string')).toBe(true)
  })
  it('sorts keys by time and clamps t to duration', () => {
    const m = normalizeMotion({ duration: 500, tracks: { y: [{ t: 9999, v: 0 }, { t: 0, v: 24 }] } })
    expect(m!.tracks.y!.map((k) => k.t)).toEqual([0, 500])
  })
  it('returns null when there are no usable tracks', () => {
    expect(normalizeMotion({ duration: 500, tracks: {} })).toBeNull()
    expect(normalizeMotion(null)).toBeNull()
  })
})

describe('parseAgentReply', () => {
  it('extracts a create action from a fenced JSON block', () => {
    const raw = 'Sure!\n```json\n{ "actions": [ { "kind": "create", "summary": "added a box", "objects": [ { "type": "rect", "w": 50, "h": 50 } ] } ], "reply": "done" }\n```'
    const r = parseAgentReply(raw)
    expect(r.actions.length).toBe(1)
    const a = r.actions[0]
    expect(a.kind).toBe('create')
    if (a.kind === 'create') expect(a.objects[0].type).toBe('rect')
    expect(r.reply).toBe('done')
  })
  it('parses a question action with options', () => {
    const r = parseAgentReply('{"actions":[{"kind":"question","text":"What color?","options":["Blue","Green"]}]}')
    expect(r.actions[0].kind).toBe('question')
    const a = r.actions[0]
    if (a.kind === 'question') { expect(a.text).toBe('What color?'); expect(a.options).toEqual(['Blue', 'Green']) }
  })
  it('parses an animate action and normalizes the motion', () => {
    const r = parseAgentReply('{"actions":[{"kind":"animate","summary":"fade","target":"selected","motion":{"duration":600,"tracks":{"opacity":[{"t":0,"v":0},{"t":600,"v":1}]}}}]}')
    expect(r.actions[0].kind).toBe('animate')
    const a = r.actions[0]
    if (a.kind === 'animate') { expect(a.motion.duration).toBe(600); expect(a.target).toBe('selected') }
  })
  it('returns the raw text as reply when no JSON is present', () => {
    const r = parseAgentReply('I cannot do that.')
    expect(r.actions.length).toBe(0)
    expect(r.reply).toBe('I cannot do that.')
  })
})

describe('buildAssistantPrompt', () => {
  it('includes the artboard, layers, selection and user text', () => {
    const p = buildAssistantPrompt(
      { artboard: { w: 1280, h: 800, bg: '#fff' }, layers: [{ name: 'Hero', type: 'text' }], selection: ['Hero'] },
      [{ role: 'user', content: 'hi' }],
      'add a button',
    )
    expect(p).toContain('1280x800')
    expect(p).toContain('Hero (text)')
    expect(p).toContain('add a button')
    expect(p).toContain('"kind": "question"')
  })
})

describe('edit + delete actions', () => {
  it('parses an edit action with a patch', () => {
    const r = parseAgentReply('{"actions":[{"kind":"edit","summary":"recolor","target":"Hero","patch":{"fill":"#0066ff","w":200}}]}')
    expect(r.actions[0].kind).toBe('edit')
    const a = r.actions[0]
    if (a.kind === 'edit') { expect(a.target).toBe('Hero'); expect(a.patch.fill).toBe('#0066ff') }
  })
  it('parses a delete action', () => {
    const r = parseAgentReply('{"actions":[{"kind":"delete","summary":"remove","target":"selected"}]}')
    expect(r.actions[0].kind).toBe('delete')
    const a = r.actions[0]
    if (a.kind === 'delete') expect(a.target).toBe('selected')
  })
})

describe('sanitizeObjectPatch', () => {
  it('keeps only valid fields and clamps', async () => {
    const { sanitizeObjectPatch } = await import('../../src/renderer/src/lib/canvasAgent')
    const p = sanitizeObjectPatch({ type: 'rect', fill: '#fff', opacity: 9, w: -5, text: 'hi', bogus: 1 } as never)
    expect(p.fill).toBe('#fff')
    expect(p.opacity).toBe(1)
    expect(p.w).toBe(1)
    expect(p.text).toBe('hi')
    expect((p as Record<string, unknown>).bogus).toBeUndefined()
    expect((p as Record<string, unknown>).type).toBeUndefined()
  })
})
