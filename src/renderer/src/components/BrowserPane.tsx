import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { IconRefresh, IconChevronRight, IconPlus, IconSparkle } from './icons'
import { VIZ_INJECT_JS, type VizSelected } from '../lib/vizInject'
import { paneWidthStyle } from './paneWidth'
import { VizTweakPanel, type VizDiff } from './VizTweakPanel'

type Props = {
  initialUrl?: string | null
  projectId?: string | null
  onClose: () => void
  width: number
  navTo?: { url: string; nonce: number } | null
  activeSessionId?: string | null
}

const LS_LEGACY_URLS = 't42:browser:urls'
const LS_LEGACY_OPEN_MAP = 't42:browser:openByProject'
const LS_LEGACY_LAST_URL = 't42:browser:lastUrl'
const LS_MIGRATION_DONE = 't42:browser:migrated:v1'

/**
 * Safe accessor for the new browser IPC. Returns null if the preload
 * bundle hasn't been rebuilt yet (electron-vite dev needs an Electron
 * relaunch to pick up preload changes). All callers must handle null
 * gracefully so the app doesn't blank out during dev.
 */
function getBrowserIpc():
  | NonNullable<typeof window.terminal42.browser & { resolveUrl: any; setUrl: any; getOpen: any; setOpen: any }>
  | null {
  const b: any = (window as any).terminal42?.browser
  if (b && typeof b.resolveUrl === 'function' && typeof b.setUrl === 'function') return b
  return null
}

/**
 * Best-effort, one-shot migration of pre-DB browser state out of
 * localStorage and into the main-process SQLite store. Runs once per
 * install. Failures are swallowed: the worst case is the user loses
 * a previously-saved URL, which they can re-open by typing it again.
 */
async function migrateLegacyBrowserState(): Promise<void> {
  try {
    if (localStorage.getItem(LS_MIGRATION_DONE)) return
  } catch { return }
  const ipc = getBrowserIpc()
  if (!ipc) return // try again next launch when preload exposes the API
  try {
    const raw = localStorage.getItem(LS_LEGACY_URLS)
    if (raw) {
      const map = JSON.parse(raw) as Record<string, string>
      for (const [key, url] of Object.entries(map)) {
        if (!url) continue
        const sep = key.indexOf('::')
        if (sep < 0) continue
        const projectId = key.slice(0, sep)
        const sessionToken = key.slice(sep + 2)
        const sessionId = sessionToken === '*' ? null : sessionToken
        try { await ipc.setUrl({ projectId, sessionId, url }) } catch {}
      }
    }
  } catch {}
  try {
    const raw = localStorage.getItem(LS_LEGACY_OPEN_MAP)
    if (raw) {
      const map = JSON.parse(raw) as Record<string, boolean>
      for (const [projectId, isOpen] of Object.entries(map)) {
        try { await ipc.setOpen(projectId, !!isOpen) } catch {}
      }
    }
  } catch {}
  try {
    localStorage.removeItem(LS_LEGACY_URLS)
    localStorage.removeItem(LS_LEGACY_OPEN_MAP)
    localStorage.removeItem(LS_LEGACY_LAST_URL)
    localStorage.setItem(LS_MIGRATION_DONE, '1')
  } catch {}
}
let migrationPromise: Promise<void> | null = null
function ensureMigrated(): Promise<void> {
  if (!migrationPromise) migrationPromise = migrateLegacyBrowserState()
  return migrationPromise
}

const LS_ZOOM = 't42:browser:zoom'
const LS_DEVICE = 't42:browser:device'

/**
 * Whether Electron's <webview> tag is actually active in this window.
 *
 * With webviewTag disabled the element still parses, so a feature test on the
 * tag name is not enough: it has to check for a method the real tag adds.
 * Evaluated once, because the answer cannot change while the window lives.
 */
const WEBVIEW_SUPPORTED: boolean = (() => {
  try {
    const probe = document.createElement('webview') as unknown as { getWebContentsId?: unknown }
    return typeof probe.getWebContentsId === 'function'
  } catch {
    return false
  }
})()

const DEVICE_PRESETS: Array<{ id: string; label: string; width: number; ua?: string }> = [
  { id: 'desktop', label: 'Desktop', width: 0 },
  {
    id: 'iphone',
    label: 'iPhone (390 × 844)',
    width: 390,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  },
  {
    id: 'ipad',
    label: 'iPad (820 × 1180)',
    width: 820,
    ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  },
  {
    id: 'pixel',
    label: 'Pixel (412 × 915)',
    width: 412,
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
  }
]

export function BrowserPane({ initialUrl, projectId, onClose, width: _paneWidth, navTo, activeSessionId }: Props) {
  const [urlBar, setUrlBar] = useState<string>('')
  const [committedUrl, setCommittedUrl] = useState<string>('')
  const [, setPageTitle] = useState<string>('')
  const [, setFavicon] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [canBack, setCanBack] = useState(false)
  const [canFwd, setCanFwd] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [zoom, setZoom] = useState<number>(() => {
    try { return Math.max(0.5, Math.min(2, Number(localStorage.getItem(LS_ZOOM)) || 1)) } catch { return 1 }
  })
  const [deviceId, setDeviceId] = useState<string>(() => {
    try { return localStorage.getItem(LS_DEVICE) || 'desktop' } catch { return 'desktop' }
  })
  const [editingUrl, setEditingUrl] = useState(false)
  const [vtPanel, setVtPanel] = useState(false)
  const [vtPickMode, setVtPickMode] = useState(false)
  const [vtSelected, setVtSelected] = useState<VizSelected | null>(null)
  const [vtDiffs, setVtDiffs] = useState<Record<string, VizDiff>>({})
  const wvRef = useRef<any>(null)
  const frameRef = useRef<HTMLIFrameElement | null>(null)

  /**
   * Reload whatever is showing, without changing the address.
   *
   * A second turn that edits the page already on screen re-requests the same
   * URL, and assigning an unchanged `src` does nothing — so the pane kept
   * showing the old render while the user's browser, which the agent opened
   * separately, showed the new one. Bouncing through about:blank forces the
   * fetch to happen again.
   */
  const reloadFrame = useCallback((): void => {
    if (!WEBVIEW_SUPPORTED) {
      const frame = frameRef.current
      const src = frame?.getAttribute('src')
      if (!frame || !src || src === 'about:blank') return
      frame.setAttribute('src', 'about:blank')
      setTimeout(() => { frame.setAttribute('src', src) }, 0)
      return
    }
    try {
      const wv = wvRef.current
      // Ignoring the cache matters here: the point of the reload is that the
      // file on disk just changed.
      if (typeof wv?.reloadIgnoringCache === 'function') wv.reloadIgnoringCache()
      else if (typeof wv?.reload === 'function') wv.reload()
    } catch {}
  }, [])
  const urlInputRef = useRef<HTMLInputElement | null>(null)

  const device = DEVICE_PRESETS.find((d) => d.id === deviceId) ?? DEVICE_PRESETS[0]

  // Resolve which URL to show for the current (project, session). All of
  // the precedence logic now lives in the main process so it's race-safe,
  // crash-safe (atomic SQLite writes), and FK-cleaned when a project is
  // deleted. We only reflect the resolution into local state.
  //
  // The pickToken counter race-guards against rapid project/session
  // switches: if a slow IPC resolves *after* a newer pick has started, we
  // discard its result.
  const pickTokenRef = useRef(0)
  useEffect(() => {
    const myToken = ++pickTokenRef.current
    let cancelled = false
    async function pick() {
      await ensureMigrated()
      if (cancelled || myToken !== pickTokenRef.current) return
      const ipc = getBrowserIpc()
      // If preload hasn't been rebuilt yet (electron-vite dev quirk), use
      // a safe legacy fallback that reads the old localStorage map. The
      // user just needs to relaunch Electron to get full functionality.
      if (!ipc) {
        try {
          const raw = localStorage.getItem(LS_LEGACY_URLS) || '{}'
          const map = JSON.parse(raw) as Record<string, string>
          const sessionKey = projectId && activeSessionId ? `${projectId}::${activeSessionId}` : ''
          const projectKey = projectId ? `${projectId}::*` : ''
          const fallback = (sessionKey && map[sessionKey]) || (projectKey && map[projectKey]) || ''
          const next = initialUrl || fallback || ''
          if (cancelled || myToken !== pickTokenRef.current) return
          setCommittedUrl(next); setUrlBar(next)
        } catch {
          if (cancelled || myToken !== pickTokenRef.current) return
          setCommittedUrl(initialUrl || ''); setUrlBar(initialUrl || '')
        }
        return
      }
      try {
        const r = await ipc.resolveUrl({
          projectId: projectId ?? null,
          sessionId: activeSessionId ?? null,
          initialUrl: initialUrl ?? null
        })
        if (cancelled || myToken !== pickTokenRef.current) return
        if (r.projectId !== (projectId ?? null)) return
        const next = r.url ?? ''
        setCommittedUrl(next)
        setUrlBar(next)
      } catch {
        if (cancelled || myToken !== pickTokenRef.current) return
        setCommittedUrl(''); setUrlBar('')
      }
    }
    void pick()
    return () => { cancelled = true }
  }, [initialUrl, projectId, activeSessionId])

  // External navigation request (e.g. preview just started → load its URL).
  useEffect(() => {
    if (!navTo?.url) return
    // Already showing this page: the request is a refresh, not a navigation.
    const shown = WEBVIEW_SUPPORTED
      ? (() => { try { return wvRef.current?.getURL?.() || '' } catch { return '' } })()
      : frameRef.current?.getAttribute('src') || ''
    if (shown === navTo.url) reloadFrame()
    setCommittedUrl(navTo.url)
    setUrlBar(navTo.url)
    if (projectId) {
      const ipc = getBrowserIpc()
      if (ipc) { try { void ipc.setUrl({ projectId, sessionId: activeSessionId ?? null, url: navTo.url }) } catch {} }
    }
  }, [navTo?.nonce, navTo?.url, projectId, activeSessionId, reloadFrame])

  // Suggest running preview URLs: scoped to THIS project. We don't want
  // a sibling project's dev server to show up in this project's empty
  // state or address bar dropdown.
  useEffect(() => {
    let alive = true
    const fetchSuggestions = async () => {
      try {
        const running = await window.terminal42.preview.running()
        if (!alive) return
        const urls = running
          .filter((r) => !projectId || r.projectId === projectId)
          .map((r) => r.url)
          .filter((u): u is string => !!u)
        setSuggestions(Array.from(new Set(urls)))
      } catch {}
    }
    void fetchSuggestions()
    const off = window.terminal42.preview.onReady(() => void fetchSuggestions())
    const t = setInterval(fetchSuggestions, 4000)
    return () => { alive = false; off(); clearInterval(t) }
  }, [projectId])

  // Wire webview events.
  useEffect(() => {
    const wv = wvRef.current
    if (!wv) return
    const onStart = () => { setLoading(true); setFavicon('') }
    const onStop = () => {
      setLoading(false)
      try {
        const cur = wv.getURL?.() ?? ''
        if (cur && cur !== 'about:blank') {
          setUrlBar(cur)
          if (projectId) {
            const ipc = getBrowserIpc()
            if (ipc) { try { void ipc.setUrl({ projectId, sessionId: activeSessionId ?? null, url: cur }) } catch {} }
          }
        }
        setCanBack(!!wv.canGoBack?.())
        setCanFwd(!!wv.canGoForward?.())
        try { wv.setZoomFactor?.(zoom) } catch {}
      } catch {}
    }
    const onTitle = (e: { title: string }) => setPageTitle(e.title || '')
    const onFav = (e: { favicons: string[] }) => setFavicon(e.favicons?.[0] || '')
    const onFail = (e: { errorCode: number; errorDescription: string; isMainFrame?: boolean }) => {
      if (e.errorCode === -3 || e.isMainFrame === false) return
      setLoading(false)
      
    }
    const onFinish = () => {
      try {
        wv.executeJavaScript?.(VIZ_INJECT_JS, true)?.catch?.(() => {})
      } catch {}
    }
    const onConsole = (e: { message?: string }) => {
      const m = e?.message ?? ''
      if (!m.startsWith('__T42VT__:')) return
      try {
        const payload = JSON.parse(m.slice(10))
        if (payload?.type === 'select') {
          const el = (payload.el as VizSelected | null) ?? null
          setVtSelected(el)
          if (el) setVtPanel(true)
        } else if (payload?.type === 'pickMode') {
          setVtPickMode(!!payload.on)
        } else if (payload?.type === 'ready') {
          // page injected; nothing to do: picker etc. activated on demand
        }
      } catch {}
    }
    wv.addEventListener('did-start-loading', onStart)
    wv.addEventListener('did-stop-loading', onStop)
    wv.addEventListener('did-fail-load', onFail)
    wv.addEventListener('page-title-updated', onTitle)
    wv.addEventListener('page-favicon-updated', onFav)
    wv.addEventListener('did-finish-load', onFinish)
    wv.addEventListener('console-message', onConsole)
    return () => {
      wv.removeEventListener('did-start-loading', onStart)
      wv.removeEventListener('did-stop-loading', onStop)
      wv.removeEventListener('did-fail-load', onFail)
      wv.removeEventListener('page-title-updated', onTitle)
      wv.removeEventListener('page-favicon-updated', onFav)
      wv.removeEventListener('did-finish-load', onFinish)
      wv.removeEventListener('console-message', onConsole)
    }
  }, [committedUrl, zoom])

  // Push pick-mode toggle into the in-page viz overlay.
  useEffect(() => {
    if (!committedUrl) return
    const wv = wvRef.current
    if (!wv?.executeJavaScript) return
    const safe = JSON.stringify(vtPickMode)
    try {
      wv.executeJavaScript(`window.__t42viz && window.__t42viz.setPicking && window.__t42viz.setPicking(${safe})`, true)?.catch?.(() => {})
    } catch {}
  }, [vtPickMode, committedUrl])

  // Apply zoom whenever it changes.
  useEffect(() => {
    if (!committedUrl) return
    try { wvRef.current?.setZoomFactor?.(zoom) } catch {}
    try { localStorage.setItem(LS_ZOOM, String(zoom)) } catch {}
  }, [zoom, committedUrl])

  // When the scoped URL changes (project / session switch, or user enters a
  // new URL), force the Electron <webview> to navigate. The `src` attribute
  // alone is not always reliable for re-navigation after the element mounts,
  // so we call loadURL when the current URL doesn't match the desired one.
  useEffect(() => {
    if (!committedUrl) return
    if (!WEBVIEW_SUPPORTED) {
      const frame = frameRef.current
      if (frame && frame.getAttribute('src') !== committedUrl) frame.setAttribute('src', committedUrl)
      return
    }
    const wv = wvRef.current
    if (!wv) return
    try {
      const cur = wv.getURL?.() || ''
      if (cur === committedUrl) return
      if (typeof wv.loadURL === 'function') {
        wv.loadURL(committedUrl).catch?.(() => {})
      }
    } catch { /* webview not ready yet: src attribute will handle initial load */ }
  }, [committedUrl])

  useEffect(() => {
    try { localStorage.setItem(LS_DEVICE, deviceId) } catch {}
  }, [deviceId])

  const go = (raw: string) => {
    const u = normalizeUrl(raw)
    if (!u) return
    setFavicon('')
    setPageTitle('')
    setCommittedUrl(u)
    setUrlBar(u)
    if (projectId) {
      const ipc = getBrowserIpc()
      if (ipc) { try { void ipc.setUrl({ projectId, sessionId: activeSessionId ?? null, url: u }) } catch {} }
    }
  }

  const submit = (e: React.FormEvent) => { e.preventDefault(); setEditingUrl(false); go(urlBar) }
  const hardReload = () => {
    try { wvRef.current?.reloadIgnoringCache?.() } catch {}
  }
  const openExternal = () => committedUrl && void window.terminal42.shell?.openExternal?.(committedUrl)

  const vtApply = useCallback((selector: string, props: Record<string, string>) => {
    const wv = wvRef.current
    if (!wv?.executeJavaScript) return
    try {
      wv.executeJavaScript(
        `window.__t42viz && window.__t42viz.apply(${JSON.stringify(selector)}, ${JSON.stringify(props)})`,
        true
      )?.catch?.(() => {})
    } catch {}
    setVtDiffs((prev) => {
      const cur = prev[selector]
      const tag = vtSelected?.selector === selector ? vtSelected.tag : (cur?.tag ?? selector.split(/[ >]/).pop() ?? selector)
      const text = vtSelected?.selector === selector ? vtSelected.text : (cur?.text ?? '')
      const computed = vtSelected?.selector === selector ? vtSelected.computed : {}
      const nextProps = { ...(cur?.props ?? {}) }
      for (const [k, v] of Object.entries(props)) {
        const old = nextProps[k]?.old ?? computed[k] ?? ''
        nextProps[k] = { old, next: v }
      }
      return {
        ...prev,
        [selector]: {
          selector,
          tag,
          text,
          annotation: cur?.annotation ?? '',
          props: nextProps
        }
      }
    })
    if (vtSelected?.selector === selector) {
      setVtSelected((s) => s ? { ...s, computed: { ...s.computed, ...props } } : s)
    }
  }, [vtSelected])

  const vtAnnotate = useCallback((selector: string, text: string) => {
    setVtDiffs((prev) => {
      const cur = prev[selector]
      const tag = vtSelected?.selector === selector ? vtSelected.tag : (cur?.tag ?? selector)
      const elText = vtSelected?.selector === selector ? vtSelected.text : (cur?.text ?? '')
      if (!cur && !text.trim()) return prev
      return {
        ...prev,
        [selector]: {
          selector,
          tag,
          text: elText,
          annotation: text,
          props: cur?.props ?? {}
        }
      }
    })
  }, [vtSelected])

  const vtResetSelected = useCallback(() => {
    if (!vtSelected) return
    const sel = vtSelected.selector
    const wv = wvRef.current
    try {
      wv?.executeJavaScript?.(`window.__t42viz && window.__t42viz.reset(${JSON.stringify(sel)})`, true)?.catch?.(() => {})
      wv?.executeJavaScript?.(`window.__t42viz && window.__t42viz.refresh && window.__t42viz.refresh()`, true)?.catch?.(() => {})
    } catch {}
    setVtDiffs((prev) => {
      const next = { ...prev }; delete next[sel]; return next
    })
  }, [vtSelected])

  const vtClearAll = useCallback(() => {
    const wv = wvRef.current
    Object.keys(vtDiffs).forEach((sel) => {
      try {
        wv?.executeJavaScript?.(`window.__t42viz && window.__t42viz.reset(${JSON.stringify(sel)})`, true)?.catch?.(() => {})
      } catch {}
    })
    try {
      wv?.executeJavaScript?.(`window.__t42viz && window.__t42viz.clearSelection && window.__t42viz.clearSelection()`, true)?.catch?.(() => {})
    } catch {}
    setVtDiffs({})
    setVtSelected(null)
  }, [vtDiffs])

  const vtDiffCount = useMemo(() => Object.keys(vtDiffs).length, [vtDiffs])

  // Compute the inner browser frame (for device emulation).
  const isDesktop = device.id === 'desktop'

  return (
    <aside
      className="flex h-full flex-col bg-bg"
      style={paneWidthStyle(_paneWidth)}
      aria-label="Web browser preview"
    >
      {/* Single combined toolbar row: matches session-tabs row height (h-9) */}
      <div className="flex h-9 shrink-0 items-center gap-1 bg-bg px-1.5">
        <IconBtn aria="Back" disabled={!canBack} onClick={() => wvRef.current?.goBack?.()}>
          <span className="rotate-180"><IconChevronRight size={12} /></span>
        </IconBtn>
        <IconBtn aria="Forward" disabled={!canFwd} onClick={() => wvRef.current?.goForward?.()}>
          <IconChevronRight size={12} />
        </IconBtn>
        <IconBtn
          aria={loading ? 'Stop' : 'Reload'}
          onClick={() => loading ? wvRef.current?.stop?.() : wvRef.current?.reload?.()}
        >
          {loading ? <span className="text-[12px] leading-none">×</span> : <IconRefresh size={12} />}
        </IconBtn>

        <form onSubmit={submit} className="relative flex flex-1 items-center px-1 min-w-0">
          <input
            ref={urlInputRef}
            type="text"
            value={editingUrl ? urlBar : (committedUrl || urlBar)}
            onChange={(e) => { setUrlBar(sanitizeUrl(e.target.value)); setEditingUrl(true) }}
            onPaste={(e) => {
              const txt = e.clipboardData.getData('text')
              const clean = sanitizeUrl(txt)
              if (clean !== txt) {
                e.preventDefault()
                setUrlBar(clean)
                setEditingUrl(true)
              }
            }}
            onFocus={(e) => { setEditingUrl(true); setUrlBar(committedUrl || urlBar); setTimeout(() => e.target.select(), 0) }}
            onBlur={() => setEditingUrl(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setEditingUrl(false); ;(e.currentTarget as HTMLInputElement).blur() } }}
            placeholder="Enter URL or search…"
            className={[
              'w-full bg-transparent px-2 py-1 font-mono text-[11px] outline-none placeholder:text-text-muted',
              editingUrl
                ? 'rounded-md border border-accent text-text-primary'
                : 'border border-transparent text-center text-text-secondary'
            ].join(' ')}
            spellCheck={false}
            list="t42-browser-suggestions"
          />
          <datalist id="t42-browser-suggestions">
            {suggestions.map((u) => <option key={u} value={u} />)}
          </datalist>
        </form>

        <IconBtn aria="Inspect element" onClick={() => { try { wvRef.current?.openDevTools?.() } catch {} }}>
          <Inspect />
        </IconBtn>
        <button
          type="button"
          onClick={() => {
            const next = !vtPickMode
            setVtPickMode(next)
            if (next) setVtPanel(true)
          }}
          aria-pressed={vtPickMode}
          aria-label={vtPickMode ? 'Stop element picker' : 'Pick an element to edit or annotate'}
          title="Visual edit: click any element on the page to tweak styles or add a note for chat"
          className={[
            'relative grid h-6 w-6 place-items-center rounded-md',
            vtPickMode
              ? 'bg-accent/20 text-accent'
              : 'text-text-secondary hover:bg-elevated hover:text-text-primary'
          ].join(' ')}
        >
          <IconSparkle size={12} />
          {vtDiffCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-3 min-w-[12px] place-items-center rounded-full bg-accent px-1 text-[8px] font-bold leading-none text-white">
              {vtDiffCount}
            </span>
          )}
        </button>
        {vtDiffCount > 0 && (
          <button
            type="button"
            onClick={() => setVtPanel((v) => !v)}
            aria-pressed={vtPanel}
            aria-label="Show changes list"
            title={`Visual changes (${vtDiffCount})`}
            className={[
              'grid h-6 min-w-[24px] place-items-center rounded-md px-1 text-[10.5px] font-medium',
              vtPanel
                ? 'bg-elevated text-text-primary'
                : 'text-text-secondary hover:bg-elevated hover:text-text-primary'
            ].join(' ')}
          >
            {vtDiffCount}
          </button>
        )}
        <IconBtn aria="New tab (open URL)" onClick={() => { setUrlBar(''); setEditingUrl(true); setTimeout(() => urlInputRef.current?.focus(), 0) }}>
          <IconPlus size={12} />
        </IconBtn>
        <SettingsMenu
          zoom={zoom}
          setZoom={setZoom}
          deviceId={deviceId}
          setDeviceId={setDeviceId}
          onHardReload={hardReload}
          onClearCookies={() => void window.terminal42.browser?.clearStorage?.('cookies')}
          onClearCache={() => void window.terminal42.browser?.clearStorage?.('cache')}
        />

        <span className="mx-1.5" aria-hidden="true" />
        <IconBtn aria="Open in external browser" onClick={openExternal} disabled={!committedUrl}>
          <ExternalArrow />
        </IconBtn>
        <IconBtn aria="Hide browser pane" onClick={onClose}>
          <PanelToggle />
        </IconBtn>
      </div>

      <div className="relative flex flex-1 overflow-hidden bg-bg/40">
        <div className="relative flex flex-1 items-start justify-center overflow-auto">
        {!committedUrl && (
          <Empty suggestions={suggestions} onPick={go} projectId={projectId} />
        )}
        {committedUrl && (() => {
          const WebviewAny: any = 'webview'
          const innerStyle = isDesktop
            ? { width: '100%', height: '100%', display: 'flex', backgroundColor: 'white' }
            : { width: `${device.width}px`, height: '100%', display: 'flex', backgroundColor: 'white', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }
          // <webview> only renders when the window enables webviewTag. It is
          // disabled here (it destabilised the renderer), which left the tag as
          // an inert unknown element: the pane opened but stayed blank, and the
          // only way to see a page was to send it to an external browser. An
          // iframe renders in-place and is enough for what this pane shows,
          // local files and dev servers.
          if (!WEBVIEW_SUPPORTED) {
            return (
              <iframe
                ref={frameRef}
                src={committedUrl}
                title="Preview"
                style={innerStyle}
              />
            )
          }
          return (
            <WebviewAny
              ref={wvRef}
              src={committedUrl}
              partition={`persist:t42-browser-${(projectId || 'global').replace(/[^a-zA-Z0-9_-]/g, '_')}`}
              allowpopups="true"
              useragent={device.ua ?? navigator.userAgent}
              style={innerStyle}
            />
          )
        })()}
        </div>
        {vtPanel && (
          <VizTweakPanel
            activeSessionId={activeSessionId ?? null}
            selected={vtSelected}
            pickMode={vtPickMode}
            diffs={vtDiffs}
            onTogglePick={() => setVtPickMode((v) => !v)}
            onClearAll={vtClearAll}
            onResetSelected={vtResetSelected}
            onApply={vtApply}
            onAnnotate={vtAnnotate}
            onClose={() => setVtPanel(false)}
          />
        )}
      </div>
    </aside>
  )
}

function SettingsMenu({
  zoom, setZoom, deviceId, setDeviceId, onHardReload, onClearCookies, onClearCache
}: {
  zoom: number
  setZoom: (n: number) => void
  deviceId: string
  setDeviceId: (id: string) => void
  onHardReload: () => void
  onClearCookies: () => void
  onClearCache: () => void
}) {
  const isDesktop = deviceId === 'desktop'
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          aria-label="Browser settings"
          title="Browser settings"
          className="grid h-6 w-6 place-items-center rounded-md text-text-secondary hover:bg-elevated hover:text-text-primary"
        >
          <Dots />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[260px] rounded-md bg-surface p-1.5 text-[12px] text-text-primary shadow-md focus:outline-none"
        >
          <Dropdown.Item
            onSelect={onHardReload}
            className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 outline-none hover:bg-elevated focus:bg-elevated"
          >
            Hard reload
          </Dropdown.Item>
          <DeviceSubmenu deviceId={deviceId} setDeviceId={setDeviceId} />
          <div className="my-1.5" />
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <span>Zoom</span>
            <div className="flex items-center gap-0.5 rounded-md bg-bg">
              <button
                type="button"
                onClick={() => setZoom(Math.max(0.5, Number((zoom - 0.1).toFixed(2))))}
                className="grid h-5 w-6 place-items-center text-text-secondary hover:text-text-primary"
                aria-label="Zoom out"
              >−</button>
              <span className="min-w-[42px] text-center text-[11px] tabular-nums">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom(Math.min(2, Number((zoom + 0.1).toFixed(2))))}
                className="grid h-5 w-6 place-items-center text-text-secondary hover:text-text-primary"
                aria-label="Zoom in"
              >+</button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="grid h-5 w-6 place-items-center text-text-secondary hover:text-text-primary"
                aria-label="Reset zoom"
                title="Reset zoom"
              ><IconRefresh size={10} /></button>
            </div>
          </div>
          <div className="my-1.5" />
          <Dropdown.Item
            onSelect={onClearCookies}
            className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 outline-none hover:bg-elevated focus:bg-elevated"
          >
            Clear cookies
          </Dropdown.Item>
          <Dropdown.Item
            onSelect={onClearCache}
            className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 outline-none hover:bg-elevated focus:bg-elevated"
          >
            Clear cache
          </Dropdown.Item>
          {!isDesktop && (
            <p className="mt-1 px-2 pt-1.5 text-[10.5px] text-text-muted">
              Mobile UA + viewport active. Switch to Desktop to disable.
            </p>
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}

function DeviceSubmenu({ deviceId, setDeviceId }: { deviceId: string; setDeviceId: (id: string) => void }) {
  return (
    <Dropdown.Sub>
      <Dropdown.SubTrigger className="flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 outline-none hover:bg-elevated focus:bg-elevated">
        <span>Device toolbar</span>
        <IconChevronRight size={11} />
      </Dropdown.SubTrigger>
      <Dropdown.Portal>
        <Dropdown.SubContent
          sideOffset={4}
          className="z-50 min-w-[200px] rounded-md bg-surface p-1 text-[12px] text-text-primary shadow-md focus:outline-none"
        >
          {DEVICE_PRESETS.map((d) => (
            <Dropdown.Item
              key={d.id}
              onSelect={() => setDeviceId(d.id)}
              className="flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 outline-none hover:bg-elevated focus:bg-elevated"
            >
              <span>{d.label}</span>
              {deviceId === d.id && <span className="text-[10px] text-accent">●</span>}
            </Dropdown.Item>
          ))}
        </Dropdown.SubContent>
      </Dropdown.Portal>
    </Dropdown.Sub>
  )
}

function Empty({ suggestions, onPick, projectId }: { suggestions: string[]; onPick: (u: string) => void; projectId?: string | null }) {
  const [savedCommands, setSavedCommands] = useState<Array<{ id: string; name: string; command: string }>>([])
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const refresh = async () => {
      if (!projectId) { setSavedCommands([]); return }
      try {
        const list = await window.terminal42.preview.list(projectId)
        const running = await window.terminal42.preview.running()
        if (!alive) return
        const runningIds = new Set(running.map((r) => r.commandId))
        setSavedCommands(list.filter((c) => !runningIds.has(c.id)).map((c) => ({ id: c.id, name: c.name, command: c.command })))
      } catch {}
    }
    void refresh()
    const off = window.terminal42.preview.onReady(() => void refresh())
    const t = setInterval(refresh, 4000)
    return () => { alive = false; off(); clearInterval(t) }
  }, [projectId])

  const startSaved = async (id: string) => {
    setStarting(id)
    try { await window.terminal42.preview.start(id, '') } catch {}
    setStarting(null)
  }

  return (
    <div className="grid h-full w-full place-items-center px-6 py-8 text-center text-[12px] text-text-muted">
      <div className="flex max-w-[340px] flex-col items-stretch gap-4">
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-[12.5px] font-medium text-text-primary">Nothing to preview here</p>
          <p className="leading-relaxed">
            No dev server is running for this project, and you haven't opened a URL in this project yet.
          </p>
        </div>

        {suggestions.length > 0 && (
          <div className="flex flex-col items-stretch gap-1.5 text-left">
            <p className="text-[10.5px] text-text-muted">Running for this project</p>
            <ul className="">
              {suggestions.map((u) => (
                <li key={u}>
                  <button
                    type="button"
                    onClick={() => onPick(u)}
                    className="w-full truncate py-1.5 text-left font-mono text-[11.5px] text-text-secondary hover:text-text-primary"
                  >
                    {u}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {savedCommands.length > 0 && (
          <div className="flex flex-col items-stretch gap-1.5 text-left">
            <p className="text-[10.5px] text-text-muted">Saved dev servers</p>
            <ul className="">
              {savedCommands.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-left text-[11.5px] text-text-primary" title={c.command}>{c.name}</span>
                  <button
                    type="button"
                    onClick={() => void startSaved(c.id)}
                    disabled={starting === c.id}
                    className="shrink-0 text-[11px] text-accent hover:opacity-80 disabled:opacity-50"
                  >
                    {starting === c.id ? 'Starting…' : 'Start'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {suggestions.length === 0 && savedCommands.length === 0 && (
          <p className="text-[11px] leading-relaxed text-text-muted">
            Start a dev server from a terminal in this project and the pane will pop open with the URL: or type a URL above.
          </p>
        )}
      </div>
    </div>
  )
}

function IconBtn({
  children, onClick, aria, disabled
}: {
  children: React.ReactNode
  onClick: () => void
  aria: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      title={aria}
      disabled={disabled}
      className="grid h-6 w-6 place-items-center rounded-md text-text-secondary hover:bg-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

/**
 * Strip junk that can sneak into URLs from terminal paste / keyboard accidents:
 *   - ASCII control chars (incl. ESC for ANSI sequences like `\x1b[38;2;...m`)
 *   - DEL
 *   - Common stray glyphs (bullseye ◉, fisheye, bullet, etc.) that browsers
 *     never produce themselves and aren't valid in real URLs.
 *   - Percent-encoded forms of the same: `%1B`, `%07`, `%E2%97%89`, etc.
 *   - ANSI CSI sequences (`%1B[…m` or raw `\x1b[…m`).
 *   - Surrounding whitespace.
 * Real URLs that legitimately need Unicode (IDN domains, paths) keep working
 *: we only filter the C0 range and an explicit blacklist.
 */
const URL_JUNK_RAW = /[\u0000-\u001F\u007F\u25C9\u25CE\u25CF\u25CB\u2022\u2023\u2219\u2299]/g
// Percent-encoded blacklist:
//   %00-%1F  (C0 controls)       : case-insensitive hex
//   %7F      (DEL)
//   %E2%97%89 / %8E / %8F / %8B  (UTF-8 for ◉ ◎ ● ○)
//   %E2%80%A2 (•)                : bullet
const URL_JUNK_PCT = /(%(?:0[0-9A-Fa-f]|1[0-9A-Fa-f]|7F)|%E2%80%A2|%E2%97%8[9BEF])/g
// Drop full ANSI CSI sequences (raw or percent-encoded ESC)
const URL_ANSI = /(?:\x1b|%1[Bb])\[[0-9;]*[A-Za-z]/g
function sanitizeUrl(s: string): string {
  return (s || '')
    .replace(URL_ANSI, '')
    .replace(URL_JUNK_PCT, '')
    .replace(URL_JUNK_RAW, '')
    .trim()
}

function normalizeUrl(s: string): string {
  const v = sanitizeUrl(s)
  if (!v) return ''
  if (/^https?:\/\//i.test(v)) return v
  // A local page written by a turn. It is already a complete URL, and the
  // guesses below would mangle it into `https://file://…` because it contains
  // a dot.
  if (/^file:\/\//i.test(v)) return v
  if (/^localhost(:\d+)?(\/|$)/i.test(v)) return `http://${v}`
  if (/^[\w.-]+:\d+(\/|$)/.test(v)) return `http://${v}`
  if (/\./.test(v) || v.startsWith('/')) return `https://${v.replace(/^\/+/, '')}`
  return `https://duckduckgo.com/?q=${encodeURIComponent(v)}`
}

/* ---------- Inline icons ---------- */

function ExternalArrow() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 11 L11 5" />
      <path d="M6 5 H11 V10" />
    </svg>
  )
}
function PanelToggle() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <line x1="10" y1="3" x2="10" y2="13" />
    </svg>
  )
}
function Inspect() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3 6 V3 H6 M10 3 H13 V6 M13 10 V13 H10 M6 13 H3 V10" />
      <circle cx="8" cy="8" r="1.4" />
    </svg>
  )
}
function Dots() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="3" r="1.2" />
      <circle cx="8" cy="8" r="1.2" />
      <circle cx="8" cy="13" r="1.2" />
    </svg>
  )
}


