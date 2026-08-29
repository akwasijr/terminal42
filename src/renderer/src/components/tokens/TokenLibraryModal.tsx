/**
 * Choosing a token library in a modal, and looking one over without leaving.
 *
 * The composer used to carry a standing "Tokens" chip beside the "+" button.
 * That chip was doing two jobs badly: it was a second entry point for a
 * decision that already lives under "+", and it read as a setting rather than
 * as a statement about the turn. So the entry point is the "+" menu alone, and
 * what is left in the row is the name of the library being followed — nothing
 * at all when none is.
 *
 * The list is a modal rather than a menu because a library is chosen by
 * recognising its colours, and a menu row is too small to show them. It is
 * also where somebody with no libraries yet is told so and offered the way to
 * make one, which a menu that renders nothing could never do.
 */

import { useEffect, useState, type JSX } from 'react'
import { resolveAll } from '../../../../shared/tokens/resolve'
import { sectionOf, SECTIONS, type SectionId } from '../../../../shared/tokens/groups'
import type { TokenLibrary } from '../../lib/tokens/useTokenLibraries'
import { useTokenLibraries } from '../../lib/tokens/useTokenLibraries'
import type { ChatTokens } from '../../lib/tokens/chatTokens'

/** The token mark: three stacked bars, the shape a scale has. */
export function TokenGlyph({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="2" y="3" width="12" height="2.4" rx="1.2" fill="currentColor" />
      <rect x="2" y="7" width="8.5" height="2.4" rx="1.2" fill="currentColor" opacity="0.72" />
      <rect x="2" y="11" width="5" height="2.4" rx="1.2" fill="currentColor" opacity="0.45" />
    </svg>
  )
}

/** The colours a library brings, wide enough to recognise it by. */
function Preview({ colours }: { colours: string[] }): JSX.Element {
  if (colours.length === 0) {
    return <span className="block h-9 w-full rounded-md bg-sunken" />
  }
  return (
    <span className="flex h-9 w-full overflow-hidden rounded-md">
      {colours.map((c, i) => (
        <span key={`${c}-${i}`} style={{ background: c }} className="flex-1" />
      ))}
    </span>
  )
}

function Shell({
  title,
  note,
  onClose,
  children,
  footer
}: {
  title: string
  note?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}): JSX.Element {
  useEffect(() => {
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-panel bg-surface p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-medium text-text-primary">{title}</h2>
            {note ? <p className="mt-0.5 text-[12px] text-text-muted">{note}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-muted hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        {children}
        {footer ? <div className="mt-5">{footer}</div> : null}
      </div>
    </div>
  )
}

/**
 * What a library actually contains, close enough to decide by.
 *
 * Counts by section rather than the whole tree: the question here is "is this
 * the one I meant", and a list of four hundred token names answers a different
 * question. The full library is one click away for that.
 */
export function TokenLibraryDetail({
  library,
  onClose,
  onOpenFull
}: {
  library: TokenLibrary
  onClose: () => void
  onOpenFull?: (id: string) => void
}): JSX.Element {
  const resolved = resolveAll(library.studio, library.studio.activeTheme)
  const counts = new Map<SectionId, number>()
  // Counted over every set rather than over what the active theme resolves to,
  // because the library list on the Tokens page counts that way too, and one
  // library reporting two different sizes in two places reads as a bug.
  let total = 0
  for (const set of library.studio.sets) {
    for (const token of set.tokens) {
      total += 1
      const section = sectionOf(token)
      counts.set(section, (counts.get(section) ?? 0) + 1)
    }
  }
  const colours: Array<{ path: string; hex: string }> = []
  for (const [path, hit] of resolved) {
    if (sectionOf(hit.token) === 'colour' && typeof hit.value === 'string' && hit.value.startsWith('#')) {
      colours.push({ path, hex: hit.value })
    }
  }
  const shown = colours.slice(0, 24)

  return (
    <Shell title={library.name} note={`${total} tokens · ${library.themes.length} themes`} onClose={onClose}>
      <Preview colours={library.swatches} />

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5">
        {SECTIONS.filter((s) => counts.get(s.id)).map((s) => (
          <li key={s.id} className="text-[12px] text-text-secondary">
            <span className="text-text-muted">{s.label}</span> {counts.get(s.id)}
          </li>
        ))}
      </ul>

      {shown.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
          {shown.map((c) => (
            <li key={c.path} className="flex min-w-0 items-center gap-2">
              <span className="h-3.5 w-3.5 shrink-0 rounded" style={{ background: c.hex }} />
              <span className="min-w-0 truncate text-[11.5px] text-text-secondary">{c.path}</span>
            </li>
          ))}
        </ul>
      )}

      {onOpenFull && (
        <button
          type="button"
          onClick={() => onOpenFull(library.id)}
          className="mt-5 text-[12.5px] text-text-secondary underline underline-offset-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Open the full library
        </button>
      )}
    </Shell>
  )
}

/**
 * The list of libraries, with the way out of an empty one.
 *
 * `onCreate` is what turns this from a dead end into a start: somebody who has
 * never made a library opens this expecting to attach one, and being told
 * "none" without being told how is the moment they give up on the feature.
 */
export function TokenLibraryModal({
  chosen,
  onChoose,
  onClose,
  onCreate,
  onOpenFull
}: {
  chosen: ChatTokens | null
  onChoose: (next: ChatTokens | null) => void
  onClose: () => void
  onCreate?: () => void
  onOpenFull?: (id: string) => void
}): JSX.Element {
  const { libraries, loading } = useTokenLibraries()
  const [detail, setDetail] = useState<TokenLibrary | null>(null)

  if (detail) {
    return <TokenLibraryDetail library={detail} onClose={() => setDetail(null)} onOpenFull={onOpenFull} />
  }

  if (!loading && libraries.length === 0) {
    return (
      <Shell title="Design tokens" note="No libraries yet." onClose={onClose}>
        <p className="max-w-[52ch] text-[12.5px] leading-relaxed text-text-secondary">
          A library holds the colours, type and spacing a piece of work is held to. Attach one and
          every turn follows it.
        </p>
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="mt-4 rounded-md bg-action px-3 py-2 text-[12.5px] font-medium text-action-text hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Build a library
          </button>
        )}
      </Shell>
    )
  }

  return (
    <Shell title="Design tokens" note="Every turn follows the one you attach." onClose={onClose}>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {libraries.map((lib) => {
          const active = chosen?.id === lib.id
          return (
            <li key={lib.id} className={`rounded-panel p-3 ${active ? 'bg-elevated' : 'bg-raised'}`}>
              <Preview colours={lib.swatches} />
              <div className="mt-2.5 flex items-center gap-1.5 text-text-primary">
                <TokenGlyph className="shrink-0 text-text-muted" />
                <button
                  type="button"
                  onClick={() => setDetail(lib)}
                  className="min-w-0 truncate text-[12.5px] underline underline-offset-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  {lib.name}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {lib.themes.map((t) => {
                  const on = active && (chosen?.themeId ?? lib.studio.activeTheme) === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onChoose({ id: lib.id, themeId: t.id })
                        onClose()
                      }}
                      className={`rounded-full px-2.5 py-1 text-[11.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                        on ? 'bg-action text-action-text' : 'bg-sunken text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {t.name}
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-5 flex items-center gap-4">
        {chosen && (
          <button
            type="button"
            onClick={() => {
              onChoose(null)
              onClose()
            }}
            className="text-[12.5px] text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Follow nothing
          </button>
        )}
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="text-[12.5px] text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Build a library
          </button>
        )}
      </div>
    </Shell>
  )
}
