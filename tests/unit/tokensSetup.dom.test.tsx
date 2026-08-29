import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { TokensSetup } from '../../src/renderer/src/components/tokens/TokensSetup'
import type { TokenStudio } from '../../src/shared/tokens/types'

afterEach(cleanup)

/**
 * The token wizard, rendered.
 *
 * The version this replaced was rejected twice for asking nothing, so the
 * thing worth guarding is that every step actually puts a question and that
 * the answers reach the library. A page count would not have caught the old
 * one — it had a page.
 */
function open(onCreate: (s: TokenStudio) => void = () => {}) {
  return render(<TokensSetup onCancel={() => {}} onCreate={onCreate} />)
}

const next = () => act(() => { fireEvent.click(screen.getByRole('button', { name: 'Next' })) })
const back = () => act(() => { fireEvent.click(screen.getByRole('button', { name: 'Back' })) })

describe('the new token library wizard', () => {
  it('opens on a question rather than a wall of cards', () => {
    open()
    expect(screen.getByText('Where should it start?')).toBeTruthy()
    expect(screen.getByText('Step 1 of 8')).toBeTruthy()
  })

  it('asks about every decision that changes the library', () => {
    open()
    const asked: string[] = []
    for (let i = 0; i < 7; i++) {
      asked.push(screen.getByRole('heading', { level: 2 }).textContent ?? '')
      next()
    }
    asked.push(screen.getByRole('heading', { level: 2 }).textContent ?? '')
    expect(asked).toEqual([
      'Where should it start?',
      'What is the brand colour?',
      'How round are things?',
      'How much air is there?',
      'How far apart are the type sizes?',
      'Does anything lift off the page?',
      'What are the variables called?',
      'Ready to build'
    ])
  })

  it('lets an answer be changed by going back', () => {
    open()
    next()
    expect(screen.getByText('What is the brand colour?')).toBeTruthy()
    back()
    expect(screen.getByText('Where should it start?')).toBeTruthy()
  })

  it('carries the answers into the library it builds', () => {
    const made = vi.fn()
    open(made)
    // colour
    next()
    act(() => { fireEvent.change(screen.getByLabelText('Brand colour hex'), { target: { value: '#1166ee' } }) })
    // corners
    next()
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Pill/ })) })
    // air, type sizes, lift
    next(); next(); next()
    // naming
    next()
    act(() => { fireEvent.change(screen.getByLabelText('Prefix'), { target: { value: 'acme' } }) })
    act(() => { fireEvent.click(screen.getByRole('button', { name: '--acme-colorTextPrimary' })) })
    // review
    next()
    act(() => { fireEvent.change(screen.getByLabelText('Name this library'), { target: { value: 'Acme' } }) })
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Build' })) })

    expect(made).toHaveBeenCalledTimes(1)
    const studio = made.mock.calls[0][0] as TokenStudio
    expect(studio.name).toBe('Acme')
    expect(studio.css?.prefix).toBe('acme')
    expect(studio.css?.casing).toBe('camel')
  })

  it('shows the choice taking effect while it is being made', () => {
    open()
    // The running preview names the library, so changing the name on the last
    // step has to show up there rather than only on Build.
    for (let i = 0; i < 7; i++) next()
    act(() => { fireEvent.change(screen.getByLabelText('Name this library'), { target: { value: 'Harbour' } }) })
    expect(screen.getAllByText('Harbour').length).toBeGreaterThan(0)
  })

  it('still lets someone skip the whole thing', () => {
    const made = vi.fn()
    open(made)
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Start empty' })) })
    expect(made).toHaveBeenCalledTimes(1)
  })
})
