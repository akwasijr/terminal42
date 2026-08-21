// One plain-English line per tool call, for the Activity panel.
//
// The panel answers "what has it been doing", so the rows should read like an
// answer to that question — "Edited index.html", not `edit · {"path":"/Users/…`.
// Two problems to solve: tool names are jargon, and the stored arguments are
// raw JSON that is usually captured mid-string.
//
// Lives outside the component file so it can be tested directly and so the
// panel file exports only components.

/** The field of a tool's arguments that says what the call was about. */
const DETAIL_KEYS = ['command', 'path', 'file_path', 'filePath', 'pattern', 'query', 'url']

// Last resort. An edit's arguments lead with the text being replaced and the
// path can fall outside the captured prefix, so without this those rows would
// name no file at all. The first line of the replaced text at least names the
// thing that changed.
const SNIPPET_KEYS = ['old_str', 'new_str', 'file_text', 'content']

/**
 * How each tool is described, and what to say when it gave nothing to name.
 *
 * The verb is past tense because the row records something that happened. The
 * subject is only used when there is no detail, so a row never degrades into a
 * bare tool name.
 */
const TOOL_PHRASING: Record<string, { verb: string; subject: string }> = {
  bash: { verb: 'Ran', subject: 'a command' },
  shell: { verb: 'Ran', subject: 'a command' },
  create: { verb: 'Created', subject: 'a file' },
  write: { verb: 'Wrote', subject: 'a file' },
  edit: { verb: 'Edited', subject: 'a file' },
  str_replace: { verb: 'Edited', subject: 'a file' },
  view: { verb: 'Read', subject: 'a file' },
  read: { verb: 'Read', subject: 'a file' },
  grep: { verb: 'Searched for', subject: 'text' },
  glob: { verb: 'Looked for', subject: 'files' },
  sql: { verb: 'Queried', subject: 'the database' },
  fetch: { verb: 'Fetched', subject: 'a page' },
  web_fetch: { verb: 'Fetched', subject: 'a page' },
  web_search: { verb: 'Searched the web for', subject: 'something' },
  task: { verb: 'Delegated', subject: 'a task' }
}

/** An unknown tool still has to read as English: `read_file` → `Read file`. */
function fallbackPhrasing(name: string): { verb: string; subject: string } {
  const words = name.replace(/[_-]+/g, ' ').trim()
  return { verb: words.charAt(0).toUpperCase() + words.slice(1), subject: '' }
}

/**
 * An absolute path spends the whole row on directories the user already knows
 * they are in. The file name identifies it; its folder is kept too, because
 * "index.html" alone is ambiguous in a project with several. The full detail
 * stays in the row's tooltip.
 */
function shortenPath(detail: string): string {
  if (!detail.startsWith('/') || detail.includes(' ')) return detail
  const parts = detail.split('/').filter(Boolean)
  if (parts.length <= 2) return detail
  return parts.slice(-2).join('/')
}

function firstLine(text: string): string {
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (t) return t
  }
  return ''
}

/** Pull the meaningful argument out of a tool's raw, often truncated, JSON. */
function detailFrom(raw: string): string {
  if (!raw.startsWith('{')) return raw

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    for (const key of DETAIL_KEYS) {
      const v = parsed[key]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
  } catch {
    // Streamed arguments are usually captured mid-string, so the JSON does not
    // parse — but the useful field is normally complete before the cut, and a
    // row naming the edited file is worth more than one naming none.
    for (const key of DETAIL_KEYS) {
      const m = raw.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`))
      if (!m || !m[1].trim()) continue
      try { return JSON.parse(`"${m[1]}"`) as string } catch { return m[1] }
    }
  }

  for (const key of SNIPPET_KEYS) {
    const m = raw.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`))
    if (!m || !m[1].trim()) continue
    let text = m[1]
    try { text = JSON.parse(`"${m[1]}"`) as string } catch { text = m[1].replace(/\\n/g, '\n') }
    const line = firstLine(text)
    if (line) return line
  }

  return ''
}

export function activityLabel(tool: { name: string; input?: string; summary?: string }): string {
  const phrasing = TOOL_PHRASING[tool.name] ?? fallbackPhrasing(tool.name)
  let detail = detailFrom((tool.input ?? '').trim())
  if (!detail) detail = (tool.summary ?? '').trim()
  detail = shortenPath(detail).replace(/\s+/g, ' ').trim()

  if (!detail) return phrasing.subject ? `${phrasing.verb} ${phrasing.subject}` : phrasing.verb
  return `${phrasing.verb} ${detail.length > 52 ? detail.slice(0, 52) + '…' : detail}`
}
