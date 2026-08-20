// The counter that decides which trio of starters an empty chat shows.
//
// Separate from the component so the advance-and-wrap behaviour can be tested
// without a DOM: a counter that never advances leaves most of the pool
// unreachable, which is a silent failure — the tiles still render, they are
// just always the same three.

export type RotationStore = Pick<Storage, 'getItem' | 'setItem'>

export const LS_STARTER_ROTATION = 't42:chat:starterRotation'

/**
 * Read the current rotation and advance the stored one.
 *
 * Returns 0 and stores nothing if storage is unavailable or unwritable
 * (private windows, quota) — showing the first trio forever is a far better
 * failure than an empty state that throws. A non-numeric or corrupted stored
 * value is treated as 0 for the same reason.
 */
export function readAndAdvanceRotation(store: RotationStore, cycle: number): number {
  let current = 0
  try {
    const raw = Number(store.getItem(LS_STARTER_ROTATION))
    if (Number.isFinite(raw)) current = Math.trunc(raw)
  } catch {
    return 0
  }
  try {
    store.setItem(LS_STARTER_ROTATION, String(nextRotation(current, cycle)))
  } catch {
    /* unwritable storage: the trio just won't rotate */
  }
  return current
}

/** The next counter value, kept inside [0, cycle) so it can't grow forever. */
export function nextRotation(current: number, cycle: number): number {
  if (!Number.isFinite(cycle) || cycle < 1) return 0
  const n = Number.isFinite(current) ? Math.trunc(current) : 0
  return (((n + 1) % cycle) + cycle) % cycle
}
