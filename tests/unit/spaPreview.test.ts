import { describe, expect, it } from 'vitest'

import { looksLikeSpa } from '../../src/shared/spa'
import { contentType, isRoute, requestPath } from '../../src/main/spa'

const page = (body: string, head = ''): string =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`

describe('telling an app apart from a page', () => {
  it('sees an app in an empty mount point with a script to fill it', () => {
    // This is the shape that cannot work in srcDoc: there is nothing to show
    // until the script runs, and the script hands over to a router.
    expect(looksLikeSpa(page('<div id="root"></div><script src="./app.js"></script>'))).toBe(true)
    expect(looksLikeSpa(page('<div id="app"></div><script type="module">go()</script>'))).toBe(true)
    expect(looksLikeSpa(page('<div id="__next"></div><script src="/x.js"></script>'))).toBe(true)
  })

  it('leaves a page alone, whatever it has on it', () => {
    expect(looksLikeSpa(page('<h1>Prices</h1><p>From £9</p>'))).toBe(false)
    // A page with a script on it is still a page.
    expect(looksLikeSpa(page('<h1>Prices</h1><script src="./a.js"></script>'))).toBe(false)
  })

  it('leaves a mount point that already has something in it', () => {
    // Server-rendered: it has something to show whatever the router decides,
    // so it is not blank, so it does not need an address.
    expect(looksLikeSpa(page('<div id="root"><h1>Prices</h1></div><script src="./a.js"></script>')))
      .toBe(false)
  })

  it('does not call a bare mount point an app when nothing will fill it', () => {
    expect(looksLikeSpa(page('<div id="root"></div>'))).toBe(false)
  })

  it('is not fooled by comments or whitespace standing in for content', () => {
    expect(looksLikeSpa(page('\n  <div id="root">\n  </div>\n  <!-- built -->\n  <script src="a.js"></script>')))
      .toBe(true)
  })

  it('judges the shape rather than the name of the library', () => {
    // A bundler renames createBrowserRouter and drops the package name. It
    // cannot rename an empty <div id="root">, which is why that is the test.
    const minified = page('<div id="root"></div><script>var a=1;</script>')
    expect(minified).not.toMatch(/react-router|BrowserRouter/)
    expect(looksLikeSpa(minified)).toBe(true)
  })
})

describe('what a request is asking for', () => {
  it('reads the path out of the url', () => {
    expect(requestPath('/assets/app.js')).toBe('assets/app.js')
    expect(requestPath('/')).toBe('')
    expect(requestPath('/pricing?x=1#y')).toBe('pricing')
  })

  it('refuses an encoded climb out of the design directory', () => {
    // The server hands out one directory. Percent-encoding is how a climb is
    // smuggled past a check that runs before decoding, so the check runs
    // after -- and refuses rather than resolves, because no honest asset
    // path has a `..` in it. A `%2f` decodes into a separator, so the split
    // happens after decoding too, or `..%2fb` would pass as one segment.
    expect(requestPath('/a/%2e%2e%2fb')).toBeNull()
    expect(requestPath('/x%00.png')).toBeNull()
  })

  it('never gives back a path that leaves the directory', () => {
    // A plain `..` never reaches the check: parsing the URL clamps it at the
    // root first. That is the same guarantee by a different route, so this
    // asserts the guarantee rather than the mechanism.
    const probes = [
      '/../../.ssh/id_rsa', '/assets/../../secrets', '/a/../b.png',
      '/./../..//x', '/%2e%2e/y', '/....//x', '/%2e%2e/%2e%2e/etc/passwd',
      // Backslashes, which join() would honour as separators on Windows.
      '/..\\..\\x', '/a\\..\\..\\b'
    ]
    for (const probe of probes) {
      const path = requestPath(probe)
      if (path === null) continue
      expect(path.startsWith('/')).toBe(false)
      expect(path.split('/')).not.toContain('..')
    }
  })
})

describe('a route is answered with the app, a file with the file', () => {
  it('calls anything without an extension a route', () => {
    expect(isRoute('')).toBe(true)
    expect(isRoute('pricing')).toBe(true)
    expect(isRoute('projects/42')).toBe(true)
  })

  it('calls anything with one a file', () => {
    expect(isRoute('assets/app.js')).toBe(false)
    expect(isRoute('logo.svg')).toBe(false)
    expect(isRoute('index.html')).toBe(false)
  })
})

describe('what the server says a file is', () => {
  it('names the types a design actually ships', () => {
    expect(contentType('/a/app.js')).toBe('text/javascript; charset=utf-8')
    expect(contentType('/a.css')).toBe('text/css; charset=utf-8')
    expect(contentType('/f.woff2')).toBe('font/woff2')
    expect(contentType('/i.svg')).toBe('image/svg+xml')
  })

  it('says bytes rather than guessing', () => {
    expect(contentType('/thing.unknownext')).toBe('application/octet-stream')
    expect(contentType('/noextension')).toBe('application/octet-stream')
  })
})
