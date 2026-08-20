// One readable line per tool call, for the Activity panel.
//
// Lives outside the component file so it can be tested directly and so the
// panel file exports only components.

/**
 * A tool call as one readable line.
 *
 * The raw input is the tool's JSON arguments, which is unreadable in a narrow
 * panel — `bash · {"command":"find /Users/akwasi` helps nobody. Pull out the
 * one field that says what the call was actually about, and fall back to the
 * plain text for tools whose input is not JSON.
 */
const DETAIL_KEYS = ['command', 'path', 'file_path', 'filePath', 'pattern', 'query', 'url']

// Last resort. An edit's arguments lead with the text being replaced and the
// path can fall outside the captured prefix, so without this those rows say
// only `edit`. The first line of the replaced text at least names the thing
// that changed.
const SNIPPET_KEYS = ['old_str', 'new_str', 'file_text', 'content']

/**
 * An absolute path spends the whole row on directories the user already knows
 * they are in. The last two segments say which file, and where in the project,
 * which is all the row has space to say. The full path stays in the tooltip.
 */
function shortenPath(detail: string): string {
  if (!detail.startsWith('/') || detail.includes(' ')) return detail
  const parts = detail.split('/').filter(Boolean)
  if (parts.length <= 2) return detail
  return `…/${parts.slice(-2).join('/')}`
}

function firstLine(text: string): string {
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (t) return t
  }
  return ''
}

export function activityLabel(tool: { name: string; input?: string; summary?: string }): string {
  const raw = (tool.input ?? '').trim()
  let detail = ''
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      for (const key of DETAIL_KEYS) {
        const v = parsed[key]
        if (typeof v === 'string' && v.trim()) { detail = v.trim(); break }
      }
    } catch {
      // Streamed arguments are often captured mid-string, so the JSON does not
      // parse — but the useful field is usually complete before the cut, and a
      // row saying which file was edited is worth more than one saying `edit`.
      for (const key of DETAIL_KEYS) {
        const m = raw.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`))
        if (m && m[1].trim()) {
          try { detail = JSON.parse(`"${m[1]}"`) as string } catch { detail = m[1] }
          break
        }
      }
    }
  } else {
    detail = raw
  }
  if (!detail && raw.startsWith('{')) {
    for (const key of SNIPPET_KEYS) {
      const m = raw.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`))
      if (!m || !m[1].trim()) continue
      let text = m[1]
      try { text = JSON.parse(`"${m[1]}"`) as string } catch { text = m[1].replace(/\\n/g, '\n') }
      detail = firstLine(text)
      if (detail) break
    }
  }
  if (!detail) detail = (tool.summary ?? '').trim()
  detail = shortenPath(detail).replace(/\s+/g, ' ')
  if (!detail) return tool.name
  return `${tool.name} · ${detail.length > 60 ? detail.slice(0, 60) + '…' : detail}`
}
