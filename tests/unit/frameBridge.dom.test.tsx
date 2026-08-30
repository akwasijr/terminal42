import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FrameBridge } from '../../src/renderer/src/lib/frameBridge'
import { FRAME_CHANNEL } from '../../src/shared/frameAgent'

// A stand-in for a served page: it hears what the bridge posts and answers,
// which is the whole of the contract between them.
function servedPage(opts: { answer?: (m: Record<string, unknown>) => unknown; silent?: boolean } = {}): {
  frame: HTMLIFrameElement
  ready: () => void
  seen: Record<string, unknown>[]
} {
  const seen: Record<string, unknown>[] = []
  const contentWindow = {
    postMessage(m: Record<string, unknown>) {
      seen.push(m)
      if (opts.silent) return
      const value = opts.answer ? opts.answer(m) : null
      window.dispatchEvent(new MessageEvent('message', {
        data: { channel: FRAME_CHANNEL, t42: 'reply', id: m.id, value }
      }))
    }
  }
  const frame = { contentWindow, contentDocument: null } as unknown as HTMLIFrameElement
  const ready = (): void => {
    window.dispatchEvent(new MessageEvent('message', { data: { channel: FRAME_CHANNEL, t42: 'ready' } }))
  }
  return { frame, ready, seen }
}

beforeEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  document.documentElement.removeAttribute('style')
  document.documentElement.className = ''
})

describe('FrameBridge on a page it can read', () => {
  const direct = (): FrameBridge => {
    const frame = { contentDocument: document, contentWindow: window } as unknown as HTMLIFrameElement
    return new FrameBridge(() => frame, false)
  }

  it('marks the modes on the root', async () => {
    const b = direct()
    await b.modes(true, false)
    expect(document.documentElement.classList.contains('t42-anno')).toBe(true)
    expect(document.documentElement.classList.contains('t42-edit')).toBe(false)
  })

  it('drops the selection when edit is turned off', async () => {
    document.body.innerHTML = '<p class="t42-selected">x</p>'
    await direct().modes(false, false)
    expect(document.querySelectorAll('.t42-selected')).toHaveLength(0)
  })

  it('reads the page tokens', async () => {
    document.head.innerHTML = '<style>:root { --brand: #b34700 }</style>'
    expect(await direct().tokens()).toEqual([{ name: '--brand', value: '#b34700', kind: 'color' }])
  })

  it('sets a token on the root', async () => {
    await direct().setToken('--brand', '#123456')
    expect(document.documentElement.style.getPropertyValue('--brand')).toBe('#123456')
  })

  it('sets a style on the element a selector names', async () => {
    document.body.innerHTML = '<p class="a">x</p>'
    await direct().setStyle('p.a', 'color', 'red')
    expect((document.querySelector('p') as HTMLElement).style.color).toBe('red')
  })

  it('prefers whatever is selected over the selector it was given', async () => {
    document.body.innerHTML = '<p class="a">one</p><p class="t42-selected">two</p>'
    await direct().setStyle('p.a', 'color', 'red')
    const [first, second] = Array.from(document.querySelectorAll('p')) as HTMLElement[]
    expect(first.style.color).toBe('')
    expect(second.style.color).toBe('red')
  })

  it('survives a selector that is not valid', async () => {
    document.body.innerHTML = '<p>x</p>'
    await expect(direct().setStyle('>>>', 'color', 'red')).resolves.toBeUndefined()
  })

  it('collects what has been styled', async () => {
    document.body.innerHTML = '<p style="color: red">Hello</p><b style="  ">no</b><i>none</i>'
    const changes = await direct().changes()
    expect(changes).toHaveLength(1)
    expect(changes[0].style).toContain('color')
  })

  it('reports a token change too, so it can be baked into the next version', async () => {
    const b = direct()
    await b.setToken('--brand', '#123456')
    const changes = await b.changes()
    expect(changes.map((c) => c.selector)).toEqual(['html'])
    expect(changes[0].style).toContain('--brand')
  })

  it('counts nothing where there are no slides', async () => {
    document.body.innerHTML = '<div>a page</div>'
    expect(await direct().slides()).toEqual({ count: 0, index: 0 })
  })

  it('counts the slides there are', async () => {
    document.body.innerHTML = '<section class="slide">1</section><section class="slide">2</section>'
    expect((await direct().slides()).count).toBe(2)
  })
})

describe('FrameBridge on a page it can only ask', () => {
  it('says which kind of preview it is', () => {
    const { frame } = servedPage()
    expect(new FrameBridge(() => frame, true).isServed).toBe(true)
  })

  it('holds a request until the page says it is there', async () => {
    const { frame, ready, seen } = servedPage()
    const b = new FrameBridge(() => frame, true)
    const p = b.modes(true, false)
    expect(seen).toHaveLength(0)
    ready()
    await p
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ kind: 'modes', annotate: true })
    b.dispose()
  })

  it('brings an answer back', async () => {
    const { frame, ready } = servedPage({
      answer: (m) => (m.kind === 'tokens' ? [{ name: '--a', value: '4px', kind: 'number' }] : null)
    })
    const b = new FrameBridge(() => frame, true)
    ready()
    expect(await b.tokens()).toEqual([{ name: '--a', value: '4px', kind: 'number' }])
    b.dispose()
  })

  it('gives up rather than waiting forever on a page that never answers', async () => {
    vi.useFakeTimers()
    const { frame, ready } = servedPage({ silent: true })
    const b = new FrameBridge(() => frame, true)
    ready()
    const p = b.tokens()
    await vi.advanceTimersByTimeAsync(5000)
    expect(await p).toEqual([])
    b.dispose()
    vi.useRealTimers()
  })

  it('tells the canvas what was picked', async () => {
    const { frame, ready } = servedPage()
    const b = new FrameBridge(() => frame, true)
    ready()
    const picks: string[] = []
    b.picked((p) => picks.push(p.selector))
    window.dispatchEvent(new MessageEvent('message', {
      data: { channel: FRAME_CHANNEL, t42: 'pick', selector: 'main > h1', tag: 'h1' }
    }))
    expect(picks).toEqual(['main > h1'])
    b.dispose()
  })

  it('tells the canvas the deck moved', async () => {
    const { frame, ready } = servedPage()
    const b = new FrameBridge(() => frame, true)
    ready()
    const at: number[] = []
    b.slid((i) => at.push(i))
    window.dispatchEvent(new MessageEvent('message', {
      data: { channel: FRAME_CHANNEL, t42: 'scrolled', slide: 3 }
    }))
    expect(at).toEqual([3])
    b.dispose()
  })

  it('ignores messages from anything else on the page', async () => {
    const { frame, ready } = servedPage()
    const b = new FrameBridge(() => frame, true)
    ready()
    const picks: string[] = []
    b.picked((p) => picks.push(p.selector))
    window.dispatchEvent(new MessageEvent('message', { data: { t42: 'pick', selector: 'x' } }))
    window.dispatchEvent(new MessageEvent('message', { data: 'hello' }))
    expect(picks).toEqual([])
    b.dispose()
  })

  it('waits again after a reload, since the new page has its own agent', async () => {
    const { frame, ready, seen } = servedPage()
    const b = new FrameBridge(() => frame, true)
    ready()
    await b.modes(true, false)
    expect(seen).toHaveLength(1)
    b.reload()
    const p = b.modes(false, true)
    expect(seen).toHaveLength(1)
    ready()
    await p
    expect(seen).toHaveLength(2)
    b.dispose()
  })

  it('answers at once when there is no frame to ask', async () => {
    const b = new FrameBridge(() => null, true)
    expect(await b.tokens()).toEqual([])
    b.dispose()
  })

  it('cannot read an element without asking, so it says so', () => {
    const { frame } = servedPage()
    expect(new FrameBridge(() => frame, true).read('h1')).toBeNull()
  })
})
