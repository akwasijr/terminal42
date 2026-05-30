import { describe, it, expect } from 'vitest'
import {
  stripAnsi,
  classifyStatus,
  lastAssistantLine,
  tailLines
} from '../../src/renderer/src/lib/agentStatus'

describe('stripAnsi', () => {
  it('removes SGR color codes', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m text')).toBe('red text')
  })

  it('removes OSC sequences and control chars', () => {
    expect(stripAnsi('\x1b]0;title\x07hello')).toBe('hello')
    expect(stripAnsi('a\x00b\x7fc')).toBe('abc')
  })

  it('leaves plain text untouched', () => {
    expect(stripAnsi('plain')).toBe('plain')
  })
})

describe('classifyStatus', () => {
  it('returns idle for empty scrollback', () => {
    expect(classifyStatus('')).toBe('idle')
  })

  it('detects waiting on an approval prompt', () => {
    expect(classifyStatus('Approve this command [y/n]')).toBe('waiting')
    expect(classifyStatus('Do you want to continue installing?')).toBe('waiting')
    expect(classifyStatus('Press Enter to continue')).toBe('waiting')
  })

  it('detects working on tool/spinner output', () => {
    expect(classifyStatus('some logs\n● run_tests(all)')).toBe('working')
    expect(classifyStatus('Reading file foo.ts')).toBe('working')
  })

  it('returns idle for a bare ready prompt', () => {
    expect(classifyStatus('All done. Anything else I can help with')).toBe('idle')
  })
})

describe('lastAssistantLine', () => {
  it('returns the last meaningful line', () => {
    const scroll = 'first line\n● tool(call)\nThis is the final summary line.'
    expect(lastAssistantLine(scroll)).toBe('This is the final summary line.')
  })

  it('skips spinner/tool lines and short lines', () => {
    const scroll = 'A meaningful sentence here.\n●\n⠋\n>'
    expect(lastAssistantLine(scroll)).toBe('A meaningful sentence here.')
  })

  it('truncates very long lines', () => {
    const long = 'x'.repeat(300)
    const out = lastAssistantLine(long)
    expect(out.length).toBe(198)
    expect(out.endsWith('…')).toBe(true)
  })

  it('uses the fallback when nothing qualifies', () => {
    expect(lastAssistantLine('', 'fallback')).toBe('fallback')
    expect(lastAssistantLine('>\n$', 'fb')).toBe('fb')
  })
})

describe('tailLines', () => {
  it('returns the last n lines', () => {
    const input = Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n')
    const out = tailLines(input, 3)
    expect(out).toBe('line 47\nline 48\nline 49')
  })

  it('returns empty for empty input', () => {
    expect(tailLines('')).toBe('')
  })
})
