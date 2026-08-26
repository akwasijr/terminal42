// How wide you like your panels is a fact about you, not about the piece, so
// it lives in localStorage rather than in the document.

import { useCallback, useState } from 'react'

export function useStoredWidth(
  key: string,
  initial: number,
  min: number,
  max: number
): [number, (n: number) => void] {
  const [width, setWidth] = useState<number>(() => {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
    const n = raw === null ? NaN : Number(raw)
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : initial
  })
  const set = useCallback((n: number): void => {
    const clamped = Math.min(max, Math.max(min, n))
    setWidth(clamped)
    try { localStorage.setItem(key, String(clamped)) } catch { /* private mode */ }
  }, [key, min, max])
  return [width, set]
}
