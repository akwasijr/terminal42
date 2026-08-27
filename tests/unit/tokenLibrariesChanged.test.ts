import { describe, it, expect, vi } from 'vitest'
import { onTokenLibrariesChanged, tokenLibrariesChanged } from '../../src/renderer/src/lib/tokens/useTokenLibraries'

/**
 * Telling the rest of the app that the libraries have changed.
 *
 * The chat composer mounts once for a whole project session. Tokens is a
 * different screen, and a library made there minutes later used to be
 * invisible to the composer until the app restarted: the user would create a
 * library, go back to chat, open the picker, and not find the thing they had
 * just made. Nothing errored, which is what made it hard to see.
 */

describe('the library-changed signal', () => {
  it('reaches a listener', () => {
    const fn = vi.fn()
    const off = onTokenLibrariesChanged(fn)
    tokenLibrariesChanged()
    expect(fn).toHaveBeenCalledTimes(1)
    off()
  })

  it('reaches every listener, because more than one screen holds a list', () => {
    const a = vi.fn()
    const b = vi.fn()
    const offA = onTokenLibrariesChanged(a)
    const offB = onTokenLibrariesChanged(b)
    tokenLibrariesChanged()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    offA()
    offB()
  })

  it('stops reaching a screen that has gone', () => {
    const fn = vi.fn()
    onTokenLibrariesChanged(fn)()
    tokenLibrariesChanged()
    expect(fn).not.toHaveBeenCalled()
  })

  it('survives a listener that unsubscribes while being told', () => {
    // A screen closing in response to the change would do exactly this, and
    // iterating the live set would skip whatever followed it.
    const second = vi.fn()
    const offFirst = onTokenLibrariesChanged(() => offFirst())
    const offSecond = onTokenLibrariesChanged(second)
    expect(() => tokenLibrariesChanged()).not.toThrow()
    expect(second).toHaveBeenCalledTimes(1)
    offSecond()
  })

  it('is quiet when nothing is listening', () => {
    expect(() => tokenLibrariesChanged()).not.toThrow()
  })
})
