// The latch exists because an event fired before the listener mounts is heard
// by nobody — which is exactly what happened the first time the library screen
// was wired with an event alone. These are the two promises it makes: a
// request survives until somebody arrives to take it, and it is answered only
// once, so nobody gets dragged back to the library every time they leave.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  requestTokens, takeTokensRequest, requestNewTokens, takeNewTokensRequest
} from '../../src/renderer/src/lib/tokens/openLatch'

beforeEach(() => {
  takeTokensRequest()
  takeNewTokensRequest()
})

describe('the tokens open latch', () => {
  it('says nothing when nobody asked', () => {
    expect(takeTokensRequest()).toBe(false)
    expect(takeNewTokensRequest()).toBe(false)
  })

  it('holds a request until it is taken, then forgets it', () => {
    requestTokens()
    expect(takeTokensRequest()).toBe(true)
    expect(takeTokensRequest()).toBe(false)
  })

  it('treats "new" as a request to open the library as well', () => {
    requestNewTokens()
    expect(takeTokensRequest()).toBe(true)
    expect(takeNewTokensRequest()).toBe(true)
  })

  // Getting to the library and getting there with the setup open are separate
  // intents. Asking for the first must never spring the second.
  it('does not open the setup for a plain open request', () => {
    requestTokens()
    expect(takeNewTokensRequest()).toBe(false)
    expect(takeTokensRequest()).toBe(true)
  })
})
