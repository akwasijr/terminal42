// The three prompts offered on an empty chat.
//
// Text lives here rather than beside the artwork so it can be tested. These
// are the first thing a new user ever sends, and the harness scores every goal
// for hill-climbability — a starter that trips its own "this goal may be hard
// to measure" hint teaches people that the warning is noise to dismiss. So the
// wording is held to the same bar the harness asks of the user: a stated
// target, and a named way to check it.

export type StarterPromptText = {
  id: string
  title: string
  prompt: string
}

export const STARTER_PROMPT_TEXTS: StarterPromptText[] = [
  {
    id: 'orient',
    title: 'Map this codebase',
    prompt:
      'Give me a tour of this codebase, verified by opening every file you cite: what it does, how the pieces fit together, and the three files I should read first. Success is 100% of cited paths existing, 0 invented file names.'
  },
  {
    id: 'measure',
    title: 'Set a target to beat',
    prompt:
      'Find the slowest part of this project, measure it with a repeatable benchmark, and report the current number. Then make it at least 20% faster and prove it by re-running the same benchmark.'
  },
  {
    id: 'ship',
    title: 'Build a page from a brief',
    prompt:
      'Build a landing page for this project using semantic HTML and CSS custom properties for every colour and spacing value. Follow my design rules, then list what you would check before shipping it.'
  }
]
