import { analyzeGoalQuality } from './goalQuality'

// What the session rail shows, derived in one place so the main process, the
// renderer and the tests all agree on what a number means.
//
// The important design constraint here is negative. analyzeGoalQuality was
// built for composer-length goals, and it is not merely noisy on short text,
// it is confidently wrong: "Validate schema" scores 100 while a precise
// 101-character goal scores 31. Short todo titles simply do not carry enough
// signal to rate, so this reports null rather than inventing a number. A
// missing score is honest; a wrong score would quietly train someone to
// distrust the whole rail.

/** Below this, a goal has nothing concrete for the agent to iterate against. */
export const HILL_GATE = 72

// Matches the thresholds the composer hint uses, so a goal is never judged
// by one rule in the rail and a different one while being typed.
const MIN_CHARS = 48
const MIN_WORDS = 8

export type InsightTask = {
  id?: string
  text: string
  description?: string | null
  status?: 'pending' | 'in_progress' | 'done' | 'blocked'
  done?: boolean
}

export type TodoInsight = {
  id: string
  text: string
  status: 'pending' | 'in_progress' | 'done' | 'blocked'
  /** 0-100, or null when the text is too thin to judge honestly. */
  hill: number | null
  /** True only when we actually scored it and it fell short. */
  weak: boolean
}

export type SessionInsights = {
  todos: TodoInsight[]
  counts: { pending: number; in_progress: number; done: number; blocked: number; total: number }
  /** Median of the goals we could score; null when none were scorable. */
  hillMedian: number | null
  scoredCount: number
  weakCount: number
  memories: number
  autoContinue: { enabled: boolean; pokes: number; lastReason: string | null }
}

/** Combined text a goal is judged on: a description carries the real detail. */
function judgeableText(task: InsightTask): string {
  return [task.text, task.description ?? ''].join(' ').trim()
}

export function canScoreGoal(text: string): boolean {
  return text.length >= MIN_CHARS && text.trim().split(/\s+/).filter(Boolean).length >= MIN_WORDS
}

/**
 * Rates how much of a metric a goal gives the agent to climb.
 *
 * Returns null when the goal is too short to assess rather than guessing.
 */
export function scoreGoal(text: string): number | null {
  if (!canScoreGoal(text)) return null
  return analyzeGoalQuality(text).score
}

function statusOf(task: InsightTask): TodoInsight['status'] {
  if (task.status) return task.status
  return task.done ? 'done' : 'pending'
}

export function toTodoInsights(tasks: readonly InsightTask[]): TodoInsight[] {
  return tasks.map((task, i) => {
    const hill = scoreGoal(judgeableText(task))
    return {
      id: task.id || `todo-${i}`,
      text: task.text,
      status: statusOf(task),
      hill,
      // An unscored goal is not a weak goal. Only a real score can fail.
      weak: hill !== null && hill < HILL_GATE
    }
  })
}

function median(xs: readonly number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2)
}

export function summarizeInsights(input: {
  tasks: readonly InsightTask[]
  memories?: number
  autoContinue?: { enabled: boolean; pokes: number; lastReason: string | null }
}): SessionInsights {
  const todos = toTodoInsights(input.tasks)
  const counts = { pending: 0, in_progress: 0, done: 0, blocked: 0, total: todos.length }
  for (const t of todos) counts[t.status]++

  const scored = todos.map((t) => t.hill).filter((h): h is number => h !== null)

  return {
    todos,
    counts,
    hillMedian: median(scored),
    scoredCount: scored.length,
    weakCount: todos.filter((t) => t.weak).length,
    memories: input.memories ?? 0,
    autoContinue: input.autoContinue ?? { enabled: false, pokes: 0, lastReason: null }
  }
}

export const EMPTY_INSIGHTS: SessionInsights = {
  todos: [],
  counts: { pending: 0, in_progress: 0, done: 0, blocked: 0, total: 0 },
  hillMedian: null,
  scoredCount: 0,
  weakCount: 0,
  memories: 0,
  autoContinue: { enabled: false, pokes: 0, lastReason: null }
}
