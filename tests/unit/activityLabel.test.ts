import { describe, it, expect } from 'vitest'
import { activityLabel } from '../../src/renderer/src/lib/activityLabel'

// The Activity panel answers "what has it been doing", so every row has to
// read as an answer to that question. The input it has to work with is the
// tool's raw JSON arguments, usually captured mid-string, in a column about
// 40 characters wide.

describe('activityLabel says what happened in English', () => {
  it('describes a shell call by its command', () => {
    expect(activityLabel({ name: 'bash', input: '{"command":"npm test"}' })).toBe('Ran npm test')
  })

  it('describes a write by its file', () => {
    expect(activityLabel({ name: 'create', input: '{"path":"/tmp/site/index.html","file_text":"<html>"}' })).toBe(
      'Created site/index.html'
    )
  })

  it('describes an edit by its file', () => {
    expect(activityLabel({ name: 'edit', input: '{"path":"src/main/chat.ts"}' })).toBe('Edited src/main/chat.ts')
  })

  it('describes a read', () => {
    expect(activityLabel({ name: 'view', input: '{"file_path":"/a/b/c.ts"}' })).toBe('Read b/c.ts')
  })

  it('describes a search by what was searched for', () => {
    expect(activityLabel({ name: 'grep', input: '{"pattern":"TODO"}' })).toBe('Searched for TODO')
  })

  it('never leaves a bare tool name when there is nothing to name', () => {
    expect(activityLabel({ name: 'bash' })).toBe('Ran a command')
    expect(activityLabel({ name: 'edit', input: '{"timeout":30}' })).toBe('Edited a file')
  })

  it('makes an unfamiliar tool readable rather than showing its identifier', () => {
    expect(activityLabel({ name: 'read_file', input: '{"path":"a.txt"}' })).toBe('Read file a.txt')
  })

  it('prefers the command over other fields when both are present', () => {
    expect(activityLabel({ name: 'bash', input: '{"command":"ls","path":"/tmp"}' })).toBe('Ran ls')
  })

  it('falls back to the summary when there are no arguments', () => {
    expect(activityLabel({ name: 'bash', summary: 'exited 0' })).toBe('Ran exited 0')
  })
})

describe('activityLabel with streamed, truncated arguments', () => {
  it('still finds the file when the JSON was cut mid-string', () => {
    const input = '{"path":"/tmp/site/index.html","file_text":"<!DOCTYPE html>\\n<html'
    expect(activityLabel({ name: 'edit', input })).toBe('Edited site/index.html')
  })

  it('still finds the command when the JSON was cut', () => {
    expect(activityLabel({ name: 'bash', input: '{"command":"npm run build","cwd":"/tm' })).toBe('Ran npm run build')
  })

  it('unescapes what it recovers', () => {
    expect(activityLabel({ name: 'edit', input: '{"path":"/tmp/a b\\nc.txt","old_str":"x' })).toBe('Edited /tmp/a b c.txt')
  })

  it('names the code being replaced when the path is out of reach', () => {
    const input = '{"old_str":"    .kpi {\\n      background: var(--surface);'
    expect(activityLabel({ name: 'edit', input })).toBe('Edited .kpi {')
  })

  it('uses the new text when there is no old text', () => {
    expect(activityLabel({ name: 'edit', input: '{"new_str":"\\n\\n.live-badge {\\n  gap: 6px;' })).toBe(
      'Edited .live-badge {'
    )
  })

  it('gives up gracefully when the cut lands before anything useful', () => {
    expect(activityLabel({ name: 'edit', input: '{"pa' })).toBe('Edited a file')
  })
})

describe('activityLabel keeps rows to one line', () => {
  it('shows the file and its folder, not the whole path', () => {
    expect(activityLabel({ name: 'edit', input: '{"path":"/Users/me/Desktop/site/index.html"}' })).toBe(
      'Edited site/index.html'
    )
  })

  it('leaves a short path alone', () => {
    expect(activityLabel({ name: 'edit', input: '{"path":"/tmp/a.txt"}' })).toBe('Edited /tmp/a.txt')
  })

  it('does not mangle a command that happens to start with a slash', () => {
    expect(activityLabel({ name: 'bash', input: '{"command":"/usr/bin/env node build.js"}' })).toBe(
      'Ran /usr/bin/env node build.js'
    )
  })

  it('collapses newlines so a multi-line command stays one row', () => {
    expect(activityLabel({ name: 'bash', input: '{"command":"cd /tmp\\n  && ls"}' })).toBe('Ran cd /tmp && ls')
  })

  it('truncates a long detail rather than pushing the timestamp off the row', () => {
    const label = activityLabel({ name: 'bash', input: JSON.stringify({ command: 'x'.repeat(200) }) })
    expect(label.length).toBeLessThanOrEqual('Ran '.length + 53)
    expect(label.endsWith('…')).toBe(true)
  })
})
