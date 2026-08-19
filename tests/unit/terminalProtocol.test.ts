import { describe, it, expect } from 'vitest'
import {
  ShellEventParser,
  parseOscBody,
  parseProgressLine,
  applyShellEvent,
  EMPTY_TERMINAL_STATE,
  type ShellEvent,
  type TerminalState
} from '../../src/shared/terminalProtocol'

const BEL = '\x07'
const osc = (body: string): string => `\x1b]${body}${BEL}`

function feed(chunks: string[]): ShellEvent[] {
  const parser = new ShellEventParser()
  const events = chunks.flatMap((c) => parser.write(c))
  return [...events, ...parser.flush()]
}

describe('parseOscBody', () => {
  it('recognises the OSC 133 prompt/command lifecycle', () => {
    expect(parseOscBody('133;A')).toEqual({ kind: 'prompt-start' })
    expect(parseOscBody('133;B')).toEqual({ kind: 'command-start' })
    expect(parseOscBody('133;C')).toEqual({ kind: 'command-executed', command: null })
    expect(parseOscBody('133;D;0')).toEqual({ kind: 'command-finished', exitCode: 0 })
    expect(parseOscBody('133;D;127')).toEqual({ kind: 'command-finished', exitCode: 127 })
  })

  it('treats a D with no code as aborted rather than success', () => {
    // Pressing Enter on an empty prompt must not look like a command that
    // exited 0, or the UI reports successes that never ran.
    expect(parseOscBody('133;D')).toEqual({ kind: 'command-finished', exitCode: null })
    expect(parseOscBody('133;D;')).toEqual({ kind: 'command-finished', exitCode: null })
  })

  it('extracts the command line when the shell provides it', () => {
    expect(parseOscBody('133;C;cmd=npm run build')).toEqual({
      kind: 'command-executed',
      command: 'npm run build'
    })
    expect(parseOscBody('133;C;cmd=echo a\\x3bb')).toEqual({
      kind: 'command-executed',
      command: 'echo a;b'
    })
  })

  it('reads OSC 7 as a working directory', () => {
    expect(parseOscBody('7;file://host/Users/me/terminal42')).toEqual({
      kind: 'cwd',
      cwd: '/Users/me/terminal42'
    })
    expect(parseOscBody('7;file:///Users/me/my%20project')).toEqual({
      kind: 'cwd',
      cwd: '/Users/me/my project'
    })
  })

  it('ignores unrelated OSC sequences', () => {
    // Title changes are constant; mistaking one for shell integration would
    // corrupt the command list on every prompt redraw.
    expect(parseOscBody('0;some window title')).toBeNull()
    expect(parseOscBody('133;Z')).toBeNull()
    expect(parseOscBody('7;https://example.com')).toBeNull()
  })
})

describe('ShellEventParser', () => {
  it('parses a full command cycle from one chunk', () => {
    const events = feed([
      osc('133;A') + '$ ' + osc('133;B') + 'ls\r\n' + osc('133;C') + 'a  b\r\n' + osc('133;D;0')
    ])
    expect(events.map((e) => e.kind)).toEqual([
      'prompt-start',
      'command-start',
      'command-executed',
      'command-finished'
    ])
  })

  it('reassembles an escape sequence split across chunks', () => {
    // PTY chunk boundaries fall wherever the kernel happens to flush, so this
    // is the normal case, not an edge case.
    const whole = osc('133;D;3')
    for (let cut = 1; cut < whole.length; cut++) {
      const events = feed([whole.slice(0, cut), whole.slice(cut)])
      expect(events).toEqual([{ kind: 'command-finished', exitCode: 3 }])
    }
  })

  it('reassembles a progress line split across chunks', () => {
    const events = feed(['Compiling 45', '% done\n'])
    expect(events).toEqual([
      { kind: 'progress', percent: 45, message: 'Compiling', current: null, total: null, unit: null }
    ])
  })

  it('accepts the ESC-backslash string terminator', () => {
    expect(feed(['\x1b]133;D;0\x1b\\'])).toEqual([{ kind: 'command-finished', exitCode: 0 }])
  })

  it('does not stall on a bare ESC-bracket in ordinary output', () => {
    // Binary or corrupted output can contain ESC] with no terminator; the
    // parser must keep working rather than swallowing everything after it.
    const junk = '\x1b]' + 'x'.repeat(5000)
    const events = feed([junk, osc('133;D;0')])
    expect(events).toEqual([{ kind: 'command-finished', exitCode: 0 }])
  })

  it('treats carriage returns as line breaks so redrawn bars are seen', () => {
    const events = feed(['Downloading 10%\rDownloading 90%\r'])
    expect(events.map((e) => (e.kind === 'progress' ? e.percent : null))).toEqual([10, 90])
  })

  it('flushes a trailing progress line that never got a newline', () => {
    const parser = new ShellEventParser()
    expect(parser.write('Building 50%')).toEqual([])
    expect(parser.flush()).toEqual([
      { kind: 'progress', percent: 50, message: 'Building', current: null, total: null, unit: null }
    ])
  })

  it('produces the same events regardless of how the stream is chunked', () => {
    // The core invariant: chunk boundaries are an artefact of the kernel, so
    // they must be invisible to the parser. Random splits catch reassembly
    // bugs that hand-picked cut points miss.
    const session =
      osc('7;file:///Users/me/terminal42') +
      osc('133;A') + '~/terminal42 $ ' + osc('133;B') + 'npm test\r\n' +
      osc('133;C;cmd=npm test') +
      '\x1b[32mRunning\x1b[0m 3/10 tests\r' +
      'Running 10/10 tests\r\n' +
      'T42_CHECKPOINT {"message":"suite green"}\n' +
      osc('133;D;0') +
      osc('133;A') + '~/terminal42 $ ' + osc('133;B') + 'exit\r\n' +
      osc('133;C') + osc('133;D;1')

    const expected = feed([session])
    expect(expected.length).toBeGreaterThan(8)

    for (let seed = 0; seed < 40; seed++) {
      const chunks: string[] = []
      let i = 0
      let rng = seed * 2654435761 + 1
      while (i < session.length) {
        rng = (rng * 1103515245 + 12345) & 0x7fffffff
        const size = 1 + (rng % 17)
        chunks.push(session.slice(i, i + size))
        i += size
      }
      expect(feed(chunks)).toEqual(expected)
    }
  })
})

describe('parseProgressLine', () => {
  it('prefers the structured marker over heuristics', () => {
    expect(parseProgressLine('T42_PROGRESS {"percent":72,"message":"Bundling"}')).toEqual({
      kind: 'progress',
      percent: 72,
      message: 'Bundling',
      current: null,
      total: null,
      unit: null
    })
  })

  it('reads a marker printed inline with other output', () => {
    const event = parseProgressLine('[worker] T42_PROGRESS {"current":3,"total":10} ok')
    expect(event).toMatchObject({ kind: 'progress', current: 3, total: 10 })
  })

  it('reads checkpoints', () => {
    expect(parseProgressLine('T42_CHECKPOINT {"message":"tests passed"}')).toEqual({
      kind: 'checkpoint',
      message: 'tests passed'
    })
  })

  it('ignores malformed marker payloads', () => {
    expect(parseProgressLine('T42_PROGRESS {not json}')).toBeNull()
    expect(parseProgressLine('T42_CHECKPOINT')).toBeNull()
  })

  it('derives progress from ratios', () => {
    expect(parseProgressLine('Testing 3/10 tests')).toMatchObject({
      kind: 'progress',
      percent: 30,
      current: 3,
      total: 10,
      message: 'Testing'
    })
    expect(parseProgressLine('Downloading 1.5/3.0 GiB')).toMatchObject({
      percent: 50,
      unit: 'GiB'
    })
  })

  it('does not invent progress from incidental numbers', () => {
    // A bogus progress bar is worse than no progress bar, so these must stay
    // silent even though they contain percentages and slashes.
    expect(parseProgressLine('error: coverage dropped by 12% since last run')).toBeNull()
    expect(parseProgressLine('  at /Users/me/src/app.ts:12:3')).toBeNull()
    expect(parseProgressLine('120% is not a valid percentage')).toBeNull()
    expect(parseProgressLine('')).toBeNull()
  })

  it('sees through ANSI colouring', () => {
    expect(parseProgressLine('\x1b[32mBuilding\x1b[0m 80%')).toMatchObject({ percent: 80 })
  })
})

describe('applyShellEvent', () => {
  const ids = (): (() => string) => {
    let n = 0
    return () => `b${++n}`
  }

  const run = (events: ShellEvent[]): TerminalState => {
    const nextId = ids()
    return events.reduce<TerminalState>(
      (state, e, i) => applyShellEvent(state, e, 1000 + i, nextId),
      EMPTY_TERMINAL_STATE
    )
  }

  it('builds a block per command and records its outcome', () => {
    const state = run([
      { kind: 'command-executed', command: 'npm test' },
      { kind: 'command-finished', exitCode: 0 },
      { kind: 'command-executed', command: 'npm run bad' },
      { kind: 'command-finished', exitCode: 1 }
    ])
    expect(state.blocks).toHaveLength(2)
    expect(state.blocks[0]).toMatchObject({ command: 'npm test', status: 'succeeded', exitCode: 0 })
    expect(state.blocks[1]).toMatchObject({ command: 'npm run bad', status: 'failed', exitCode: 1 })
  })

  it('attaches the cwd that was current when the command started', () => {
    const state = run([
      { kind: 'cwd', cwd: '/a' },
      { kind: 'command-executed', command: 'pwd' },
      { kind: 'command-finished', exitCode: 0 },
      { kind: 'cwd', cwd: '/b' }
    ])
    // The trailing OSC 7 comes from the next prompt and must not retroactively
    // relabel the command that already ran.
    expect(state.blocks[0].cwd).toBe('/a')
    expect(state.cwd).toBe('/b')
  })

  it('marks an unsubmitted command as aborted', () => {
    const state = run([
      { kind: 'command-executed', command: 'sleep 9' },
      { kind: 'command-finished', exitCode: null }
    ])
    expect(state.blocks[0]).toMatchObject({ status: 'aborted', exitCode: null })
  })

  it('does not accumulate running blocks when D never arrives', () => {
    // Half-installed shell integration emits C without D; the list must not
    // fill up with commands that never finish.
    const state = run([
      { kind: 'command-executed', command: 'one' },
      { kind: 'command-executed', command: 'two' },
      { kind: 'command-executed', command: 'three' }
    ])
    expect(state.blocks).toHaveLength(1)
    expect(state.blocks[0].command).toBe('three')
  })

  it('ignores a finish with no command in flight', () => {
    const state = run([{ kind: 'command-finished', exitCode: 0 }])
    expect(state.blocks).toEqual([])
  })

  it('clears progress when a new command starts', () => {
    const state = run([
      { kind: 'command-executed', command: 'build' },
      { kind: 'progress', percent: 80, message: null, current: null, total: null, unit: null },
      { kind: 'command-finished', exitCode: 0 },
      { kind: 'command-executed', command: 'next' }
    ])
    expect(state.progress).toBeNull()
  })
})
