// The Motion studio.
//
// Three columns: what to build, the thing itself, and how it looks. The frame
// sits in the middle at a fixed aspect because Motion's output is a video of a
// known shape — showing it in whatever rectangle the window happens to be
// would mean composing against a frame that does not exist.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentId, MotionDoc } from '../../../../shared/motion/types'
import { componentFor } from '../../../../shared/motion/registry'
import { presetParams } from '../../../../shared/motion/presets'
import { emptyDoc, hydrateDoc } from '../../../../shared/motion/defaults'
import { cardCountFor, emptyOverride, overrideIsEmpty } from '../../../../shared/motion/frame'
import { exportStill, exportVideo, type ExportProgress } from '../../lib/motion/exporter'
import { ensureTextFonts } from '../../lib/motion/fonts'
import { ComponentsDrawer, type SavedLayout } from './ComponentsDrawer'
import { MotionStage, type StageHandle } from './MotionStage'
import { ExportPanel } from './ExportPanel'
import { ParamsPanel, VisualPanel } from './MotionPanels'
import { MotionTimeline } from './MotionTimeline'
import { FrameToolbar, type FrameFit } from './FrameToolbar'
import { ResizeHandle } from './ResizeHandle'
import { useStoredWidth } from '../../lib/motion/paneWidth'
import { IconChevronRight } from '../icons'

type Tab = 'motion' | 'visual' | 'export'

export function MotionStudio({
  id, title, initialDoc, onRename, onClose
}: {
  id: string
  title: string
  initialDoc: MotionDoc
  onRename: (title: string) => void
  onClose: () => void
}): React.JSX.Element {
  const [doc, setDoc] = useState<MotionDoc>(initialDoc)
  const [tab, setTab] = useState<Tab>('motion')
  // A piece opens still. Motion that runs the whole time you are working is
  // motion you cannot work against: a card you are aiming at has moved by the
  // time you reach it. Both kinds of motion are triggered — the loop from the
  // toolbar, the entrance from Play.
  const [playing, setPlaying] = useState(false)
  const [phase, setPhase] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busyImages, setBusyImages] = useState(false)
  const [images, setImages] = useState<Map<string, HTMLImageElement>>(new Map())
  const [layouts, setLayouts] = useState<SavedLayout[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [naming, setNaming] = useState(false)
  const [layoutName, setLayoutName] = useState('')
  const [poseMode, setPoseMode] = useState(false)
  const [fit, setFit] = useState<FrameFit>('contain')
  const [leftWidth, setLeftWidth] = useStoredWidth('motion.leftPane', 240, 180, 420)
  const [rightWidth, setRightWidth] = useStoredWidth('motion.rightPane', 256, 200, 460)
  // A replay is an event, not a state, so it travels as a counter the stage
  // watches: the same button pressed twice must fire twice.
  const [replayToken, setReplayToken] = useState(0)
  const [replayLooping, setReplayLooping] = useState(false)
  const [replayed, setReplayed] = useState(false)
  const stage = useRef<StageHandle | null>(null)
  const cancelRef = useRef({ cancelled: false })

  const patch = useCallback((p: Partial<MotionDoc>) => {
    setDoc((d) => ({ ...d, ...p }))
  }, [])

  // Autosave, debounced. Motion has no Save button on purpose: every control
  // is a slider, so an explicit save would mean choosing a moment to press it
  // in the middle of a drag.
  useEffect(() => {
    const t = setTimeout(() => {
      const thumb = stage.current?.snapshot(220) ?? undefined
      void window.terminal42.motion.save(id, doc, thumb)
    }, 700)
    return () => clearTimeout(t)
  }, [doc, id])

  useEffect(() => {
    void window.terminal42.motion.layouts().then((rows) => setLayouts(rows as SavedLayout[]))
  }, [])

  // Decode every referenced image once. Stored documents hold paths, so a
  // piece reopened tomorrow reads its pictures back off disk rather than
  // carrying megabytes of base64 in its row.
  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      const next = new Map<string, HTMLImageElement>()
      for (const ref of doc.visual.images) {
        const src = ref.src.startsWith('data:')
          ? ref.src
          : (await window.terminal42.motion.readImage(ref.src)) ?? ''
        if (!src) continue
        const img = new Image()
        img.src = src
        try { await img.decode() } catch { continue }
        next.set(ref.id, img)
      }
      if (!cancelled) setImages(next)
    }
    void load()
    return () => { cancelled = true }
  }, [doc.visual.images])

  const count = useMemo(() => cardCountFor(doc), [doc])
  const handEdits = useMemo(
    () => Object.values(doc.overrides).filter((o) => !overrideIsEmpty(o)).length,
    [doc.overrides]
  )

  // Escape lets go of a card and Delete puts it back, which is what those
  // keys do everywhere else a thing can be selected.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = document.activeElement
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return
      if (e.key === 'Escape') setSelected(null)
      if ((e.key === 'Backspace' || e.key === 'Delete') && selected !== null) {
        e.preventDefault()
        const next = { ...doc.overrides }
        delete next[String(selected)]
        patch({ overrides: next })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, doc.overrides, patch])

  const pickComponent = (componentId: ComponentId): void => {
    // A hand edit is a note about card 7 of *this* pattern, so it does not
    // survive a change of pattern.
    setSelected(null)
    patch({ componentId, overrides: {} })
  }

  // "Put the view back" means the angle and the zoom you were given, not the
  // motion you have built — pose and transform are how you are looking at the
  // piece, everything else is the piece.
  const base = useMemo(() => emptyDoc(doc.componentId), [doc.componentId])
  const viewChanged = useMemo(
    () => JSON.stringify(doc.pose) !== JSON.stringify(base.pose)
      || JSON.stringify(doc.transform) !== JSON.stringify(base.transform),
    [doc.pose, doc.transform, base]
  )
  const resetView = (): void => patch({ pose: { ...base.pose }, transform: { ...base.transform } })

  const resetCard = (index: number): void => {
    const next = { ...doc.overrides }
    delete next[String(index)]
    patch({ overrides: next })
  }

  const dropFiles = async (files: File[], cardIndex: number | null): Promise<void> => {
    const paths = files.map((f) => window.terminal42.shell.getPathForFile(f)).filter(Boolean)
    if (paths.length === 0) return
    setBusyImages(true)
    try {
      const res = await window.terminal42.motion.addImages(paths)
      if (!res.ok) return
      const added = res.images.map((i) => ({ id: i.id, src: i.path, name: i.name }))
      const overrides = { ...doc.overrides }
      if (cardIndex !== null && added[0]) {
        // Dropping onto a card means that card, not "somewhere in the deck".
        const key = String(cardIndex)
        overrides[key] = { ...(overrides[key] ?? emptyOverride()), imageId: added[0].id }
        setSelected(cardIndex)
      }
      patch({ overrides, visual: { ...doc.visual, images: [...doc.visual.images, ...added] } })
    } finally {
      setBusyImages(false)
    }
  }

  const pickPreset = (index: number): void => {
    const component = componentFor(doc.componentId)
    patch({ params: { ...doc.params, [doc.componentId]: presetParams(component, index) } })
  }

  const importImages = async (): Promise<void> => {
    setBusyImages(true)
    try {
      const res = await window.terminal42.motion.importImages()
      if (res.ok) {
        patch({
          visual: {
            ...doc.visual,
            images: [...doc.visual.images, ...res.images.map((i) => ({ id: i.id, src: i.path, name: i.name }))]
          }
        })
      }
    } finally {
      setBusyImages(false)
    }
  }

  const saveStill = async (): Promise<void> => {
    const engine = stage.current?.engine()
    if (!engine) return
    setExporting(true)
    try {
      // The stage asks for these too, but a still can be saved the moment a
      // family is picked, before that request has come back.
      await ensureTextFonts(doc.visual.text)
      const still = exportStill(engine, doc, phase)
      if (!still) { setNote('That frame could not be captured.'); return }
      const res = await window.terminal42.motion.exportFile(`${slug(title)}.${still.ext}`, still.base64)
      setNote(res.ok ? `Saved to ${res.path}` : null)
    } finally {
      setExporting(false)
      // Hand the renderer back at its on-screen size, or the frame stays stuck
      // at export resolution and renders soft until the window is resized.
      stage.current?.restore()
    }
  }

  const saveVideo = async (): Promise<void> => {
    const engine = stage.current?.engine()
    if (!engine) return
    setPlaying(false)
    setExporting(true)
    cancelRef.current = { cancelled: false }
    setNote(null)
    try {
      const res = await exportVideo(engine, doc, setProgress, cancelRef.current)
      if ('error' in res) { setNote(res.error); return }
      const saved = await window.terminal42.motion.exportFile(`${slug(title)}.${res.ext}`, res.base64)
      setNote(
        saved.ok
          ? res.lagged
            ? `Saved to ${saved.path}. Rendering could not keep up, so the clip runs slightly long. A smaller size or fewer cards will fix it.`
            : `Saved to ${saved.path}`
          : null
      )
    } finally {
      setExporting(false)
      setProgress(null)
      stage.current?.restore()
    }
  }

  // Electron has no window.prompt, so the name is asked for in the drawer.
  const beginSaveLayout = (): void => {
    setLayoutName(`${componentFor(doc.componentId).label} layout`)
    setNaming(true)
  }

  const saveLayout = async (name: string): Promise<void> => {
    setNaming(false)
    if (!name.trim()) return
    // A layout is the document without its pictures — the whole point is to
    // put different images into the same motion.
    const stripped: MotionDoc = { ...doc, visual: { ...doc.visual, images: [], text: [] } }
    const row = await window.terminal42.motion.saveLayout(name.trim(), doc.componentId, stripped, stage.current?.snapshot(120) ?? null)
    setLayouts((l) => [row as SavedLayout, ...l])
  }

  const applyLayout = (l: SavedLayout): void => {
    const next = hydrateDoc(l.doc)
    // The images you are working with survive a layout change; the look does
    // not. Swapping both would make "try this layout" destructive.
    setDoc({ ...next, visual: { ...next.visual, images: doc.visual.images, text: doc.visual.text } })
  }

  const deleteLayout = async (layoutId: string): Promise<void> => {
    await window.terminal42.motion.deleteLayout(layoutId)
    setLayouts((l) => l.filter((x) => x.id !== layoutId))
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-1 gap-2 p-2">
      <ComponentsDrawer
        width={leftWidth}
        doc={doc}
        onPickComponent={pickComponent}
        onPickPreset={pickPreset}
        layouts={layouts}
        onApplyLayout={applyLayout}
        onDeleteLayout={(lid) => void deleteLayout(lid)}
      />
      <ResizeHandle label="Resize the components panel" width={leftWidth} onWidth={setLeftWidth} side="left" min={180} max={420} />

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-panel bg-surface">
        <header className="flex h-9 shrink-0 items-center gap-2 px-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm px-1.5 py-1 text-[11.5px] text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <span className="inline-block rotate-180"><IconChevronRight /></span>
          </button>
          <input
            value={title}
            onChange={(e) => onRename(e.target.value)}
            aria-label="Piece name"
            className="min-w-0 flex-1 rounded-sm bg-transparent px-1 py-0.5 text-[12.5px] text-text-primary hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          />
          <span className="font-mono text-[10.5px] text-text-muted">{count} cards</span>
          {handEdits > 0 ? (
            <button
              type="button"
              onClick={() => { setSelected(null); patch({ overrides: {} }) }}
              className="rounded-sm px-2 py-1 text-[11px] text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              Reset {handEdits} hand {handEdits === 1 ? 'edit' : 'edits'}
            </button>
          ) : null}
        </header>

        <div className="relative min-h-0 flex-1">
          <FrameToolbar
            doc={doc}
            onChange={patch}
            playing={playing}
            onTogglePlaying={() => setPlaying((p) => !p)}
            onReplay={() => {
              // Press once to see the entrance again, press again to leave it
              // repeating, press a third time to stop. Looping on the first
              // press would make it impossible to watch the move just once.
              if (replayLooping) { setReplayLooping(false); return }
              if (replayed) setReplayLooping(true)
              setReplayed(true)
              setReplayToken((t) => t + 1)
            }}
            replayLooping={replayLooping}
            poseMode={poseMode}
            onPoseMode={setPoseMode}
            fit={fit}
            onFit={setFit}
            onResetView={resetView}
            viewChanged={viewChanged}
          />
          <MotionStage
            doc={doc}
            images={images}
            playing={playing && !exporting}
            exporting={exporting}
            phase={phase}
            onPhase={setPhase}
            handleRef={stage}
            selected={selected}
            onSelect={setSelected}
            onPatch={patch}
            onDropFiles={(f, card) => void dropFiles(f, card)}
            poseMode={poseMode}
            fit={fit}
            replayToken={replayToken}
            replayLooping={replayLooping}
          />
        </div>

        <div className="flex shrink-0 justify-center pt-1.5">
          {naming ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => { e.preventDefault(); void saveLayout(layoutName) }}
            >
              <input
                autoFocus
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setNaming(false) }}
                aria-label="Layout name"
                className="w-48 rounded-sm bg-raised px-2 py-1 text-[11.5px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              />
              <button
                type="submit"
                className="rounded-sm bg-raised px-2 py-1 text-[11px] text-text-primary hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setNaming(false)}
                className="rounded-sm px-2 py-1 text-[11px] text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={beginSaveLayout}
              className="rounded-sm px-2.5 py-1 text-[11px] text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              Save this layout
            </button>
          )}
        </div>

        <MotionTimeline
          doc={doc}
          phase={phase}
          onPhase={(p) => { setPlaying(false); setPhase(p) }}
          onChange={patch}
        />
        {selected !== null ? (
          <div className="flex shrink-0 items-center gap-2 px-3 pb-2 text-[11px] text-text-secondary">
            <span>Card {selected + 1} selected. Drag it to move, hold Alt to turn it, drop a picture on it.</span>
            {!overrideIsEmpty(doc.overrides[String(selected)]) ? (
              <button
                type="button"
                onClick={() => resetCard(selected)}
                className="rounded-sm px-1.5 py-0.5 text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                Put it back
              </button>
            ) : null}
          </div>
        ) : null}
        {note ? (
          <p className="shrink-0 truncate px-3 pb-2 text-[11px] text-text-secondary" role="status">{note}</p>
        ) : null}
      </section>

      <ResizeHandle label="Resize the settings panel" width={rightWidth} onWidth={setRightWidth} side="right" min={200} max={460} />

      <aside
        style={{ width: rightWidth }}
        className="flex h-full shrink-0 flex-col overflow-hidden rounded-panel bg-surface"
      >
        <header className="m-2 flex shrink-0 items-center gap-0.5 rounded-lg bg-sunken p-0.5">
          {(['motion', 'visual', 'export'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11.5px] capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                tab === t ? 'bg-raised text-text-primary' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {t}
            </button>
          ))}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'motion' ? <ParamsPanel doc={doc} onChange={patch} phase={phase} /> : null}
          {tab === 'visual' ? (
            <VisualPanel doc={doc} onChange={patch} onImportImages={() => void importImages()} busy={busyImages} />
          ) : null}
          {tab === 'export' ? (
            <ExportPanel
              doc={doc}
              onChange={patch}
              onExportStill={() => void saveStill()}
              onExportVideo={() => void saveVideo()}
              progress={progress}
              busy={exporting}
            />
          ) : null}
        </div>
      </aside>
    </div>
  )
}

function slug(title: string): string {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'motion'
}
