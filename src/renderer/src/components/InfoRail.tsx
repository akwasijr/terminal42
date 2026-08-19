import type { ContextUsage } from '../../../preload/index'
import type { SessionInsights, TodoInsight } from '../../../shared/sessionInsights'
import { HILL_GATE } from '../../../shared/sessionInsights'
import { contextDisplay } from '../../../shared/contextUsage'

export interface InfoRailProps {
  insights: SessionInsights
  contextUsage?: ContextUsage | null
  collapsed?: boolean
  hidden?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  className?: string
}

export function InfoRail({
  insights,
  contextUsage = null,
  collapsed = false,
  hidden = false,
  onCollapsedChange,
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
    'flex shrink-0 flex-col overflow-hidden rounded-panel bg-surface text-[12px] text-text-secondary shadow-panel',
    collapsed ? 'w-14 p-2' : 'w-[300px] p-3',
    className
  ]
    .filter(Boolean)
    .join(' ')

  if (collapsed) {
    return (
      <aside className={rootClassName} aria-label="Session insights">
        <button
          type="button"
          onClick={() => onCollapsedChange?.(false)}
          disabled={!onCollapsedChange}
          aria-label="Expand session insights"
          title="Expand session insights"
          className="grid h-10 w-10 place-items-center rounded-md bg-elevated text-text-primary transition-colors hover:bg-raised focus-visible:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:bg-sunken disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-elevated"
        >
          <span aria-hidden="true" className="h-5 w-2 rounded-full bg-accent" />
        </button>
        <p
          className="mt-3 text-center text-[11px] tabular-nums text-text-muted"
          title={`${insights.counts.done} of ${insights.counts.total} todos done`}
        >
          {insights.counts.done}/{insights.counts.total}
        </p>
      </aside>
    )
  }

  return (
    <aside className={rootClassName} aria-label="Session insights">
      <header className="flex items-start justify-between gap-3 p-1">
        <section aria-labelledby="session-insights-title" className="min-w-0">
          <h2 id="session-insights-title" className="text-[13px] font-semibold text-text-primary">
            Session insights
          </h2>
        </section>
        <button
          type="button"
          onClick={() => onCollapsedChange?.(true)}
          disabled={!onCollapsedChange}
          aria-label="Collapse session insights"
          title="Collapse session insights"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-elevated text-text-muted transition-colors hover:bg-raised hover:text-text-primary focus-visible:bg-raised focus-visible:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:bg-sunken disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-elevated disabled:hover:text-text-muted"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M10.5 3.5 6 8l4.5 4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
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
          title="Todo progress"
          value={`${insights.counts.done}/${insights.counts.total}`}
          titleText={`${insights.counts.done} done, ${insights.counts.in_progress} in progress, ${insights.counts.pending} pending, ${insights.counts.blocked} blocked`}
        />
        <span
          role="meter"
          aria-label="Todo completion"
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
            label="Pending"
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
          <CountItem label="Pending" value={insights.counts.pending} tone="bg-text-muted" />
          <CountItem label="Blocked" value={insights.counts.blocked} tone="bg-error" />
        </ul>
      </section>

      <section aria-labelledby="hill-score-title" className="mt-3 rounded-lg bg-sunken p-3">
        <MetricHeader
          id="hill-score-title"
          title="Hill score"
          value={insights.hillMedian === null ? 'Unknown' : `${insights.hillMedian}/100`}
          titleText={`${insights.scoredCount} of ${insights.counts.total} goals scorable; ${insights.weakCount} below ${HILL_GATE}`}
        />
        <p className="mt-2 text-[11px] text-text-muted">
          {insights.scoredCount} of {insights.counts.total} goals scorable
          {insights.weakCount > 0 ? `; ${insights.weakCount} weak` : ''}
        </p>
      </section>

      <section aria-labelledby="todo-list-title" className="mt-3 min-h-0 rounded-lg bg-sunken p-3">
        <h3 id="todo-list-title" className="text-[12px] font-semibold text-text-primary">
          Goals
        </h3>
        {insights.todos.length > 0 ? (
          <ul className="mt-3 flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-1">
            {insights.todos.map((todo) => (
              <TodoItem key={todo.id} todo={todo} />
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-md bg-elevated p-3 text-[11px] text-text-muted">
            No todos have been reported for this session.
          </p>
        )}
      </section>
        </>
      ) : (
        <p className="mt-3 rounded-lg bg-sunken p-3 text-[11px] text-text-muted">
          No goals reported yet.
        </p>
      )}

      <section aria-labelledby="auto-continue-title" className="mt-3 rounded-lg bg-sunken p-3">
        <MetricHeader
          id="auto-continue-title"
          title="Auto-continue"
          value={insights.autoContinue.enabled ? 'Enabled' : 'Disabled'}
          titleText={insights.autoContinue.lastReason ?? 'No decline reason reported'}
        />
        <p className="mt-2 text-[11px] text-text-muted">
          {insights.autoContinue.pokes} {insights.autoContinue.pokes === 1 ? 'poke' : 'pokes'}
        </p>
        {insights.autoContinue.lastReason ? (
          <p
            className="mt-3 rounded-md bg-elevated p-3 text-[11px] text-text-secondary"
            title={insights.autoContinue.lastReason}
          >
            {insights.autoContinue.lastReason}
          </p>
        ) : (
          <p className="mt-3 rounded-md bg-elevated p-3 text-[11px] text-text-muted">
            No decline reason reported.
          </p>
        )}
      </section>
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
            aria-label={`Hill score for ${todo.text}`}
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
      label: 'Unknown',
      title: 'Too short to judge honestly',
      className: 'bg-sunken text-text-muted',
      dotClassName: 'bg-text-muted',
      barClassName: 'bg-text-muted'
    }
  }
  if (todo.weak) {
    return {
      label: `Weak ${todo.hill}/100`,
      title: `Scored below the ${HILL_GATE} hill gate`,
      className: 'bg-warning/15 text-warning',
      dotClassName: 'bg-warning',
      barClassName: 'bg-warning'
    }
  }
  return {
    label: `${todo.hill}/100`,
    title: 'Scorable goal',
    className: 'bg-success/15 text-success',
    dotClassName: 'bg-success',
    barClassName: 'bg-success'
  }
}

function statusLabel(status: TodoInsight['status']): string {
  if (status === 'in_progress') return 'In progress'
  if (status === 'done') return 'Done'
  if (status === 'blocked') return 'Blocked'
  return 'Pending'
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
