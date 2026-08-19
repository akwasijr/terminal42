import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import {
  OSC_PROMPT_START,
  OSC_COMMAND_START,
  OSC_COMMAND_EXECUTED,
  OSC_COMMAND_FINISHED
} from '../shared/terminalProtocol'

// The marker letters come from the shared protocol module so the shell that
// emits them and the parser that reads them cannot drift apart — a mismatch
// here would silently disable command tracking with nothing to show for it.
export const OSC = '\x1b]'
export const ST = '\x07'
export const OSC_133_PROMPT_START = `${OSC}133;${OSC_PROMPT_START}${ST}`
export const OSC_133_PROMPT_END = `${OSC}133;${OSC_COMMAND_START}${ST}`
export const OSC_133_COMMAND_START = `${OSC}133;${OSC_COMMAND_EXECUTED}${ST}`

// The bodies the generated shell scripts print. They are built from the same
// shared letters as the sequences above so a protocol change lands in the
// shell and the parser together.
const MARK_PROMPT_START = `133;${OSC_PROMPT_START}`
const MARK_COMMAND_START = `133;${OSC_COMMAND_START}`
const MARK_COMMAND_EXECUTED = `133;${OSC_COMMAND_EXECUTED}`
const MARK_COMMAND_FINISHED = `133;${OSC_COMMAND_FINISHED}`
export const SHELL_INTEGRATION_ENV = 'TERMINAL42_SHELL_INTEGRATION'
export const SHELL_INTEGRATION_DISABLE_ENV = 'TERMINAL42_DISABLE_SHELL_INTEGRATION'
export const SHELL_INTEGRATION_ACTIVE_ENV = 'TERMINAL42_SHELL_INTEGRATION_ACTIVE'

export type SupportedShell = 'zsh' | 'bash'

export type ShellIntegrationLaunch = {
  command: string
  args: string[]
  env: Record<string, string>
  enabled: boolean
  shell: SupportedShell | null
}

export type ShellIntegrationOptions = {
  shellPath: string
  shellArgs: string[]
  env: Record<string, string>
  integrationDir: string
  homeDir?: string
}

export function osc133CommandFinished(exitCode: number): string {
  return `${OSC}133;${OSC_COMMAND_FINISHED};${exitCode}${ST}`
}

export function osc7Cwd(host: string, path: string): string {
  return `${OSC}7;file://${host}${path}${ST}`
}

export function detectSupportedShell(shellPath: string): SupportedShell | null {
  const name = basename(shellPath).toLowerCase()
  if (name === 'zsh') return 'zsh'
  if (name === 'bash') return 'bash'
  return null
}

export function isShellIntegrationEnabled(env: NodeJS.ProcessEnv | Record<string, string | undefined>): boolean {
  if (env[SHELL_INTEGRATION_ENV] === '0') return false
  if (env[SHELL_INTEGRATION_DISABLE_ENV] === '1') return false
  if (env[SHELL_INTEGRATION_DISABLE_ENV]?.toLowerCase() === 'true') return false
  return true
}

export function buildShellIntegrationScript(shell: SupportedShell): string {
  return shell === 'zsh' ? buildZshIntegrationScript() : buildBashIntegrationScript()
}

export function buildZshIntegrationScript(): string {
  return [
    "# Terminal42 shell integration. Safe to source from interactive zsh only.",
    "if [[ -n \"${TERMINAL42_SHELL_INTEGRATION_ACTIVE:-}\" ]]; then",
    "  return 0 2>/dev/null || true",
    "fi",
    "typeset -g TERMINAL42_SHELL_INTEGRATION_ACTIVE=1",
    "",
    "__terminal42_osc() {",
    "  builtin printf '\\033]%s\\a' \"$1\" 2>/dev/null || true",
    "}",
    "",
    "__terminal42_cwd() {",
    "  local __terminal42_host=\"${HOST:-}\"",
    "  if [[ -z \"$__terminal42_host\" ]]; then",
    "    __terminal42_host=\"$(hostname 2>/dev/null || builtin printf localhost)\"",
    "  fi",
    "  __terminal42_osc \"7;file://${__terminal42_host}${PWD}\"",
    "}",
    "",
    "__terminal42_precmd() {",
    "  local __terminal42_status=\"$?\"",
    "  if [[ \"${__terminal42_command_started:-0}\" == \"1\" ]]; then",
    "    __terminal42_osc \"" + MARK_COMMAND_FINISHED + ";${__terminal42_status}\"",
    "  fi",
    "  typeset -g __terminal42_command_started=0",
    "  __terminal42_cwd",
    "  __terminal42_osc '133;A'",
    "}",
    "",
    "__terminal42_preexec() {",
    "  __terminal42_osc '133;B'",
    "  __terminal42_osc '133;C'",
    "  typeset -g __terminal42_command_started=1",
    "}",
    "",
    "autoload -Uz add-zsh-hook 2>/dev/null || true",
    "if (( $+functions[add-zsh-hook] )); then",
    "  add-zsh-hook precmd __terminal42_precmd 2>/dev/null || true",
    "  add-zsh-hook preexec __terminal42_preexec 2>/dev/null || true",
    "fi"
  ].join('\n') + '\n'
}

export function buildBashIntegrationScript(): string {
  return [
    "# Terminal42 shell integration. Safe to source from interactive bash only.",
    "if [[ -n \"${TERMINAL42_SHELL_INTEGRATION_ACTIVE:-}\" ]]; then",
    "  return 0 2>/dev/null || true",
    "fi",
    "export TERMINAL42_SHELL_INTEGRATION_ACTIVE=1",
    "",
    "__terminal42_osc() {",
    "  printf '\\033]%s\\a' \"$1\" 2>/dev/null || true",
    "}",
    "",
    "__terminal42_cwd() {",
    "  local __terminal42_host=\"${HOSTNAME:-}\"",
    "  if [[ -z \"$__terminal42_host\" ]]; then",
    "    __terminal42_host=\"$(hostname 2>/dev/null || printf localhost)\"",
    "  fi",
    "  __terminal42_osc \"7;file://${__terminal42_host}${PWD}\"",
    "}",
    "",
    "__terminal42_prompt_command() {",
    "  local __terminal42_status=\"$?\"",
    "  if [[ \"${__terminal42_command_started:-0}\" == \"1\" ]]; then",
    "    __terminal42_osc \"" + MARK_COMMAND_FINISHED + ";${__terminal42_status}\"",
    "  fi",
    "  __terminal42_command_started=0",
    "  __terminal42_cwd",
    "  __terminal42_osc '133;A'",
    "  __terminal42_prompt_active=1",
    "  return \"$__terminal42_status\"",
    "}",
    "",
    "__terminal42_preexec() {",
    "  if [[ \"${__terminal42_prompt_active:-0}\" != \"1\" ]]; then",
    "    return 0",
    "  fi",
    "  case \"$1\" in",
    "    __terminal42_*|PROMPT_COMMAND=*|trap\\ *) return 0 ;;",
    "  esac",
    "  __terminal42_prompt_active=0",
    "  __terminal42_osc '133;B'",
    "  __terminal42_osc '133;C'",
    "  __terminal42_command_started=1",
    "}",
    "",
    "__terminal42_original_debug_trap=\"$(trap -p DEBUG)\"",
    "if [[ \"$__terminal42_original_debug_trap\" == trap\\ --\\ *\\ DEBUG ]]; then",
    "  __terminal42_original_debug_trap=\"${__terminal42_original_debug_trap#trap -- }\"",
    "  __terminal42_original_debug_trap=\"${__terminal42_original_debug_trap% DEBUG}\"",
    "else",
    "  __terminal42_original_debug_trap=''",
    "fi",
    "",
    "__terminal42_run_original_debug_trap() {",
    "  if [[ -n \"${__terminal42_original_debug_trap:-}\" ]]; then",
    "    eval -- \"$__terminal42_original_debug_trap\"",
    "  fi",
    "}",
    "",
    "__terminal42_original_prompt_command=\"${PROMPT_COMMAND:-}\"",
    "if [[ -n \"$__terminal42_original_prompt_command\" ]]; then",
    "  PROMPT_COMMAND=\"__terminal42_prompt_command; ${__terminal42_original_prompt_command}\"",
    "else",
    "  PROMPT_COMMAND='__terminal42_prompt_command'",
    "fi",
    "trap '__terminal42_preexec \"$BASH_COMMAND\"; __terminal42_run_original_debug_trap' DEBUG"
  ].join('\n') + '\n'
}

export function buildZshRcWrapper(realZdotdir: string, integrationScriptPath: string): string {
  return `# Terminal42 loads the user's zshrc first so aliases, prompt themes and\n# plugin managers keep their normal startup order; our hooks are appended after.\nexport TERMINAL42_REAL_ZDOTDIR=${shellQuote(realZdotdir)}\nexport TERMINAL42_SHELL_INTEGRATION_SCRIPT=${shellQuote(integrationScriptPath)}\nexport ZDOTDIR="$TERMINAL42_REAL_ZDOTDIR"\nif [[ -r "$TERMINAL42_REAL_ZDOTDIR/.zshrc" ]]; then\n  source "$TERMINAL42_REAL_ZDOTDIR/.zshrc" || true\nfi\n__terminal42_load_integration() {\n  emulate -L zsh\n  setopt no_err_exit no_err_return\n  source "$TERMINAL42_SHELL_INTEGRATION_SCRIPT" || true\n}\n__terminal42_load_integration || true\nunfunction __terminal42_load_integration 2>/dev/null || true\n`
}

export function buildBashRcWrapper(realBashrc: string, integrationScriptPath: string): string {
  return `# Terminal42 uses --rcfile because bash has no ZDOTDIR equivalent. The\n# wrapper preserves the user's startup file and appends the integration after it.\nexport TERMINAL42_REAL_BASHRC=${shellQuote(realBashrc)}\nexport TERMINAL42_SHELL_INTEGRATION_SCRIPT=${shellQuote(integrationScriptPath)}\nif [[ -r "$TERMINAL42_REAL_BASHRC" ]]; then\n  source "$TERMINAL42_REAL_BASHRC" || true\nfi\nsource "$TERMINAL42_SHELL_INTEGRATION_SCRIPT" || true\n`
}

export function prepareShellIntegration(options: ShellIntegrationOptions): ShellIntegrationLaunch {
  const shell = detectSupportedShell(options.shellPath)
  if (!shell || !isShellIntegrationEnabled(options.env)) {
    return { command: options.shellPath, args: [...options.shellArgs], env: { ...options.env }, enabled: false, shell }
  }

  try {
    const shellDir = join(options.integrationDir, shell)
    mkdirSync(shellDir, { recursive: true })
    const scriptPath = join(shellDir, 'shellIntegration.sh')
    writeFileSync(scriptPath, buildShellIntegrationScript(shell), 'utf8')

    if (shell === 'zsh') {
      const realZdotdir = options.env.ZDOTDIR || options.homeDir || options.env.HOME || homedir()
      const wrapperPath = join(shellDir, '.zshrc')
      writeFileSync(wrapperPath, buildZshRcWrapper(realZdotdir, scriptPath), 'utf8')
      return {
        command: options.shellPath,
        args: [...options.shellArgs],
        env: { ...options.env, TERMINAL42_REAL_ZDOTDIR: realZdotdir, ZDOTDIR: shellDir },
        enabled: true,
        shell
      }
    }

    if (options.shellArgs.length > 0) {
      return { command: options.shellPath, args: [...options.shellArgs], env: { ...options.env }, enabled: false, shell }
    }

    const realBashrc = join(options.homeDir || options.env.HOME || homedir(), '.bashrc')
    const wrapperPath = join(shellDir, 'bashrc')
    writeFileSync(wrapperPath, buildBashRcWrapper(realBashrc, scriptPath), 'utf8')
    return {
      command: options.shellPath,
      args: ['--rcfile', wrapperPath],
      env: { ...options.env, TERMINAL42_REAL_BASHRC: realBashrc },
      enabled: true,
      shell
    }
  } catch {
    return { command: options.shellPath, args: [...options.shellArgs], env: { ...options.env }, enabled: false, shell }
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}
