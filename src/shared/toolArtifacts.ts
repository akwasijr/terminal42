// Working out which files a turn wrote, from the tool calls themselves.
//
// The alternative is to diff the working tree before and after, which is what
// the undo snapshot does. That is the right mechanism for undo — it catches
// writes from any source, including a shell command — but it is the wrong one
// for deciding what to show the user: it costs a full tree hash, and in a
// large folder that arrives minutes late or not at all.
//
// The tool calls say exactly which path was written, immediately, at zero
// cost. So the preview reads from here, and undo keeps its snapshot.

/**
 * Tools that write the file named by their `path` argument.
 *
 * Read tools are deliberately absent: opening an HTML file to look at it must
 * not pop a preview of it. `bash` is absent too — a shell command can write
 * anything, but its arguments name a command, not a path, and guessing which
 * files a command touched from its text would be wrong often enough to be
 * worse than not guessing.
 */
const WRITE_TOOLS = new Set([
  'create',
  'write',
  'write_file',
  'edit',
  'edit_file',
  'multi_edit',
  'str_replace',
  'str_replace_editor',
  'apply_patch'
])

/** Keys a write tool might use for its target, in order of preference. */
const PATH_KEYS = ['path', 'file_path', 'filePath', 'filename', 'file']

/**
 * The file a tool call wrote, or null if it wrote nothing identifiable.
 *
 * `args` is whatever the CLI put in the event's `arguments` field, so it is
 * unknown-shaped by definition and every access is guarded: a malformed event
 * must not be able to break a turn.
 */
export function writtenPathFrom(toolName: string, args: unknown): string | null {
  if (!toolName || !WRITE_TOOLS.has(toolName.toLowerCase())) return null
  if (!args || typeof args !== 'object' || Array.isArray(args)) return null
  const record = args as Record<string, unknown>
  for (const key of PATH_KEYS) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

/**
 * Parse the `arguments` field of a tool event, whether it arrives as an
 * object or as JSON text.
 *
 * Older event shapes used `input`, so that is accepted as a fallback. Returns
 * null rather than throwing on anything unparseable.
 */
export function toolArgumentsOf(data: Record<string, unknown> | null | undefined): unknown {
  if (!data) return null
  const raw = data.arguments ?? data.input
  if (raw == null) return null
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return null }
  }
  return raw
}
