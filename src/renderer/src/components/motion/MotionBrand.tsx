// The brand panel: sets of colours and typefaces, kept across pieces.
//
// Laid out as one row of round swatches per set rather than a list of hex
// values, because a palette is judged by looking at it. The set selector,
// its name and the swatches are the whole of it; anything else would be a
// second place to edit a colour, and there is already a picker.

import { useState } from 'react'
import { FONTS } from '../../lib/freeformTypes'
import { useBrandLibrary, type BrandKind, type BrandLibrary } from '../../lib/motion/brand'
import { useColorPicker } from './pickerContext'
import { Section } from './controls'

export function BrandSection(): React.JSX.Element {
  return (
    <Section title="Brand" defaultOpen={false}>
      <ColourSets />
      <FontSets />
    </Section>
  )
}

function SetChooser({ lib, kind }: { lib: BrandLibrary; kind: BrandKind }): React.JSX.Element {
  const [renaming, setRenaming] = useState(false)
  const label = kind === 'colours' ? 'colour set' : 'font set'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <select
          value={lib.activeId}
          aria-label={`Active ${label}`}
          onChange={(e) => lib.choose(e.target.value)}
          className="min-w-0 flex-1 rounded-sm bg-sunken px-1.5 py-1 text-[11.5px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {lib.sets.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void lib.create(`${lib.active.name} copy`)}
          className="rounded-sm bg-raised px-2 py-1 text-[11px] text-text-primary hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          New
        </button>
        <button
          type="button"
          onClick={() => void lib.remove()}
          disabled={lib.readOnly}
          title={lib.readOnly ? 'The system set cannot be deleted' : `Delete this ${label}`}
          className="rounded-sm px-2 py-1 text-[11px] text-text-muted enabled:hover:bg-raised enabled:hover:text-error disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Delete
        </button>
      </div>
      {!lib.readOnly ? (
        <input
          value={lib.active.name}
          aria-label={`Name of this ${label}`}
          onChange={(e) => void lib.update({ name: e.target.value })}
          onFocus={() => setRenaming(true)}
          onBlur={() => setRenaming(false)}
          className={`rounded-sm bg-sunken px-1.5 py-1 text-[11.5px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
            renaming ? 'ring-1 ring-accent/40' : ''
          }`}
        />
      ) : null}
    </div>
  )
}

function ColourSets(): React.JSX.Element {
  const lib = useBrandLibrary('colours')
  const openPicker = useColorPicker()

  const ask = (el: HTMLElement, value: string, apply: (hex: string) => void): void => {
    const r = el.getBoundingClientRect()
    openPicker?.({
      value,
      opacity: 1,
      showAlpha: false,
      anchor: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
      onChange: (hex) => apply(hex)
    })
  }

  const add = (el: HTMLElement): void =>
    ask(el, '#8899aa', (v) => void lib.update({ items: [...lib.active.items, v] }))

  const edit = (el: HTMLElement, i: number): void =>
    ask(el, lib.active.items[i], (v) =>
      void lib.update({ items: lib.active.items.map((c, j) => (j === i ? v : c)) }))

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-text-secondary">Colours</p>
      <SetChooser lib={lib} kind="colours" />
      <div className="flex flex-wrap items-center gap-1.5">
        {lib.active.items.map((colour, i) => (
          <button
            key={`${colour}-${i}`}
            type="button"
            aria-label={`Colour ${i + 1}, ${colour}`}
            title={lib.readOnly ? colour : `${colour} — click to change, right-click to remove`}
            disabled={lib.readOnly}
            onClick={(e) => edit(e.currentTarget, i)}
            onContextMenu={(e) => {
              e.preventDefault()
              if (!lib.readOnly) void lib.update({ items: lib.active.items.filter((_, j) => j !== i) })
            }}
            className="h-6 w-6 rounded-full ring-1 ring-inset ring-white/10 transition-transform enabled:hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            style={{ backgroundColor: colour }}
          />
        ))}
        {!lib.readOnly ? (
          <button
            type="button"
            aria-label="Add a colour"
            title="Add a colour"
            onClick={(e) => add(e.currentTarget)}
            className="h-6 w-6 rounded-full border border-dashed border-text-muted/40 text-[13px] leading-none text-text-muted hover:border-accent hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            +
          </button>
        ) : null}
      </div>
      {lib.readOnly ? (
        <p className="text-[10.5px] text-text-muted">
          The system set is always here and cannot be edited. Make a set of your own to add colours.
        </p>
      ) : null}
    </div>
  )
}

function FontSets(): React.JSX.Element {
  const lib = useBrandLibrary('fonts')
  const unused = FONTS.map((f) => f.label).filter((f) => !lib.active.items.includes(f))

  return (
    <div className="flex flex-col gap-2 border-t border-white/5 pt-2">
      <p className="text-[11px] text-text-secondary">Fonts</p>
      <SetChooser lib={lib} kind="fonts" />
      <div className="flex flex-col gap-1">
        {lib.active.items.map((font, i) => (
          <div key={font} className="flex items-center gap-1 rounded-sm bg-sunken px-2 py-1">
            <span className="min-w-0 flex-1 truncate text-[12px] text-text-primary" style={{ fontFamily: font }}>
              {font}
            </span>
            {!lib.readOnly ? (
              <button
                type="button"
                aria-label={`Remove ${font}`}
                onClick={() => void lib.update({ items: lib.active.items.filter((_, j) => j !== i) })}
                className="rounded-sm px-1 text-[11px] text-text-muted hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
        {!lib.readOnly && unused.length > 0 ? (
          <select
            value=""
            aria-label="Add a font to this set"
            onChange={(e) => {
              if (e.target.value) void lib.update({ items: [...lib.active.items, e.target.value] })
            }}
            className="rounded-sm bg-raised px-1.5 py-1 text-[11.5px] text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <option value="">Add a font…</option>
            {unused.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  )
}
