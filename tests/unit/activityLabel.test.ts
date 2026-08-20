import { describe, it, expect } from 'vitest'
import { activityLabel } from '../../src/renderer/src/lib/activityLabel'

// The Activity tab reads tool calls, whose `input` is the tool's raw JSON
// arguments. A panel column is about 40 characters wide, so the label has to
// answer "what was that call about" without showing the argument object.

describe('activityLabel', () => {
  it('shows the command a shell call ran', () => {
    expect(activityLabel({ name: 'bash', input: '{"command":"npm test"}' })).toBe('bash · npm test')
  })

  it('shows the file a write touched', () => {
    expect(activityLabel({ name: 'create', input: '{"path":"/tmp/site/index.html","file_text":"<html>"}' })).toBe(
      'create · …/site/index.html'
    )
  })

  it('prefers the command over other fields when both are present', () => {
    expect(activityLabel({ name: 'bash', input: '{"command":"ls","path":"/tmp"}' })).toBe('bash · ls')
  })

  it('handles the other field names tools use for a target', () => {
    expect(activityLabel({ name: 'grep', input: '{"pattern":"TODO"}' })).toBe('grep · TODO')
    expect(activityLabel({ name: 'view', input: '{"file_path":"/a/b.ts"}' })).toBe('view · /a/b.ts')
  })

  it('falls back to the name alone when the JSON says nothing useful', () => {
    expect(activityLabel({ name: 'bash', input: '{"timeout":30}' })).toBe('bash')
  })

  it('survives the truncated JSON of a call still streaming', () => {
    expect(activityLabel({ name: 'bash', input: '{"command":"find /Users' })).toBe('bash')
  })

  it('uses plain text input as-is', () => {
    expect(activityLabel({ name: 'search', input: 'design tokens' })).toBe('search · design tokens')
  })

  it('falls back to the summary when there is no input', () => {
    expect(activityLabel({ name: 'bash', summary: 'exited 0' })).toBe('bash · exited 0')
  })

  it('shows the bare name when there is nothing at all', () => {
    expect(activityLabel({ name: 'bash' })).toBe('bash')
  })

  it('collapses newlines so a multi-line command stays one row', () => {
    expect(activityLabel({ name: 'bash', input: '{"command":"cd /tmp\\n  && ls"}' })).toBe('bash · cd /tmp && ls')
  })

  it('truncates a long detail rather than letting it push the timestamp off', () => {
    const label = activityLabel({ name: 'bash', input: JSON.stringify({ command: 'x'.repeat(200) }) })
    expect(label.length).toBeLessThanOrEqual('bash · '.length + 61)
    expect(label.endsWith('…')).toBe(true)
  })
})

describe('activityLabel with streamed, truncated arguments', () => {
  it('still finds the file when the JSON was cut mid-string', () => {
    const input = '{"path":"/tmp/site/index.html","file_text":"<!DOCTYPE html>\\n<html'
    expect(activityLabel({ name: 'edit', input })).toBe('edit · …/site/index.html')
  })

  it('still finds the command when the JSON was cut', () => {
    expect(activityLabel({ name: 'bash', input: '{"command":"npm run build","cwd":"/tm' })).toBe('bash · npm run build')
  })

  it('unescapes what it recovers', () => {
    expect(activityLabel({ name: 'edit', input: '{"path":"/tmp/a b\\nc.txt","old_str":"x' })).toBe('edit · /tmp/a b c.txt')
  })

  it('gives up quietly when the cut lands before anything useful', () => {
    expect(activityLabel({ name: 'edit', input: '{"pa' })).toBe('edit')
  })
})

describe('activityLabel for edits that never name a file', () => {
  it('names the code being replaced when the path is out of reach', () => {
    const input = '{"old_str":"    .kpi {\\n      background: var(--surface);'
    expect(activityLabel({ name: 'edit', input })).toBe('edit · .kpi {')
  })

  it('prefers a real path over the snippet when both are present', () => {
    const input = '{"path":"/tmp/a.css","old_str":"    .kpi {"}'
    expect(activityLabel({ name: 'edit', input })).toBe('edit · /tmp/a.css')
  })

  it('uses the new text when there is no old text', () => {
    expect(activityLabel({ name: 'edit', input: '{"new_str":"\\n\\n.live-badge {\\n  gap: 6px;' })).toBe('edit · .live-badge {')
  })
})

describe('activityLabel shortens paths', () => {
  it('keeps the file and its folder', () => {
    expect(activityLabel({ name: 'edit', input: '{"path":"/Users/me/Desktop/site/index.html"}' })).toBe(
      'edit · …/site/index.html'
    )
  })

  it('leaves a short path alone', () => {
    expect(activityLabel({ name: 'edit', input: '{"path":"/tmp/a.txt"}' })).toBe('edit · /tmp/a.txt')
  })

  it('leaves a relative path alone', () => {
    expect(activityLabel({ name: 'edit', input: '{"path":"src/main/chat.ts"}' })).toBe('edit · src/main/chat.ts')
  })

  it('does not mangle a command that happens to start with a slash', () => {
    expect(activityLabel({ name: 'bash', input: '{"command":"/usr/bin/env node build.js"}' })).toBe(
      'bash · /usr/bin/env node build.js'
    )
  })
})
