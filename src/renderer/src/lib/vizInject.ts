/**
 * VizTweak v2: thin in-page bridge.
 *
 * Responsibilities (kept tiny on purpose):
 *   • Pick mode: hover highlight + click-to-select with outline overlay.
 *   • On select, emit element metadata + computed styles via console.log
 *     (consumed by the BrowserPane via the webview `console-message` event).
 *   • Expose `window.__t42viz.apply(selector, props)` and `.reset(selector)`
 *     so the React side panel can drive style changes with no UI duplication.
 *
 * Intentionally NOT here: editor inputs, annotation textarea, diff list. Those
 * all live in the React side panel where we have proper layout and tokens.
 */

const TRACKED = [
  // Layout
  'display', 'flexDirection', 'justifyContent', 'alignItems', 'flexWrap', 'gap',
  // Box
  'width', 'height',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  // Type
  'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
  'textAlign', 'color',
  // Fill / border / shape
  'backgroundColor',
  'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'borderRadius',
  'boxShadow', 'opacity'
] as const

const SCRIPT = `
(function () {
  if (window.__t42viz && window.__t42viz.__installed) return
  var TRACKED = __TRACKED__
  var EMIT = '__T42VT__:'
  function emit(payload) {
    try { console.log(EMIT + JSON.stringify(payload)) } catch (e) {}
  }

  // ─── Outline overlay (selection + hover) ──────────────────────────────
  var ns = 't42viz'
  function el(tag, props) {
    var n = document.createElement(tag)
    if (props) for (var k in props) n.style[k] = props[k]
    n.setAttribute('data-' + ns, '1')
    return n
  }
  var hoverBox = el('div', {
    position: 'fixed', pointerEvents: 'none', zIndex: 2147483646,
    border: '1px dashed rgba(56,139,253,0.55)',
    background: 'rgba(56,139,253,0.06)', display: 'none',
    transition: 'all 60ms linear', borderRadius: '2px'
  })
  var selBox = el('div', {
    position: 'fixed', pointerEvents: 'none', zIndex: 2147483647,
    border: '2px solid rgba(56,139,253,0.95)',
    background: 'transparent', display: 'none', borderRadius: '2px',
    boxShadow: '0 0 0 9999px rgba(0,0,0,0)'
  })
  var selLabel = el('div', {
    position: 'fixed', pointerEvents: 'none', zIndex: 2147483647,
    background: 'rgba(56,139,253,0.95)', color: '#fff',
    font: '500 11px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    padding: '3px 6px', borderRadius: '3px', display: 'none', whiteSpace: 'nowrap'
  })
  function attach() {
    if (!document.body) return
    if (!hoverBox.isConnected) document.body.appendChild(hoverBox)
    if (!selBox.isConnected) document.body.appendChild(selBox)
    if (!selLabel.isConnected) document.body.appendChild(selLabel)
  }

  function isOurs(node) {
    return node && node.nodeType === 1 && node.getAttribute && node.getAttribute('data-' + ns) === '1'
  }
  function rect(elNode) {
    var r = elNode.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  }
  function placeBox(box, elNode) {
    var r = rect(elNode)
    box.style.left = r.x + 'px'
    box.style.top = r.y + 'px'
    box.style.width = r.w + 'px'
    box.style.height = r.h + 'px'
    box.style.display = 'block'
  }
  function placeLabel(elNode, text) {
    var r = rect(elNode)
    selLabel.textContent = text
    selLabel.style.display = 'block'
    var top = r.y - 22
    if (top < 4) top = r.y + 4
    selLabel.style.top = top + 'px'
    selLabel.style.left = Math.max(4, r.x) + 'px'
  }

  // ─── Selector generation ───────────────────────────────────────────────
  function selectorFor(elNode) {
    if (!elNode || elNode.nodeType !== 1) return ''
    if (elNode.id) return '#' + CSS.escape(elNode.id)
    var parts = []
    var cur = elNode
    var depth = 0
    while (cur && cur.nodeType === 1 && depth < 5 && cur !== document.body) {
      var part = cur.tagName.toLowerCase()
      if (cur.classList && cur.classList.length) {
        var cls = Array.prototype.slice.call(cur.classList)
          .filter(function (c) { return !/^t42|^viz/.test(c) })
          .slice(0, 2)
          .map(function (c) { return '.' + CSS.escape(c) })
          .join('')
        part += cls
      }
      var parent = cur.parentElement
      if (parent) {
        var sibs = Array.prototype.filter.call(parent.children, function (s) {
          return s.tagName === cur.tagName
        })
        if (sibs.length > 1) {
          var idx = sibs.indexOf(cur) + 1
          part += ':nth-of-type(' + idx + ')'
        }
      }
      parts.unshift(part)
      cur = parent
      depth++
    }
    return parts.join(' > ')
  }

  // ─── Element serialization ─────────────────────────────────────────────
  function serialize(elNode) {
    var cs = window.getComputedStyle(elNode)
    var computed = {}
    for (var i = 0; i < TRACKED.length; i++) {
      var k = TRACKED[i]
      computed[k] = cs[k]
    }
    var classes = []
    if (elNode.classList) {
      for (var j = 0; j < elNode.classList.length; j++) {
        var c = elNode.classList[j]
        if (!/^t42|^viz/.test(c)) classes.push(c)
      }
    }
    return {
      tag: elNode.tagName.toLowerCase(),
      selector: selectorFor(elNode),
      id: elNode.id || null,
      classes: classes,
      rect: rect(elNode),
      computed: computed,
      text: (elNode.textContent || '').trim().slice(0, 80)
    }
  }

  // ─── Pick mode ─────────────────────────────────────────────────────────
  var picking = false
  var selected = null

  function onMove(ev) {
    if (!picking) return
    var t = ev.target
    if (!t || t.nodeType !== 1 || isOurs(t)) { hoverBox.style.display = 'none'; return }
    placeBox(hoverBox, t)
  }
  function onClick(ev) {
    if (!picking) return
    var t = ev.target
    if (!t || t.nodeType !== 1 || isOurs(t)) return
    ev.preventDefault(); ev.stopPropagation()
    selected = t
    placeBox(selBox, t)
    placeLabel(t, t.tagName.toLowerCase())
    hoverBox.style.display = 'none'
    setPicking(false)
    emit({ type: 'select', el: serialize(t) })
  }
  function onScroll() {
    if (selected) { placeBox(selBox, selected); placeLabel(selected, selected.tagName.toLowerCase()) }
  }
  function onKey(ev) {
    if (ev.key === 'Escape') { setPicking(false); clearSelection() }
  }
  function setPicking(on) {
    picking = !!on
    document.documentElement.style.cursor = picking ? 'crosshair' : ''
    if (!picking) hoverBox.style.display = 'none'
    emit({ type: 'pickMode', on: picking })
  }
  function clearSelection() {
    selected = null
    selBox.style.display = 'none'
    selLabel.style.display = 'none'
    emit({ type: 'select', el: null })
  }

  document.addEventListener('mousemove', onMove, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKey, true)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onScroll, true)

  // Re-attach overlays if React re-mounts the body etc.
  var mo = new MutationObserver(function () { attach(); if (selected && document.contains(selected)) onScroll() })
  if (document.body) mo.observe(document.body, { childList: true, subtree: false })

  // ─── Public API for the renderer ──────────────────────────────────────
  function camelToKebab(p) { return p.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase() }) }
  function applyOne(node, props) {
    if (!node || !node.style) return
    for (var p in props) {
      try { node.style.setProperty(camelToKebab(p), String(props[p]), 'important') } catch (e) {}
    }
  }
  function resetOne(node, keys) {
    if (!node || !node.style) return
    for (var i = 0; i < keys.length; i++) {
      try { node.style.removeProperty(camelToKebab(keys[i])) } catch (e) {}
    }
  }
  function findAll(sel) {
    if (!sel) return []
    try { return Array.prototype.slice.call(document.querySelectorAll(sel)) } catch (e) { return [] }
  }

  attach()
  window.__t42viz = {
    __installed: true,
    setPicking: setPicking,
    clearSelection: clearSelection,
    apply: function (selector, props) {
      var nodes = findAll(selector)
      for (var i = 0; i < nodes.length; i++) applyOne(nodes[i], props)
      if (selected && nodes.indexOf(selected) >= 0) onScroll()
    },
    reset: function (selector, keys) {
      var nodes = findAll(selector)
      var ks = keys && keys.length ? keys : TRACKED
      for (var i = 0; i < nodes.length; i++) resetOne(nodes[i], ks)
      if (selected && nodes.indexOf(selected) >= 0) onScroll()
    },
    refresh: function () {
      if (selected && document.contains(selected)) {
        emit({ type: 'select', el: serialize(selected) })
        onScroll()
      }
    }
  }
  emit({ type: 'ready' })
})();
`

export const VIZ_INJECT_JS = SCRIPT.replace('__TRACKED__', JSON.stringify(TRACKED))

export const VIZ_TRACKED_PROPS = TRACKED

export type VizSelected = {
  tag: string
  selector: string
  id: string | null
  classes: string[]
  rect: { x: number; y: number; w: number; h: number }
  computed: Record<string, string>
  text: string
}
