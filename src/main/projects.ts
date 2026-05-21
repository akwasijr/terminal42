import { ipcMain, dialog, BrowserWindow } from 'electron'
import { basename } from 'path'
import { randomUUID } from 'crypto'
import { getDb, type ProjectRow, type SessionRow } from './db'
import { tailLog } from './sessionLog'

export function registerProjectIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('projects:list', () => {
    return getDb()
      .prepare('SELECT * FROM projects ORDER BY last_opened_at DESC')
      .all() as ProjectRow[]
  })

  ipcMain.handle('projects:add', async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose a project folder'
    })
    if (result.canceled || !result.filePaths[0]) return null
    const path = result.filePaths[0]
    const name = basename(path)
    const now = Date.now()
    const id = randomUUID()
    const db = getDb()
    try {
      db.prepare(
        'INSERT INTO projects (id, name, path, color, created_at, last_opened_at) VALUES (?, ?, ?, NULL, ?, ?)'
      ).run(id, name, path, now, now)
    } catch {
      const existing = db.prepare('SELECT * FROM projects WHERE path = ?').get(path) as ProjectRow | undefined
      if (existing) {
        db.prepare('UPDATE projects SET last_opened_at = ? WHERE id = ?').run(now, existing.id)
        return existing
      }
      throw new Error('Failed to add project')
    }
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow
  })

  ipcMain.handle('projects:touch', (_e, id: string) => {
    getDb().prepare('UPDATE projects SET last_opened_at = ? WHERE id = ?').run(Date.now(), id)
    return { ok: true }
  })

  ipcMain.handle('projects:remove', (_e, id: string) => {
    getDb().prepare('DELETE FROM projects WHERE id = ?').run(id)
    return { ok: true }
  })

  ipcMain.handle('projects:rename', (_e, args: { id: string; name: string }) => {
    getDb().prepare('UPDATE projects SET name = ? WHERE id = ?').run(args.name, args.id)
    return { ok: true }
  })

  ipcMain.handle('projects:set-auto-launch', (_e, args: { id: string; auto: boolean }) => {
    getDb().prepare('UPDATE projects SET auto_launch_copilot = ? WHERE id = ?').run(args.auto ? 1 : 0, args.id)
    return { ok: true }
  })

  ipcMain.handle('sessions:list', (_e, projectId: string | null) => {
    if (projectId === null) {
      return getDb()
        .prepare('SELECT * FROM sessions WHERE project_id IS NULL ORDER BY pinned DESC, last_active_at DESC')
        .all() as SessionRow[]
    }
    return getDb()
      .prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY pinned DESC, last_active_at DESC')
      .all(projectId) as SessionRow[]
  })

  ipcMain.handle('sessions:create', (_e, args: { projectId: string | null; title?: string }) => {
    const id = randomUUID()
    const now = Date.now()
    getDb()
      .prepare(
        'INSERT INTO sessions (id, project_id, title, copilot_session_id, pinned, created_at, last_active_at) VALUES (?, ?, ?, NULL, 0, ?, ?)'
      )
      .run(id, args.projectId, args.title || 'New session', now, now)
    return getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow
  })

  ipcMain.handle('sessions:rename', (_e, args: { id: string; title: string; lock?: boolean }) => {
    if (args.lock) {
      getDb().prepare('UPDATE sessions SET title = ?, title_locked = 1 WHERE id = ?').run(args.title, args.id)
    } else {
      getDb().prepare('UPDATE sessions SET title = ? WHERE id = ?').run(args.title, args.id)
    }
    return { ok: true }
  })

  ipcMain.handle('sessions:auto-title', (_e, args: { id: string; firstInput: string }) => {
    const db = getDb()
    const row = db.prepare('SELECT title, title_locked FROM sessions WHERE id = ?').get(args.id) as
      | { title: string; title_locked: number }
      | undefined
    if (!row || row.title_locked) return { ok: false }
    if (row.title && row.title !== 'New session') return { ok: false }
    let title = args.firstInput.trim()
    // Reject titles that look like terminal escape sequences or other junk
    if (!title) return { ok: false }
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f]/.test(title)) return { ok: false }
    if (/^\]?\d+;/.test(title) || /rgb:[0-9a-fA-F]/.test(title)) return { ok: false }
    if (title.length > 50) title = title.slice(0, 47) + '…'
    db.prepare('UPDATE sessions SET title = ? WHERE id = ?').run(title, args.id)
    return { ok: true, title }
  })

  ipcMain.handle('sessions:link-copilot', (_e, args: { id: string; copilotSessionId: string }) => {
    getDb()
      .prepare('UPDATE sessions SET copilot_session_id = ? WHERE id = ?')
      .run(args.copilotSessionId, args.id)
    return { ok: true }
  })

  ipcMain.handle('sessions:pin', (_e, args: { id: string; pinned: boolean }) => {
    getDb().prepare('UPDATE sessions SET pinned = ? WHERE id = ?').run(args.pinned ? 1 : 0, args.id)
    return { ok: true }
  })

  ipcMain.handle('sessions:remove', (_e, id: string) => {
    getDb().prepare('DELETE FROM sessions WHERE id = ?').run(id)
    return { ok: true }
  })

  ipcMain.handle('sessions:touch', (_e, id: string) => {
    getDb().prepare('UPDATE sessions SET last_active_at = ? WHERE id = ?').run(Date.now(), id)
    return { ok: true }
  })

  ipcMain.handle('sessions:set-model', (_e, args: { id: string; model: string }) => {
    getDb().prepare('UPDATE sessions SET model = ? WHERE id = ?').run(args.model, args.id)
    return { ok: true }
  })

  ipcMain.handle('sessions:get', (_e, id: string) => {
    return getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined
  })

  ipcMain.handle('sessions:tail-log', (_e, args: { id: string; maxBytes?: number }) => {
    return tailLog(args.id, args.maxBytes ?? 200_000)
  })
}
