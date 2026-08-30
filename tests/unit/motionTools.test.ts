import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { isShapeTool, toolLabel } from '../../src/renderer/src/lib/motion/tools'

const src = (p: string): string =>
  readFileSync(join(__dirname, '../../src/renderer/src', p), 'utf8')

const tools = src('components/motion/MotionTools.tsx')
const lib = src('lib/motion/tools.ts')
const stage = src('components/motion/MotionStage.tsx')
const studio = src('components/motion/MotionStudio.tsx')

/** The file with the comments taken out, so a rule cannot pass on its own note. */
const bare = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')

describe('naming a tool', () => {
  it('tells a shape tool from the rest', () => {
    expect(isShapeTool('select')).toBe(false)
    expect(isShapeTool('text')).toBe(false)
    expect(isShapeTool('picture')).toBe(false)
    expect(isShapeTool({ shape: 'ellipse' })).toBe(true)
    // The toolbar imports these rather than defining them: a file that
    // exports both a component and a plain function loses the stage's state
    // on every hot reload.
    expect(tools).toContain("from '../../lib/motion/tools'")
    expect(lib).toContain('export function isShapeTool')
  })

  it('calls a shape by its own name rather than "shape"', () => {
    expect(toolLabel('select')).toBe('Select')
    expect(toolLabel('text')).toBe('Text')
    expect(toolLabel('picture')).toBe('Picture')
    expect(toolLabel({ shape: 'ellipse' })).toBe('Ellipse')
    expect(toolLabel({ shape: 'triangle' })).toBe('Triangle')
  })
})

describe('which of the drawing tools carry over to motion', () => {
  it('brings the three that make a layer', () => {
    expect(tools).toContain('label="Text"')
    expect(tools).toContain('label="Picture"')
    expect(tools).toContain('label="Select"')
    expect(tools).toContain('Draw a ${SHAPE_LABELS[')
  })

  it('leaves out the three that have nothing to act on', () => {
    // Pan: the frame is fitted to the panel, so there is nowhere to pan to.
    // Frame: a piece has exactly one, and its size is the aspect control.
    // Pen: there is no path layer, and inventing one is a renderer, a hit
    // test and a keyframe model for something no piece has asked for.
    const code = bare(tools)
    expect(code).not.toMatch(/label="(Hand|Pan|Frame|Artboard|Pen)"/)
  })

  it('offers every shape the format already has, not a chosen few', () => {
    expect(tools).toContain('SHAPE_KINDS.map(')
  })

  it('keeps the shape you last drew on the button', () => {
    expect(tools).toContain('const [lastShape, setLastShape]')
    expect(tools).toMatch(/setLastShape\(k\)/)
  })

  it('is a menu a screen reader can work', () => {
    expect(tools).toContain('aria-haspopup="menu"')
    expect(tools).toContain('role="menu"')
    expect(tools).toContain('role="menuitem"')
    expect(tools).toContain('aria-pressed={active}')
  })
})

describe('drawing on the frame', () => {
  it('asks the tool before it asks what is under the pointer', () => {
    // Otherwise a press on top of an existing layer picks that layer up
    // instead of starting the new one.
    const down = stage.slice(stage.indexOf('const onPointerDown'))
    expect(down.slice(0, 400)).toMatch(/if \(tool !== 'select'\)/)
  })

  it('measures the drag as a share of the frame, not in pixels', () => {
    // Every flat layer is positioned in percentages, so a piece looks the
    // same whatever size the panel happens to be.
    expect(stage).toContain('/ r.width) * 100')
    expect(stage).toContain('/ r.height) * 100')
  })

  it('puts the layer where the drag was, at the size of the drag', () => {
    expect(stage).toContain('x: (draw.x0 + draw.x1) / 2')
    expect(stage).toContain('w: Math.abs(draw.x1 - draw.x0)')
  })

  it('gives a click a size someone can see rather than nothing at all', () => {
    // A click is a drag of zero, and a layer of zero width is invisible and
    // unselectable -- it would read as the tool having done nothing.
    expect(stage).toMatch(/box\.w > 2 \? box\.w : 30/)
    expect(stage).toMatch(/box\.h > 2 \? box\.h : 8/)
  })

  it('shows the box it is about to make while the drag is happening', () => {
    expect(stage).toMatch(/\{draw \?/)
    expect(stage).toContain('Math.min(draw.x0, draw.x1)')
  })

  it('goes back to select after one use', () => {
    // Staying in the tool means the next click on the frame puts down another
    // one by accident.
    expect(stage).toMatch(/onTool\?\.\('select'\)/)
  })

  it('selects what it just made, so it can be adjusted at once', () => {
    expect(stage).toContain("onSelect({ kind: 'text', id })")
    expect(stage).toContain("onSelect({ kind: 'picture', id })")
    expect(stage).toContain("onSelect({ kind: 'shape', id })")
  })
})

describe('the picture tool finds an image for the layer it drew', () => {
  it('asks through the app rather than a bare file input', () => {
    // A raw <input type="file"> in Electron opens a dialog the app has no
    // hold over; the importer is the path every other picture already takes.
    expect(bare(stage)).not.toContain("input.type = 'file'")
    expect(stage).toContain('onPickImage?.(id)')
    expect(studio).toContain('window.terminal42.motion.importImages()')
  })

  it('gives the image to that layer and not to a card', () => {
    expect(studio).toMatch(/l\.id === pictureId \? \{ \.\.\.l, imageId: added\[0\]\.id \}/)
  })

  it('reads the document as it is when the dialog closes, not as it was', () => {
    // The dialog is open for as long as someone takes to choose. Merging the
    // copy held from before it opened would undo everything done meanwhile.
    expect(studio).toMatch(/patch\(\(d\) => \(\{/)
    expect(studio).toContain("typeof p === 'function' ? p(h.present) : p")
  })
})
