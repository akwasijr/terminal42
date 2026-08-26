// The easing curve.
//
// Easing changes how a loop's phase is spent, not what it visits, so it can be
// edited as a curve without any component knowing. Presets exist because most
// people want "ease out" and not a cubic Bézier; the handles exist because the
// people who do want a specific curve cannot get it from a menu.

import { useCallback, useRef } from 'react'
import type { Easing } from '../../../../shared/motion/types'

const PRESETS: Array<{ label: string; value: Easing }> = [
  { label: 'Linear', value: { x1: 0, y1: 0, x2: 1, y2: 1 } },
  { label: 'Ease', value: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 } },
  { label: 'In', value: { x1: 0.42, y1: 0, x2: 1, y2: 1 } },
  { label: 'Out', value: { x1: 0, y1: 0, x2: 0.58, y2: 1 } },
  { label: 'In out', value: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 } },
  { label: 'Snap', value: { x1: 0.9, y1: 0, x2: 0.1, y2: 1 } }
]

const SIZE = 120

export function EasingEditor({ easing, onChange }: { easing: Easing; onChange: (e: Easing) => void }): React.JSX.Element {
  const svg = useRef<SVGSVGElement | null>(null)
  const dragging = useRef<1 | 2 | null>(null)

  const pointFromEvent = useCallback((e: React.PointerEvent): { x: number; y: number } => {
    const rect = svg.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      // X is clamped to the unit interval because a control point outside it
      // makes a curve that is not a function of time, which no amount of
      // Newton-Raphson will solve.
      x: clamp01((e.clientX - rect.left) / rect.width),
      // Y is deliberately not clamped: overshoot past 1 is how you get a
      // spring, and that is a curve people actually want.
      y: clampY(1 - (e.clientY - rect.top) / rect.height)
    }
  }, [])

  const move = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    const p = pointFromEvent(e)
    onChange(dragging.current === 1 ? { ...easing, x1: p.x, y1: p.y } : { ...easing, x2: p.x, y2: p.y })
  }, [easing, onChange, pointFromEvent])

  const px = (x: number): number => x * SIZE
  const py = (y: number): number => SIZE - y * SIZE

  return (
    <div className="flex flex-col gap-2">
      <svg
        ref={svg}
        viewBox={`-14 -30 ${SIZE + 28} ${SIZE + 60}`}
        className="h-32 w-full touch-none rounded-md bg-sunken"
        onPointerMove={move}
        onPointerUp={() => { dragging.current = null }}
        onPointerLeave={() => { dragging.current = null }}
        role="img"
        aria-label={`Easing curve, cubic-bezier(${easing.x1.toFixed(2)}, ${easing.y1.toFixed(2)}, ${easing.x2.toFixed(2)}, ${easing.y2.toFixed(2)})`}
      >
        <rect x="0" y="0" width={SIZE} height={SIZE} fill="none" stroke="rgb(var(--border))" strokeWidth="1" />
        <line x1="0" y1={py(0)} x2={px(easing.x1)} y2={py(easing.y1)} stroke="rgb(var(--border-strong))" strokeWidth="1" />
        <line x1={px(1)} y1={py(1)} x2={px(easing.x2)} y2={py(easing.y2)} stroke="rgb(var(--border-strong))" strokeWidth="1" />
        <path
          d={`M 0 ${py(0)} C ${px(easing.x1)} ${py(easing.y1)}, ${px(easing.x2)} ${py(easing.y2)}, ${px(1)} ${py(1)}`}
          fill="none"
          stroke="rgb(var(--accent))"
          strokeWidth="2"
        />
        {([1, 2] as const).map((n) => {
          const x = n === 1 ? easing.x1 : easing.x2
          const y = n === 1 ? easing.y1 : easing.y2
          return (
            <circle
              key={n}
              cx={px(x)}
              cy={py(y)}
              r="6"
              fill="rgb(var(--bg))"
              stroke="rgb(var(--accent))"
              strokeWidth="2"
              className="cursor-grab"
              onPointerDown={(e) => {
                dragging.current = n
                ;(e.target as SVGCircleElement).setPointerCapture?.(e.pointerId)
              }}
            />
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => {
          const active = same(p.value, easing)
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.value)}
              aria-pressed={active}
              className={`rounded-sm px-1.5 py-0.5 text-[10.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                active ? 'bg-action text-action-text' : 'bg-sunken text-text-muted hover:text-text-primary'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function same(a: Easing, b: Easing): boolean {
  return Math.abs(a.x1 - b.x1) < 0.005 && Math.abs(a.y1 - b.y1) < 0.005
    && Math.abs(a.x2 - b.x2) < 0.005 && Math.abs(a.y2 - b.y2) < 0.005
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function clampY(v: number): number {
  return Math.min(1.6, Math.max(-0.6, v))
}
