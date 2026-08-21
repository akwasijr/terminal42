import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CodeView } from '../../src/renderer/src/components/CodePane'

// The code half is behind a tab, opened from a card, in a pane that only
// exists after a turn changes files. That is three doors away from anything an
// e2e run opens, so a component that throws on first mount would ship unseen.

const FILES = [
  { path: 'index.html', status: 'added', additions: 18, deletions: 0, binary: false },
  { path: 'style.css', status: 'added', additions: 56, deletions: 0, binary: false }
]

beforeEach(() => {
  ;(globalThis as unknown as { window: unknown }).window = {
    terminal42: { chat: { fileDiff: vi.fn().mockResolvedValue({ ok: true, before: '', after: 'x' }) } }
  }
})

function render(props: Partial<Parameters<typeof CodeView>[0]> = {}): string {
  return renderToStaticMarkup(
    <CodeView
      messageId="m1"
      path="index.html"
      files={FILES}
      onPickFile={() => {}}
      {...props}
    />
  )
}

describe('CodeView', () => {
  it('says what to do when no file is open, rather than showing a blank pane', () => {
    const html = render({ messageId: null, path: null, files: [] })
    expect(html).toContain('No file open')
  })

  it('offers every file the turn touched', () => {
    const html = render()
    expect(html).toContain('index.html')
    expect(html).toContain('style.css')
    expect(html).toContain('<select')
  })

  // A dropdown holding one option invites a click that does nothing.
  it('shows a single changed file as a label, not a picker', () => {
    const html = render({ files: [FILES[0]] })
    expect(html).not.toContain('<select')
    expect(html).toContain('index.html')
  })

  it('offers both ways of reading the file', () => {
    const html = render()
    expect(html).toContain('Changes')
    expect(html).toContain('Source')
  })
})
