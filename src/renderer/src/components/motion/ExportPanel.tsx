// Export.
//
// The panel states plainly what it can and cannot do. GIF appears in the
// document format list for future use but is not offered here, because nothing
// in a browser can encode one without a bundled encoder — offering it and then
// quietly producing a WebM named .gif would be worse than not offering it.

import { useState } from 'react'
import type { EntranceSpec, MotionDoc } from '../../../../shared/motion/types'
import { ENTRANCE_SHAPES } from '../../../../shared/motion/entrance'
import { SegmentedRow, Section, SliderRow, ToggleRow } from './controls'
import { supportedVideoMime } from '../../lib/motion/exporter'

export function ExportPanel({
  doc, onChange, onExportStill, onExportVideo, progress, busy
}: {
  doc: MotionDoc
  onChange: (patch: Partial<MotionDoc>) => void
  onExportStill: () => void
  onExportVideo: () => void
  progress: { done: number; total: number; label: string } | null
  busy: boolean
}): React.JSX.Element {
  const [support] = useState(() => supportedVideoMime())

  const anim = doc.animation
  const setSpec = (key: 'componentIn' | 'componentOut' | 'textIn' | 'textOut') =>
    (p: Partial<EntranceSpec>): void =>
      onChange({ animation: { ...anim, [key]: { ...anim[key], ...p } } })

  return (
    <div className="flex flex-col">
      <Section title="Animation">
        <p className="text-[11px] leading-relaxed text-text-muted">
          A component turns on its own for as long as you watch it. These are
          the moves it makes once, on the way in and on the way out.
        </p>
        <EntranceRows label="Component in" spec={anim.componentIn} onChange={setSpec('componentIn')} />
        <EntranceRows label="Component out" spec={anim.componentOut} onChange={setSpec('componentOut')} />
        <EntranceRows label="Text and logo in" spec={anim.textIn} onChange={setSpec('textIn')} />
        <EntranceRows label="Text and logo out" spec={anim.textOut} onChange={setSpec('textOut')} />
        <SliderRow
          label="Replay every"
          value={anim.replayEvery}
          min={1}
          max={20}
          step={0.5}
          onChange={(v) => onChange({ animation: { ...anim, replayEvery: v } })}
        />
      </Section>

      <Section title="Still">
        <SegmentedRow
          label="Format"
          value={doc.export.stillFormat}
          options={[{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPEG' }]}
          onChange={(v) => onChange({ export: { ...doc.export, stillFormat: v } })}
        />
        <SegmentedRow
          label="Size"
          value={String(doc.export.stillScale)}
          options={[
            { value: '1', label: '1×' }, { value: '2', label: '2×' },
            { value: '3', label: '3×' }, { value: '4', label: '4×' }
          ]}
          onChange={(v) => onChange({ export: { ...doc.export, stillScale: Number(v) as 1 | 2 | 3 | 4 } })}
        />
        <ToggleRow
          label="Transparent background"
          hint="Saves as PNG whatever the format above says, because JPEG cannot hold transparency."
          value={doc.export.transparentBackground}
          onChange={(v) => onChange({ export: { ...doc.export, transparentBackground: v } })}
        />
        <button
          type="button"
          onClick={onExportStill}
          disabled={busy}
          className="rounded-sm bg-raised px-2 py-1.5 text-[11.5px] text-text-primary hover:bg-elevated disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Save this frame
        </button>
      </Section>

      <Section title="Video">
        <SegmentedRow
          label="Height"
          value={String(doc.export.resolution)}
          options={[
            { value: '720', label: '720' }, { value: '1080', label: '1080' },
            { value: '1440', label: '1440' }, { value: '2160', label: '4K' }
          ]}
          onChange={(v) => onChange({ export: { ...doc.export, resolution: Number(v) as MotionDoc['export']['resolution'] } })}
        />
        <SegmentedRow
          label="Frames per second"
          value={String(doc.export.fps)}
          options={[{ value: '24', label: '24' }, { value: '30', label: '30' }, { value: '60', label: '60' }]}
          onChange={(v) => onChange({ export: { ...doc.export, fps: Number(v) as 24 | 30 | 60 } })}
        />
        <SliderRow
          label="Loop length in seconds"
          value={doc.export.durationSec}
          min={1}
          max={20}
          step={0.5}
          onChange={(v) => onChange({ export: { ...doc.export, durationSec: v } })}
        />
        {support ? (
          <button
            type="button"
            onClick={onExportVideo}
            disabled={busy}
            className="rounded-sm bg-accent px-2 py-1.5 text-[11.5px] text-accent-text hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {busy ? 'Rendering…' : `Export ${support.ext.toUpperCase()}`}
          </button>
        ) : (
          <p className="text-[11px] text-warning" role="status">
            This build has no video encoder, so only stills can be saved.
          </p>
        )}
        {progress ? (
          <div className="flex flex-col gap-1" role="status" aria-live="polite">
            <div className="h-1 overflow-hidden rounded-full bg-sunken">
              <div
                className="h-full bg-accent transition-[width]"
                style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }}
              />
            </div>
            <p className="text-[10.5px] text-text-muted">
              {progress.label} frame {progress.done} of {progress.total}
            </p>
          </div>
        ) : (
          <p className="text-[10.5px] text-text-muted">
            Every frame is drawn at an exact point in the loop, so the video ends where it began.
          </p>
        )}
      </Section>
    </div>
  )
}

/**
 * One entrance, on a disclosure.
 *
 * The switch is the row, and the settings only appear once it is on, because
 * four entrances each with four controls would be twenty rows of panel for a
 * piece that in most cases uses none of them.
 */
function EntranceRows({
  label, spec, onChange
}: {
  label: string
  spec: EntranceSpec
  onChange: (p: Partial<EntranceSpec>) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 border-t border-border/50 pt-2 first:border-t-0">
      <ToggleRow label={label} value={spec.enabled} onChange={(v) => onChange({ enabled: v })} />
      {spec.enabled ? (
        <>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Shape">
            {ENTRANCE_SHAPES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={spec.shape === s.id}
                onClick={() => onChange({ shape: s.id })}
                className={`rounded-sm px-2 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                  spec.shape === s.id ? 'bg-accent/15 text-accent' : 'bg-sunken text-text-secondary hover:text-text-primary'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <SliderRow label="Time" value={spec.duration} min={0.1} max={4} step={0.05} onChange={(v) => onChange({ duration: v })} />
          <SliderRow label="Stagger" value={spec.stagger} min={0} max={0.5} step={0.01} onChange={(v) => onChange({ stagger: v })} />
        </>
      ) : null}
    </div>
  )
}
