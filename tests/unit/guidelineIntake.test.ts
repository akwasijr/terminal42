import { describe, it, expect } from 'vitest'
import {
  shouldSkip, isCheckable, isDesignSource, isShell, designSources, entryFile,
  parseGithubUrl, cloneUrl, projectName
} from '../../src/shared/guidelineIntake'

describe('shouldSkip', () => {
  it('skips dependencies and build output', () => {
    expect(shouldSkip('node_modules/react/index.js')).toBe(true)
    expect(shouldSkip('dist/app.css')).toBe(true)
    expect(shouldSkip('packages/ui/node_modules/a.css')).toBe(true)
  })

  it('skips hidden directories', () => {
    expect(shouldSkip('.git/config')).toBe(true)
    expect(shouldSkip('.next/static/a.css')).toBe(true)
  })

  it('keeps ordinary source', () => {
    expect(shouldSkip('src/components/Button.tsx')).toBe(false)
    expect(shouldSkip('index.html')).toBe(false)
  })
})

describe('isCheckable', () => {
  it('accepts the kinds the rules can judge', () => {
    expect(isCheckable('src/App.tsx')).toBe(true)
    expect(isCheckable('styles/app.css')).toBe(true)
    expect(isCheckable('index.html')).toBe(true)
  })

  it('rejects files the rules say nothing about', () => {
    expect(isCheckable('README.md')).toBe(false)
    expect(isCheckable('logo.png')).toBe(false)
    expect(isCheckable('server.js')).toBe(false)
  })

  it('rejects minified output, which nobody wrote by hand', () => {
    expect(isCheckable('app.min.css')).toBe(false)
  })

  it('rejects anything inside a skipped directory', () => {
    expect(isCheckable('node_modules/x/a.css')).toBe(false)
  })
})

describe('entryFile', () => {
  it('prefers an index page', () => {
    expect(entryFile(['about.html', 'index.html'])).toBe('index.html')
  })

  it('prefers the shallowest index', () => {
    expect(entryFile(['src/pages/index.html', 'index.html'])).toBe('index.html')
  })

  it('takes the shallowest page when there is no index', () => {
    expect(entryFile(['deep/nested/a.html', 'about.html'])).toBe('about.html')
  })

  it('is settled between equals rather than arbitrary', () => {
    expect(entryFile(['b.html', 'a.html'])).toBe('a.html')
  })

  it('has no answer when there are no pages', () => {
    expect(entryFile(['a.css', 'b.tsx'])).toBeNull()
  })
})

describe('parseGithubUrl', () => {
  it('reads a repository address', () => {
    expect(parseGithubUrl('https://github.com/vercel/next.js')).toEqual({ owner: 'vercel', repo: 'next.js' })
  })

  it('reads one with a trailing .git', () => {
    expect(parseGithubUrl('https://github.com/a/b.git')).toEqual({ owner: 'a', repo: 'b' })
  })

  it('reads an ssh address', () => {
    expect(parseGithubUrl('git@github.com:a/b.git')).toEqual({ owner: 'a', repo: 'b' })
  })

  it('reads a bare owner/repo', () => {
    expect(parseGithubUrl('a/b')).toEqual({ owner: 'a', repo: 'b' })
  })

  it('accepts an address with no scheme', () => {
    expect(parseGithubUrl('github.com/a/b')).toEqual({ owner: 'a', repo: 'b' })
  })

  it('keeps the branch when the link points at one', () => {
    expect(parseGithubUrl('https://github.com/a/b/tree/main')).toEqual({ owner: 'a', repo: 'b', ref: 'main' })
  })

  it('discards the path below a branch, which is what people paste', () => {
    expect(parseGithubUrl('https://github.com/a/b/blob/dev/src/App.tsx'))
      .toEqual({ owner: 'a', repo: 'b', ref: 'dev' })
  })

  it('ignores whitespace around a pasted link', () => {
    expect(parseGithubUrl('  https://github.com/a/b  ')).toEqual({ owner: 'a', repo: 'b' })
  })

  it('refuses anything that is not GitHub', () => {
    expect(parseGithubUrl('https://gitlab.com/a/b')).toBeNull()
    expect(parseGithubUrl('https://evil.com/github.com/a/b')).toBeNull()
  })

  it('refuses a name that is not a name, so nothing pasted reaches a command', () => {
    expect(parseGithubUrl('https://github.com/../..')).toBeNull()
    expect(parseGithubUrl('https://github.com/a b/c')).toBeNull()
    expect(parseGithubUrl('git@github.com:a/$(whoami)')).toBeNull()
  })

  it('never produces a branch that could climb out of the checkout', () => {
    for (const url of [
      'https://github.com/a/b/tree/../../x',
      'https://github.com/a/b/tree/%2e%2e%2f%2e%2e',
      'https://github.com/a/b/tree/..'
    ]) {
      const r = parseGithubUrl(url)
      expect(r?.ref ?? '', url).not.toContain('..')
    }
  })

  it('still accepts the names people really have', () => {
    expect(parseGithubUrl('https://github.com/vercel/next.js')).toEqual({ owner: 'vercel', repo: 'next.js' })
    expect(parseGithubUrl('https://github.com/my-org/my_repo.v2')).toEqual({ owner: 'my-org', repo: 'my_repo.v2' })
    expect(parseGithubUrl('https://github.com/a/b/tree/main')).toEqual({ owner: 'a', repo: 'b', ref: 'main' })
  })

  it('takes only the first segment of a branch, since a path looks the same', () => {
    // A slashed branch and a file inside a branch are indistinguishable in an
    // address. The shorter reading fails at the checkout instead of silently
    // reporting on whatever the longer one happened to match.
    expect(parseGithubUrl('https://github.com/a/b/blob/main/src/App.tsx'))
      .toEqual({ owner: 'a', repo: 'b', ref: 'main' })
  })

  it('refuses an address with no repository', () => {
    expect(parseGithubUrl('https://github.com/a')).toBeNull()
    expect(parseGithubUrl('')).toBeNull()
    expect(parseGithubUrl('not a url')).toBeNull()
  })
})

describe('cloneUrl', () => {
  it('builds the address from the parsed parts, never the pasted text', () => {
    expect(cloneUrl({ owner: 'a', repo: 'b' })).toBe('https://github.com/a/b.git')
  })

  it('escapes a name, so a parsed part can never open a path of its own', () => {
    expect(cloneUrl({ owner: 'a/b', repo: 'c' })).toBe('https://github.com/a%2Fb/c.git')
  })
})

describe('projectName', () => {
  it('names a repository by owner and repo', () => {
    expect(projectName({ kind: 'github', repo: { owner: 'a', repo: 'b' } })).toBe('a/b')
  })

  it('names a folder by its last part', () => {
    expect(projectName({ kind: 'folder', path: '/Users/me/my-site' })).toBe('my-site')
  })

  it('ignores a trailing slash', () => {
    expect(projectName({ kind: 'folder', path: '/Users/me/my-site/' })).toBe('my-site')
  })
})

describe('isShell', () => {
  it('calls a React mount point a shell', () => {
    expect(isShell(`<!DOCTYPE html><html><head><title>React App</title></head>
      <body><noscript>You need to enable JavaScript to run this app.</noscript>
      <div id="root"></div></body></html>`)).toBe(true)
  })

  it('calls a Vite mount point a shell', () => {
    expect(isShell('<html><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>'))
      .toBe(true)
  })

  it('does not call a real page a shell', () => {
    expect(isShell('<html><body><h1>Trainers for men</h1><p>Every pair, every size.</p></body></html>'))
      .toBe(false)
  })

  it('does not call a page of pictures a shell', () => {
    expect(isShell('<html><body><img src="a.png"><img src="b.png"></body></html>')).toBe(false)
  })

  it('ignores what is inside a comment or a script', () => {
    expect(isShell('<body><!-- a long comment about the design of this page --><script>const a = "hello there everyone"</script><div id="root"></div></body>'))
      .toBe(true)
  })
})

describe('isDesignSource', () => {
  it('carries plain js and ts that the scanner has no rules for', () => {
    expect(isDesignSource('src/App.js')).toBe(true)
    expect(isDesignSource('src/theme.ts')).toBe(true)
  })

  it('still refuses what should be skipped', () => {
    expect(isDesignSource('node_modules/react/index.js')).toBe(false)
    expect(isDesignSource('dist/bundle.min.js')).toBe(false)
  })

  it('refuses what is not source at all', () => {
    expect(isDesignSource('README.md')).toBe(false)
  })
})

describe('designSources', () => {
  const f = (path: string, text = 'body { color: red }'): { path: string; text: string } => ({ path, text })

  it('puts stylesheets first, then the components nearest the top', () => {
    const picked = designSources(
      [f('src/components/deep/Widget.jsx'), f('src/App.jsx'), f('src/index.css')],
      null
    )
    expect(picked.map((p) => p.path)).toEqual(['src/index.css', 'src/App.jsx', 'src/components/deep/Widget.jsx'])
  })

  it('leaves the entry out, since it is already the page', () => {
    const picked = designSources([f('index.html'), f('a.css')], 'index.html')
    expect(picked.map((p) => p.path)).toEqual(['a.css'])
  })

  it('takes a plain js file that returns markup', () => {
    const picked = designSources([f('src/App.js', 'function App() { return <h1>Hi</h1> }')], null)
    expect(picked.map((p) => p.path)).toEqual(['src/App.js'])
  })

  it('leaves a plain js file that renders nothing', () => {
    expect(designSources([f('src/config.js', 'export const API = "/x"')], null)).toEqual([])
  })

  it('stops at the file limit', () => {
    const many = Array.from({ length: 30 }, (_, i) => f(`s${i}.css`))
    expect(designSources(many, null, { files: 4 })).toHaveLength(4)
  })

  it('stops at the byte limit', () => {
    const big = [f('a.css', 'x'.repeat(900)), f('b.css', 'y'.repeat(50))]
    const picked = designSources(big, null, { bytes: 1000 })
    expect(picked.map((p) => p.path)).toEqual(['a.css', 'b.css'])
    expect(designSources(big, null, { bytes: 500 }).map((p) => p.path)).toEqual(['b.css'])
  })
})
