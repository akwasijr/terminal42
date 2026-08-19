import { describe, it, expect } from 'vitest'
import { copilotLauncherCandidates, pickCopilotLauncher } from '../../src/main/copilotCli'

describe('pickCopilotLauncher', () => {
  it('takes the first candidate that exists', () => {
    const picked = pickCopilotLauncher(['/a/copilot', '/b/copilot'], (p) => p === '/b/copilot')
    expect(picked).toBe('/b/copilot')
  })

  it('rejects a .js path even when it exists', () => {
    // A .js path sends the SDK back to spawn(process.execPath, [script]),
    // which is the Electron-identity problem this whole module exists to
    // avoid -- so it is worse than finding nothing.
    const picked = pickCopilotLauncher(['/a/npm-loader.js', '/b/copilot'], () => true)
    expect(picked).toBe('/b/copilot')
  })

  it('returns null rather than guessing when nothing exists', () => {
    // Null is safe: it just leaves the SDK on its previous behaviour.
    expect(pickCopilotLauncher(['/a/copilot'], () => false)).toBeNull()
  })

  it('ignores empty candidates', () => {
    expect(pickCopilotLauncher(['', '/b/copilot'], (p) => p === '/b/copilot')).toBe('/b/copilot')
  })

  it('handles an empty candidate list', () => {
    expect(pickCopilotLauncher([], () => true)).toBeNull()
  })
})

describe('copilotLauncherCandidates', () => {
  const listDir = (p: string): string[] =>
    p.endsWith('/.nvm/versions/node') ? ['v18.20.0', 'v22.18.0', 'v20.11.0'] : []

  it('honours an explicit COPILOT_CLI_PATH first', () => {
    const c = copilotLauncherCandidates({ COPILOT_CLI_PATH: '/custom/copilot' }, '/home/u', listDir)
    expect(c[0]).toBe('/custom/copilot')
  })

  it('prefers the newest installed node version', () => {
    const c = copilotLauncherCandidates({}, '/home/u', listDir)
    const nvm = c.filter((p) => p.includes('/.nvm/'))
    expect(nvm[0]).toBe('/home/u/.nvm/versions/node/v22.18.0/bin/copilot')
  })

  it('still offers system locations when nvm is absent', () => {
    // A GUI-launched app has a minimal PATH, so these fixed paths are the
    // fallback rather than a PATH lookup.
    const c = copilotLauncherCandidates({}, '/home/u', () => [])
    expect(c).toContain('/opt/homebrew/bin/copilot')
    expect(c).toContain('/usr/local/bin/copilot')
  })

  it('survives an unreadable nvm directory', () => {
    const c = copilotLauncherCandidates({}, '/home/u', () => {
      throw new Error('EACCES')
    })
    // Losing the nvm candidates must not cost us the system ones as well.
    expect(c).toContain('/opt/homebrew/bin/copilot')
  })

  it('never proposes a .js entry point', () => {
    const c = copilotLauncherCandidates({}, '/home/u', listDir)
    expect(c.filter((p) => p.endsWith('.js'))).toHaveLength(0)
  })
})
