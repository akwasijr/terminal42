// Scenery: the flat blocks of colour and the cut-out pictures a composition
// is built on.
//
// The motion engine arranges cards in space, which is the wrong tool for a
// panel that has to stay exactly where it is put. Before these existed a flat
// colour field had to be faked with a card carrying no picture, which then
// obeyed the component's arrangement and drifted the moment any parameter
// moved. A shape is not a card: it is placed as a percentage of the frame,
// like text and logos, and nothing rearranges it.
//
// Shapes and pictures share this file because they share a geometry — the
// same box, the same outlines, the same handles. A picture is a shape with a
// photograph inside it, and splitting them would mean two panels that had to
// be kept in step by hand.

import type {
  LayerTransform, MotionDoc, PictureFit, PictureLayer, ShapeKind, ShapeLayer
} from '../../../../shared/motion/types'
import { SHAPE_KINDS, SHAPE_LABELS } from '../../../../shared/motion/types'
import { ColorRow, Section, SegmentedRow, SelectRow, SliderRow } from './controls'
import type { Keyer } from '../../lib/motion/keying'
import type { Pick } from '../../lib/motion/overlayPick'
import { TransformRows } from './MotionTransformRows'

const SHAPE_OPTIONS = SHAPE_KINDS.map((k) => ({ value: k, label: SHAPE_LABELS[k] }))

export function ShapeSection({
  doc, onChange, keyer, selected = null, onSelect
}: {
  doc: MotionDoc
  onChange: (patch: Partial<MotionDoc>) => void
  keyer?: Keyer
  selected?: Pick | null
  onSelect?: (pick: Pick | null) => void
}): React.JSX.Element {
  const shapes = doc.visual.shapes ?? []
  const setShapes = (next: ShapeLayer[]): void =>
    onChange({ visual: { ...doc.visual, shapes: next } })

  return (
    <Section
      title="Shapes"
      defaultOpen={false}
      reveal={selected?.kind === 'shape'}
      right={
        <button
          type="button"
          onClick={() =>
            setShapes([
              ...shapes,
              {
                id: `shape-${Date.now()}`,
                kind: 'rect',
                // Large enough to see the moment it lands, small enough that
                // it is obviously a panel rather than a change of background.
                width: 40, height: 30, x: 50, y: 50,
                rotation: 0, colour: '#d8d3c8', opacity: 100, corner: 0
              }
            ])
          }
          className="rounded-sm px-1.5 py-0.5 text-[10.5px] text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Add
        </button>
      }
    >
      {shapes.length === 0 ? (
        <p className="text-[11px] text-text-muted">
          A block of colour to set type on, or to sit a picture against.
        </p>
      ) : null}
      {shapes.map((layer, i) => {
        const setLayer = (patch: Partial<ShapeLayer>): void =>
          setShapes(shapes.map((l, j) => (j === i ? { ...l, ...patch } : l)))
        const picked = selected?.kind === 'shape' && selected.id === layer.id
        return (
          <div
            key={layer.id}
            onPointerDownCapture={() => onSelect?.({ kind: 'shape', id: layer.id })}
            className={`flex flex-col gap-2 rounded-md bg-sunken p-2 ${picked ? 'ring-1 ring-accent/60' : ''}`}
          >
            <div className="flex items-center gap-1">
              <SelectRow
                label=""
                value={layer.kind}
                options={SHAPE_OPTIONS}
                onChange={(v) => setLayer({ kind: v as ShapeKind })}
              />
              <button
                type="button"
                onClick={() => setShapes(shapes.filter((_, j) => j !== i))}
                aria-label={`Remove ${SHAPE_LABELS[layer.kind].toLowerCase()} ${i + 1}`}
                className="rounded-sm px-1.5 py-1 text-[10.5px] text-text-muted hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                ×
              </button>
            </div>
            <ColorRow label="Colour" value={layer.colour} onChange={(v) => setLayer({ colour: v })} />
            <Geometry
              layer={layer}
              prefix={`shape:${layer.id}`}
              keyer={keyer}
              onChange={setLayer}
            />
            {layer.kind === 'rect' ? (
              <SliderRow
                label="Corner"
                value={layer.corner ?? 0}
                min={0}
                max={50}
                step={1}
                onChange={(v) => setLayer({ corner: v })}
              />
            ) : null}
          </div>
        )
      })}
    </Section>
  )
}

export function PictureSection({
  doc, onChange, keyer, selected = null, onSelect
}: {
  doc: MotionDoc
  onChange: (patch: Partial<MotionDoc>) => void
  keyer?: Keyer
  selected?: Pick | null
  onSelect?: (pick: Pick | null) => void
}): React.JSX.Element {
  const pictures = doc.visual.pictures ?? []
  const setPictures = (next: PictureLayer[]): void =>
    onChange({ visual: { ...doc.visual, pictures: next } })
  const usable = doc.visual.images

  return (
    <Section
      title="Pictures"
      defaultOpen={false}
      reveal={selected?.kind === 'picture'}
      right={
        <button
          type="button"
          onClick={() =>
            setPictures([
              ...pictures,
              {
                id: `pic-${Date.now()}`,
                // Deliberately left empty even when pictures are available:
                // an empty slot says what belongs there, and a slot filled
                // with whatever happened to be first says nothing at all.
                imageId: undefined,
                mask: 'rect', width: 34, height: 44, x: 50, y: 50,
                rotation: 0, opacity: 100, fit: 'cover', corner: 0,
                placeholder: 'Picture'
              }
            ])
          }
          className="rounded-sm px-1.5 py-0.5 text-[10.5px] text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Add
        </button>
      }
    >
      {pictures.length === 0 ? (
        <p className="text-[11px] text-text-muted">
          A photograph cut to a shape and placed on the frame.
        </p>
      ) : null}
      {pictures.map((layer, i) => {
        const setLayer = (patch: Partial<PictureLayer>): void =>
          setPictures(pictures.map((l, j) => (j === i ? { ...l, ...patch } : l)))
        const picked = selected?.kind === 'picture' && selected.id === layer.id
        return (
          <div
            key={layer.id}
            onPointerDownCapture={() => onSelect?.({ kind: 'picture', id: layer.id })}
            className={`flex flex-col gap-2 rounded-md bg-sunken p-2 ${picked ? 'ring-1 ring-accent/60' : ''}`}
          >
            <div className="flex items-center gap-1">
              <select
                value={layer.imageId ?? ''}
                onChange={(e) => setLayer({ imageId: e.target.value || undefined })}
                aria-label={`Picture ${i + 1}`}
                className="min-w-0 flex-1 rounded-sm bg-bg px-1.5 py-1 text-[11.5px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <option value="">Empty slot</option>
                {usable.map((img) => (
                  <option key={img.id} value={img.id}>{img.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setPictures(pictures.filter((_, j) => j !== i))}
                aria-label={`Remove picture ${i + 1}`}
                className="rounded-sm px-1.5 py-1 text-[10.5px] text-text-muted hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                ×
              </button>
            </div>
            {layer.imageId ? null : (
              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] text-text-muted">What belongs here</span>
                <input
                  value={layer.placeholder ?? ''}
                  placeholder="Picture"
                  onChange={(e) => setLayer({ placeholder: e.target.value })}
                  className="rounded-sm bg-bg px-1.5 py-1 text-[11.5px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                />
              </label>
            )}
            <SelectRow
              label="Cut to"
              value={layer.mask}
              options={SHAPE_OPTIONS}
              onChange={(v) => setLayer({ mask: v as ShapeKind })}
            />
            <SegmentedRow
              label="Fit"
              value={layer.fit}
              options={[
                { value: 'cover', label: 'Fill' },
                { value: 'contain', label: 'Whole' }
              ]}
              onChange={(v) => setLayer({ fit: v as PictureFit })}
            />
            <Geometry
              layer={layer}
              prefix={`picture:${layer.id}`}
              keyer={keyer}
              onChange={setLayer}
            />
            {layer.mask === 'rect' ? (
              <SliderRow
                label="Corner"
                value={layer.corner ?? 0}
                min={0}
                max={50}
                step={1}
                onChange={(v) => setLayer({ corner: v })}
              />
            ) : null}
          </div>
        )
      })}
    </Section>
  )
}

/**
 * The box a shape or a picture occupies, and how present it is.
 *
 * Shared because the two are the same geometry, and because a keyframe target
 * is a string built from a prefix and a field — writing that string out twice
 * is how a track ends up driving nothing.
 */
function Geometry({
  layer, prefix, keyer, onChange
}: {
  layer: { width: number; height: number; x: number; y: number; opacity: number } & LayerTransform
  prefix: string
  keyer?: Keyer
  onChange: (
    patch: { width?: number; height?: number; x?: number; y?: number; opacity?: number } & LayerTransform
  ) => void
}): React.JSX.Element {
  return (
    <>
      <SliderRow label="Width" value={layer.width} min={1} max={140} step={0.5} onChange={(v) => onChange({ width: v })} keyframe={keyer?.(`${prefix}:width`, layer.width)} />
      <SliderRow label="Height" value={layer.height} min={1} max={140} step={0.5} onChange={(v) => onChange({ height: v })} keyframe={keyer?.(`${prefix}:height`, layer.height)} />
      <SliderRow label="Across" value={layer.x} min={-20} max={120} step={0.5} onChange={(v) => onChange({ x: v })} keyframe={keyer?.(`${prefix}:x`, layer.x)} />
      <SliderRow label="Down" value={layer.y} min={-20} max={120} step={0.5} onChange={(v) => onChange({ y: v })} keyframe={keyer?.(`${prefix}:y`, layer.y)} />
      <SliderRow label="Opacity" value={layer.opacity} min={0} max={100} step={1} onChange={(v) => onChange({ opacity: v })} keyframe={keyer?.(`${prefix}:opacity`, layer.opacity)} />
      {/* Turn lives with scale and the anchor, because the three are one
          idea and a layer that can turn but not turn about a corner is only
          half of it. */}
      <TransformRows layer={layer} prefix={prefix} onChange={onChange} keyer={keyer} />
    </>
  )
}
