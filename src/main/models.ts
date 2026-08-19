// Dynamic model catalog: fetches the live, entitlement-filtered model list
// straight from the Copilot CLI (via @github/copilot-sdk's `models.list` RPC)
// instead of hand-maintaining a hardcoded array that goes stale every time a
// new model ships. Cached to disk so the picker has something to show
// immediately on launch, and refreshed in the background on an interval.
//
// Safety net: a freshly-fetched list is only ever applied if it looks sane
// (more than a couple of entries, spanning more than one known provider
// prefix). This guards against a degenerate result (e.g. just "auto") from
// silently wiping out a good cached/default list if the CLI's auth/session
// resolution ever misbehaves.

import { ipcMain, app, type BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { FALLBACK_MODELS, inferGroup, resolveModelAgainst, refreshDelayMs, MODEL_REFRESH_INTERVAL_MS, type DisplayModel } from '../shared/models'
import { resolveCopilotLauncher } from './copilotCli'

export type { DisplayModel }


function cachePath(): string {
  return join(app.getPath('userData'), 'models-cache.json')
}

function loadCache(): DisplayModel[] | null {
  try {
    const raw = JSON.parse(readFileSync(cachePath(), 'utf8')) as { models?: DisplayModel[] }
    return Array.isArray(raw.models) && raw.models.length ? raw.models : null
  } catch {
    return null
  }
}

/**
 * When the cached catalog was last fetched, or null if there is no usable cache.
 *
 * Read separately from the models themselves because the age decides whether
 * we may skip a refresh, and skipping is the whole point: a refresh spawns the
 * CLI, which reads the GitHub credential from the macOS keychain, which can
 * raise a system password dialog the user never asked for.
 */
function loadCacheFetchedAt(): number | null {
  try {
    const raw = JSON.parse(readFileSync(cachePath(), 'utf8')) as {
      models?: DisplayModel[]
      fetchedAt?: number
    }
    if (!Array.isArray(raw.models) || !raw.models.length) return null
    return typeof raw.fetchedAt === 'number' ? raw.fetchedAt : null
  } catch {
    return null
  }
}

function saveCache(models: DisplayModel[]): void {
  try {
    writeFileSync(cachePath(), JSON.stringify({ fetchedAt: Date.now(), models }), 'utf8')
  } catch (err) {
    console.error('[models] failed to write cache:', err)
  }
}

let currentModels: DisplayModel[] = loadCache() ?? FALLBACK_MODELS
let lastError: string | null = null
let refreshing = false


// A fetched list is only trusted if it clearly reflects a real entitlement
// response rather than a degenerate/auth-limited stub (e.g. just "auto").
function looksSane(models: DisplayModel[]): boolean {
  if (models.length < 3) return false
  const groups = new Set(models.map((m) => m.group))
  return groups.size >= 2 || models.length >= 5
}

async function fetchLiveModels(): Promise<DisplayModel[]> {
  // Imported lazily so a missing/broken optional dependency never breaks
  // app startup — only the (already backgrounded) refresh call fails.
  const { CopilotClient, RuntimeConnection } = await import('@github/copilot-sdk')
  // Point the SDK at the `copilot` shim rather than letting it default to the
  // bundled .js runtime. The default makes it spawn process.execPath — the
  // Electron binary — which the macOS keychain then treats as the process
  // asking for the stored credential. An ad-hoc signed dev build has no
  // stable identity to pin an ACL to, so "Always Allow" never sticks and the
  // prompt returns on every refresh. The shim runs under real node instead.
  const launcher = resolveCopilotLauncher()
  const client = launcher
    ? new CopilotClient({ connection: RuntimeConnection.forStdio({ path: launcher }) })
    : new CopilotClient()
  try {
    await client.start()
    const models = await client.listModels()
    return models
      .filter((m) => m.id !== 'auto')
      .map((m) => ({ id: m.id, label: m.name || m.id, group: inferGroup(m.id) }))
  } finally {
    // client.stop() asks the spawned `copilot --headless --stdio` process to
    // shut down gracefully via a runtime.shutdown RPC, but that call can
    // silently hang/fail (e.g. flaky IPC teardown), leaking an orphaned CLI
    // child process on every refresh. Bound the graceful path with a short
    // timeout and fall back to forceStop() (SIGKILLs the CLI process) so we
    // never accumulate zombie `copilot` processes over the app's lifetime.
    await Promise.race([
      client.stop().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 4000))
    ])
    await client.forceStop().catch(() => {})
  }
}

async function refresh(win: BrowserWindow | null): Promise<void> {
  if (refreshing) return
  refreshing = true
  try {
    const fetched = await fetchLiveModels()
    if (looksSane(fetched)) {
      currentModels = fetched
      lastError = null
      saveCache(fetched)
      try {
        win?.webContents.send('models:updated', currentModels)
      } catch {}
    } else {
      console.error('[models] live fetch returned an implausible list, keeping existing:', fetched)
    }
  } catch (err) {
    lastError = String(err)
    console.error('[models] live fetch failed, keeping existing list:', err)
  } finally {
    refreshing = false
  }
}

const REFRESH_INTERVAL_MS = MODEL_REFRESH_INTERVAL_MS
let intervalHandle: ReturnType<typeof setInterval> | null = null
let startupHandle: ReturnType<typeof setTimeout> | null = null

/**
 * Maps a requested model onto one the CLI will actually accept.
 *
 * Model IDs outlive the entitlements behind them: a session, design or recipe
 * saved months ago still carries whatever was selected at the time, and the
 * CLI emits internal IDs (`claude-opus-4.7-1m-internal`) that never appear in
 * the catalog at all. Passing a retired ID straight through to `--model`
 * fails the whole run, so resolve it here instead.
 *
 * Returns null when the flag should simply be omitted, letting the CLI pick
 * its own default — always better than failing on a name.
 */
export function resolveModel(requested: string | null | undefined): string | null {
  return resolveModelAgainst(currentModels, requested)
}

export function initModelCatalog(getWin: () => BrowserWindow | null): void {
  // Wait out whatever is left of the cache's refresh window before spawning the
  // CLI, so a relaunch with a fresh catalog stays silent instead of raising a
  // keychain dialog. Once the first refresh runs, resume the plain cadence.
  const delay = refreshDelayMs(loadCacheFetchedAt(), Date.now())
  startupHandle = setTimeout(() => {
    startupHandle = null
    void refresh(getWin())
    intervalHandle = setInterval(() => { void refresh(getWin()) }, REFRESH_INTERVAL_MS)
  }, delay)
}

export function stopModelCatalog(): void {
  if (intervalHandle) clearInterval(intervalHandle)
  intervalHandle = null
  if (startupHandle) clearTimeout(startupHandle)
  startupHandle = null
}

export function registerModelsIpc(getWin: () => BrowserWindow | null): void {
  ipcMain.handle('models:list', () => currentModels)
  ipcMain.handle('models:refresh', async () => {
    await refresh(getWin())
    return currentModels
  })
  ipcMain.handle('models:status', () => ({ count: currentModels.length, lastError, refreshing }))
}
