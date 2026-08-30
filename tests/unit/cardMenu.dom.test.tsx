/**
 * The card menu and the question it asks before destroying anything.
 *
 * The point of these is the last one: for most of this app's life a
 * mis-aimed click on a list deleted work with no way back. A test that only
 * checked the menu opened would have passed the whole time.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CardMenu, ConfirmDelete } from '../../src/renderer/src/components/CardMenu'

afterEach(cleanup)

const click = (el: Element): void => {
  act(() => {
    fireEvent.click(el)
  })
}

describe('CardMenu', () => {
  it('keeps its actions behind one button', () => {
    render(<CardMenu label="Sunrise" actions={[{ label: 'Duplicate', onSelect: vi.fn() }]} />)
    expect(screen.queryByRole('menuitem')).toBeNull()
    click(screen.getByRole('button', { name: 'Actions for Sunrise' }))
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeTruthy()
  })

  it('runs the action it was asked for and closes', () => {
    const duplicate = vi.fn()
    render(<CardMenu label="Sunrise" actions={[{ label: 'Duplicate', onSelect: duplicate }]} />)
    click(screen.getByRole('button', { name: 'Actions for Sunrise' }))
    click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(duplicate).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menuitem')).toBeNull()
  })

  it('closes on Escape', () => {
    render(<CardMenu label="Sunrise" actions={[{ label: 'Duplicate', onSelect: vi.fn() }]} />)
    click(screen.getByRole('button', { name: 'Actions for Sunrise' }))
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(screen.queryByRole('menuitem')).toBeNull()
  })

  it('closes when the click lands elsewhere', () => {
    render(<CardMenu label="Sunrise" actions={[{ label: 'Duplicate', onSelect: vi.fn() }]} />)
    click(screen.getByRole('button', { name: 'Actions for Sunrise' }))
    act(() => {
      fireEvent.mouseDown(document.body)
    })
    expect(screen.queryByRole('menuitem')).toBeNull()
  })

  it('does not open the card underneath it', () => {
    const open = vi.fn()
    render(
      <div onClick={open}>
        <CardMenu label="Sunrise" actions={[{ label: 'Duplicate', onSelect: vi.fn() }]} />
      </div>
    )
    click(screen.getByRole('button', { name: 'Actions for Sunrise' }))
    expect(open).not.toHaveBeenCalled()
  })
})

describe('ConfirmDelete', () => {
  it('names the thing rather than calling it "this item"', () => {
    render(<ConfirmDelete name="Sunrise" kind="library" onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByText('Sunrise')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete library' })).toBeTruthy()
  })

  it('destroys nothing until it is confirmed', () => {
    const confirm = vi.fn()
    const cancel = vi.fn()
    render(<ConfirmDelete name="Sunrise" kind="library" onCancel={cancel} onConfirm={confirm} />)
    click(screen.getByRole('button', { name: 'Keep it' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('backs out on Escape without deleting', () => {
    const confirm = vi.fn()
    const cancel = vi.fn()
    render(<ConfirmDelete name="Sunrise" kind="library" onCancel={cancel} onConfirm={confirm} />)
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(confirm).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalled()
  })

  it('deletes only on the destructive button', () => {
    const confirm = vi.fn()
    render(<ConfirmDelete name="Sunrise" kind="library" onCancel={vi.fn()} onConfirm={confirm} />)
    click(screen.getByRole('button', { name: 'Delete library' }))
    expect(confirm).toHaveBeenCalledOnce()
  })

  it('mentions what else goes with it', () => {
    render(
      <ConfirmDelete
        name="Sunrise"
        kind="design"
        note="Every saved version goes with it."
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    )
    expect(screen.getByText(/Every saved version goes with it/)).toBeTruthy()
  })
})
