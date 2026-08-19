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

export type DisplayModel = { id: string; label: string; group: string }

// Baseline shown before the first live fetch completes (and used forever if
// the CLI/SDK path never works in a given environment). Kept in sync with
// ModelDropdown.tsx's DEFAULT_MODELS by copy — this is just the safety net,
// not the source of truth once live data arrives.
const FALLBACK_MODELS: DisplayModel[] = [
  { id: 'claude-opus-4.8', label: 'Claude Opus 4.8', group: 'Anthropic' },
  { id: 'claude-opus-4.7', label: 'Claude Opus 4.7', group: 'Anthropic' },
  { id: 'claude-opus-4.6', label: 'Claude Opus 4.6', group: 'Anthropic' },
  { id: 'claude-opus-4.5', label: 'Claude Opus 4.5', group: 'Anthropic' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', group: 'Anthropic' },
  { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6', group: 'Anthropic' },
  { id: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5', group: 'Anthropic' },
  { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', group: 'Anthropic' },
  { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', group: 'OpenAI' },
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', group: 'OpenAI' },
  { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', group: 'OpenAI' },
  { id: 'gpt-5.5', label: 'GPT-5.5', group: 'OpenAI' },
  { id: 'gpt-5.4', label: 'GPT-5.4', group: 'OpenAI' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', group: 'OpenAI' },
  { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', group: 'OpenAI' },
  { id: 'gpt-5-mini', label: 'GPT-5 mini', group: 'OpenAI' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', group: 'Google' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', group: 'Google' },
  { id: 'mai-code-1-flash-picker', label: 'MAI-Code-1-Flash', group: 'Microsoft' }
]

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

const KNOWN_PREFIXES: Array<{ test: RegExp; group: string }> = [
  { test: /^claude-/i, group: 'Anthropic' },
  { test: /^gpt-/i, group: 'OpenAI' },
  { test: /^o[0-9]/i, group: 'OpenAI' },
  { test: /^gemini-/i, group: 'Google' },
  { test: /^mai-/i, group: 'Microsoft' },
  { test: /^phi-/i, group: 'Microsoft' }
]

function inferGroup(id: string): string {
  for (const { test, group } of KNOWN_PREFIXES) {
    if (test.test(id)) return group
  }
  return 'Other'
}

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
  const { CopilotClient } = await import('@github/copilot-sdk')
  const client = new CopilotClient({ cliPath: 'copilot' })
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

const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000 // 12h
let intervalHandle: ReturnType<typeof setInterval> | null = null

export function initModelCatalog(getWin: () => BrowserWindow | null): void {
  // Kick off an initial refresh shortly after launch (don't block startup),
  // then keep it fresh in the background without any manual action.
  setTimeout(() => { void refresh(getWin()) }, 3000)
  intervalHandle = setInterval(() => { void refresh(getWin()) }, REFRESH_INTERVAL_MS)
}

export function stopModelCatalog(): void {
  if (intervalHandle) clearInterval(intervalHandle)
  intervalHandle = null
}

export function registerModelsIpc(getWin: () => BrowserWindow | null): void {
  ipcMain.handle('models:list', () => currentModels)
  ipcMain.handle('models:refresh', async () => {
    await refresh(getWin())
    return currentModels
  })
  ipcMain.handle('models:status', () => ({ count: currentModels.length, lastError, refreshing }))
}
