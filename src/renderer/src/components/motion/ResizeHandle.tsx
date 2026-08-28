// A drag handle that resizes the pane beside it.
//
// The handle is two pixels of visible line inside an eight pixel target,
// because a hairline is what the eye wants and a hairline is not what the
// mouse wants. It stays invisible until it is useful — hovering or dragging —
// so a panel edge does not read as a border in a design that has none.
//
// Sizes are kept in localStorage rather than in the document: how you like
// your panels laid out is a fact about you, not about the piece.
//
// One component covers both axes rather than two that look alike. The
// difference between them is which coordinate the drag reads and which two
// arrow keys move it, and splitting that across two files is how the two
// slowly stop behaving the same.

import { useCallback, useEffect, useRef, useState } from 'react'

/** Which side of the handle the pane being sized is on. */
export type ResizeSide = 'left' | 'right' | 'top' | 'bottom'

const DEFAULT_RESET: Record<ResizeSide, number> = {
  left: 240, right: 256, top: 220, bottom: 220
}

export function ResizeHandle({
  label, width, onWidth, side, min, max, reset
}: {
  label: string
  /** The current size of the pane, in pixels: a width or a height. */
  width: number
  onWidth: (n: number) => void
  side: ResizeSide
  min: number
  max: number
  /** Where a double-click puts it back to. */
  reset?: number
}): React.JSX.Element {
  const drag = useRef<{ pos: number; start: number } | null>(null)
  const [active, setActive] = useState(false)
  const vertical = side === 'top' || side === 'bottom'

  const onPointerMove = useCallback((e: PointerEvent): void => {
    const d = drag.current
    if (!d) return
    // Dragging away from the pane makes it bigger, whichever side it is on.
    const pos = vertical ? e.clientY : e.clientX
    const delta = side === 'left' || side === 'top' ? pos - d.pos : d.pos - pos
    onWidth(d.start + delta)
  }, [onWidth, side, vertical])

  const onPointerUp = useCallback((): void => {
    drag.current = null
    setActive(false)
  }, [])

  useEffect(() => {
    if (!active) return
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [active, onPointerMove, onPointerUp])

  return (
    <div
      role="separator"
      // The separator itself lies across the split: a left/right split is
      // divided by a vertical line, a top/bottom split by a horizontal one.
      aria-orientation={vertical ? 'horizontal' : 'vertical'}
      aria-label={label}
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(e) => {
        drag.current = { pos: vertical ? e.clientY : e.clientX, start: width }
        setActive(true)
        e.preventDefault()
      }}
      onDoubleClick={() => onWidth(reset ?? DEFAULT_RESET[side])}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 32 : 8
        const [less, more] = vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight']
        const grows = side === 'left' || side === 'top' ? more : less
        const shrinks = grows === more ? less : more
        if (e.key === grows) { onWidth(width + step); e.preventDefault() }
        if (e.key === shrinks) { onWidth(width - step); e.preventDefault() }
      }}
      className={`group relative flex shrink-0 items-stretch justify-center focus-visible:outline-none ${
        vertical ? '-my-1 h-2 w-full cursor-row-resize flex-col' : '-mx-1 w-2 cursor-col-resize'
      }`}
    >
      <span
        aria-hidden
        className={`rounded-full transition-colors ${vertical ? 'mx-3 h-px' : 'my-3 w-px'} ${
          active ? 'bg-accent/70' : 'bg-transparent group-hover:bg-border-strong group-focus-visible:bg-accent/70'
        }`}
      />
    </div>
  )
}
