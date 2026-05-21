import { ipcMain } from 'electron'
import { getDb } from './db'

export type ComposerEntry = { id: number; body: string; created_at: number }

export function registerComposerIpc(): void {
  ipcMain.handle('composer:save-draft', (_e, args: { sessionId: string; body: string }) => {
    getDb()
      .prepare(
        `INSERT INTO composer_drafts (session_id, body, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`
      )
      .run(args.sessionId, args.body, Date.now())
    return { ok: true }
  })

  ipcMain.handle('composer:get-draft', (_e, sessionId: string) => {
    const row = getDb()
      .prepare('SELECT body FROM composer_drafts WHERE session_id = ?')
      .get(sessionId) as { body: string } | undefined
    return row?.body ?? ''
  })

  ipcMain.handle('composer:push-history', (_e, args: { sessionId: string; body: string }) => {
    if (!args.body.trim()) return { ok: false }
    getDb()
      .prepare('INSERT INTO composer_history (session_id, body, created_at) VALUES (?, ?, ?)')
      .run(args.sessionId, args.body, Date.now())
    // keep last 200 per session
    getDb()
      .prepare(
        `DELETE FROM composer_history
         WHERE session_id = ?
           AND id NOT IN (SELECT id FROM composer_history WHERE session_id = ? ORDER BY id DESC LIMIT 200)`
      )
      .run(args.sessionId, args.sessionId)
    return { ok: true }
  })

  ipcMain.handle('composer:history', (_e, sessionId: string) => {
    return getDb()
      .prepare(
        'SELECT id, body, created_at FROM composer_history WHERE session_id = ? ORDER BY id DESC LIMIT 100'
      )
      .all(sessionId) as ComposerEntry[]
  })
}
