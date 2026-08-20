import { describe, it, expect } from 'vitest'
import { pickPreviewArtifact, fileUrlFor, type PreviewCandidate } from '../../src/shared/previewArtifact'

const f = (path: string, status: PreviewCandidate['status'] = 'added', binary = false): PreviewCandidate => ({
  path,
  status,
  binary
})

describe('pickPreviewArtifact', () => {
  it('returns null when a turn changed no pages', () => {
    expect(pickPreviewArtifact([f('src/main.ts'), f('README.md')])).toBeNull()
  })

  it('returns null for an empty turn', () => {
    expect(pickPreviewArtifact([])).toBeNull()
  })

  it('picks the page a turn created', () => {
    expect(pickPreviewArtifact([f('src/app.ts'), f('portfolio/index.html')])).toBe('portfolio/index.html')
  })

  it('prefers a created page over an edited one', () => {
    expect(pickPreviewArtifact([f('old.html', 'modified'), f('new.html', 'added')])).toBe('new.html')
  })

  it('prefers index.html over a sibling page', () => {
    expect(pickPreviewArtifact([f('about.html'), f('index.html')])).toBe('index.html')
  })

  it('prefers a shallower page when names are equally conventional', () => {
    expect(pickPreviewArtifact([f('docs/examples/index.html'), f('index.html')])).toBe('index.html')
  })

  it('still picks an edited page when nothing was created', () => {
    expect(pickPreviewArtifact([f('site/index.html', 'modified')])).toBe('site/index.html')
  })

  it('never picks a page the turn deleted', () => {
    expect(pickPreviewArtifact([f('gone.html', 'deleted')])).toBeNull()
  })

  it('never picks a binary entry, whatever its name', () => {
    expect(pickPreviewArtifact([f('weird.html', 'added', true)])).toBeNull()
  })

  it('accepts the .htm spelling', () => {
    expect(pickPreviewArtifact([f('legacy.htm')])).toBe('legacy.htm')
  })

  it('does not match a name that merely contains html', () => {
    expect(pickPreviewArtifact([f('notes.html.bak'), f('html/styles.css')])).toBeNull()
  })

  it('is stable when two pages tie on every other rule', () => {
    const files = [f('b.html'), f('a.html')]
    expect(pickPreviewArtifact(files)).toBe('a.html')
    expect(pickPreviewArtifact([...files].reverse())).toBe('a.html')
  })
})

describe('fileUrlFor', () => {
  it('joins a project path and a relative path', () => {
    expect(fileUrlFor('/Users/me/site', 'index.html')).toBe('file:///Users/me/site/index.html')
  })

  it('does not double the separator', () => {
    expect(fileUrlFor('/Users/me/site/', '/index.html')).toBe('file:///Users/me/site/index.html')
  })

  it('encodes spaces without destroying the path separators', () => {
    expect(fileUrlFor('/Users/me/My Site', 'pages/about us.html')).toBe(
      'file:///Users/me/My%20Site/pages/about%20us.html'
    )
  })

  it('encodes characters a URL would otherwise read as syntax', () => {
    expect(fileUrlFor('/tmp/a#b', 'c?d.html')).toBe('file:///tmp/a%23b/c%3Fd.html')
  })
})
