import { describe, it, expect } from 'vitest'
import { isUnexecutedToolCall } from '../../src/shared/textToolCall'

// Captured verbatim from a live session that failed this way: the model wrote
// the call out instead of making it, so no file was created.
const REAL_FAILURE = `create
<parameter name="path">/Users/akwasifosuhene/Desktop/Testing folder/probe-page.html</parameter>
<parameter name="file_text"><!DOCTYPE html>
<html lang="en">
<head><title>Probe page</title></head>
<body><h1>Probe works</h1></body>
</html>
</parameter>
</create>

Created \`probe-page.html\`.`

describe('isUnexecutedToolCall', () => {
  it('catches the real captured failure', () => {
    expect(isUnexecutedToolCall(REAL_FAILURE, 0)).toBe(true)
  })

  it('stays quiet when tools actually ran', () => {
    expect(isUnexecutedToolCall(REAL_FAILURE, 1)).toBe(false)
  })

  it('leaves ordinary replies alone', () => {
    expect(isUnexecutedToolCall('Created index.html with a heading.', 0)).toBe(false)
    expect(isUnexecutedToolCall('', 0)).toBe(false)
    expect(isUnexecutedToolCall('Here is a <div> and some <html> talk.', 0)).toBe(false)
  })

  it('does not fire on markup quoted inside a fenced block', () => {
    const doc = 'The CLI format looks like this:\n\n```\ncreate\n<parameter name="path">x</parameter>\n```\n\nThat is all.'
    expect(isUnexecutedToolCall(doc, 0)).toBe(false)
  })

  it('still fires when a fenced block appears elsewhere in the reply', () => {
    const mixed = 'Some code:\n\n```js\nconst a = 1\n```\n\ncreate\n<parameter name="path">/tmp/a.html</parameter>'
    expect(isUnexecutedToolCall(mixed, 0)).toBe(true)
  })

  it('handles an unterminated fence without hanging or false-firing', () => {
    const unterminated = 'Example:\n\n```\ncreate\n<parameter name="path">x</parameter>'
    expect(isUnexecutedToolCall(unterminated, 0)).toBe(false)
  })

  it('tolerates whitespace and case variations in the tag', () => {
    expect(isUnexecutedToolCall('<Parameter  name = "path">x</Parameter>', 0)).toBe(true)
  })
})
