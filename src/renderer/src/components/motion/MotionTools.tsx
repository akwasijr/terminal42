// The tools that put something new on the frame.
//
// A piece could already hold text, blocks of colour and pictures, but the only
// way to add one was a button buried in a collapsed section of the right-hand
// panel, which dropped the layer in the middle of the frame at a size nobody
// asked for. You then dragged it to where you had wanted it all along.
//
// Three of the drawing canvas's tools carry over. Panning does not - the frame
// is fitted to the panel and there is nowhere to pan to - nor does the frame
// tool, because a piece has exactly one frame and its size is a property of the
// piece rather than something you draw. Nor does the pen: there is no path
// layer, and inventing one means a renderer, a hit test and a keyframe model
// for something no piece has ever asked for.

import { useEffect, useRef, useState } from 'react'
import { SHAPE_KINDS, SHAPE_LABELS, type ShapeKind } from '../../../../shared/motion/types'
import { isShapeTool, type MotionTool } from '../../lib/motion/tools'

/** Each shape drawn at a glance, so the menu is shapes rather than words. */
function ShapeGlyph({ kind }: { kind: ShapeKind }): React.JSX.Element {
  const common = { fill: 'currentColor' }
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
      {kind === 'rect' ? <rect x="2" y="3" width="12" height="10" rx="1" {...common} /> : null}
      {kind === 'ellipse' ? <ellipse cx="8" cy="8" rx="6" ry="5" {...common} /> : null}
      {kind === 'pill' ? <rect x="1" y="5" width="14" height="6" rx="3" {...common} /> : null}
      {kind === 'half' ? <path d="M2 11a6 6 0 0 1 12 0z" {...common} /> : null}
      {kind === 'arch' ? <path d="M3 13V8a5 5 0 0 1 10 0v5z" {...common} /> : null}
      {kind === 'triangle' ? <path d="M8 3l6 10H2z" {...common} /> : null}
    </svg>
  )
}

function CursorGlyph(): React.JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <path d="M3 2l9 5.2-3.9.9L6.6 12z" />
    </svg>
  )
}

function TextGlyph(): React.JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 4h10M8 4v9" />
    </svg>
  )
}

function PictureGlyph(): React.JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="M2 10.5l3-2.5 3 2.5 2-1.5 4 3" />
    </svg>
  )
}

function Button({
  label, active, onClick, children
}: {
  label: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`grid h-6 w-6 place-items-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
        active ? 'bg-raised text-text-primary' : 'text-text-muted hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  )
}

export function MotionTools({
  tool, onTool
}: { tool: MotionTool; onTool: (t: MotionTool) => void }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)
  // The shape button keeps whichever shape you last drew, so drawing six of the
  // same thing is six clicks rather than six trips through the menu.
  const [lastShape, setLastShape] = useState<ShapeKind>('rect')

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const shapeActive = isShapeTool(tool)

  return (
    <div ref={box} className="relative flex items-center gap-0.5" role="group" aria-label="Tools">
      <Button label="Select" active={tool === 'select'} onClick={() => onTool('select')}>
        <CursorGlyph />
      </Button>
      <Button label="Text" active={tool === 'text'} onClick={() => onTool('text')}>
        <TextGlyph />
      </Button>
      <Button label="Picture" active={tool === 'picture'} onClick={() => onTool('picture')}>
        <PictureGlyph />
      </Button>
      <div className="flex items-center">
        <Button
          label={`Draw a ${SHAPE_LABELS[shapeActive ? tool.shape : lastShape].toLowerCase()}`}
          active={shapeActive}
          onClick={() => onTool({ shape: shapeActive ? tool.shape : lastShape })}
        >
          <ShapeGlyph kind={shapeActive ? tool.shape : lastShape} />
        </Button>
        <button
          type="button"
          aria-label="Choose a shape"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
          className="grid h-6 w-3 place-items-center rounded-sm text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M1.5 3l2.5 2.5L6.5 3" />
          </svg>
        </button>
      </div>
      {open ? (
        <div
          role="menu"
          aria-label="Choose a shape"
          className="t42-menu absolute left-0 top-full z-30 mt-2 w-[152px] rounded-lg bg-raised p-1"
        >
          {SHAPE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="menuitem"
              onClick={() => { setLastShape(k); onTool({ shape: k }); setOpen(false) }}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-text-secondary hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              <ShapeGlyph kind={k} />
              {SHAPE_LABELS[k]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
