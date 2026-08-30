import { describe, it, expect } from 'vitest'
import { extractCss, extractTokens, shareReference, friendlyPath } from '../../src/shared/share'

describe('extractCss', () => {
  it('returns nothing for a document with no styles', () => {
    expect(extractCss('<html><body><p>hi</p></body></html>')).toBe('')
  })

  it('takes the body of a style block', () => {
    expect(extractCss('<style>body { margin: 0 }</style>')).toBe('body { margin: 0 }')
  })

  it('keeps several blocks in the order they appear, since later rules win', () => {
    const html = '<style>a { color: red }</style><p></p><style>a { color: blue }</style>'
    expect(extractCss(html)).toBe('a { color: red }\n\na { color: blue }')
  })

  it('ignores an empty block rather than leaving a gap', () => {
    expect(extractCss('<style></style><style>p{}</style>')).toBe('p{}')
  })

  it('reads a block that carries attributes', () => {
    expect(extractCss('<style type="text/css" media="screen">p{}</style>')).toBe('p{}')
  })

  it('is not confused by the word style elsewhere', () => {
    expect(extractCss('<div style="color:red">x</div>')).toBe('')
  })
})

describe('extractTokens', () => {
  it('reads custom properties off :root', () => {
    expect(extractTokens(':root { --primary: #d33; --space: 8px }'))
      .toEqual({ '--primary': '#d33', '--space': '8px' })
  })

  it('ignores ordinary properties', () => {
    expect(extractTokens(':root { color: red; --primary: #d33 }')).toEqual({ '--primary': '#d33' })
  })

  it('lets a later block win, as the cascade would', () => {
    expect(extractTokens(':root{--a:1}\n:root{--a:2}')).toEqual({ '--a': '2' })
  })

  it('finds nothing when there is no root block', () => {
    expect(extractTokens('body { --a: 1 }')).toEqual({})
  })

  it('handles a value that contains a colon', () => {
    expect(extractTokens(':root { --bg: url(http://x/y.png) }')).toEqual({ '--bg': 'url(http://x/y.png)' })
  })

  it('survives a trailing semicolon and stray whitespace', () => {
    expect(extractTokens(':root {\n  --a : 1 ;\n}')).toEqual({ '--a': '1' })
  })
})

describe('shareReference', () => {
  it('names the design and the version above the path', () => {
    expect(shareReference({ title: 'Nike', fileName: 'v004.html', filePath: '/d/v004.html' }))
      .toBe('Nike · v004\n/d/v004.html')
  })

  it('falls back to a name rather than a blank line', () => {
    expect(shareReference({ title: '  ', fileName: 'v001.html', filePath: '/d/v001.html' }))
      .toBe('Untitled design · v001\n/d/v001.html')
  })

  it('leaves a file name that has no extension alone', () => {
    expect(shareReference({ title: 'A', fileName: 'v001', filePath: '/d/v001' })).toBe('A · v001\n/d/v001')
  })
})

describe('friendlyPath', () => {
  it('shortens a home directory', () => {
    expect(friendlyPath('/Users/ana/designs/v1.html')).toBe('~/designs/v1.html')
  })

  it('leaves a path outside home as it is', () => {
    expect(friendlyPath('/tmp/v1.html')).toBe('/tmp/v1.html')
  })
})
