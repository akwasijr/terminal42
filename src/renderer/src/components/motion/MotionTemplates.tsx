// The template gallery.
//
// A tile is a genuine preview rather than a picture of one: the arrangement
// is projected from the template's own document, the frame carries its own
// background and aspect, and the headline is set in the family, size, weight
// and colour the piece will actually use. What it does not show is the
// photographs, because the tile draws a flat outline rather than the scene,
// so a card is a shape here and a picture in the frame.
//
// It opens as an overlay rather than living on the home screen, because the
// home screen is a list of your work and twenty starting points would bury
// it. One button away is close enough.

import { useEffect, useMemo, useRef } from 'react'
import type { MotionTemplate } from '../../../../shared/motion/templates'
import { MOTION_TEMPLATES } from '../../../../shared/motion/templates'
import { resolvedText } from '../../../../shared/motion/types'
import { drawPresetThumb } from '../../lib/motion/thumb'
import { requestTextFonts } from '../../lib/motion/fonts'
import { fontByLabel } from '../../lib/freeformTypes'
import { IconClose } from '../icons'

/** The tile's own shape, which every frame is fitted inside. */
const TILE_RATIO = 16 / 10

const ASPECT: Record<string, number> = { '16:9': 16 / 9, '4:5': 4 / 5, '9:16': 9 / 16, '1:1': 1, '4:3': 4 / 3 }

export function MotionTemplates({
  onPick, onClose
}: {
  onPick: (template: MotionTemplate) => void
  onClose: () => void
}): React.JSX.Element {
  // Every family a tile might set, asked for once rather than per tile.
  useEffect(() => {
    requestTextFonts(MOTION_TEMPLATES.flatMap((t) => t.build([]).visual.text))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg/95 backdrop-blur-sm">
      <header className="flex flex-shrink-0 items-center justify-between gap-4 px-8 pb-4 pt-7">
        <div>
          <h2 className="text-[17px] font-semibold text-text-primary">Templates</h2>
          <p className="mt-0.5 text-[12px] text-text-muted">Finished pieces to start from. Everything stays editable.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close templates"
          className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md text-text-muted transition-colors hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <IconClose size={12} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-10">
        <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {MOTION_TEMPLATES.map((t) => (
            <TemplateTile key={t.id} template={t} onPick={() => onPick(t)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function TemplateTile({ template, onPick }: { template: MotionTemplate; onPick: () => void }): React.JSX.Element {
  // The document is the preview's only source of truth, so a tile cannot
  // drift from the piece it makes: change the template and the tile follows.
  const doc = useMemo(() => template.build([]), [template])
  const ratio = ASPECT[doc.frame.aspect] ?? 16 / 9
  // The tile is a fixed landscape box and the frame is whatever the template
  // chose, so the frame is fitted inside it rather than stretched to it: a
  // portrait piece has to look portrait or the preview is a lie. Worked out
  // in numbers because `width: auto` on an aspect-ratio box fills its parent
  // instead of shrinking to the ratio, which quietly made every frame wide.
  const wide = ratio >= TILE_RATIO
  const w = wide ? 100 : (ratio / TILE_RATIO) * 100
  const h = wide ? (TILE_RATIO / ratio) * 100 : 100

  return (
    <button
      type="button"
      onClick={onPick}
      className="group flex w-full flex-col gap-3 rounded-xl bg-surface p-4 text-left transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <span aria-hidden="true" className="relative block w-full overflow-hidden rounded-lg bg-elevated" style={{ aspectRatio: `${TILE_RATIO}` }}>
        <span
          className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 overflow-hidden"
          style={{
            width: `${w}%`,
            height: `${h}%`,
            background: doc.frame.background,
            // Type is sized as a share of the frame's height in the real
            // renderer, so the tile measures against the frame too rather
            // than against the card it happens to sit in.
            containerType: 'size'
          }}
        >
          <Outline doc={doc} swatch={template.swatch} phase={template.previewPhase ?? 0.18} />
          {doc.visual.text.map((raw) => {
            const layer = resolvedText(raw)
            return (
              <span
                key={layer.id}
                className="pointer-events-none absolute block whitespace-pre leading-none"
                style={{
                  left: `${layer.x}%`,
                  top: `${layer.y}%`,
                  // The layer's own anchor: centred text is centred on its
                  // point, left-aligned text starts at it.
                  transform: `translate(${layer.align === 'center' ? '-50%' : layer.align === 'right' ? '-100%' : '0'}, -50%)`,
                  fontSize: `${layer.size}cqh`,
                  fontFamily: fontByLabel(layer.font).stack,
                  fontWeight: layer.weight,
                  fontStyle: layer.italic ? 'italic' : 'normal',
                  letterSpacing: `${layer.tracking / 100}em`,
                  color: layer.colour,
                  opacity: layer.opacity / 100
                }}
              >
                {layer.text}
              </span>
            )
          })}
        </span>
      </span>
      <span className="block w-full min-w-0">
        <span className="block truncate text-[13.5px] font-medium text-text-primary">{template.name}</span>
        <span className="mt-0.5 block truncate text-[11.5px] text-text-muted">{template.note}</span>
      </span>
    </button>
  )
}

/** The arrangement, flat, at one instant of its loop. */
function Outline({ doc, swatch, phase }: { doc: ReturnType<MotionTemplate['build']>; swatch: readonly [string, string]; phase: number }): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const box = canvas.parentElement?.getBoundingClientRect()
    drawPresetThumb(canvas, doc, phase, {
      width: Math.max(1, Math.round(box?.width ?? 300)),
      height: Math.max(1, Math.round(box?.height ?? 190)),
      near: swatch[0],
      far: swatch[1]
    })
  }, [doc, swatch, phase])

  return <canvas ref={ref} className="absolute inset-0 block h-full w-full" aria-hidden="true" />
}
