export type PromptCacheRole = 'system' | 'user' | 'assistant' | 'tool'

export type PromptCacheMessage = Readonly<{
  role: PromptCacheRole
  content: string
  name?: string
}>

export type PromptCacheCompaction = Readonly<{
  maxHistoryMessages: number
  chunkSize: number
  summaryMessage?: PromptCacheMessage
}>

export type PromptCacheAssembly = Readonly<{
  stablePrefix: readonly PromptCacheMessage[]
  history: readonly PromptCacheMessage[]
  currentTurn?: PromptCacheMessage
  volatileMessages?: readonly PromptCacheMessage[]
  compaction?: PromptCacheCompaction
}>

function copyMessages(messages: readonly PromptCacheMessage[]): PromptCacheMessage[] {
  return messages.map((m) => ({ ...m }))
}

function compactHistory(
  history: readonly PromptCacheMessage[],
  compaction: PromptCacheCompaction | undefined
): PromptCacheMessage[] {
  if (!compaction || history.length <= compaction.maxHistoryMessages) return copyMessages(history)

  const summarySlots = compaction.summaryMessage ? 1 : 0
  const keepCount = Math.max(0, compaction.maxHistoryMessages - summarySlots)
  const overflow = history.length - keepCount
  const chunkSize = Math.max(1, compaction.chunkSize)
  const dropCount = Math.min(history.length, Math.ceil(overflow / chunkSize) * chunkSize)
  const kept = copyMessages(history.slice(dropCount))

  return compaction.summaryMessage ? [{ ...compaction.summaryMessage }, ...kept] : kept
}

export function assembleCacheStableMessages(input: PromptCacheAssembly): PromptCacheMessage[] {
  const messages = [
    ...copyMessages(input.stablePrefix),
    ...compactHistory(input.history, input.compaction)
  ]

  if (input.currentTurn) messages.push({ ...input.currentTurn })

  // Volatile reminders belong at the suffix because every byte after their
  // change becomes cold for provider prefix caching.
  if (input.volatileMessages) messages.push(...copyMessages(input.volatileMessages))

  return messages
}

export function appendTurn(
  history: readonly PromptCacheMessage[],
  turn: PromptCacheMessage
): PromptCacheMessage[] {
  return [...copyMessages(history), { ...turn }]
}

export function sharedPrefixLength(
  previous: readonly PromptCacheMessage[],
  next: readonly PromptCacheMessage[]
): number {
  const limit = Math.min(previous.length, next.length)
  for (let i = 0; i < limit; i++) {
    if (!sameMessage(previous[i], next[i])) return i
  }
  return limit
}

export function flattenPromptCacheMessages(messages: readonly PromptCacheMessage[]): string {
  return messages
    .map((m) => m.content.trim())
    .filter((content) => content.length > 0)
    .join('\n\n')
}

function sameMessage(a: PromptCacheMessage, b: PromptCacheMessage): boolean {
  return a.role === b.role && a.content === b.content && a.name === b.name
}
