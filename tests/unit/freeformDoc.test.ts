import { describe, it, expect } from 'vitest'
import { docIsEmpty } from '../../src/renderer/src/lib/freeformDoc'

describe('docIsEmpty', () => {
  it('treats a missing document as empty', () => {
    expect(docIsEmpty(null)).toBe(true)
    expect(docIsEmpty(undefined)).toBe(true)
  })

  it('treats a fresh multi-page document with nothing on it as empty', () => {
    expect(docIsEmpty({ pages: [{ id: 'p1', name: 'Page 1' }], activePage: 'p1', perPage: { p1: { objects: [], artboards: [] } } })).toBe(true)
  })

  it('sees content on any page', () => {
    const doc = {
      pages: [{ id: 'p1', name: 'Page 1' }, { id: 'p2', name: 'Page 2' }],
      perPage: { p1: { objects: [], artboards: [] }, p2: { objects: [{ id: 'a' }], artboards: [] } }
    }
    expect(docIsEmpty(doc)).toBe(false)
  })

  it('counts an artboard on its own as content', () => {
    expect(docIsEmpty({ perPage: { p1: { objects: [], artboards: [{ id: 'ab' }] } } })).toBe(false)
  })

  it('reads legacy single-page documents', () => {
    expect(docIsEmpty({ objects: [], artboards: [] })).toBe(true)
    expect(docIsEmpty({ objects: [{ id: 'a' }] })).toBe(false)
    expect(docIsEmpty({ artboards: [{ id: 'ab' }] })).toBe(false)
  })
})
