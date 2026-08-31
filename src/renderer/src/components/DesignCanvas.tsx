import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { FrameBridge, type FramePick } from '../lib/frameBridge'
import { computeSelector, readStyles, type ElementStyles, type ProjectToken } from '../../../shared/framePick'
import type { Design, DesignVersion } from '../../../preload/index'
import { IconBrain, IconChat, IconCheck, IconChevronRight, IconClose, IconDesktop, IconEdit, IconExternal, IconFluid, IconFolder, IconMobile, IconRefresh, IconShare, IconSparkle, IconTablet } from './icons'
import { PencilThinking, pickAnimationForKind } from './PencilThinking'
import { Modal } from './Modal'
import { MotionTimeline } from './MotionTimeline'
import { MOTION_PRESETS, presetSpec, generateMotionCss, type MotionSpec } from '../lib/motionCss'
import { extractCss, extractTokens, shareReference } from '../../../shared/share'
import { SHADER_PRESETS, buildShaderScript, type ShaderConfig, type ShaderId } from '../lib/shaderAssets'

// ─── Viewport profiles per design kind ──────────────────────────────────────

type Viewport = { id: string; label: string; width: number | null; height: number | null }

type CanvasProfile = {
  id: string
  viewports: Viewport[]
  defaultViewportId: string
  showZoom: boolean
}

const PROFILES: Record<string, CanvasProfile> = {
  // Web pages: phone / tablet / desktop. Fluid removed: it implied
  // "browser window" but the canvas never actually sits at window width,
  // so it confused more than it helped.
  web: {
    id: 'web',
    viewports: [
      { id: 'mobile',  label: 'Mobile 375',  width: 375,  height: 812 },
      { id: 'tablet',  label: 'Tablet 834',  width: 834,  height: 1112 },
      { id: 'desktop', label: 'Desktop 1280', width: 1280, height: 800 }
    ],
    defaultViewportId: 'desktop',
    showZoom: false
  },
  // 16:9 slide framing
  slides: {
    id: 'slides',
    viewports: [
      { id: 'slide-1280', label: '1280 × 720',  width: 1280, height: 720 },
      { id: 'slide-1920', label: '1920 × 1080', width: 1920, height: 1080 },
      { id: 'fluid',      label: 'Fluid',       width: null, height: null }
    ],
    defaultViewportId: 'fluid',
    showZoom: true
  },
  // Print artboards
  poster:        artboard('print-poster', { id: 'a3p',  label: 'A3 Portrait 1240 × 1754',  width: 1240, height: 1754 }),
  flyer:         artboard('print-flyer',  { id: 'a5p',  label: 'A5 Portrait 740 × 1050',   width: 740,  height: 1050 }),
  invitation:    artboard('print-inv',    { id: '5x7',  label: '5 × 7 in 1500 × 2100',     width: 1500, height: 2100 }),
  'business-card': artboard('print-bc',   { id: 'bc',   label: '3.5 × 2 in 1050 × 600',    width: 1050, height: 600 }),
  certificate:   artboard('print-cert',   { id: 'a4l',  label: 'A4 Landscape 1754 × 1240', width: 1754, height: 1240 }),
  // Social tiles
  'social-post':  artboard('social-post',  { id: '1x1', label: '1080 × 1080', width: 1080, height: 1080 }),
  'social-story': artboard('social-story', { id: '9x16', label: '1080 × 1920', width: 1080, height: 1920 }),
  'cover-image':  artboard('social-cover', { id: '3x1', label: '1500 × 500', width: 1500, height: 500 }),
  'ad-banner':    artboard('social-ad',    { id: 'lb',  label: '728 × 90',   width: 728,  height: 90 }),
  // Email
  email: {
    id: 'email',
    viewports: [
      { id: 'email-600', label: 'Email 600',   width: 600, height: null },
      { id: 'mobile',    label: 'Mobile 375',  width: 375, height: null },
      { id: 'fluid',     label: 'Fluid',       width: null, height: null }
    ],
    defaultViewportId: 'email-600',
    showZoom: true
  },
  // Documents (resume / one-pager / report etc)
  a4Portrait: artboard('a4p',  { id: 'a4p', label: 'A4 Portrait 794 × 1123', width: 794, height: 1123 }),
  // Tall column (infographic)
  infographic: {
    id: 'infographic',
    viewports: [
      { id: 'infog', label: '800 wide', width: 800, height: null },
      { id: 'fluid', label: 'Fluid',    width: null, height: null }
    ],
    defaultViewportId: 'infog',
    showZoom: true
  },
  // Brochure: tri-fold wide
  brochure: artboard('brochure', { id: 'tri', label: 'Tri-fold 2232 × 1050', width: 2232, height: 1050 }),
  // Chart
  chart: artboard('chart', { id: 'chart', label: '800 × 500', width: 800, height: 500 }),
  // Component playground: pinned to desktop. Fluid removed: components
  // are reviewed at a real width.
  component: {
    id: 'component',
    viewports: [
      { id: 'desktop', label: 'Desktop 1280', width: 1280, height: 800 },
      { id: 'tablet',  label: 'Tablet 834',  width: 834,  height: 1112 },
      { id: 'mobile',  label: 'Mobile 375',  width: 375,  height: 812 }
    ],
    defaultViewportId: 'desktop',
    showZoom: true
  },
  // Article column (blog post / case study)
  article: {
    id: 'article',
    viewports: [
      { id: 'desktop', label: 'Desktop 1280', width: 1280, height: 800 },
      { id: 'tablet',  label: 'Tablet 834',  width: 834,  height: 1112 },
      { id: 'mobile',  label: 'Mobile 375',  width: 375,  height: 812 }
    ],
    defaultViewportId: 'desktop',
    showZoom: false
  },
  // Design-system / mood-board / style-tile / user-flow / sitemap.
  // These are reference documents: typically tall and wide, best viewed
  // fluid with optional 1280 / tablet for picky review + zoom for detail.
  designRef: {
    id: 'designRef',
    viewports: [
      { id: 'fluid',   label: 'Fluid',         width: null, height: null },
      { id: 'desktop', label: 'Desktop 1280',  width: 1280, height: 1600 },
      { id: 'tablet',  label: 'Tablet 834',    width: 834,  height: 1400 }
    ],
    defaultViewportId: 'fluid',
    showZoom: true
  },
  // Fallback for kinds we haven't enumerated
  generic: {
    id: 'generic',
    viewports: [{ id: 'fluid', label: 'Fluid', width: null, height: null }],
    defaultViewportId: 'fluid',
    showZoom: true
  }
}

/**
 * A viewport label narrow enough for a pill.
 *
 * The old rule took the first two words, which turned "1280 × 720" into
 * "1280 ×" — a label that names nothing and ends mid-symbol. A size is either
 * described by a name ("A3 Portrait", "Tri-fold") or by its numbers, so keep
 * whichever of the two the label leads with and drop the rest.
 */
function shortViewport(label: string): string {
  const m = label.match(/^(.*?)\s*(\d+)\s*×\s*(\d+)$/)
  if (!m) return label
  const name = m[1].trim()
  return name ? name.replace(/\s*×\s*/g, '×') : `${m[2]}×${m[3]}`
}

function artboard(id: string, board: Viewport): CanvasProfile {
  return {
    id,
    viewports: [board, { id: 'fluid', label: 'Fluid', width: null, height: null }],
    defaultViewportId: board.id,
    showZoom: true
  }
}

function profileForKind(kind: string | undefined): CanvasProfile {
  switch (kind) {
    case 'landing': case 'website': case 'app': case 'app-screen': case 'dashboard':
    case 'pricing': case 'login': case 'hero':
      return PROFILES.web
    case 'pitch-deck': case 'sales-deck': case 'talk-slides': case 'workshop-deck':
      return PROFILES.slides
    case 'poster': case 'flyer': case 'invitation':
    case 'business-card': case 'certificate':
      return PROFILES[kind]
    case 'social-post': case 'social-story': case 'cover-image': case 'ad-banner':
      return PROFILES[kind]
    case 'email':         return PROFILES.email
    case 'infographic':   return PROFILES.infographic
    case 'report':        return PROFILES.a4Portrait
    case 'resume':        return PROFILES.a4Portrait
    case 'one-pager':     return PROFILES.a4Portrait
    case 'brochure':      return PROFILES.brochure
    case 'chart':         return PROFILES.chart
    case 'component':     return PROFILES.component
    case 'blog-post':     return PROFILES.article
    case 'case-study':    return PROFILES.article
    // Figma / design-system kinds: long single-page references, fluid +
    // tablet/desktop work fine. Wireframes get the standard web set so
    // users can preview at mobile/tablet/desktop too.
    case 'design-system':
    case 'component-library':
    case 'mood-board':
    case 'style-tile':
    case 'user-flow':
    case 'sitemap':
      return PROFILES.designRef
    case 'wireframe':     return PROFILES.web
    default:              return PROFILES.generic
  }
}

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

export function DesignCanvas({
  designId,
  title,
  onRename,
  onClose
}: {
  designId: string
  /** Title shown at the left of the toolbar. Optional so the canvas
   *  still works standalone if ever embedded outside DesignWorkspace. */
  title?: string
  onRename?: (newTitle: string) => void
  onClose?: () => void
}): JSX.Element {
  const [versions, setVersions] = useState<DesignVersion[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [design, setDesign] = useState<Design | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [stickToLatest, setStickToLatest] = useState(true)
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('Working…')
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // Scroll position to restore after a live-reload remount, so a streaming new
  // version keeps the user's place instead of jumping back to the top.
  const pendingScrollRef = useRef<number | null>(null)

  // Brain check state
  const [brainCheckRunning, setBrainCheckRunning] = useState(false)
  const [brainCheckProgress, setBrainCheckProgress] = useState('')
  const brainCheckCancelledRef = useRef(false)

  const profile = useMemo(() => profileForKind(design?.brief?.kind ?? undefined), [design?.brief?.kind])
  const [viewportId, setViewportId] = useState<string>(profile.defaultViewportId)
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  // Reset viewport + zoom when profile changes (kind may differ between designs)
  useEffect(() => {
    setViewportId(profile.defaultViewportId)
    setZoom('fit')
  }, [profile.id])

  const viewport = profile.viewports.find((v) => v.id === viewportId) ?? profile.viewports[0]

  useEffect(() => {
    let cancelled = false
    setVersions([])
    setActiveId(null)
    setStickToLatest(true)
    setBusy(false)
    setDesign(null)

    void window.terminal42.designs.get(designId).then((d) => { if (!cancelled) setDesign(d) })
    void window.terminal42.designs.watch(designId).then(() => {
      if (cancelled) return
      void window.terminal42.designs.listVersions(designId).then((vs) => {
        if (cancelled) return
        setVersions(vs)
        if (vs.length) setActiveId(vs[vs.length - 1].id)
      })
    })
    void window.terminal42.designs.isBusy(designId).then((b) => { if (!cancelled) setBusy(b) })

    const off = window.terminal42.designs.onVersion(({ designId: id, latest, versions: vs }) => {
      if (id !== designId) return
      setVersions(vs)
      if (latest) {
        setActiveId((prev) => (stickToLatest ? latest.id : (prev ?? latest.id)))
        if (stickToLatest) {
          void bridge.scrollY().then((y) => { pendingScrollRef.current = y })
          setReloadKey((k) => k + 1)
        }
      }
    })
    const offStart = window.terminal42.designs.onStart((d) => { if (d.designId === designId) { setBusy(true); setPhase('Starting…') } })
    const offDone  = window.terminal42.designs.onDone((d)  => { if (d.designId === designId) setBusy(false) })
    const offPhase = window.terminal42.designs.onPhase((d) => { if (d.designId === designId) setPhase(d.phase) })

    return () => {
      cancelled = true
      off(); offStart(); offDone(); offPhase()
      void window.terminal42.designs.unwatch(designId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designId])

  const activeIndex = useMemo(() => versions.findIndex((v) => v.id === activeId), [versions, activeId])
  const active = activeIndex >= 0 ? versions[activeIndex] : null
  const empty = versions.length === 0

  const [activeContent, setActiveContent] = useState<string>('')
  // Where the preview lives. Null means srcDoc, which is right for a page:
  // one document, nothing to fetch, and the app's own origin, so the canvas
  // can reach in to annotate and edit. An app built around a router cannot
  // work there -- about:srcdoc gives it a pathname of "srcdoc" and no route
  // matches that -- so it is served from a loopback origin instead, where it
  // sits at "/". See src/main/spa.ts.
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  // An app served from its own origin cannot be read from here, so the canvas
  // asks it instead. Everything the two kinds of preview have in common goes
  // through the bridge; nothing else in this file needs to know which it has.
  const served = previewSrc !== null
  const bridgeRef = useRef<FrameBridge | null>(null)
  if (!bridgeRef.current || bridgeRef.current.isServed !== served) {
    bridgeRef.current?.dispose()
    bridgeRef.current = new FrameBridge(() => iframeRef.current, served)
  }
  const bridge = bridgeRef.current
  const [annotate, setAnnotate] = useState(false)
  const [pick, setPick] = useState<{ selector: string; text: string } | null>(null)
  const [pickComment, setPickComment] = useState('')
  const [, setTweakSpec] = useState<TweakSpec | null>(null)
  const [, setTweakValues] = useState<Record<string, unknown>>({})
  const [editMode, setEditMode] = useState(false)
  const [editPick, setEditPick] = useState<EditPick | null>(null)
  const [editChanges, setEditChanges] = useState(0)
  const [slideIdx, setSlideIdx] = useState(0)
  const [slideCount, setSlideCount] = useState(0)
  const [projectTokens, setProjectTokens] = useState<ProjectToken[]>([])
  const [versionsOpen, setVersionsOpen] = useState(false)
  // Side-by-side compare: when on, the stage shows two versions next to each
  // other (read-only). Lazy: the second iframe only mounts while comparing.
  const [compareMode, setCompareMode] = useState(false)
  const [compareLeftId, setCompareLeftId] = useState<string | null>(null)
  // Motion mode: click an element, pick an animation preset that maps to the
  // page's motion engine. Mutually exclusive with annotate/edit/compare.
  const [motionMode, setMotionMode] = useState(false)
  const [motionPick, setMotionPick] = useState<{ selector: string; tag: string } | null>(null)
  // Baked motion: per-element specs that are written into the design file via the
  // direct-edit engine (no AI round-trip). `timelineFor` opens the full editor.
  const [motionMap, setMotionMap] = useState<Record<string, MotionSpec>>({})
  const [timelineFor, setTimelineFor] = useState<string | null>(null)
  // Custom shader effects (opt-in): per-element WebGL background, baked as a script.
  const [shaderMode, setShaderMode] = useState(false)
  const [shaderPick, setShaderPick] = useState<{ selector: string; shader: ShaderId; color: string; intensity: number } | null>(null)
  const [shaderMap, setShaderMap] = useState<Record<string, { shader: ShaderId; color: string; intensity: number }>>({})
  // Motion + shader edits are per-design; clear them when the open design changes.
  useEffect(() => {
    setMotionMap({}); setTimelineFor(null); setMotionMode(false)
    setShaderMap({}); setShaderPick(null); setShaderMode(false)
  }, [designId])

  useEffect(() => {
    let cancelled = false
    if (!active) { setActiveContent(''); return }
    // PPTX versions are previewed via the companion .pdf rendered by
    // soffice. Don't readVersion() the binary .pptx: the iframe loads
    // active.previewUrl directly via src= below.
    if (active.kind === 'pptx') { setActiveContent(''); return }
    void window.terminal42.designs.readVersion(designId, active.fileName).then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setActiveContent(`<!doctype html><pre style="padding:24px;font:13px ui-monospace">Failed to load: ${res.error}</pre>`)
        return
      }
      // Decided while the file was read, because an app is recognised by
      // having nothing on the page but its mount point -- and the annotator
      // and editor are about to put their own markup on it.
      const spa = res.spa === true
      let html = res.content
      if (profile.id === 'slides') html = injectSlideRunner(html)
      // Always inject the annotator + tweak runner + editor so toggles are
      // instant and don't require a reload.
      html = injectAnnotator(html)
      html = injectTweakRunner(html)
      html = injectEditor(html)
      setActiveContent(html)
      if (!spa) { setPreviewSrc(null); return }
      void window.terminal42.designs.serve(designId, html).then((r) => {
        if (cancelled) return
        // If it cannot be served it still gets srcDoc: a preview that half
        // works beats no preview and a message about a port.
        bridge.navigating()
        setPreviewSrc(r.ok ? `${r.url}?v=${encodeURIComponent(String(active.modifiedAt))}` : null)
      })
    })
    return () => { cancelled = true }
  }, [designId, active?.id, active?.modifiedAt, reloadKey, profile.id])

  // ─── Iframe DOM control (direct, not postMessage) ──────────────────────
  // srcDoc + sandbox=allow-same-origin gives us same-origin access to the
  // iframe's document. Direct access is far more reliable than the
  // postMessage handshake which kept losing messages across the iframe's
  // load lifecycle.
  const iframeDoc = (): Document | null => {
    try { return iframeRef.current?.contentDocument ?? null } catch { return null }
  }

  // Apply annotate/edit class on the iframe root whenever modes change OR
  // a fresh iframe content loads. Also (re-)attach our click listeners so
  // they survive iframe reloads.
  const handlersRef = useRef<{ click?: (e: Event) => void }>({})

  // What to do with an element, whichever preview reported it. Held in a ref
  // because the served page reports picks through a listener registered once,
  // and a listener that closed over the modes would answer with whichever
  // mode was current when it was made.
  const applyPickRef = useRef<(p: FramePick) => void>(() => {})
  applyPickRef.current = (p: FramePick): void => {
    if (annotate) {
      setPick({ selector: p.selector, text: p.text })
      setPickComment('')
    } else if (editMode) {
      setEditPick({ selector: p.selector, tag: p.tag, styles: p.styles, html: p.html })
    } else if (motionMode) {
      setMotionPick({ selector: p.selector, tag: p.tag })
    } else if (shaderMode) {
      setShaderPick({ selector: p.selector, shader: 'grain', color: '#888888', intensity: 0.6 })
    }
  }

  useEffect(() => {
    bridge.picked((p) => applyPickRef.current(p))
    bridge.slid((i) => setSlideIdx(i))
    return () => { bridge.picked(null); bridge.slid(null) }
  }, [bridge])

  useEffect(() => () => { bridgeRef.current?.dispose() }, [])

  const refreshIframeBindings = (): void => {
    void bridge.modes(annotate, editMode || motionMode || shaderMode)
    // A served page does its own picking and posts the result; there is no
    // document here to listen on.
    if (served) return
    const doc = iframeDoc()
    if (!doc) return
    if (handlersRef.current.click) {
      doc.removeEventListener('click', handlersRef.current.click, true)
    }
    const click = (e: Event): void => {
      if (!annotate && !editMode && !motionMode && !shaderMode) return
      const el = e.target as HTMLElement | null
      if (!el || el === doc.documentElement || el === doc.body) return
      e.preventDefault()
      e.stopPropagation()
      if (!annotate) {
        doc.querySelectorAll('.t42-selected').forEach((n) => n.classList.remove('t42-selected'))
        el.classList.add('t42-selected')
      }
      const shown = (el.innerText !== undefined ? el.innerText : el.textContent) || ''
      applyPickRef.current({
        selector: computeSelector(el),
        tag: el.tagName.toLowerCase(),
        text: shown.trim().slice(0, 120),
        styles: readStyles(el),
        html: el.outerHTML.slice(0, 1000)
      })
    }
    doc.addEventListener('click', click, true)
    handlersRef.current.click = click
  }

  // Iframe onLoad: rebind our click handlers and restore the pre-reload scroll
  // position so live updates feel in-place rather than snapping to the top.
  const onIframeLoad = (): void => {
    bridge.loaded()
    refreshIframeBindings()
    if (pendingScrollRef.current != null) {
      const y = pendingScrollRef.current
      pendingScrollRef.current = null
      requestAnimationFrame(() => { void bridge.scrollTo(y) })
    }
  }

  // Keep DOM in sync with React state. Polls a few times because the
  // iframe's contentDocument may not be the new one immediately after
  // srcDoc changes (onLoad fires too, but we don't want to depend on that).
  useEffect(() => {
    let cancelled = false
    const tries = [0, 50, 200, 500, 1200]
    tries.forEach((delay) => {
      setTimeout(() => {
        if (cancelled) return
        refreshIframeBindings()
      }, delay)
    })
    if (!annotate) { setPick(null); setPickComment('') }
    if (!editMode) { setEditPick(null) }
    if (!motionMode) { setMotionPick(null) }
    if (!shaderMode) { setShaderPick(null) }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotate, editMode, motionMode, shaderMode, activeContent])

  // Slide nav: read directly from iframe DOM. Same polling treatment so
  // count populates even if onLoad fires before contentDocument is ready.
  useEffect(() => {
    if (profile.id !== 'slides') return
    let cancelled = false
    // The slide width is the slide's own, not the viewport's: a 16:9 deck is
    // typically 1920 wide inside a much narrower frame, and dividing by the
    // frame makes the index drift. The bridge measures it on either side.
    const update = (): void => {
      void bridge.slides().then(({ count, index }) => {
        if (cancelled) return
        setSlideCount(count)
        setSlideIdx(count === 0 ? 0 : Math.max(0, Math.min(count - 1, index)))
      })
    }
    const tries = [0, 100, 300, 800, 1500]
    tries.forEach((delay) => {
      setTimeout(() => { if (!cancelled) update() }, delay)
    })
    // Listen on the iframe's body (not window) since body is the scroll
    // container with overflow-x:auto. A served page cannot be listened to
    // from here; its agent reports the move instead.
    const doc = served ? null : iframeDoc()
    const body = doc?.body
    const onScroll = (): void => update()
    body?.addEventListener('scroll', onScroll, { passive: true } as AddEventListenerOptions)
    iframeRef.current?.contentWindow?.addEventListener('scroll', onScroll, { passive: true } as AddEventListenerOptions)
    return () => {
      cancelled = true
      body?.removeEventListener('scroll', onScroll)
      iframeRef.current?.contentWindow?.removeEventListener('scroll', onScroll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, activeContent, bridge])

  // Read :root design tokens from the iframe: for the project-level inspector
  useEffect(() => {
    let cancelled = false
    const read = (): void => {
      void bridge.tokens().then((tokens) => {
        if (!cancelled && tokens.length) setProjectTokens(tokens)
      })
    }
    const tries = [0, 200, 600, 1200]
    tries.forEach((delay) => setTimeout(() => { if (!cancelled) read() }, delay))
    return () => { cancelled = true }
    // Also on the bridge: a served app gets its own the moment the canvas
    // learns it is served, which is after the content is in hand, and the
    // reading taken through the one before it would be of nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContent, bridge])

  const setProjectToken = (name: string, value: string): void => {
    void bridge.setToken(name, value)
    setProjectTokens((tt) => tt.map((t) => t.name === name ? { ...t, value } : t))
    setEditChanges((n) => n + 1)
  }

  // Tweak spec is still iframe→parent via postMessage (works because the
  // injected runner posts on load AND the parent listens at mount).
  useEffect(() => {
    const onMsg = (e: MessageEvent): void => {
      if (!e.data || typeof e.data !== 'object') return
      if (e.data.type === 't42-tweak-spec') {
        const s = (e.data.spec ?? null) as TweakSpec | null
        setTweakSpec(s)
        const initial: Record<string, unknown> = {}
        s?.groups?.forEach((g) => g.controls?.forEach((c) => { initial[c.id] = c.default }))
        setTweakValues(initial)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // Mutually exclusive overlays
  const enterAnnotate = (): void => { setEditMode(false); setCompareMode(false); setMotionMode(false); setShaderMode(false); setAnnotate((a) => !a) }
  const enterEdit     = (): void => { setAnnotate(false); setCompareMode(false); setMotionMode(false); setShaderMode(false); setEditMode((e) => !e) }
  const enterMotion   = (): void => { setAnnotate(false); setEditMode(false); setCompareMode(false); setShaderMode(false); setMotionMode((m) => !m) }
  const enterShader   = (): void => { setAnnotate(false); setEditMode(false); setCompareMode(false); setMotionMode(false); setShaderMode((s) => !s) }
  const enterCompare  = (): void => {
    setAnnotate(false); setEditMode(false); setMotionMode(false); setShaderMode(false)
    if (!compareMode && !compareLeftId) {
      const prev = versions[activeIndex - 1] ?? versions[0]
      if (prev) setCompareLeftId(prev.id)
    }
    setCompareMode((c) => !c)
  }

  // Apply a style change to the currently selected element directly.
  const setEditStyle = (prop: string, value: string | number, unit?: string): void => {
    if (!editPick) return
    const v = String(value) + (unit ?? '')
    // The four named ones are shorthands the inspector offers; everything
    // else is the CSS property spelled the way CSS spells it.
    const [cssProp, cssValue] =
      prop === 'background' ? ['background-color', String(value)]
      : prop === 'color' ? ['color', String(value)]
      : prop === 'fontWeight' ? ['font-weight', String(value)]
      : prop === 'paddingAll' ? ['padding', String(value) + 'px']
      : [prop.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()), v]
    void bridge.setStyle(editPick.selector, cssProp, cssValue)
    setEditChanges((n) => n + 1)
    // Reflect in inspector
    if (editPick) {
      const next: ElementStyles = { ...editPick.styles }
      if (prop === 'color') next.color = String(value)
      else if (prop === 'background') next.background = String(value)
      else if (prop === 'fontSize') next.fontSize = Number(value)
      else if (prop === 'fontWeight') next.fontWeight = Number(value)
      else if (prop === 'borderRadius') next.borderRadius = Number(value)
      else if (prop === 'paddingAll') {
        const n = Number(value)
        next.paddingTop = n; next.paddingRight = n; next.paddingBottom = n; next.paddingLeft = n
      }
      setEditPick({ ...editPick, styles: next })
    }
  }

  const setEditText = (text: string): void => {
    if (!editPick) return
    void bridge.setText(editPick.selector, text)
    setEditChanges((n) => n + 1)
    setEditPick({ ...editPick, styles: { ...editPick.styles, text } })
  }

  const syncEdits = async (): Promise<void> => {
    const changes = await bridge.changes()
    if (!changes.length) return
    const lines = changes.map((c) => `- \`${c.selector}\`${c.text ? ` ("${c.text}")` : ''} → \`${c.style}\``).join('\n')
    const text = `Apply these direct edits I made on the canvas: bake them into the next version (you can refactor into proper CSS variables / classes if cleaner):\n\n${lines}`
    // User-visible summary — just how many edits, no CSS or selectors.
    const displayText = `Apply ${changes.length} direct edit${changes.length === 1 ? '' : 's'} I made on the canvas.`
    setEditMode(false); setEditPick(null); setEditChanges(0)
    // Route through the chat rail's send pipeline (queue-when-busy, error
    // surfacing, per-message plan) instead of calling designs.send
    // directly. The rail listens for `t42:design-prompt` events.
    window.dispatchEvent(new CustomEvent('t42:design-prompt', {
      detail: { designId, text, displayText, source: 'edit' }
    }))
  }

  // Slide navigation. The bridge does the arithmetic on whichever side the
  // page is, since only that side can measure a slide.
  const slideJump = (dir: -1 | 1): void => {
    void bridge.slides().then(({ count, index }) => {
      if (!count) return
      const next = Math.max(0, Math.min(count - 1, index + dir))
      // Move the counter now: the smooth scroll takes a moment to settle
      // and a toolbar that waits for it feels broken.
      setSlideIdx(next)
      void bridge.slideTo(next)
    })
  }
  const slidePrev = (): void => slideJump(-1)
  const slideNext = (): void => slideJump(1)

  const sendComment = async (): Promise<void> => {
    if (!pick) return
    const note = pickComment.trim()
    if (!note) return

    // Build TWO versions of the prompt:
    //   - `text` (what the model sees): includes the CSS selector and
    //     any visible element text so the model can locate the element
    //     in the next render.
    //   - `displayText` (what the user sees in chat): just their note,
    //     optionally prefixed with the element's visible text in quotes
    //     so the chat reads as natural English. The selector is hidden.
    //
    // Example user-visible:
    //   "Dashboard MA" — Move the header to the top
    // Example model-facing:
    //   On the canvas, the element `header.topbar` ("Dashboard MA"):
    //   move the header to the top
    const elementLabel = pick.text ? pick.text.trim().replace(/\s+/g, ' ').slice(0, 60) : ''
    const elementCaption = elementLabel
      ? `"${elementLabel}"`
      : friendlyElementLabel(pick.selector)
    const text = `On the canvas, the element \`${pick.selector}\`${pick.text ? ` ("${pick.text}")` : ''}: ${note}`
    const displayText = elementCaption ? `${elementCaption}: ${note}` : note

    setPick(null); setPickComment(''); setAnnotate(false)
    // Route through the chat rail's send pipeline so the annotation
    // shares the rail's queue (if a previous run is still busy) and gets
    // error feedback as a system message.
    window.dispatchEvent(new CustomEvent('t42:design-prompt', {
      detail: { designId, text, displayText, source: 'annotation' }
    }))
  }

  const reload = (): void => setReloadKey((k) => k + 1)
  const openExternal = (): void => { if (active) void window.terminal42.designs.openExternal(active.fileUrl) }

  // ── Motion engine: bake animations straight into the design file ──────────
  const uniqueName = (sel: string): string => {
    let h = 0
    for (let i = 0; i < sel.length; i++) h = (Math.imul(31, h) + sel.charCodeAt(i)) | 0
    return `t42m_${sel.replace(/[^a-z0-9]/gi, '').slice(0, 16) || 'el'}_${Math.abs(h).toString(36)}`
  }
  const bakeMotion = (map: Record<string, MotionSpec>): void => {
    const css = Object.entries(map)
      .map(([sel, spec]) => generateMotionCss(sel, spec, { playback: 'once' }))
      .join('\n\n')
    void window.terminal42.designs.applyEdit(designId, 't42-motion', css)
  }
  const applyMotionPreset = (presetId: string): void => {
    if (!motionPick) return
    const sel = motionPick.selector
    const spec: MotionSpec = { ...presetSpec(presetId), name: uniqueName(sel) }
    const map = { ...motionMap, [sel]: spec }
    setMotionPick(null)
    setMotionMap(map)
    bakeMotion(map)
  }
  const openTimeline = (): void => {
    if (!motionPick) return
    setTimelineFor(motionPick.selector)
    setMotionPick(null)
  }
  const applyTimeline = (sel: string, spec: MotionSpec): void => {
    const named: MotionSpec = { ...spec, name: uniqueName(sel) }
    const map = { ...motionMap, [sel]: named }
    setMotionMap(map)
    bakeMotion(map)
  }

  // ── Shader engine: bake a WebGL background effect into the design file ─────
  const bakeShaders = (map: Record<string, { shader: ShaderId; color: string; intensity: number }>): void => {
    const configs: ShaderConfig[] = Object.entries(map).map(([selector, v]) => ({ selector, ...v }))
    void window.terminal42.designs.applyEdit(designId, 't42-shader', buildShaderScript(configs), 'script')
  }
  const applyShader = (): void => {
    if (!shaderPick) return
    const { selector, shader, color, intensity } = shaderPick
    const map = { ...shaderMap, [selector]: { shader, color, intensity } }
    setShaderPick(null)
    setShaderMap(map)
    bakeShaders(map)
  }

  // ─── Brain Check ────────────────────────────────────────────────────────
  // Dead simple: read the brain markdown, paste it as a prompt in the chat.
  // Same as if the user copied their brain notes and pasted them.
  const runBrainCheck = async (): Promise<void> => {
    if (brainCheckRunning) return
    setBrainCheckRunning(true)
    setBrainCheckProgress('Applying…')
    brainCheckCancelledRef.current = false

    try {
      const md = await window.terminal42.memory.read()
      if (!md?.trim()) {
        window.dispatchEvent(new CustomEvent('t42:design-system-message', {
          detail: { designId, text: 'No brain content found. Add notes in the Brain tab first.' }
        }))
        setBrainCheckRunning(false)
        setBrainCheckProgress('')
        return
      }

      // Just send the brain content as a prompt — like pasting it in the chat
      window.dispatchEvent(new CustomEvent('t42:design-prompt', {
        detail: {
          designId,
          text: 'IMPORTANT: Do NOT output a plan checklist. Do NOT emit ```plan or ```plan-update blocks. Just directly apply the changes to the HTML/CSS file.\n\nApply the following to this design:\n\n' + md.trim(),
          displayText: 'Brain check',
          source: 'event',
          mode: 'autopilot'
        }
      }))

      await waitUntilIdle(designId, brainCheckCancelledRef, 600_000)
    } catch (err) {
      window.dispatchEvent(new CustomEvent('t42:design-system-message', {
        detail: { designId, text: `Brain check error: ${String(err)}` }
      }))
    } finally {
      setBrainCheckRunning(false)
      setBrainCheckProgress('')
    }
  }

  const cancelBrainCheck = (): void => {
    brainCheckCancelledRef.current = true
    void window.terminal42.designs.cancel(designId)
  }

  // "Send to Figma": instructs Copilot to use the figma MCP write tools
  // to either create a new file or push into an existing one. The Figma
  // button only renders if the kind makes sense in Figma (e.g. emails
  // are excluded — see canExportToFigma in src/main/design.ts).
  const [figmaDialogOpen, setFigmaDialogOpen] = useState(false)
  const [canFigma, setCanFigma] = useState(false)
  useEffect(() => {
    setCanFigma(false)
    void window.terminal42.designs.canFigma(designId).then(setCanFigma)
  }, [designId])
  const openFigmaDialog = (): void => { if (active && canFigma) setFigmaDialogOpen(true) }
  const sendToFigma = async (opts: { mode: 'newFile' | 'existingFile'; fileUrl?: string }): Promise<void> => {
    setFigmaDialogOpen(false)
    if (!active) return
    // Optimistic system message so the user sees something happen
    // immediately — the real Figma URL takes 30-60s to come back from
    // the model and lands in chat as part of its reply.
    const where = opts.mode === 'newFile'
      ? 'a new Figma file'
      : (opts.fileUrl ? 'your existing Figma file' : 'a Figma file')
    window.dispatchEvent(new CustomEvent('t42:design-system-message', {
      detail: { designId, text: `Sending design to ${where}… (this can take 30-60s; the Figma URL will appear in the reply when ready)` }
    }))
    try {
      const res = await window.terminal42.designs.sendToFigma(designId, opts)
      if (!res.ok) {
        window.dispatchEvent(new CustomEvent('t42:design-system-message', {
          detail: { designId, text: `Couldn't send to Figma: ${res.error}` }
        }))
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('t42:design-system-message', {
        detail: { designId, text: `Couldn't send to Figma: ${String(err)}` }
      }))
    }
  }

  // Scale the artboard. 'fit' computes against the available viewport area.
  const stageRef = useRef<HTMLDivElement>(null)
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setStageSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const computedScale = useMemo(() => {
    if (zoom !== 'fit') return zoom
    if (!viewport.width) return 1
    const padding = 32
    const availW = Math.max(100, stageSize.w - padding)
    const availH = Math.max(100, stageSize.h - padding)
    const sw = availW / viewport.width
    const sh = viewport.height ? availH / viewport.height : 1
    return Math.min(1, sw, viewport.height ? sh : sw)
  }, [zoom, viewport.width, viewport.height, stageSize.w, stageSize.h])

  const cycleZoom = (dir: -1 | 1): void => {
    const idx = ZOOM_LEVELS.indexOf(typeof zoom === 'number' ? zoom : 1)
    const nextIdx = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, (idx === -1 ? ZOOM_LEVELS.indexOf(1) : idx) + dir))
    setZoom(ZOOM_LEVELS[nextIdx])
  }

  // Title editing — when DesignCanvas is mounted inside DesignWorkspace
  // it gets a `title` + `onRename` and renders the editable title at the
  // start of the toolbar. The workspace no longer needs a separate
  // header row — everything fits on one toolbar.
  const [editingTitle, setEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title ?? '')
  useEffect(() => { setDraftTitle(title ?? '') }, [title])
  const commitTitle = (): void => {
    const t = draftTitle.trim()
    if (t && onRename && t !== title) onRename(t)
    setEditingTitle(false)
  }

  return (
    <div className="flex h-full w-full flex-col bg-surface">
      {/* Toolbar — single row containing back, title, reload, version
          picker, viewport tabs, slide nav, zoom, annotate/edit/export
          /figma/open, and close. Replaces the old two-row layout. */}
      <div className="flex h-11 shrink-0 items-center bg-surface px-2">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Back to projects"
            aria-label="Back to projects"
            className="grid h-7 w-7 place-items-center rounded-md text-text-secondary hover:bg-elevated hover:text-text-primary"
          >
            <IconChevronRight size={13} className="rotate-180" />
          </button>
        )}
        {title !== undefined && (
          editingTitle ? (
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle()
                if (e.key === 'Escape') { setDraftTitle(title ?? ''); setEditingTitle(false) }
              }}
              className="ml-1 h-7 max-w-[240px] rounded-md bg-elevated px-2 text-[13px] text-text-primary focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => onRename && setEditingTitle(true)}
              title={onRename ? 'Rename design' : title}
              className="ml-1 max-w-[240px] truncate rounded-md px-2 py-1 text-left text-[13px] font-medium text-text-primary hover:bg-elevated disabled:opacity-100"
              disabled={!onRename}
            >
              {title}
            </button>
          )
        )}
        {(onClose || title !== undefined) && <ToolbarDivider />}
        <button
          type="button"
          onClick={reload}
          disabled={!active}
          title="Reload"
          className="grid h-7 w-7 place-items-center rounded-md text-text-secondary hover:bg-elevated hover:text-text-primary disabled:opacity-40"
        >
          <IconRefresh size={12} />
        </button>
        {active && (
          <div className="ml-1">
            <VersionPicker
              versions={versions}
              activeId={activeId}
              onPick={(id) => {
                setActiveId(id)
                setStickToLatest(id === versions[versions.length - 1].id)
                setReloadKey((k) => k + 1)
              }}
              open={versionsOpen}
              setOpen={setVersionsOpen}
            />
          </div>
        )}

        <ToolbarDivider />

        {/* Viewport tabs (kind-specific). For the well-known device viewports
            we render an icon instead of the text label; everything else (named
            artboard sizes like "1920 × 1080") keeps its short text label. */}
        <div className="flex items-center gap-0.5 rounded-md bg-elevated p-0.5">
          {profile.viewports.map((v) => {
            const Icon = v.id === 'mobile' ? IconMobile
                       : v.id === 'tablet' ? IconTablet
                       : v.id === 'desktop' ? IconDesktop
                       : v.id === 'fluid'  ? IconFluid
                       : null
            const active = viewportId === v.id
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setViewportId(v.id)}
                title={v.label}
                aria-label={v.label}
                aria-pressed={active}
                className={[
                  Icon ? 'grid h-6 w-7 place-items-center rounded' : 'rounded px-2 py-0.5 text-[11px]',
                  'transition-colors',
                  active ? 'bg-surface text-text-primary' : 'text-text-secondary hover:text-text-primary'
                ].join(' ')}
              >
                {Icon ? <Icon size={14} /> : shortViewport(v.label)}
              </button>
            )
          })}
        </div>

        {/* Slide navigation (decks only) */}
        {profile.id === 'slides' && <>
          <ToolbarDivider />
          <div className="flex items-center gap-0.5 rounded-md bg-elevated p-0.5">
            <button
              type="button"
              onClick={slidePrev}
              disabled={slideIdx <= 0}
              title="Previous slide (←)"
              className="grid h-6 w-6 place-items-center rounded text-text-secondary hover:text-text-primary disabled:opacity-30"
            >
              <IconChevronRight size={11} className="rotate-180" />
            </button>
            <span className="min-w-[44px] px-1 text-center text-[11px] font-medium text-text-primary">
              {slideCount ? `${slideIdx + 1} / ${slideCount}` : ': / :'}
            </span>
            <button
              type="button"
              onClick={slideNext}
              disabled={slideCount === 0 || slideIdx >= slideCount - 1}
              title="Next slide (→)"
              className="grid h-6 w-6 place-items-center rounded text-text-secondary hover:text-text-primary disabled:opacity-30"
            >
              <IconChevronRight size={11} />
            </button>
          </div>
        </>}

        {/* Zoom controls (only for kinds that need them) */}
        {profile.showZoom && <>
          <ToolbarDivider />
          <div className="flex items-center gap-0.5 rounded-md bg-elevated p-0.5">
            <button
              type="button"
              onClick={() => cycleZoom(-1)}
              title="Zoom out"
              className="grid h-6 w-6 place-items-center rounded text-text-secondary hover:text-text-primary"
            >−</button>
            <button
              type="button"
              onClick={() => setZoom((z) => z === 'fit' ? 1 : 'fit')}
              title={zoom === 'fit' ? 'Click for 100%' : 'Click for Fit'}
              className="min-w-[44px] rounded px-1 py-0.5 text-center text-[11px] text-text-secondary hover:text-text-primary"
            >
              {zoom === 'fit' ? `${Math.round(computedScale * 100)}% · Fit` : `${Math.round(computedScale * 100)}%`}
            </button>
            <button
              type="button"
              onClick={() => cycleZoom(1)}
              title="Zoom in"
              className="grid h-6 w-6 place-items-center rounded text-text-secondary hover:text-text-primary"
            >+</button>
          </div>
        </>}

        <div className="ml-auto flex items-center gap-1">
          {/* One picker, because these five are one choice: each enter* turns
              the others off. Five labelled buttons said so nowhere and pushed
              the rest of the bar off the end of the row. Only the chosen one
              carries its name; the others are their icon, as the viewport
              pills already are. */}
          {/* An app built around a router is served from a loopback origin
              (see src/main/spa.ts) whose document this window may not read.
              The picking modes work there all the same: they go through the
              agent the served page carries. See src/shared/frameAgent.ts. */}
          <ModePicker
            modes={[
              { id: 'annotate', label: 'Annotate', on: 'Annotating',
                hint: 'Click an element to leave a comment for the AI',
                active: annotate, disabled: empty, onPick: enterAnnotate,
                icon: <IconChat size={12} /> },
              { id: 'edit', label: 'Edit', on: 'Editing',
                hint: 'Edit elements (granular) or project tokens (global)',
                active: editMode, disabled: empty, onPick: enterEdit,
                icon: <IconEdit size={12} /> },
              { id: 'compare', label: 'Compare', on: 'Comparing',
                hint: versions.length < 2
                  ? 'Compare needs a second version to put beside this one'
                  : 'Put two versions side by side',
                active: compareMode,
                disabled: empty || versions.length < 2 || active?.kind === 'pptx',
                onPick: enterCompare,
                icon: (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="7" height="16" rx="1" />
                    <rect x="14" y="4" width="7" height="16" rx="1" />
                  </svg>
                ) },
              { id: 'motion', label: 'Motion', on: 'Motion on',
                hint: 'Click an element to add an animation',
                active: motionMode, disabled: empty || active?.kind === 'pptx',
                onPick: enterMotion,
                icon: (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h4l2-6 3 14 2-8h3" />
                  </svg>
                ) },
              { id: 'shader', label: 'Shader', on: 'Shader on',
                hint: 'Click an element to add a shader background',
                active: shaderMode, disabled: empty || active?.kind === 'pptx',
                onPick: enterShader,
                icon: (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 0 0 18M5 9h14M5 15h14" />
                  </svg>
                ) }
            ]}
          />
          {brainCheckRunning && (
            <button
              type="button"
              onClick={cancelBrainCheck}
              title="Cancel brain check"
              className="flex h-7 items-center gap-1.5 rounded-md bg-accent/15 px-2 text-[11.5px] text-accent transition-colors hover:bg-accent/25"
            >
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/40" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
              </span>
              <span>{brainCheckProgress}</span>
            </button>
          )}
          <ShareMenu
            designId={designId}
            disabled={empty}
            title={design?.title ?? ''}
            fileName={active?.fileName ?? ''}
            filePath={active?.filePath ?? ''}
            content={activeContent}
          />
          {/* Everything that leaves the app or runs over the whole design.
              None of it is reached often enough to earn a permanent slot,
              and together they were what pushed the bar past its width. */}
          <MoreMenu
            items={[
              ...(design?.brief?.figmaUrl
                ? [{ id: 'ref', label: 'Open the Figma reference',
                     note: 'The file this design was built from',
                     icon: <FigmaPill />,
                     onPick: () => { const u = design?.brief?.figmaUrl; if (u) void window.terminal42.designs.openExternal(u) } }]
                : []),
              ...(canFigma
                ? [{ id: 'figma', label: 'Send to Figma',
                     note: 'Create a new file, or push into an existing one',
                     icon: <FigmaPill />, disabled: !active, onPick: openFigmaDialog }]
                : []),
              { id: 'brain', label: 'Brain check',
                note: 'Apply your brain notes to this design',
                icon: <IconBrain size={12} />, disabled: empty || busy || brainCheckRunning,
                onPick: () => void runBrainCheck() },
              { id: 'external', label: 'Open in your browser',
                note: 'The live page, outside Terminal 42',
                icon: <IconExternal size={12} />, disabled: !active, onPick: openExternal }
            ]}
          />
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close project"
              aria-label="Close project"
              className="grid h-7 w-7 place-items-center rounded-md text-text-secondary hover:bg-elevated hover:text-text-primary"
            >
              <IconClose size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Stage */}
      <div ref={stageRef} className="relative flex flex-1 items-center justify-center overflow-auto rounded-panel bg-bg p-4">
        {editMode && (
          <EditInspector
            pick={editPick}
            onChange={setEditStyle}
            onChangeText={setEditText}
            onClose={() => { setEditPick(null); setEditMode(false) }}
            onSync={() => void syncEdits()}
            hasChanges={editChanges > 0}
            tokens={projectTokens}
            onTokenChange={setProjectToken}
          />
        )}
        {shaderPick && (
          <div className="absolute right-4 top-4 z-30 w-[260px] rounded-lg bg-raised p-3 shadow-overlay">
            <div className="mb-2 flex items-center gap-2 text-[11.5px] text-text-muted">
              <span className="truncate rounded bg-elevated px-1.5 py-0.5 font-mono text-text-secondary">{shaderPick.selector}</span>
            </div>
            <div className="mb-1.5 text-[11px] text-text-muted">Shader effect</div>
            <div className="mb-2 grid grid-cols-3 gap-1">
              {SHADER_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setShaderPick((s) => (s ? { ...s, shader: p.id } : s))}
                  className={[
                    'rounded-md px-2 py-1.5 text-[11px] transition-colors',
                    shaderPick.shader === p.id ? 'bg-action text-action-text' : 'bg-elevated text-text-primary hover:bg-elevated/70'
                  ].join(' ')}
                >{p.label}</button>
              ))}
            </div>
            <label className="mb-2 flex items-center justify-between gap-2 text-[11.5px] text-text-muted">
              <span>Tint</span>
              <input type="color" value={shaderPick.color} onChange={(e) => setShaderPick((s) => (s ? { ...s, color: e.target.value } : s))} className="h-6 w-10 cursor-pointer rounded bg-transparent" />
            </label>
            <label className="mb-2 flex items-center justify-between gap-2 text-[11.5px] text-text-muted">
              <span>Intensity</span>
              <input type="range" min={0.1} max={1} step={0.05} value={shaderPick.intensity} onChange={(e) => setShaderPick((s) => (s ? { ...s, intensity: parseFloat(e.target.value) } : s))} className="w-28" />
            </label>
            <div className="mt-1 flex justify-end gap-2">
              <button type="button" onClick={() => setShaderPick(null)} className="rounded-md px-2 py-1 text-[11.5px] text-text-secondary hover:bg-elevated hover:text-text-primary">Cancel</button>
              <button type="button" onClick={applyShader} className="rounded-md bg-action px-2.5 py-1 text-[11.5px] font-medium text-action-text hover:opacity-90">Apply</button>
            </div>
          </div>
        )}
        {motionPick && (
          <div className="absolute right-4 top-4 z-30 w-[260px] rounded-lg bg-raised p-3 shadow-overlay">
            <div className="mb-2 flex items-center gap-2 text-[11.5px] text-text-muted">
              <span className="truncate rounded bg-elevated px-1.5 py-0.5 font-mono text-text-secondary">{motionPick.selector}</span>
            </div>
            <div className="mb-1.5 text-[11px] text-text-muted">Add an animation</div>
            <div className="flex flex-col gap-1">
              {MOTION_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyMotionPreset(p.id)}
                  className="flex items-center justify-between rounded-md bg-elevated px-2.5 py-1.5 text-left text-[12px] text-text-primary transition-colors hover:bg-action hover:text-action-text"
                >
                  <span>{p.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={openTimeline}
                className="mt-1 flex items-center justify-between rounded-md border border-accent/40 px-2.5 py-1.5 text-left text-[12px] text-accent transition-colors hover:bg-action hover:text-action-text"
              >
                <span>Custom timeline…</span>
              </button>
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setMotionPick(null)}
                className="rounded-md px-2 py-1 text-[11.5px] text-text-secondary hover:bg-elevated hover:text-text-primary"
              >Close</button>
            </div>
          </div>
        )}
        {pick && (
          <div className="absolute right-4 top-4 z-30 w-[300px] rounded-lg bg-raised p-3 shadow-overlay">
            <div className="mb-2 flex items-center gap-2 text-[11.5px] text-text-muted">
              <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-text-secondary">{pick.selector}</span>
            </div>
            {pick.text && (
              <div className="mb-2 truncate text-[11.5px] italic text-text-muted">"{pick.text}"</div>
            )}
            <textarea
              autoFocus
              value={pickComment}
              onChange={(e) => setPickComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void sendComment() }}
              placeholder="What should change here?"
              rows={3}
              className="w-full resize-none rounded-md bg-elevated px-2.5 py-2 text-[12.5px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPick(null)}
                className="rounded-md px-2 py-1 text-[11.5px] text-text-secondary hover:bg-elevated hover:text-text-primary"
              >Cancel</button>
              <button
                type="button"
                onClick={() => void sendComment()}
                disabled={!pickComment.trim()}
                className="rounded-md bg-action px-2.5 py-1 text-[11.5px] font-medium text-action-text hover:opacity-90 disabled:opacity-40"
              >Send</button>
            </div>
          </div>
        )}
        {empty
          ? (busy ? <CanvasGenerating phase={phase} variant={pickAnimationForKind(design?.brief?.kind)} /> : <CanvasEmpty />)
          : compareMode && active && active.kind !== 'pptx' && versions.length >= 2
            ? (
              <DesignCompare
                designId={designId}
                versions={versions}
                leftId={compareLeftId ?? versions[Math.max(0, activeIndex - 1)]?.id ?? active.id}
                rightId={active.id}
                onLeftChange={setCompareLeftId}
              />
            )
          : active
            ? active.kind === 'pptx'
              ? (
                <div className="flex h-full w-full items-center justify-center rounded-lg bg-white shadow-md">
                  {active.previewUrl
                    ? (
                      <iframe
                        key={`${active.id}-${reloadKey}`}
                        ref={iframeRef}
                        src={active.previewUrl}
                        title="Slide preview"
                        className="block h-full w-full border-0 bg-white"
                      />
                    )
                    : (
                      <div className="flex flex-col items-center gap-2 p-12 text-center text-text-muted">
                        <PencilThinking size="md" variant="slides" />
                        <div className="text-[13px] font-medium text-text-primary">Rendering slides…</div>
                        <div className="text-[11.5px]">Converting {active.fileName} via LibreOffice. Refresh in a few seconds.</div>
                      </div>
                    )}
                </div>
              )
              : viewport.width
                ? (
                <div
                  className="overflow-hidden rounded-lg bg-white shadow-md"
                  style={{
                    width:  viewport.width  * computedScale,
                    height: viewport.height ? viewport.height * computedScale : undefined,
                    flexShrink: 0
                  }}
                >
                  <iframe
                    key={`${active.id}-${reloadKey}`}
                    ref={iframeRef}
                    {...(previewSrc ? { src: previewSrc } : { srcDoc: activeContent })}
                    title="Design preview"
                    onLoad={onIframeLoad}
                    className="block border-0 bg-white"
                    style={{
                      width:  viewport.width,
                      height: viewport.height ?? '100%',
                      transform: `scale(${computedScale})`,
                      transformOrigin: 'top left'
                    }}
                  />
                </div>
              )
              : (
                <div className="h-full w-full overflow-auto rounded-lg bg-white shadow-md">
                  <iframe
                    key={`${active.id}-${reloadKey}`}
                    ref={iframeRef}
                    {...(previewSrc ? { src: previewSrc } : { srcDoc: activeContent })}
                    title="Design preview"
                    onLoad={onIframeLoad}
                    className="block border-0 bg-white"
                    style={{
                      width:  typeof zoom === 'number' ? `${100 / zoom}%` : '100%',
                      height: typeof zoom === 'number' ? `${100 / zoom}%` : '100%',
                      transform: typeof zoom === 'number' ? `scale(${zoom})` : 'none',
                      transformOrigin: 'top left'
                    }}
                  />
                </div>
              )
            : null}
        {timelineFor && (
          <MotionTimeline
            selector={timelineFor}
            initial={motionMap[timelineFor] ?? null}
            getDoc={iframeDoc}
            onApply={(spec) => applyTimeline(timelineFor, spec)}
            onClose={() => setTimelineFor(null)}
          />
        )}
      </div>
      {figmaDialogOpen && (
        <FigmaSendDialog
          designTitle={design?.title ?? 'this design'}
          onCancel={() => setFigmaDialogOpen(false)}
          onSend={(opts) => void sendToFigma(opts)}
        />
      )}
    </div>
  )
}

function CanvasEmpty(): JSX.Element {
  return (
    <div className="flex max-w-md flex-col items-center gap-3 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-elevated text-accent">
        <IconSparkle size={22} />
      </div>
      <h2 className="text-[15px] font-medium text-text-primary">Empty canvas</h2>
      <p className="text-[13px] text-text-muted">
        Describe what you want on the left.
      </p>
    </div>
  )
}

function CanvasGenerating({ phase, variant }: { phase: string; variant?: 'signature' | 'slides' | 'chart' | 'page' | 'square' | 'lines' }): JSX.Element {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <PencilThinking size="lg" variant={variant ?? 'signature'} />
      <div className="text-[14px] font-medium text-text-primary">Generating v001</div>
      <div className="text-[12px] text-text-muted">
        {phase}{seconds >= 5 ? ` · ${seconds}s` : ''}
      </div>
    </div>
  )
}

// ─── Share menu ────────────────────────────────────────────────────────────

type Mode = {
  id: string
  /** What the mode is called when it is off. */
  label: string
  /** What it is called when it is on, so the bar reads as a state. */
  on: string
  hint: string
  icon: JSX.Element
  active: boolean
  disabled?: boolean
  onPick: () => void
}

/**
 * The five things you can be doing to a design, as one control.
 *
 * They were five buttons, which read as five independent switches when in
 * fact turning one on turns the rest off. Only the active mode carries its
 * name: naming all five is what made the row too wide to fit, and an icon
 * with a tooltip is how the viewport pills next door already work.
 */
function ModePicker({ modes }: { modes: Mode[] }): JSX.Element {
  return (
    <div role="group" aria-label="Mode" className="flex items-center gap-0.5 rounded-md bg-elevated p-0.5">
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={m.onPick}
          disabled={m.disabled}
          aria-pressed={m.active}
          aria-label={m.label}
          title={m.active ? `Leave ${m.label.toLowerCase()}` : `${m.label} — ${m.hint}`}
          className={[
            'flex h-6 items-center gap-1.5 rounded text-[11.5px] transition-colors disabled:opacity-30',
            m.active ? 'bg-action px-2 text-action-text' : 'w-7 justify-center text-text-secondary hover:text-text-primary'
          ].join(' ')}
        >
          {m.icon}
          {m.active && <span>{m.on}</span>}
        </button>
      ))}
    </div>
  )
}

type MoreItem = {
  id: string
  label: string
  note: string
  icon: JSX.Element
  disabled?: boolean
  onPick: () => void
}

/** The rest of the bar: things worth having, not worth a permanent slot. */
function MoreMenu({ items }: { items: MoreItem[] }): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More"
        title="Figma, brain check, open in your browser"
        className="grid h-7 w-7 place-items-center rounded-md text-text-secondary hover:bg-elevated hover:text-text-primary"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="t42-menu absolute right-0 top-full z-30 mt-1 min-w-[240px] overflow-hidden rounded-md bg-raised py-1 shadow-overlay">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => { setOpen(false); it.onPick() }}
              className="flex w-full items-start gap-2.5 px-3 py-1.5 text-left hover:bg-elevated disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <span className="mt-[3px] shrink-0 text-text-secondary">{it.icon}</span>
              <span className="min-w-0">
                <span className="block text-[12.5px] text-text-primary">{it.label}</span>
                <span className="block text-[11px] text-text-muted">{it.note}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const FORMAT_LABEL: Record<string, string> = {
  pdf:  'Export as PDF',
  png:  'Export as PNG',
  pptx: 'Export as PowerPoint',
  html: 'Export as HTML'
}

type ShareMenuProps = {
  designId: string
  disabled: boolean
  title: string
  fileName: string
  filePath: string
  content: string
}

function ShareMenu({ designId, disabled, title, fileName, filePath, content }: ShareMenuProps): JSX.Element {
  const [open, setOpen] = useState(false)
  // What was last put on the clipboard, so the menu can say it took.
  const [copied, setCopied] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Start empty — formatsForKind never returns []; the load below
  // populates the real list. Avoids briefly showing HTML when the kind
  // actually supports more (or fewer) formats.
  const [formats, setFormats] = useState<Array<'html' | 'pdf' | 'png' | 'pptx'>>([])
  // A finished export used to be a line of chat text and nothing else, so the
  // file it wrote was only findable by reading a path and going looking for it.
  // This holds the last success long enough to offer a way straight to it.
  const [done, setDone] = useState<{ path: string; label: string } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load formats once per designId. We don't gate this on `disabled`
    // because the kind never changes while a design is open; otherwise
    // the menu shows stale formats from a previous design.
    void window.terminal42.designs.formats(designId).then(setFormats)
  }, [designId])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // The confirmation is a claim about a file on disk, so it stops being true
  // as soon as the design changes underneath it.
  useEffect(() => { setDone(null) }, [designId])

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(null), 12000)
    return () => clearTimeout(t)
  }, [done])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(null), 1600)
    return () => clearTimeout(t)
  }, [copied])

  // The stylesheet and the tokens are read from the version on screen rather
  // than from disk, so what is copied is what is being looked at.
  const css = useMemo(() => extractCss(content), [content])
  const tokens = useMemo(() => extractTokens(css), [css])
  const tokenCount = Object.keys(tokens).length

  const copy = (what: string, text: string): void => {
    setOpen(false)
    void navigator.clipboard.writeText(text).then(
      () => setCopied(what),
      () => window.dispatchEvent(new CustomEvent('t42:design-system-message', {
        detail: { designId, text: `Couldn't copy the ${what.toLowerCase()}` }
      }))
    )
  }

  const doExport = async (fmt: 'html' | 'pdf' | 'png' | 'pptx'): Promise<void> => {
    setOpen(false)
    setDone(null)
    setBusy(true)
    const fmtLabel = FORMAT_LABEL[fmt] ?? fmt.toUpperCase()
    try {
      const res = await window.terminal42.designs.export(designId, fmt)
      if (res.ok) {
        setDone({ path: res.path, label: fmtLabel.replace(/^Export as /, '') })
        // Show the saved path so the user knows where to find the file
        // (and that the export actually succeeded). Truncate the home
        // directory prefix for readability.
        const friendlyPath = res.path.replace(/^\/Users\/[^/]+/, '~')
        window.dispatchEvent(new CustomEvent('t42:design-system-message', {
          detail: { designId, text: `Exported ${fmtLabel.replace(/^Export as /, '')} → ${friendlyPath}` }
        }))
      } else {
        // Don't nag the user when they hit Cancel in the save dialog.
        if (!/cancel/i.test(res.error)) {
          window.dispatchEvent(new CustomEvent('t42:design-system-message', {
            detail: { designId, text: `Couldn't export as ${fmtLabel.replace(/^Export as /, '')}: ${res.error}` }
          }))
        }
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('t42:design-system-message', {
        detail: { designId, text: `Couldn't export as ${fmtLabel.replace(/^Export as /, '')}: ${String(err)}` }
      }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled || busy}
        title="Copy this design, or save it as a file"
        className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] text-text-secondary hover:bg-elevated hover:text-text-primary disabled:opacity-40"
      >
        <IconShare size={12} />
        <span>{busy ? 'Saving…' : copied ? `${copied} copied` : 'Share'}</span>
        <span className="text-[9px] opacity-70">▾</span>
      </button>
      {open && (
        <div className="t42-menu absolute right-0 top-full z-30 mt-1 min-w-[236px] overflow-hidden rounded-md bg-raised py-1 shadow-overlay">
          {/* Copying comes first because it is the quick answer: a path an
              agent can open, or the styles themselves. Saving a file is the
              slower one and waits below. */}
          <p className="px-3 pb-1 pt-1 text-[10px] text-text-muted">Copy</p>
          <ShareItem
            glyph="↗"
            label="Reference"
            note={fileName.replace(/\.[^.]+$/, '') || '—'}
            disabled={!filePath}
            onPick={() => copy('Reference', shareReference({ title, fileName, filePath }))}
          />
          <ShareItem
            glyph="{ }"
            label="Stylesheet"
            note={css ? `${css.split('\n').length} lines` : 'none'}
            disabled={!css}
            onPick={() => copy('Stylesheet', css)}
          />
          <ShareItem
            glyph="--"
            label="Tokens"
            note={tokenCount ? `${tokenCount}` : 'none'}
            disabled={tokenCount === 0}
            onPick={() => copy('Tokens', Object.entries(tokens).map(([k, v]) => `${k}: ${v};`).join('\n'))}
          />
          <p className="px-3 pb-1 pt-2 text-[10px] text-text-muted">Save as</p>
          {formats.length === 0
            ? <p className="px-3 pb-1 text-[11.5px] text-text-muted">Nothing to save yet</p>
            : formats.map((f) => (
              <ShareItem
                key={f}
                glyph={f}
                label={(FORMAT_LABEL[f] ?? f.toUpperCase()).replace(/^Export as /, '')}
                onPick={() => void doExport(f)}
              />
            ))}
        </div>
      )}
      {done && !open && (
        <div className="absolute right-0 top-full z-30 mt-1 flex min-w-[220px] max-w-[320px] items-center gap-2 rounded-md bg-raised p-2 shadow-overlay">
          <IconCheck size={12} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-text-secondary" title={done.path}>
            {done.label} · {done.path.split('/').pop()}
          </span>
          <button
            type="button"
            onClick={() => { void window.terminal42.system.revealFolder(done.path); setDone(null) }}
            className="flex h-6 shrink-0 items-center gap-1 rounded px-1.5 text-[11px] text-text-secondary hover:bg-elevated hover:text-text-primary"
          >
            <IconFolder size={11} />
            <span>Show</span>
          </button>
          <button
            type="button"
            onClick={() => setDone(null)}
            aria-label="Dismiss save confirmation"
            className="grid h-6 w-6 shrink-0 place-items-center rounded text-text-muted hover:bg-elevated hover:text-text-primary"
          >
            <IconClose size={9} />
          </button>
        </div>
      )}
    </div>
  )
}

function ShareItem(
  { glyph, label, note, disabled, onPick }:
  { glyph: string; label: string; note?: string; disabled?: boolean; onPick: () => void }
): JSX.Element {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-text-primary hover:bg-elevated disabled:opacity-35 disabled:hover:bg-transparent"
    >
      <span className="w-9 shrink-0 rounded bg-elevated px-1 py-0.5 text-center text-[10px] text-text-muted">{glyph}</span>
      <span className="min-w-0 flex-1 truncate text-text-secondary">{label}</span>
      {note && <span className="shrink-0 text-[10px] text-text-muted">{note}</span>}
    </button>
  )
}

// ─── Slide deck runner ─────────────────────────────────────────────────────
// Injected into the iframe HTML when profile.id === 'slides'. Turns whatever
// the model produced (typically a vertical stack of <section class="slide">)
// into a horizontal pager: the body becomes a flex row, each slide snaps,
// vertical scrolling is disabled, and the wrapper accepts postMessage
// commands ('prev' | 'next' | 'go') from the parent. It also reports
// {count, index} back to the parent on init / on scroll.
function injectSlideRunner(html: string): string {
  // A deck built on the chassis is already a horizontal snap stage with its
  // own navigation, so this would be a second, conflicting one: turning body
  // into the flex row would lay the frame, the nav cluster and the deck out
  // side by side. Only decks that arrived as a bare stack of sections need it.
  if (/id="deck-runtime"/i.test(html) || /<main[^>]*class="[^"]*\bdeck\b/i.test(html)) return html

  // CSS only: make the slide stack lay out horizontally with snap points.
  // Wheel-to-horizontal + arrow-key nav are kept as a tiny inline script
  // because they live inside the iframe's scroll context.
  const css = `
<style>
  html, body {
    height: 100%;
    width: 100%;
    margin: 0;
    overflow: hidden !important;
    background: #1a1a1a;
  }
  body {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: stretch !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    gap: 0 !important;
    padding: 0 !important;
  }
  body > section.slide,
  body > .slide,
  body > [data-slide],
  body > section {
    flex: 0 0 100% !important;
    width: 100vw !important;
    height: 100vh !important;
    scroll-snap-align: start;
    overflow: hidden;
    box-sizing: border-box;
  }
  body::-webkit-scrollbar { display: none; }
</style>`
  const js = `
<script>
(function () {
  // Vertical wheel → horizontal scroll, so wheel-mouse users can pan slides.
  document.addEventListener('wheel', function (e) {
    var dx = Math.abs(e.deltaX), dy = Math.abs(e.deltaY);
    if (dy > dx) {
      window.scrollBy({ left: e.deltaY, behavior: 'auto' });
      e.preventDefault();
    }
  }, { passive: false });
  // Arrow-key / PageUp / PageDown / Space slide nav.
  document.addEventListener('keydown', function (e) {
    var sels = document.querySelectorAll('section.slide, .slide, [data-slide], body > section');
    if (!sels.length) return;
    var w = window.innerWidth;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
      window.scrollBy({ left: w, behavior: 'smooth' }); e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      window.scrollBy({ left: -w, behavior: 'smooth' }); e.preventDefault();
    }
  });
})();
</script>`
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, css + js + '</body>')
  return html + css + js
}

// Tiny Figma logo for the canvas toolbar pill.
// ─── DOM helpers used by direct-iframe Annotate / Edit ───────────────────

// Reduce a selector like `html.t42-anno > body > div.app > header.topbar`
// to a short, human-readable noun like `header` or `nav · primary` for
// use in chat captions. Drops noisy framework prefixes (html, body,
// t42-* annotation classes), keeps the most specific terminal element.
function friendlyElementLabel(selector: string): string {
  if (!selector) return 'this element'
  const segs = selector.split('>').map((s) => s.trim()).filter(Boolean)
  if (!segs.length) return 'this element'
  const last = segs[segs.length - 1]
  // Strip nth-of-type and the t42-* helper classes we inject.
  const cleaned = last
    .replace(/:nth-of-type\(\d+\)/g, '')
    .split('.')
    .filter((c) => !c.startsWith('t42-'))
    .filter(Boolean)
  if (!cleaned.length) return 'this element'
  const tag = cleaned[0]
  const cls = cleaned.slice(1).join('.')
  if (!cls) return `<${tag}>`
  // For semantic tags like header/nav/main/footer, the class adds detail.
  return `<${tag}> · ${cls}`
}

function ToolbarDivider(): JSX.Element {
  return <span aria-hidden="true" className="mx-2" />
}

function FigmaPill(): JSX.Element {
  return (
    <svg width="11" height="13" viewBox="0 0 24 32" aria-hidden="true">
      <path fill="#F24E1E" d="M8 0a4 4 0 0 0 0 8h4V0H8z" />
      <path fill="#A259FF" d="M8 8a4 4 0 0 0 0 8h4V8H8z" />
      <path fill="#0ACF83" d="M8 16a4 4 0 0 0 0 8h4v-8H8z" />
      <path fill="#FF7262" d="M12 0h4a4 4 0 0 1 0 8h-4V0z" />
      <circle fill="#1ABCFE" cx="16" cy="12" r="4" />
    </svg>
  )
}

function FigmaSendDialog({ designTitle: _designTitle, onCancel, onSend }: {
  designTitle: string
  onCancel: () => void
  onSend: (opts: { mode: 'newFile' | 'existingFile'; fileUrl?: string }) => void
}): JSX.Element {
  const [mode, setMode] = useState<'newFile' | 'existingFile'>('newFile')
  const [url, setUrl] = useState('')
  const trimmedUrl = url.trim()
  const urlValid = !trimmedUrl || /figma\.com\/(design|file|board|proto)\/[A-Za-z0-9]{8,40}/i.test(trimmedUrl)
  const canSend = mode === 'newFile' || (urlValid && trimmedUrl.length > 0)

  const submit = (): void => {
    if (!canSend) return
    onSend(mode === 'existingFile' ? { mode, fileUrl: trimmedUrl } : { mode })
  }

  return (
    <Modal title="Send to Figma" onClose={onCancel} size="small">
        <header className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
          <div className="flex items-center gap-2">
            <FigmaPill />
            <h2 className="text-[15px] font-semibold text-text-primary">Send to Figma</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md text-text-muted hover:bg-elevated hover:text-text-primary"
          >
            <IconClose size={11} />
          </button>
        </header>
        <div className="space-y-1.5 px-5 pb-2 pt-2">
          <ModeRow
            id="newFile"
            label="New file"
            selected={mode === 'newFile'}
            onSelect={() => setMode('newFile')}
          />
          <ModeRow
            id="existingFile"
            label="Existing file"
            selected={mode === 'existingFile'}
            onSelect={() => setMode('existingFile')}
          />
        </div>

        {mode === 'existingFile' && (
          <div className="px-5 pb-3">
            <label className="mb-1 block text-[11.5px] font-medium text-text-secondary">
              Figma file URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSend) submit() }}
              placeholder="https://www.figma.com/design/ABC123…/MyFile"
              className="w-full rounded-md bg-elevated/60 px-3 py-2 text-[12.5px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-accent/40"
              autoFocus
            />
            {trimmedUrl && !urlValid && (
              <div className="mt-1.5 text-[11px] text-error">
                Doesn't look like a Figma file URL. Expected: https://www.figma.com/design/&lt;key&gt;/…
              </div>
            )}
          </div>
        )}

        <footer className="flex items-center justify-end gap-2 bg-bg/40 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-[12.5px] text-text-secondary hover:bg-elevated hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="rounded-md bg-action px-3.5 py-1.5 text-[12.5px] font-medium text-action-text hover:opacity-90 disabled:opacity-30"
          >
            Send to Figma
          </button>
        </footer>
    </Modal>
  )
}

function ModeRow({ id, label, selected, onSelect }: {
  id: string
  label: string
  selected: boolean
  onSelect: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        selected ? 'bg-accent/15 ring-1 ring-accent/40' : 'bg-elevated/40 hover:bg-elevated/70'
      ].join(' ')}
    >
      <span
        className={[
          'grid h-3.5 w-3.5 flex-shrink-0 place-items-center rounded-full',
          selected ? 't42-dot-on' : 't42-dot-empty'
        ].join(' ')}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
      </span>
      <span className="block text-[12.5px] font-medium text-text-primary">{label}</span>
      <span className="sr-only">{id}</span>
    </button>
  )
}

// ─── Annotator ─────────────────────────────────────────────────────────────
// Injected once into every iframe (regardless of profile). Listens for
// {type:'t42-annotate-mode', on:bool} from parent. When on, hovering paints
// a dashed accent outline; clicking captures a stable selector + short text
// snippet for the element and posts back {type:'t42-annotate-pick', selector,
// text, rect}. Click events are otherwise consumed so the design's own JS
// doesn't trigger.
// CSS-only injector: paints the hover/selected outlines for Annotate and
// Edit modes. Click handling now happens in the parent via direct
// contentDocument access (much more reliable than postMessage).
function DesignCompare({ designId, versions, leftId, rightId, onLeftChange }: {
  designId: string
  versions: DesignVersion[]
  leftId: string
  rightId: string
  onLeftChange: (id: string) => void
}): JSX.Element {
  const [leftHtml, setLeftHtml] = useState('')
  const [rightHtml, setRightHtml] = useState('')
  const left = versions.find((v) => v.id === leftId) ?? null
  const right = versions.find((v) => v.id === rightId) ?? null

  useEffect(() => {
    let cancelled = false
    const load = async (v: DesignVersion | null, set: (s: string) => void): Promise<void> => {
      if (!v || v.kind === 'pptx') { set(''); return }
      const res = await window.terminal42.designs.readVersion(designId, v.fileName)
      if (!cancelled) set(res.ok ? res.content : `<!doctype html><pre style="padding:24px;font:13px ui-monospace">Failed to load: ${res.error}</pre>`)
    }
    void load(left, setLeftHtml)
    void load(right, setRightHtml)
    return () => { cancelled = true }
  }, [designId, leftId, rightId])

  const cell = (v: DesignVersion | null, html: string, header: JSX.Element): JSX.Element => (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-md">
      <div className="flex items-center justify-between gap-2 bg-elevated/60 px-2.5 py-1.5 text-[11.5px] text-text-secondary">
        {header}
        <span className="shrink-0 text-text-muted">{v ? new Date(v.modifiedAt).toLocaleTimeString() : ''}</span>
      </div>
      <iframe
        srcDoc={html}
        title={`Compare ${v?.fileName ?? ''}`}
        sandbox="allow-same-origin allow-scripts"
        className="block w-full flex-1 border-0 bg-white"
      />
    </div>
  )

  return (
    <div className="absolute inset-0 flex gap-3 p-4">
      {cell(left, leftHtml, (
        <select
          value={leftId}
          onChange={(e) => onLeftChange(e.target.value)}
          className="max-w-[60%] truncate rounded bg-elevated px-1.5 py-0.5 text-[11.5px] text-text-primary focus:outline-none"
          title="Compare against"
        >
          {versions.filter((v) => v.kind !== 'pptx').map((v) => (
            <option key={v.id} value={v.id}>{v.fileName}</option>
          ))}
        </select>
      ))}
      {cell(right, rightHtml, <span className="font-medium text-text-primary">Latest · {right?.fileName}</span>)}
    </div>
  )
}

function injectAnnotator(html: string): string {
  const css = `
<style>
  html.t42-anno, html.t42-anno body { cursor: crosshair !important; }
  html.t42-anno *:hover {
    outline: 2px dashed #dd9b71 !important;
    outline-offset: 2px !important;
  }
  html.t42-edit, html.t42-edit body { cursor: default !important; }
  html.t42-edit *:not(.t42-selected):hover {
    outline: 1px dashed rgba(221,155,113,0.7) !important;
    outline-offset: 1px !important;
  }
  html.t42-edit .t42-selected {
    outline: 2px solid #dd9b71 !important;
    outline-offset: 2px !important;
  }
</style>`
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, css + '</body>')
  return html + css
}

// ─── Tweak runner ──────────────────────────────────────────────────────────
// Looks for a <script id="t42-tweak-spec" type="application/json"> embedded
// in the design HTML and exposes it to the parent. The model is told to
// declare a small spec describing tweakable params per design type, e.g.:
//   { groups: [
//     { name: "Theme", controls: [{id:"theme",label:"Theme",type:"toggle",options:["dark","light"],default:"dark"}] },
//     { name: "Brand", controls: [{id:"primary",label:"Primary",type:"color",default:"#dd9b71",cssVar:"--primary"}] },
//     { name: "Type",  controls: [{id:"size",label:"Heading size",type:"slider",min:24,max:96,step:1,default:48,cssVar:"--h1"}] }
//   ]}
//
// Bindings:
// - color/slider/number → root --<cssVar || id> CSS variable
// - select              → root --<cssVar || id> CSS variable (string)
// - checkbox            → toggles a class on <html>: t42-on-<id>
// - toggle              → sets html.dataset[id] to selected option
//
// All tweaks are applied via inline style on documentElement so they layer on
// top of the design's own CSS variables without re-rendering anything.
function injectTweakRunner(html: string): string {
  const js = `
<script>
(function () {
  function spec() {
    var s = document.getElementById('t42-tweak-spec');
    if (!s) return null;
    try { return JSON.parse(s.textContent || ''); } catch (e) { return null; }
  }
  function apply(id, type, value, cssVar) {
    var root = document.documentElement;
    var key = cssVar || ('--' + id);
    if (type === 'color' || type === 'slider' || type === 'number' || type === 'select') {
      root.style.setProperty(key, String(value));
    } else if (type === 'checkbox') {
      root.classList.toggle('t42-on-' + id, !!value);
    } else if (type === 'toggle') {
      try { root.dataset[id] = String(value); } catch (e) {}
      root.style.setProperty(key, String(value));
    }
  }
  function report() {
    var s = spec();
    parent.postMessage({ type: 't42-tweak-spec', spec: s }, '*');
  }
  window.addEventListener('message', function (e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 't42-tweak-set') {
      apply(e.data.id, e.data.kind, e.data.value, e.data.cssVar);
    } else if (e.data.type === 't42-tweak-reset') {
      var s = spec();
      if (!s || !s.groups) return;
      s.groups.forEach(function (g) {
        (g.controls || []).forEach(function (c) {
          apply(c.id, c.type, c['default'], c.cssVar);
        });
      });
    }
  });
  window.addEventListener('load', report);
  setTimeout(report, 50);
})();
</script>`
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, js + '</body>')
  return html + js
}

// ─── Tweak panel UI ────────────────────────────────────────────────────────

type TweakControl =
  | { id: string; label: string; type: 'color';    cssVar?: string; default?: string }
  | { id: string; label: string; type: 'slider';   cssVar?: string; default?: number;  min: number; max: number; step?: number; unit?: string }
  | { id: string; label: string; type: 'number';   cssVar?: string; default?: number }
  | { id: string; label: string; type: 'checkbox'; cssVar?: string; default?: boolean }
  | { id: string; label: string; type: 'toggle';   cssVar?: string; default?: string;  options: string[] }
  | { id: string; label: string; type: 'select';   cssVar?: string; default?: string;  options: string[] }

type TweakGroup = { name: string; controls: TweakControl[] }
type TweakSpec = { groups: TweakGroup[] }

// ─── Edit mode ─────────────────────────────────────────────────────────────
// VizTweak-style direct editor. When the user toggles 'Edit' on, an injected
// script in the iframe paints a soft accent outline on hover. Clicking any
// element reports its current computed styles to the parent. The parent
// renders an Inspector panel where the user can change text content, font
// size/weight/color, background, padding, border radius: applied live via
// inline styles on that element.
//
// The user can then 'Sync to design' to send all collected edits to the
// chat as an instruction for the model to bake them into the next version.

type EditPick = {
  selector: string
  tag: string
  styles: ElementStyles
  html?: string
}

function injectEditor(html: string): string {
  // No-op: Editor logic moved to direct contentDocument access in the parent.
  return html
}

function EditInspector({ pick, onChange, onChangeText, onClose, onSync, hasChanges, tokens, onTokenChange }: {
  pick: EditPick | null
  onChange: (prop: string, value: string | number, unit?: string) => void
  onChangeText: (text: string) => void
  onClose: () => void
  onSync: () => void
  hasChanges: boolean
  tokens: ProjectToken[]
  onTokenChange: (name: string, value: string) => void
}): JSX.Element {
  const [tab, setTab] = useState<'element' | 'project'>(pick ? 'element' : 'project')
  // Auto-flip to Element tab when something gets picked.
  useEffect(() => { if (pick) setTab('element') }, [pick?.selector])

  return (
    <div className="absolute right-3 top-3 bottom-3 z-30 flex w-[280px] flex-col overflow-hidden rounded-lg bg-raised shadow-overlay">
      {/* Tab strip */}
      <div className="flex items-center gap-1 px-3 pt-2.5">
        <button
          type="button"
          onClick={() => setTab('element')}
          disabled={!pick}
          className={[
            'rounded-md px-2.5 py-1 text-[12px] transition-colors disabled:opacity-30',
            tab === 'element' ? 'bg-elevated text-text-primary' : 'text-text-muted hover:text-text-primary'
          ].join(' ')}
        >Element</button>
        <button
          type="button"
          onClick={() => setTab('project')}
          className={[
            'rounded-md px-2.5 py-1 text-[12px] transition-colors',
            tab === 'project' ? 'bg-elevated text-text-primary' : 'text-text-muted hover:text-text-primary'
          ].join(' ')}
        >Project</button>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="ml-auto grid h-6 w-6 flex-shrink-0 place-items-center rounded text-text-muted hover:bg-elevated hover:text-text-primary"
        >
          <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>
      </div>

      {tab === 'element' && pick ? (
        <ElementInspector pick={pick} onChange={onChange} onChangeText={onChangeText} />
      ) : (
        <ProjectInspector tokens={tokens} onTokenChange={onTokenChange} />
      )}

      <footer className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-[11px] text-text-muted">{hasChanges ? 'Live preview' : 'No edits yet'}</span>
        <button
          type="button"
          onClick={onSync}
          disabled={!hasChanges}
          title="Send your edits to the chat so they bake into the next version"
          className="rounded-md bg-action px-2.5 py-1 text-[11.5px] font-medium text-action-text transition-opacity hover:opacity-90 disabled:opacity-40"
        >Sync to design</button>
      </footer>
    </div>
  )
}

function ElementInspector({ pick, onChange, onChangeText }: {
  pick: EditPick
  onChange: (prop: string, value: string | number, unit?: string) => void
  onChangeText: (text: string) => void
}): JSX.Element {
  const s = pick.styles
  return (
    <div className="flex-1 overflow-y-auto px-3 pb-3 pt-3">
      <div className="mb-3 flex min-w-0 items-center gap-2">
        <span className="rounded bg-elevated px-1.5 py-0.5 text-[10.5px] font-mono text-text-secondary">{pick.tag}</span>
        <span className="truncate text-[11.5px] text-text-muted" title={pick.selector}>{pick.selector}</span>
      </div>

      {pick.html && (
        <Section title="Code">
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md bg-elevated px-2 py-1.5 font-mono text-[10.5px] leading-relaxed text-text-secondary">{pick.html}</pre>
        </Section>
      )}

      {s.isText && (
        <Section title="Text">
          <textarea
            value={s.text}
            onChange={(e) => onChangeText(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-md bg-elevated px-2 py-1.5 text-[12.5px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
        </Section>
      )}

      <Section title="Color">
        <Row label="Text">
          <ColorInput value={s.color} onChange={(v) => onChange('color', v)} />
        </Row>
        <Row label="Background">
          <ColorInput value={s.background} onChange={(v) => onChange('background', v)} />
        </Row>
      </Section>

      <Section title="Type">
        <SliderRow label="Size" value={s.fontSize} min={8} max={120} step={1} unit="px" onChange={(v) => onChange('fontSize', v, 'px')} />
        <Row label="Weight">
          <div className="flex overflow-hidden rounded bg-elevated">
            {[300, 400, 500, 600, 700, 800].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onChange('fontWeight', w)}
                className={['flex-1 px-1.5 py-1 text-[10.5px] transition-colors', s.fontWeight === w ? 'bg-action text-action-text' : 'text-text-secondary hover:text-text-primary'].join(' ')}
              >{w}</button>
            ))}
          </div>
        </Row>
      </Section>

      <Section title="Spacing">
        <SliderRow label="Padding" value={s.paddingTop} min={0} max={120} step={1} unit="px" onChange={(v) => onChange('paddingAll', v)} />
        <SliderRow label="Radius"  value={s.borderRadius} min={0} max={64} step={1} unit="px" onChange={(v) => onChange('borderRadius', v, 'px')} />
      </Section>
    </div>
  )
}

function ProjectInspector({ tokens, onTokenChange }: {
  tokens: ProjectToken[]
  onTokenChange: (name: string, value: string) => void
}): JSX.Element {
  if (!tokens.length) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-[12px] text-text-muted">
        No design tokens detected yet. The model declares them as CSS variables in <code>:root</code>: open a design that uses them.
      </div>
    )
  }

  // Sub-categorise colors by name semantics so they read like a
  // proper palette: Brand · Surface · Text · Status · Other.
  const colorBuckets = bucketColors(tokens.filter((t) => t.kind === 'color'))

  // Sub-categorise sizing tokens: Type · Spacing · Radius · Other.
  // Spacing scales (s-1, s-2, space-3 …) collapse into a compact horizontal list.
  const sizeBuckets = bucketSizes(tokens.filter((t) => t.kind === 'number'))

  const others = tokens.filter((t) => t.kind === 'text')

  return (
    <div className="flex-1 overflow-y-auto px-3 pb-3 pt-3">
      {colorBuckets.map((b, i) => (
        <Section key={`c-${b.label}`} title={b.label} defaultOpen={i === 0 || b.label === 'Brand'}>
          <SwatchGrid tokens={b.tokens} onChange={onTokenChange} />
        </Section>
      ))}

      {sizeBuckets.map((b) => {
        const heavy = b.label === 'Spacing' || b.label === 'Radius'
        return (
          <Section
            key={`s-${b.label}`}
            title={b.label}
            // Spacing + Radius scale grids are noisy and dominate the panel :
            // always start collapsed and don't persist (so re-opens reset).
            defaultOpen={!heavy}
            persist={!heavy}
          >
            {b.scale ? (
              <ScaleControls tokens={b.tokens} onChange={onTokenChange} />
            ) : (
              b.tokens.map((t) => <SizeRow key={t.name} token={t} onChange={(v) => onTokenChange(t.name, v)} />)
            )}
          </Section>
        )
      })}

      {others.length > 0 && (
        <Section title="More" defaultOpen={false}>
          {others.map((t) => (
            <Row key={t.name} label={tokenLabel(t.name)}>
              <input
                type="text"
                value={t.value}
                onChange={(e) => onTokenChange(t.name, e.target.value)}
                className="w-32 rounded bg-elevated px-2 py-1 text-right text-[11.5px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40"
              />
            </Row>
          ))}
        </Section>
      )}
    </div>
  )
}

// ─── Color swatch grid ─────────────────────────────────────────────────────
// 4-column grid of small color swatches. Click → opens the OS color picker
// for the underlying <input type=color>. Hover shows the hex.
function SwatchGrid({ tokens, onChange }: {
  tokens: ProjectToken[]
  onChange: (name: string, value: string) => void
}): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {tokens.map((t) => (
        <label
          key={t.name}
          title={`${tokenLabel(t.name)} · ${t.value}`}
          className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 transition-colors hover:bg-elevated/50"
        >
          <span className="relative inline-block h-7 w-7 flex-shrink-0 overflow-hidden rounded-md">
            <span
              aria-hidden="true"
              className="block h-full w-full"
              style={{ backgroundColor: t.value }}
            />
            <input
              type="color"
              value={t.value}
              onChange={(e) => onChange(t.name, e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11.5px] text-text-primary">{tokenLabel(t.name)}</span>
            <span className="block truncate font-mono text-[10px] text-text-muted">{t.value}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

// ─── Size row (single slider, compact) ─────────────────────────────────────
function SizeRow({ token, onChange }: { token: ProjectToken; onChange: (v: string) => void }): JSX.Element {
  const num = parseFloat(token.value)
  const unit = token.value.replace(/^[\d.+-]+/, '') || 'px'
  return (
    <SliderRow
      label={tokenLabel(token.name)}
      value={isFinite(num) ? num : 0}
      min={0}
      max={Math.max(num * 4, unit === 'px' ? 120 : 4)}
      step={unit === 'px' ? 1 : 0.05}
      unit={unit}
      onChange={(v) => onChange(`${v}${unit}`)}
    />
  )
}

// ─── Scale controls: for ramped tokens like s-1..s-N, space-1..space-N ───
// Single horizontal row of mini-cards, each editable via popover-style input.
function ScaleControls({ tokens, onChange }: {
  tokens: ProjectToken[]
  onChange: (name: string, value: string) => void
}): JSX.Element {
  // Sort by trailing number for visual scale order.
  const sorted = [...tokens].sort((a, b) => scaleOrder(a.name) - scaleOrder(b.name))
  return (
    <div className="grid grid-cols-4 gap-1">
      {sorted.map((t) => {
        const num = parseFloat(t.value)
        const unit = t.value.replace(/^[\d.+-]+/, '') || 'px'
        return (
          <label
            key={t.name}
            title={`${tokenLabel(t.name)} · ${t.value}`}
            className="flex flex-col items-center gap-0.5 rounded-md bg-elevated/40 p-1.5 transition-colors hover:bg-elevated"
          >
            <span className="text-[10px] text-text-muted">{shortLabel(t.name)}</span>
            <input
              type="number"
              value={isFinite(num) ? num : 0}
              onChange={(e) => onChange(t.name, `${Number(e.target.value)}${unit}`)}
              className="w-full bg-transparent text-center text-[11.5px] font-mono text-text-primary focus:outline-none"
              step={unit === 'px' ? 1 : 0.05}
              min={0}
            />
          </label>
        )
      })}
    </div>
  )
}

function scaleOrder(name: string): number {
  const m = name.match(/(\d+(?:\.\d+)?)\s*$/)
  return m ? parseFloat(m[1]) : 0
}
function shortLabel(name: string): string {
  // s-4 → 4, space-12 → 12, radius-sm → sm
  const m = name.match(/[-_]([^-_]+)$/)
  return m ? m[1] : name.replace(/^--/, '')
}

// ─── Bucketing logic ──────────────────────────────────────────────────────
type Bucket = { label: string; tokens: ProjectToken[]; scale?: boolean }

function bucketColors(tokens: ProjectToken[]): Bucket[] {
  const brand:   ProjectToken[] = []
  const surface: ProjectToken[] = []
  const text:    ProjectToken[] = []
  const status:  ProjectToken[] = []
  const other:   ProjectToken[] = []
  for (const t of tokens) {
    const n = t.name.toLowerCase()
    if (/(primary|secondary|accent|brand)/.test(n)) brand.push(t)
    else if (/(surface|paper|bg|background|canvas|card)/.test(n)) surface.push(t)
    else if (/(ink|text|fg|foreground|muted|on-)/.test(n)) text.push(t)
    else if (/(success|ok|warn|error|danger|info|line|border|divider)/.test(n)) status.push(t)
    else other.push(t)
  }
  // Roll uncategorised colours into "Brand" so we don't end up with a
  // stranded "Other" header for one or two values.
  if (other.length && other.length <= 2) {
    brand.push(...other)
    other.length = 0
  } else if (other.length && surface.length === 0) {
    surface.push(...other)
    other.length = 0
  }
  const out: Bucket[] = []
  if (brand.length)   out.push({ label: 'Brand',   tokens: brand })
  if (surface.length) out.push({ label: 'Surface', tokens: surface })
  if (text.length)    out.push({ label: 'Text',    tokens: text })
  if (status.length)  out.push({ label: 'Status',  tokens: status })
  if (other.length)   out.push({ label: 'More',    tokens: other })
  return out
}

function bucketSizes(tokens: ProjectToken[]): Bucket[] {
  const type:    ProjectToken[] = []
  const spacing: ProjectToken[] = []
  const radius:  ProjectToken[] = []
  const other:   ProjectToken[] = []
  for (const t of tokens) {
    const n = t.name.toLowerCase()
    if (/(font|text|size|display|body|h\d|heading|leading|tracking)/.test(n)) type.push(t)
    else if (/(s-\d|space|spacing|gap-|gap$)/.test(n)) spacing.push(t)
    else if (/(radius|round|rounded)/.test(n)) radius.push(t)
    else other.push(t)
  }
  // Same trick for sizes: fold orphans into the closest meaningful group.
  if (other.length && other.length <= 2) {
    if (radius.length) radius.push(...other)
    else if (type.length) type.push(...other)
    else if (spacing.length) spacing.push(...other)
    else type.push(...other)
    other.length = 0
  }
  const out: Bucket[] = []
  if (type.length)    out.push({ label: 'Typography', tokens: type })
  if (spacing.length) out.push({ label: 'Spacing',    tokens: spacing, scale: true })
  if (radius.length)  out.push({ label: 'Radius',     tokens: radius, scale: radius.length > 1 })
  if (other.length)   out.push({ label: 'More',       tokens: other })
  return out
}

function tokenLabel(name: string): string {
  // --color-primary → Color primary, --primary → Primary, --space-4 → Space 4
  return name.replace(/^--/, '').replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

function Section({ title, children, defaultOpen = true, persist = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean; persist?: boolean }): JSX.Element {
  const [open, setOpen] = useState<boolean>(() => {
    if (!persist) return defaultOpen
    try {
      const raw = localStorage.getItem('t42:inspector:section:' + title)
      return raw === null ? defaultOpen : raw === '1'
    } catch { return defaultOpen }
  })
  const toggle = (): void => {
    setOpen((o) => {
      const next = !o
      if (persist) {
        try { localStorage.setItem('t42:inspector:section:' + title, next ? '1' : '0') } catch {}
      }
      return next
    })
  }
  return (
    <section className="mb-2 last:mb-0">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-2 py-1.5 text-left text-[11.5px] font-medium text-text-muted transition-colors hover:text-text-secondary"
      >
        <span>{title}</span>
        <svg
          width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor"
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          className={['transition-transform', open ? 'rotate-90' : ''].join(' ')}
        >
          <path d="M4 2 L8 6 L4 10" />
        </svg>
      </button>
      {open && <div className="mb-2 space-y-2">{children}</div>}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] text-text-secondary">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  )
}

function SliderRow({ label, value, min, max, step, unit, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}): JSX.Element {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[12px]">
        <span className="text-text-secondary">{label}</span>
        <span className="font-mono text-[10.5px] text-text-muted">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="t42-range block w-full"
      />
    </div>
  )
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  return (
    <>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
      />
      <code className="font-mono text-[10.5px] text-text-muted">{value}</code>
    </>
  )
}

// ─── Version dropdown ──────────────────────────────────────────────────────
function VersionPicker({ versions, activeId, onPick, open, setOpen }: {
  versions: DesignVersion[]
  activeId: string | null
  onPick: (id: string) => void
  open: boolean
  setOpen: (v: boolean) => void
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const active = versions.find((v) => v.id === activeId)
  const latest = versions[versions.length - 1]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, setOpen])

  if (!active) return <></>
  return (
    <div ref={ref} className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Switch version"
        className="inline-flex items-center gap-1 rounded-md bg-elevated px-2 py-1 text-[11px] text-text-secondary hover:bg-elevated/70 hover:text-text-primary"
      >
        <span>{active.id}</span>
        {versions.length > 1 && <span className="opacity-70">· {versions.length}</span>}
        <span className="text-[8px] opacity-70">▾</span>
      </button>
      {open && (
        <div className="t42-menu absolute left-0 top-full z-30 mt-1 max-h-[260px] min-w-[140px] overflow-y-auto rounded-md bg-raised py-1 shadow-overlay">
          {[...versions].reverse().map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => { onPick(v.id); setOpen(false) }}
              className={[
                'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[12px]',
                v.id === active.id ? 'text-accent' : 'text-text-secondary hover:bg-elevated hover:text-text-primary'
              ].join(' ')}
            >
              <span className="font-mono">{v.id}</span>
              {v.id === latest.id && <span className="text-[10px] text-text-muted">latest</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Brain Check helpers ──────────────────────────────────────────────────

async function waitUntilIdle(
  designId: string,
  cancelledRef: RefObject<boolean>,
  timeoutMs: number
): Promise<void> {
  const start = Date.now()
  // Small initial delay to let the send register as busy
  await new Promise((r) => setTimeout(r, 1500))
  while (Date.now() - start < timeoutMs) {
    if (cancelledRef.current) return
    const isBusy = await window.terminal42.designs.isBusy(designId)
    if (!isBusy) return
    await new Promise((r) => setTimeout(r, 2000))
  }
}
