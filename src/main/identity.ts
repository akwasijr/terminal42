// Resolves the human name used to greet the user in the empty chat state.
//
// Deliberately prefers the OS full name over git config: `user.name` is often
// an org or handle ("Harmoniq"), whereas the account record holds an actual
// person's name. Anything that doesn't look like a name is dropped upstream by
// firstNameFrom, so a shortname yields no greeting rather than a bad one.

import { ipcMain } from 'electron'
import { execFile } from 'node:child_process'
import { userInfo } from 'node:os'
import { firstNameFrom } from '../shared/greeting'

let cached: string | null | undefined

function run(cmd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      execFile(cmd, args, { timeout: 2000 }, (err, stdout) => {
        resolve(err ? null : String(stdout).trim() || null)
      })
    } catch {
      resolve(null)
    }
  })
}

async function fullName(): Promise<string | null> {
  if (process.platform === 'darwin') {
    const name = await run('id', ['-F'])
    if (name) return name
  }
  // Linux and fallbacks: the gecos field carries the full name when set.
  try {
    const gecos = (userInfo() as { gecos?: string }).gecos
    if (gecos) return gecos
  } catch {}
  try {
    return userInfo().username || null
  } catch {
    return null
  }
}

/** First name for the greeting, or null when we don't have a usable one. */
export async function greetingName(): Promise<string | null> {
  if (cached !== undefined) return cached
  cached = firstNameFrom(await fullName())
  return cached
}

export function registerIdentityIpc(): void {
  ipcMain.handle('identity:greetingName', () => greetingName())
}
