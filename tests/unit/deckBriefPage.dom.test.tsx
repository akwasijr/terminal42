import { describe, it, expect } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { afterEach } from 'vitest'
import { BriefWizard } from '../../src/renderer/src/components/BriefWizard'
import { DECK_TEMPLATES } from '../../src/shared/decks/templates'

afterEach(cleanup)

/**
 * The deck pages, rendered rather than reasoned about.
 *
 * The page list is checked next door in deckBriefPages, but a list of page
 * names says nothing about whether the page draws anything. Every real bug in
 * this area so far was found by looking at the thing, not by reading it.
 */
function openWizard(initial: Record<string, unknown>) {
  return render(
    <BriefWizard
      folderPath="/tmp/does-not-matter"
      projectId="test"
      initial={initial as never}
      onCancel={() => {}}
      onComplete={() => {}}
    />
  )
}

function advance(times: number) {
  for (let i = 0; i < times; i++) {
    act(() => { fireEvent.click(screen.getByRole('button', { name: /^Next/i })) })
  }
}

describe('the deck page of the brief', () => {
  it('offers every deck template by name', async () => {
    openWizard({ type: 'slide-deck', subType: 'Pitch deck (investor)', audience: 'Investors' })
    // Walk to the deck page: type, subType, context, audience, deck.
    advance(4)
    for (const t of DECK_TEMPLATES) expect(screen.getByText(t.name)).toBeTruthy()
  })

  it('asks how long the deck runs and what shape the argument takes', async () => {
    openWizard({ type: 'slide-deck', subType: 'Pitch deck (investor)', audience: 'Investors' })
    advance(4)
    expect(screen.getByText('10 to 15 slides')).toBeTruthy()
    expect(screen.getByText('Problem to solution')).toBeTruthy()
  })

  it('offers to keep the template palette once a template is named', async () => {
    openWizard({
      type: 'slide-deck', subType: 'Pitch deck (investor)', audience: 'Investors',
      deckTemplate: 'studio'
    })
    advance(5)
    expect(screen.getByText(/Keep the Studio palette/)).toBeTruthy()
  })
})
