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
