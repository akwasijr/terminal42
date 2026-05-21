// Mode auto-categorizer for Automations (skills + recipes).
// Simple keyword matching on title + body: no LLM. Returns one mode.

export const MODES = [
  'UX design',
  'UX research',
  'Product',
  'Dev',
  'Productivity',
  'Docs & comms',
  'Misc'
] as const

export type Mode = (typeof MODES)[number]

// Kept as alias for back-compat with imports during the rename.
export const CATEGORIES = MODES
export type Category = Mode

const RULES: Array<{ mode: Mode; keywords: RegExp }> = [
  { mode: 'UX design', keywords: /\b(ux\s*design|ui|wireframe|mockup|figma|prototype|design\s*system|component|tokens?|spacing|typography|accessibility|a11y|contrast|critique|visual)\b/i },
  { mode: 'UX research', keywords: /\b(ux\s*research|research|interview|user\s*test|usability|survey|persona|insight|jobs[- ]to[- ]be[- ]done|jtbd|study|recruit|note[- ]?taking|synthes[ie]s)\b/i },
  { mode: 'Product', keywords: /\b(product|pm|roadmap|prd|spec|requirements?|feature|stakeholder|launch|metric|north\s*star|okr|kpi|strategy|positioning|backlog)\b/i },
  { mode: 'Dev', keywords: /\b(refactor|bug|fix|hotfix|test|lint|format|review|pr|pull\s*request|diff|build|deploy|release|tag|changelog|migrate|migration|debug|stack[- ]?trace|api|endpoint|schema|sql|regex|code|clip)\b/i },
  { mode: 'Productivity', keywords: /\b(standup|status|daily|weekly|recap|digest|inbox|email|calendar|meeting|todo|task|focus|plan|prioriti[sz]e|summari[sz]e|note)\b/i },
  { mode: 'Docs & comms', keywords: /\b(doc|readme|guide|tutorial|slack|message|comm|announce|post|blog|tweet|thread|copy|tone|style\s*guide|writeup|write[- ]up)\b/i }
]

export function categorize(title: string, body?: string): Mode {
  const haystack = `${title} ${body ?? ''}`
  for (const rule of RULES) {
    if (rule.keywords.test(haystack)) return rule.mode
  }
  return 'Misc'
}
