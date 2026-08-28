// The wording of the off-library setting, kept out of the component so the
// length of it can be held to a limit by a test.
//
// Every one of these rows had grown into a sentence explaining itself, and
// three sentences stacked in a small menu read as filler rather than as help.
// The rungs are cumulative, so they are written as fragments that continue
// one another instead of three sentences that repeat one another.

import type { Enforcement } from './types'

export type EnforcementOption = {
  id: Enforcement
  label: string
  hint: string
}

export const ENFORCEMENT_OPTIONS: EnforcementOption[] = [
  { id: 'advise', label: 'Advise', hint: 'Name the tokens in the prompt' },
  { id: 'check', label: 'Check', hint: '…and report what came out off-library' },
  { id: 'block', label: 'Fix', hint: '…and ask for it to be replaced' }
]

/** What a line of microcopy in a menu is allowed to run to. */
export const MENU_HINT_LIMIT = 44
