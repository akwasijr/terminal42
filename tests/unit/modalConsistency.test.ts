import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * There used to be eighteen modals, each with its own scrim opacity, corner
 * radius, z-index and opinion about Escape. Nothing stopped a nineteenth
 * being written the same way, so this is the thing that stops it.
 */

const ROOT = new URL('../../src/renderer/src/components/', import.meta.url).pathname
const PRIMITIVE = 'Modal.tsx'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return walk(path)
    return path.endsWith('.tsx') ? [path] : []
  })
}

const files = walk(ROOT).filter((f) => !f.endsWith(PRIMITIVE))
const read = (f: string): string => readFileSync(f, 'utf8')
const short = (f: string): string => f.slice(ROOT.length)

describe('every dialog comes through the shared modal', () => {
  it('nobody hand-rolls a scrim', () => {
    const offenders = files.filter((f) => read(f).includes('t42-scrim'))
    expect(offenders.map(short)).toEqual([])
  })

  it('nobody re-implements the primitive under another name', () => {
    // A second Modal.tsx, or a local Dialog/Overlay component, is how the
    // eighteen happened in the first place.
    const offenders = files.filter((f) =>
      /(function|const)\s+(Modal|Dialog|Overlay|Scrim)\b/.test(read(f))
    )
    expect(offenders.map(short)).toEqual([])
  })
})
