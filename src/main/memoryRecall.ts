import type Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { getDb } from './db'

export type MemoryChunk = {
  id: string
  personaId: string
  heading: string
  headingPath: string[]
  level: number
  ordinal: number
  text: string
  contentHash: string
}

export type IndexedMemoryChunk = MemoryChunk & {
  tokenCount: number
  terms?: ReadonlyMap<string, number>
}

export type MemoryRecallResult = {
  chunk: MemoryChunk
  score: number
  citation: string
}

export type MemoryRecallOptions = {
  limit?: number
  minScore?: number
  personaIds?: string[]
  scorer?: MemoryScorer
}

export type MemoryScorer = {
  score(query: string, chunks: readonly IndexedMemoryChunk[]): MemoryRecallResult[]
}

export type IndexUpdatePlan = {
  next: MemoryChunk[]
  toUpsert: MemoryChunk[]
  toDelete: string[]
  unchanged: MemoryChunk[]
}

export type MemoryIndexStats = {
  personaId: string
  total: number
  upserted: number
  deleted: number
  unchanged: number
}

type HeadingFrame = {
  level: number
  title: string
}

type ChunkDraft = {
  heading: string
  headingPath: string[]
  level: number
  text: string
}

type ChunkRow = {
  id: string
  persona_id: string
  heading: string
  heading_path: string
  level: number
  ordinal: number
  text: string
  content_hash: string
  token_count: number
}

type TermRow = {
  chunk_id: string
  term: string
  count: number
}

const DEFAULT_LIMIT = 5
const DEFAULT_MIN_SCORE = 1.2
const TOKEN_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}'_-]*/gu
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'have',
  'i',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'was',
  'were',
  'with',
  'you',
  'your'
])

export function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

export function tokenize(text: string): string[] {
  const tokens: string[] = []
  for (const match of text.toLocaleLowerCase().matchAll(TOKEN_PATTERN)) {
    const token = match[0].replace(/^['_-]+|['_-]+$/g, '')
    if (token.length < 2 || STOP_WORDS.has(token)) continue
    tokens.push(token)
  }
  return tokens
}

export function termCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) ?? 0) + 1)
  }
  return counts
}

function slugPart(text: string): string {
  const slug = tokenize(text).slice(0, 8).join('-')
  return slug || hashText(text).slice(0, 8)
}

function buildChunkId(personaId: string, headingPath: readonly string[], ordinal: number): string {
  const path = headingPath.length ? headingPath.map(slugPart).join('/') : 'preamble'
  return `${personaId}:${path}:${ordinal}`
}

function normaliseHeading(raw: string): string {
  return raw.replace(/\s+#+\s*$/u, '').trim()
}

function chunkText(heading: string, bodyLines: readonly string[]): string {
  const body = bodyLines.join('\n').trim()
  return body ? `${heading}\n${body}` : heading
}

export function chunkMarkdown(personaId: string, markdown: string): MemoryChunk[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const drafts: ChunkDraft[] = []
  const stack: HeadingFrame[] = []
  let currentHeading = 'Preamble'
  let currentLevel = 0
  let currentPath: string[] = []
  let currentBody: string[] = []
  let hasCurrent = false
  let hasHeading = false

  const flush = (): void => {
    if (!hasHeading && !currentBody.join('\n').trim()) return
    const text = chunkText(currentHeading, currentBody)
    if (!hasCurrent && !text.trim()) return
    if (!text.trim()) return
    drafts.push({ heading: currentHeading, headingPath: currentPath, level: currentLevel, text })
  }

  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.+?)\s*$/u.exec(line)
    if (headingMatch) {
      flush()
      const level = headingMatch[1].length
      const title = normaliseHeading(headingMatch[2])
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
      stack.push({ level, title })
      currentHeading = title
      currentLevel = level
      currentPath = stack.map((frame) => frame.title)
      currentBody = []
      hasCurrent = true
      hasHeading = true
    } else {
      if (line.trim()) hasCurrent = true
      currentBody.push(line)
    }
  }
  flush()

  const seen = new Map<string, number>()
  return drafts.map((draft) => {
    const key = draft.headingPath.length ? draft.headingPath.join('\u0000') : 'Preamble'
    const ordinal = seen.get(key) ?? 0
    seen.set(key, ordinal + 1)
    return {
      ...draft,
      id: buildChunkId(personaId, draft.headingPath, ordinal),
      personaId,
      ordinal,
      contentHash: hashText(`${personaId}\n${draft.headingPath.join('\n')}\n${draft.text}`)
    }
  })
}

export function planIndexUpdate(previous: readonly MemoryChunk[], next: readonly MemoryChunk[]): IndexUpdatePlan {
  const previousById = new Map(previous.map((chunk) => [chunk.id, chunk]))
  const nextIds = new Set(next.map((chunk) => chunk.id))
  const toUpsert = next.filter((chunk) => previousById.get(chunk.id)?.contentHash !== chunk.contentHash)
  const unchanged = next.filter((chunk) => previousById.get(chunk.id)?.contentHash === chunk.contentHash)
  const toDelete = previous.filter((chunk) => !nextIds.has(chunk.id)).map((chunk) => chunk.id)
  return { next: [...next], toUpsert, toDelete, unchanged }
}

export class Bm25MemoryScorer implements MemoryScorer {
  private readonly k1: number
  private readonly b: number

  constructor(options: { k1?: number; b?: number } = {}) {
    this.k1 = options.k1 ?? 1.4
    this.b = options.b ?? 0.75
  }

  score(query: string, chunks: readonly IndexedMemoryChunk[]): MemoryRecallResult[] {
    const queryTokens = Array.from(new Set(tokenize(query)))
    if (!queryTokens.length || !chunks.length) return []

    const documentFrequency = new Map<string, number>()
    const chunkTerms = new Map<string, ReadonlyMap<string, number>>()
    let totalLength = 0

    for (const chunk of chunks) {
      const counts = chunk.terms ?? termCounts(chunk.text)
      chunkTerms.set(chunk.id, counts)
      totalLength += Math.max(chunk.tokenCount, 1)
      for (const token of queryTokens) {
        if (counts.has(token)) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1)
      }
    }

    const averageLength = Math.max(totalLength / chunks.length, 1)
    const scored: MemoryRecallResult[] = []

    for (const chunk of chunks) {
      const counts = chunkTerms.get(chunk.id) ?? new Map<string, number>()
      let score = 0
      for (const token of queryTokens) {
        const frequency = counts.get(token) ?? 0
        if (!frequency) continue
        const df = documentFrequency.get(token) ?? 0
        const idf = Math.log(1 + (chunks.length - df + 0.5) / (df + 0.5))
        const length = Math.max(chunk.tokenCount, 1)
        const denominator = frequency + this.k1 * (1 - this.b + this.b * (length / averageLength))
        score += idf * ((frequency * (this.k1 + 1)) / denominator)
      }
      if (score > 0) scored.push({ chunk, score, citation: formatCitation(chunk) })
    }

    return scored.sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id))
  }
}

export function formatCitation(chunk: Pick<MemoryChunk, 'personaId' | 'headingPath' | 'heading'>): string {
  const path = chunk.headingPath.length ? chunk.headingPath.join(' > ') : chunk.heading
  return `${chunk.personaId} / ${path}`
}

export function recallFromChunks(
  query: string,
  chunks: readonly IndexedMemoryChunk[],
  options: MemoryRecallOptions = {}
): MemoryRecallResult[] {
  try {
    const scorer = options.scorer ?? new Bm25MemoryScorer()
    const personaFilter = options.personaIds ? new Set(options.personaIds) : null
    const filtered = personaFilter ? chunks.filter((chunk) => personaFilter.has(chunk.personaId)) : chunks
    const minScore = options.minScore ?? DEFAULT_MIN_SCORE
    const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT)
    return scorer
      .score(query, filtered)
      .filter((result) => result.score >= minScore)
      .slice(0, limit)
  } catch {
    return []
  }
}

function ensureTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_recall_chunks (
      id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL,
      heading TEXT NOT NULL,
      heading_path TEXT NOT NULL,
      level INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      text TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      token_count INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_memory_recall_persona ON memory_recall_chunks(persona_id);

    CREATE TABLE IF NOT EXISTS memory_recall_terms (
      chunk_id TEXT NOT NULL,
      term TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (chunk_id, term),
      FOREIGN KEY(chunk_id) REFERENCES memory_recall_chunks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_memory_recall_terms_term ON memory_recall_terms(term);
  `)
}

function rowToChunk(row: ChunkRow): IndexedMemoryChunk {
  return {
    id: row.id,
    personaId: row.persona_id,
    heading: row.heading,
    headingPath: JSON.parse(row.heading_path) as string[],
    level: row.level,
    ordinal: row.ordinal,
    text: row.text,
    contentHash: row.content_hash,
    tokenCount: row.token_count
  }
}

function loadPersonaChunks(db: Database.Database, personaId: string): MemoryChunk[] {
  ensureTables(db)
  const rows = db
    .prepare('SELECT id, persona_id, heading, heading_path, level, ordinal, text, content_hash, token_count FROM memory_recall_chunks WHERE persona_id = ?')
    .all(personaId) as ChunkRow[]
  return rows.map(rowToChunk)
}

function loadRecallChunks(db: Database.Database, personaIds?: readonly string[]): IndexedMemoryChunk[] {
  ensureTables(db)
  const attachTerms = (chunks: IndexedMemoryChunk[]): IndexedMemoryChunk[] => {
    if (!chunks.length) return chunks
    const ids = chunks.map((chunk) => chunk.id)
    const placeholders = ids.map(() => '?').join(',')
    const rows = db
      .prepare(`SELECT chunk_id, term, count FROM memory_recall_terms WHERE chunk_id IN (${placeholders})`)
      .all(...ids) as TermRow[]
    const termsByChunk = new Map<string, Map<string, number>>()
    for (const row of rows) {
      let counts = termsByChunk.get(row.chunk_id)
      if (!counts) {
        counts = new Map<string, number>()
        termsByChunk.set(row.chunk_id, counts)
      }
      counts.set(row.term, row.count)
    }
    return chunks.map((chunk) => ({ ...chunk, terms: termsByChunk.get(chunk.id) ?? new Map<string, number>() }))
  }

  if (personaIds?.length) {
    const placeholders = personaIds.map(() => '?').join(',')
    const rows = db
      .prepare(
        `SELECT id, persona_id, heading, heading_path, level, ordinal, text, content_hash, token_count FROM memory_recall_chunks WHERE persona_id IN (${placeholders})`
      )
      .all(...personaIds) as ChunkRow[]
    return attachTerms(rows.map(rowToChunk))
  }
  const rows = db
    .prepare('SELECT id, persona_id, heading, heading_path, level, ordinal, text, content_hash, token_count FROM memory_recall_chunks')
    .all() as ChunkRow[]
  return attachTerms(rows.map(rowToChunk))
}

export function indexMemoryMarkdown(
  personaId: string,
  markdown: string,
  db?: Database.Database
): MemoryIndexStats {
  try {
    const database = db ?? getDb()
    ensureTables(database)
    const next = chunkMarkdown(personaId, markdown)
    const previous = loadPersonaChunks(database, personaId)
    const plan = planIndexUpdate(previous, next)
    const now = Date.now()

    const run = database.transaction(() => {
      const deleteChunk = database.prepare('DELETE FROM memory_recall_chunks WHERE id = ?')
      for (const id of plan.toDelete) deleteChunk.run(id)

      const upsertChunk = database.prepare(`
        INSERT INTO memory_recall_chunks (id, persona_id, heading, heading_path, level, ordinal, text, content_hash, token_count, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          persona_id = excluded.persona_id,
          heading = excluded.heading,
          heading_path = excluded.heading_path,
          level = excluded.level,
          ordinal = excluded.ordinal,
          text = excluded.text,
          content_hash = excluded.content_hash,
          token_count = excluded.token_count,
          updated_at = excluded.updated_at
      `)
      const deleteTerms = database.prepare('DELETE FROM memory_recall_terms WHERE chunk_id = ?')
      const insertTerm = database.prepare('INSERT INTO memory_recall_terms (chunk_id, term, count) VALUES (?, ?, ?)')

      for (const chunk of plan.toUpsert) {
        const counts = termCounts(chunk.text)
        upsertChunk.run(
          chunk.id,
          chunk.personaId,
          chunk.heading,
          JSON.stringify(chunk.headingPath),
          chunk.level,
          chunk.ordinal,
          chunk.text,
          chunk.contentHash,
          Array.from(counts.values()).reduce((sum, count) => sum + count, 0),
          now
        )
        deleteTerms.run(chunk.id)
        for (const [term, count] of counts) insertTerm.run(chunk.id, term, count)
      }
    })
    run()

    return {
      personaId,
      total: next.length,
      upserted: plan.toUpsert.length,
      deleted: plan.toDelete.length,
      unchanged: plan.unchanged.length
    }
  } catch {
    return { personaId, total: 0, upserted: 0, deleted: 0, unchanged: 0 }
  }
}

export function recallMemory(query: string, options: MemoryRecallOptions = {}, db?: Database.Database): MemoryRecallResult[] {
  try {
    const database = db ?? getDb()
    const chunks = loadRecallChunks(database, options.personaIds)
    return recallFromChunks(query, chunks, options)
  } catch {
    return []
  }
}

export function getMemoryRecallStorageDescription(): string {
  return 'SQLite tables in terminal42.db: chunk metadata and lexical term counts live beside the existing app state for transactional incremental updates.'
}
