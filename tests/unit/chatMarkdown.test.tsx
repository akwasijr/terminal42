import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MarkdownContent } from '../../src/renderer/src/components/ChatBubbles'

// react-markdown removed the `inline` flag it used to pass to the `code`
// component in v9. The renderer still tested for it, so the flag was always
// undefined and EVERY inline code span — a file path, a function name — was
// rendered as a full-width block, breaking sentences apart mid-line.
//
// Rendering to static markup needs no DOM, so these run in the normal node
// test environment and still exercise the real react-markdown pipeline.

const html = (md: string): string => renderToStaticMarkup(<MarkdownContent content={md} />)

describe('chat markdown', () => {
  it('keeps an inline code span inside its sentence', () => {
    const out = html('Created `index.html` for you.')
    expect(out).not.toContain('<pre')
    expect(out).toContain('index.html')
    // Styling, not just the tag: an inline span must get the chip treatment.
    // Checking only for <code> would pass even if inline spans were rendered
    // with block styling, which is the failure this guards.
    expect(out).toMatch(/<code class="[^"]*px-1[^"]*"/)
  })

  it('renders a fenced block as a block', () => {
    const out = html('```\nconst a = 1\n```')
    expect(out).toContain('<pre')
  })

  it('renders a fenced block with a language as a block', () => {
    const out = html('```js\nconst a = 1\n```')
    expect(out).toContain('<pre')
  })

  it('does not draw the inline chip around a fenced block', () => {
    // The chip styling inside a fence is the same bug inverted: a padded,
    // rounded box drawn around the contents of every code block.
    const out = html('```\nconst a = 1\n```')
    const codeTag = out.slice(out.indexOf('<code'), out.indexOf('>', out.indexOf('<code')) + 1)
    expect(codeTag).not.toContain('px-1')
    expect(codeTag).not.toContain('rounded bg-elevated')
  })

  it('handles a sentence mixing prose, inline code and a fence', () => {
    const out = html('Replace `handleSignup()` with:\n\n```js\nfetch(url)\n```\n\nThen reload.')
    expect(out.match(/<pre/g) ?? []).toHaveLength(1)
    expect(out).toContain('handleSignup()')
    expect(out).toContain('Then reload.')
  })

  it('still renders lists, headings and links', () => {
    const out = html('## Title\n\n- one\n- two\n\n[link](https://example.com)')
    expect(out).toContain('<h2')
    expect(out).toContain('<ul')
    expect(out).toContain('<li')
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('target="_blank"')
  })

  it('renders several inline spans in one paragraph without any block', () => {
    const out = html('Use `a`, `b` and `c` together.')
    expect(out).not.toContain('<pre')
    expect(out.match(/<code/g) ?? []).toHaveLength(3)
    expect(out.match(/<code class="[^"]*px-1[^"]*"/g) ?? []).toHaveLength(3)
  })
})
