// What this system says about one component.
//
// The gallery could draw seventy components and say nothing about any of
// them. Only Button had variants, nobody had states, and every argument about
// a component is really an argument about what it looks like when it is
// disabled — so that is the part that was missing.
//
// Nothing here is filled in by default. A component listing all six states on
// the day it is created has documented nothing, and the empty ones are the
// useful signal: they are the conversations the team has not had.

import type { JSX } from 'react'
import { COMPONENT_STATES, VARIANTS_BY_CATEGORY } from '../../lib/dsCatalogues'
import type { DesignSystem, DSComponent } from '../../lib/designSystem'

function Chips({
  options,
  chosen,
  onToggle
}: {
  options: string[]
  chosen: string[]
  onToggle: (v: string) => void
}): JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = chosen.includes(o)
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o)}
            className={`rounded-md px-2.5 py-1 text-[11.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
              on ? 'bg-accent text-black' : 'bg-elevated text-text-muted hover:text-text-primary'
            }`}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

function Field({
  label,
  hint,
  value,
  onChange,
  mono
}: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  mono?: boolean
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] text-text-primary">{label}</span>
      <span className="text-[11.5px] text-text-muted">{hint}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={mono ? 4 : 2}
        className={`w-full resize-y rounded-md bg-elevated px-3 py-2 text-[12.5px] leading-relaxed text-text-primary focus:outline-none focus:ring-1 focus:ring-accent ${mono ? 'font-mono text-[11.5px]' : ''}`}
      />
    </label>
  )
}

export function ComponentRules({
  system,
  update,
  name,
  category
}: {
  system: DesignSystem
  update: (patch: Partial<DesignSystem>) => void
  name: string
  category: string
}): JSX.Element {
  const all = system.components ?? []
  const mine: DSComponent = all.find((c) => c.id === name) ?? { id: name, variants: [], states: [] }

  const write = (next: DSComponent): void => {
    const rest = all.filter((c) => c.id !== name)
    const empty =
      next.variants.length === 0 &&
      next.states.length === 0 &&
      !next.usage?.trim() &&
      !next.accessibility?.trim() &&
      !next.code?.trim()
    // A record with nothing in it is not a decision; dropping it keeps the
    // count on the overview honest.
    update({ components: empty ? rest : [...rest, next] })
  }

  const toggle = (key: 'variants' | 'states', v: string): void => {
    const cur = mine[key]
    write({ ...mine, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] })
  }

  const variantOptions = VARIANTS_BY_CATEGORY[category] ?? VARIANTS_BY_CATEGORY.Visual

  return (
    <section className="mt-8 flex flex-col gap-4 rounded-xl bg-surface p-5">
      <div>
        <h3 className="text-[14px] font-semibold text-text-primary">What we say about it</h3>
        <p className="mt-1 text-[11.5px] text-text-muted">
          The gallery shows what it looks like. This is what your team has agreed about it.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[12.5px] text-text-primary">Variants</span>
        <span className="text-[11.5px] text-text-muted">Which of these exist here.</span>
        <Chips options={variantOptions} chosen={mine.variants} onToggle={(v) => toggle('variants', v)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[12.5px] text-text-primary">States</span>
        <span className="text-[11.5px] text-text-muted">The ones you have drawn. The gaps are the arguments you have not had.</span>
        <Chips options={COMPONENT_STATES} chosen={mine.states} onToggle={(v) => toggle('states', v)} />
      </div>

      <Field
        label="When to use it"
        hint="And what people reach for instead."
        value={mine.usage ?? ''}
        onChange={(v) => write({ ...mine, usage: v })}
      />
      <Field
        label="Accessibility"
        hint="What it must do for a keyboard and a screen reader."
        value={mine.accessibility ?? ''}
        onChange={(v) => write({ ...mine, accessibility: v })}
      />
      <Field
        label="Code"
        hint="One example, the way you actually write it."
        value={mine.code ?? ''}
        onChange={(v) => write({ ...mine, code: v })}
        mono
      />
    </section>
  )
}
