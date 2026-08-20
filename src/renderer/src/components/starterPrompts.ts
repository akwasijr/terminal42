// The prompts offered on an empty chat, and the full template library behind
// the "More templates" button.
//
// Text lives here rather than beside the artwork so it can be tested.
//
// Wording rule: say the thing plainly, the way a person would ask for it.
// An earlier set spelled out its own acceptance criteria ("Verify by ... .
// Success is 0 errors and 0 hardcoded rows"), which read like a specification
// and was too stiff to send as written. Each prompt now names the artefact,
// leaves the subject for the user to fill in, and carries one natural quantity
// ("at least 3 project cards") — enough for the harness's measurability check
// without a tacked-on success clause. A test holds every prompt to that bar.
//
// Three tiles show at a time, one of each trio kind, and the set rotates
// between chats. The rest live in the modal, which is where breadth belongs:
// showing fifteen tiles up front turns a first impression into a menu.

/**
 * Kinds are a closed set so the artwork map in starterArt is checked at
 * compile time. A mistyped key there would otherwise render a blank tile with
 * no error anywhere. Every prompt of a kind shares that kind's artwork, which
 * is why the library can grow without new drawings.
 */
export const STARTER_IDS = ['dashboard', 'tool', 'site', 'api', 'docs'] as const
export type StarterId = (typeof STARTER_IDS)[number]

/**
 * The kinds shown on the empty state itself.
 *
 * A subset of the full set: three tiles fit the space, and these three cover
 * what people most often open a fresh session to build. The rest are one
 * click away in the modal.
 */
export const TRIO_IDS = ['dashboard', 'tool', 'site'] as const satisfies readonly StarterId[]

/** Human label for each kind, used as the modal's group headings. */
export const STARTER_GROUP_LABELS: Record<StarterId, string> = {
  dashboard: 'Data and dashboards',
  tool: 'Tools and automation',
  site: 'Pages and sites',
  api: 'APIs and services',
  docs: 'Docs and writing'
}

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
      title: 'Build a dashboard',
      prompt: 'Build a dashboard from a data file I point you at, with at least 3 charts of the numbers that matter.'
    },
    {
      id: 'dashboard',
      title: 'Chart a spreadsheet',
      prompt: 'Turn a spreadsheet I give you into a page with at least 2 charts and a filter.'
    },
    {
      id: 'dashboard',
      title: 'Watch some services',
      prompt: 'Build a status page that checks at least 2 services I name and shows whether each one is up.'
    }
  ],
  tool: [
    {
      id: 'tool',
      title: 'Build an internal tool',
      prompt: 'Build a small internal tool: a form that saves records and a list page to browse them, with at least 3 actions (add, edit, delete).'
    },
    {
      id: 'tool',
      title: 'Automate a chore',
      prompt: 'Write a script that automates a chore I describe, with a dry run that changes 0 files.'
    },
    {
      id: 'tool',
      title: 'Make a command-line tool',
      prompt: 'Build a command-line tool for a job I describe, with --help and at least 2 subcommands.'
    }
  ],
  site: [
    {
      id: 'site',
      title: 'Build a landing page',
      prompt: 'Build a landing page for something I describe, with a headline, what it does, and at least 1 call to action.'
    },
    {
      id: 'site',
      title: 'Build a portfolio',
      prompt: 'Build a portfolio page for work I describe, with a short intro and at least 3 project cards.'
    },
    {
      id: 'site',
      title: 'Make a form that works',
      prompt: 'Build a form for something I describe, with at least 4 fields, inline validation and a clear success state.'
    }
  ],
  api: [
    {
      id: 'api',
      title: 'Build a small API',
      prompt: 'Build a small API for something I describe, with at least 3 endpoints and an example request for each.'
    },
    {
      id: 'api',
      title: 'Add an endpoint',
      prompt: 'Add an endpoint to my project and cover it with at least 2 tests.'
    },
    {
      id: 'api',
      title: 'Wrap a service',
      prompt: 'Wrap a service I name in a typed client with at least 3 methods and handled errors.'
    }
  ],
  docs: [
    {
      id: 'docs',
      title: 'Write a README',
      prompt: 'Write a README for this project with setup steps anyone can follow and at least 3 worked examples.'
    },
    {
      id: 'docs',
      title: 'Document a feature',
      prompt: 'Document a feature I describe, with a contents list linking to at least 4 sections.'
    },
    {
      id: 'docs',
      title: 'Explain this code',
      prompt: 'Walk me through how this project fits together, in at least 5 steps from entry file to output.'
    }
  ]
}

/** Every template, flattened, in kind order. Used by the templates modal. */
export function allStarterPrompts(): StarterPromptText[] {
  return STARTER_IDS.flatMap((id) => STARTER_POOL[id])
}

/** Longest trio group, so a full cycle shows every prompt those kinds hold. */
export const STARTER_ROTATION_LENGTH = Math.max(...TRIO_IDS.map((id) => STARTER_POOL[id].length))

/**
 * The three prompts to show, one per trio kind.
 *
 * `rotation` is any integer — a counter the caller persists across chats.
 * Negative and out-of-range values wrap rather than throwing, because a
 * corrupted counter in storage must not be able to blank the empty state.
 * Groups wrap independently, so the pool can grow one prompt at a time.
 */
export function starterTrio(rotation: number): StarterPromptText[] {
  const n = Number.isFinite(rotation) ? Math.trunc(rotation) : 0
  return TRIO_IDS.map((id) => {
    const group = STARTER_POOL[id]
    return group[((n % group.length) + group.length) % group.length]
  })
}
