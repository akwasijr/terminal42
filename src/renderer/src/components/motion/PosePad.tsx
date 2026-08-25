// Pose: the tilt of the whole piece, set by dragging.
//
// Three numbered sliders would be a faithful representation of the data and a
// poor way to aim a 3D object — you cannot tell which of the three you want
// without trying all of them. Dragging maps directly: horizontal is yaw,
// vertical is pitch, and the wireframe shows the result before you commit.

import { useCallback, useRef } from 'react'
import type { Pose } from '../../../../shared/motion/types'
import { SliderRow } from './controls'

export function PosePad({ pose, onChange }: { pose: Pose; onChange: (p: Pose) => void }): React.JSX.Element {
  const drag = useRef<{ x: number; y: number; pose: Pose } | null>(null)

  const down = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, pose }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [pose])

  const move = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    onChange({
      // Half a degree per pixel: a comfortable drag across the pad is most of
      // a half-turn, which is as much as anyone wants before the cards face
      // away.
      tiltY: clampDeg(d.pose.tiltY + (e.clientX - d.x) * 0.5),
      tiltX: clampDeg(d.pose.tiltX + (e.clientY - d.y) * 0.5),
      tiltZ: d.pose.tiltZ
    })
  }, [onChange])

  const up = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  const key = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 15 : 5
    const map: Record<string, Partial<Pose>> = {
      ArrowLeft: { tiltY: clampDeg(pose.tiltY - step) },
      ArrowRight: { tiltY: clampDeg(pose.tiltY + step) },
      ArrowUp: { tiltX: clampDeg(pose.tiltX - step) },
      ArrowDown: { tiltX: clampDeg(pose.tiltX + step) }
    }
    const patch = map[e.key]
    if (!patch) return
    e.preventDefault()
    onChange({ ...pose, ...patch })
  }, [onChange, pose])

  return (
    <div className="flex flex-col gap-2">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Pose tilt"
        aria-valuetext={`Tilt X ${Math.round(pose.tiltX)} degrees, tilt Y ${Math.round(pose.tiltY)} degrees`}
        aria-valuenow={Math.round(pose.tiltY)}
        aria-valuemin={-180}
        aria-valuemax={180}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
        className="relative h-24 cursor-grab select-none rounded-md bg-sunken active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <svg viewBox="-60 -60 120 120" className="h-full w-full" aria-hidden="true">
          <g
            style={{
              transform: `rotateX(${pose.tiltX}deg) rotateY(${pose.tiltY}deg) rotateZ(${pose.tiltZ}deg)`,
              transformOrigin: 'center',
              transformStyle: 'preserve-3d'
            }}
          >
            <ellipse cx="0" cy="0" rx="42" ry="42" fill="none" stroke="rgb(var(--border-strong))" strokeWidth="1" />
            <ellipse
              cx="0" cy="0" rx="42" ry={Math.max(2, 42 * Math.abs(Math.sin((pose.tiltX * Math.PI) / 180)))}
              fill="none" stroke="rgb(var(--accent))" strokeWidth="1.5"
            />
            <rect x="-9" y="-11" width="18" height="22" rx="2" fill="rgb(var(--accent) / 0.25)" stroke="rgb(var(--accent))" strokeWidth="1.5" />
          </g>
        </svg>
      </div>
      <SliderRow label="Tilt X" value={pose.tiltX} min={-180} max={180} step={1} unit="degrees" onChange={(v) => onChange({ ...pose, tiltX: v })} />
      <SliderRow label="Tilt Y" value={pose.tiltY} min={-180} max={180} step={1} unit="degrees" onChange={(v) => onChange({ ...pose, tiltY: v })} />
      <SliderRow label="Tilt Z" value={pose.tiltZ} min={-180} max={180} step={1} unit="degrees" onChange={(v) => onChange({ ...pose, tiltZ: v })} />
    </div>
  )
}

function clampDeg(v: number): number {
  return Math.min(180, Math.max(-180, v))
}
