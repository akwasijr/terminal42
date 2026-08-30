// Pictures: where they come from, and which ones this piece is using.
//
// Two tabs, because there are two ways to answer "what goes on these cards".
// The Library is one picture at a time. A Bento is a set you have used before,
// applied whole — the same idea as a saved layout, from the other side: a
// layout is a motion without its pictures, a bento is pictures without a
// motion.

import { useEffect, useRef, useState } from 'react'
import { ConfirmDelete } from '../CardMenu'
import type { ImageRef, MotionDoc } from '../../../../shared/motion/types'
import { IMAGE_BANK, bankImageBase64, drawBankImage } from '../../lib/motion/bank'
import { Section, SegmentedRow } from './controls'

export type Bento = {
  id: string
  name: string
  images: Array<{ id: string; src: string; name: string }>
  createdAt: number
}

export function ImagesPanel({
  doc, onChange, onImportImages, busy
}: {
  doc: MotionDoc
  onChange: (patch: Partial<MotionDoc>) => void
  onImportImages: () => void
  busy: boolean
}): React.JSX.Element {
  const [confirmBento, setConfirmBento] = useState<{ id: string; name: string } | null>(null)
  const [tab, setTab] = useState<'library' | 'bentos'>('library')
  const [bentos, setBentos] = useState<Bento[]>([])
  const [naming, setNaming] = useState(false)
  const [bentoName, setBentoName] = useState('')
  const [adding, setAdding] = useState<string | null>(null)

  useEffect(() => {
    void window.terminal42.motion.bentos().then((rows) => setBentos(rows as Bento[]))
  }, [])

  const images = doc.visual.images
  const setImages = (next: ImageRef[]): void => onChange({ visual: { ...doc.visual, images: next } })

  // A starter picture is only written to disk when it is first used. Until
  // then it costs nothing but the few lines that draw it.
  const toggleBankImage = async (bankId: string, label: string): Promise<void> => {
    const existing = images.find((i) => i.name === label && i.src.includes('motion-images'))
    if (existing) { setImages(images.filter((i) => i.id !== existing.id)); return }
    setAdding(bankId)
    try {
      const base64 = bankImageBase64(bankId)
      if (!base64) return
      const res = await window.terminal42.motion.storeImage(label, base64)
      if (!res.ok) return
      setImages([...images, { id: res.image.id, src: res.image.path, name: label }])
    } finally {
      setAdding(null)
    }
  }

  const saveBento = async (name: string): Promise<void> => {
    setNaming(false)
    if (!name.trim() || images.length === 0) return
    const row = await window.terminal42.motion.saveBento(name.trim(), images)
    setBentos((b) => [row as Bento, ...b])
  }

  const deleteBento = async (id: string): Promise<void> => {
    await window.terminal42.motion.deleteBento(id)
    setBentos((b) => b.filter((x) => x.id !== id))
  }

  return (
    <>
      <Section title="Images" defaultOpen>
        <div className="flex items-center gap-0.5">
          {(['library', 'bentos'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`rounded-sm px-2 py-1 text-[11px] capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                tab === t ? 'bg-raised text-text-primary' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'library' ? (
          <>
            <button
              type="button"
              onClick={onImportImages}
              disabled={busy}
              className="rounded-sm bg-raised px-2 py-1.5 text-[11.5px] text-text-primary hover:bg-elevated disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              {busy ? 'Adding…' : 'Add your own'}
            </button>

            <p className="pt-1 text-[11px] font-medium text-text-muted">Starter set</p>
            <ul className="grid grid-cols-3 gap-1">
              {IMAGE_BANK.map((b) => {
                const inUse = images.some((i) => i.name === b.label)
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => void toggleBankImage(b.id, b.label)}
                      disabled={adding !== null}
                      aria-pressed={inUse}
                      title={inUse ? `Take ${b.label} out` : `Put ${b.label} in`}
                      className={`relative block w-full overflow-hidden rounded-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                        inUse ? 'ring-1 ring-accent' : 'hover:ring-1 hover:ring-border-strong'
                      }`}
                    >
                      <BankThumb id={b.id} />
                      {inUse ? (
                        <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>

            {images.length > 0 ? (
              <>
                <p className="pt-1 text-[11px] font-medium text-text-muted">
                  In this piece ({images.length})
                </p>
                <SegmentedRow
                  label="Order"
                  value={doc.visual.imageOrder}
                  options={[{ value: 'in-order', label: 'In order' }, { value: 'scatter', label: 'Scatter' }]}
                  onChange={(v) => onChange({ visual: { ...doc.visual, imageOrder: v } })}
                />
                <ul className="flex flex-wrap gap-1">
                  {images.map((img) => (
                    <li key={img.id}>
                      <button
                        type="button"
                        title={`Remove ${img.name}`}
                        aria-label={`Remove ${img.name}`}
                        onClick={() => setImages(images.filter((i) => i.id !== img.id))}
                        className="rounded-sm bg-sunken px-1.5 py-1 text-[10.5px] text-text-muted hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                      >
                        {img.name.length > 14 ? `${img.name.slice(0, 12)}…` : img.name} ×
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-[11px] text-text-muted">
                No pictures yet.
              </p>
            )}
          </>
        ) : (
          <>
            {naming ? (
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => { e.preventDefault(); void saveBento(bentoName) }}
              >
                <input
                  autoFocus
                  value={bentoName}
                  onChange={(e) => setBentoName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setNaming(false) }}
                  aria-label="Bento name"
                  className="min-w-0 flex-1 rounded-sm bg-sunken px-1.5 py-1 text-[11.5px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                />
                <button
                  type="submit"
                  className="rounded-sm bg-raised px-2 py-1 text-[11px] text-text-primary hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  Save
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => { setBentoName(`${images.length} pictures`); setNaming(true) }}
                disabled={images.length === 0}
                className="rounded-sm bg-raised px-2 py-1.5 text-[11.5px] text-text-primary hover:bg-elevated disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                Save these as a bento
              </button>
            )}

            {bentos.length === 0 ? (
              <p className="text-[11px] text-text-muted">
                No bentos yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {bentos.map((b) => (
                  <li key={b.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setImages(b.images)}
                      className="flex-1 rounded-sm px-2 py-1.5 text-left text-[11.5px] text-text-secondary hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    >
                      {b.name}
                      <span className="ml-1 text-text-muted">· {b.images.length}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmBento(b)}
                      aria-label={`Delete bento ${b.name}`}
                      className="rounded-sm px-1.5 py-1 text-[10.5px] text-text-muted opacity-0 transition-opacity hover:text-error focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 group-hover:opacity-100"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Section>
      {confirmBento && (
        <ConfirmDelete
          name={confirmBento.name}
          kind="set"
          onCancel={() => setConfirmBento(null)}
          onConfirm={() => {
            void deleteBento(confirmBento.id)
            setConfirmBento(null)
          }}
        />
      )}
    </>
  )
}

function BankThumb({ id }: { id: string }): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    if (ref.current) drawBankImage(ref.current, id, 96)
  }, [id])
  return <canvas ref={ref} className="block w-full" style={{ aspectRatio: '4 / 5' }} aria-hidden="true" />
}
