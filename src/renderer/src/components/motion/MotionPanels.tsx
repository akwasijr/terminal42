// The right-hand panels.
//
// Two columns of settings in one scroll: what the arrangement does, and what
// it looks like. The component's own parameters are rendered straight from its
// schema, so the panel has no knowledge of any particular component — adding a
// slider to the carousel does not mean editing this file.

import type {
  CardStyle, ComponentId, MotionDoc, ParamSpec, ParamValue
} from '../../../../shared/motion/types'
import { componentFor } from '../../../../shared/motion/registry'
import { paramsFor } from '../../../../shared/motion/defaults'
import { ColorRow, Disclosure, SegmentedRow, Section, SliderRow, ToggleRow } from './controls'
import { ImagesPanel } from './MotionImages'
import { LogoSection } from './MotionLogos'
import { EffectsSection } from './MotionEffects'
import { PosePad } from './PosePad'
import { EasingEditor } from './EasingEditor'

/** How many of a component's parameters are shown before the fold. */
const PRIMARY_PARAMS = 5

export function ParamsPanel({
  doc, onChange
}: { doc: MotionDoc; onChange: (patch: Partial<MotionDoc>) => void }): React.JSX.Element {
  const component = componentFor(doc.componentId)
  const params = paramsFor(component.schema, doc.params[doc.componentId])

  const setParam = (key: string, value: ParamValue): void => {
    onChange({
      params: { ...doc.params, [doc.componentId]: { ...params, [key]: value } }
    })
  }

  const resetParams = (): void => {
    const next = { ...doc.params }
    delete next[doc.componentId as ComponentId]
    onChange({ params: next })
  }

  return (
    <div className="flex flex-col gap-1.5 p-2">
      <Section
        title={component.label}
        defaultOpen
        onReset={resetParams}
        right={
          <button
            type="button"
            role="switch"
            aria-checked={doc.componentEnabled}
            aria-label="Show the arrangement"
            onClick={() => onChange({ componentEnabled: !doc.componentEnabled })}
            className={`relative h-4 w-7 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${doc.componentEnabled ? 'bg-text-primary' : 'bg-raised'}`}
          >
            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-bg transition-transform ${doc.componentEnabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
          </button>
        }
      >
        {/* The first handful of parameters are the ones that change the
            shape of the thing. The rest are refinements, and showing
            seventeen sliders at once makes the first five harder to find. */}
        {component.schema.slice(0, PRIMARY_PARAMS).map((spec) => (
          <ParamControl key={spec.key} spec={spec} value={params[spec.key]} onChange={(v) => setParam(spec.key, v)} />
        ))}
        {component.schema.length > PRIMARY_PARAMS ? (
          <Disclosure label={`${component.schema.length - PRIMARY_PARAMS} more settings`}>
            {component.schema.slice(PRIMARY_PARAMS).map((spec) => (
              <ParamControl key={spec.key} spec={spec} value={params[spec.key]} onChange={(v) => setParam(spec.key, v)} />
            ))}
          </Disclosure>
        ) : null}
      </Section>

      <Section title="Pose" onReset={() => onChange({ pose: { tiltX: 12, tiltY: 0, tiltZ: 0 } })}>
        <PosePad pose={doc.pose} onChange={(pose) => onChange({ pose })} />
      </Section>

      <Section title="Card tilt" defaultOpen={false} onReset={() => onChange({ cardTilt: { tiltX: 0, tiltY: 0, tiltZ: 0, stagger: false } })}>
        <SliderRow label="Tilt X" value={doc.cardTilt.tiltX} min={-90} max={90} step={1} onChange={(v) => onChange({ cardTilt: { ...doc.cardTilt, tiltX: v } })} />
        <SliderRow label="Tilt Y" value={doc.cardTilt.tiltY} min={-90} max={90} step={1} onChange={(v) => onChange({ cardTilt: { ...doc.cardTilt, tiltY: v } })} />
        <SliderRow label="Tilt Z" value={doc.cardTilt.tiltZ} min={-90} max={90} step={1} onChange={(v) => onChange({ cardTilt: { ...doc.cardTilt, tiltZ: v } })} />
        <ToggleRow
          label="Build up along the run"
          hint="Leans the first card least and the last card most, instead of tilting them all the same."
          value={doc.cardTilt.stagger}
          onChange={(v) => onChange({ cardTilt: { ...doc.cardTilt, stagger: v } })}
        />
      </Section>

      <Section title="Displacement" defaultOpen={false} onReset={() => onChange({
        displacement: { displaceZ: 0, displaceY: 0, speed: 1, offset: 0.4, freeOrbit: 0, panX: 0, panZ: 0, panSpeed: 1 }
      })}>
        <SliderRow label="Drift up and down" value={doc.displacement.displaceY} min={-6} max={6} step={0.1} onChange={(v) => onChange({ displacement: { ...doc.displacement, displaceY: v } })} />
        <SliderRow label="Drift near and far" value={doc.displacement.displaceZ} min={-6} max={6} step={0.1} onChange={(v) => onChange({ displacement: { ...doc.displacement, displaceZ: v } })} />
        <SliderRow label="Drift speed" value={doc.displacement.speed} min={1} max={6} step={1} onChange={(v) => onChange({ displacement: { ...doc.displacement, speed: v } })} />
        <SliderRow label="Drift offset" value={doc.displacement.offset} min={0} max={1} step={0.01} onChange={(v) => onChange({ displacement: { ...doc.displacement, offset: v } })} />
        <SliderRow label="Turns per loop" value={doc.displacement.freeOrbit} min={-3} max={3} step={1} onChange={(v) => onChange({ displacement: { ...doc.displacement, freeOrbit: v } })} />
        <SliderRow label="Pan sideways" value={doc.displacement.panX} min={-8} max={8} step={0.1} onChange={(v) => onChange({ displacement: { ...doc.displacement, panX: v } })} />
        <SliderRow label="Pan in and out" value={doc.displacement.panZ} min={-8} max={8} step={0.1} onChange={(v) => onChange({ displacement: { ...doc.displacement, panZ: v } })} />
        <SliderRow label="Pan speed" value={doc.displacement.panSpeed} min={1} max={6} step={1} onChange={(v) => onChange({ displacement: { ...doc.displacement, panSpeed: v } })} />
      </Section>

      <Section title="Transform" defaultOpen={false} onReset={() => onChange({ transform: { positionX: 0, positionY: 0, scale: 1 } })}>
        <SliderRow label="Move across" value={doc.transform.positionX} min={-8} max={8} step={0.1} onChange={(v) => onChange({ transform: { ...doc.transform, positionX: v } })} />
        <SliderRow label="Move up" value={doc.transform.positionY} min={-8} max={8} step={0.1} onChange={(v) => onChange({ transform: { ...doc.transform, positionY: v } })} />
        <SliderRow label="Size" value={doc.transform.scale} min={0.1} max={3} step={0.01} onChange={(v) => onChange({ transform: { ...doc.transform, scale: v } })} />
      </Section>

      <Section title="Easing" defaultOpen={false} onReset={() => onChange({ easing: { x1: 0.25, y1: 0, x2: 0, y2: 1 } })}>
        <ToggleRow label="Animate" value={doc.animationEnabled} onChange={(v) => onChange({ animationEnabled: v })} />
        <EasingEditor easing={doc.easing} onChange={(easing) => onChange({ easing })} />
      </Section>
    </div>
  )
}

function ParamControl({
  spec, value, onChange
}: { spec: ParamSpec; value: ParamValue; onChange: (v: ParamValue) => void }): React.JSX.Element {
  if (spec.kind === 'slider') {
    return (
      <SliderRow
        label={spec.label}
        value={typeof value === 'number' ? value : spec.default}
        min={spec.min}
        max={spec.max}
        step={spec.step}
        unit={spec.unit}
        onChange={onChange}
      />
    )
  }
  if (spec.kind === 'toggle') {
    return <ToggleRow label={spec.label} value={typeof value === 'boolean' ? value : spec.default} onChange={onChange} />
  }
  return (
    <SegmentedRow
      label={spec.label}
      value={typeof value === 'string' ? value : spec.default}
      options={spec.options}
      onChange={onChange}
    />
  )
}

export function VisualPanel({
  doc, onChange, onImportImages, busy
}: {
  doc: MotionDoc
  onChange: (patch: Partial<MotionDoc>) => void
  onImportImages: () => void
  busy: boolean
}): React.JSX.Element {
  const card = doc.visual.card
  const setCard = (patch: Partial<CardStyle>): void =>
    onChange({ visual: { ...doc.visual, card: { ...card, ...patch } } })

  return (
    <div className="flex flex-col gap-1.5 p-2">
      <ImagesPanel doc={doc} onChange={onChange} onImportImages={onImportImages} busy={busy} />

      <Section title="Card">
        <SegmentedRow
          label="Shape"
          value={card.aspect}
          options={[
            { value: '1:1', label: '1:1' }, { value: '4:5', label: '4:5' }, { value: '4:6', label: '4:6' },
            { value: '9:16', label: '9:16' }, { value: '4:3', label: '4:3' }, { value: '16:9', label: '16:9' }
          ]}
          onChange={(v) => setCard({ aspect: v })}
        />
        <SliderRow label="Corners" value={card.corner} min={0} max={50} step={1} onChange={(v) => setCard({ corner: v })} />
        <ToggleRow label="Shade the edges" value={card.gradient} onChange={(v) => setCard({ gradient: v })} />
        {card.gradient ? (
          <>
            <SliderRow label="Shading strength" value={card.gradientOpacity} min={0} max={100} step={1} onChange={(v) => setCard({ gradientOpacity: v })} />
            <SegmentedRow
              label="Applies to"
              value={card.gradientSide}
              options={[{ value: 'front', label: 'Front' }, { value: 'back', label: 'Back' }, { value: 'both', label: 'Both' }]}
              onChange={(v) => setCard({ gradientSide: v })}
            />
          </>
        ) : null}
        <SliderRow label="Back of card" value={card.backOpacity} min={0} max={100} step={1} onChange={(v) => setCard({ backOpacity: v })} />
      </Section>

      <Section title="Text" defaultOpen={false}>
        <button
          type="button"
          onClick={() => onChange({
            visual: {
              ...doc.visual,
              text: [...doc.visual.text, {
                id: `t${Date.now().toString(36)}`,
                text: 'Title',
                size: 8,
                colour: '#f4f4f2',
                x: 50,
                y: 50
              }]
            }
          })}
          className="rounded-sm bg-raised px-2 py-1.5 text-[11.5px] text-text-primary hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Add text
        </button>
        {doc.visual.text.map((layer, i) => {
          const setLayer = (patch: Partial<typeof layer>): void => onChange({
            visual: {
              ...doc.visual,
              text: doc.visual.text.map((l, j) => (j === i ? { ...l, ...patch } : l))
            }
          })
          return (
            <div key={layer.id} className="flex flex-col gap-2 rounded-md bg-sunken p-2">
              <div className="flex items-center gap-1">
                <input
                  value={layer.text}
                  onChange={(e) => setLayer({ text: e.target.value })}
                  aria-label={`Text layer ${i + 1}`}
                  className="min-w-0 flex-1 rounded-sm bg-bg px-1.5 py-1 text-[11.5px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                />
                <button
                  type="button"
                  onClick={() => onChange({ visual: { ...doc.visual, text: doc.visual.text.filter((_, j) => j !== i) } })}
                  aria-label={`Remove text layer ${i + 1}`}
                  className="rounded-sm px-1.5 py-1 text-[10.5px] text-text-muted hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  ×
                </button>
              </div>
              <SliderRow label="Size" value={layer.size} min={1} max={40} step={0.5} onChange={(v) => setLayer({ size: v })} />
              <SliderRow label="Across" value={layer.x} min={0} max={100} step={0.5} onChange={(v) => setLayer({ x: v })} />
              <SliderRow label="Down" value={layer.y} min={0} max={100} step={0.5} onChange={(v) => setLayer({ y: v })} />
              <ColorRow label="Colour" value={layer.colour} onChange={(v) => setLayer({ colour: v })} />
            </div>
          )
        })}
      </Section>

      <LogoSection doc={doc} onChange={onChange} />

      <EffectsSection doc={doc} onChange={onChange} />

    </div>
  )
}
