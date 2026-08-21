import type { ContextUsage } from '../../../preload/index'
import type { SessionInsights, TodoInsight } from '../../../shared/sessionInsights'
import { HILL_GATE } from '../../../shared/sessionInsights'
import { contextDisplay } from '../../../shared/contextUsage'

export interface InfoRailProps {
  insights: SessionInsights
  contextUsage?: ContextUsage | null
  hidden?: boolean
  className?: string
}

export function InfoRail({
  insights,
  contextUsage = null,
  hidden = false,
  className = ''
}: InfoRailProps): JSX.Element | null {
  if (hidden) return null

  // One shared rule decides whether a context reading is trustworthy, so this
  // panel and the Status tab never disagree about the same session.
  const ctx = contextDisplay(contextUsage, { hasSession: true })
  // With no goals reported there is nothing to total, score, or list. Three
  // cards each saying "0" or "Unknown" read as broken instrumentation rather
  // than as an empty session, so they collapse to a single line.
  const hasGoals = insights.counts.total > 0

  const rootClassName = [
    'flex min-w-0 flex-col overflow-hidden rounded-panel bg-surface p-3 text-[12px] text-text-secondary shadow-panel',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <aside className={rootClassName} aria-labelledby="session-insights-title">
      <header className="p-1">
        <h2 id="session-insights-title" className="text-[13px] font-semibold text-text-primary">
          What this session is doing
        </h2>
      </header>

      {ctx ? (
        <section aria-labelledby="context-usage-title" className="mt-3 rounded-lg bg-sunken p-3">
          <MetricHeader
            id="context-usage-title"
            title="Context"
            value={`${ctx.percent}%`}
            titleText={`${ctx.usedTokens.toLocaleString()} of ${ctx.limitTokens.toLocaleString()} tokens`}
          />
          <span
            role="meter"
            aria-label="Context window used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={ctx.percent}
            className="mt-3 block h-2 overflow-hidden rounded-full bg-elevated"
          >
            <span
              className={[
                'block h-full rounded-full transition-all',
                ctx.tone === 'critical' ? 'bg-error' : ctx.tone === 'warning' ? 'bg-warning' : 'bg-accent'
              ].join(' ')}
              style={{ width: `${ctx.percent}%` }}
            />
          </span>
          <p className="mt-2 text-[11px] tabular-nums text-text-muted">{ctx.usedOfLimit}</p>
        </section>
      ) : null}

      {hasGoals ? (
        <>
      <section aria-labelledby="todo-progress-title" className="mt-3 rounded-lg bg-sunken p-3">
        <MetricHeader
          id="todo-progress-title"
          title="Plan progress"
          value={`${insights.counts.done} of ${insights.counts.total} done`}
          titleText={`${insights.counts.done} done, ${insights.counts.in_progress} in progress, ${insights.counts.pending} not started, ${insights.counts.blocked} blocked`}
        />
        <span
          role="meter"
          aria-label="Plan progress"
          aria-valuemin={0}
          aria-valuemax={insights.counts.total}
          aria-valuenow={insights.counts.done}
          className="mt-3 flex h-2 overflow-hidden rounded-full bg-elevated"
        >
          <ProgressSegment
            count={insights.counts.done}
            total={insights.counts.total}
            className="bg-success"
            label="Done"
          />
          <ProgressSegment
            count={insights.counts.in_progress}
            total={insights.counts.total}
            className="bg-accent"
            label="In progress"
          />
          <ProgressSegment
            count={insights.counts.pending}
            total={insights.counts.total}
            className="bg-text-muted"
            label="Not started"
          />
          <ProgressSegment
            count={insights.counts.blocked}
            total={insights.counts.total}
            className="bg-error"
            label="Blocked"
          />
        </span>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          <CountItem label="Done" value={insights.counts.done} tone="bg-success" />
          <CountItem label="In progress" value={insights.counts.in_progress} tone="bg-accent" />
          <CountItem label="Not started" value={insights.counts.pending} tone="bg-text-muted" />
          <CountItem label="Blocked" value={insights.counts.blocked} tone="bg-error" />
        </ul>
      </section>

      <section aria-labelledby="hill-score-title" className="mt-3 rounded-lg bg-sunken p-3">
        <MetricHeader
          id="hill-score-title"
          title="How clear the steps are"
          value={
            insights.hillMedian === null
              ? 'Not enough detail to tell'
              : insights.hillMedian >= HILL_GATE
              ? 'Clear'
              : 'Vague'
          }
          titleText={
            insights.hillMedian === null
              ? 'The steps are too short to judge'
              : `Median clarity ${insights.hillMedian} out of 100; ${insights.weakCount} step${insights.weakCount === 1 ? '' : 's'} below ${HILL_GATE}`
          }
        />
        <p className="mt-2 text-[11px] text-text-muted">
          {insights.hillMedian === null
            ? 'Steps this short cannot be judged, so nothing is guessed.'
            : insights.weakCount > 0
            ? `${insights.weakCount} step${insights.weakCount === 1 ? '' : 's'} could use a way to tell when it is finished.`
            : 'Every step says how to tell when it is done.'}
        </p>
      </section>

      <section aria-labelledby="todo-list-title" className="mt-3 min-h-0 rounded-lg bg-sunken p-3">
        <h3 id="todo-list-title" className="text-[12px] font-semibold text-text-primary">
          Steps
        </h3>
        {insights.todos.length > 0 ? (
          <ul className="mt-3 flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-1">
            {insights.todos.map((todo) => (
              <TodoItem key={todo.id} todo={todo} />
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-md bg-elevated p-3 text-[11px] text-text-muted">
            The agent has not listed any steps for this session.
          </p>
        )}
      </section>
        </>
      ) : (
        <p className="mt-3 rounded-lg bg-sunken p-3 text-[11px] text-text-muted">
          No plan yet. When the agent lists the steps it intends to take, they appear here.
        </p>
      )}

      {/* Auto-continue is off by default and most sessions never poke, so the
          card was three lines saying nothing. It appears only once there is
          something to report. */}
      {(insights.autoContinue.enabled || insights.autoContinue.pokes > 0) && (
        <section aria-labelledby="auto-continue-title" className="mt-3 rounded-lg bg-sunken p-3">
          <MetricHeader
            id="auto-continue-title"
            title="Carrying on by itself"
            value={insights.autoContinue.enabled ? 'On' : 'Off'}
            titleText={insights.autoContinue.lastReason ?? 'No reason reported'}
          />
          <p className="mt-2 text-[11px] text-text-muted">
            {insights.autoContinue.pokes === 0
              ? 'It has not needed a nudge.'
              : `Nudged ${insights.autoContinue.pokes} time${insights.autoContinue.pokes === 1 ? '' : 's'} to keep going.`}
          </p>
          {insights.autoContinue.lastReason ? (
            <p
              className="mt-3 rounded-md bg-elevated p-3 text-[11px] text-text-secondary"
              title={insights.autoContinue.lastReason}
            >
              Last time it stopped: {insights.autoContinue.lastReason}
            </p>
          ) : null}
        </section>
      )}

    </aside>
  )
}

function MetricHeader({
  id,
  title,
  value,
  titleText
}: {
  id: string
  title: string
  value: string
  titleText: string
}): JSX.Element {
  return (
    <header className="flex items-baseline justify-between gap-3">
      <h3 id={id} className="text-[12px] font-medium text-text-secondary">
        {title}
      </h3>
      <p
        className="shrink-0 text-[12px] font-semibold tabular-nums text-text-primary"
        title={titleText}
      >
        {value}
      </p>
    </header>
  )
}

function ProgressSegment({
  count,
  total,
  className,
  label
}: {
  count: number
  total: number
  className: string
  label: string
}): JSX.Element | null {
  if (count <= 0 || total <= 0) return null
  return (
    <span
      aria-label={`${label}: ${count}`}
      className={['h-full', className].join(' ')}
      style={{ width: `${(count / total) * 100}%` }}
    />
  )
}

function CountItem({
  label,
  value,
  tone
}: {
  label: string
  value: number
  tone: string
}): JSX.Element {
  return (
    <li className="flex items-center gap-2 rounded-md bg-elevated px-2 py-2">
      <span aria-hidden="true" className={['h-2 w-2 shrink-0 rounded-full', tone].join(' ')} />
      <span className="min-w-0 flex-1 truncate text-[11px] text-text-muted">{label}</span>
      <span className="tabular-nums text-text-primary">{value}</span>
    </li>
  )
}

function TodoItem({ todo }: { todo: TodoInsight }): JSX.Element {
  const hill = hillPresentation(todo)
  return (
    <li className="rounded-md bg-elevated p-3">
      <article className="flex flex-col gap-3">
        <header className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className={['mt-1 h-2 w-2 shrink-0 rounded-full', statusTone(todo.status)].join(' ')}
          />
          <h4 className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-text-primary">
            {todo.text}
          </h4>
        </header>
        <footer className="flex items-center justify-between gap-3">
          <span className="rounded-md bg-sunken px-2 py-1 text-[11px] text-text-secondary">
            {statusLabel(todo.status)}
          </span>
          <span
            className={[
              'inline-flex items-center gap-2 rounded-md px-2 py-1 text-[11px] tabular-nums',
              hill.className
            ].join(' ')}
            title={hill.title}
          >
            <span
              aria-hidden="true"
              className={['h-2 w-2 rounded-full', hill.dotClassName].join(' ')}
            />
            {hill.label}
          </span>
        </footer>
        {todo.hill !== null ? (
          <span
            role="meter"
            aria-label={`How clear this step is: ${todo.text}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={todo.hill}
            className="block h-2 overflow-hidden rounded-full bg-sunken"
          >
            <span
              className={['block h-full rounded-full transition-all', hill.barClassName].join(' ')}
              style={{ width: `${clampPercent(todo.hill)}%` }}
            />
          </span>
        ) : null}
      </article>
    </li>
  )
}

function hillPresentation(todo: TodoInsight): {
  label: string
  title: string
  className: string
  dotClassName: string
  barClassName: string
} {
  if (todo.hill === null) {
    return {
      label: 'Too short to judge',
      title: 'This step is too short to judge honestly, so it is not scored',
      className: 'bg-sunken text-text-muted',
      dotClassName: 'bg-text-muted',
      barClassName: 'bg-text-muted'
    }
  }
  if (todo.weak) {
    return {
      label: 'Needs a finish line',
      title: `Clarity ${todo.hill} out of 100, below the ${HILL_GATE} this app expects: it does not say how to tell when it is done`,
      className: 'bg-warning/15 text-warning',
      dotClassName: 'bg-warning',
      barClassName: 'bg-warning'
    }
  }
  return {
    label: 'Clear',
    title: `Clarity ${todo.hill} out of 100: it says how to tell when it is done`,
    className: 'bg-success/15 text-success',
    dotClassName: 'bg-success',
    barClassName: 'bg-success'
  }
}

function statusLabel(status: TodoInsight['status']): string {
  if (status === 'in_progress') return 'In progress'
  if (status === 'done') return 'Done'
  if (status === 'blocked') return 'Blocked'
  return 'Not started'
}

function statusTone(status: TodoInsight['status']): string {
  if (status === 'in_progress') return 'bg-accent'
  if (status === 'done') return 'bg-success'
  if (status === 'blocked') return 'bg-error'
  return 'bg-text-muted'
}






function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, n))
}
