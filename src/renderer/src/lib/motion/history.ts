/**
 * Undo and redo for a motion piece.
 *
 * Motion had none. That is survivable in a panel of sliders — you can always
 * drag back — right up until an edit throws something away: clearing a track,
 * resetting a tab, applying a layout over the top of a piece you liked. Then
 * the only way back is to remember what it was.
 *
 * Snapshots rather than a command log, the same as the canvas next door
 * (FreeformCanvas keeps a stack of `{objects, artboards}` copies). A motion
 * document is small — parameters, a few layers, a keyframe map — so eighty of
 * them cost less than the bookkeeping a command log would need to invert every
 * edit correctly, and a snapshot cannot drift out of step with the thing it
 * describes.
 *
 * The hard part here is not the stack, it is *what counts as one step*. Every
 * control in Motion is a slider, so a single drag arrives as fifty patches. A
 * naive stack would make undo mean "go back one pixel", and getting out of a
 * drag would take fifty presses. So consecutive edits to the same value, close
 * together in time, collapse into one step: the snapshot taken before the drag
 * began is the one you land on.
 *
 * Which value an edit touched is worked out by comparing the two documents
 * rather than asked for at the call site. Threading a label through every
 * slider in the app would be forgotten exactly once and then the drag it was
 * forgotten on would be un-undoable, with nothing to show why.
 */

/** How long two edits to the same value stay one step. Roughly a pause. */
export const COALESCE_MS = 600

/** How far back you can go. The canvas keeps eighty; so does this. */
export const HISTORY_LIMIT = 80

export interface History<T> {
  present: T
  past: T[]
  future: T[]
  /** What the last recorded edit changed, for coalescing. */
  tag: string | null
  /** When it happened, in ms. */
  at: number
}

export function initialHistory<T>(present: T): History<T> {
  return { present, past: [], future: [], tag: null, at: 0 }
}

/**
 * What changed between two documents, as a dotted path.
 *
 * Two levels deep on purpose. One level would call every slider in the motion
 * tab "params" and collapse a drag of one into a drag of the next; going all
 * the way down would separate `pose.x` from `pose.y` and split a diagonal drag
 * of the pose pad into two undo steps, when it was plainly one gesture.
 *
 * Null when nothing changed, or when more than one thing did — a multi-part
 * edit is a deliberate act (an applied layout, a reset) and deserves its own
 * step rather than being folded into whatever came before it.
 */
export function changedPath(before: unknown, after: unknown): string | null {
  const top = changedKeys(before, after)
  if (top.length !== 1) return null
  const key = top[0]
  const b = (before as Record<string, unknown> | null)?.[key]
  const a = (after as Record<string, unknown> | null)?.[key]
  if (!isPlainObject(b) || !isPlainObject(a)) return key
  const inner = changedKeys(b, a)
  return inner.length === 1 ? `${key}.${inner[0]}` : key
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function changedKeys(before: unknown, after: unknown): string[] {
  if (!isPlainObject(before) || !isPlainObject(after)) return []
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const out: string[] = []
  for (const k of keys) if (!same(before[k], after[k])) out.push(k)
  return out
}

/**
 * Reference equality first, then a structural fallback.
 *
 * Motion patches are built with spreads, so the parts that did not change are
 * usually the same object and the cheap test answers. The fallback catches the
 * case that matters most: a slider rebuilding an object every frame with the
 * same numbers inside, which must not count as an edit at all or an undo stack
 * fills up with steps that do nothing.
 */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * Record an edit.
 *
 * Returns the history unchanged when the document did not actually change, so
 * that a control which re-emits its current value on mouse-up cannot leave a
 * dead step behind for the user to press undo on and see nothing happen.
 */
export function record<T>(h: History<T>, next: T, now: number): History<T> {
  if (h.present === next) return h
  const tag = changedPath(h.present, next)
  if (tag === null && changedKeys(h.present, next).length === 0) return h

  // Same value, still moving: keep the snapshot from before the drag started.
  const continues = tag !== null && tag === h.tag && now - h.at < COALESCE_MS
  if (continues) return { ...h, present: next, at: now }

  return {
    present: next,
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    future: [],
    tag,
    at: now
  }
}

/**
 * Record an edit that must stand alone.
 *
 * For the edits that are one act however long they took — applying a layout,
 * resetting a tab — where folding into a neighbouring drag would make undo
 * skip past the very thing you wanted back.
 */
export function commit<T>(h: History<T>, next: T, now: number): History<T> {
  if (h.present === next) return h
  return {
    present: next,
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    future: [],
    tag: null,
    at: now
  }
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0
}

/**
 * Step back.
 *
 * The tag is cleared on the way through so that the next edit cannot coalesce
 * into the step you just undid — pressing undo and then nudging a slider must
 * leave the undone step undone.
 */
export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h
  const present = h.past[h.past.length - 1]
  return {
    present,
    past: h.past.slice(0, -1),
    future: [h.present, ...h.future].slice(0, HISTORY_LIMIT),
    tag: null,
    at: 0
  }
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h
  const [present, ...rest] = h.future
  return {
    present,
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    future: rest,
    tag: null,
    at: 0
  }
}

/**
 * Whether a keystroke means undo, redo, or neither.
 *
 * Kept here rather than in the component so the shortcut is testable and so
 * both halves — Cmd+Shift+Z and Ctrl+Y — cannot drift apart. Matches what the
 * canvas already answers to.
 */
export function historyKey(e: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
}): 'undo' | 'redo' | null {
  if (!e.metaKey && !e.ctrlKey) return null
  const k = e.key.toLowerCase()
  if (k === 'z') return e.shiftKey ? 'redo' : 'undo'
  if (k === 'y') return 'redo'
  return null
}
