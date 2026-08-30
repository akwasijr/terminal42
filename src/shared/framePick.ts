// Reading a page the canvas is showing: naming an element, measuring it, and
// finding the tokens it was built from.
//
// These four run in two places. The canvas calls them on an iframe it can
// reach into, and the in-page agent calls them inside a preview served from
// its own origin, where the canvas can reach nothing at all. The agent's
// script is built by serialising these very functions, so they are written
// to survive it: no imports, no closures, nothing from module scope. A helper
// one of them needs is passed in or declared inside it.
//
// Keeping one implementation matters more than the small awkwardness that
// costs. A selector computed one way here and another way there would pick
// the right element in a design and the wrong one in an app, and nothing in
// the interface would say which.

export type ElementStyles = {
  text: string
  isText: boolean
  color: string
  background: string
  fontSize: number
  fontWeight: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  borderRadius: number
}

export type ProjectToken = {
  name: string
  value: string
  kind: 'color' | 'number' | 'text'
}

/**
 * A selector that finds this element again, short enough to show.
 *
 * An id wins outright. Otherwise it is four levels of tag and class, with
 * :nth-of-type only where the tag repeats among its siblings — enough to be
 * unique in practice without being a path nobody can read.
 */
export function computeSelector(el: Element | null): string {
  if (!el || el.nodeType !== 1) return ''
  const elH = el as HTMLElement
  if (elH.id) return `#${elH.id}`
  const body = el.ownerDocument ? el.ownerDocument.body : null
  const path: string[] = []
  let cur: Element | null = elH
  while (cur && cur.nodeType === 1 && cur !== body && path.length < 4) {
    let seg = cur.tagName.toLowerCase()
    if (typeof cur.className === 'string') {
      const cls = cur.className.trim().split(/\s+/)
        .filter((c) => c && c !== 't42-selected').slice(0, 2).join('.')
      if (cls) seg += '.' + cls
    }
    const parentEl: Element | null = cur.parentElement
    if (parentEl) {
      const here: Element = cur
      const sibs = Array.from(parentEl.children).filter((c: Element) => c.tagName === here.tagName)
      if (sibs.length > 1) seg += `:nth-of-type(${sibs.indexOf(here) + 1})`
    }
    path.unshift(seg)
    cur = parentEl
  }
  return path.join(' > ')
}

/** What the inspector shows for one element, as computed rather than declared. */
export function readStyles(el: HTMLElement): ElementStyles {
  const view = (el.ownerDocument && el.ownerDocument.defaultView) || window
  const s = view.getComputedStyle(el)
  const px = (v: string): number => { const n = parseFloat(v); return isFinite(n) ? Math.round(n) : 0 }
  const toHex = (v: string): string => {
    if (!v) return '#000000'
    if (v.charAt(0) === '#') return v
    const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (!m) return '#000000'
    return '#' + [1, 2, 3].map((i) => {
      const h = parseInt(m[i], 10).toString(16); return h.length < 2 ? '0' + h : h
    }).join('')
  }
  // innerText where the DOM has it, textContent where it does not: the two
  // differ only over text the page is hiding, and a reading that stops
  // entirely is worse than one that counts a hidden line.
  const shown = (el.innerText !== undefined ? el.innerText : el.textContent) || ''
  const onlyText = el.children.length === 0 && shown.trim().length > 0
  return {
    text: onlyText ? shown : '',
    isText: onlyText,
    color: toHex(s.color),
    background: toHex(s.backgroundColor),
    fontSize: px(s.fontSize),
    fontWeight: parseInt(s.fontWeight, 10) || 400,
    paddingTop: px(s.paddingTop),
    paddingRight: px(s.paddingRight),
    paddingBottom: px(s.paddingBottom),
    paddingLeft: px(s.paddingLeft),
    borderRadius: px(s.borderTopLeftRadius)
  }
}

/** Which control a token gets: a colour well, a number, or a field. */
export function classifyToken(value: string): 'color' | 'number' | 'text' {
  const v = value.trim()
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return 'color'
  if (/^rgba?\(/i.test(v)) return 'color'
  if (/^hsla?\(/i.test(v)) return 'color'
  if (/^[\d.+-]+(px|em|rem|%|vw|vh|s|ms)?$/.test(v)) return 'number'
  return 'text'
}

/**
 * The custom properties a page declares on its root, with their real values.
 *
 * The declarations are found by reading the style tags, because that is where
 * the names are; the values come back from getComputedStyle, because that is
 * where a var() that points at another var() finally resolves.
 *
 * `classify` is passed in rather than called from module scope so that this
 * function still works once it has been serialised into the agent.
 */
export function readProjectTokens(
  doc: Document,
  classify: (value: string) => 'color' | 'number' | 'text'
): ProjectToken[] {
  const out: ProjectToken[] = []
  const seen: Record<string, boolean> = {}
  const styleEls = doc.querySelectorAll('style')
  styleEls.forEach((el) => {
    const text = el.textContent || ''
    const rootBlocks = text.match(/(?::root|html)[^{]*\{([^}]*)\}/g)
    if (!rootBlocks) return
    rootBlocks.forEach((block) => {
      const body = block.replace(/^[^{]*\{/, '').replace(/\}$/, '')
      const decls = body.split(/;/)
      for (const d of decls) {
        const m = d.match(/\s*(--[\w-]+)\s*:\s*([^;]+)/)
        if (!m) continue
        const name = m[1].trim()
        if (seen[name]) continue
        seen[name] = true
        let resolved = ''
        try {
          const view = doc.defaultView || window
          resolved = view.getComputedStyle(doc.documentElement).getPropertyValue(name).trim()
        } catch { /* a page that will not be measured keeps its declared value */ }
        const value = resolved || m[2].trim()
        out.push({ name, value, kind: classify(value) })
      }
    })
  })
  return out
}
