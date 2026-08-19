import { describe, it, expect } from 'vitest'
import { upsertManagedBlock } from '../../src/main/htmlBlocks'

const doc = '<!doctype html><html><head><title>x</title></head><body><h1>Hi</h1></body></html>'

describe('upsertManagedBlock', () => {
  it('inserts a style block before </head>', () => {
    const out = upsertManagedBlock(doc, 't42-motion', '.a{opacity:1}', 'style')
    expect(out).toContain('<style data-t42-block="t42-motion">')
    expect(out.indexOf('data-t42-block')).toBeLessThan(out.indexOf('</head>'))
  })

  it('inserts a script block before </body>', () => {
    const out = upsertManagedBlock(doc, 't42-shader', 'console.log(1)', 'script')
    expect(out).toContain('<script data-t42-block="t42-shader">')
    expect(out.indexOf('data-t42-block')).toBeLessThan(out.indexOf('</body>'))
  })

  it('replaces an existing block of the same id (idempotent re-apply)', () => {
    const once = upsertManagedBlock(doc, 't42-motion', '.a{opacity:0}', 'style')
    const twice = upsertManagedBlock(once, 't42-motion', '.a{opacity:1}', 'style')
    expect(twice.match(/data-t42-block="t42-motion"/g)?.length).toBe(1)
    expect(twice).toContain('.a{opacity:1}')
    expect(twice).not.toContain('.a{opacity:0}')
  })

  it('removes the block when content is empty', () => {
    const once = upsertManagedBlock(doc, 't42-motion', '.a{opacity:1}', 'style')
    const gone = upsertManagedBlock(once, 't42-motion', '', 'style')
    expect(gone).not.toContain('data-t42-block')
  })

  it('does not disturb a different managed id', () => {
    const a = upsertManagedBlock(doc, 't42-motion', '.a{opacity:1}', 'style')
    const b = upsertManagedBlock(a, 't42-shader', 'x()', 'script')
    expect(b).toContain('data-t42-block="t42-motion"')
    expect(b).toContain('data-t42-block="t42-shader"')
  })
})
