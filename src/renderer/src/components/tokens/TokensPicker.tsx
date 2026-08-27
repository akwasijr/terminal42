/**
 * Choosing a token library, wherever the choice is offered.
 *
 * The point of a shared library is that the same one can be picked from Form,
 * Motion, a design brief and the chat. If each of those grew its own picker
 * they would drift — one would forget themes, one would list libraries that
 * have no colours in them, one would say "Basis" for another six months. So
 * there is one.
 *
 * Visual on purpose. A library is chosen by recognising it, not by reading its
 * name, so every option carries the colours it would actually bring.
 */

import type { JSX } from 'react'
import { useTokenLibraries } from '../../lib/tokens/useTokenLibraries'

/** The colours a library brings, as a strip small enough to sit in a row. */
export function LibraryMark({ colours, className }: { colours: string[]; className?: string }): JSX.Element {
  if (colours.length === 0) {
    return <span className={`block h-4 w-16 rounded bg-sunken ${className ?? ''}`} />
  }
  return (
    <span className={`flex h-4 w-16 shrink-0 overflow-hidden rounded ${className ?? ''}`}>
      {colours.map((c, i) => (
        <span key={`${c}-${i}`} style={{ background: c }} className="flex-1" />
      ))}
    </span>
  )
}

/**
 * Pick a library, and which of its themes.
 *
 * Renders nothing when there are no libraries: an empty picker is an
 * invitation to wonder what is broken.
 */
export function TokensPicker({
  tokensId,
  themeId,
  onChange,
  label = 'Tokens',
  allowNone = true,
  showThemes = true
}: {
  tokensId: string | null
  themeId: string | null
  onChange: (tokensId: string | null, themeId: string | null) => void
  label?: string
  allowNone?: boolean
  /** Off where the consumer takes every theme anyway, as Form does: it turns
   *  each theme into a mode, so asking which one is asking a question that has
   *  no effect. */
  showThemes?: boolean
}): JSX.Element | null {
  const { libraries } = useTokenLibraries()
  if (libraries.length === 0) return null
  const chosen = libraries.find((s) => s.id === tokensId) ?? null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label ? <span className="text-[12.5px] text-text-secondary">{label}</span> : null}
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-elevated/60 pl-2.5 focus-within:ring-1 focus-within:ring-accent/40">
        {chosen ? <LibraryMark colours={chosen.swatches} /> : null}
        <select
          value={tokensId ?? ''}
          aria-label={label || 'Token library'}
          onChange={(e) => {
            const id = e.target.value || null
            const next = libraries.find((s) => s.id === id) ?? null
            onChange(id, next?.themes[0]?.id ?? null)
          }}
          className="min-w-0 flex-1 bg-transparent py-2 pr-2.5 text-[13px] text-text-primary focus:outline-none"
        >
          {allowNone ? <option value="">None</option> : null}
          {libraries.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {showThemes && chosen && chosen.themes.length > 1 ? (
        <div className="flex shrink-0 items-center gap-0.5 rounded-md bg-sunken p-0.5">
          {chosen.themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(chosen.id, t.id)}
              aria-pressed={(themeId ?? chosen.themes[0]?.id) === t.id}
              className={`rounded px-2 py-1 text-[11.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                (themeId ?? chosen.themes[0]?.id) === t.id
                  ? 'bg-bg text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
