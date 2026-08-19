import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { registerTerminalActions, notifyTerminalSelectionChanged } from '../state/terminalActions'

const brainAppliedSet = new Set<string>()

// Lite ANSI stripper for in-renderer pattern matching against PTY output.
// Strips CSI/OSC/charset selectors plus common control bytes so we can sniff
// for prompt strings rendered by the Copilot CLI (Ink) without the noise.
const ANSI_RE = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][A-Z0-9]/g
const CTRL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g
function stripAnsiLite(s: string): string {
  return s.replace(ANSI_RE, '').replace(CTRL_RE, '')
}

const DARK_THEME = {
  background: '#0A0A0A',
  foreground: '#F5F5F5',
  cursor: '#38BDF8',
  cursorAccent: '#0A0A0A',
  selectionBackground: 'rgba(56, 189, 248, 0.25)',
  black: '#0A0A0A',
  red: '#EF4444',
  green: '#22C55E',
  yellow: '#F59E0B',
  blue: '#38BDF8',
  magenta: '#A78BFA',
  cyan: '#22D3EE',
  white: '#E5E5E5',
  brightBlack: '#525252',
  brightRed: '#F87171',
  brightGreen: '#4ADE80',
  brightYellow: '#FBBF24',
  brightBlue: '#7DD3FC',
  brightMagenta: '#C4B5FD',
  brightCyan: '#67E8F9',
  brightWhite: '#FAFAFA'
}

const LIGHT_THEME = {
  background: '#FAFAFA',
  foreground: '#171717',
  cursor: '#0EA5E9',
  cursorAccent: '#FAFAFA',
  selectionBackground: 'rgba(14, 165, 233, 0.18)',
  black: '#171717',
  red: '#DC2626',
  green: '#16A34A',
  yellow: '#D97706',
  blue: '#0EA5E9',
  magenta: '#7C3AED',
  cyan: '#0891B2',
  white: '#737373',
  brightBlack: '#525252',
  brightRed: '#EF4444',
  brightGreen: '#22C55E',
  brightYellow: '#F59E0B',
  brightBlue: '#38BDF8',
  brightMagenta: '#A78BFA',
  brightCyan: '#22D3EE',
  brightWhite: '#171717'
}

type CtxMenu = { x: number; y: number; selection: string } | null

export function TerminalPane({
  sessionId,
  cwd,
  theme,
  isActive = true,
  projectId,
  autoLaunchCopilot = true
}: {
  sessionId: string
  cwd?: string
  theme: 'dark' | 'light'
  isActive?: boolean
  projectId?: string
  autoLaunchCopilot?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const searchRef = useRef<SearchAddon | null>(null)
  const titledRef = useRef(false)
  const firstLineBufRef = useRef('')
  const selectionRef = useRef<string>('')
  const [ctx, setCtx] = useState<CtxMenu>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isActive) return
    const t = termRef.current
    const f = fitRef.current
    if (!t || !f) return
    try { f.fit() } catch {}
    t.focus()
    try {
      void window.terminal42.pty.resize(sessionId, Math.max(20, t.cols), Math.max(5, t.rows))
    } catch {}
  }, [isActive, sessionId])

  useEffect(() => {
    if (!containerRef.current) return
    const term = new Terminal({
      fontFamily: '"JetBrains Mono", "SF Mono", Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.35,
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      allowProposedApi: true,
      scrollback: 10000,
      theme: theme === 'dark' ? DARK_THEME : LIGHT_THEME,
      macOptionIsMeta: true,
      rightClickSelectsWord: false,
      allowTransparency: false
    })

    // Apply saved terminal settings (async, non-blocking).
    // After applying, re-fit and notify the PTY of the new size.
    void window.terminal42.settings.get().then((s) => {
      if (s.terminalFontSize) term.options.fontSize = s.terminalFontSize
      if (s.terminalFontFamily) term.options.fontFamily = `"${s.terminalFontFamily}", "SF Mono", Menlo, monospace`
      if (s.terminalCursorStyle) term.options.cursorStyle = s.terminalCursorStyle
      if (s.terminalCursorBlink !== undefined) term.options.cursorBlink = s.terminalCursorBlink
      if (s.terminalLineHeight) term.options.lineHeight = s.terminalLineHeight
      try {
        fitRef.current?.fit()
        const cols = Math.max(20, term.cols)
        const rows = Math.max(5, term.rows)
        void window.terminal42.pty.resize(sessionId, cols, rows)
      } catch {}
    }).catch(() => {})
    const fit = new FitAddon()
    const search = new SearchAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.loadAddon(search)
    term.open(containerRef.current)
    termRef.current = term
    fitRef.current = fit
    searchRef.current = search

    // Cache copy-on-select preference to avoid IPC on every selection change
    let copyOnSelect = false
    void window.terminal42.settings.get().then((s) => { copyOnSelect = s.terminalCopyOnSelect ?? false }).catch(() => {})
    const onSettingsChanged = () => {
      void window.terminal42.settings.get().then((s) => { copyOnSelect = s.terminalCopyOnSelect ?? false }).catch(() => {})
    }
    window.addEventListener('t42:settings-changed', onSettingsChanged)

    const selDispose = term.onSelectionChange(() => {
      const sel = term.getSelection() || ''
      selectionRef.current = sel
      notifyTerminalSelectionChanged()
      if (sel && copyOnSelect) void navigator.clipboard.writeText(sel).catch(() => {})
    })

    let cancelled = false
    let disposeData: (() => void) | undefined
    let disposeExit: (() => void) | undefined

    try { fit.fit() } catch {}
    term.focus()

    const start = async () => {
      const cols = Math.max(20, term.cols || 100)
      const rows = Math.max(5, term.rows || 30)
      let result: { ok: boolean; existing?: boolean; copilotSessionId?: string | null } | null = null
      try {
        result = await window.terminal42.pty.spawn(sessionId, { cwd, cols, rows })
      } catch (err) {
        term.writeln(`\r\n\x1b[31m[failed to start shell: ${String(err)}]\x1b[0m`)
        return
      }
      if (cancelled) return

      let liveBuffer: string[] | null = []
      // Clean-view state: only auto-confirms the "Confirm folder trust" prompt
      // for freshly-spawned PTYs. We deliberately do NOT clear xterm here :
      // clearing the buffer while Copilot's Ink UI is mid-render breaks input.
      const cleanView = {
        enabled: !result?.existing,
        stripped: '',
        folderTrustHandled: false
      }
      disposeData = window.terminal42.pty.onData(sessionId, (data) => {
        if (liveBuffer) liveBuffer.push(data)
        else { try { term.write(data) } catch {} }
        if (cleanView.enabled && !cleanView.folderTrustHandled) {
          cleanView.stripped = (cleanView.stripped + stripAnsiLite(data)).slice(-4096)
          if (/Confirm folder trust/i.test(cleanView.stripped)) {
            cleanView.folderTrustHandled = true
            // "2" + Enter = "Yes, and remember this folder for future sessions"
            setTimeout(() => { void window.terminal42.pty.write(sessionId, '2\r') }, 600)
          }
        }
      })
      disposeExit = window.terminal42.pty.onExit(sessionId, (code) => {
        try { term.writeln(`\r\n\x1b[2;90m[process exited with code ${code}]\x1b[0m`) } catch {}
      })

      // Replay only when we just spawned a fresh PTY (the previous one died,
      // or this is a cold start after an app quit). Prefer the raw on-disk
      // scrollback (cursor escapes intact) so xterm repaints the actual
      // prior screen — falling back to the stripped tail log only if no
      // scrollback was saved.
      if (!result?.existing) {
        let restored = false
        try {
          const saved = await window.terminal42.pty.savedScrollback(sessionId)
          if (saved && saved.length > 0) {
            try {
              term.write(saved)
              term.writeln('')
              term.writeln(`\x1b[2;90m─── restored from previous session ───\x1b[0m`)
              restored = true
            } catch {}
          }
        } catch {}
        if (!restored) {
          const tail = await window.terminal42.sessions
            .tailLog(sessionId)
            .catch(() => null as { body: string; lastAt: number | null } | null)
          if (tail && tail.body) {
            const when = tail.lastAt ? new Date(tail.lastAt).toLocaleString() : ''
            const sizeKb = (tail.body.length / 1024).toFixed(1)
            try {
              term.writeln(`\x1b[2;90m─── earlier in this session · ${sizeKb} KB · until ${when} ───\x1b[0m`)
              term.write('\x1b[2m')
              term.write(tail.body.replace(/\r?\n/g, '\r\n'))
              term.write('\x1b[0m')
              term.writeln('')
              term.writeln(`\x1b[2;90m─── live ───\x1b[0m`)
            } catch {}
          }
        }
      } else {
        // Existing PTY (HMR re-mount, tab switch, app re-show on macOS).
        // Replay the in-memory raw scrollback so xterm shows the actual
        // colored output up to "now": not just a hollow header.
        try {
          const sb = await window.terminal42.pty.scrollback(sessionId)
          if (sb) {
            term.write(sb)
          } else {
            term.writeln(`\x1b[2;90m─── reattached to live session ───\x1b[0m`)
          }
        } catch {
          try { term.writeln(`\x1b[2;90m─── reattached to live session ───\x1b[0m`) } catch {}
        }
      }
      const drain = liveBuffer
      liveBuffer = null
      if (drain) for (const d of drain) { try { term.write(d) } catch {} }

      if (!result?.existing) {
        const sess = await window.terminal42.sessions.get(sessionId).catch(() => undefined)
        const linked = sess?.copilot_session_id ?? result?.copilotSessionId ?? null
        let modelId = sess?.model ?? null
        let brainAutoApply = true
        let toolFlag = ''
        try {
          const s = await window.terminal42.settings.get()
          if (!modelId) modelId = s.defaultModel || null
          brainAutoApply = !!s.brainAutoApply
          // Derive Copilot launch flags from user's approval settings
          if (s.approvalPolicy === 'full-auto') toolFlag = ' --allow-all-tools'
          else if (s.approvalPolicy === 'auto-edit') toolFlag = ' --allow-all-tools'
          else toolFlag = ''
        } catch {}
        const modelArg = modelId ? ` --model ${modelId}` : ''
        if (linked) {
          setTimeout(() => { void window.terminal42.pty.write(sessionId, `\x15copilot${toolFlag} --resume ${linked}${modelArg}\r`) }, 350)
        } else if (autoLaunchCopilot) {
          setTimeout(() => { void window.terminal42.pty.write(sessionId, `\x15copilot${toolFlag}${modelArg}\r`) }, 350)
        }
        if (modelId && !sess?.model) {
          try { await window.terminal42.sessions.setModel(sessionId, modelId) } catch {}
        }
        if (brainAutoApply && (linked || autoLaunchCopilot) && !brainAppliedSet.has(sessionId)) {
          brainAppliedSet.add(sessionId)
          setTimeout(async () => {
            try {
              const m = await window.terminal42.brain.merged(projectId ?? null, sessionId)
              const memPath = await window.terminal42.memory.path().catch(() => '')
              const skillsApplicable = await window.terminal42.skills
                .applicable(projectId ?? null)
                .catch(() => [] as Array<{ name: string; format: string; body: string; scope: { kind: string } }>)
              const styleBit = m.flat ? `Style: ${m.flat}. ` : ''
              const brainBit = memPath
                ? `Brain: ${memPath} (read before answering; append new prefs as bullets). `
                : ''
              const skillsBit = skillsApplicable.length > 0
                ? `Skills: ${skillsApplicable.map((s) => s.name).join(', ')}. `
                : ''
              const body = styleBit + brainBit + skillsBit
              if (!body) return
              const preface = `[Terminal42: ${body}]`
              await window.terminal42.pty.write(sessionId, preface + '\r')
            } catch {}
          }, 4500)
        }
        // Project-brief kickoff: drain any pending kickoff prompt for this
        // project. Stored by the Brief Wizard in localStorage and consumed by
        // the first session that fires after the brief is saved.
        if (projectId && (linked || autoLaunchCopilot)) {
          const kickoffKey = `t42:kickoff:${projectId}`
          const kickoff = (() => { try { return localStorage.getItem(kickoffKey) } catch { return null } })()
          if (kickoff) {
            try { localStorage.removeItem(kickoffKey) } catch {}
            // Fire after brain preface (4.5s) so copilot has fully booted and
            // received its style/brain preamble first.
            setTimeout(() => {
              void window.terminal42.pty.write(sessionId, kickoff + '\r')
            }, 6000)
          }
        }
      }
    }
    void start()

    let escMode: 'none' | 'esc' | 'osc' | 'csi' = 'none'
    const dataDispose = term.onData((data) => {
      void window.terminal42.pty.write(sessionId, data)
      if (titledRef.current) return
      for (const ch of data) {
        if (escMode === 'osc') {
          if (ch === '\x07' || ch === '\x9c') escMode = 'none'
          continue
        }
        if (escMode === 'csi') {
          if (ch >= '@' && ch <= '~') escMode = 'none'
          continue
        }
        if (escMode === 'esc') {
          if (ch === ']') { escMode = 'osc'; continue }
          if (ch === '[') { escMode = 'csi'; continue }
          escMode = 'none'
          continue
        }
        if (ch === '\x1b') { escMode = 'esc'; firstLineBufRef.current = ''; continue }
        if (ch === '\r' || ch === '\n') {
          const line = firstLineBufRef.current.trim()
          firstLineBufRef.current = ''
          if (line.length >= 3 && !line.startsWith('/')) {
            titledRef.current = true
            void window.terminal42.sessions.autoTitle(sessionId, line)
          }
        } else if (ch === '\x7f' || ch === '\b') {
          firstLineBufRef.current = firstLineBufRef.current.slice(0, -1)
        } else if (ch >= ' ' && ch < '\x7f') {
          firstLineBufRef.current += ch
          if (firstLineBufRef.current.length > 200) firstLineBufRef.current = firstLineBufRef.current.slice(-200)
        }
      }
    })

    const onResize = () => {
      try {
        fit.fit()
        const cols = Math.max(20, term.cols)
        const rows = Math.max(5, term.rows)
        void window.terminal42.pty.resize(sessionId, cols, rows)
      } catch {}
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(containerRef.current)

    const onRestartEvt = async (e: Event) => {
      const ce = e as CustomEvent<{ id: string }>
      if (!ce.detail || ce.detail.id !== sessionId) return
      try {
        // Dispose old listeners before restarting to prevent duplicates
        disposeData?.()
        disposeExit?.()
        disposeData = undefined
        disposeExit = undefined
        await window.terminal42.pty.kill(sessionId)
        brainAppliedSet.delete(sessionId)
        try { term.write('\r\n\x1b[2;90m[restarting…]\x1b[0m\r\n') } catch {}
        setTimeout(() => { void start() }, 250)
      } catch {}
    }
    window.addEventListener('t42:restart-session', onRestartEvt as EventListener)

    const onContext = (ev: MouseEvent) => {
      ev.preventDefault()
      const sel = term.getSelection() || ''
      // Clamp position so the menu doesn't overflow the viewport
      const menuW = 200, menuH = 300
      const x = Math.min(ev.clientX, window.innerWidth - menuW - 8)
      const y = Math.min(ev.clientY, window.innerHeight - menuH - 8)
      setCtx({ x, y, selection: sel })
    }
    const containerEl = containerRef.current
    containerEl.addEventListener('contextmenu', onContext)

    return () => {
      cancelled = true
      ro.disconnect()
      dataDispose.dispose()
      selDispose.dispose()
      disposeData?.()
      disposeExit?.()
      window.removeEventListener('t42:restart-session', onRestartEvt as EventListener)
      window.removeEventListener('t42:settings-changed', onSettingsChanged)
      containerEl.removeEventListener('contextmenu', onContext)
      term.dispose()
    }
  }, [sessionId])

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = theme === 'dark' ? DARK_THEME : LIGHT_THEME
    }
  }, [theme])

  // Listen for settings changes and apply terminal options live
  useEffect(() => {
    const apply = (): void => {
      void window.terminal42.settings.get().then((s) => {
        const t = termRef.current
        if (!t) return
        if (s.terminalFontSize) t.options.fontSize = s.terminalFontSize
        if (s.terminalFontFamily) t.options.fontFamily = `"${s.terminalFontFamily}", "SF Mono", Menlo, monospace`
        if (s.terminalCursorStyle) t.options.cursorStyle = s.terminalCursorStyle
        if (s.terminalCursorBlink !== undefined) t.options.cursorBlink = s.terminalCursorBlink
        if (s.terminalLineHeight) t.options.lineHeight = s.terminalLineHeight
        try {
          fitRef.current?.fit()
          void window.terminal42.pty.resize(sessionId, Math.max(20, t.cols), Math.max(5, t.rows))
        } catch {}
      }).catch(() => {})
    }
    window.addEventListener('t42:settings-changed', apply)
    return () => window.removeEventListener('t42:settings-changed', apply)
  }, [])

  // ⌘F search, ⌘+/⌘- zoom — only when this pane is active
  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent): void => {
      const meta = e.metaKey || e.ctrlKey
      // ⌘F → toggle search bar
      if (meta && e.key === 'f') {
        e.preventDefault()
        setSearchOpen((o) => {
          if (!o) setTimeout(() => searchInputRef.current?.focus(), 50)
          else searchRef.current?.clearDecorations()
          return !o
        })
        return
      }
      // ⌘+ / ⌘= → zoom in
      if (meta && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        const t = termRef.current
        if (t && t.options.fontSize && t.options.fontSize < 28) {
          t.options.fontSize = t.options.fontSize + 1
          try { fitRef.current?.fit() } catch {}
          void window.terminal42.pty.resize(sessionId, Math.max(20, t.cols), Math.max(5, t.rows))
        }
        return
      }
      // ⌘- → zoom out
      if (meta && e.key === '-') {
        e.preventDefault()
        const t = termRef.current
        if (t && t.options.fontSize && t.options.fontSize > 8) {
          t.options.fontSize = t.options.fontSize - 1
          try { fitRef.current?.fit() } catch {}
          void window.terminal42.pty.resize(sessionId, Math.max(20, t.cols), Math.max(5, t.rows))
        }
        return
      }
      // Escape → close search
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
        setSearchQuery('')
        searchRef.current?.clearDecorations()
        termRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen, isActive, sessionId])

  const doSearch = useCallback((query: string, direction: 'next' | 'prev' = 'next') => {
    setSearchQuery(query)
    if (!query) { searchRef.current?.clearDecorations(); return }
    if (direction === 'next') searchRef.current?.findNext(query, { caseSensitive: false })
    else searchRef.current?.findPrevious(query, { caseSensitive: false })
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1800)
  }

  const copySelection = async () => {
    const sel = selectionRef.current || termRef.current?.getSelection() || ''
    if (!sel) { showToast('Select some text first'); return }
    try {
      await navigator.clipboard.writeText(sel)
      showToast('Copied')
    } catch {
      showToast('Copy failed')
    }
  }

  const pasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        await window.terminal42.pty.write(sessionId, text)
        showToast('Pasted')
      }
    } catch {
      showToast('Paste failed')
    }
  }

  const deleteLine = async () => {
    // Send multiple clear strategies to cover different contexts:
    // 1. Escape (clears Ink/Copilot CLI input)
    // 2. Ctrl+C (cancel current input, gives fresh prompt)
    await window.terminal42.pty.write(sessionId, '\x1b\x03')
    showToast('Cleared line')
  }

  const clearScreen = async () => {
    termRef.current?.clear()
  }

  const captureSelection = async () => {
    const sel = selectionRef.current || termRef.current?.getSelection() || ''
    if (!sel) { showToast('Select some text first'); return }
    try {
      await window.terminal42.memory.capture(sel, 'terminal')
      window.dispatchEvent(new CustomEvent('t42:memory-changed'))
      showToast('Captured to Brain')
    } catch {
      showToast('Capture failed')
    }
  }

  const uploadFile = async (images = false) => {
    try {
      const paths = await window.terminal42.files.pick({ multi: false, images })
      if (paths.length === 0) return
      const quoted = paths.map((p) => `'${p.replace(/'/g, "'\\''")}'`).join(' ')
      await window.terminal42.pty.write(sessionId, quoted + ' ')
      termRef.current?.focus()
      showToast('Inserted file path')
    } catch {
      showToast('Upload failed')
    }
  }

  useEffect(() => {
    return registerTerminalActions(sessionId, {
      copy: () => { void copySelection() },
      paste: () => copyOrFire(pasteClipboard),
      clearLine: () => { void deleteLine() },
      clearScreen: () => { void clearScreen() },
      attachFile: () => copyOrFire(() => uploadFile(false)),
      attachImage: () => copyOrFire(() => uploadFile(true)),
      captureToBrain: () => { void captureSelection() },
      getSelection: () => selectionRef.current
    })
    // copyOrFire is just a tiny passthrough that ignores the returned promise
    function copyOrFire(fn: () => Promise<void> | void): void { void fn() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  return (
    <div className="relative h-full w-full" onMouseDown={(e) => { if (e.button === 0 && !searchOpen) termRef.current?.focus() }}>
      <div ref={containerRef} className="h-full w-full px-4 pt-3" data-testid="terminal-pane" />

      {/* Search bar (⌘F) */}
      {searchOpen && (
        <div className="absolute right-4 top-2 z-30 flex items-center gap-1 rounded-lg bg-raised px-2 py-1.5 shadow-overlay">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => doSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                doSearch(searchQuery, e.shiftKey ? 'prev' : 'next')
              }
              if (e.key === 'Escape') {
                setSearchOpen(false)
                setSearchQuery('')
                searchRef.current?.clearDecorations()
                termRef.current?.focus()
              }
            }}
            placeholder="Find…"
            className="w-48 bg-transparent px-1 text-[12.5px] text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={() => doSearch(searchQuery, 'prev')}
            title="Previous (Shift+Enter)"
            className="grid h-6 w-6 place-items-center rounded text-text-muted hover:text-text-primary"
          >↑</button>
          <button
            type="button"
            onClick={() => doSearch(searchQuery, 'next')}
            title="Next (Enter)"
            className="grid h-6 w-6 place-items-center rounded text-text-muted hover:text-text-primary"
          >↓</button>
          <button
            type="button"
            onClick={() => { setSearchOpen(false); setSearchQuery(''); searchRef.current?.clearDecorations(); termRef.current?.focus() }}
            title="Close (Esc)"
            className="grid h-6 w-6 place-items-center rounded text-text-muted hover:text-text-primary"
          >✕</button>
        </div>
      )}
      {toast && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-text-primary px-3 py-1.5 text-[12px] text-bg shadow-lg">
          {toast}
        </div>
      )}
      {ctx && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCtx(null)} onContextMenu={(e) => { e.preventDefault(); setCtx(null) }} />
          <div
            className="fixed z-50 min-w-[180px] overflow-hidden rounded-md bg-raised py-1 text-[13px] shadow-overlay"
            style={{ left: ctx.x, top: ctx.y }}
          >
            <CtxItem onClick={() => { void copySelection(); setCtx(null) }} disabled={!ctx.selection}>Copy</CtxItem>
            <CtxItem onClick={() => { void pasteClipboard(); setCtx(null) }}>Paste</CtxItem>
            <CtxItem onClick={() => { void deleteLine(); setCtx(null) }}>Clear input line</CtxItem>
            <CtxItem onClick={() => { void clearScreen(); setCtx(null) }}>Clear screen</CtxItem>
            <CtxItem onClick={() => { setSearchOpen(true); setCtx(null); setTimeout(() => searchInputRef.current?.focus(), 50) }}>Find in terminal</CtxItem>
            <div className="my-1" />
            <CtxItem onClick={() => { void captureSelection(); setCtx(null) }} disabled={!ctx.selection}>
              Capture selection to Brain
            </CtxItem>
            <CtxItem onClick={() => { void uploadFile(false); setCtx(null) }}>Attach file…</CtxItem>
            <CtxItem onClick={() => { void uploadFile(true); setCtx(null) }}>Attach image…</CtxItem>
          </div>
        </>
      )}
    </div>
  )
}

function CtxItem({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center px-3 py-1.5 text-left text-text-secondary hover:bg-elevated hover:text-text-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-secondary"
    >
      {children}
    </button>
  )
}
