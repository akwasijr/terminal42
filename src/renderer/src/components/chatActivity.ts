// Wording for the collapsed activity row above an assistant message.
//
// Split out of ChatBubbles because these are pure functions, not components:
// keeping them in a .tsx file breaks React Fast Refresh for the whole module
// and makes them awkward to test.

export type ChatToolGroup = { name: string; status: 'running' | 'done' | 'error'; count: number }

/**
 * Short label for the collapsed activity row.
 *
 * Names what the turn actually did rather than how long it took: "Ran 3
 * commands" tells you whether it's worth expanding, "Worked for 12s" doesn't.
 * Elapsed time moves to the tooltip. When a turn spans several kinds of work
 * the largest group wins, since the row has to stay on one line.
 */
export function chatActivityLabel(tools: ChatToolGroup[]): string | null {
  if (tools.length === 0) return null
  const dominant = tools.reduce((best, t) => (t.count > best.count ? t : best), tools[0])
  const phrase = describeChatToolGroup(dominant)
  const others = tools.length - 1
  const label = phrase[0].toUpperCase() + phrase.slice(1)
  return others > 0 ? `${label} +${others} more` : label
}

export function describeChatToolGroup(t: ChatToolGroup): string {
  const n = t.name.toLowerCase()
  const plural = (word: string): string => `${t.count} ${word}${t.count === 1 ? '' : 's'}`
  if (n === 'view' || n === 'read' || n === 'read_file' || n.includes('view')) return `read ${plural('file')}`
  if (n === 'edit' || n === 'edit_file' || n.startsWith('apply_patch')) return `made ${plural('edit')}`
  if (n === 'create' || n === 'write' || n === 'write_file') return `created ${plural('file')}`
  if (n === 'bash' || n === 'shell' || n.includes('exec')) return `ran ${plural('command')}`
  if (n.includes('grep') || n.includes('search') || n.includes('rg')) return `searched ${plural('time')}`
  if (n.includes('glob') || n.includes('list')) return 'listed files'
  if (n.startsWith('figma-')) return `called Figma${t.count > 1 ? ` ×${t.count}` : ''}`
  return `used ${t.name}${t.count > 1 ? ` ×${t.count}` : ''}`
}

/** Full sentence shown when the activity row is expanded. */
export function summarizeChatTools(tools: ChatToolGroup[]): string {
  const verbs = tools.map(describeChatToolGroup)
  if (verbs.length === 0) return 'No tool activity recorded.'
  if (verbs.length === 1) return verbs[0][0].toUpperCase() + verbs[0].slice(1) + '.'
  const last = verbs.pop()!
  const head = verbs.join(', ')
  return head[0].toUpperCase() + head.slice(1) + `, and ${last}.`
}
