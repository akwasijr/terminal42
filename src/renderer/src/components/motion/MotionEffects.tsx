// Effects: treatments over the finished frame.
//
// Everything here applies to the whole picture rather than to any one card,
// which is why it lives beside the frame's own settings and not with the card
// shape. The section is a plain list of neutral-at-default numbers, so a piece
// made before effects existed opens looking exactly the same.

import type { EffectsState, MotionDoc } from '../../../../shared/motion/types'
import { defaultEffects } from '../../../../shared/motion/defaults'
import { ColorRow, Section, SliderRow } from './controls'

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
    </Section>
  )
}
