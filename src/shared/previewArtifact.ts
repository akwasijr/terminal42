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
 * A file:// URL for a path a turn wrote.
 *
 * The path may be absolute (tools generally report it that way) or relative to
 * the turn's working directory, so both are accepted and an absolute path is
 * never joined onto the base.
 *
 * Each segment is encoded separately so that spaces and other literal
 * characters survive while the separators stay separators — encoding the
 * whole path would turn every `/` into `%2F` and address nothing.
 */
export function fileUrlFor(basePath: string, path: string): string {
  const abs = path.startsWith('/')
    ? path
    : `${basePath.replace(/\/+$/, '')}/${path.replace(/^\.\//, '')}`
  return `file://${abs.split('/').map(encodeURIComponent).join('/')}`
}

/**
 * Whether a preview URL should be handed to the pane, given what we have
 * already shown and whether the pane is open.
 *
 * The rule exists because "have we shown this before?" is the wrong question
 * on its own. A second turn that edits the page currently on screen produces
 * the same URL as the first, and skipping it left the pane rendering the old
 * version while the browser the agent opened separately showed the new one.
 *
 * So a repeat is a refresh when the pane is open, and is ignored only when
 * the pane is closed — because a closed pane means the user closed it, and
 * reopening it under them would be the more annoying bug.
 */
export function shouldShowPreview(
  { seen, paneOpen }: { seen: boolean; paneOpen: boolean }
): boolean {
  return !seen || paneOpen
}
