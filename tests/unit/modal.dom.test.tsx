import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from '../../src/renderer/src/components/Modal'

afterEach(cleanup)

/**
 * The behaviour eighteen separate dialogs each had a different opinion about.
 * Several had no Escape handler at all, which is how someone ends up stuck in
 * one, so these are the guards that keep the primitive honest.
 */
function open(props: Partial<React.ComponentProps<typeof Modal>> = {}) {
  const onClose = vi.fn()
  render(
    <Modal title="A dialog" onClose={onClose} {...props}>
      <ModalHeader title="A dialog" note="One line." />
      <ModalBody><button type="button">Inside</button></ModalBody>
      <ModalFooter left={<ModalButton tone="plain">Skip</ModalButton>}>
        <ModalButton tone="primary">Confirm</ModalButton>
      </ModalFooter>
    </Modal>
  )
  return onClose
}

const scrim = (): HTMLElement => document.querySelector('.t42-scrim') as HTMLElement
const panel = (): HTMLElement => screen.getByRole('dialog')

describe('the shared modal', () => {
  it('always closes on Escape', () => {
    const onClose = open()
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }) })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape even when the backdrop is disarmed', () => {
    // A dialog with no keyboard way out is a bug, not a safeguard.
    const onClose = open({ closeOnBackdrop: false })
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }) })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on a click that both starts and ends on the backdrop', () => {
    const onClose = open()
    act(() => {
      fireEvent.mouseDown(scrim())
      fireEvent.click(scrim())
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when a drag starts inside and ends on the backdrop', () => {
    // Selecting text to the edge of a field must not throw the work away.
    const onClose = open()
    act(() => {
      fireEvent.mouseDown(panel())
      fireEvent.click(scrim())
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not close on a backdrop click when that is turned off', () => {
    const onClose = open({ closeOnBackdrop: false })
    act(() => {
      fireEvent.mouseDown(scrim())
      fireEvent.click(scrim())
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('ignores clicks landing inside the panel', () => {
    const onClose = open()
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Inside' })) })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('takes the keyboard off the page underneath', () => {
    open()
    expect(document.activeElement).toBe(panel())
  })

  it('names itself for a screen reader and marks itself modal', () => {
    open()
    expect(panel().getAttribute('aria-label')).toBe('A dialog')
    expect(panel().getAttribute('aria-modal')).toBe('true')
  })

  it('carries no shadow on the panel', () => {
    // The owner has asked repeatedly for no drop shadows on panels.
    open()
    expect(panel().className).not.toMatch(/shadow/)
    expect(scrim().className).not.toMatch(/shadow/)
  })
})
