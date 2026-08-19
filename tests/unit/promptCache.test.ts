import { describe, expect, it } from 'vitest'
import {
  appendTurn,
  assembleCacheStableMessages,
  flattenPromptCacheMessages,
  sharedPrefixLength,
  type PromptCacheMessage
} from '../../src/shared/promptCache'

const stable: PromptCacheMessage[] = [{ role: 'system', content: 'Stable operating instructions.' }]

function user(content: string): PromptCacheMessage {
  return { role: 'user', content }
}

function assistant(content: string): PromptCacheMessage {
  return { role: 'assistant', content }
}

function timestamp(n: number): PromptCacheMessage {
  return { role: 'system', content: `Current time: 2026-08-19T18:08:0${n}.000Z` }
}

describe('prompt cache assembly', () => {
  it('grows the shared prefix monotonically across successive turns', () => {
    let history: PromptCacheMessage[] = []
    let previous: PromptCacheMessage[] | null = null
    const prefixes: number[] = []
    const volatileBeforeHistoryPrefixes: number[] = []
    let previousVolatileBeforeHistory: PromptCacheMessage[] | null = null

    for (let i = 1; i <= 4; i++) {
      const current = user(`Question ${i}`)
      const next = assembleCacheStableMessages({
        stablePrefix: stable,
        history,
        currentTurn: current,
        volatileMessages: [timestamp(i)]
      })
      const volatileBeforeHistory = [...stable, timestamp(i), ...history, current]

      if (previous) prefixes.push(sharedPrefixLength(previous, next))
      if (previousVolatileBeforeHistory) {
        volatileBeforeHistoryPrefixes.push(
          sharedPrefixLength(previousVolatileBeforeHistory, volatileBeforeHistory)
        )
      }

      history = appendTurn(appendTurn(history, current), assistant(`Answer ${i}`))
      previous = next
      previousVolatileBeforeHistory = volatileBeforeHistory
    }

    expect(prefixes).toEqual([2, 4, 6])
    expect(volatileBeforeHistoryPrefixes).toEqual([1, 1, 1])
  })

  it('keeps changing volatile content out of the reusable prefix', () => {
    const history = [user('Explain cache warming'), assistant('Use an append-only prefix.')]
    const currentTurn = user('Now apply it here.')
    const first = assembleCacheStableMessages({
      stablePrefix: stable,
      history,
      currentTurn,
      volatileMessages: [timestamp(1)]
    })
    const second = assembleCacheStableMessages({
      stablePrefix: stable,
      history,
      currentTurn,
      volatileMessages: [timestamp(2)]
    })

    expect(sharedPrefixLength(first, second)).toBe(first.length - 1)
  })

  it('appends a turn without rewriting the previous history', () => {
    const history = [user('First'), assistant('Second')]
    const next = appendTurn(history, user('Third'))

    expect(sharedPrefixLength(history, next)).toBe(history.length)
  })

  it('only shrinks the prefix when compaction removes a history chunk', () => {
    const history = [
      user('u1'),
      assistant('a1'),
      user('u2'),
      assistant('a2'),
      user('u3'),
      assistant('a3'),
      user('u4')
    ]
    const before = assembleCacheStableMessages({
      stablePrefix: stable,
      history,
      currentTurn: assistant('draft')
    })
    const afterAppend = assembleCacheStableMessages({
      stablePrefix: stable,
      history: appendTurn(history, assistant('a4')),
      currentTurn: user('u5')
    })
    const afterCompact = assembleCacheStableMessages({
      stablePrefix: stable,
      history: appendTurn(history, assistant('a4')),
      currentTurn: user('u5'),
      compaction: {
        maxHistoryMessages: 6,
        chunkSize: 4,
        summaryMessage: { role: 'system', content: 'Earlier turns compacted.' }
      }
    })

    expect(sharedPrefixLength(before, afterAppend)).toBe(before.length - 1)
    expect(sharedPrefixLength(before, afterCompact)).toBe(1)
    expect(afterCompact).toEqual([
      stable[0],
      { role: 'system', content: 'Earlier turns compacted.' },
      user('u3'),
      assistant('a3'),
      user('u4'),
      assistant('a4'),
      user('u5')
    ])
  })
})

describe('chat prompt assembly contract', () => {
  // chat.ts flattens the assembly into a single --prompt string. In that shape
  // there are no message boundaries for a provider to cache against, so the
  // only thing ordering buys is a stable prefix -- and putting anything after
  // the user's text makes it read as trailing instructions instead of framing.
  it('keeps the user text last when volatile content is stable-prefixed', () => {
    const prompt = flattenPromptCacheMessages(
      assembleCacheStableMessages({
        stablePrefix: [
          { role: 'system', content: 'MODE' },
          { role: 'system', content: 'FIGMA' },
          { role: 'system', content: 'PREFIX' }
        ],
        history: [],
        currentTurn: { role: 'user', content: 'USER TEXT' }
      })
    )
    expect(prompt).toBe('MODE\n\nFIGMA\n\nPREFIX\n\nUSER TEXT')
    expect(prompt.endsWith('USER TEXT')).toBe(true)
  })

  it('grows only at the end as optional prefixes appear', () => {
    const base = flattenPromptCacheMessages(
      assembleCacheStableMessages({
        stablePrefix: [{ role: 'system', content: 'MODE' }],
        history: [],
        currentTurn: { role: 'user', content: 'HI' }
      })
    )
    expect(base.startsWith('MODE')).toBe(true)
  })
})
