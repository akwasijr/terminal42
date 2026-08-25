// Motion persistence and IPC.
//
// A Motion piece is a small JSON document plus whatever images the user
// brought. The two are stored differently on purpose: the document goes in
// SQLite because it is tiny and is written on every edit, while images are
// copied into userData and referenced by path, because putting a few megabytes
// of photo inside a row that gets rewritten on every slider drag would make
// the app slower the more work you did in it.
//
// Images come back to the renderer as data URLs rather than file:// URLs.
// That is not a detail: a texture loaded from a foreign-origin URL taints the
// canvas, and a tainted canvas throws the moment the exporter asks for its
// pixels. The failure would appear only at export time, long after the import
// that caused it.

import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { getDb } from './db'

export type MotionRecord = {
  id: string
  title: string
  doc: unknown
  thumbnail: string | null
  createdAt: number
  updatedAt: number
}

export type MotionLayoutRecord = {
  id: string
  name: string
  componentId: string
  doc: unknown
  thumbnail: string | null
  createdAt: number
}

type DocRow = {
  id: string; title: string; doc: string; thumbnail: string | null
  created_at: number; updated_at: number
}

type LayoutRow = {
  id: string; name: string; component_id: string; doc: string
  thumbnail: string | null; created_at: number
}

function imagesRoot(): string {
  return join(app.getPath('userData'), 'motion-images')
}

function parse(json: string): unknown {
  try { return JSON.parse(json) } catch { return null }
}

function rowToRecord(row: DocRow): MotionRecord {
  return {
    id: row.id,
    title: row.title,
    doc: parse(row.doc),
    thumbnail: row.thumbnail,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listMotionDocs(): MotionRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM motion_docs ORDER BY updated_at DESC')
    .all() as DocRow[]
  return rows.map(rowToRecord)
}

export function getMotionDoc(id: string): MotionRecord | null {
  const row = getDb().prepare('SELECT * FROM motion_docs WHERE id = ?').get(id) as DocRow | undefined
  return row ? rowToRecord(row) : null
}

export function createMotionDoc(title: string, doc: unknown): MotionRecord {
  const id = randomUUID()
  const now = Date.now()
  getDb()
    .prepare('INSERT INTO motion_docs (id, title, doc, thumbnail, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)')
    .run(id, title, JSON.stringify(doc ?? {}), now, now)
  return { id, title, doc, thumbnail: null, createdAt: now, updatedAt: now }
}

export function saveMotionDoc(id: string, doc: unknown, thumbnail?: string | null): boolean {
  const now = Date.now()
  // The thumbnail is only overwritten when one is supplied, so an autosave
  // triggered by a keystroke does not wipe the picture the user can see in
  // their list while the renderer is mid-frame and has none to give.
  const res = thumbnail === undefined
    ? getDb().prepare('UPDATE motion_docs SET doc = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(doc ?? {}), now, id)
    : getDb().prepare('UPDATE motion_docs SET doc = ?, thumbnail = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(doc ?? {}), thumbnail, now, id)
  return res.changes > 0
}

export function renameMotionDoc(id: string, title: string): boolean {
  return getDb()
    .prepare('UPDATE motion_docs SET title = ?, updated_at = ? WHERE id = ?')
    .run(title.trim() || 'Untitled', Date.now(), id).changes > 0
}

export function deleteMotionDoc(id: string): boolean {
  return getDb().prepare('DELETE FROM motion_docs WHERE id = ?').run(id).changes > 0
}

export function listMotionLayouts(): MotionLayoutRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM motion_layouts ORDER BY created_at DESC')
    .all() as LayoutRow[]
  return rows.map((r) => ({
    id: r.id, name: r.name, componentId: r.component_id,
    doc: parse(r.doc), thumbnail: r.thumbnail, createdAt: r.created_at
  }))
}

export function saveMotionLayout(name: string, componentId: string, doc: unknown, thumbnail: string | null): MotionLayoutRecord {
  const id = randomUUID()
  const now = Date.now()
  getDb()
    .prepare('INSERT INTO motion_layouts (id, name, component_id, doc, thumbnail, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name, componentId, JSON.stringify(doc ?? {}), thumbnail, now)
  return { id, name, componentId, doc, thumbnail, createdAt: now }
}

export function deleteMotionLayout(id: string): boolean {
  return getDb().prepare('DELETE FROM motion_layouts WHERE id = ?').run(id).changes > 0
}

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif'
}

async function toStoredImage(sourcePath: string): Promise<{ id: string; name: string; path: string; dataUrl: string } | null> {
  const ext = extname(sourcePath).toLowerCase()
  const mime = MIME[ext]
  if (!mime) return null
  const bytes = await fs.readFile(sourcePath)
  const id = randomUUID()
  await fs.mkdir(imagesRoot(), { recursive: true })
  const dest = join(imagesRoot(), `${id}${ext}`)
  await fs.writeFile(dest, bytes)
  return {
    id,
    name: sourcePath.split('/').pop() ?? 'image',
    path: dest,
    dataUrl: `data:${mime};base64,${bytes.toString('base64')}`
  }
}

export function registerMotionIpc(getWin: () => BrowserWindow | null): void {
  ipcMain.handle('motion:list', () => listMotionDocs())
  ipcMain.handle('motion:get', (_e, id: string) => getMotionDoc(id))
  ipcMain.handle('motion:create', (_e, args: { title?: string; doc: unknown }) =>
    createMotionDoc(args?.title?.trim() || 'Untitled', args?.doc))
  ipcMain.handle('motion:save', (_e, args: { id: string; doc: unknown; thumbnail?: string | null }) =>
    saveMotionDoc(args.id, args.doc, args.thumbnail))
  ipcMain.handle('motion:rename', (_e, args: { id: string; title: string }) =>
    renameMotionDoc(args.id, args.title))
  ipcMain.handle('motion:delete', (_e, id: string) => deleteMotionDoc(id))

  ipcMain.handle('motion:layouts', () => listMotionLayouts())
  ipcMain.handle('motion:saveLayout', (_e, args: { name: string; componentId: string; doc: unknown; thumbnail?: string | null }) =>
    saveMotionLayout(args.name?.trim() || 'Layout', args.componentId, args.doc, args.thumbnail ?? null))
  ipcMain.handle('motion:deleteLayout', (_e, id: string) => deleteMotionLayout(id))

  ipcMain.handle('motion:importImages', async () => {
    const win = getWin()
    const res = win
      ? await dialog.showOpenDialog(win, {
          title: 'Add images',
          properties: ['openFile', 'multiSelections'],
          filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'] }]
        })
      : { canceled: true, filePaths: [] as string[] }
    if (res.canceled || res.filePaths.length === 0) return { ok: false, images: [] }
    const images = []
    for (const p of res.filePaths) {
      try {
        const stored = await toStoredImage(p)
        if (stored) images.push(stored)
      } catch {
        // One unreadable file should not lose the other nine the user picked.
      }
    }
    return { ok: images.length > 0, images }
  })

  // Pictures dragged in from the desktop. Same copy-into-the-app treatment as
  // the file dialog, so a piece does not break when the original is moved.
  ipcMain.handle('motion:addImages', async (_e, paths: string[]) => {
    const images = []
    for (const p of Array.isArray(paths) ? paths : []) {
      try {
        const stored = await toStoredImage(p)
        if (stored) images.push(stored)
      } catch {
        // One unreadable file should not lose the rest of the drop.
      }
    }
    return { ok: images.length > 0, images }
  })

  ipcMain.handle('motion:readImage', async (_e, path: string) => {
    try {
      const ext = extname(path).toLowerCase()
      const mime = MIME[ext]
      if (!mime) return null
      const bytes = await fs.readFile(path)
      return `data:${mime};base64,${bytes.toString('base64')}`
    } catch {
      return null
    }
  })

  ipcMain.handle('motion:exportFile', async (_e, args: { fileName: string; dataUrl?: string; base64?: string }) => {
    const win = getWin()
    const res = await dialog.showSaveDialog(win ?? undefined as never, {
      title: 'Export',
      defaultPath: args.fileName
    })
    if (res.canceled || !res.filePath) return { ok: false }
    const payload = args.base64 ?? (args.dataUrl ? args.dataUrl.split(',')[1] ?? '' : '')
    await fs.writeFile(res.filePath, Buffer.from(payload, 'base64'))
    return { ok: true, path: res.filePath }
  })
}
