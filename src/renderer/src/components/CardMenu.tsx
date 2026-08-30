import React, { useEffect, useRef, useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from './Modal'

/**
 * The actions on a card.
 *
 * Every list had grown its own: Tokens put the words "Duplicate" and "Delete"
 * on the card in ten-point grey, Designs used two unlabelled glyphs, Motion
 * used one. Only Designs asked before destroying anything, so on every other
 * list a mis-aimed click was final.
 *
 * One button, one menu, and delete always asks.
 */

export type CardAction = {
  label: string
  onSelect: () => void
  /** Destructive. Drawn apart from the rest and never the first thing under the cursor. */
  danger?: boolean
}

export function CardMenu({
  label,
  actions,
  inline = false
}: {
  /** What the menu is for, e.g. the item's name. Used as the accessible name. */
  label: string
  actions: CardAction[]
  /** Sit in the normal flow instead of pinning to the card's top right corner. */
  inline?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent): void => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  return (
    <div ref={box} className={inline ? 'relative' : 'absolute right-2 top-2'}>
      <button
        type="button"
        aria-label={`Actions for ${label}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        // Hidden until the card is under the cursor, but always reachable by
        // keyboard — an action you can only get to with a mouse is not an
        // action everyone has.
        className={`grid h-7 w-7 place-items-center rounded-md text-text-muted transition-opacity hover:bg-bg hover:text-text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 group-hover:opacity-100 ${
          open ? 'bg-bg opacity-100' : 'opacity-0'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="7" cy="3" r="1.15" fill="currentColor" />
          <circle cx="7" cy="7" r="1.15" fill="currentColor" />
          <circle cx="7" cy="11" r="1.15" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div role="menu" className="t42-menu absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-lg bg-raised py-1">
          {actions.map((a, i) => (
            <React.Fragment key={a.label}>
              {a.danger && i > 0 && <span className="my-1 block h-px bg-bg" aria-hidden="true" />}
              <button
                type="button"
                role="menuitem"
                onClick={(e) => { e.stopPropagation(); setOpen(false); a.onSelect() }}
                className={`flex w-full px-3 py-1.5 text-left text-[12.5px] hover:bg-elevated focus-visible:outline-none focus-visible:bg-elevated ${
                  a.danger ? 'text-error' : 'text-text-primary'
                }`}
              >
                {a.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * The question asked before something is destroyed.
 *
 * It names the thing rather than saying "this item", and the button says what
 * it will do rather than "OK", so the sentence still makes sense to someone
 * who arrived at the dialog without reading it.
 */
export function ConfirmDelete({
  name,
  kind,
  note,
  onCancel,
  onConfirm
}: {
  name: string
  /** What it is, lower case: "library", "design", "piece". */
  kind: string
  /** Anything else that goes with it and will also be lost. */
  note?: string
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element {
  return (
    <Modal title={`Delete ${name}`} onClose={onCancel} size="small" closeOnBackdrop={false}>
      <ModalHeader title={`Delete this ${kind}?`} />
      <ModalBody>
        <p className="text-[12.5px] text-text-secondary">
          <span className="text-text-primary">{name}</span> will be gone for good.
          {note ? ` ${note}` : ''} This cannot be undone.
        </p>
      </ModalBody>
      <ModalFooter>
        <ModalButton tone="plain" onClick={onCancel}>Keep it</ModalButton>
        <ModalButton tone="danger" onClick={onConfirm}>Delete {kind}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
