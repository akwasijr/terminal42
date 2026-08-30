import React, { useState } from 'react'
import { CardMenu } from '../CardMenu'
import { FEEL_PRESETS, type Vibe } from '../../lib/designSystem'
import { CORNER_PX } from '../../lib/tokenPresets'
import { ramp } from '../../../../shared/tokens/scaffold'

/**
 * Token libraries you can start from.
 *
 * Building one from scratch means answering ten questions, which is the right
 * flow when you know what you want and the wrong one when you are still
 * deciding. These are the same nine feels the wizard offers, already built
 * out, so you can take one and look at it rather than imagine it.
 *
 * Like every template in this app they can be copied but not deleted: they
 * belong to the tool, not to the project.
 */

const ORDER: Vibe[] = [
  'minimal', 'professional', 'bold', 'playful', 'soft',
  'elegant', 'brutalist', 'technical', 'luxe'
]

export function TokenTemplates({
  onUse,
  onDuplicate
}: {
  /** Open the wizard already set to this feel, so the questions start answered. */
  onUse: (vibe: Vibe) => void
  /** Take the library as it stands. Returns the reason it failed, or null. */
  onDuplicate: (vibe: Vibe) => Promise<string | null>
}): React.JSX.Element {
  const [copying, setCopying] = useState<Vibe | null>(null)
  const [failed, setFailed] = useState<{ vibe: Vibe; reason: string } | null>(null)

  const duplicate = async (vibe: Vibe): Promise<void> => {
    if (copying) return
    setCopying(vibe)
    setFailed(null)
    const reason = await onDuplicate(vibe)
    setCopying(null)
    if (reason) setFailed({ vibe, reason })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {ORDER.map((vibe) => {
        const p = FEEL_PRESETS[vibe]
        return (
          <div
            key={vibe}
            className="group relative flex w-full flex-col gap-3 rounded-xl bg-surface p-4 transition-colors hover:bg-elevated"
          >
            <button
              type="button"
              onClick={() => onUse(vibe)}
              className="flex w-full min-w-0 flex-1 flex-col gap-3 text-left"
            >
              <PresetSwatches vibe={vibe} />
              <div className="w-full min-w-0">
                <div className="truncate text-[14px] font-medium text-text-primary">{p.label}</div>
                <div className="mt-0.5 line-clamp-1 text-[11.5px] text-text-muted">
                  {failed?.vibe === vibe ? (
                    <span className="text-error">Could not copy: {failed.reason}</span>
                  ) : copying === vibe ? (
                    'Copying…'
                  ) : (
                    p.blurb
                  )}
                </div>
              </div>
            </button>
            <CardMenu
              label={p.label}
              actions={[
                { label: 'Use as a starting point', onSelect: () => onUse(vibe) },
                { label: 'Duplicate to my libraries', onSelect: () => void duplicate(vibe) }
              ]}
            />
          </div>
        )
      })}
    </div>
  )
}

/**
 * What the library looks like, rather than what it is called.
 *
 * A row of the three colours at three steps each says more about a feel than
 * its name does, and it is the same information the built library opens on.
 */
function PresetSwatches({ vibe }: { vibe: Vibe }): React.JSX.Element {
  const p = FEEL_PRESETS[vibe]
  const radius = CORNER_PX[p.cornerStyle]
  const primary = ramp(p.primary)
  // The preview stands on the library's own lightest step rather than on the
  // app's surface. Minimal, Elegant and Brutalist all have near-black
  // primaries, which on a dark panel made the card look empty — and a preview
  // of a design should show the design's ground, not the tool's.
  return (
    <div
      className="flex h-32 w-full flex-col justify-end gap-2 overflow-hidden rounded-lg p-3"
      style={{ background: primary[50] }}
    >
      <div className="flex-1" style={{ background: p.primary, borderRadius: radius }} />
      <div className="flex gap-1.5">
        {[p.primary, p.secondary, p.tertiary].flatMap((hex) => {
          const r = ramp(hex)
          return [300, 600, 900].map((step) => (
            <span
              key={`${hex}-${step}`}
              className="h-4 flex-1"
              style={{ background: r[step], borderRadius: Math.min(radius, 6) }}
            />
          ))
        })}
      </div>
    </div>
  )
}
