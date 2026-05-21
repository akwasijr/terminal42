import { ipcMain } from 'electron'
import { searchLog } from './sessionLog'
import { getDb } from './db'

export function registerSearchIpc(): void {
  ipcMain.handle('search:logs', (_e, args: { query: string }) => {
    if (!args.query.trim()) return []
    return searchLog(args.query, 50)
  })

  ipcMain.handle('search:history', (_e, args: { query: string }) => {
    if (!args.query.trim()) return []
    const q = `%${args.query}%`
    const sessions = getDb()
      .prepare(
        `SELECT id, title, project_id, last_active_at FROM sessions WHERE title LIKE ? ORDER BY last_active_at DESC LIMIT 25`
      )
      .all(q) as { id: string; title: string; project_id: string; last_active_at: number }[]
    const projects = getDb()
      .prepare(
        `SELECT id, name, path FROM projects WHERE name LIKE ? OR path LIKE ? ORDER BY last_opened_at DESC LIMIT 25`
      )
      .all(q, q) as { id: string; name: string; path: string }[]
    return { sessions, projects }
  })
}
