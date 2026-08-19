// The three prompts offered on an empty chat.
//
// Text lives here rather than beside the artwork so it can be tested. These
// are the first thing a new user ever sends, and the harness scores every goal
// for hill-climbability — a starter that trips its own "this goal may be hard
// to measure" hint teaches people that the warning is noise to dismiss. So the
// wording is held to the same bar the harness asks of the user: a stated
// target, and a named way to check it.
//
// They are build-oriented on purpose. Someone opening a fresh session wants to
// make a thing, not commission a report about their own codebase; "map this
// repo" is a second-session task. Each names an artefact, leaves the subject
// blank for the user to fill in, and ends with a condition the result can be
// held against.

/**
 * Ids are a closed set so the artwork map in ChatEmptyStateFull is checked at
 * compile time. A mistyped key there would otherwise render a blank tile with
 * no error anywhere.
 */
export const STARTER_IDS = ['dashboard', 'tool', 'site'] as const
export type StarterId = (typeof STARTER_IDS)[number]

export type StarterPromptText = {
  id: StarterId
  title: string
  prompt: string
}

export const STARTER_PROMPT_TEXTS: StarterPromptText[] = [
  {
    id: 'dashboard',
    title: 'Build a living dashboard',
    prompt:
      'Build a dashboard page from a data file or API I point you at, charting at least 3 numbers that matter. Verify it by loading the real data and running the page. Success is 0 errors and no placeholder values.'
  },
  {
    id: 'tool',
    title: 'Build an internal tool',
    prompt:
      'Build an internal tool: a form that writes to a local database and a list page that reads it back. Verify by adding, editing and deleting a record. Success is 0 errors across all 3 operations.'
  },
  {
    id: 'site',
    title: 'Create a launch website',
    prompt:
      'Build a launch page for a product I describe: headline, what it does, and one call-to-action button. Use semantic HTML and design tokens for colour and spacing. Verify with an accessibility check. Success is 0 errors and 0 hardcoded hex values.'
  }
]
