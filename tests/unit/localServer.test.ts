import { describe, it, expect } from 'vitest'
import {
  localServerOrigins,
  pickLocalServerOrigin,
  serverUrlCandidates,
  resolveServerUrl
} from '../../src/shared/localServer'

describe('localServerOrigins', () => {
  it('reads the address the turn announced', () => {
    expect(localServerOrigins('Status page is live at http://localhost:3131 🟢')).toEqual([
      'http://localhost:3131'
    ])
  })

  it('treats the loopback spellings as the same thing', () => {
    expect(localServerOrigins('http://127.0.0.1:8080 and http://localhost:8080')).toEqual([
      'http://localhost:8080'
    ])
  })

  // A server bound to 0.0.0.0 is not reachable at that address from a browser.
  it('rewrites a wildcard bind to localhost', () => {
    expect(localServerOrigins('Serving on http://0.0.0.0:5000')).toEqual(['http://localhost:5000'])
  })

  it('keeps distinct ports in the order they appeared', () => {
    expect(localServerOrigins('tried http://localhost:3000, moved to http://localhost:3001')).toEqual([
      'http://localhost:3000',
      'http://localhost:3001'
    ])
  })

  it('ignores remote addresses', () => {
    expect(localServerOrigins('deployed to https://example.com:443/status')).toEqual([])
  })

  it('ignores a local URL with no port, which we cannot address', () => {
    expect(localServerOrigins('see http://localhost/docs')).toEqual([])
  })

  it('stops at the end of the URL rather than swallowing the sentence', () => {
    expect(localServerOrigins('open http://localhost:3131/status, then refresh')).toEqual([
      'http://localhost:3131'
    ])
  })

  it('rejects an out-of-range port', () => {
    expect(localServerOrigins('http://localhost:99999')).toEqual([])
  })

  it('returns nothing for empty input', () => {
    expect(localServerOrigins('')).toEqual([])
  })
})

describe('pickLocalServerOrigin', () => {
  // A turn that hits a port collision prints the port it settled on last.
  it('prefers the last address mentioned', () => {
    expect(pickLocalServerOrigin('EADDRINUSE http://localhost:3000 — using http://localhost:3001')).toBe(
      'http://localhost:3001'
    )
  })

  it('is null when the turn started no server', () => {
    expect(pickLocalServerOrigin('Wrote index.html')).toBe(null)
  })
})

describe('serverUrlCandidates', () => {
  it('offers the sub-path before the root', () => {
    expect(serverUrlCandidates('http://localhost:3131', '/home/me', '/home/me/site/page.html')).toEqual([
      'http://localhost:3131/site/page.html',
      'http://localhost:3131/'
    ])
  })

  it('asks only for the root when the page is an index', () => {
    expect(
      serverUrlCandidates('http://localhost:3131', '/home/me', '/home/me/index.html')
    ).toEqual(['http://localhost:3131/'])
  })

  it('asks only for the root when the page is outside the working directory', () => {
    expect(serverUrlCandidates('http://localhost:3131', '/home/me', '/tmp/other.html')).toEqual([
      'http://localhost:3131/'
    ])
  })

  it('accepts a relative path', () => {
    expect(serverUrlCandidates('http://localhost:3131', '/home/me', './about.html')).toEqual([
      'http://localhost:3131/about.html',
      'http://localhost:3131/'
    ])
  })

  it('encodes a segment with a space', () => {
    expect(serverUrlCandidates('http://localhost:3131', '/home/me', 'my page.html')[0]).toBe(
      'http://localhost:3131/my%20page.html'
    )
  })

  it('does not double the slash after the origin', () => {
    expect(serverUrlCandidates('http://localhost:3131/', '/home/me', 'a.html')[0]).toBe(
      'http://localhost:3131/a.html'
    )
  })
})

describe('resolveServerUrl', () => {
  it('uses the sub-path when the server serves it', async () => {
    const url = await resolveServerUrl('http://localhost:3131', '/home/me', '/home/me/site/p.html', async () => true)
    expect(url).toBe('http://localhost:3131/site/p.html')
  })

  // The real case: `node server.js` run inside statuspage/ serves the page at
  // the root, so the deeper path 404s and the root is correct.
  it('falls back to the root when the sub-path is not served', async () => {
    const seen: string[] = []
    const url = await resolveServerUrl(
      'http://localhost:3131',
      '/home/me',
      '/home/me/statuspage/index.html',
      async (u) => { seen.push(u); return u.endsWith('/') }
    )
    expect(url).toBe('http://localhost:3131/')
    expect(seen).toEqual(['http://localhost:3131/statuspage/index.html', 'http://localhost:3131/'])
  })

  // Null is what makes the caller show the file instead of a connection error.
  it('is null when the server answers nothing', async () => {
    expect(await resolveServerUrl('http://localhost:9', '/home/me', 'a.html', async () => false)).toBe(null)
  })

  it('is null, not a crash, when the probe throws', async () => {
    expect(
      await resolveServerUrl('http://localhost:9', '/home/me', 'a.html', async () => {
        throw new Error('ECONNREFUSED')
      })
    ).toBe(null)
  })

  it('stops probing once a candidate answers', async () => {
    let calls = 0
    await resolveServerUrl('http://localhost:3131', '/home/me', 'site/p.html', async () => { calls++; return true })
    expect(calls).toBe(1)
  })
})
