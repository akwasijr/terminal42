import { afterEach, describe, expect, it } from 'vitest'
import { rmSync } from 'node:fs'
import {
  OSC_133_COMMAND_START,
  OSC_133_PROMPT_END,
  OSC_133_PROMPT_START,
  SHELL_INTEGRATION_ACTIVE_ENV,
  buildBashIntegrationScript,
  buildBashRcWrapper,
  buildShellIntegrationScript,
  buildZshIntegrationScript,
  buildZshRcWrapper,
  detectSupportedShell,
  isShellIntegrationEnabled,
  osc133CommandFinished,
  osc7Cwd,
  prepareShellIntegration
} from '../../src/main/shellIntegration'

const TEST_OUTPUT_DIR = 'tests/unit/.shell-integration-test-output'

afterEach(() => {
  rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true })
})

describe('shell integration markers', () => {
  it('exports standard OSC 133 and OSC 7 sequences', () => {
    expect(OSC_133_PROMPT_START).toBe('\x1b]133;A\x07')
    expect(OSC_133_PROMPT_END).toBe('\x1b]133;B\x07')
    expect(OSC_133_COMMAND_START).toBe('\x1b]133;C\x07')
    expect(osc133CommandFinished(17)).toBe('\x1b]133;D;17\x07')
    expect(osc7Cwd('host', '/Users/example')).toBe('\x1b]7;file://host/Users/example\x07')
  })
})

describe('shell detection and opt-out', () => {
  it('supports zsh and bash only', () => {
    expect(detectSupportedShell('/bin/zsh')).toBe('zsh')
    expect(detectSupportedShell('/opt/homebrew/bin/bash')).toBe('bash')
    expect(detectSupportedShell('/usr/bin/fish')).toBeNull()
  })

  it('honors environment opt-out flags', () => {
    expect(isShellIntegrationEnabled({})).toBe(true)
    expect(isShellIntegrationEnabled({ TERMINAL42_SHELL_INTEGRATION: '0' })).toBe(false)
    expect(isShellIntegrationEnabled({ TERMINAL42_DISABLE_SHELL_INTEGRATION: 'true' })).toBe(false)
  })
})

describe('zsh integration script', () => {
  it('chains via add-zsh-hook and remains idempotent', () => {
    const script = buildZshIntegrationScript()
    expect(script).toContain(SHELL_INTEGRATION_ACTIVE_ENV)
    expect(script).toContain('add-zsh-hook precmd __terminal42_precmd')
    expect(script).toContain('add-zsh-hook preexec __terminal42_preexec')
    expect(script).toContain("__terminal42_osc '133;A'")
    expect(script).toContain("__terminal42_osc '133;B'")
    expect(script).toContain("__terminal42_osc '133;C'")
    expect(script).toContain('__terminal42_osc "133;D;${__terminal42_status}"')
    expect(script).toContain('__terminal42_osc "7;file://${__terminal42_host}${PWD}"')
  })

  it('sources user zshrc before the generated integration', () => {
    const wrapper = buildZshRcWrapper('/Users/me', '/app/shellIntegration.sh')
    expect(wrapper.indexOf('source "$TERMINAL42_REAL_ZDOTDIR/.zshrc"')).toBeLessThan(
      wrapper.indexOf('source "$TERMINAL42_SHELL_INTEGRATION_SCRIPT"')
    )
    expect(wrapper).toContain('source "$TERMINAL42_REAL_ZDOTDIR/.zshrc" || true')
    expect(wrapper).toContain('source "$TERMINAL42_SHELL_INTEGRATION_SCRIPT" || true')
  })
})

describe('bash integration script', () => {
  it('preserves PROMPT_COMMAND and chains an existing DEBUG trap', () => {
    const script = buildBashIntegrationScript()
    expect(script).toContain(SHELL_INTEGRATION_ACTIVE_ENV)
    expect(script).toContain('__terminal42_original_prompt_command="${PROMPT_COMMAND:-}"')
    expect(script).toContain('PROMPT_COMMAND="__terminal42_prompt_command; ${__terminal42_original_prompt_command}"')
    expect(script).toContain('__terminal42_original_debug_trap="$(trap -p DEBUG)"')
    expect(script).toContain('trap \'__terminal42_preexec "$BASH_COMMAND"; __terminal42_run_original_debug_trap\' DEBUG')
  })

  it('sources user bashrc before the generated integration', () => {
    const wrapper = buildBashRcWrapper('/Users/me/.bashrc', '/app/shellIntegration.sh')
    expect(wrapper.indexOf('source "$TERMINAL42_REAL_BASHRC"')).toBeLessThan(
      wrapper.indexOf('source "$TERMINAL42_SHELL_INTEGRATION_SCRIPT"')
    )
    expect(wrapper).toContain('source "$TERMINAL42_REAL_BASHRC" || true')
    expect(wrapper).toContain('source "$TERMINAL42_SHELL_INTEGRATION_SCRIPT" || true')
  })
})

describe('launch preparation', () => {
  it('uses a ZDOTDIR wrapper for zsh', () => {
    const launch = prepareShellIntegration({
      shellPath: '/bin/zsh',
      shellArgs: [],
      env: { HOME: '/Users/me' },
      integrationDir: `${TEST_OUTPUT_DIR}/zsh`,
      homeDir: '/Users/me'
    })

    expect(launch.enabled).toBe(true)
    expect(launch.args).toEqual([])
    expect(launch.env.ZDOTDIR).toBe(`${TEST_OUTPUT_DIR}/zsh/zsh`)
  })

  it('uses --rcfile for bash without clobbering the shell command', () => {
    const launch = prepareShellIntegration({
      shellPath: '/bin/bash',
      shellArgs: [],
      env: { HOME: '/Users/me' },
      integrationDir: `${TEST_OUTPUT_DIR}/bash`,
      homeDir: '/Users/me'
    })

    expect(launch.enabled).toBe(true)
    expect(launch.command).toBe('/bin/bash')
    expect(launch.args[0]).toBe('--rcfile')
    expect(launch.args[1]).toContain(`${TEST_OUTPUT_DIR}/bash/bash/bashrc`)
  })

  it('does not alter unsupported or disabled shells', () => {
    const unsupported = prepareShellIntegration({
      shellPath: '/bin/fish',
      shellArgs: ['-l'],
      env: { HOME: '/Users/me' },
      integrationDir: `${TEST_OUTPUT_DIR}/fish`,
      homeDir: '/Users/me'
    })
    const disabled = prepareShellIntegration({
      shellPath: '/bin/zsh',
      shellArgs: [],
      env: { HOME: '/Users/me', TERMINAL42_SHELL_INTEGRATION: '0' },
      integrationDir: `${TEST_OUTPUT_DIR}/disabled`,
      homeDir: '/Users/me'
    })

    expect(unsupported.enabled).toBe(false)
    expect(unsupported.args).toEqual(['-l'])
    expect(disabled.enabled).toBe(false)
    expect(disabled.env.ZDOTDIR).toBeUndefined()
  })

  it('routes generic script generation by shell', () => {
    expect(buildShellIntegrationScript('zsh')).toContain('add-zsh-hook')
    expect(buildShellIntegrationScript('bash')).toContain('PROMPT_COMMAND')
  })
})
