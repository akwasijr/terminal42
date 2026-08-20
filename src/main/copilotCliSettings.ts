import { ipcMain } from 'electron'
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  parseCliSettings,
  readsStoreTokenPlaintext,
  serializeCliSettings,
  withStoreTokenPlaintext
} from '../shared/copilotCliSettings'

export type PlaintextTokenState = {
  enabled: boolean
  /** False when the file exists but we could not parse it, so we refused to write. */
  ok: boolean
  path: string
}

function settingsPath(): string {
  return join(process.env.COPILOT_HOME || join(homedir(), '.copilot'), 'settings.json')
}

async function readRaw(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return ''
    return null
  }
}

export async function getPlaintextToken(): Promise<PlaintextTokenState> {
  const path = settingsPath()
  const raw = await readRaw(path)
  if (raw === null) return { enabled: false, ok: false, path }
  const parsed = parseCliSettings(raw)
  if (parsed === null) return { enabled: false, ok: false, path }
  return { enabled: readsStoreTokenPlaintext(parsed), ok: true, path }
}

export async function setPlaintextToken(enabled: boolean): Promise<PlaintextTokenState> {
  const path = settingsPath()
  const raw = await readRaw(path)
  if (raw === null) return { enabled: false, ok: false, path }
  const parsed = parseCliSettings(raw)
  // A file we cannot parse is a file we must not overwrite: it is the user's
  // CLI configuration and a bad write would lose their theme, allowed URLs and
  // MCP settings along with everything else.
  if (parsed === null) return { enabled: readsStoreTokenPlaintext({}), ok: false, path }

  const next = serializeCliSettings(withStoreTokenPlaintext(parsed, enabled))
  await mkdir(join(path, '..'), { recursive: true })
  // Write to a sibling then rename, so a crash mid-write cannot truncate the
  // real file.
  const tmp = `${path}.t42.tmp`
  await writeFile(tmp, next, 'utf8')
  await rename(tmp, path)
  return { enabled, ok: true, path }
}

export function registerCopilotCliSettingsIpc(): void {
  ipcMain.handle('copilotCli:getPlaintextToken', () => getPlaintextToken())
  ipcMain.handle('copilotCli:setPlaintextToken', (_e, enabled: boolean) =>
    setPlaintextToken(enabled === true)
  )
}
