import { ipcMain } from 'electron'
import { readTasksFor, type Task } from './tasks'
import { getSettings } from './settings'
import { getAutoPokeStatus } from './autoPoke'
import { summarizeInsights, EMPTY_INSIGHTS, type SessionInsights } from '../shared/sessionInsights'

// Assembles everything the session rail displays.
//
// The rail exists because the harness features are otherwise invisible:
// auto-continue declining to act, memory being recalled, and a goal having
// nothing measurable in it all look identical to nothing happening at all.
// Gathering them here also means the UI never has to know which subsystem a
// number came from.
//
// Named sessionInsights rather than insights because src/main/insights.ts is
// an unrelated scheduled-digest feature.

// How many memories the last message actually pulled in. Held here rather
// than in chat.ts so the producer only reports a number, and the rail has a
// single place to read it from.
const memoryUse = new Map<string, number>()

/** Recorded on every turn, including turns that recalled nothing. */
export function recordMemoryUse(sessionKey: string, count: number): void {
  memoryUse.set(sessionKey, count)
}

export function forgetMemoryUse(sessionKey: string): void {
  memoryUse.delete(sessionKey)
}

export async function collectSessionInsights(
  copilotSessionId: string | null,
  terminalSessionId?: string | null
): Promise<SessionInsights> {
  if (!copilotSessionId) return EMPTY_INSIGHTS

  // A missing or half-written session.db is normal while the CLI starts up,
  // and has to degrade to an empty rail rather than an error.
  let tasks: Task[] = []
  try {
    tasks = await readTasksFor(copilotSessionId)
  } catch {
    tasks = []
  }

  const poke = terminalSessionId
    ? getAutoPokeStatus(terminalSessionId)
    : { pokes: 0, lastReason: null }

  return summarizeInsights({
    tasks,
    memories: memoryUse.get(copilotSessionId) ?? 0,
    autoContinue: {
      enabled: getSettings().autoContinueEnabled === true,
      pokes: poke.pokes,
      lastReason: poke.lastReason
    }
  })
}

export function registerSessionInsightsIpc(): void {
  ipcMain.handle(
    'sessionInsights:get',
    async (_e, copilotSessionId: string | null, terminalSessionId?: string | null) =>
      collectSessionInsights(copilotSessionId, terminalSessionId)
  )
}
