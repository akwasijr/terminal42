import { app, BrowserWindow, shell, nativeTheme, Menu, ipcMain, session, nativeImage } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { registerPtyIpc, killAllSessions, listLiveSessions, killSession } from './pty'
import { registerProjectIpc } from './projects'
import { registerComposerIpc } from './composer'
import { registerChatIpc, killAllChats } from './chat'
import { registerDesignIpc, stopAllDesignWatchers, killAllDesignRuns } from './design'
import { registerPreviewIpc, killAllPreviews, runningPreviewCount, runningPreviewList, stopPreview } from './preview'
import { registerSkillsIpc } from './skills'
import { registerRecipesIpc } from './recipes'
import { registerBrainIpc } from './brain'
import { registerBriefIpc } from './brief'
import { registerGitIpc } from './git'
import { registerMemoryIpc } from './memory'
import { registerFilesIpc } from './files'
import { registerVoiceIpc } from './voice'
import { registerSettingsIpc } from './settings'
import { registerInsightsIpc, stopInsightsScheduler } from './insights'
import { registerTasksIpc, stopTasksWatcher } from './tasks'
import { registerActivityIpc } from './activity'
import { registerSearchIpc } from './search'
import { registerVizTweakIpc } from './viztweak'
import { registerBrowserStateIpc } from './browserState'
import { registerTemplatesIpc } from './templates'
import { registerTemplatePreviewsIpc } from './template-previews'
import { purgeOldLogs, purgeLegacyLogs, shutdownLog } from './sessionLog'

let mainWindow: BrowserWindow | null = null
let recoveringRenderer = false

// Last-resort logging for things that would otherwise terminate the main
// process with no output. Node terminates by default on uncaughtException,
// and depending on flags also on unhandledRejection — both can cause the
// whole Electron app to vanish from the dock with nothing in the log.
process.on('uncaughtException', (err) => {
  console.error('[Terminal42] FATAL uncaughtException:', err?.stack || err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[Terminal42] unhandledRejection:', reason instanceof Error ? reason.stack : reason)
})

// macOS Electron dev sessions on this machine have been crashing with
// "GPU state invalid after WaitForGetOffsetInRange" → renderer dies clean-
// exit code 1. The render-process-gone auto-reload below catches it, but
// the cleanest fix is to bypass the flaky GPU pipeline entirely in dev.
// Production builds keep hardware acceleration for smooth previews.
if (process.env.ELECTRON_RENDERER_URL) {
  try { app.disableHardwareAcceleration() } catch {}
}

// Log when ANY Electron child process (GPU, network, utility) dies. The
// render-process-gone handler only covers renderer death; a GPU process
// crash often precedes and triggers the renderer crash, so logging both
// lets us diagnose which side actually failed first.
app.on('child-process-gone', (_e, details) => {
  console.error('[Terminal42] child-process gone:', JSON.stringify(details))
})

function isTerminal42Url(url: string): boolean {
  if (process.env.ELECTRON_RENDERER_URL && url.startsWith(process.env.ELECTRON_RENDERER_URL)) return true
  try {
    const target = new URL(url)
    const renderer = new URL(pathToFileURL(join(__dirname, '../renderer/index.html')).toString())
    return target.protocol === renderer.protocol && target.pathname === renderer.pathname
  } catch {
    return false
  }
}

function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function buildAppMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: 'Terminal42',
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { role: 'services' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const }
          ]
        }]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function rendererUrl(safe: boolean): string {
  const base = process.env.ELECTRON_RENDERER_URL
  if (!base) return ''
  const url = new URL(base)
  if (safe) url.searchParams.set('safe', '1')
  return url.toString()
}

function loadRenderer(win: BrowserWindow, opts: { safe?: boolean; attempt?: number } = {}): void {
  const attempt = opts.attempt ?? 1
  const loadBundledRenderer = (): void => {
    if (win.isDestroyed()) return
    win.loadFile(join(__dirname, '../renderer/index.html'), opts.safe ? { query: { safe: '1' } } : undefined).catch((err) => {
      console.error('[Terminal42] bundled renderer fallback failed:', err)
    })
  }
  const onFailure = (err: unknown): void => {
    console.error(`[Terminal42] renderer load failed (attempt ${attempt}):`, err)
    if (win.isDestroyed()) return
    if (attempt >= 3 && process.env.ELECTRON_RENDERER_URL) {
      console.error('[Terminal42] dev renderer unavailable; falling back to bundled renderer')
      loadBundledRenderer()
      return
    }
    if (attempt >= 8) {
      if (!process.env.ELECTRON_RENDERER_URL) return
      loadBundledRenderer()
      return
    }
    setTimeout(() => loadRenderer(win, { safe: opts.safe, attempt: attempt + 1 }), 300 * attempt)
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(rendererUrl(!!opts.safe)).catch(onFailure)
  } else {
    loadBundledRenderer()
  }
}

function createWindow(opts: { safe?: boolean; replace?: BrowserWindow } = {}): void {
  const isDev = !!process.env.ELECTRON_RENDERER_URL
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 600,
    show: false,
    icon: join(__dirname, '../../resources/icon.png'),
    titleBarStyle: isDev ? 'default' : 'hiddenInset',
    trafficLightPosition: isDev ? undefined : { x: 14, y: 16 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0A0A0A' : '#FAFAFA',
    vibrancy: isDev ? undefined : 'sidebar',
    visualEffectState: isDev ? undefined : 'active',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // <webview> has repeatedly caused renderer/IPC instability in dev
      // (see repo history around "Disable webviewTag"). Keep it disabled
      // while debugging launch crashes; BrowserPane can fall back to external
      // URLs instead of taking down the whole app.
      webviewTag: false,
      // Allow native PDF rendering inside iframes (used to preview .pptx
      // versions after we convert them via soffice).
      plugins: true,
      // Allow our srcDoc-rendered designs to load images from file:// (via
      // the injected <base href>) and from any https origin (Unsplash etc).
      // Renderer code itself stays locked behind contextIsolation + the
      // http-equiv CSP in index.html.
      webSecurity: false
    }
  })
  mainWindow = win

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  win.on('ready-to-show', () => {
    if (!win.isDestroyed()) win.show()
    const old = opts.replace
    if (old && old !== win && !old.isDestroyed()) {
      try { old.destroy() } catch {}
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (isTerminal42Url(url)) return
    event.preventDefault()
    console.warn(`[Terminal42] blocked top-level navigation: ${url}`)
    if (isHttpUrl(url)) void shell.openExternal(url)
  })

  // If the renderer dies, log full details and auto-reload in safe mode
  // so persisted UI state can't trap the user in a crash loop.
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[Terminal42] renderer gone:', JSON.stringify(details))
    // 'clean-exit' with a non-zero code is what we see when Chromium's GPU
    // / network service crashes on macOS — the renderer reports a "clean"
    // exit but the window is dead. Treat it as a crash and auto-reload so
    // the user isn't left staring at a closed window.
    const isCrash =
      details.reason === 'crashed' ||
      details.reason === 'oom' ||
      details.reason === 'killed' ||
      (details.reason === 'clean-exit' && details.exitCode !== 0)
    if (!isCrash) return
    if (recoveringRenderer) return
    recoveringRenderer = true
    // A crashed/clean-exited renderer can leave webContents in a state where
    // loadURL/loadFile rejects with ERR_FAILED. Don't reuse that native
    // object. Also don't destroy the old window before the replacement has
    // loaded: electron-vite exits the app if all windows disappear during
    // recovery.
    setTimeout(() => {
      try {
        createWindow({ safe: true, replace: win })
      } catch (err) {
        console.error('[Terminal42] recreate window after crash failed:', err)
      } finally {
        setTimeout(() => { recoveringRenderer = false }, 1000)
      }
    }, 100)
  })

  // Capture every preload / renderer console message in main's stderr
  // so we have a record of errors even when devtools is closed.
  win.webContents.on('console-message', (_e, level, message, line, source) => {
    if (level >= 2) console.error(`[renderer:${level}] ${message}  (${source}:${line})`)
  })

  // NOTE: a will-frame-navigate handler had a bad interaction with
  // electron-vite's HMR. The will-navigate guard above only protects the
  // top app window from generated preview HTML trying to replace Terminal42.

  loadRenderer(win, { safe: opts.safe })
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(nativeImage.createFromPath(join(__dirname, '../../resources/icon.png')))
    } catch {
      /* dock icon optional */
    }
  }
  buildAppMenu()
  registerPtyIpc(() => mainWindow)
  registerProjectIpc(() => mainWindow)
  registerComposerIpc()
  registerChatIpc(() => mainWindow)
  registerDesignIpc(() => mainWindow)
  registerPreviewIpc(() => mainWindow)
  registerSkillsIpc(() => mainWindow)
  registerRecipesIpc(() => mainWindow)
  registerBrainIpc()
  registerBriefIpc()
  registerGitIpc()
  registerMemoryIpc(() => mainWindow)
  registerFilesIpc(() => mainWindow)
  registerVoiceIpc()
  registerSettingsIpc()
  registerInsightsIpc(() => mainWindow)
  registerTasksIpc(() => mainWindow)
  registerSearchIpc()
  registerVizTweakIpc()
  registerBrowserStateIpc()
  registerTemplatesIpc(() => mainWindow)
  registerTemplatePreviewsIpc(() => mainWindow)
  registerActivityIpc({
    getRunningPreviewCount: runningPreviewCount,
    getRunningPreviews: runningPreviewList,
    getLiveSessions: listLiveSessions
  })
  ipcMain.handle('activity:stopSession', (_e, sessionId: string) => ({ ok: killSession(sessionId) }))
  ipcMain.handle('activity:stopPreview', (_e, previewId: string) => ({ ok: stopPreview(previewId) }))
  ipcMain.handle('system:revealFolder', async (_e, p: string) => {
    if (!p) return false
    try { shell.showItemInFolder(p); return true } catch { return false }
  })

  ipcMain.handle('browser:clearStorage', async (_e, scope: 'cookies' | 'cache' | 'all') => {
    const sess = session.fromPartition('persist:t42-browser')
    try {
      if (scope === 'cookies') {
        await sess.clearStorageData({ storages: ['cookies'] })
      } else if (scope === 'cache') {
        await sess.clearCache()
        await sess.clearStorageData({ storages: ['cachestorage', 'shadercache'] })
      } else {
        await sess.clearCache()
        await sess.clearStorageData()
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })
  purgeOldLogs()
  purgeLegacyLogs()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  console.error('[Terminal42] window-all-closed')
  if (process.platform === 'darwin') {
    // On macOS, keep PTYs and previews alive: user can reopen window from dock
    // and resume sessions exactly where they left off. Teardown happens on quit.
    return
  }
  app.quit()
})

app.on('before-quit', (event) => {
  console.error('[Terminal42] before-quit')
  if (process.env.ELECTRON_RENDERER_URL && recoveringRenderer) {
    console.error('[Terminal42] prevented quit during renderer recovery')
    event.preventDefault()
    return
  }
  killAllSessions()
  killAllPreviews()
  killAllChats()
  killAllDesignRuns()
  stopAllDesignWatchers()
  stopTasksWatcher()
  stopInsightsScheduler()
  shutdownLog()
})

app.on('quit', (_event, exitCode) => {
  console.error('[Terminal42] quit:', exitCode)
})
