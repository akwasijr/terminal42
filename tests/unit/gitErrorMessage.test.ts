import { describe, it, expect } from 'vitest'
import { gitErrorMessage } from '../../src/renderer/src/lib/gitErrorMessage'

// These are the exact messages git produces; the panel used to show them
// verbatim. Each test asserts the user is told what to do, not what git said.

describe('gitErrorMessage for a failed push', () => {
  it('explains a credential prompt that could not be shown', () => {
    const out = "fatal: could not read Username for 'https://github.com': terminal prompts disabled"
    expect(gitErrorMessage('push', out)).toMatch(/gh auth login/)
  })

  it('explains a rejected SSH key', () => {
    expect(gitErrorMessage('push', 'git@github.com: Permission denied (publickey).')).toMatch(/SSH key/)
  })

  it('explains a repository the account cannot write to', () => {
    const out = 'remote: Permission to someone/repo.git denied to me.'
    expect(gitErrorMessage('push', out)).toMatch(/permission/i)
  })

  it('tells the user to pull when the remote is ahead', () => {
    const out = '! [rejected]  main -> main (non-fast-forward)\nhint: Updates were rejected'
    expect(gitErrorMessage('push', out)).toBe('GitHub has changes this copy does not. Pull first, then push.')
  })

  it('explains that nothing has been committed yet', () => {
    expect(gitErrorMessage('push', "error: src refspec main does not match any")).toMatch(/nothing committed/i)
  })

  it('explains being offline', () => {
    const out = "fatal: unable to access 'https://github.com/x.git/': Could not resolve host: github.com"
    expect(gitErrorMessage('push', out)).toMatch(/internet connection/)
  })

  it('never shows git jargon for a case it recognises', () => {
    const out = "fatal: could not read Username for 'https://github.com': terminal prompts disabled"
    const message = gitErrorMessage('push', out)
    expect(message).not.toMatch(/fatal|terminal prompts disabled/)
  })
})

describe('gitErrorMessage for a failed pull', () => {
  it('warns about local changes that would be lost', () => {
    const out = 'error: Your local changes to the following files would be overwritten by merge:\n\tindex.html'
    expect(gitErrorMessage('pull', out)).toMatch(/Save them first/)
  })

  it('explains a merge conflict in terms of what to do', () => {
    expect(gitErrorMessage('pull', 'CONFLICT (content): Merge conflict in index.html')).toMatch(/chat/)
  })

  it('still recognises an auth failure, which pull can hit too', () => {
    expect(gitErrorMessage('pull', 'Authentication failed for https://github.com/x.git')).toMatch(/gh auth login/)
  })
})

describe('gitErrorMessage for a failed commit', () => {
  it('explains that there was nothing to save', () => {
    expect(gitErrorMessage('commit', 'nothing to commit, working tree clean')).toBe(
      'There was nothing to save. No files have changed.'
    )
  })

  it('explains missing git identity', () => {
    expect(gitErrorMessage('commit', '*** Please tell me who you are.')).toMatch(/user\.email/)
  })
})

describe('gitErrorMessage when it does not recognise the failure', () => {
  it('says what was being attempted and keeps git own words', () => {
    const message = gitErrorMessage('push', 'fatal: the remote end hung up unexpectedly')
    expect(message).toContain('Could not send your changes to GitHub.')
    expect(message).toContain('the remote end hung up unexpectedly')
  })

  it('drops the fatal prefix rather than showing it', () => {
    expect(gitErrorMessage('commit', 'fatal: some new failure')).not.toMatch(/fatal:/)
  })

  it('ignores noise lines and keeps the reason', () => {
    const out = 'To https://github.com/x.git\nremote: some banner\nfatal: real reason here'
    expect(gitErrorMessage('push', out)).toContain('real reason here')
  })

  it('still says something useful when git said nothing at all', () => {
    expect(gitErrorMessage('pull', '   \n  ')).toBe('Could not get the latest from GitHub.')
  })

  it('does not run on and on', () => {
    expect(gitErrorMessage('push', 'fatal: ' + 'x'.repeat(500)).length).toBeLessThan(230)
  })
})

describe('gitErrorMessage for setup steps', () => {
  it('explains a remote that is already connected', () => {
    expect(gitErrorMessage('remote', "error: remote origin already exists.")).toBe(
      'This project is already connected to a remote.'
    )
  })

  it('explains a bad repository URL', () => {
    expect(gitErrorMessage('remote', 'fatal: invalid URL')).toMatch(/repository URL/)
  })
})
