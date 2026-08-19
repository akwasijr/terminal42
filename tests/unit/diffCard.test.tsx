// Render tests for the turn diff card.
//
// Uses react-dom/server rather than a DOM testing library: the project runs
// vitest under `environment: 'node'`, and renderToStaticMarkup works there
// without pulling in happy-dom. Effects don't run under SSR, which is fine —
// what matters here is that the card states are distinguishable in the markup.

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DiffCard, DiffCounts } from '../../src/renderer/src/components/DiffCard'
import type { ChatDiff } from '../../src/preload/index'

const diff: ChatDiff = {
  files: [
    { path: 'src/app.ts', status: 'modified', additions: 12, deletions: 3, binary: false },
    { path: 'src/new.ts', status: 'added', additions: 40, deletions: 0, binary: false },
    { path: 'old.txt', status: 'deleted', additions: 0, deletions: 7, binary: false }
  ],
  additions: 52,
  deletions: 10
}

function render(node: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(node)
}

describe('DiffCard', () => {
  it('summarises the file count and line totals', () => {
    const html = render(<DiffCard messageId="m1" diff={diff} />)
    expect(html).toContain('3 files changed')
    expect(html).toContain('+52')
    expect(html).toContain('−10')
  })

  it('uses the singular form for a single file', () => {
    const one: ChatDiff = { files: [diff.files[0]], additions: 12, deletions: 3 }
    expect(render(<DiffCard messageId="m1" diff={one} />)).toContain('1 file changed')
  })

  it('renders nothing when no files changed', () => {
    const empty: ChatDiff = { files: [], additions: 0, deletions: 0 }
    expect(render(<DiffCard messageId="m1" diff={empty} />)).toBe('')
  })

  // Undo rewrites the working tree, so the first click must only arm it.
  it('offers Undo rather than confirmation before the first click', () => {
    const html = render(<DiffCard messageId="m1" diff={diff} />)
    expect(html).toContain('>Undo</button>')
    expect(html).not.toContain('Confirm undo</button>')
  })

  it('replaces Undo with a spent state once the turn is reverted', () => {
    const html = render(<DiffCard messageId="m1" diff={diff} undone />)
    expect(html).toContain('>Undone</span>')
    expect(html).not.toContain('>Undo</button>')
  })

  it('keeps the file list collapsed until it is expanded', () => {
    const html = render(<DiffCard messageId="m1" diff={diff} />)
    expect(html).not.toContain('src/app.ts')
  })

  it('marks the card as expandable for assistive tech', () => {
    expect(render(<DiffCard messageId="m1" diff={diff} />)).toContain('aria-expanded="false"')
  })
})

describe('DiffCounts', () => {
  it('renders a minus sign, not a hyphen, for deletions', () => {
    const html = render(<DiffCounts additions={1} deletions={2} />)
    expect(html).toContain('−2')
  })

  it('renders zero counts explicitly rather than hiding them', () => {
    const html = render(<DiffCounts additions={0} deletions={0} />)
    expect(html).toContain('+0')
    expect(html).toContain('−0')
  })
})
