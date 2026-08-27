// Editing one token.
//
// This began as a panel that floated over the grid, anchored to the swatch
// you clicked. It read well until the grid scrolled: the panel then had to
// chase its swatch on every scroll event, and any moment it lagged it was
// pointing confidently at the wrong token, which is worse than not being
// there at all.
//
// So it is docked. It sits in its own column that does not scroll, the
// selection is shown at the top of it, and the machinery that measured a
// moving target is gone.
//
// The important control is not the value, it is the choice between holding a
// value and pointing at one. That sits near the top, because a semantic token
// holding a literal is the single mistake this whole idea exists to prevent.

import { useEffect, useMemo, useRef, useState } from 'react'
import { aliasCandidates, blankValue } from '../../../../shared/tokens/edit'
import { aliasTarget, type Token, type TokenStudio, type TokenValue } from '../../../../shared/tokens/types'

export type TokenEdit = {
  rename: (to: string) => void
  setValue: (v: TokenValue) => void
  setTarget: (target: string | null) => void
  remove: () => void
}

export function TokenInspector({
  studio,
  token,
  setName,
  resolved,
  edit,
  onPickColour,
  onClose
}: {
  studio: TokenStudio
  token: Token
  setName: string
  resolved: TokenValue | null
  edit: TokenEdit
  onPickColour: (hex: string, rect: DOMRect, onChange: (hex: string) => void) => void
  onClose: () => void
}): React.JSX.Element {
  const box = useRef<HTMLDivElement | null>(null)
  const [name, setNameDraft] = useState(token.path)

  useEffect(() => setNameDraft(token.path), [token.path])

  useEffect(() => {
    // No click-away: a docked panel is not in anyone's way, and dismissing it
    // because a click landed elsewhere would close it every time you reached
    // for the next token. Escape is the only way out, which is the one people
    // reach for anyway.
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  const target = aliasTarget(token.value)

  // Cutting a token loose and changing your mind should put it back where it
  // was, not at whatever happens to sort first.
  const lastTarget = useRef<string | null>(target)
  if (target !== null) lastTarget.current = target
  const candidates = useMemo(
    () => aliasCandidates(studio, token.path, token.type),
    [studio, token.path, token.type]
  )

  return (
    <div
      ref={box}
      className="flex h-full min-h-0 w-64 shrink-0 flex-col overflow-y-auto rounded-panel bg-surface p-3"
      role="region"
      aria-label={`Edit ${token.path}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-text-secondary">Selected</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Clear the selection"
          className="rounded-sm px-1.5 text-[12px] leading-none text-text-muted hover:bg-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          ×
        </button>
      </div>
      <input
        value={name}
        onChange={(e) => setNameDraft(e.target.value)}
        onBlur={() => edit.rename(name)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') edit.rename(name)
        }}
        aria-label="Token name"
        className="w-full rounded-sm bg-sunken px-2 py-1 text-[12px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      />
      <p className="mt-1 text-[10.5px] text-text-muted">
        {token.type} in {setName}
      </p>

      <div className="mt-2.5 flex items-center gap-1">
        <Choice on={target === null} onClick={() => edit.setTarget(null)}>
          Holds a value
        </Choice>
        <Choice
          on={target !== null}
          disabled={candidates.length === 0}
          onClick={() => {
            const back = lastTarget.current
            edit.setTarget(back && candidates.includes(back) ? back : (candidates[0] ?? null))
          }}
        >
          Points at
        </Choice>
      </div>

      <div className="mt-2">
        {target !== null ? (
          <select
            value={target}
            onChange={(e) => edit.setTarget(e.target.value)}
            aria-label="Points at"
            className="w-full rounded-sm bg-sunken px-2 py-1.5 text-[11.5px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {candidates.includes(target) ? null : <option value={target}>{target}</option>}
            {candidates.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : (
          <ValueField
            token={token}
            onChange={edit.setValue}
            onPickColour={(hex, rect, cb) => onPickColour(hex, rect, cb)}
          />
        )}
      </div>

      {target !== null && resolved !== null ? (
        <p className="mt-2 truncate text-[10.5px] text-text-muted">
          which is {typeof resolved === 'object' ? 'a compound value' : String(resolved)}
        </p>
      ) : null}

      <button
        type="button"
        onClick={edit.remove}
        className="mt-3 rounded-sm px-1.5 py-1 text-[10.5px] text-text-muted hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        Delete this token
      </button>
    </div>
  )
}

function Choice({
  on,
  disabled,
  onClick,
  children
}: {
  on: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`rounded-md px-2 py-1 text-[11px] transition-colors disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
        on ? 'bg-raised text-text-primary' : 'text-text-muted hover:bg-raised hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  )
}

/** The control that suits the type, rather than one text box for everything. */
function ValueField({
  token,
  onChange,
  onPickColour
}: {
  token: Token
  onChange: (v: TokenValue) => void
  onPickColour: (hex: string, rect: DOMRect, cb: (hex: string) => void) => void
}): React.JSX.Element {
  const v = token.value
  const literal = typeof v === 'object' ? blankValue(token.type) : v

  if (token.type === 'color') {
    const hex = typeof literal === 'string' ? literal : '#000000'
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => onPickColour(hex, e.currentTarget.getBoundingClientRect(), (next) => onChange(next))}
          aria-label="Choose a colour"
          style={{ background: hex }}
          className="h-7 w-7 shrink-0 rounded-full ring-1 ring-inset ring-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        />
        <input
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Colour"
          className="min-w-0 flex-1 rounded-sm bg-sunken px-2 py-1.5 font-mono text-[11.5px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        />
      </div>
    )
  }

  if (token.type === 'fontFamily') {
    return (
      <input
        value={String(literal)}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Font family"
        style={{ fontFamily: String(literal) }}
        className="w-full rounded-sm bg-sunken px-2 py-1.5 text-[12px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      />
    )
  }

  // Three types have a closed set of answers. A free text field there invites
  // a typo that renders as nothing and reads as a broken token.
  const CHOICES: Partial<Record<Token['type'], string[]>> = {
    boolean: ['true', 'false'],
    textCase: ['none', 'uppercase', 'lowercase', 'capitalize'],
    textDecoration: ['none', 'underline', 'line-through', 'overline']
  }
  const choices = CHOICES[token.type]
  if (choices) {
    return (
      <select
        value={String(literal)}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Value"
        className="w-full rounded-sm bg-sunken px-2 py-1.5 text-[12px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {choices.includes(String(literal)) ? null : <option value={String(literal)}>{String(literal)}</option>}
        {choices.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    )
  }

  const numeric = ['dimension', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'number', 'duration', 'opacity']
  if (numeric.includes(token.type)) {
    const step = token.type === 'lineHeight' || token.type === 'opacity' ? 0.05 : 1
    return (
      <input
        type="number"
        step={step}
        value={Number(literal)}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Value"
        className="w-full rounded-sm bg-sunken px-2 py-1.5 text-[12px] tabular-nums text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      />
    )
  }

  if (typeof v === 'object') {
    return (
      <div className="flex flex-col gap-1">
        {Object.entries(v).map(([k, part]) => (
          <label key={k} className="flex items-center gap-2">
            <span className="w-14 shrink-0 truncate text-[10.5px] text-text-muted">{k}</span>
            <input
              value={String(part)}
              onChange={(e) => {
                const raw = e.target.value
                const next = typeof part === 'number' && raw.trim() !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : raw
                onChange({ ...(v as Record<string, string | number>), [k]: next })
              }}
              className="min-w-0 flex-1 rounded-sm bg-sunken px-2 py-1 text-[11px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            />
          </label>
        ))}
      </div>
    )
  }

  return (
    <input
      value={String(literal)}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Value"
      className="w-full rounded-sm bg-sunken px-2 py-1.5 text-[12px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    />
  )
}
