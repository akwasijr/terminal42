import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, chmodSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, delimiter } from 'node:path'
import { installBrowserShim, withBrowserShim, agentEnv, useBrowserShim, resetBrowserShim, SHIMMED_COMMANDS } from '../../src/main/browserShim'

// The shim is a shell script, so it is tested by running it. A stub stands in
// for the real `open` and records what it was handed, which is the only way to
// tell "declined" apart from "passed through" without launching a browser.

let dir: string
let realOpen: string
let log: string

function runOpen(args: string[]): { stdout: string; opened: string[] } {
  writeFileSync(log, '')
  const stdout = execFileSync(join(dir, 'open'), args, {
    env: { ...process.env, T42_REAL_OPEN: realOpen, T42_OPEN_LOG: log },
    encoding: 'utf8'
  })
  const opened = readFileSync(log, 'utf8').split('\n').filter(Boolean)
  return { stdout, opened }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 't42-shim-'))
  realOpen = join(dir, 'real-open')
  log = join(dir, 'opened.log')
  writeFileSync(realOpen, '#!/bin/bash\nprintf "%s\\n" "$@" >> "$T42_OPEN_LOG"\n', 'utf8')
  chmodSync(realOpen, 0o755)
  writeFileSync(log, '')
  installBrowserShim(dir)
})

afterEach(() => {
  resetBrowserShim()
  rmSync(dir, { recursive: true, force: true })
})

describe('installBrowserShim', () => {
  it('installs an executable for every command an agent might reach for', () => {
    for (const command of SHIMMED_COMMANDS) {
      expect(existsSync(join(dir, command))).toBe(true)
    }
  })
})

describe('the shim declines pages', () => {
  it('does not open an http URL', () => {
    const { opened, stdout } = runOpen(['http://localhost:3131'])
    expect(opened).toEqual([])
    expect(stdout).toMatch(/preview pane/)
  })

  it('does not open an https URL', () => {
    expect(runOpen(['https://example.com']).opened).toEqual([])
  })

  it('does not open an html file', () => {
    expect(runOpen(['/tmp/site/index.html']).opened).toEqual([])
  })

  it('does not open a file:// URL', () => {
    expect(runOpen(['file:///tmp/site/index.html']).opened).toEqual([])
  })

  it('recognises the page even behind flags', () => {
    expect(runOpen(['-a', 'Google Chrome', 'build/index.html']).opened).toEqual([])
  })

  it('says why, so the agent does not keep trying', () => {
    expect(runOpen(['http://localhost:5050']).stdout).toContain('http://localhost:5050')
  })
})

describe('the shim passes everything else through', () => {
  it('still reveals a folder in Finder', () => {
    expect(runOpen(['.']).opened).toEqual(['.'])
  })

  it('still opens a document', () => {
    expect(runOpen(['report.pdf']).opened).toEqual(['report.pdf'])
  })

  it('keeps the arguments intact', () => {
    expect(runOpen(['-R', '/tmp/some file.txt']).opened).toEqual(['-R', '/tmp/some file.txt'])
  })

  it('exits quietly when there is no real open to delegate to', () => {
    const stdout = execFileSync(join(dir, 'open'), ['.'], {
      env: { ...process.env, T42_REAL_OPEN: join(dir, 'does-not-exist') },
      encoding: 'utf8'
    })
    expect(stdout).toBe('')
  })
})

describe('withBrowserShim', () => {
  it('puts the shim ahead of the system path', () => {
    const env = withBrowserShim({ PATH: '/usr/bin:/bin' }, '/shim')
    expect(env.PATH).toBe(`/shim${delimiter}/usr/bin${delimiter}/bin`)
  })

  it('copes with no PATH at all', () => {
    expect(withBrowserShim({}, '/shim').PATH).toBe('/shim')
  })

  it('does not add itself twice', () => {
    const once = withBrowserShim({ PATH: '/usr/bin' }, '/shim')
    expect(withBrowserShim(once, '/shim').PATH).toBe(once.PATH)
  })

  it('leaves the rest of the environment alone', () => {
    expect(withBrowserShim({ PATH: '/usr/bin', HOME: '/me' }, '/shim').HOME).toBe('/me')
  })
})

describe('agentEnv', () => {
  it('is a no-op until a shim is installed', () => {
    resetBrowserShim()
    expect(agentEnv({ PATH: '/usr/bin' }).PATH).toBe('/usr/bin')
  })

  it('applies the installed shim', () => {
    useBrowserShim(dir)
    expect(agentEnv({ PATH: '/usr/bin' }).PATH).toBe(`${dir}${delimiter}/usr/bin`)
  })
})
