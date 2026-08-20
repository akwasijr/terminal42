import { describe, it, expect } from 'vitest'
import { writtenPathFrom, toolArgumentsOf } from '../../src/shared/toolArtifacts'

// The shapes below are copied from real `copilot --output-format json` output
// captured from the CLI this app spawns. The bug this guards against is
// exactly a shape mismatch: the code read `input`, the CLI sends `arguments`,
// and the result was a field that was silently always empty.

const CREATE_EVENT = {
  toolCallId: 'toolu_01Vv1FoCjn7uETm1gCvBQqy2',
  toolName: 'create',
  arguments: { path: '/private/tmp/t42probe/hello.html', file_text: '<h1>Hi</h1>\n' },
  turnId: '0'
}

const EDIT_EVENT = {
  toolCallId: 'toolu_02',
  toolName: 'edit',
  arguments: { path: '/private/tmp/t42probe/hello.html', old_str: '<h1>Hi</h1>', new_str: '<h1>Hello</h1>' }
}

const BASH_EVENT = {
  toolCallId: 'toolu_03',
  toolName: 'bash',
  arguments: { command: 'cat /private/tmp/t42probe/hello.html', description: 'Read hello.html' }
}

describe('toolArgumentsOf', () => {
  it('reads the arguments field the CLI actually sends', () => {
    expect(toolArgumentsOf(CREATE_EVENT)).toEqual(CREATE_EVENT.arguments)
  })

  it('still reads the older input field', () => {
    expect(toolArgumentsOf({ input: { path: 'a.html' } })).toEqual({ path: 'a.html' })
  })

  it('prefers arguments when both are present', () => {
    expect(toolArgumentsOf({ arguments: { path: 'new.html' }, input: { path: 'old.html' } })).toEqual({
      path: 'new.html'
    })
  })

  it('parses arguments delivered as JSON text', () => {
    expect(toolArgumentsOf({ arguments: '{"path":"a.html"}' })).toEqual({ path: 'a.html' })
  })

  it('returns null for malformed JSON rather than throwing', () => {
    expect(toolArgumentsOf({ arguments: '{not json' })).toBeNull()
  })

  it('returns null when there are no arguments at all', () => {
    expect(toolArgumentsOf({})).toBeNull()
    expect(toolArgumentsOf(null)).toBeNull()
    expect(toolArgumentsOf(undefined)).toBeNull()
  })
})

describe('writtenPathFrom', () => {
  it('reads the path a create call wrote', () => {
    expect(writtenPathFrom('create', CREATE_EVENT.arguments)).toBe('/private/tmp/t42probe/hello.html')
  })

  it('reads the path an edit call wrote', () => {
    expect(writtenPathFrom('edit', EDIT_EVENT.arguments)).toBe('/private/tmp/t42probe/hello.html')
  })

  it('ignores a shell command, whose arguments name no path', () => {
    expect(writtenPathFrom('bash', BASH_EVENT.arguments)).toBeNull()
  })

  it('ignores reads, so looking at a page does not pop a preview of it', () => {
    for (const tool of ['view', 'read', 'read_file', 'grep', 'glob']) {
      expect(writtenPathFrom(tool, { path: '/tmp/index.html' }), tool).toBeNull()
    }
  })

  it('accepts the other spellings a write tool might use', () => {
    expect(writtenPathFrom('write_file', { file_path: '/tmp/a.html' })).toBe('/tmp/a.html')
    expect(writtenPathFrom('str_replace', { filePath: '/tmp/b.html' })).toBe('/tmp/b.html')
  })

  it('is not case sensitive about the tool name', () => {
    expect(writtenPathFrom('Create', { path: '/tmp/a.html' })).toBe('/tmp/a.html')
  })

  it('survives a malformed event instead of breaking the turn', () => {
    expect(writtenPathFrom('create', null)).toBeNull()
    expect(writtenPathFrom('create', 'a string')).toBeNull()
    expect(writtenPathFrom('create', [])).toBeNull()
    expect(writtenPathFrom('create', {})).toBeNull()
    expect(writtenPathFrom('create', { path: 42 })).toBeNull()
    expect(writtenPathFrom('create', { path: '   ' })).toBeNull()
    expect(writtenPathFrom('', { path: '/tmp/a.html' })).toBeNull()
  })
})
