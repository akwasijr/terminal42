import React, { useEffect, useRef } from 'react'

/**
 * One modal.
 *
 * Before this there were eighteen, each with its own scrim opacity, its own
 * corner radius, its own z-index and its own opinion about whether Escape
 * ought to close anything — several had no opinion at all, which is how a
 * dialog ends up trapping someone in it. The differences were never design
 * decisions; they were the order the files happened to be written in.
 *
 * Everything that opens over the app now comes through here, so the scrim,
 * the panel, the stacking, Escape, the backdrop click and where the buttons
 * sit are decided once.
 */

/** Roomier than it needs to be is worse than snug. Three sizes, no more. */
const WIDTH = {
  /** Confirmations and single questions. */
  small: 'max-w-md',
  /** The common case: a form, a short list, a detail panel. */
  medium: 'max-w-2xl',
  /** Galleries and anything with an aside. */
  large: 'max-w-4xl',
  /** Grids of previews, where a fourth column is worth the width. */
  xlarge: 'max-w-6xl'
} as const

export type ModalSize = keyof typeof WIDTH

export function Modal({
  title,
  onClose,
  size = 'medium',
  children,
  labelledBy,
  closeOnBackdrop = true
}: {
  /** Used as the accessible name. Render it visibly with ModalHeader. */
  title: string
  onClose: () => void
  size?: ModalSize
  children: React.ReactNode
  labelledBy?: string
  /**
   * Off only where a stray click would lose real work. Escape always closes;
   * a dialog with no way out on the keyboard is a bug, not a safeguard.
   */
  closeOnBackdrop?: boolean
}): React.JSX.Element {
  const panel = useRef<HTMLDivElement>(null)
  const downOnScrim = useRef(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    // Capture, so the topmost open dialog answers first and one press does
    // not collapse a stack of them.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  useEffect(() => {
    // Without this the keyboard is still back on the page underneath, and
    // Tab walks the wrong thing.
    panel.current?.focus()
  }, [])

  return (
    <div
      className="t42-scrim fixed inset-0 z-[200] grid place-items-center bg-black/45 p-6"
      // A drag that starts inside the panel and finishes on the scrim — which
      // is what selecting text to the edge of a field looks like — must not
      // count as clicking away.
      onMouseDown={(e) => { downOnScrim.current = e.target === e.currentTarget }}
      onClick={(e) => {
        if (!closeOnBackdrop) return
        if (e.target === e.currentTarget && downOnScrim.current) onClose()
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex max-h-[86vh] w-full ${WIDTH[size]} flex-col overflow-hidden rounded-panel bg-elevated outline-none`}
      >
        {children}
      </div>
    </div>
  )
}

export function ModalHeader({
  title,
  note,
  id,
  right
}: {
  title: string
  /** One line at most. If it needs a paragraph, the dialog is doing too much. */
  note?: string
  id?: string
  right?: React.ReactNode
}): React.JSX.Element {
  return (
    <header className="flex items-start gap-3 px-5 pt-5">
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-[15px] font-medium text-text-primary">{title}</h2>
        {note && <p className="mt-0.5 text-[12px] text-text-secondary">{note}</p>}
      </div>
      {right}
    </header>
  )
}

export function ModalBody({
  children,
  /**
   * Fixed height, for stepped dialogs. A panel that resizes under the pointer
   * between one question and the next reads as cheap.
   */
  height,
  className = ''
}: {
  children: React.ReactNode
  height?: number
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={`min-h-0 flex-1 overflow-y-auto px-5 py-4 ${className}`}
      style={height ? { height, flex: 'none' } : undefined}
    >
      {children}
    </div>
  )
}

export function ModalFooter({
  left,
  children
}: {
  /** Escapes and skips — the things nobody should hit by aiming for Confirm. */
  left?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <footer className="flex items-center gap-2 px-5 pb-5 pt-1">
      <div className="min-w-0 flex-1">{left}</div>
      {children}
    </footer>
  )
}

/** Progress across a stepped dialog. Position, not decoration. */
export function ModalSteps({ count, at }: { count: number; at: number }): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`h-0.5 flex-1 rounded-full transition-colors ${i <= at ? 'bg-accent' : 'bg-raised'}`}
        />
      ))}
    </div>
  )
}

/**
 * The pane down the left of a stepped dialog that shows what is being built.
 * It is the only thing on screen that is not a question, and it changes on
 * every answer, so the effect of a choice is visible as it is made.
 */
export function ModalAside({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <aside className="w-56 flex-none overflow-y-auto bg-sunken p-4">{children}</aside>
}

/** The two footer buttons, so they look the same in all eighteen places. */
export function ModalButton({
  onClick,
  children,
  tone = 'quiet',
  disabled,
  type = 'button'
}: {
  onClick?: () => void
  children: React.ReactNode
  tone?: 'primary' | 'quiet' | 'plain' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit'
}): React.JSX.Element {
  const look =
    tone === 'primary'
      ? 'bg-action text-action-text hover:opacity-90'
      : tone === 'danger'
        ? 'bg-error text-white hover:opacity-90'
        : tone === 'quiet'
          ? 'bg-raised text-text-primary hover:opacity-90'
          : 'text-text-secondary hover:text-text-primary'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${look}`}
    >
      {children}
    </button>
  )
}
