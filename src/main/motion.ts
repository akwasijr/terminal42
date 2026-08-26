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

export type MotionBentoRecord = {
  id: string
  name: string
  images: Array<{ id: string; src: string; name: string }>
  createdAt: number
}

type BentoRow = { id: string; name: string; images: string; created_at: number }

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

export function listMotionBentos(): MotionBentoRecord[] {
  const rows = getDb().prepare('SELECT * FROM motion_bentos ORDER BY created_at DESC').all() as BentoRow[]
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    images: (parse(r.images) as MotionBentoRecord['images']) ?? [],
    createdAt: r.created_at
  }))
}

export function saveMotionBento(name: string, images: MotionBentoRecord['images']): MotionBentoRecord {
  const id = randomUUID()
  const now = Date.now()
  getDb()
    .prepare('INSERT INTO motion_bentos (id, name, images, created_at) VALUES (?, ?, ?, ?)')
    .run(id, name, JSON.stringify(images ?? []), now)
  return { id, name, images, createdAt: now }
}

export function deleteMotionBento(id: string): boolean {
  return getDb().prepare('DELETE FROM motion_bentos WHERE id = ?').run(id).changes > 0
}

export type BrandSetRecord = {
  id: string
  kind: string
  name: string
  items: string[]
  createdAt: number
  updatedAt: number
}

type BrandRow = {
  id: string; kind: string; name: string; items: string
  created_at: number; updated_at: number
}

export function listBrandSets(kind?: string): BrandSetRecord[] {
  const db = getDb()
  const rows = (kind
    ? db.prepare('SELECT * FROM motion_brand_sets WHERE kind = ? ORDER BY created_at').all(kind)
    : db.prepare('SELECT * FROM motion_brand_sets ORDER BY kind, created_at').all()) as BrandRow[]
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    items: (parse(r.items) as string[]) ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }))
}

/**
 * Write a set, creating it if the id is new.
 *
 * One call for both, because the panel edits a set in place: renaming it and
 * adding a colour to it are the same gesture from the user's side, and a
 * separate create path would only exist to be forgotten on one of them.
 */
export function saveBrandSet(args: {
  id?: string; kind: string; name: string; items: string[]
}): BrandSetRecord {
  const now = Date.now()
  const id = args.id ?? randomUUID()
  const items = JSON.stringify(args.items ?? [])
  getDb().prepare(`
    INSERT INTO motion_brand_sets (id, kind, name, items, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, items = excluded.items, updated_at = excluded.updated_at
  `).run(id, args.kind, args.name, items, now, now)
  return { id, kind: args.kind, name: args.name, items: args.items ?? [], createdAt: now, updatedAt: now }
}

export function deleteBrandSet(id: string): boolean {
  return getDb().prepare('DELETE FROM motion_brand_sets WHERE id = ?').run(id).changes > 0
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

/**
 * Write an image the renderer generated into the same folder imports live in.
 *
 * The starter pictures are drawn in the renderer rather than shipped as files,
 * but they must not be carried in the document as base64: a document is
 * rewritten on every slider drag, and a dozen inline pictures would make every
 * one of those writes megabytes long.
 */
async function storeImageData(name: string, base64: string): Promise<{ id: string; name: string; path: string; dataUrl: string }> {
  const id = randomUUID()
  await fs.mkdir(imagesRoot(), { recursive: true })
  const dest = join(imagesRoot(), `${id}.png`)
  const bytes = Buffer.from(base64, 'base64')
  await fs.writeFile(dest, bytes)
  return { id, name, path: dest, dataUrl: `data:image/png;base64,${base64}` }
}

export function registerMotionIpc(getWin: () => BrowserWindow | null): void {
  ipcMain.handle('motion:brandSets', (_e, kind?: string) => listBrandSets(kind))
  ipcMain.handle('motion:saveBrandSet', (_e, args: { id?: string; kind: string; name: string; items: string[] }) =>
    saveBrandSet(args))
  ipcMain.handle('motion:deleteBrandSet', (_e, id: string) => deleteBrandSet(id))
  ipcMain.handle('motion:bentos', () => listMotionBentos())
  ipcMain.handle('motion:saveBento', (_e, args: { name: string; images: MotionBentoRecord['images'] }) =>
    saveMotionBento(args.name, args.images))
  ipcMain.handle('motion:deleteBento', (_e, id: string) => deleteMotionBento(id))
  ipcMain.handle('motion:storeImage', async (_e, args: { name: string; base64: string }) => {
    try {
      return { ok: true as const, image: await storeImageData(args.name, args.base64) }
    } catch {
      return { ok: false as const }
    }
  })
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
