// Token studio persistence, IPC, and the two files a studio can become.
//
// A studio is stored whole, as JSON, for the same reason a Motion document is:
// it is small, it is read and written whole, and its shape changes whenever a
// kind of token is added.
//
// The export is the part that matters to everything outside this app. Writing
// `tokens.json` and `tokens.css` into a project directory is what makes a
// studio callable from a flow or the terminal without any new plumbing: a
// recipe step can say "read tokens.json and restyle the components" and it
// works, because the file is in the format other tools already read.

import { dialog, ipcMain, type BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { getDb } from './db'
import { toCSS, toDTCG } from '../shared/tokens/export'
import { hydrateStudio } from '../shared/tokens/types'

export type TokenStudioRecord = {
  id: string
  name: string
  studio: unknown
  createdAt: number
  updatedAt: number
}

type Row = {
  id: string
  name: string
  studio: string
  created_at: number
  updated_at: number
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function toRecord(r: Row): TokenStudioRecord {
  return { id: r.id, name: r.name, studio: parse(r.studio), createdAt: r.created_at, updatedAt: r.updated_at }
}

export function listTokenStudios(): TokenStudioRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM token_studios ORDER BY updated_at DESC')
    .all() as Row[]
  return rows.map(toRecord)
}

export function getTokenStudio(id: string): TokenStudioRecord | null {
  const row = getDb().prepare('SELECT * FROM token_studios WHERE id = ?').get(id) as Row | undefined
  return row ? toRecord(row) : null
}

export function createTokenStudio(name: string, studio: unknown): TokenStudioRecord {
  const id = randomUUID()
  const now = Date.now()
  getDb()
    .prepare('INSERT INTO token_studios (id, name, studio, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, JSON.stringify(studio ?? {}), now, now)
  return { id, name, studio, createdAt: now, updatedAt: now }
}

export function saveTokenStudio(id: string, studio: unknown): boolean {
  return (
    getDb()
      .prepare('UPDATE token_studios SET studio = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(studio ?? {}), Date.now(), id).changes > 0
  )
}

export function renameTokenStudio(id: string, name: string): boolean {
  return (
    getDb()
      .prepare('UPDATE token_studios SET name = ?, updated_at = ? WHERE id = ?')
      .run(name, Date.now(), id).changes > 0
  )
}

export function deleteTokenStudio(id: string): boolean {
  return getDb().prepare('DELETE FROM token_studios WHERE id = ?').run(id).changes > 0
}

export function registerTokensIpc(getWin: () => BrowserWindow | null): void {
  ipcMain.handle('tokens:list', () => listTokenStudios())
  ipcMain.handle('tokens:get', (_e, id: string) => getTokenStudio(id))
  ipcMain.handle('tokens:create', (_e, args: { name?: string; studio: unknown }) =>
    createTokenStudio(args?.name?.trim() || 'Tokens', args?.studio))
  ipcMain.handle('tokens:save', (_e, args: { id: string; studio: unknown }) =>
    saveTokenStudio(args.id, args.studio))
  ipcMain.handle('tokens:rename', (_e, args: { id: string; name: string }) =>
    renameTokenStudio(args.id, args.name))
  ipcMain.handle('tokens:delete', (_e, id: string) => deleteTokenStudio(id))

  // Writing the files. A directory is asked for once and both files are
  // written into it, because a token set that ships as JSON but not CSS, or
  // the other way round, is half a job and the second half is always forgotten.
  ipcMain.handle(
    'tokens:export',
    async (_e, args: { studio: unknown; themeId: string | null; dir?: string | null }) => {
      const studio = hydrateStudio(args?.studio)
      let dir = args?.dir ?? null
      if (!dir) {
        const win = getWin()
        const res = win
          ? await dialog.showOpenDialog(win, {
              title: 'Where should the tokens go?',
              properties: ['openDirectory', 'createDirectory']
            })
          : { canceled: true, filePaths: [] as string[] }
        if (res.canceled || res.filePaths.length === 0) return { ok: false as const }
        dir = res.filePaths[0]
      }
      try {
        const json = join(dir, 'tokens.json')
        const css = join(dir, 'tokens.css')
        await fs.writeFile(json, toDTCG(studio, args?.themeId ?? studio.activeTheme), 'utf8')
        await fs.writeFile(css, toCSS(studio, args?.themeId ?? studio.activeTheme), 'utf8')
        return { ok: true as const, paths: [json, css] }
      } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
      }
    }
  )
}
