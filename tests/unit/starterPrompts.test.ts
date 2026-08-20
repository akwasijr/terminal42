import { describe, it, expect } from 'vitest'
import {
  STARTER_POOL,
  STARTER_IDS,
  STARTER_ROTATION_LENGTH,
  starterTrio
} from '../../src/renderer/src/components/starterPrompts'
import { readAndAdvanceRotation } from '../../src/renderer/src/components/starterRotation'
import { analyzeGoalQuality, shouldShowGoalQualityHint } from '../../src/shared/goalQuality'

const ALL = STARTER_IDS.flatMap((id) => STARTER_POOL[id])

// The starters are the first thing a new user ever sends. If one of them trips
// the harness's own "this goal may be hard to measure" hint, the very first
// thing the product does is scold the user for a prompt the product wrote —
// which teaches them the hint is noise. This test is the guard against that.

describe('starter prompts', () => {
  for (const p of ALL) {
    it(`"${p.title}" does not trip the goal-quality hint`, () => {
      const analysis = analyzeGoalQuality(p.prompt)
      expect(
        shouldShowGoalQualityHint(p.prompt, analysis),
        `scored ${analysis.score}/100 — rewrite it with a stated target and a named way to verify it`
      ).toBe(false)
    })
  }

  it('keeps starters short enough to read at a glance', () => {
    for (const p of ALL) {
      expect(p.prompt.split(/\s+/).length, p.title).toBeLessThanOrEqual(60)
      expect(p.title.split(/\s+/).length, p.title).toBeLessThanOrEqual(6)
    }
  })

  it('files every prompt under the kind whose artwork it will be given', () => {
    for (const id of STARTER_IDS) {
      for (const p of STARTER_POOL[id]) expect(p.id).toBe(id)
    }
  })

  it('offers no duplicate titles or prompts', () => {
    expect(new Set(ALL.map((p) => p.title)).size).toBe(ALL.length)
    expect(new Set(ALL.map((p) => p.prompt)).size).toBe(ALL.length)
  })
})

describe('starterTrio', () => {
  it('shows one prompt of each kind', () => {
    const trio = starterTrio(0)
    expect(trio.map((p) => p.id)).toEqual([...STARTER_IDS])
  })

  it('shows a different set on the next rotation', () => {
    expect(starterTrio(1).map((p) => p.title)).not.toEqual(starterTrio(0).map((p) => p.title))
  })

  it('reaches every prompt in the pool across a full cycle', () => {
    const seen = new Set<string>()
    for (let i = 0; i < STARTER_ROTATION_LENGTH; i++) {
      for (const p of starterTrio(i)) seen.add(p.title)
    }
    expect(seen.size).toBe(ALL.length)
  })

  it('wraps rather than running off the end of the pool', () => {
    expect(starterTrio(STARTER_ROTATION_LENGTH).map((p) => p.title)).toEqual(
      starterTrio(0).map((p) => p.title)
    )
  })

  it('survives a corrupted counter instead of blanking the empty state', () => {
    for (const bad of [-1, -7, 1e9, NaN, Infinity, 2.5]) {
      const trio = starterTrio(bad)
      expect(trio, String(bad)).toHaveLength(3)
      expect(trio.every((p) => Boolean(p?.prompt)), String(bad)).toBe(true)
    }
  })
})

describe('rotation counter', () => {
  const fake = (initial?: string) => {
    const box: { value: string | null } = { value: initial ?? null }
    return {
      store: {
        getItem: () => box.value,
        setItem: (_k: string, v: string) => { box.value = v }
      },
      read: () => box.value
    }
  }

  it('advances so the next chat shows a different trio', () => {
    const f = fake()
    const first = readAndAdvanceRotation(f.store, STARTER_ROTATION_LENGTH)
    const second = readAndAdvanceRotation(f.store, STARTER_ROTATION_LENGTH)
    expect(second).not.toBe(first)
    expect(starterTrio(second).map((p) => p.title)).not.toEqual(starterTrio(first).map((p) => p.title))
  })

  it('walks the whole pool and returns to the start', () => {
    const f = fake()
    const seen: number[] = []
    for (let i = 0; i < STARTER_ROTATION_LENGTH; i++) seen.push(readAndAdvanceRotation(f.store, STARTER_ROTATION_LENGTH))
    expect(new Set(seen).size).toBe(STARTER_ROTATION_LENGTH)
    expect(readAndAdvanceRotation(f.store, STARTER_ROTATION_LENGTH)).toBe(seen[0])
  })

  it('never lets the stored counter grow without bound', () => {
    const f = fake()
    for (let i = 0; i < 50; i++) readAndAdvanceRotation(f.store, STARTER_ROTATION_LENGTH)
    expect(Number(f.read())).toBeLessThan(STARTER_ROTATION_LENGTH)
  })

  it('recovers from a corrupted stored value', () => {
    for (const bad of ['banana', '', '-4', '1e999']) {
      const f = fake(bad)
      const r = readAndAdvanceRotation(f.store, STARTER_ROTATION_LENGTH)
      expect(starterTrio(r), bad).toHaveLength(3)
    }
  })

  it('still shows a trio when storage is unavailable', () => {
    const broken = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') }
    }
    expect(readAndAdvanceRotation(broken, STARTER_ROTATION_LENGTH)).toBe(0)
  })

  it('shows a trio when storage can be read but not written', () => {
    const readOnly = {
      getItem: () => '1',
      setItem: () => { throw new Error('quota') }
    }
    expect(readAndAdvanceRotation(readOnly, STARTER_ROTATION_LENGTH)).toBe(1)
  })
})
