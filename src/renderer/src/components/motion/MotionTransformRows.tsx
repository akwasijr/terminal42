// The transform every flat layer shares: how far it is turned, how big it is
// drawn, and the point it does both about.
//
// One component rather than the same three rows written into four panels,
// for the same reason the drawing goes through one transform: text and logos
// spent a long time unable to rotate purely because the shape panel had a
// row that the others did not.

import type { LayerTransform } from '../../../../shared/motion/types'
import { SliderRow } from './controls'
import type { Keyer } from '../../lib/motion/keying'

/** The nine places an anchor is actually ever put. */
const ANCHORS: Array<{ x: number; y: number; label: string }> = [
  { x: 0, y: 0, label: 'Top left' },
  { x: 0.5, y: 0, label: 'Top' },
  { x: 1, y: 0, label: 'Top right' },
  { x: 0, y: 0.5, label: 'Left' },
  { x: 0.5, y: 0.5, label: 'Centre' },
  { x: 1, y: 0.5, label: 'Right' },
  { x: 0, y: 1, label: 'Bottom left' },
  { x: 0.5, y: 1, label: 'Bottom' },
  { x: 1, y: 1, label: 'Bottom right' }
]

/**
 * The anchor, as the nine points rather than two more sliders.
 *
 * Anchors are almost always put on a corner, an edge or the middle, and a
 * grid says at a glance which one is in use -- where a pair of numbers would
 * have to be read and pictured. Dragging one to 0.37 is not a thing anyone
 * needs, and the numbers stay available to a keyframe if it ever is.
 */
function AnchorGrid({
  value, onChange
}: {
  value: { x: number; y: number } | undefined
  onChange: (v: { x: number; y: number } | undefined) => void
}): React.JSX.Element {
  const ax = value?.x ?? 0.5
  const ay = value?.y ?? 0.5
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-[68px] shrink-0 text-[11px] text-text-muted">Anchor</span>
      <div className="grid grid-cols-3 gap-px rounded-sm bg-sunken p-px" role="group" aria-label="Anchor point">
        {ANCHORS.map((a) => {
          const on = a.x === ax && a.y === ay
          return (
            <button
              key={a.label}
              type="button"
              aria-label={a.label}
              aria-pressed={on}
              // The middle is the absence of an anchor, so choosing it puts
              // the layer back to having none rather than writing 0.5,0.5.
              onClick={() => onChange(a.x === 0.5 && a.y === 0.5 ? undefined : { x: a.x, y: a.y })}
              className={`h-4 w-4 rounded-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                on ? 'bg-accent' : 'bg-elevated hover:bg-raised'
              }`}
            />
          )
        })}
      </div>
    </div>
  )
}

/**
 * Turn, scale and anchor for one layer.
 *
 * `prefix` is the layer's keying target up to the field, so a logo passes
 * `logo:<id>` and a shape `shape:<id>`.
 */
export function TransformRows({
  layer, prefix, onChange, keyer
}: {
  layer: LayerTransform
  prefix: string
  onChange: (patch: LayerTransform) => void
  keyer?: Keyer
}): React.JSX.Element {
  const rotation = layer.rotation ?? 0
  const scale = layer.scale ?? 100
  return (
    <>
      <SliderRow
        label="Turn"
        value={rotation}
        min={-180}
        max={180}
        step={1}
        unit="°"
        onChange={(v) => onChange({ rotation: v })}
        keyframe={keyer?.(`${prefix}:rotation`, rotation)}
      />
      <SliderRow
        label="Scale"
        value={scale}
        min={0}
        max={400}
        step={1}
        unit="%"
        onChange={(v) => onChange({ scale: v })}
        keyframe={keyer?.(`${prefix}:scale`, scale)}
      />
      <AnchorGrid value={layer.anchor} onChange={(anchor) => onChange({ anchor })} />
    </>
  )
}
