import { useCallback, useEffect, useState } from 'react'
import type { Project, Session } from '../../../preload/index'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])

  const refresh = useCallback(async () => {
    const list = await window.terminal42.projects.list()
    setProjects(list)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const add = useCallback(async () => {
    const p = await window.terminal42.projects.add()
    if (p) await refresh()
    return p
  }, [refresh])

  const remove = useCallback(
    async (id: string) => {
      await window.terminal42.projects.remove(id)
      await refresh()
    },
    [refresh]
  )

  const touch = useCallback(
    async (id: string) => {
      // Fire-and-forget: persist last_opened_at for next launch but DO NOT
      // re-fetch: re-fetching re-sorts the sidebar by last_opened_at and
      // makes the just-clicked project jump to the top, which is jarring.
      // Display order should stay stable during a session.
      try { await window.terminal42.projects.touch(id) } catch {}
    },
    []
  )

  return { projects, add, remove, touch, refresh }
}

export function useSessions(projectId: string | null) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const list = await window.terminal42.sessions.list(projectId)
    setSessions(list)
    setLoaded(true)
  }, [projectId])

  useEffect(() => {
    setLoaded(false)
    void refresh()
  }, [refresh])

  const create = useCallback(
    async (title?: string) => {
      const s = await window.terminal42.sessions.create(projectId, title)
      await refresh()
      return s
    },
    [projectId, refresh]
  )

  const remove = useCallback(
    async (id: string) => {
      try { await window.terminal42.pty.kill(id) } catch {}
      await window.terminal42.sessions.remove(id)
      await refresh()
    },
    [refresh]
  )

  const rename = useCallback(
    async (id: string, title: string) => {
      await window.terminal42.sessions.rename(id, title)
      await refresh()
    },
    [refresh]
  )

  const pin = useCallback(
    async (id: string, pinned: boolean) => {
      await window.terminal42.sessions.pin(id, pinned)
      await refresh()
    },
    [refresh]
  )

  return { sessions, loaded, create, remove, rename, pin, refresh }
}
