/**
 * Templates are not yours to throw away.
 *
 * A template is shared scaffolding: deleting one takes it away from every
 * future project, not just the open one. The lists therefore offer Duplicate
 * — which hands you a copy that *is* yours — and never Delete.
 *
 * This is a rule about the shape of the product rather than about one screen,
 * so it is checked across every gallery at once.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..', 'src', 'renderer', 'src', 'components')

const GALLERIES = [
  'TemplatesGallery.tsx',
  'DeckTemplateGallery.tsx',
  'TemplatesModal.tsx',
  join('motion', 'MotionTemplates.tsx')
]

describe('template galleries', () => {
  for (const file of GALLERIES) {
    const source = readFileSync(join(ROOT, file), 'utf8')

    it(`${file} offers no way to delete a template`, () => {
      // Catches both a bare button and a CardMenu entry.
      expect(source).not.toMatch(/label:\s*'Delete/)
      expect(source).not.toMatch(/ConfirmDelete/)
      expect(source).not.toMatch(/onDelete/)
    })
  }

  it('lets you take a copy of a template instead', () => {
    const source = readFileSync(join(ROOT, 'TemplatesGallery.tsx'), 'utf8')
    expect(source).toMatch(/Duplicate to my designs/)
  })

  it('says when a copy is under way rather than looking like a missed click', () => {
    const source = readFileSync(join(ROOT, 'TemplatesGallery.tsx'), 'utf8')
    expect(source).toMatch(/Copying…/)
    expect(source).toMatch(/Could not copy/)
  })
})
