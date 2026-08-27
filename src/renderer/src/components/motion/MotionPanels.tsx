// The right-hand panels.
//
// Two columns of settings in one scroll: what the arrangement does, and what
// it looks like. The component's own parameters are rendered straight from its
// schema, so the panel has no knowledge of any particular component — adding a
// slider to the carousel does not mean editing this file.

import type {
  CardStyle, ComponentId, MotionDoc, ParamSpec, ParamValue
} from '../../../../shared/motion/types'
import { useCallback } from 'react'
import type { Pick } from '../../lib/motion/overlayPick'
import { componentFor } from '../../../../shared/motion/registry'
import { emptyDoc, paramsFor } from '../../../../shared/motion/defaults'
import { paramAffectsCount } from '../../../../shared/motion/frame'
import { makeKeyer, type Keyer } from '../../lib/motion/keying'
import { ColorRow, Disclosure, SegmentedRow, SelectRow, Section, SliderRow, ToggleRow } from './controls'
import { FONTS, WEIGHTS } from '../../lib/freeformTypes'
import { TEXT_DEFAULTS, type TextAlign } from '../../../../shared/motion/types'
import { ImagesPanel } from './MotionImages'
import { BrandSection } from './MotionBrand'
import { LogoSection } from './MotionLogos'
import { EffectsSection } from './MotionEffects'
import { PosePad } from './PosePad'
import { EasingEditor } from './EasingEditor'

/** How many of a component's parameters are shown before the fold. */
const PRIMARY_PARAMS = 5

export function ParamsPanel({
  doc, onChange, phase
}: {
  doc: MotionDoc
  onChange: (patch: Partial<MotionDoc>) => void
  phase: number
}): React.JSX.Element {
  const component = componentFor(doc.componentId)
  const params = paramsFor(component.schema, doc.params[doc.componentId])
  const keyer = makeKeyer(doc, phase, onChange)
  const wave = doc.displacement.wave
  const setWave = (patch: Partial<typeof wave>): void =>
    onChange({ displacement: { ...doc.displacement, wave: { ...wave, ...patch } } })

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
            <span className={`absolute left-0 top-0.5 h-3 w-3 rounded-full bg-bg transition-transform ${doc.componentEnabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
          </button>
        }
      >
        {/* The first handful of parameters are the ones that change the
            shape of the thing. The rest are refinements, and showing
            seventeen sliders at once makes the first five harder to find. */}
        {component.schema.slice(0, PRIMARY_PARAMS).map((spec) => (
          <ParamControl key={spec.key} spec={spec} value={params[spec.key]} onChange={(v) => setParam(spec.key, v)} keyer={keyer} params={params} component={component} />
        ))}
        {component.schema.length > PRIMARY_PARAMS ? (
          <Disclosure label={`${component.schema.length - PRIMARY_PARAMS} more settings`}>
            {component.schema.slice(PRIMARY_PARAMS).map((spec) => (
              <ParamControl key={spec.key} spec={spec} value={params[spec.key]} onChange={(v) => setParam(spec.key, v)} keyer={keyer} params={params} component={component} />
            ))}
          </Disclosure>
        ) : null}
      </Section>

      <Section title="Pose" onReset={() => onChange({ pose: { tiltX: 12, tiltY: 0, tiltZ: 0 } })}>
        <PosePad pose={doc.pose} onChange={(pose) => onChange({ pose })} keyer={keyer} />
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
        displacement: emptyDoc(doc.componentId).displacement
      })}>
        <SliderRow label="Drift up and down" value={doc.displacement.displaceY} min={-6} max={6} step={0.1} onChange={(v) => onChange({ displacement: { ...doc.displacement, displaceY: v } })} />
        <SliderRow label="Drift near and far" value={doc.displacement.displaceZ} min={-6} max={6} step={0.1} onChange={(v) => onChange({ displacement: { ...doc.displacement, displaceZ: v } })} />
        <SliderRow label="Drift speed" value={doc.displacement.speed} min={1} max={6} step={1} onChange={(v) => onChange({ displacement: { ...doc.displacement, speed: v } })} />
        <SliderRow label="Drift offset" value={doc.displacement.offset} min={0} max={1} step={0.01} onChange={(v) => onChange({ displacement: { ...doc.displacement, offset: v } })} />
        <SliderRow label="Turns per loop" value={doc.displacement.freeOrbit} min={-3} max={3} step={1} onChange={(v) => onChange({ displacement: { ...doc.displacement, freeOrbit: v } })} />
        <SliderRow label="Pan sideways" value={doc.displacement.panX} min={-8} max={8} step={0.1} onChange={(v) => onChange({ displacement: { ...doc.displacement, panX: v } })} />
        <SliderRow label="Pan in and out" value={doc.displacement.panZ} min={-8} max={8} step={0.1} onChange={(v) => onChange({ displacement: { ...doc.displacement, panZ: v } })} />
        <SliderRow label="Pan speed" value={doc.displacement.panSpeed} min={1} max={6} step={1} onChange={(v) => onChange({ displacement: { ...doc.displacement, panSpeed: v } })} />

        {/* Drift and pan move the whole arrangement together. A wave moves
            each card by a different amount, which is what makes a row of
            them read as travelling rather than sliding. */}
        <Disclosure label="Wave">
          <SliderRow label="Depth" value={wave.depth} min={-20} max={20} step={0.1} onChange={(v) => setWave({ depth: v })} />
          <SliderRow label="Frequency" value={wave.frequency} min={0} max={12} step={0.1} onChange={(v) => setWave({ frequency: v })} />
          <SliderRow label="Passes per loop" value={wave.speed} min={0} max={8} step={1} onChange={(v) => setWave({ speed: v })} />
          <SegmentedRow
            label="Style"
            value={wave.style}
            options={[{ value: 'wave', label: 'Wave' }, { value: 'ripple', label: 'Ripple' }]}
            onChange={(v) => setWave({ style: v })}
          />
          {wave.style === 'wave' ? (
            <SegmentedRow
              label="Direction"
              value={wave.direction}
              options={[{ value: 'horizontal', label: 'Horizontal' }, { value: 'vertical', label: 'Vertical' }]}
              onChange={(v) => setWave({ direction: v })}
            />
          ) : null}
        </Disclosure>
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
  spec, value, onChange, keyer, params, component
}: {
  spec: ParamSpec
  value: ParamValue
  onChange: (v: ParamValue) => void
  keyer?: Keyer
  params?: Record<string, ParamValue>
  component?: { cardCount: (p: Record<string, ParamValue>) => number }
}): React.JSX.Element {
  if (spec.kind === 'slider') {
    const v = typeof value === 'number' ? value : spec.default
    // A count that changed over the loop would mean cards appearing and
    // vanishing at the seam, so those sliders are not offered a diamond at
    // all — refusing here is kinder than accepting the key and ignoring it.
    const keyable =
      keyer !== undefined &&
      params !== undefined &&
      component !== undefined &&
      !paramAffectsCount(component, params, spec.key)
    return (
      <SliderRow
        label={spec.label}
        value={v}
        min={spec.min}
        max={spec.max}
        step={spec.step}
        unit={spec.unit}
        onChange={onChange}
        keyframe={keyable ? keyer(`param:${spec.key}`, v) : undefined}
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
  doc, onChange, onImportImages, busy, phase, selected = null, onSelect
}: {
  doc: MotionDoc
  onChange: (patch: Partial<MotionDoc>) => void
  onImportImages: () => void
  busy: boolean
  phase: number
  /** What is picked on the frame, so its editor can show itself. */
  selected?: Pick | null
  onSelect?: (pick: Pick | null) => void
}): React.JSX.Element {
  const keyer = makeKeyer(doc, phase, onChange)
  // A callback ref rather than an effect: the node it wants is the one that
  // just became the selected layer, and asking for it as it mounts is the
  // only moment we are certain which node that is.
  //
  // Only the panel's own scroller is moved. `scrollIntoView` would walk every
  // scrollable ancestor and drag the whole workspace along with it.
  const revealRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    let box: HTMLElement | null = el.parentElement
    while (box && box.scrollHeight <= box.clientHeight) box = box.parentElement
    if (!box) return
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
    if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: top - 8, behavior: 'smooth' })
    }
  }, [])
  const card = doc.visual.card
  const setCard = (patch: Partial<CardStyle>): void =>
    onChange({ visual: { ...doc.visual, card: { ...card, ...patch } } })

  return (
    <div className="flex flex-col gap-1.5 p-2">
      <BrandSection />

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
        <SliderRow label="Outline" value={card.borderWidth ?? 0} min={0} max={4} step={0.1} onChange={(v) => setCard({ borderWidth: v })} />
        {(card.borderWidth ?? 0) > 0 ? (
          <>
            <ColorRow label="Outline colour" value={card.borderColour ?? '#ffffff'} onChange={(v) => setCard({ borderColour: v })} />
            <SliderRow label="Outline opacity" value={card.borderOpacity ?? 100} min={0} max={100} step={1} onChange={(v) => setCard({ borderOpacity: v })} />
          </>
        ) : null}
      </Section>

      <Section title="Text" defaultOpen={false} reveal={selected?.kind === 'text'}>
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
          const isPicked = selected?.kind === 'text' && selected.id === layer.id
          return (
            <div
              key={layer.id}
              ref={isPicked ? revealRef : undefined}
              onPointerDownCapture={() => onSelect?.({ kind: 'text', id: layer.id })}
              className={`flex flex-col gap-2 rounded-md bg-sunken p-2 ${isPicked ? 'ring-1 ring-accent/60' : ''}`}
            >
              <div className="flex items-center gap-1">
                <textarea
                  value={layer.text}
                  onChange={(e) => setLayer({ text: e.target.value })}
                  aria-label={`Text layer ${i + 1}`}
                  rows={1}
                  spellCheck={false}
                  className="min-w-0 flex-1 resize-y rounded-sm bg-bg px-1.5 py-1 text-[11.5px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
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
              <SliderRow label="Size" value={layer.size} min={1} max={40} step={0.5} onChange={(v) => setLayer({ size: v })} keyframe={keyer(`text:${layer.id}:size`, layer.size)} />
              <SelectRow
                label="Font"
                value={layer.font ?? TEXT_DEFAULTS.font}
                options={FONTS.map((f) => ({ value: f.label, label: f.label }))}
                onChange={(v) => setLayer({ font: v })}
              />
              <SelectRow
                label="Weight"
                value={layer.weight ?? TEXT_DEFAULTS.weight}
                options={WEIGHTS.map((w) => ({ value: w.value, label: w.label }))}
                onChange={(v) => setLayer({ weight: v })}
              />
              <ColorRow label="Colour" value={layer.colour} onChange={(v) => setLayer({ colour: v })} />
              <SliderRow label="Across" value={layer.x} min={0} max={100} step={0.5} onChange={(v) => setLayer({ x: v })} keyframe={keyer(`text:${layer.id}:x`, layer.x)} />
              <SliderRow label="Down" value={layer.y} min={0} max={100} step={0.5} onChange={(v) => setLayer({ y: v })} keyframe={keyer(`text:${layer.id}:y`, layer.y)} />
              {/* The refinements fold away: most layers only ever need a size,
                  a face and a place to sit. */}
              <Disclosure label="More type">
                <SegmentedRow<TextAlign>
                  label="Align"
                  value={layer.align ?? TEXT_DEFAULTS.align}
                  options={[
                    { value: 'left', label: 'Left' },
                    { value: 'center', label: 'Centre' },
                    { value: 'right', label: 'Right' }
                  ]}
                  onChange={(v) => setLayer({ align: v })}
                />
                <SliderRow
                  label="Tracking"
                  value={layer.tracking ?? TEXT_DEFAULTS.tracking}
                  min={-10} max={40} step={0.5}
                  onChange={(v) => setLayer({ tracking: v })}
                  keyframe={keyer(`text:${layer.id}:tracking`, layer.tracking ?? TEXT_DEFAULTS.tracking)}
                />
                <SliderRow
                  label="Line height"
                  value={layer.lineHeight ?? TEXT_DEFAULTS.lineHeight}
                  min={0.7} max={2.5} step={0.05}
                  onChange={(v) => setLayer({ lineHeight: v })}
                />
                <SliderRow
                  label="Opacity"
                  value={layer.opacity ?? TEXT_DEFAULTS.opacity}
                  min={0} max={100} step={1}
                  onChange={(v) => setLayer({ opacity: v })}
                  keyframe={keyer(`text:${layer.id}:opacity`, layer.opacity ?? TEXT_DEFAULTS.opacity)}
                />
                <ToggleRow label="Italic" value={layer.italic ?? TEXT_DEFAULTS.italic} onChange={(v) => setLayer({ italic: v })} />
                <ToggleRow label="Underline" value={layer.underline ?? TEXT_DEFAULTS.underline} onChange={(v) => setLayer({ underline: v })} />
                <ToggleRow label="Capitals" value={layer.caps ?? TEXT_DEFAULTS.caps} onChange={(v) => setLayer({ caps: v })} />
              </Disclosure>
            </div>
          )
        })}
      </Section>

      <LogoSection doc={doc} onChange={onChange} keyer={keyer} selected={selected} onSelect={onSelect} />

      <EffectsSection doc={doc} onChange={onChange} keyer={keyer} />

    </div>
  )
}
