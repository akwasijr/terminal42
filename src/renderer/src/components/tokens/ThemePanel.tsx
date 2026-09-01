import { useMemo, useState } from 'react'
import type { TokenStudio } from '../../../../shared/tokens/types'
import { CREATE_TOKEN_KINDS, groupRows, themeRows, type TokenKind } from '../../lib/tokens/themeRows'

const KIND_ICON: Record<string, JSX.Element> = {
  Color: <rect x="4" y="4" width="16" height="16" rx="3" />,
  Radius: <path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3" />,
  Spacing: <path d="M17 7 7 17M17 12V7h-5M7 12v5h5" />,
  Container: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M9 5v14M15 5v14" /></>,
  Breakpoint: <><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M9 21h6" /></>,
  'Font family': <path d="M7 20c3 0 4-2 4-6V6M5 6h9" />,
  'Font weight': <><path d="M12 5 7 19M12 5l5 14" /><path d="M3 12h1M20 12h1" /></>,
  'Font size': <><path d="M4 8V6h8v2M8 6v12" /><path d="M20 6v12M17 9l3-3 3 3" /></>,
  'Line height': <><path d="M4 5h16" /><path d="M9 19 12 9l3 10" /></>,
  'Letter spacing': <><path d="M5 5v14M19 5v14" /><path d="M9 17 12 8l3 9" /></>
}

const Ico = ({ label }: { label: string }): JSX.Element => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {KIND_ICON[label]}
  </svg>
)

function CreateMenu({ onPick, onClose, align }: { onPick: (k: TokenKind) => void; onClose: () => void; align: 'right' | 'center' }): JSX.Element {
  return (
    <>
      <div className="fixed inset-0 z-40" onPointerDown={onClose} role="presentation" />
      <div className={['t42-menu absolute z-50 mt-1 w-52 overflow-hidden rounded-2xl bg-raised py-2 shadow-overlay', align === 'right' ? 'right-0 top-full' : 'left-1/2 top-full -translate-x-1/2'].join(' ')}>
        {CREATE_TOKEN_KINDS.map((k) => (
          <div key={k.label}>
            {k.sep && <div className="my-1.5 h-px bg-white/10" />}
            <button type="button" onClick={() => { onPick(k); onClose() }}
              className="flex w-full items-center gap-3 px-4 py-1.5 text-left text-[13px] text-white/90 hover:bg-white/10">
              <span className="grid h-5 w-5 place-items-center text-white/70"><Ico label={k.label} /></span>
              {k.label}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

type Props = {
  studio: TokenStudio | null
  themeId: string | null
  onCreate: (kind: TokenKind) => void
  onStarter: () => void
}

/** The tokens a design stands on, and the two ways to get some. */
export function ThemePanel({ studio, themeId, onCreate, onStarter }: Props): JSX.Element {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [menu, setMenu] = useState<'header' | 'empty' | null>(null)
  const all = useMemo(() => themeRows(studio, themeId), [studio, themeId])
  const rows = useMemo(() => themeRows(studio, themeId, query), [studio, themeId, query])
  const groups = useMemo(() => groupRows(rows), [rows])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex shrink-0 items-center gap-1 px-3 py-2">
        {searching ? (
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); setSearching(false) } }}
            onBlur={() => { if (!query) setSearching(false) }}
            placeholder="Search tokens" aria-label="Search tokens"
            className="min-w-0 flex-1 rounded-md bg-elevated px-2 py-1 text-[12.5px] text-text-primary placeholder:text-text-muted focus:outline-none" />
        ) : (
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-secondary">
            {all.length ? `${all.length} token${all.length === 1 ? '' : 's'}` : 'No tokens'}
          </span>
        )}
        <button type="button" onClick={() => setSearching((s) => !s)} aria-label="Search tokens"
          className="grid h-7 w-7 place-items-center rounded-md text-text-secondary hover:bg-elevated hover:text-text-primary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
        </button>
        <button type="button" onClick={() => setMenu((m) => (m === 'header' ? null : 'header'))} aria-label="Create token"
          className="grid h-7 w-7 place-items-center rounded-md text-text-secondary hover:bg-elevated hover:text-text-primary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        {menu === 'header' && <CreateMenu align="right" onPick={onCreate} onClose={() => setMenu(null)} />}
      </div>

      {all.length === 0 ? (
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="text-text-muted">
            <path d="M5 4h14v10l-7 6-7-6z" /><path d="M13 4v7h6" /><path d="m5 14 7-3" />
          </svg>
          <p className="text-[13px] text-text-secondary">Theme tokens</p>
          <p className="max-w-[220px] text-[12px] text-text-muted">Create tokens to get started, or explore the starter theme.</p>
          <div className="relative mt-1">
            <button type="button" onClick={() => setMenu((m) => (m === 'empty' ? null : 'empty'))}
              className="rounded-md bg-elevated px-3 py-1.5 text-[12.5px] text-text-primary hover:opacity-90">Create token</button>
            {menu === 'empty' && <CreateMenu align="center" onPick={onCreate} onClose={() => setMenu(null)} />}
          </div>
          <button type="button" onClick={onStarter} className="text-[12px] text-text-secondary underline-offset-2 hover:text-text-primary hover:underline">Starter theme</button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {rows.length === 0 && <p className="px-1 py-3 text-[12px] text-text-muted">Nothing matches {query}.</p>}
          {groups.map((g) => (
            <section key={g.group} className="mb-2">
              <h3 className="px-1 py-1 text-[11px] uppercase tracking-wide text-text-muted">{g.group}</h3>
              {g.rows.map((r) => (
                <div key={r.path} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-elevated" title={r.path}>
                  {r.swatch
                    ? <span className="h-3.5 w-3.5 shrink-0 rounded" style={{ background: r.swatch }} />
                    : <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded bg-elevated text-[8px] text-text-muted">{r.type[0].toUpperCase()}</span>}
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-primary">{r.name}</span>
                  <span className="max-w-[45%] shrink-0 truncate text-[11.5px] text-text-muted">{r.value}</span>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
