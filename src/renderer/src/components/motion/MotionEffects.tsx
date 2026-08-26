// Effects: treatments over the finished frame.
//
// Everything here applies to the whole picture rather than to any one card,
// which is why it lives beside the frame's own settings and not with the card
// shape. The section is a plain list of neutral-at-default numbers, so a piece
// made before effects existed opens looking exactly the same.

import type { EffectsState, MotionDoc } from '../../../../shared/motion/types'
import { defaultEffects } from '../../../../shared/motion/defaults'
import { ColorRow, SegmentedRow, Section, SliderRow } from './controls'
import { AngleDial, EdgeRows, FalloffRow, FxGroup } from './effectsControls'

export function EffectsSection({
  doc, onChange
}: {
  doc: MotionDoc
  onChange: (patch: Partial<MotionDoc>) => void
}): React.JSX.Element {
  const fx = doc.visual.effects
  const set = (patch: Partial<EffectsState>): void =>
    onChange({ visual: { ...doc.visual, effects: { ...fx, ...patch } } })

  return (
    <Section
      title="Effects"
      defaultOpen={false}
      onReset={() => onChange({ visual: { ...doc.visual, effects: defaultEffects() } })}
    >
      <SliderRow label="Blur" value={fx.blur} min={0} max={40} step={0.5} onChange={(v) => set({ blur: v })} />
      <SliderRow label="Grain" value={fx.grain} min={0} max={100} step={1} onChange={(v) => set({ grain: v })} />
      <SliderRow label="Vignette" value={fx.vignette} min={0} max={100} step={1} onChange={(v) => set({ vignette: v })} />
      <SliderRow label="Edge shadow" value={fx.shadow} min={0} max={100} step={1} onChange={(v) => set({ shadow: v })} />
      <SliderRow label="Brightness" value={fx.brightness} min={0} max={200} step={1} onChange={(v) => set({ brightness: v })} />
      <SliderRow label="Contrast" value={fx.contrast} min={0} max={200} step={1} onChange={(v) => set({ contrast: v })} />
      <SliderRow label="Saturation" value={fx.saturation} min={0} max={200} step={1} onChange={(v) => set({ saturation: v })} />
      <ColorRow label="Tint" value={fx.tint} onChange={(v) => set({ tint: v })} />
      <SliderRow label="Tint amount" value={fx.tintAmount} min={0} max={100} step={1} onChange={(v) => set({ tintAmount: v })} />

      {/* Everything above is a number over the finished picture. Everything
          below needs to know where the cards are or what is already drawn
          underneath, which is a different kind of thing and costs a different
          amount, so it is kept apart and off by default. */}
      <FxGroup label="Shadow" enabled={fx.dropShadow.enabled} onEnabled={(v) => set({ dropShadow: { ...fx.dropShadow, enabled: v } })}>
        <AngleDial label="Angle" value={fx.dropShadow.angle} onChange={(v) => set({ dropShadow: { ...fx.dropShadow, angle: v } })} />
        <SliderRow label="Distance" value={fx.dropShadow.distance} min={0} max={50} step={0.5} onChange={(v) => set({ dropShadow: { ...fx.dropShadow, distance: v } })} />
        <SliderRow label="Blur" value={fx.dropShadow.blur} min={0} max={50} step={0.5} onChange={(v) => set({ dropShadow: { ...fx.dropShadow, blur: v } })} />
        <SliderRow label="Density" value={fx.dropShadow.density} min={0} max={100} step={1} onChange={(v) => set({ dropShadow: { ...fx.dropShadow, density: v } })} />
        <ColorRow label="Colour" value={fx.dropShadow.colour} onChange={(v) => set({ dropShadow: { ...fx.dropShadow, colour: v } })} />
      </FxGroup>

      <FxGroup label="Edge blur" enabled={fx.edgeBlur.enabled} onEnabled={(v) => set({ edgeBlur: { ...fx.edgeBlur, enabled: v } })}>
        <SliderRow label="Amount" value={fx.edgeBlur.amount} min={0} max={30} step={0.5} onChange={(v) => set({ edgeBlur: { ...fx.edgeBlur, amount: v } })} />
        <EdgeRows value={fx.edgeBlur.edges} onChange={(v) => set({ edgeBlur: { ...fx.edgeBlur, edges: v } })} />
        <FalloffRow value={fx.edgeBlur.falloff} onChange={(v) => set({ edgeBlur: { ...fx.edgeBlur, falloff: v } })} />
        <SliderRow label="Softness" value={fx.edgeBlur.softness} min={0} max={100} step={1} onChange={(v) => set({ edgeBlur: { ...fx.edgeBlur, softness: v } })} />
        <SegmentedRow
          label="Over"
          value={fx.edgeBlur.over}
          options={[{ value: 'component', label: 'Component' }, { value: 'everything', label: 'Everything' }]}
          onChange={(v) => set({ edgeBlur: { ...fx.edgeBlur, over: v } })}
        />
      </FxGroup>

      <FxGroup label="Edge shade" enabled={fx.edgeShade.enabled} onEnabled={(v) => set({ edgeShade: { ...fx.edgeShade, enabled: v } })}>
        <SegmentedRow
          label="Mode"
          value={fx.edgeShade.mode}
          options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]}
          onChange={(v) => set({ edgeShade: { ...fx.edgeShade, mode: v } })}
        />
        <ColorRow label="Colour" value={fx.edgeShade.colour} onChange={(v) => set({ edgeShade: { ...fx.edgeShade, colour: v } })} />
        <EdgeRows value={fx.edgeShade.edges} onChange={(v) => set({ edgeShade: { ...fx.edgeShade, edges: v } })} />
        <FalloffRow value={fx.edgeShade.falloff} onChange={(v) => set({ edgeShade: { ...fx.edgeShade, falloff: v } })} />
        <SliderRow label="Softness" value={fx.edgeShade.softness} min={0} max={100} step={1} onChange={(v) => set({ edgeShade: { ...fx.edgeShade, softness: v } })} />
        <SegmentedRow
          label="Over"
          value={fx.edgeShade.over}
          options={[{ value: 'component', label: 'Component' }, { value: 'everything', label: 'Everything' }]}
          onChange={(v) => set({ edgeShade: { ...fx.edgeShade, over: v } })}
        />
      </FxGroup>

      <FxGroup label="Glass" enabled={fx.glass.enabled} onEnabled={(v) => set({ glass: { ...fx.glass, enabled: v } })}>
        <SegmentedRow
          label="Edges"
          value={fx.glass.edges}
          options={[{ value: 'all', label: 'All' }, { value: 'per-edge', label: 'Per edge' }]}
          onChange={(v) => set({ glass: { ...fx.glass, edges: v } })}
        />
        {fx.glass.edges === 'all' ? (
          <SliderRow label="Width" value={fx.glass.width} min={0} max={40} step={0.5} onChange={(v) => set({ glass: { ...fx.glass, width: v } })} />
        ) : (
          <EdgeRows value={fx.glass.per} onChange={(v) => set({ glass: { ...fx.glass, per: v } })} />
        )}
        <SliderRow label="Refraction" value={fx.glass.refraction} min={0} max={100} step={1} onChange={(v) => set({ glass: { ...fx.glass, refraction: v } })} />
        <SliderRow label="Curve" value={fx.glass.curve} min={1} max={4} step={0.1} onChange={(v) => set({ glass: { ...fx.glass, curve: v } })} />
      </FxGroup>
    </Section>
  )
}
