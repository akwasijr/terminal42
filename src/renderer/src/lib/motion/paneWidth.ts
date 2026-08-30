// How wide you like your panels is a fact about you, not about the piece, so
// it lives in localStorage rather than in the document.

import { useCallback, useState } from 'react'

/**
 * Returns the size, a setter, and whether the size is one you chose.
 *
 * A pane that has never been dragged has no opinion of its own, so a caller
 * is free to size it to fit what is in it. Once you drag it, the stored value
 * is your answer and nothing should override it.
 */
export function useStoredWidth(
  key: string,
  initial: number,
  min: number,
  max: number
): [number, (n: number) => void, boolean] {
  const [chosen, setChosen] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false
    return Number.isFinite(Number(localStorage.getItem(key)))
      && localStorage.getItem(key) !== null
  })
  const [width, setWidth] = useState<number>(() => {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
    const n = raw === null ? NaN : Number(raw)
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : initial
  })
  const set = useCallback((n: number): void => {
    const clamped = Math.min(max, Math.max(min, n))
    setWidth(clamped)
    setChosen(true)
    try { localStorage.setItem(key, String(clamped)) } catch { /* private mode */ }
  }, [key, min, max])
  return [width, set, chosen]
}
