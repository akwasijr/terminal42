import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Finds the `copilot` launcher shim so the SDK runs the CLI under a real
// node instead of under Electron.
//
// Why this matters is not obvious. The SDK resolves its runtime to a bundled
// .js file and launches it with process.execPath, which inside Electron's main
// process is the Electron binary itself. The CLI then reads its credential
// from the macOS keychain, and the keychain attributes the access to whatever
// binary asked -- Electron. A development Electron build is ad-hoc, linker
// signed with no team identifier, so it has no stable designated requirement
// for an ACL to be pinned to. "Always Allow" therefore cannot stick, and the
// user is asked to unlock their keychain over and over.
//
// Pointing the SDK at the shim (which does not end in .js) makes it exec the
// shim directly, whose `#!/usr/bin/env node` shebang hands execution to the
// real, Apple-signed node. That identity is stable across rebuilds, so the
// keychain decision is remembered once.

/**
 * Picks the first candidate that exists and can actually act as a launcher.
 *
 * Exported separately from the filesystem lookup so the selection rule can be
 * tested without depending on what happens to be installed on the machine.
 */
export function pickCopilotLauncher(
  candidates: readonly string[],
  exists: (p: string) => boolean
): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue
    // A .js path would send the SDK straight back down the
    // spawn(process.execPath, [script]) branch this exists to avoid.
    if (candidate.endsWith('.js')) continue
    if (exists(candidate)) return candidate
  }
  return null
}

/**
 * Where a globally installed `copilot` shim tends to live.
 *
 * A GUI-launched app inherits a minimal PATH that usually excludes nvm and
 * Homebrew, so the usual PATH lookup cannot be relied on here.
 */
export function copilotLauncherCandidates(
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
  listDir: (p: string) => string[] = (p) => {
    try {
      return readdirSync(p)
    } catch {
      return []
    }
  }
): string[] {
  const out: string[] = []
  if (env.COPILOT_CLI_PATH) out.push(env.COPILOT_CLI_PATH)

  // Newest node versions first, so the shim matches the runtime the user most
  // likely installed the CLI under.
  const nvmRoot = join(home, '.nvm', 'versions', 'node')
  let versions: string[] = []
  try {
    versions = listDir(nvmRoot).sort().reverse()
  } catch {
    // An unreadable nvm directory must not cost us the system candidates below.
  }
  for (const version of versions) {
    out.push(join(nvmRoot, version, 'bin', 'copilot'))
  }

  out.push(
    '/opt/homebrew/bin/copilot',
    '/usr/local/bin/copilot',
    join(home, '.local', 'bin', 'copilot'),
    join(home, '.npm-global', 'bin', 'copilot'),
    join(home, '.bun', 'bin', 'copilot')
  )
  return out
}

let cached: string | null | undefined

/**
 * Returns the launcher path, or null to leave the SDK on its default
 * behaviour. Null is always safe: it only means the keychain prompt keeps
 * behaving as it did before.
 */
export function resolveCopilotLauncher(): string | null {
  if (cached !== undefined) return cached
  cached = pickCopilotLauncher(copilotLauncherCandidates(), (p) => existsSync(p))
  return cached
}
