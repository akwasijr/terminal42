import { describe, it, expect } from 'vitest'
import { chatActivityLabel, type ChatToolGroup } from '../../src/renderer/src/components/chatActivity'

const group = (name: string, count: number): ChatToolGroup => ({ name, status: 'done', count })

describe('chatActivityLabel', () => {
  it('names the work instead of the duration', () => {
    expect(chatActivityLabel([group('bash', 3)])).toBe('Ran 3 commands')
  })

  it('uses singular forms for a single call', () => {
    expect(chatActivityLabel([group('bash', 1)])).toBe('Ran 1 command')
    expect(chatActivityLabel([group('view', 1)])).toBe('Read 1 file')
  })

  it('recognises the common tool families', () => {
    expect(chatActivityLabel([group('view', 4)])).toBe('Read 4 files')
    expect(chatActivityLabel([group('edit', 2)])).toBe('Made 2 edits')
    expect(chatActivityLabel([group('create', 2)])).toBe('Created 2 files')
    expect(chatActivityLabel([group('grep', 5)])).toBe('Searched 5 times')
    expect(chatActivityLabel([group('glob', 2)])).toBe('Listed files')
  })

  it('falls back to the raw tool name when unrecognised', () => {
    expect(chatActivityLabel([group('weather_lookup', 1)])).toBe('Used weather_lookup')
    expect(chatActivityLabel([group('weather_lookup', 3)])).toBe('Used weather_lookup ×3')
  })

  // The row is one line, so a mixed turn shows its largest group plus a count.
  it('leads with the largest group and counts the rest', () => {
    const label = chatActivityLabel([group('view', 2), group('bash', 7), group('edit', 1)])
    expect(label).toBe('Ran 7 commands +2 more')
  })

  it('returns null when no tools ran, so the row can be hidden', () => {
    expect(chatActivityLabel([])).toBeNull()
  })
})
