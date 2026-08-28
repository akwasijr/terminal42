import { describe, it, expect } from 'vitest'
import {
  initialHistory, record, commit, undo, redo, canUndo, canRedo,
  changedPath, historyKey, HISTORY_LIMIT, COALESCE_MS
} from '../../src/renderer/src/lib/motion/history'

type Doc = {
  params: Record<string, number>
  pose: { x: number; y: number }
  title: string
}

const doc = (over: Partial<Doc> = {}): Doc => ({
  params: { speed: 1 },
  pose: { x: 0, y: 0 },
  title: 'A',
  ...over
})

describe('changedPath', () => {
  it('names a top-level scalar', () => {
    expect(changedPath(doc(), doc({ title: 'B' }))).toBe('title')
  })

  it('goes two deep so two sliders in one section are two values', () => {
    const a = doc()
    const b = doc({ params: { speed: 2 } })
    expect(changedPath(a, b)).toBe('params.speed')
    const c = doc({ params: { speed: 1, gap: 3 } })
    expect(changedPath(a, c)).toBe('params.gap')
  })

  it('stops at one level when a section changed in two places at once', () => {
    const a = doc()
    const b = doc({ params: { speed: 2, gap: 9 } })
    expect(changedPath(a, b)).toBe('params')
  })

  it('is null when more than one section changed', () => {
    expect(changedPath(doc(), doc({ title: 'B', pose: { x: 5, y: 0 } }))).toBeNull()
  })

  it('is null when nothing changed, even through a rebuilt object', () => {
    expect(changedPath(doc(), doc())).toBeNull()
  })
})

describe('record', () => {
  it('pushes the previous document', () => {
    let h = initialHistory(doc())
    h = record(h, doc({ title: 'B' }), 0)
    expect(h.present.title).toBe('B')
    expect(h.past).toHaveLength(1)
    expect(h.past[0].title).toBe('A')
  })

  it('refuses a no-op, so undo never does nothing', () => {
    let h = initialHistory(doc())
    h = record(h, doc(), 0)
    expect(h.past).toHaveLength(0)
    expect(canUndo(h)).toBe(false)
  })

  // The whole point of the module.
  it('folds a drag of one slider into a single step', () => {
    let h = initialHistory(doc())
    for (let i = 1; i <= 50; i++) {
      h = record(h, doc({ params: { speed: i } }), i * 10)
    }
    expect(h.present.params.speed).toBe(50)
    expect(h.past).toHaveLength(1)
    h = undo(h)
    expect(h.present.params.speed).toBe(1)
  })

  it('starts a new step once the drag pauses', () => {
    let h = initialHistory(doc())
    h = record(h, doc({ params: { speed: 2 } }), 0)
    h = record(h, doc({ params: { speed: 3 } }), COALESCE_MS + 1)
    expect(h.past).toHaveLength(2)
  })

  it('starts a new step when a different slider is touched', () => {
    let h = initialHistory(doc())
    h = record(h, doc({ params: { speed: 2 } }), 0)
    h = record(h, doc({ params: { speed: 2, gap: 4 } }), 10)
    expect(h.past).toHaveLength(2)
  })

  it('never folds a multi-part edit into the drag before it', () => {
    let h = initialHistory(doc())
    h = record(h, doc({ params: { speed: 2 } }), 0)
    h = record(h, doc({ params: { speed: 2 }, title: 'B', pose: { x: 1, y: 1 } }), 10)
    expect(h.past).toHaveLength(2)
  })

  it('drops the oldest step past the limit', () => {
    let h = initialHistory(doc())
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) {
      h = record(h, doc({ title: `t${i}` }), i * (COALESCE_MS + 1))
    }
    expect(h.past).toHaveLength(HISTORY_LIMIT)
  })
})

describe('commit', () => {
  it('stands alone even mid-drag', () => {
    let h = initialHistory(doc())
    h = record(h, doc({ params: { speed: 2 } }), 0)
    h = commit(h, doc({ params: { speed: 2 }, title: 'laid out' }), 10)
    h = record(h, doc({ params: { speed: 3 }, title: 'laid out' }), 20)
    expect(h.past).toHaveLength(3)
    h = undo(h)
    expect(h.present.title).toBe('laid out')
  })
})

describe('undo and redo', () => {
  it('walks back and forward through the steps', () => {
    let h = initialHistory(doc())
    h = record(h, doc({ title: 'B' }), 0)
    h = record(h, doc({ title: 'C' }), COALESCE_MS + 1)
    expect(h.present.title).toBe('C')
    h = undo(h)
    expect(h.present.title).toBe('B')
    h = undo(h)
    expect(h.present.title).toBe('A')
    expect(canUndo(h)).toBe(false)
    h = redo(h)
    expect(h.present.title).toBe('B')
    h = redo(h)
    expect(h.present.title).toBe('C')
    expect(canRedo(h)).toBe(false)
  })

  it('does nothing at either end rather than throwing', () => {
    const h = initialHistory(doc())
    expect(undo(h)).toBe(h)
    expect(redo(h)).toBe(h)
  })

  it('drops the redo trail once you edit from the past', () => {
    let h = initialHistory(doc())
    h = record(h, doc({ title: 'B' }), 0)
    h = undo(h)
    expect(canRedo(h)).toBe(true)
    h = record(h, doc({ title: 'C' }), COALESCE_MS + 1)
    expect(canRedo(h)).toBe(false)
  })

  // Undoing and then nudging the same slider must not re-absorb the step.
  it('will not coalesce an edit into the step it just undid', () => {
    let h = initialHistory(doc())
    h = record(h, doc({ params: { speed: 2 } }), 0)
    h = undo(h)
    h = record(h, doc({ params: { speed: 5 } }), 10)
    expect(h.past).toHaveLength(1)
    h = undo(h)
    expect(h.present.params.speed).toBe(1)
  })
})

describe('historyKey', () => {
  const k = (key: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }> = {}) =>
    historyKey({ key, metaKey: false, ctrlKey: false, shiftKey: false, ...mods })

  it('reads the shortcuts the canvas already answers to', () => {
    expect(k('z', { metaKey: true })).toBe('undo')
    expect(k('z', { ctrlKey: true })).toBe('undo')
    expect(k('z', { metaKey: true, shiftKey: true })).toBe('redo')
    expect(k('y', { ctrlKey: true })).toBe('redo')
    expect(k('Z', { metaKey: true, shiftKey: true })).toBe('redo')
  })

  it('ignores the letters on their own', () => {
    expect(k('z')).toBeNull()
    expect(k('y')).toBeNull()
    expect(k('a', { metaKey: true })).toBeNull()
  })
})
