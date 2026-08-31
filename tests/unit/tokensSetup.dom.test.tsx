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
    // It used to open on nine style cards, which decided the typefaces on
    // your behalf and made anyone who already knew their style hunt for the
    // nearest match. It opens on the one thing only you can supply.
    expect(screen.getByText('What is this set called?')).toBeTruthy()
    expect(screen.getByText('Step 1 of 10')).toBeTruthy()
  })

  it('asks about every decision that changes the library', () => {
    open()
    const asked: string[] = []
    for (let i = 0; i < 9; i++) {
      asked.push(screen.getByRole('heading', { level: 2 }).textContent ?? '')
      next()
    }
    asked.push(screen.getByRole('heading', { level: 2 }).textContent ?? '')
    expect(asked).toEqual([
      'What is this set called?',
      'What is the brand colour?',
      'What sits beside it?',
      'What do good and bad look like?',
      'How round are things?',
      'How much space between things?',
      'What does text look like?',
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
    expect(screen.getByText('What is this set called?')).toBeTruthy()
  })

  it('carries the answers into the library it builds', () => {
    const made = vi.fn()
    open(made)
    act(() => { fireEvent.change(screen.getByLabelText('Name this set'), { target: { value: 'Acme' } }) })
    // brand colour
    next()
    act(() => { fireEvent.change(screen.getByLabelText('Brand colour hex'), { target: { value: '#1166ee' } }) })
    // supporting colours, then the four that mean something
    next(); next()
    // corners
    next()
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Pill/ })) })
    // space, type, lift
    next(); next(); next()
    // naming
    next()
    act(() => { fireEvent.change(screen.getByLabelText('Prefix'), { target: { value: 'acme' } }) })
    act(() => { fireEvent.click(screen.getByRole('button', { name: '--acme-colorTextPrimary' })) })
    // review
    next()
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Build' })) })

    expect(made).toHaveBeenCalledTimes(1)
    const studio = made.mock.calls[0][0] as TokenStudio
    expect(studio.name).toBe('Acme')
    expect(studio.css?.prefix).toBe('acme')
    expect(studio.css?.casing).toBe('camel')
  })

  it('shows the choice taking effect while it is being made', () => {
    open()
    // The running preview names the library, so typing the name on the first
    // step has to show up there rather than only on Build.
    act(() => { fireEvent.change(screen.getByLabelText('Name this set'), { target: { value: 'Harbour' } }) })
    expect(screen.getAllByText('Harbour').length).toBeGreaterThan(0)
  })

  it('still lets someone skip the whole thing', () => {
    const made = vi.fn()
    open(made)
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Start empty' })) })
    expect(made).toHaveBeenCalledTimes(1)
  })

  it('takes the offer to skip away once there are answers to lose', () => {
    open()
    next()
    expect(screen.queryByRole('button', { name: 'Start empty' })).toBeNull()
  })

  it('builds with the typeface that was chosen, not one supplied behind your back', () => {
    const made = vi.fn()
    open(made)
    for (let i = 0; i < 6; i++) next()
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Fraunces/ })) })
    for (let i = 0; i < 3; i++) next()
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Build' })) })

    const studio = made.mock.calls[0][0] as TokenStudio
    const value = (name: string): unknown =>
      studio.sets.flatMap((s) => s.tokens).find((t) => t.path === name)?.value
    expect(value('family.display')).toBe('Fraunces')
    expect(value('family.sans')).toBe('Source Serif Pro')
  })
})

describe('the colours a library is actually made of', () => {
  it('carries the accent and the four meaning colours into the tokens', () => {
    const made = vi.fn()
    open(made)
    next() // brand
    act(() => { fireEvent.change(screen.getByLabelText('Brand colour hex'), { target: { value: '#1166ee' } }) })
    next() // supporting
    act(() => { fireEvent.change(screen.getByLabelText('Accent hex'), { target: { value: '#ff8800' } }) })
    next() // meaning
    act(() => { fireEvent.change(screen.getByLabelText('Wrong hex'), { target: { value: '#990000' } }) })
    for (let i = 0; i < 6; i++) next()
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Build' })) })

    const studio = made.mock.calls[0][0] as TokenStudio
    const value = (name: string): unknown =>
      studio.sets.flatMap((s) => s.tokens).find((t) => t.path === name)?.value

    // The anchor step is where the given colour lands on its own ramp, so
    // these are the swatches that must be exactly what was typed.
    expect(value('palette.brand.600')).toBe('#1166ee')
    expect(value('palette.accent.600')).toBe('#ff8800')
    expect(value('palette.danger.600')).toBe('#990000')
    // Untouched roles keep the convention rather than following the brand.
    expect(value('palette.success.600')).toBe('#16a34a')
  })
})
