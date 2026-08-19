import { describe, expect, it } from 'vitest'
import {
  buildMemoryContext,
  MEMORY_CONTEXT_TOKEN_BUDGET,
  type MemoryContextResult,
  type RecallMemoryDependency
} from '../../src/main/memoryContext'
import type { MemoryChunk, MemoryRecallResult } from '../../src/main/memoryRecall'

function chunk(id: string, text: string, heading = id): MemoryChunk {
  return {
    id,
    personaId: 'brain',
    heading,
    headingPath: [heading],
    level: 2,
    ordinal: 0,
    text,
    contentHash: id
  }
}

function result(id: string, score: number, text: string, heading = id): MemoryRecallResult {
  const memoryChunk = chunk(id, text, heading)
  return { chunk: memoryChunk, score, citation: `stale / ${heading}` }
}

function buildWith(results: readonly MemoryRecallResult[], message = 'How should I deploy postgres backups?'): MemoryContextResult {
  return buildMemoryContext(message, { recallResults: results })
}

describe('buildMemoryContext', () => {
  it('exports a tunable token budget', () => {
    expect(MEMORY_CONTEXT_TOKEN_BUDGET).toBeGreaterThan(0)
  })

  it('rejects weak lexical hits below the relevance floor', () => {
    const context = buildWith([
      result('weak-top', 12, 'Deploy notes mention rolling restarts.', 'Deploy'),
      result('weak-peer', 10, 'Use blue green deployment for frontend releases.', 'Frontend')
    ])

    expect(context.block).toBeNull()
    expect(context.used).toEqual([])
    expect(context.skipped).toBe(2)
    expect(context.reason).toMatch(/relevance floor/u)
  })

  it('truncates at a paragraph boundary when the budget is full', () => {
    const firstParagraph = 'Postgres backups run every night and deploy checks must verify the latest snapshot.'
    const secondParagraph = 'This paragraph should not fit inside the intentionally small context budget.'
    const context = buildMemoryContext('deploy postgres backups snapshot', {
      recallResults: [result('db', 8, `${firstParagraph}\n\n${secondParagraph}`, 'Database')],
      tokenBudget: 95
    })

    expect(context.block).toContain(firstParagraph)
    expect(context.block).not.toContain(secondParagraph)
    expect(context.used[0].includedText).toBe(firstParagraph)
  })

  it('deduplicates overlapping chunks from the same recalled region', () => {
    const shared = 'Postgres deploy backups require checking the nightly snapshot before migrations.'
    const context = buildWith([
      result('a', 9, shared, 'Database'),
      result('b', 8, `${shared}\n\nExtra overlapping detail.`, 'Database duplicate')
    ])

    expect(context.used).toHaveLength(1)
    expect(context.block?.match(/Postgres deploy backups/u)).toHaveLength(1)
    expect(context.skipped).toBe(1)
  })

  it('returns a null block for empty recall results', () => {
    const context = buildWith([])

    expect(context).toMatchObject({ block: null, used: [], skipped: 0 })
    expect(context.reason).toMatch(/no recall results/u)
  })

  it('returns a null block when the injected recall dependency throws', () => {
    const throwingRecall: RecallMemoryDependency = () => {
      throw new Error('sqlite unavailable')
    }

    const context = buildMemoryContext('deploy postgres backups', { recall: throwingRecall })

    expect(context).toMatchObject({ block: null, used: [], skipped: 0 })
    expect(context.reason).toMatch(/failed/u)
  })

  it('uses formatCitation attribution instead of trusting stale recall citation text', () => {
    const context = buildWith([result('strong', 7, 'Deploy postgres backups from verified snapshots.', 'Runbook')])

    expect(context.block).toContain('[1] brain / Runbook')
    expect(context.block).not.toContain('stale / Runbook')
  })
})
