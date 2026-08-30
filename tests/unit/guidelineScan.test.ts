import { describe, it, expect } from 'vitest'
import { scanProject, fileKind, type Finding } from '../../src/shared/guidelineScan'
import { GUIDELINES, GUIDELINE_GROUPS, guidelinesFor, guideline, groupOf } from '../../src/shared/guidelines'

const found = (fs: Finding[], id: string): Finding | undefined => fs.find((f) => f.id === id)
const ids = (fs: Finding[]): string[] => fs.map((f) => f.id)

const html = (body: string, head = ''): string =>
  `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`

describe('the catalogue', () => {
  it('gives every rule a group that exists', () => {
    const groups = new Set(GUIDELINE_GROUPS.map((g) => g.id))
    for (const g of GUIDELINES) expect(groups.has(g.group), g.id).toBe(true)
  })

  it('has no duplicate rule ids', () => {
    expect(new Set(GUIDELINES.map((g) => g.id)).size).toBe(GUIDELINES.length)
  })

  it('says what to do, not only what is wrong', () => {
    for (const g of GUIDELINES) expect(g.fix.length, g.id).toBeGreaterThan(10)
  })

  it('keeps every label short enough to read at a glance', () => {
    for (const g of GUIDELINES) expect(g.label.length, g.id).toBeLessThan(46)
  })

  it('covers every group', () => {
    for (const grp of GUIDELINE_GROUPS) {
      expect(GUIDELINES.some((g) => g.group === grp.id), grp.id).toBe(true)
    }
  })

  it('looks rules up by id and group', () => {
    expect(guideline('inline-styles')?.group).toBe('anti-ai')
    expect(guideline('nope')).toBeUndefined()
    expect(groupOf('a11y')?.label).toBe('Accessibility')
  })

  it('selects the rules that apply to a kind of file', () => {
    expect(guidelinesFor('css').every((g) => g.applies.includes('css'))).toBe(true)
    expect(guidelinesFor('html').length).toBeGreaterThan(5)
  })

  it('reports only rules that are in the catalogue', () => {
    const known = new Set(GUIDELINES.map((g) => g.id))
    const fs = scanProject([{ path: 'a.html', text: html('<div><div><div><div>x</div></div></div></div>') }])
    for (const f of fs) expect(known.has(f.id), f.id).toBe(true)
  })
})

describe('fileKind', () => {
  it('recognises the kinds it can check', () => {
    expect(fileKind('a.html')).toBe('html')
    expect(fileKind('a.CSS')).toBe('css')
    expect(fileKind('a.tsx')).toBe('jsx')
    expect(fileKind('a.svelte')).toBe('jsx')
  })

  it('ignores anything it cannot judge', () => {
    expect(fileKind('a.png')).toBeNull()
    expect(fileKind('README')).toBeNull()
  })
})

describe('scanning markup', () => {
  it('finds nothing in an empty project', () => {
    expect(scanProject([])).toEqual([])
  })

  it('counts a run of four divs as soup', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<div><div><div><div>x</div></div></div></div>') }])
    expect(found(fs, 'div-soup')?.count).toBe(1)
  })

  it('leaves three divs alone', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<div><div><div>x</div></div></div>') }])
    expect(found(fs, 'div-soup')).toBeUndefined()
  })

  it('does not count divs separated by a semantic element', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<div><div><section><div><div>x</div></div></section></div></div>') }])
    expect(found(fs, 'div-soup')).toBeUndefined()
  })

  it('counts inline styles in markup and in JSX', () => {
    const fs = scanProject([
      { path: 'a.html', text: html('<p style="color:red">x</p>') },
      { path: 'b.tsx', text: '<p style={{ color: "red" }}>x</p>' }
    ])
    expect(found(fs, 'inline-styles')?.count).toBe(2)
  })

  it('reports the line an inline style was on', () => {
    const fs = scanProject([{ path: 'a.html', text: '<html lang="en"><body>\n<p style="color:red">x</p>\n</body></html>' }])
    expect(found(fs, 'inline-styles')?.example).toContain('style="color:red"')
  })

  it('catches a div pretending to be a button', () => {
    const fs = scanProject([{ path: 'a.tsx', text: '<div onClick={go}>Save</div>' }])
    expect(found(fs, 'div-button')?.count).toBe(1)
  })

  it('leaves a real button alone', () => {
    const fs = scanProject([{ path: 'a.tsx', text: '<button onClick={go}>Save</button>' }])
    expect(found(fs, 'div-button')).toBeUndefined()
  })

  it('spots an emoji standing in for an icon', () => {
    const fs = scanProject([{ path: 'a.tsx', text: '<span>\u{1F680} Fast</span>' }])
    expect(found(fs, 'emoji-icons')?.count).toBe(1)
  })

  it('spots a positive tabindex but not zero', () => {
    const a = scanProject([{ path: 'a.html', text: html('<div tabindex="3">x</div>') }])
    const b = scanProject([{ path: 'b.html', text: html('<div tabindex="0">x</div>') }])
    expect(found(a, 'positive-tabindex')?.count).toBe(1)
    expect(found(b, 'positive-tabindex')).toBeUndefined()
  })

  it('spots a role an element already had', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<button role="button">x</button>') }])
    expect(found(fs, 'redundant-role')?.count).toBe(1)
  })

  it('spots a link with no href', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<a>Go</a>') }])
    expect(found(fs, 'href-less-link')?.count).toBe(1)
  })

  it('leaves a link that has an href', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<a href="/x">Go</a>') }])
    expect(found(fs, 'href-less-link')).toBeUndefined()
  })

  it('spots an input with nothing naming it', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<input type="email" placeholder="Email">') }])
    expect(found(fs, 'unlabelled-input')?.count).toBe(1)
  })

  it('accepts an input that a label can point at', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<label for="e">Email</label><input id="e">') }])
    expect(found(fs, 'unlabelled-input')).toBeUndefined()
  })

  it('does not ask a submit button for a label', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<input type="submit" value="Go">') }])
    expect(found(fs, 'unlabelled-input')).toBeUndefined()
  })

  it('spots an image with no alt but accepts a decorative one', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<img src="a.png"><img src="b.png" alt="">') }])
    expect(found(fs, 'missing-alt')?.count).toBe(1)
  })

  it('asks images for dimensions', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<img src="a.png" alt="a">') }])
    expect(found(fs, 'no-dimensions')?.count).toBe(1)
  })

  it('asks about lazy loading only where there are images', () => {
    const withImg = scanProject([{ path: 'a.html', text: html('<img src="a.png" alt="a">') }])
    const without = scanProject([{ path: 'b.html', text: html('<p>x</p>') }])
    expect(ids(withImg)).toContain('no-lazy')
    expect(ids(without)).not.toContain('no-lazy')
  })

  it('is satisfied by a modern image format', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<img src="a.webp" alt="a" loading="lazy">') }])
    expect(ids(fs)).not.toContain('legacy-format')
  })

  it('spots a render blocking script but not a deferred one', () => {
    const a = scanProject([{ path: 'a.html', text: html('<script src="a.js"></script>') }])
    const b = scanProject([{ path: 'b.html', text: html('<script src="a.js" defer></script>') }])
    const c = scanProject([{ path: 'c.html', text: html('<script type="module" src="a.js"></script>') }])
    expect(found(a, 'render-blocking')?.count).toBe(1)
    expect(found(b, 'render-blocking')).toBeUndefined()
    expect(found(c, 'render-blocking')).toBeUndefined()
  })

  it('ignores anything inside a comment', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<!-- <p style="color:red">x</p> -->') }])
    expect(found(fs, 'inline-styles')).toBeUndefined()
  })
})

describe('scanning the document as a whole', () => {
  it('asks for a main landmark', () => {
    expect(ids(scanProject([{ path: 'a.html', text: html('<p>x</p>') }]))).toContain('no-landmarks')
  })

  it('is satisfied by one', () => {
    expect(ids(scanProject([{ path: 'a.html', text: html('<main><p>x</p></main>') }]))).not.toContain('no-landmarks')
  })

  it('asks for a lang', () => {
    const fs = scanProject([{ path: 'a.html', text: '<html><body><p>x</p></body></html>' }])
    expect(ids(fs)).toContain('no-lang')
  })

  it('asks for a skip link and accepts one', () => {
    const without = scanProject([{ path: 'a.html', text: html('<main>x</main>') }])
    const with_ = scanProject([{ path: 'b.html', text: html('<a href="#main-content">Skip</a><main id="main-content">x</main>') }])
    expect(ids(without)).toContain('no-skip-link')
    expect(ids(with_)).not.toContain('no-skip-link')
  })

  it('counts more than one h1', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<h1>a</h1><h1>b</h1>') }])
    expect(found(fs, 'multiple-h1')?.count).toBe(2)
  })

  it('notices a skipped heading level', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<h1>a</h1><h3>b</h3>') }])
    expect(found(fs, 'heading-skip')?.count).toBe(1)
  })

  it('accepts headings that go in order', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<h1>a</h1><h2>b</h2><h3>c</h3><h2>d</h2>') }])
    expect(found(fs, 'heading-skip')).toBeUndefined()
  })

  it('does not judge markup rules when there is no HTML at all', () => {
    const fs = scanProject([{ path: 'a.css', text: 'p { color: red }' }])
    expect(ids(fs)).not.toContain('no-landmarks')
  })
})

describe('scanning styles', () => {
  const css = (text: string): Finding[] => scanProject([{ path: 'a.css', text }])

  it('counts !important', () => {
    expect(found(css('p { color: red !important }'), 'important')?.count).toBe(1)
  })

  it('counts a float used for layout', () => {
    expect(found(css('.a { float: left }'), 'float-layout')?.count).toBe(1)
  })

  it('objects to pure black', () => {
    expect(found(css('p { color: #000 }'), 'pure-black')?.count).toBe(1)
    expect(found(css('p { color: rgb(0, 0, 0) }'), 'pure-black')?.count).toBe(1)
  })

  it('accepts a near black', () => {
    expect(found(css('p { color: #111 }'), 'pure-black')).toBeUndefined()
  })

  it('objects to the outline being removed', () => {
    expect(found(css('a:focus { outline: none }'), 'outline-none')?.count).toBe(1)
  })

  it('objects to a full viewport hero', () => {
    expect(found(css('.hero { height: 100vh }'), 'viewport-hero')?.count).toBe(1)
  })

  it('objects to a wide fixed width but not a small one', () => {
    expect(found(css('.card { width: 800px }'), 'fixed-width')?.count).toBe(1)
    expect(found(css('.icon { width: 24px }'), 'fixed-width')).toBeUndefined()
  })

  it('does not read min-width or max-width as a fixed width', () => {
    expect(found(css('@media (min-width: 640px) { .a { color: red } }'), 'fixed-width')).toBeUndefined()
    expect(found(css('.page { max-width: 1280px; width: 100% }'), 'fixed-width')).toBeUndefined()
  })

  it('measures the selector rather than the line, so minified css is not deep', () => {
    expect(found(css('a{color:red}b{color:blue}.c .d{color:green}'), 'deep-selector')).toBeUndefined()
  })

  it('still calls a genuinely deep selector deep', () => {
    expect(found(css('.a .b .c .d .e { color: red }'), 'deep-selector')?.count).toBe(1)
  })

  it('judges each half of a selector list on its own', () => {
    expect(found(css('.a, .b .c .d .e .f { color: red }'), 'deep-selector')?.count).toBe(1)
  })

  it('finds spacing that is off the 4px grid', () => {
    expect(found(css('.a { padding: 17px }'), 'off-grid-spacing')?.count).toBe(1)
  })

  it('accepts spacing on the grid, and zero', () => {
    expect(found(css('.a { padding: 16px 8px; margin: 0 }'), 'off-grid-spacing')).toBeUndefined()
  })

  it('counts a colour spelled out where a token could go', () => {
    expect(found(css('.a { color: #3b82f6 }'), 'hardcoded-colour')?.count).toBe(1)
  })

  it('leaves the token definitions alone', () => {
    const fs = css(':root { --primary: #3b82f6 }\n.a { color: var(--primary) }')
    expect(found(fs, 'hardcoded-colour')).toBeUndefined()
  })

  it('asks for tokens when there are none', () => {
    expect(ids(css('.a { color: red }'))).toContain('no-tokens')
    expect(ids(css(':root { --a: 1 }'))).not.toContain('no-tokens')
  })

  it('asks for breakpoints, hover and focus when absent', () => {
    const fs = css('.a { color: red }')
    expect(ids(fs)).toEqual(expect.arrayContaining(['no-responsive', 'no-hover', 'no-focus']))
  })

  it('is satisfied once they are there', () => {
    const fs = css('@media (min-width: 640px) { .a { color: red } }\n.a:hover{}\n.a:focus-visible{}')
    expect(ids(fs)).not.toEqual(expect.arrayContaining(['no-responsive', 'no-hover', 'no-focus']))
  })

  it('asks for a dark mode and a colour scheme', () => {
    expect(ids(css('.a{}'))).toEqual(expect.arrayContaining(['no-dark-mode', 'no-colour-scheme']))
  })

  it('asks about reduced motion only where something moves', () => {
    expect(ids(css('.a { transition: opacity 150ms ease }'))).toContain('no-reduced-motion')
    expect(ids(css('.a { color: red }'))).not.toContain('no-reduced-motion')
  })

  it('asks about font-display only where a font is loaded', () => {
    expect(ids(css('@font-face { src: url(a.woff2) }'))).toContain('no-font-display')
    expect(ids(css('@font-face { src: url(a.woff2); font-display: swap }'))).not.toContain('no-font-display')
    expect(ids(css('.a { color: red }'))).not.toContain('no-font-display')
  })

  it('finds a target below a fingertip', () => {
    expect(found(css('.btn { height: 28px }'), 'small-target')?.count).toBe(1)
    expect(found(css('.btn { height: 48px }'), 'small-target')).toBeUndefined()
  })

  it('mentions margins only where a gap was available', () => {
    expect(ids(css('.row { display: flex } .row > * { margin-right: 8px }'))).toContain('margin-spacing')
    expect(ids(css('.row { display: flex; gap: 8px }'))).not.toContain('margin-spacing')
  })

  it('reads styles out of a style block in a page', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<p>x</p>', '<style>p { color: red !important }</style>') }])
    expect(found(fs, 'important')?.count).toBe(1)
  })

  it('ignores a css comment', () => {
    expect(found(css('/* .a { float: left } */ .b { color: red }'), 'float-layout')).toBeUndefined()
  })
})

describe('a whole project', () => {
  it('adds up the same rule across several files', () => {
    const fs = scanProject([
      { path: 'a.html', text: html('<p style="a">x</p>') },
      { path: 'b.tsx', text: '<p style={{}}>x</p>' },
      { path: 'c.tsx', text: '<p style={{}}>y</p>' }
    ])
    expect(found(fs, 'inline-styles')?.count).toBe(3)
  })

  it('asks an absence question once, not once per file', () => {
    const fs = scanProject([
      { path: 'a.css', text: '.a { color: red }' },
      { path: 'b.css', text: '.b { color: blue }' }
    ])
    expect(fs.filter((f) => f.id === 'no-tokens')).toHaveLength(1)
  })

  it('lets tokens declared in one file satisfy the whole project', () => {
    const fs = scanProject([
      { path: 'tokens.css', text: ':root { --primary: #d33 }' },
      { path: 'app.css', text: '.a { color: var(--primary) }' }
    ])
    expect(ids(fs)).not.toContain('no-tokens')
  })

  it('puts the busiest finding first', () => {
    const fs = scanProject([{ path: 'a.html', text: html('<p style="a">1</p><p style="b">2</p><a>go</a>') }])
    expect(fs[0].count).toBeGreaterThanOrEqual(fs[fs.length - 1].count)
  })

  it('ignores files it cannot judge', () => {
    expect(scanProject([{ path: 'logo.png', text: 'binary' }])).toEqual([])
  })

  it('says almost nothing about a page that follows the rules', () => {
    const good = html(
      '<a href="#main-content" class="skip">Skip to content</a>' +
      '<header><nav><a href="/">Home</a></nav></header>' +
      '<main id="main-content"><h1>Prices</h1><h2>Teams</h2>' +
      '<img src="a.webp" alt="A team" width="800" height="400" loading="lazy">' +
      '<label for="e">Email</label><input id="e" type="email">' +
      '<button type="submit">Create account</button></main>' +
      '<footer><p>&copy; 2026</p></footer>',
      '<style>' +
      ':root { --primary: #0067b8; --ink: #242424; color-scheme: light dark }' +
      'body { color: var(--ink); padding: 16px }' +
      '.btn { min-height: 44px; background: var(--primary) }' +
      '.btn:hover { opacity: .9 }' +
      '.btn:focus-visible { outline: 2px solid var(--primary) }' +
      '@media (min-width: 640px) { body { padding: 24px } }' +
      '@media (prefers-color-scheme: dark) { :root { --ink: #eee } }' +
      '</style><script type="module" src="a.js"></script>'
    )
    expect(scanProject([{ path: 'a.html', text: good }])).toEqual([])
  })
})
