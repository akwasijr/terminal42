// Git failures, said in a way the user can act on.
//
// The panel used to flash git's own stderr — "fatal: could not read Username
// for 'https://github.com': terminal prompts disabled" — which is accurate,
// unreadable, and does not say what to do. Each rule below matches a failure
// that actually happens in this app and answers two questions: what went
// wrong, and what to do next.
//
// Anything unrecognised falls back to git's own words rather than a vague
// "something went wrong": for the rare cases, the real text is more useful.

type Rule = { match: RegExp; message: string }

const PUSH_RULES: Rule[] = [
  {
    match: /could not read Username|Authentication failed|Invalid username or (password|token)/i,
    message: 'GitHub would not accept the login. Sign in again with `gh auth login` in a terminal, then try once more.'
  },
  {
    match: /Permission denied \(publickey\)|Host key verification failed/i,
    message: 'GitHub refused the SSH key for this machine. Sign in with `gh auth login` or add the key to your GitHub account.'
  },
  {
    match: /remote: Permission to .* denied|403 Forbidden/i,
    message: 'Your account does not have permission to write to this repository.'
  },
  {
    match: /Repository not found|does not appear to be a git repository/i,
    message: 'That repository does not exist, or your account cannot see it. Check the remote URL.'
  },
  {
    match: /non-fast-forward|fetch first|Updates were rejected/i,
    message: 'GitHub has changes this copy does not. Pull first, then push.'
  },
  {
    match: /src refspec .* does not match any/i,
    message: 'There is nothing committed yet. Save your changes first, then push.'
  },
  {
    match: /Could not resolve host|unable to access .*Could not resolve|network is unreachable|Connection timed out/i,
    message: 'Could not reach GitHub. Check your internet connection and try again.'
  },
  {
    match: /no upstream branch|has no upstream/i,
    message: 'This branch has never been published. Use Publish to send it to GitHub for the first time.'
  }
]

const PULL_RULES: Rule[] = [
  {
    match: /would be overwritten by merge|Your local changes.*would be overwritten/i,
    message: 'You have unsaved changes that the update would overwrite. Save them first, then pull.'
  },
  {
    match: /CONFLICT|Automatic merge failed/i,
    message: 'The update clashes with your changes. Ask the agent in chat to resolve the conflict.'
  },
  {
    match: /refusing to merge unrelated histories/i,
    message: 'This folder and the GitHub repository do not share any history, so they cannot be merged automatically.'
  }
]

const COMMIT_RULES: Rule[] = [
  {
    match: /nothing to commit|no changes added to commit/i,
    message: 'There was nothing to save. No files have changed.'
  },
  {
    match: /Please tell me who you are|unable to auto-detect email address/i,
    message: 'Git does not know who you are yet. Set your name and email with `git config --global user.name` and `user.email`.'
  }
]

/** Git's own last words, trimmed to something a small panel can show. */
function gitOwnWords(output: string): string {
  const line = output
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^(remote:|hint:|To https?:|To git@)/i.test(l))
    .pop()
  if (!line) return ''
  const stripped = line.replace(/^(fatal|error):\s*/i, '')
  return stripped.length > 160 ? stripped.slice(0, 160) + '…' : stripped
}

export type GitOperation = 'push' | 'pull' | 'commit' | 'init' | 'remote'

const RULES: Record<GitOperation, Rule[]> = {
  push: PUSH_RULES,
  pull: [...PULL_RULES, ...PUSH_RULES],
  commit: COMMIT_RULES,
  init: [],
  remote: [
    { match: /remote .* already exists/i, message: 'This project is already connected to a remote.' },
    { match: /not a valid|invalid.*url/i, message: 'That does not look like a repository URL. It should end in .git.' }
  ]
}

const FALLBACK: Record<GitOperation, string> = {
  push: 'Could not send your changes to GitHub.',
  pull: 'Could not get the latest from GitHub.',
  commit: 'Could not save your changes.',
  init: 'Could not set up version control here.',
  remote: 'Could not connect this project to that repository.'
}

/**
 * A sentence to show the user when a git command fails.
 *
 * `output` is stderr and stdout together — git splits its messages across both
 * and which half carries the reason varies by version.
 */
export function gitErrorMessage(operation: GitOperation, output: string): string {
  const text = (output ?? '').trim()
  for (const rule of RULES[operation]) {
    if (rule.match.test(text)) return rule.message
  }
  const words = gitOwnWords(text)
  return words ? `${FALLBACK[operation]} ${words}` : FALLBACK[operation]
}
