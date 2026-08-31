// The three pages that turn a palette into a design system.
//
// Patterns, layouts and guidelines were absent entirely, which is why a
// design system read as a second token library with a component gallery
// bolted on. Each of these is a list of decisions somebody has to actually
// make; none of them is switched on by default, because a system that claims
// all nine patterns on the day it is created has documented nothing.

import type { JSX, ReactNode } from 'react'
import { GUIDELINE_FIELDS, LAYOUT_CATALOGUE, PATTERN_CATALOGUE } from '../../lib/dsCatalogues'
import { AI_RULES, defaultAiRules, type AiRules } from '../../lib/aiRules'
import type { DesignSystem, DSGuidelines } from '../../lib/designSystem'

function Title({ children }: { children: ReactNode }): JSX.Element {
  return <h2 className="text-[18px] font-semibold text-text-primary">{children}</h2>
}

/** A row that stays off until somebody says their system has this. */
function Adopted({
  on,
  onToggle,
  name,
  hint,
  children
}: {
  on: boolean
  onToggle: () => void
  name: string
  hint: string
  children?: ReactNode
}): JSX.Element {
  return (
    <li className={`rounded-xl transition-colors ${on ? 'bg-surface' : 'bg-surface/40'}`}>
      <button
        type="button"
        aria-pressed={on}
        onClick={onToggle}
        className="flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <span
          aria-hidden="true"
          className={`mt-0.5 grid h-[15px] w-[15px] shrink-0 place-items-center rounded ${on ? 'bg-accent text-black' : 'bg-elevated text-transparent'}`}
        >
          <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.2 3.2L13 5" /></svg>
        </span>
        <span className="min-w-0">
          <span className={`block text-[13px] ${on ? 'text-text-primary' : 'text-text-secondary'}`}>{name}</span>
          <span className="block text-[11.5px] text-text-muted">{hint}</span>
        </span>
      </button>
      {on && children ? <div className="px-4 pb-3 pl-[42px]">{children}</div> : null}
    </li>
  )
}

function Notes({
  value,
  onChange,
  placeholder
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}): JSX.Element {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="w-full resize-y rounded-md bg-elevated px-3 py-2 text-[12.5px] leading-relaxed text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-accent"
    />
  )
}

export function PatternsPage({
  system,
  update
}: {
  system: DesignSystem
  update: (patch: Partial<DesignSystem>) => void
}): JSX.Element {
  const have = system.patterns ?? []

  const toggle = (id: string): void => {
    if (have.some((p) => p.id === id)) {
      update({ patterns: have.filter((p) => p.id !== id) })
      return
    }
    const c = PATTERN_CATALOGUE.find((p) => p.id === id)
    if (c) update({ patterns: [...have, { id: c.id, name: c.name, uses: c.uses }] })
  }

  return (
    <section className="space-y-3">
      <Title>Patterns</Title>
      <p className="max-w-xl text-[12.5px] leading-relaxed text-text-secondary">
        Several components arranged to do one job. Agreed once, so the second sign-up screen matches the first.
      </p>
      <ul className="flex flex-col gap-1.5">
        {PATTERN_CATALOGUE.map((c) => {
          const mine = have.find((p) => p.id === c.id)
          return (
            <Adopted key={c.id} on={!!mine} onToggle={() => toggle(c.id)} name={c.name} hint={c.hint}>
              <div className="flex flex-col gap-2">
                <p className="text-[11.5px] text-text-muted">Built from {c.uses.join(', ')}</p>
                <Notes
                  value={mine?.notes ?? ''}
                  onChange={(v) => update({ patterns: have.map((p) => (p.id === c.id ? { ...p, notes: v } : p)) })}
                  placeholder="How yours works, and what it must never do."
                />
              </div>
            </Adopted>
          )
        })}
      </ul>
    </section>
  )
}

export function LayoutsPage({
  system,
  update
}: {
  system: DesignSystem
  update: (patch: Partial<DesignSystem>) => void
}): JSX.Element {
  const have = system.layouts ?? []
  const toggle = (id: string): void => {
    if (have.some((l) => l.id === id)) {
      update({ layouts: have.filter((l) => l.id !== id) })
      return
    }
    const c = LAYOUT_CATALOGUE.find((l) => l.id === id)
    if (c) update({ layouts: [...have, { id: c.id, name: c.name }] })
  }

  return (
    <section className="space-y-3">
      <Title>Layouts</Title>
      <p className="max-w-xl text-[12.5px] leading-relaxed text-text-secondary">
        How the page is arranged, above and around anything drawn on it.
      </p>
      <ul className="flex flex-col gap-1.5">
        {LAYOUT_CATALOGUE.map((c) => {
          const mine = have.find((l) => l.id === c.id)
          return (
            <Adopted key={c.id} on={!!mine} onToggle={() => toggle(c.id)} name={c.name} hint={c.hint}>
              <Notes
                value={mine?.notes ?? ''}
                onChange={(v) => update({ layouts: have.map((l) => (l.id === c.id ? { ...l, notes: v } : l)) })}
                placeholder="The rule, in a sentence."
              />
            </Adopted>
          )
        })}
      </ul>
    </section>
  )
}

export function GuidelinesPage({
  system,
  update
}: {
  system: DesignSystem
  update: (patch: Partial<DesignSystem>) => void
}): JSX.Element {
  const g: DSGuidelines = system.guidelines ?? {}
  const set = (patch: Partial<DSGuidelines>): void => update({ guidelines: { ...g, ...patch } })

  // Do and Don't stay as paired lines rather than one block of prose, because
  // the useful half of a guideline is the thing people keep doing instead,
  // and prose buries it.
  const lines = (v?: string[]): string => (v ?? []).join('\n')
  const split = (v: string): string[] => v.split('\n').map((x) => x.trim()).filter(Boolean)

  return (
    <section className="space-y-4">
      <Title>Guidelines</Title>
      <div className="flex flex-col gap-3">
        {GUIDELINE_FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1.5 rounded-xl bg-surface p-4">
            <span className="text-[13px] text-text-primary">{f.label}</span>
            <span className="text-[11.5px] text-text-muted">{f.hint}</span>
            <Notes value={g[f.key] ?? ''} onChange={(v) => set({ [f.key]: v })} placeholder="" />
          </label>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 rounded-xl bg-surface p-4">
            <span className="text-[13px] text-text-primary">Do</span>
            <span className="text-[11.5px] text-text-muted">One per line.</span>
            <Notes value={lines(g.dos)} onChange={(v) => set({ dos: split(v) })} placeholder="" />
          </label>
          <label className="flex flex-col gap-1.5 rounded-xl bg-surface p-4">
            <span className="text-[13px] text-text-primary">Don&rsquo;t</span>
            <span className="text-[11.5px] text-text-muted">The thing people keep doing instead.</span>
            <Notes value={lines(g.donts)} onChange={(v) => set({ donts: split(v) })} placeholder="" />
          </label>
        </div>
        <EnforcedRules rules={system.rules} onChange={(rules) => update({ rules })} />
      </div>
    </section>
  )
}

/**
 * The rules a generator obeys, as opposed to the ones above that a person
 * reads.
 *
 * These were asked for once, in the wizard, and then never shown again: a
 * system carried eight relaxed rules with nothing on any screen saying so,
 * and no way to change its mind afterwards short of building a new system.
 */
function EnforcedRules({
  rules,
  onChange
}: {
  rules?: AiRules
  onChange: (rules: AiRules) => void
}): JSX.Element {
  const current: AiRules = { ...defaultAiRules(), ...(rules ?? {}) }
  const off = AI_RULES.filter((r) => current[r.id] === false)
  return (
    <div className="rounded-xl bg-surface p-4">
      <div className="flex items-baseline gap-2">
        <span className="text-[13px] text-text-primary">Enforced when generating</span>
        <span className="text-[11.5px] text-text-muted">
          {off.length === 0 ? 'All on' : `${off.length} off`}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {AI_RULES.map((r) => {
          const on = current[r.id] !== false
          return (
            <button
              key={r.id}
              type="button"
              aria-pressed={on}
              title={r.hint ?? r.description}
              onClick={() => onChange({ ...current, [r.id]: !on })}
              className={`rounded-md px-2.5 py-1.5 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                on ? 'bg-elevated text-text-primary' : 'bg-elevated/40 text-text-muted hover:text-text-primary'
              }`}
            >
              {r.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
