// The prompts offered on an empty chat.
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
//
// Three tiles show at a time, one of each kind, and the set rotates between
// chats. Showing all nine would turn a first impression into a menu; showing
// the same three forever makes the feature look like decoration once you have
// read it twice.

/**
 * Kinds are a closed set so the artwork map in ChatEmptyStateFull is checked
 * at compile time. A mistyped key there would otherwise render a blank tile
 * with no error anywhere. Every prompt of a kind shares that kind's artwork,
 * which is why the pool can grow without new drawings.
 */
export const STARTER_IDS = ['dashboard', 'tool', 'site'] as const
export type StarterId = (typeof STARTER_IDS)[number]

export type StarterPromptText = {
  id: StarterId
  title: string
  prompt: string
}

/** Every prompt, grouped by kind. Each group is one rotation cycle. */
export const STARTER_POOL: Record<StarterId, StarterPromptText[]> = {
  dashboard: [
    {
      id: 'dashboard',
      title: 'Build a living dashboard',
      prompt:
        'Build a dashboard page from a data file or API I point you at, charting at least 3 numbers that matter. Verify it by loading the real data and running the page. Success is 0 errors and no placeholder values.'
    },
    {
      id: 'dashboard',
      title: 'Chart a spreadsheet',
      prompt:
        'Turn a spreadsheet I give you into a page with at least 2 charts and a filter. Verify by loading the real file and checking the totals match the source. Success is 0 errors and 0 hardcoded rows.'
    },
    {
      id: 'dashboard',
      title: 'Build a status board',
      prompt:
        'Build a status board that polls at least 2 endpoints I name and shows whether each is up, with the last check time. Verify by running it against the real endpoints. Success is 0 errors and 0 fake results.'
    }
  ],
  tool: [
    {
      id: 'tool',
      title: 'Build an internal tool',
      prompt:
        'Build an internal tool: a form that writes to a local database and a list page that reads it back. Verify by adding, editing and deleting a record. Success is 0 errors across all 3 operations.'
    },
    {
      id: 'tool',
      title: 'Automate a chore',
      prompt:
        'Write a script for a repetitive task I describe, with a dry-run mode that changes 0 files. Verify by running the dry run and then the real thing on a copy. Success is 0 errors and 0 surprises between the 2 runs.'
    },
    {
      id: 'tool',
      title: 'Build a command-line tool',
      prompt:
        'Build a command-line tool for a job I describe, with --help and at least 2 subcommands. Verify by running every subcommand end to end. Success is 0 errors and 0 undocumented flags.'
    }
  ],
  site: [
    {
      id: 'site',
      title: 'Create a launch website',
      prompt:
        'Build a launch page for a product I describe: headline, what it does, and one call-to-action button. Use semantic HTML and design tokens for colour and spacing. Verify with an accessibility check. Success is 0 errors and 0 hardcoded hex values.'
    },
    {
      id: 'site',
      title: 'Build a portfolio',
      prompt:
        'Build a portfolio page for work I describe, with an intro and at least 3 project cards. Use semantic HTML and design tokens throughout. Verify with an accessibility check. Success is 0 errors and 0 hardcoded hex values.'
    },
    {
      id: 'site',
      title: 'Publish documentation',
      prompt:
        'Build a documentation page for something I describe, with a contents list linking to at least 4 sections. Use semantic HTML and design tokens. Verify every link resolves. Success is 0 errors and 0 dead links.'
    }
  ]
}

/** Longest group, so a full cycle shows every prompt in the pool. */
export const STARTER_ROTATION_LENGTH = Math.max(...STARTER_IDS.map((id) => STARTER_POOL[id].length))

/**
 * The three prompts to show, one per kind.
 *
 * `rotation` is any integer — a counter the caller persists across chats.
 * Negative and out-of-range values wrap rather than throwing, because a
 * corrupted counter in storage must not be able to blank the empty state.
 * Groups wrap independently, so the pool can grow one prompt at a time.
 */
export function starterTrio(rotation: number): StarterPromptText[] {
  const n = Number.isFinite(rotation) ? Math.trunc(rotation) : 0
  return STARTER_IDS.map((id) => {
    const group = STARTER_POOL[id]
    return group[((n % group.length) + group.length) % group.length]
  })
}
