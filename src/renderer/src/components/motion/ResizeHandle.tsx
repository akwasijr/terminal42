// A drag handle that resizes the pane beside it.
//
// The handle is two pixels of visible line inside an eight pixel target,
// because a hairline is what the eye wants and a hairline is not what the
// mouse wants. It stays invisible until it is useful — hovering or dragging —
// so a panel edge does not read as a border in a design that has none.
//
// Widths are kept in localStorage rather than in the document: how wide you
// like your panels is a fact about you, not about the piece.

import { useCallback, useEffect, useRef, useState } from 'react'

export function ResizeHandle({
  label, width, onWidth, side, min, max
}: {
  label: string
  width: number
  onWidth: (n: number) => void
  /** Which side of the handle the pane being sized is on. */
  side: 'left' | 'right'
  min: number
  max: number
}): React.JSX.Element {
  const drag = useRef<{ x: number; start: number } | null>(null)
  const [active, setActive] = useState(false)

  const onPointerMove = useCallback((e: PointerEvent): void => {
    const d = drag.current
    if (!d) return
    const delta = side === 'left' ? e.clientX - d.x : d.x - e.clientX
    onWidth(d.start + delta)
  }, [onWidth, side])

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
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, start: width }
        setActive(true)
        e.preventDefault()
      }}
      onDoubleClick={() => onWidth(side === 'left' ? 240 : 256)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 32 : 8
        if (e.key === 'ArrowLeft') { onWidth(width + (side === 'left' ? -step : step)); e.preventDefault() }
        if (e.key === 'ArrowRight') { onWidth(width + (side === 'left' ? step : -step)); e.preventDefault() }
      }}
      className="group relative -mx-1 flex w-2 shrink-0 cursor-col-resize items-stretch justify-center focus-visible:outline-none"
    >
      <span
        aria-hidden
        className={`my-3 w-px rounded-full transition-colors ${
          active ? 'bg-accent/70' : 'bg-transparent group-hover:bg-border-strong group-focus-visible:bg-accent/70'
        }`}
      />
    </div>
  )
}
