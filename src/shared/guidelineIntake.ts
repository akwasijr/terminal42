import { fileKind } from './guidelineScan'

// Collecting a project to check.
//
// The two ways in are a folder someone points at and a GitHub link they
// paste. Both end up as the same thing — a list of files worth reading —
// and both need the same restraint, because a front end repository is mostly
// dependencies and build output, and reading those would be slow and would
// report on code nobody wrote.

/** Directories that are never the project itself. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next',
  '.nuxt', '.svelte-kit', '.turbo', '.cache', 'vendor', 'bower_components',
  '__pycache__', '.venv', 'venv', 'target', 'Pods', '.output'
])

/** Whether a path is inside somewhere not worth reading. */
export function shouldSkip(relPath: string): boolean {
  return relPath.split('/').some((part) => SKIP_DIRS.has(part) || (part.startsWith('.') && part !== '.'))
}

/** Whether a file is one the check can say anything about. */
export function isCheckable(relPath: string): boolean {
  if (shouldSkip(relPath)) return false
  if (/\.min\.(css|js)$/i.test(relPath)) return false
  return fileKind(relPath) !== null
}

/**
 * Files worth carrying, which is a wider net than the ones worth checking.
 *
 * Plain .js and .ts hold the components of a great many React projects. The
 * scanner has no rules for them, but the repair run needs to read them to
 * rebuild a page, so they are collected and simply not scanned.
 */
export function isDesignSource(relPath: string): boolean {
  if (shouldSkip(relPath)) return false
  if (/\.min\.(css|js)$/i.test(relPath)) return false
  return fileKind(relPath) !== null || /\.[jt]s$/i.test(relPath)
}

/**
 * The page a report should point at. A project usually has one obvious front
 * door, and index.html at the shallowest depth is it; without one, the first
 * page found will do rather than nothing.
 */
export function entryFile(paths: string[]): string | null {
  const pages = paths.filter((p) => fileKind(p) === 'html')
  if (pages.length === 0) return null
  const depth = (p: string): number => p.split('/').length
  const score = (p: string): number =>
    (/(^|\/)index\.html?$/i.test(p) ? 0 : 100) + depth(p)
  return [...pages].sort((a, b) => score(a) - score(b) || a.localeCompare(b))[0]
}

export type GithubRepo = { owner: string; repo: string; ref?: string }

// GitHub's own rules for a name. Checking against them here means the parsed
// parts can be trusted later, rather than a pasted '..' reaching a command.
const NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9_])?$/
const REF = /^[A-Za-z0-9._/-]+$/

function validRepo(r: GithubRepo): GithubRepo | null {
  if (!NAME.test(r.owner) || !NAME.test(r.repo)) return null
  if (r.ref !== undefined && (!REF.test(r.ref) || r.ref.includes('..'))) return null
  return r
}

/**
 * The repository behind a pasted link. People paste whatever the address bar
 * had, which is as often a file deep inside a branch as it is the repository
 * root, so anything after the branch is discarded.
 */
export function parseGithubUrl(input: string): GithubRepo | null {
  const text = input.trim()
  if (!text) return null

  const ssh = /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/.exec(text)
  if (ssh) return validRepo({ owner: ssh[1], repo: ssh[2] })

  const bare = /^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(text)
  if (bare && !text.includes('://') && !text.includes('github.com')) {
    return validRepo({ owner: bare[1], repo: bare[2] })
  }

  let url: URL
  try {
    url = new URL(text.includes('://') ? text : `https://${text}`)
  } catch {
    return null
  }
  if (!/^(www\.)?github\.com$/i.test(url.hostname)) return null

  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length < 2) return null
  const owner = parts[0]
  const repo = parts[1].replace(/\.git$/i, '')
  if (!owner || !repo) return null

  // /owner/repo/tree/<ref>/… — the branch is the part after tree or blob.
  // Only the first segment of it: a branch may contain a slash, but so may
  // the file path that follows one, and the address alone cannot say which
  // is which. Guessing the shorter one fails loudly at the checkout rather
  // than quietly reporting on the wrong code.
  const at = parts[2]
  const ref = (at === 'tree' || at === 'blob') && parts[3] ? decodeURIComponent(parts[3]) : undefined
  return validRepo(ref ? { owner, repo, ref } : { owner, repo })
}

/** The address to clone, built from a parsed link so nothing pasted is run. */
export function cloneUrl(repo: GithubRepo): string {
  return `https://github.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}.git`
}

/** A short name for what is being checked, for the report's heading. */
export function projectName(source: { kind: 'folder'; path: string } | { kind: 'github'; repo: GithubRepo }): string {
  if (source.kind === 'github') return `${source.repo.owner}/${source.repo.repo}`
  return source.path.replace(/\/+$/, '').split('/').pop() || 'Project'
}

// ─── What the second run is given to work on ──────────────────────────────

/**
 * Whether a page is only a mount point rather than a design.
 *
 * A React or Vue project's index.html is a head, a `<div id="root">` and a
 * script tag. Handing that to the repair run wastes it: there is nothing on
 * the page to correct, and the preview that comes back is a white rectangle.
 * The design lives in the components and the stylesheets, so a shell entry
 * has to be answered differently — rebuild the page, do not edit it.
 */
export function isShell(html: string): boolean {
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html
  const clean = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|noscript|template|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  // Text is the first test, but a page can be all pictures and still be a
  // design, so anything that carries meaning on its own counts too.
  const meaty = /<(img|svg|picture|video|canvas|button|input|form|table|h[1-6]|p|a|ul|ol|section|article|header|footer|nav|aside|figure)\b/i.test(clean)
  const text = clean.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length < 40 && !meaty
}

/**
 * Whether a plain .js or .ts file is really a piece of the design.
 *
 * The scanner only reads html, css and jsx, but a great many React projects
 * put their components in .js — react-gh-pages is one. Those files are
 * invisible to the check and would be invisible to the repair too, which is
 * how a rebuild ends up with nothing to rebuild from. A file counts if it
 * returns markup.
 */
function rendersMarkup(file: { path: string; text: string }): boolean {
  if (!/\.[jt]s$/i.test(file.path)) return false
  return /<[A-Za-z][\w.-]*[\s/>]/.test(file.text) && /\breturn\b/.test(file.text)
}

/**
 * The files the repair run is allowed to read, smallest useful set first.
 *
 * A project is megabytes and a run has a budget, so this is a shortlist, not
 * a copy: the stylesheets and the components nearest the top, which is where
 * a design that can be seen actually comes from.
 */
export function designSources(
  files: { path: string; text: string }[],
  entry: string | null,
  limits: { files?: number; bytes?: number } = {}
): { path: string; text: string }[] {
  const maxFiles = limits.files ?? 20
  const maxBytes = limits.bytes ?? 240_000
  const depth = (p: string): number => p.split('/').length
  const rank = (p: string): number => {
    const kind = fileKind(p)
    if (kind === 'css') return 0
    if (kind === 'jsx') return /(^|\/)(app|index|main|home|layout|page)\.[jt]sx?$/i.test(p) ? 1 : 2
    if (kind === 'html') return 4
    return 3
  }

  const pool = files
    .filter((f) => f.path !== entry && (fileKind(f.path) !== null || rendersMarkup(f)))
    .sort((a, b) => rank(a.path) - rank(b.path) || depth(a.path) - depth(b.path)
      || a.path.localeCompare(b.path))

  const taken: { path: string; text: string }[] = []
  let bytes = 0
  for (const f of pool) {
    if (taken.length >= maxFiles) break
    if (bytes + f.text.length > maxBytes) continue
    taken.push(f)
    bytes += f.text.length
  }
  return taken
}
