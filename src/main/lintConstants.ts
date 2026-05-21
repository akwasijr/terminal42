// Shared list of forbidden AI-default purple/indigo/blue hex values.
// Imported by both buildPrefix (prompt) and lintHtml (post-gen scan)
// so the prompt and the linter stay in sync.
export const FORBIDDEN_HEX_FOR_LINT = [
  '#5b47fb',
  '#7c3aed',
  '#8b5cf6',
  '#6366f1',
  '#a855f7',
  '#9333ea',
  '#3b82f6',
  '#2563eb',
]
