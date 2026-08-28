import { describe, it, expect } from 'vitest'
import { liveLayerIds, pruneLayerTracks } from '../../src/shared/motion/keyframes'
import type { Keyframes } from '../../src/shared/motion/keyframes'

const track = (v = 1): Keyframes[string] => ({ keys: [{ id: 'k', t: 0, v }] })

const keys: Keyframes = {
  'text:a:x': track(),
  'text:b:opacity': track(),
  'logo:l1:size': track(),
  'shape:s1:rotation': track(),
  'picture:p1:x': track(),
  'param:radius': track(),
  'pose:tiltX': track(),
  'fx:glow': track()
}

const visual = {
  text: [{ id: 'a' }],
  logos: [{ id: 'l1' }],
  shapes: [{ id: 's1' }],
  pictures: [{ id: 'p1' }]
}

describe('a deleted layer takes its tracks with it', () => {
  it('drops the tracks of a layer that is no longer in the piece', () => {
    const out = pruneLayerTracks(keys, liveLayerIds(visual))
    expect('text:b:opacity' in out!).toBe(false)
    expect('text:a:x' in out!).toBe(true)
  })

  it('keeps every kind of layer that is still there', () => {
    const out = pruneLayerTracks(keys, liveLayerIds(visual))!
    expect(Object.keys(out).sort()).toEqual([
      'fx:glow', 'logo:l1:size', 'param:radius', 'picture:p1:x',
      'pose:tiltX', 'shape:s1:rotation', 'text:a:x'
    ])
  })

  it('drops each kind of layer when it goes', () => {
    const empty = liveLayerIds({})
    const out = pruneLayerTracks(keys, empty)!
    expect(Object.keys(out).sort()).toEqual(['fx:glow', 'param:radius', 'pose:tiltX'])
  })

  it('never touches a parameter, a pose or an effect', () => {
    // Switching component and back is meant to keep the motion you built, so
    // a param track for a component that is not loaded has to survive.
    const out = pruneLayerTracks({ 'param:radius': track(), 'pose:tiltZ': track(), 'fx:blur': track() }, new Set())!
    expect(Object.keys(out).sort()).toEqual(['fx:blur', 'param:radius', 'pose:tiltZ'])
  })

  it('hands back the very same object when there is nothing to drop', () => {
    // Called on every edit, so it must not churn a new map each time.
    expect(pruneLayerTracks(keys, liveLayerIds({
      text: [{ id: 'a' }, { id: 'b' }], logos: [{ id: 'l1' }],
      shapes: [{ id: 's1' }], pictures: [{ id: 'p1' }]
    }))).toBe(keys)
  })

  it('copes with a piece that has no keys at all', () => {
    expect(pruneLayerTracks(undefined, new Set())).toBeUndefined()
  })

  it('leaves a target it cannot read alone rather than guessing', () => {
    const odd = { 'text:a': track(), 'nonsense': track() }
    expect(Object.keys(pruneLayerTracks(odd, new Set())!).sort()).toEqual(['nonsense', 'text:a'])
  })

  it('reads a layer id that has a colon in it without cutting it short', () => {
    // Ids are generated, but a target is split on colons and the first two
    // parts are the layer, so this is worth pinning down.
    const out = pruneLayerTracks({ 'text:a:b:x': track() }, new Set(['text:a']))!
    expect('text:a:b:x' in out).toBe(true)
  })
})

describe('liveLayerIds', () => {
  it('names every layer as the prefix a track target starts with', () => {
    expect([...liveLayerIds(visual)].sort())
      .toEqual(['logo:l1', 'picture:p1', 'shape:s1', 'text:a'])
  })

  it('is empty for a piece with no layers', () => {
    expect(liveLayerIds({}).size).toBe(0)
  })
})
