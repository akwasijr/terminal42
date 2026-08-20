// Picking the page to preview out of the files a turn changed.
//
// When a turn writes an HTML file, the useful next move is almost always to
// show it, not to tell the user where it landed and let them go find it. This
// module answers only "which file, if any, is the one to show" — opening it is
// the caller's job.
//
// Deliberately narrow: HTML only. A .css or .js file is part of a page but is
// not itself viewable, and guessing which page imports it would be wrong more
// often than right.

export type PreviewCandidate = {
  path: string
  status: 'added' | 'modified' | 'deleted'
  binary?: boolean
}

const HTML_RE = /\.html?$/i

/**
 * The single best page to preview from a turn's changed files, or null.
 *
 * Ranked by:
 *   1. Added before modified. A page the turn just created is what the user
 *      asked for; an edit to an existing page is more likely a side effect.
 *   2. index.html before other names — the conventional entry point.
 *   3. Shallower paths first, so `site/index.html` wins over
 *      `site/docs/examples/index.html`.
 *   4. Alphabetical, purely so the choice is stable across identical turns.
 *
 * Deleted and binary entries are never candidates: there is nothing to show.
 */
export function pickPreviewArtifact(files: readonly PreviewCandidate[]): string | null {
  const ranked = files
    .filter((f) => f.status !== 'deleted' && !f.binary && HTML_RE.test(f.path))
    .sort((a, b) => rank(a) - rank(b) || depth(a.path) - depth(b.path) || a.path.localeCompare(b.path))
  return ranked[0]?.path ?? null
}

function rank(f: PreviewCandidate): number {
  const added = f.status === 'added' ? 0 : 2
  return added + (isIndex(f.path) ? 0 : 1)
}

function isIndex(path: string): boolean {
  return /(^|\/)index\.html?$/i.test(path)
}

function depth(path: string): number {
  return path.split('/').length
}

/**
 * A file:// URL for a project-relative path.
 *
 * Each segment is encoded separately so that spaces and other literal
 * characters survive while the separators stay separators — encoding the
 * whole path would turn every `/` into `%2F` and address nothing.
 */
export function fileUrlFor(projectPath: string, relative: string): string {
  const abs = `${projectPath.replace(/\/+$/, '')}/${relative.replace(/^\/+/, '')}`
  return `file://${abs.split('/').map(encodeURIComponent).join('/')}`
}
