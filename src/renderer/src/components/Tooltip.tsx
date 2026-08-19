import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Side = 'top' | 'bottom' | 'left' | 'right'

/** Lightweight hover tooltip. Renders into a portal with fixed positioning so it
 * never gets clipped by scrollable panels (e.g. the inspector). */
export function Tooltip({ label, side = 'top', delay = 350, className = 'inline-flex', children }: {
  label: string
  side?: Side
  delay?: number
  className?: string
  children: ReactNode
}): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null)
  const timer = useRef<number | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const show = (): void => {
    timer.current = window.setTimeout(() => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      if (side === 'bottom') setPos({ x: r.left + r.width / 2, y: r.bottom + 6 })
      else if (side === 'left') setPos({ x: r.left - 6, y: r.top + r.height / 2 })
      else if (side === 'right') setPos({ x: r.right + 6, y: r.top + r.height / 2 })
      else setPos({ x: r.left + r.width / 2, y: r.top - 6 })
    }, delay)
  }
  const hide = (): void => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setPos(null)
  }

  const transform =
    side === 'bottom' ? 'translate(-50%, 0)' :
    side === 'left' ? 'translate(-100%, -50%)' :
    side === 'right' ? 'translate(0, -50%)' :
    'translate(-50%, -100%)'

  if (!label) return <>{children}</>

  return (
    <span ref={ref} onMouseEnter={show} onMouseLeave={hide} onMouseDown={hide} className={className}>
      {children}
      {pos && createPortal(
        <div
          role="tooltip"
          style={{ position: 'fixed', left: pos.x, top: pos.y, transform, pointerEvents: 'none', zIndex: 9999, whiteSpace: 'nowrap' }}
          className="rounded-md bg-raised px-2 py-1 text-[11px] font-normal normal-case tracking-normal text-text-primary shadow-overlay"
        >
          {label}
        </div>,
        document.body,
      )}
    </span>
  )
}
