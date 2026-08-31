import { describe, it, expect } from 'vitest'
import {
  STARTER_POOL,
  STARTER_IDS,
  TRIO_IDS,
  STARTER_ROTATION_LENGTH,
  starterTrio,
  allStarterPrompts
} from '../../src/renderer/src/components/starterPrompts'
import { readAndAdvanceRotation } from '../../src/renderer/src/components/starterRotation'
import { analyzeGoalQuality } from '../../src/shared/goalQuality'

const ALL = STARTER_IDS.flatMap((id) => STARTER_POOL[id])

// The starters are the first thing a new user ever sends, and the same
// scoring still feeds the goal reframe in chat. A starter the product wrote
// that scores as a poor goal would have the product arguing with itself, so
// each one has to stand up to its own measure.

describe('starter prompts', () => {
  for (const p of ALL) {
    it(`"${p.title}" scores as a goal worth sending`, () => {
      const analysis = analyzeGoalQuality(p.prompt)
      expect(
        analysis.score,
        `scored ${analysis.score}/100. Rewrite it with a stated target and a named way to verify it`
      ).toBeGreaterThanOrEqual(50)
    })
  }

  it('keeps starters short enough to send as written', () => {
    for (const p of ALL) {
      expect(p.prompt.split(/\s+/).length, p.title).toBeLessThanOrEqual(30)
      expect(p.title.split(/\s+/).length, p.title).toBeLessThanOrEqual(5)
    }
  })

  // The old set read like an acceptance spec rather than a request. Those
  // phrasings are what made them unusable as written, so they stay out.
  it('reads like a request, not a specification', () => {
    for (const p of ALL) {
      expect(p.prompt, p.title).not.toMatch(/success is/i)
      expect(p.prompt, p.title).not.toMatch(/\bverify by\b/i)
    }
  })

  it('is one sentence, plus one only where something has to be filled in', () => {
    // The second sentence exists to be replaced: it names the one thing the
    // starter cannot know. Anything longer is a starter doing the thinking
    // for somebody who has not said what they want yet.
    for (const p of ALL) {
      const sentences = p.prompt.split(/[.!?]\s+/).filter(Boolean)
      expect(sentences.length, p.title).toBe(p.slot ? 2 : 1)
    }
  })

  it('ends on the words it asks you to replace', () => {
    // The phrase is selected when the tile fills the box, so it has to be in
    // the prompt and it has to come last: a caret in the middle of a sentence
    // that carries on afterwards reads as a cursor bug.
    for (const p of ALL) {
      if (!p.slot) continue
      expect(p.prompt, p.title).toContain(p.slot)
      expect(p.prompt.trimEnd(), p.title).toBe(`${p.prompt.slice(0, p.prompt.lastIndexOf(p.slot))}${p.slot}.`)
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
  it('shows one prompt of each trio kind', () => {
    const trio = starterTrio(0)
    expect(trio.map((p) => p.id)).toEqual([...TRIO_IDS])
  })

  it('shows a different set on the next rotation', () => {
    expect(starterTrio(1).map((p) => p.title)).not.toEqual(starterTrio(0).map((p) => p.title))
  })

  it('reaches every prompt of its own kinds across a full cycle', () => {
    const seen = new Set<string>()
    for (let i = 0; i < STARTER_ROTATION_LENGTH; i++) {
      for (const p of starterTrio(i)) seen.add(p.title)
    }
    const trioTotal = TRIO_IDS.reduce((n, id) => n + STARTER_POOL[id].length, 0)
    expect(seen.size).toBe(trioTotal)
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

describe('allStarterPrompts', () => {
  it('returns every prompt in the library, for the modal', () => {
    expect(allStarterPrompts().map((p) => p.title)).toEqual(ALL.map((p) => p.title))
  })

  it('covers every kind, so no group renders empty', () => {
    const kinds = new Set(allStarterPrompts().map((p) => p.id))
    expect([...kinds].sort()).toEqual([...STARTER_IDS].sort())
  })

  it('offers more than the empty state shows, which is the point of the modal', () => {
    expect(allStarterPrompts().length).toBeGreaterThan(starterTrio(0).length)
  })
})
