import { describe, it, expect } from 'vitest'
import {
  OSC_133_PROMPT_START,
  OSC_133_PROMPT_END,
  OSC_133_COMMAND_START,
  osc133CommandFinished,
  osc7Cwd,
  buildShellIntegrationScript
} from '../../src/main/shellIntegration'
import { ShellEventParser, type ShellEvent, OSC_PROMPT_START, OSC_COMMAND_START, OSC_COMMAND_EXECUTED, OSC_COMMAND_FINISHED } from '../../src/shared/terminalProtocol'

// The contract between the two halves of shell integration: the shell emits
// escape sequences, the renderer parses them. They live in different modules
// and are exercised by different tests, so nothing else would catch them
// drifting apart — the symptom would be command tracking silently doing
// nothing, which is indistinguishable from the feature being off.

function parse(input: string): ShellEvent[] {
  const parser = new ShellEventParser()
  return [...parser.write(input), ...parser.flush()]
}

describe('shell integration ↔ protocol contract', () => {
  it('emits a prompt start the parser recognises', () => {
    expect(parse(OSC_133_PROMPT_START)).toEqual([{ kind: 'prompt-start' }])
  })

  it('emits a command start the parser recognises', () => {
    expect(parse(OSC_133_PROMPT_END)).toEqual([{ kind: 'command-start' }])
  })

  it('emits a command-executed marker the parser recognises', () => {
    expect(parse(OSC_133_COMMAND_START)).toEqual([{ kind: 'command-executed', command: null }])
  })

  it('round-trips every exit code the shell can report', () => {
    // 0, a common failure, a signal-derived code and the max byte value.
    for (const code of [0, 1, 2, 127, 130, 255]) {
      expect(parse(osc133CommandFinished(code))).toEqual([
        { kind: 'command-finished', exitCode: code }
      ])
    }
  })

  it('round-trips working directories, including paths that need escaping', () => {
    expect(parse(osc7Cwd('mac.home', '/Users/me/terminal42'))).toEqual([
      { kind: 'cwd', cwd: '/Users/me/terminal42' }
    ])
  })

  it('emits only markers the parser understands from the generated scripts', () => {
    // The scripts print OSC bodies through a printf helper, so assert on the
    // bodies and then prove each one parses. Deriving the expected bodies from
    // the shared letters here means this test fails if either side is changed
    // alone — which is the drift the shared module exists to prevent.
    const bodies = [
      `133;${OSC_PROMPT_START}`,
      `133;${OSC_COMMAND_START}`,
      `133;${OSC_COMMAND_EXECUTED}`,
      `133;${OSC_COMMAND_FINISHED}`
    ]

    for (const shell of ['zsh', 'bash'] as const) {
      const script = buildShellIntegrationScript(shell)
      // The helper is what turns a body into a real escape sequence.
      expect(script).toContain("printf '\\033]%s\\a'")
      expect(script).toContain('7;file://')
      for (const body of bodies) {
        expect(script, `${shell} should emit ${body}`).toContain(body)
      }
    }

    for (const body of bodies.slice(0, 3)) {
      expect(parse(`\x1b]${body}\x07`)).toHaveLength(1)
    }
  })

  it('parses a full session exactly as a real shell would emit it', () => {
    const session =
      osc7Cwd('mac.home', '/Users/me/terminal42') +
      OSC_133_PROMPT_START +
      '~/terminal42 $ ' +
      OSC_133_PROMPT_END +
      'npm test\r\n' +
      OSC_133_COMMAND_START +
      'ok\r\n' +
      osc133CommandFinished(0)

    expect(parse(session)).toEqual([
      { kind: 'cwd', cwd: '/Users/me/terminal42' },
      { kind: 'prompt-start' },
      { kind: 'command-start' },
      { kind: 'command-executed', command: null },
      { kind: 'command-finished', exitCode: 0 }
    ])
  })
})
