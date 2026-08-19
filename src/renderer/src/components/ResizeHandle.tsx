import { useCallback, useEffect, useRef, useState } from 'react'

export function useResizableWidth(storageKey: string, defaultWidth: number, min = 200, max = 480): [number, (n: number) => void] {
  const [width, setWidthState] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(storageKey))
      if (Number.isFinite(v) && v >= min && v <= max) return v
    } catch {}
    return defaultWidth
  })
  const setWidth = useCallback((n: number): void => {
    const clamped = Math.max(min, Math.min(max, Math.round(n)))
    setWidthState(clamped)
    try { localStorage.setItem(storageKey, String(clamped)) } catch {}
  }, [storageKey, min, max])
  return [width, setWidth]
}

export function ResizeHandle({
  side, currentWidth, onChange, min = 200, max = 480
}: {
  side: 'left' | 'right'
  currentWidth: number
  onChange: (w: number) => void
  min?: number
  max?: number
}) {
  const startX = useRef(0)
  const startW = useRef(0)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    startX.current = e.clientX
    startW.current = currentWidth
    setDragging(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  useEffect(() => {
    if (!dragging) return
    const onMove = (ev: PointerEvent): void => {
      const dx = ev.clientX - startX.current
      const next = side === 'left' ? startW.current + dx : startW.current - dx
      onChange(Math.max(min, Math.min(max, next)))
    }
    const onUp = (): void => setDragging(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging, onChange, side, min, max])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onDoubleClick={() => onChange(side === 'left' ? 240 : 320)}
      className={[
        'group relative z-10 -mx-1 w-1 shrink-0 cursor-col-resize rounded-full transition-colors',
        dragging ? 'bg-accent/70' : 'bg-transparent hover:bg-border-strong'
      ].join(' ')}
      title="Drag to resize · double-click to reset"
    >
      <div className="pointer-events-none absolute inset-y-0 -left-1 -right-1" />
    </div>
  )
}
