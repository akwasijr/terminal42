import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const stage = readFileSync(
  join(__dirname, '../../src/renderer/src/components/motion/MotionStage.tsx'),
  'utf8'
)

describe('wording is changed where it is read', () => {
  it('opens an editor when you double-click a caption', () => {
    expect(stage).toContain('onDoubleClick={onDoubleClick}')
    expect(stage).toMatch(/if \(pick\?\.kind !== 'text'\) return/)
  })

  it('puts the box exactly over the words it replaces', () => {
    // boxFor returns overlay pixels; the frame is laid out in CSS ones, so the
    // box would sit at roughly twice the offset on a retina screen without this.
    expect(stage).toContain('toCssBox')
    expect(stage).toContain('boxFor(')
  })

  it('matches the type it is standing in for', () => {
    for (const prop of ['fontSize', 'fontFamily', 'fontWeight', 'textAlign', 'color']) {
      expect(stage, `the editor ignores ${prop}`).toContain(`${prop}:`)
    }
  })

  it('hides the drawn copy so there is only one set of words', () => {
    expect(stage).toMatch(/filter\(\(t\) => t\.id !== editing\?\.id\)/)
    expect(stage).toContain("editing?.id, doc.frame")
  })

  it('grows from whichever edge the layer is anchored to', () => {
    expect(stage).toMatch(/align === 'right'[\s\S]{0,120}align === 'center'/)
  })
})

describe('an edit is committed or thrown away, never half kept', () => {
  it('commits on Enter and on leaving the box', () => {
    expect(stage).toContain('onBlur={commitEdit}')
    expect(stage).toMatch(/e\.key === 'Enter' && !e\.shiftKey/)
  })

  it('keeps Shift+Enter for a second line', () => {
    expect(stage).toContain('!e.shiftKey')
  })

  it('throws the draft away on Escape', () => {
    expect(stage).toMatch(/e\.key === 'Escape'[\s\S]{0,60}setEditing\(null\)/)
  })

  it('refuses to blank a caption, which would make it unreachable', () => {
    expect(stage).toMatch(/cur\.draft\.trim\(\) !== ''/)
  })

  it('does not let a keystroke reach the shortcuts behind it', () => {
    expect(stage).toMatch(/onKeyDown=\{\(e\) => \{\s*\n\s*e\.stopPropagation\(\)/)
  })
})
