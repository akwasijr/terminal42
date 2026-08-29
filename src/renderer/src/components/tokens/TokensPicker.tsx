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
 *
 * It reads as an attachment rather than as a setting: nothing but a plus until
 * something is attached, and then the library's own name. A dropdown sitting
 * permanently in a panel says "here is a field you must fill in"; a plus says
 * "you may bring one", which is the truth. The same modal opens from the chat
 * composer, so the choice looks identical wherever it is made.
 */

/** Leave for the Tokens page, optionally with the setup already open. */
function openLibrary(fresh: boolean): void {
  window.dispatchEvent(new Event('t42:open-tokens'))
  if (fresh) {
    requestNewTokens()
    window.dispatchEvent(new Event('t42:tokens-new'))
  }
}

import { useState, type JSX } from 'react'
import { useTokenLibraries } from '../../lib/tokens/useTokenLibraries'
import { TokenGlyph, TokenLibraryDetail, TokenLibraryModal } from './TokenLibraryModal'
import { requestNewTokens } from '../../lib/tokens/openLatch'

/**
 * Pick a library, and which of its themes.
 *
 * Shown even when there are none. The old picker hid itself in that case,
 * which meant somebody with an empty library never learnt that tokens existed
 * at all — the modal's empty state offers to build one instead.
 */
export function TokensPicker({
  tokensId,
  themeId,
  onChange,
  label = '',
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
  const [pickOpen, setPickOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const chosen = libraries.find((s) => s.id === tokensId) ?? null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label ? <span className="text-[12.5px] text-text-secondary">{label}</span> : null}

      {chosen ? (
        <>
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            title="What is in this library"
            className="flex min-w-0 items-center gap-1.5 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <TokenGlyph className="shrink-0 text-text-muted" />
            <span className="min-w-0 truncate text-[12.5px] underline underline-offset-2">{chosen.name}</span>
          </button>
          <button
            type="button"
            onClick={() => setPickOpen(true)}
            className="text-[12px] text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Change
          </button>
          {allowNone && (
            <button
              type="button"
              onClick={() => onChange(null, null)}
              className="text-[12px] text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              Remove
            </button>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={() => setPickOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-elevated/60 px-2.5 py-1.5 text-[12.5px] text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M8 3.5v9M3.5 8h9" />
          </svg>
          Design tokens
        </button>
      )}

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

      {pickOpen && (
        <TokenLibraryModal
          chosen={tokensId ? { id: tokensId, themeId } : null}
          onChoose={(next) => onChange(next?.id ?? null, next?.themeId ?? null)}
          onClose={() => setPickOpen(false)}
          onCreate={() => { setPickOpen(false); openLibrary(true) }}
          onOpenFull={() => { setPickOpen(false); openLibrary(false) }}
        />
      )}
      {detailOpen && chosen && (
        <TokenLibraryDetail
          library={chosen}
          onClose={() => setDetailOpen(false)}
          onOpenFull={() => { setDetailOpen(false); openLibrary(false) }}
        />
      )}
    </div>
  )
}
