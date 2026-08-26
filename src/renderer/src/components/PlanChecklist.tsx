// PlanChecklist — per-run checklist that sticks to the top of the chat
// scroll viewport WHILE the originating run is active, then unsticks
// once the run completes so it flows naturally with chat history.
//
// Visibility decisions (whether to render at all) live in the parent
// (`AssistantMessage` in DesignChatRail) so this component never has to
// early-return before its hooks. The parent passes a non-null `plan`
// only when it wants the checklist rendered.

import { useEffect, useState } from 'react'
import type { PlanState, PlanStep, PlanStepStatus } from '../lib/planParser'
import { IconCheck } from './icons'

export function PlanChecklist({
  plan,
  active
}: {
  plan: PlanState
  /** True only while the assistant run that owns this plan is still streaming. */
  active: boolean
}): JSX.Element {
  const { steps } = plan
  const total = steps.length
  const doneCount = steps.filter((s) => s.status === 'done').length
  const inProgress = steps.find((s) => s.status === 'in_progress')
  const needsInput = steps.find((s) => s.status === 'needs_input')
  const allDone = doneCount === total && total > 0

  // Collapsible. Default: open while active, closed otherwise.
  const [open, setOpen] = useState(active)
  useEffect(() => {
    // Auto-collapse when the run completes so the user can scroll past
    // it like any other chat message.
    if (!active) setOpen(false)
  }, [active])

  const headerLabel = needsInput
    ? 'Needs your input'
    : active && inProgress
      ? inProgress.title
      : !active && allDone
        ? 'Plan complete'
        : !active
          ? 'Plan'
          : 'Plan'

  // Sticky only while the owning run is active. Once the message that
  // produced the plan is `done`, drop sticky positioning so the plan
  // becomes a normal inline chat-history item the user can scroll past.
  const wrapClass = active
    ? 'sticky top-0 z-10 -mx-4 mb-1 bg-surface/95 px-4 py-1.5 backdrop-blur'
    : 'mb-1'

  return (
    <div className={wrapClass}>
      <div className="rounded-lg bg-elevated/30 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 text-left"
        >
          <span className="flex-shrink-0">
            <PlanHeaderIcon
              active={active}
              inProgress={!!inProgress}
              needsInput={!!needsInput}
              done={!active && allDone}
            />
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-text-secondary">{headerLabel}</span>
          <span className="text-[10.5px] tabular-nums text-text-muted opacity-70">{doneCount}/{total}</span>
          <Chevron open={open} />
        </button>
        {open && (
          <ul className="mt-1.5 flex flex-col gap-1">
            {steps.map((s) => <PlanRow key={s.id} step={s} />)}
          </ul>
        )}
      </div>
    </div>
  )
}

function PlanRow({ step }: { step: PlanStep }): JSX.Element {
  return (
    <li className="flex items-start gap-2 text-[12px]">
      <span className="mt-0.5 flex-shrink-0">
        <StepIcon status={step.status} />
      </span>
      <span className={[
        'min-w-0 flex-1 truncate',
        step.status === 'done' ? 'text-text-muted opacity-70' :
        step.status === 'in_progress' ? 'text-text-primary' :
        step.status === 'needs_input' ? 'text-amber-500' :
        'text-text-secondary'
      ].join(' ')}>
        {step.title}
      </span>
      {step.status === 'needs_input' && step.question && (
        <span className="ml-2 truncate text-[11px] text-text-muted" title={step.question}>
          {step.question}
        </span>
      )}
    </li>
  )
}

function StepIcon({ status }: { status: PlanStepStatus }): JSX.Element {
  if (status === 'done') {
    return (
      <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-accent/15 text-accent">
        <IconCheck size={9} />
      </span>
    )
  }
  if (status === 'in_progress') {
    return <span className="block h-3 w-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
  }
  if (status === 'needs_input') {
    return (
      <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-amber-500/15 text-[9px] font-semibold text-amber-500">
        ?
      </span>
    )
  }
  return <span className="ml-[2px] block h-2.5 w-2.5 rounded-full" />
}

function PlanHeaderIcon({ active, inProgress, needsInput, done }: {
  active: boolean; inProgress: boolean; needsInput: boolean; done: boolean
}): JSX.Element {
  if (needsInput) {
    return <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-amber-500/15 text-[9px] font-semibold text-amber-500">?</span>
  }
  if (done) {
    return <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-accent/15 text-accent"><IconCheck size={9} /></span>
  }
  if (active || inProgress) {
    return <span className="block h-3 w-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
  }
  return <span className="ml-[2px] block h-2.5 w-2.5 rounded-full" />
}

function Chevron({ open }: { open: boolean }): JSX.Element {
  return (
    <svg
      width="9" height="9" viewBox="0 0 10 10"
      className={['shrink-0 text-text-muted transition-transform', open ? 'rotate-90' : ''].join(' ')}
    >
      <path d="M3 1.5 L7 5 L3 8.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
