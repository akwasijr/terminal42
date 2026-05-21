export type TerminalActions = {
  copy: () => void
  paste: () => void | Promise<void>
  clearLine: () => void
  clearScreen: () => void
  attachFile: () => void | Promise<void>
  attachImage: () => void | Promise<void>
  captureToBrain: () => void | Promise<void>
  getSelection: () => string
}

const registry = new Map<string, TerminalActions>()
const listeners = new Set<() => void>()

export function registerTerminalActions(sessionId: string, actions: TerminalActions): () => void {
  registry.set(sessionId, actions)
  listeners.forEach((l) => l())
  return () => {
    registry.delete(sessionId)
    listeners.forEach((l) => l())
  }
}

export function getTerminalActions(sessionId: string | null): TerminalActions | null {
  if (!sessionId) return null
  return registry.get(sessionId) ?? null
}

export function subscribeTerminalActions(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

// Selection-change notifications, separate channel so the menu can re-render
// without forcing a full action re-registration on every text selection.
const selectionListeners = new Set<() => void>()
export function notifyTerminalSelectionChanged(): void {
  selectionListeners.forEach((l) => l())
}
export function subscribeTerminalSelection(fn: () => void): () => void {
  selectionListeners.add(fn)
  return () => { selectionListeners.delete(fn) }
}
