// Talking to a preview the canvas cannot reach into.
//
// An ordinary design is rendered from srcDoc and is the canvas's own origin,
// so the canvas reads and writes its document directly. A router-based app is
// served from a loopback origin of its own, and there the document is simply
// not there to be touched. This is the one place that knows the difference.
//
// Both roads end in the same four functions from framePick, so a selector or
// a reading means the same thing whichever kind of preview produced it.

import {
  classifyToken, computeSelector, readProjectTokens, readStyles,
  type ElementStyles, type ProjectToken
} from '../../../shared/framePick'
import {
  FRAME_CHANNEL, type EditChange, type SlideState
} from '../../../shared/frameAgent'

export type FramePick = {
  selector: string
  tag: string
  text: string
  styles: ElementStyles
  html: string
}

type Pending = { resolve: (v: unknown) => void; timer: ReturnType<typeof setTimeout> }

/**
 * One preview, however it happens to be hosted.
 *
 * A served page is asked and answers later, so everything here returns a
 * promise even where the direct road could have answered at once. A caller
 * that had to know which kind of preview it was holding would be the same
 * problem this class exists to remove.
 */
export class FrameBridge {
  private frame: () => HTMLIFrameElement | null
  private served: boolean
  private next = 1
  private pending = new Map<number, Pending>()
  private ready = false
  private queued: Array<() => void> = []
  private onPick: ((p: FramePick) => void) | null = null
  private onSlide: ((index: number) => void) | null = null
  private listener: ((e: MessageEvent) => void) | null = null

  constructor(frame: () => HTMLIFrameElement | null, served: boolean) {
    this.frame = frame
    this.served = served
    if (served) this.listen()
  }

  /** Whether the page answers by message rather than by being read. */
  get isServed(): boolean {
    return this.served
  }

  private doc(): Document | null {
    try { return this.frame()?.contentDocument ?? null } catch { return null }
  }

  private listen(): void {
    this.listener = (e: MessageEvent): void => {
      const m = e.data as Record<string, unknown> | null
      if (!m || typeof m !== 'object' || m.channel !== FRAME_CHANNEL) return
      if (m.t42 === 'ready') { this.arrived(); return }
      if (m.t42 === 'pick') { this.onPick?.(m as unknown as FramePick); return }
      if (m.t42 === 'scrolled') { this.onSlide?.(Number(m.slide) || 0); return }
      if (m.t42 === 'reply') {
        const p = this.pending.get(Number(m.id))
        if (!p) return
        this.pending.delete(Number(m.id))
        clearTimeout(p.timer)
        p.resolve(m.value)
      }
    }
    window.addEventListener('message', this.listener)
  }

  /**
   * Send one request and wait for its answer.
   *
   * A request made before the page has said it is there is held rather than
   * dropped: the canvas sets its modes the moment a mode is turned on, which
   * is routinely before the document has finished loading. The timeout is
   * what keeps a page that never answers from holding a promise open for the
   * rest of the session.
   */
  private ask<T>(body: Record<string, unknown>, fallback: T): Promise<T> {
    const win = this.frame()?.contentWindow
    if (!win) return Promise.resolve(fallback)
    const id = this.next++
    return new Promise<T>((resolve) => {
      const send = (): void => {
        const w = this.frame()?.contentWindow
        if (!w) { resolve(fallback); return }
        const timer = setTimeout(() => {
          this.pending.delete(id)
          resolve(fallback)
        }, 4000)
        this.pending.set(id, { resolve: (v) => resolve((v ?? fallback) as T), timer })
        w.postMessage({ channel: FRAME_CHANNEL, id, ...body }, '*')
      }
      if (this.ready) send()
      else this.queued.push(send)
    })
  }

  /**
   * The page is here and anything held back can go.
   *
   * Called both when the agent announces itself and when the frame finishes
   * loading, because only one of the two is guaranteed. The agent announces
   * while the document is still parsing -- an inline script at the end of
   * the body runs long before `load` -- so a bridge made after that point
   * would never hear it. Whichever arrives first wins; the second is a
   * no-op.
   */
  private arrived(): void {
    this.ready = true
    const queued = this.queued
    this.queued = []
    for (const run of queued) run()
  }

  /** The frame has finished loading, whether or not its agent spoke up. */
  loaded(): void {
    if (!this.served) return
    this.arrived()
  }

  /**
   * A new document is on its way, so hold requests until it arrives.
   *
   * Anything already in flight is answered with nothing rather than left
   * open: the document that was going to answer it has gone.
   */
  navigating(): void {
    if (!this.served) return
    this.ready = false
    for (const [, p] of this.pending) { clearTimeout(p.timer); p.resolve(null) }
    this.pending.clear()
  }

  dispose(): void {
    if (this.listener) window.removeEventListener('message', this.listener)
    for (const [, p] of this.pending) clearTimeout(p.timer)
    this.pending.clear()
    this.queued = []
  }

  /** What to do when the page reports that something was picked. */
  picked(fn: ((p: FramePick) => void) | null): void {
    this.onPick = fn
  }

  /** What to do when a deck is scrolled to another slide. */
  slid(fn: ((index: number) => void) | null): void {
    this.onSlide = fn
  }

  // ─── Everything the canvas does to a page ───────────────────────────────

  async modes(annotate: boolean, edit: boolean): Promise<void> {
    if (this.served) { await this.ask({ kind: 'modes', annotate, edit }, null); return }
    const doc = this.doc()
    if (!doc) return
    doc.documentElement.classList.toggle('t42-anno', annotate)
    doc.documentElement.classList.toggle('t42-edit', edit)
    if (!edit) doc.querySelectorAll('.t42-selected').forEach((n) => n.classList.remove('t42-selected'))
  }

  async tokens(): Promise<ProjectToken[]> {
    if (this.served) return this.ask<ProjectToken[]>({ kind: 'tokens' }, [])
    const doc = this.doc()
    return doc ? readProjectTokens(doc, classifyToken) : []
  }

  async setToken(name: string, value: string): Promise<void> {
    if (this.served) { await this.ask({ kind: 'setToken', name, value }, null); return }
    this.doc()?.documentElement.style.setProperty(name, value)
  }

  async setStyle(selector: string, prop: string, value: string): Promise<void> {
    if (this.served) { await this.ask({ kind: 'setStyle', selector, prop, value }, null); return }
    const el = this.element(selector)
    el?.style.setProperty(prop, value)
  }

  async setText(selector: string, text: string): Promise<void> {
    if (this.served) { await this.ask({ kind: 'setText', selector, text }, null); return }
    const el = this.element(selector)
    if (el) el.innerText = text
  }

  async changes(): Promise<EditChange[]> {
    if (this.served) return this.ask<EditChange[]>({ kind: 'changes' }, [])
    const doc = this.doc()
    if (!doc) return []
    const out: EditChange[] = []
    doc.querySelectorAll('[style]').forEach((n) => {
      const style = n.getAttribute('style') ?? ''
      if (!style.trim()) return
      const el = n as HTMLElement
      const shown = (el.innerText !== undefined ? el.innerText : el.textContent) || ''
      out.push({ selector: computeSelector(el), text: shown.trim().slice(0, 80), style })
    })
    return out
  }

  async slides(): Promise<SlideState> {
    if (this.served) return this.ask<SlideState>({ kind: 'slides' }, { count: 0, index: 0 })
    const doc = this.doc()
    if (!doc?.body) return { count: 0, index: 0 }
    const all = doc.querySelectorAll<HTMLElement>('section.slide, .slide, [data-slide], body > section')
    if (!all.length) return { count: 0, index: 0 }
    const s = this.scroller(doc)
    const width = all[0].getBoundingClientRect().width || s.clientWidth || 1
    return { count: all.length, index: Math.round(s.scrollLeft / width) }
  }

  /** Scroll to a whole slide, by index. */
  async slideTo(index: number): Promise<void> {
    if (this.served) { await this.ask({ kind: 'slideTo', index }, null); return }
    const doc = this.doc()
    if (!doc) return
    const all = doc.querySelectorAll<HTMLElement>('section.slide, .slide, [data-slide], body > section')
    if (!all.length) return
    const s = this.scroller(doc)
    const width = all[0].getBoundingClientRect().width || s.clientWidth || 1
    const i = Math.max(0, Math.min(all.length - 1, index))
    const left = i * width
    s.scrollTo({ left, behavior: 'smooth' })
    setTimeout(() => {
      if (Math.abs(s.scrollLeft - left) > 4) s.scrollTo({ left, behavior: 'smooth' })
    }, 380)
  }

  async scrollBy(x: number): Promise<void> {
    if (this.served) { await this.ask({ kind: 'scrollBy', x }, null); return }
    const doc = this.doc()
    if (doc) this.scroller(doc).scrollBy({ left: x, behavior: 'smooth' })
  }

  async scrollY(): Promise<number | null> {
    if (this.served) return this.ask<number | null>({ kind: 'scrollY' }, null)
    try { return this.frame()?.contentWindow?.scrollY ?? null } catch { return null }
  }

  async scrollTo(y: number): Promise<void> {
    if (this.served) { await this.ask({ kind: 'scrollTo', y }, null); return }
    try { this.frame()?.contentWindow?.scrollTo(0, y) } catch { /* gone */ }
  }

  /** Read an element the canvas already knows the selector of. */
  read(selector: string): FramePick | null {
    if (this.served) return null
    const el = this.element(selector)
    if (!el) return null
    const shown = (el.innerText !== undefined ? el.innerText : el.textContent) || ''
    return {
      selector: computeSelector(el),
      tag: el.tagName.toLowerCase(),
      text: shown.trim().slice(0, 120),
      styles: readStyles(el),
      html: el.outerHTML.slice(0, 1000)
    }
  }

  private element(selector: string): HTMLElement | null {
    const doc = this.doc()
    if (!doc) return null
    const marked = doc.querySelector<HTMLElement>('.t42-selected')
    if (marked) return marked
    try { return doc.querySelector<HTMLElement>(selector) } catch { return null }
  }

  private scroller(doc: Document): HTMLElement {
    const deck = doc.querySelector<HTMLElement>('main.deck, .deck')
    if (deck && deck.scrollWidth > deck.clientWidth) return deck
    if (doc.body.scrollWidth > doc.body.clientWidth) return doc.body
    return doc.documentElement
  }
}
