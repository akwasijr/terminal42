/**
 * A version's own <base> is honoured, not overruled.
 *
 * Design HTML is rendered through srcDoc, where a browser resolves relative
 * URLs against about:srcdoc and every local asset breaks. So the design's
 * directory is injected as a <base>.
 *
 * The bug: a document may already declare its own base. A built starter
 * template does — "./dist/", because that is where its assets are. Injecting
 * ours in front of it did not add to that, it replaced it, since the first
 * <base> with an href is the only one that counts. Assets were looked for one
 * directory too high and the page rendered blank; you got taken to a project
 * that showed nothing.
 *
 * These exercise the rewriting rule directly, because it is the rule that was
 * wrong rather than the plumbing around it.
 */
import { describe, expect, it } from 'vitest'
import { applyBaseHref as applyBase, effectiveBase, inlineLocalAssets } from '../../src/main/versionBase'

const DIR = 'file:///designs/abc/'

describe('a document with no base of its own', () => {
  it('gets the design directory', () => {
    const out = applyBase('<html><head><title>x</title></head></html>', DIR)
    expect(out).toContain(`<base href="${DIR}">`)
  })

  it('puts it first in the head, before anything that might load', () => {
    const out = applyBase('<head><link href="a.css"></head>', DIR)
    expect(out.indexOf('<base')).toBeLessThan(out.indexOf('<link'))
  })

  it('still gets one when there is no head at all', () => {
    expect(applyBase('<p>hi</p>', DIR)).toBe(`<base href="${DIR}">` + '<p>hi</p>')
  })

  it('keeps attributes on the head tag', () => {
    expect(applyBase('<head lang="en"></head>', DIR)).toContain('<head lang="en"><base')
  })
})

describe('a document that declares its own base', () => {
  it('resolves "./dist/" against the design directory instead of replacing it', () => {
    const out = applyBase('<head><base href="./dist/"></head>', DIR)
    expect(out).toContain('<base href="file:///designs/abc/dist/">')
  })

  it('does not end up with two bases, where the first would win', () => {
    const out = applyBase('<head><base href="./dist/"></head>', DIR)
    expect(out.match(/<base/g) ?? []).toHaveLength(1)
  })

  it('makes the assets of a built starter resolvable', () => {
    // ./dist/ + ./assets/index.js is where a Vite build actually puts them.
    const out = applyBase('<head><base href="./dist/"><script src="./assets/index.js"></script></head>', DIR)
    const base = /<base href="([^"]+)">/.exec(out)![1]
    expect(new URL('./assets/index.js', base).toString()).toBe('file:///designs/abc/dist/assets/index.js')
  })

  it('handles a nested relative base', () => {
    expect(applyBase('<head><base href="build/out/"></head>', DIR))
      .toContain('<base href="file:///designs/abc/build/out/">')
  })

  it('reads a base written with single quotes or extra attributes', () => {
    expect(applyBase("<head><base target='_top' href='./dist/'></head>", DIR))
      .toContain('<base href="file:///designs/abc/dist/">')
  })

  it('leaves an absolute base alone, since that is a deliberate choice', () => {
    const html = '<head><base href="https://cdn.example.com/"></head>'
    expect(applyBase(html, DIR)).toBe(html)
  })

  it('leaves a protocol-relative base alone', () => {
    const html = '<head><base href="//cdn.example.com/"></head>'
    expect(applyBase(html, DIR)).toBe(html)
  })

  it('leaves a base that is already a file URL alone', () => {
    const html = '<head><base href="file:///elsewhere/"></head>'
    expect(applyBase(html, DIR)).toBe(html)
  })
})

describe('no design directory to resolve against', () => {
  it('changes nothing rather than writing an empty base', () => {
    const html = '<head><base href="./dist/"></head>'
    expect(applyBase(html, '')).toBe(html)
  })
})

describe('inlining a design\u2019s own scripts and styles', () => {
  const base = 'file:///designs/abc/dist/'
  const files: Record<string, string> = {
    'file:///designs/abc/dist/assets/index.js': 'console.log(1)',
    'file:///designs/abc/dist/assets/index.css': 'body{color:red}'
  }
  const read = async (u: string): Promise<string | null> => files[u] ?? null

  it('pulls a local module script into the document', async () => {
    // srcDoc sits inside a page served over http, so a file:// script is
    // refused as cross-origin and never runs. The page then renders as an
    // empty root with nothing to say why.
    const out = await inlineLocalAssets(
      '<script type="module" crossorigin src="./assets/index.js"></script>', base, read
    )
    expect(out).toBe('<script type="module">console.log(1)</script>')
  })

  it('pulls a local stylesheet in', async () => {
    const out = await inlineLocalAssets(
      '<link rel="stylesheet" crossorigin href="./assets/index.css">', base, read
    )
    expect(out).toBe('<style>body{color:red}</style>')
  })

  it('does not treat $& in a minified bundle as a backreference', async () => {
    // A string replacement expands `$&` to the matched text, which corrupted
    // the bundle and spilled it into the page as visible source.
    const tricky = { 'file:///designs/abc/dist/a.js': 'x=$&+$`+$\'+$$' }
    const out = await inlineLocalAssets(
      '<script src="./a.js"></script>', base, async (u) => tricky[u as keyof typeof tricky] ?? null
    )
    expect(out).toBe('<script>x=$&+$`+$\'+$$</script>')
  })

  it('escapes a closing tag inside the payload so it cannot end the element', async () => {
    const out = await inlineLocalAssets(
      '<script src="./a.js"></script>', base,
      async () => 'var s="</script>"'
    )
    expect(out).toBe('<script>var s="<\\/script>"</script>')
  })

  it('leaves a remote script alone, because it can be fetched', async () => {
    const html = '<script src="https://cdn.example.com/x.js"></script>'
    expect(await inlineLocalAssets(html, base, read)).toBe(html)
  })

  it('leaves a remote stylesheet alone', async () => {
    const html = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">'
    expect(await inlineLocalAssets(html, base, read)).toBe(html)
  })

  it('leaves a preconnect or icon link alone', async () => {
    const html = '<link rel="preconnect" href="./x"><link rel="icon" href="./vite.svg">'
    expect(await inlineLocalAssets(html, base, read)).toBe(html)
  })

  it('leaves a reference it cannot read exactly as it was', async () => {
    // A page missing one stylesheet is worth more than no page.
    const html = '<link rel="stylesheet" href="./missing.css">'
    expect(await inlineLocalAssets(html, base, read)).toBe(html)
  })

  it('changes nothing for a single-file design', async () => {
    const html = '<html><head><style>a{}</style></head><body>hi</body></html>'
    expect(await inlineLocalAssets(html, base, read)).toBe(html)
  })

  it('does nothing without a base to resolve against', async () => {
    const html = '<script src="./assets/index.js"></script>'
    expect(await inlineLocalAssets(html, '', read)).toBe(html)
  })

  it('handles a document with both, in one pass', async () => {
    const out = await inlineLocalAssets(
      '<head><link rel="stylesheet" href="./assets/index.css"><script type="module" src="./assets/index.js"></script></head>',
      base, read
    )
    expect(out).toContain('<style>body{color:red}</style>')
    expect(out).toContain('<script type="module">console.log(1)</script>')
  })
})

describe('effectiveBase', () => {
  it('reports the base the document ended up with', () => {
    const based = applyBase('<head><base href="./dist/"></head>', DIR)
    expect(effectiveBase(based, DIR)).toBe('file:///designs/abc/dist/')
  })

  it('falls back to the design directory when there is no base', () => {
    expect(effectiveBase('<p>hi</p>', DIR)).toBe(DIR)
  })
})
