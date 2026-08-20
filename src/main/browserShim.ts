// Stop the agent from throwing the user's browser at them.
//
// When a turn builds a page it often finishes by running `open http://…`, or
// starts a dev server with a flag that does the same. The app already shows
// that page in its preview pane, so the browser window is a second copy of
// something the user is already looking at — and the copy that steals focus.
//
// The agent cannot be argued out of this reliably: `open` is run by dev servers
// and helper libraries as much as by the agent itself. So `open` is replaced
// for the duration of an agent run by a script earlier on PATH that declines
// URLs and web pages and passes everything else through, which keeps
// `open .` (reveal in Finder) and `open report.pdf` working.

import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, delimiter } from 'node:path'

/** The names an agent (or a dev server it starts) reaches for to open a page. */
export const SHIMMED_COMMANDS = ['open', 'xdg-open'] as const

/**
 * Arguments the shim declines, as a shell `case` pattern.
 *
 * Matched per-argument rather than on the whole command line so that flags
 * like `open -a "Google Chrome" index.html` are still recognised as a page.
 */
const DECLINED_PATTERNS = ['http://*', 'https://*', 'file://*', '*.html', '*.htm']

/**
 * The script body. `T42_REAL_OPEN` names the real binary so the behaviour can
 * be tested without launching anything.
 */
export function shimScript(command: string): string {
  const fallback = command === 'open' ? '/usr/bin/open' : '/usr/bin/xdg-open'
  return `#!/bin/bash
# Written by Terminal 42. Previews are shown inside the app.
real="\${T42_REAL_OPEN:-${fallback}}"
for arg in "$@"; do
  case "$arg" in
    ${DECLINED_PATTERNS.join('|')})
      echo "Terminal 42 is already showing this in the app's preview pane, so it was not opened in a browser: $arg"
      exit 0
      ;;
  esac
done
if [ -x "$real" ]; then
  exec "$real" "$@"
fi
exit 0
`
}

/**
 * Write the shims and return the directory holding them.
 *
 * Rewritten on every call: the cost is two small files and it means an app
 * update never leaves a stale script behind.
 */
export function installBrowserShim(dir: string): string {
  mkdirSync(dir, { recursive: true })
  for (const command of SHIMMED_COMMANDS) {
    const file = join(dir, command)
    writeFileSync(file, shimScript(command), 'utf8')
    chmodSync(file, 0o755)
  }
  return dir
}

/**
 * `env` with the shim directory first on PATH.
 *
 * First rather than last: the point is to be found before /usr/bin.
 */
export function withBrowserShim(env: NodeJS.ProcessEnv, dir: string): NodeJS.ProcessEnv {
  const current = env.PATH ?? ''
  if (current.split(delimiter).includes(dir)) return env
  return { ...env, PATH: current ? `${dir}${delimiter}${current}` : dir }
}

/**
 * Where the shims were installed, once the app has done so.
 *
 * Held here rather than passed through every call site so that this module
 * stays free of Electron and can be tested by running the real script.
 */
let installedDir: string | null = null

/** Install the shims and use them for every later agent run. */
export function useBrowserShim(dir: string): void {
  installedDir = installBrowserShim(dir)
}

/** Testing seam: forget any installed shim. */
export function resetBrowserShim(): void {
  installedDir = null
}

/** `env` with the installed shim on PATH, or unchanged if none is installed. */
export function agentEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (!installedDir) return env
  return withBrowserShim(env, installedDir)
}
