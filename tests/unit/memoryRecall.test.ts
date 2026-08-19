import { describe, expect, it } from 'vitest'
import {
  Bm25MemoryScorer,
  chunkMarkdown,
  planIndexUpdate,
  recallFromChunks,
  termCounts,
  type IndexedMemoryChunk,
  type MemoryChunk
} from '../../src/main/memoryRecall'

function indexed(chunks: MemoryChunk[]): IndexedMemoryChunk[] {
  return chunks.map((chunk) => ({
    ...chunk,
    tokenCount: Array.from(termCounts(chunk.text).values()).reduce((sum, count) => sum + count, 0)
  }))
}

describe('chunkMarkdown', () => {
  it('keeps content before the first heading addressable', () => {
    const chunks = chunkMarkdown('me', 'Remember the launch checklist.\n\n# Work\nShip Terminal42.')
    expect(chunks.map((chunk) => chunk.heading)).toEqual(['Preamble', 'Work'])
    expect(chunks[0]).toMatchObject({ personaId: 'me', headingPath: [], level: 0 })
    expect(chunks[0].text).toContain('Remember the launch checklist')
  })

  it('uses every markdown heading as a chunk boundary', () => {
    const chunks = chunkMarkdown(
      'engineer',
      '# Engineering\nUse TypeScript.\n\n## Testing\nRun vitest.\n\n### Unit tests\nKeep pure logic isolated.\n\n## Releases\nTag builds.'
    )

    expect(chunks.map((chunk) => chunk.heading)).toEqual(['Engineering', 'Testing', 'Unit tests', 'Releases'])
    expect(chunks.map((chunk) => chunk.headingPath)).toEqual([
      ['Engineering'],
      ['Engineering', 'Testing'],
      ['Engineering', 'Testing', 'Unit tests'],
      ['Engineering', 'Releases']
    ])
    expect(chunks[1].text).not.toContain('Keep pure logic isolated')
  })

  it('returns no chunks for empty markdown', () => {
    expect(chunkMarkdown('pm', ' \n\n')).toEqual([])
  })
})

describe('BM25 recall', () => {
  it('ranks the strongest matching chunk first', () => {
    const chunks = indexed(
      chunkMarkdown(
        'engineer',
        '## Database\nPersist memory recall in SQLite with chunk hashes and term counts.\n\n## Design\nUse accessible cards and calm spacing.'
      )
    )

    const results = recallFromChunks('Where is memory recall persisted with chunk hashes?', chunks, {
      minScore: 0.1
    })

    expect(results[0].chunk.heading).toBe('Database')
    expect(results[0].citation).toBe('engineer / Database')
  })

  it('returns nothing when the query has no relevant lexical overlap', () => {
    const chunks = indexed(chunkMarkdown('researcher', '## Papers\nTrack transformer inference benchmarks.'))

    expect(recallFromChunks('sourdough hydration schedule', chunks)).toEqual([])
  })

  it('produces stable ranking for the same input', () => {
    const chunks = indexed(
      chunkMarkdown(
        'pm',
        '## Roadmap\nPrioritize onboarding activation and weekly retention.\n\n## Metrics\nActivation is measured by first successful terminal session.'
      )
    )
    const scorer = new Bm25MemoryScorer()

    const first = recallFromChunks('activation terminal session', chunks, { scorer, minScore: 0.1 })
    for (let i = 0; i < 10; i++) {
      expect(recallFromChunks('activation terminal session', chunks, { scorer, minScore: 0.1 })).toEqual(first)
    }
  })
})

describe('planIndexUpdate', () => {
  it('reprocesses only the edited chunk', () => {
    const before = chunkMarkdown(
      'designer',
      '## Buttons\nPrimary buttons use clear verb labels.\n\n## Forms\nEvery input needs a visible label.\n\n## Motion\nTransitions stay under 300ms.'
    )
    const after = chunkMarkdown(
      'designer',
      '## Buttons\nPrimary buttons use clear verb labels.\n\n## Forms\nEvery input needs a visible label and an error recovery hint.\n\n## Motion\nTransitions stay under 300ms.'
    )

    const plan = planIndexUpdate(before, after)

    expect(plan.toUpsert.map((chunk) => chunk.heading)).toEqual(['Forms'])
    expect(plan.unchanged.map((chunk) => chunk.heading)).toEqual(['Buttons', 'Motion'])
    expect(plan.toDelete).toEqual([])
  })
})
