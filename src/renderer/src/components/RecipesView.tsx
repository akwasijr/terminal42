import { useEffect, useMemo, useState } from 'react'
import type { Recipe, RecipeSchedule } from '../../../preload/index'
import { IconPlay, IconRefresh, IconClock, IconTrash, IconClose } from './icons'

function formatNext(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const same = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (same) return `today ${time}`
  const tmrw = new Date(now); tmrw.setDate(now.getDate() + 1)
  if (d.toDateString() === tmrw.toDateString()) return `tomorrow ${time}`
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`
}

function describeSchedule(s: RecipeSchedule): string {
  const time = `${String(s.hour ?? 0).padStart(2, '0')}:${String(s.minute ?? 0).padStart(2, '0')}`
  if (s.kind === 'daily') return `Daily at ${time}`
  if (s.kind === 'weekdays') return `Weekdays at ${time}`
  return `Every ${s.interval_minutes ?? 60} min`
}

export function RecipesView() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [schedules, setSchedules] = useState<RecipeSchedule[]>([])
  const [running, setRunning] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const [editing, setEditing] = useState<Recipe | null>(null)

  const refresh = async () => {
    setRecipes(await window.terminal42.recipes.list())
    setSchedules(await window.terminal42.recipes.schedules.list())
  }

  useEffect(() => { void refresh() }, [])

  const schedulesByRecipe = useMemo(() => {
    const m: Record<string, RecipeSchedule[]> = {}
    for (const s of schedules) (m[s.recipe_id] ||= []).push(s)
    return m
  }, [schedules])

  const run = async (id: string) => {
    setRunning(id); setLastResult(null)
    const r = await window.terminal42.recipes.run(id)
    setRunning(null)
    if (r.ok) {
      setLastResult('Recipe finished. Result is in your Inbox.')
      void window.terminal42.notify.show('Recipe finished', 'See result in Inbox.')
    } else {
      setLastResult(r.error || 'Recipe failed.')
    }
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header className="flex h-[60px] shrink-0 items-center justify-between gap-4 px-6">
        <h1 className="text-[18px] font-semibold leading-tight text-text-primary">Recipes</h1>
        <button
          type="button"
          onClick={() => void refresh()}
          className="grid h-7 w-7 place-items-center rounded-sm text-text-secondary hover:text-text-primary"
          aria-label="Refresh"
          title="Refresh"
        >
          <IconRefresh size={13} />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto w-full max-w-[840px]">

        {lastResult && (
          <div className="mb-3 rounded-md bg-surface px-3 py-2 text-[12px] text-text-secondary">
            {lastResult}
          </div>
        )}

        {recipes.length === 0 ? (
          <div className="rounded-md border p-6 text-center text-[13px] text-text-muted">
            No recipes yet. Add one in Skills → Recipes: pick the markdown template there.
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {recipes.map((r) => {
              const sched = schedulesByRecipe[r.id] || []
              return (
                <li key={r.id} className="rounded-md bg-surface p-3 text-[12px]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-text-primary">{r.name}</div>
                      <div className="mt-0.5 text-[11px] text-text-muted">
                        {r.steps.length} step{r.steps.length === 1 ? '' : 's'}{r.model ? ` · ${r.model}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        className="grid h-7 w-7 place-items-center rounded-md text-text-secondary hover:bg-elevated"
                        aria-label="Schedule"
                        title="Schedule"
                      >
                        <IconClock size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void run(r.id)}
                        disabled={!!running}
                        className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-accent-text disabled:opacity-50"
                      >
                        <IconPlay size={11} /> {running === r.id ? 'Running…' : 'Run'}
                      </button>
                    </div>
                  </div>
                  <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-text-secondary">
                    {r.steps.slice(0, 3).map((s, i) => (
                      <li key={i} className="truncate">{s.prompt}</li>
                    ))}
                    {r.steps.length > 3 && <li className="text-text-muted">…and {r.steps.length - 3} more</li>}
                  </ol>
                  {sched.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pt-2">
                      {sched.map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1 rounded-md bg-bg px-1.5 py-0.5 text-[11px] text-text-secondary"
                        >
                          <IconClock size={10} />
                          {describeSchedule(s)}
                          <span className="text-text-muted">· next {formatNext(s.next_run_at)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

        </div>

      {editing && (
        <ScheduleDialog
          recipe={editing}
          existing={schedulesByRecipe[editing.id] || []}
          onClose={() => setEditing(null)}
          onChanged={() => void refresh()}
        />
      )}
    </main>
  )
}

function ScheduleDialog({
  recipe,
  existing,
  onClose,
  onChanged
}: {
  recipe: Recipe
  existing: RecipeSchedule[]
  onClose: () => void
  onChanged: () => void
}) {
  const [kind, setKind] = useState<'daily' | 'weekdays' | 'interval'>('daily')
  const [hour, setHour] = useState(9)
  const [minute, setMinute] = useState(0)
  const [intervalMinutes, setIntervalMinutes] = useState(60)
  const [busy, setBusy] = useState(false)

  const add = async () => {
    setBusy(true)
    await window.terminal42.recipes.schedules.upsert({
      recipeId: recipe.id,
      kind,
      hour: kind === 'interval' ? null : hour,
      minute: kind === 'interval' ? null : minute,
      intervalMinutes: kind === 'interval' ? intervalMinutes : null,
      enabled: true
    })
    setBusy(false)
    onChanged()
  }

  const remove = async (id: string) => {
    await window.terminal42.recipes.schedules.remove(id)
    onChanged()
  }

  const toggle = async (id: string, enabled: boolean) => {
    await window.terminal42.recipes.schedules.toggle(id, enabled)
    onChanged()
  }

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      <div className="w-[420px] rounded-md bg-surface p-4 shadow-md">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="text-[13px] font-semibold text-text-primary">Schedule</div>
            <div className="text-[12px] text-text-secondary">{recipe.name}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded-md text-text-secondary hover:bg-elevated"
            aria-label="Close"
          >
            <IconClose size={11} />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-1 rounded-md bg-bg p-1 text-[12px]">
          {(['daily', 'weekdays', 'interval'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={
                'rounded-sm px-2 py-1 capitalize ' +
                (kind === k ? 'bg-surface text-text-primary' : 'text-text-secondary hover:text-text-primary')
              }
            >
              {k}
            </button>
          ))}
        </div>

        {kind !== 'interval' ? (
          <div className="mb-3 flex items-center gap-2 text-[12px]">
            <label className="text-text-secondary">Time</label>
            <select
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="rounded-md bg-bg px-2 py-1 text-text-primary"
            >
              {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
              ))}
            </select>
            <span className="text-text-muted">:</span>
            <select
              value={minute}
              onChange={(e) => setMinute(Number(e.target.value))}
              className="rounded-md bg-bg px-2 py-1 text-text-primary"
            >
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mb-3 flex items-center gap-2 text-[12px]">
            <label className="text-text-secondary">Every</label>
            <input
              type="number"
              min={1}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 rounded-md bg-bg px-2 py-1 text-text-primary"
            />
            <span className="text-text-secondary">minutes</span>
          </div>
        )}

        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => void add()}
            disabled={busy}
            className="rounded-md bg-accent px-3 py-1 text-[12px] font-medium text-accent-text disabled:opacity-50"
          >
            Add schedule
          </button>
        </div>

        {existing.length > 0 && (
          <div className="pt-3">
            <div className="mb-1.5 text-[11px] text-text-muted">Active</div>
            <ul className="space-y-1.5">
              {existing.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-md bg-bg px-2 py-1.5 text-[12px]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-text-primary">{describeSchedule(s)}</div>
                    <div className="text-[11px] text-text-muted">Next: {formatNext(s.next_run_at)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[11px] text-text-secondary">
                      <input
                        type="checkbox"
                        checked={s.enabled === 1}
                        onChange={(e) => void toggle(s.id, e.target.checked)}
                      />
                      On
                    </label>
                    <button
                      type="button"
                      onClick={() => void remove(s.id)}
                      className="grid h-6 w-6 place-items-center rounded-md text-text-secondary hover:bg-elevated"
                      aria-label="Remove"
                    >
                      <IconTrash size={11} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
