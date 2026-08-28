import { useEffect, useRef } from 'react'

/**
 * Space starts and stops playback.
 *
 * It is the one shortcut every timeline in every editing tool agrees on, and
 * it was in Form's timeline and not in Motion's — so the same key did the same
 * job in one half of the app and nothing in the other. This is the single
 * implementation both of them use, so they cannot drift again.
 *
 * Three things it deliberately does not do:
 *
 * - It ignores auto-repeat, or holding Space would toggle playback forty times
 *   a second.
 * - It ignores a field, where Space is a space.
 * - It calls preventDefault, which stops the page scrolling and also stops a
 *   focused button being activated by the same press. Without that, pressing
 *   Space while the play button has focus toggles twice and appears to do
 *   nothing at all.
 *
 * @param toggle What to do. Read through a ref, so a caller may pass a fresh
 *   closure on every render without rebinding the listener.
 * @param enabled Whether the shortcut is live. False detaches it entirely,
 *   for when something modal is over the timeline.
 */
export function useSpaceToPlay(toggle: () => void, enabled = true): void {
  const ref = useRef(toggle)
  ref.current = toggle

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.code !== 'Space' || e.repeat) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const n = e.target as HTMLElement | null
      if (n && (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable)) return
      e.preventDefault()
      ref.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
