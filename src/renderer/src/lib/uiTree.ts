import { type ObjectSpec } from './canvasAgent'
import { type Kit, DEFAULT_KIT, buildComponent, componentHeight, isComponent, vibrantAccent } from './uiKit'
import { readablePair } from './designQA'

// ── Semantic UI tree → deterministic layout ──────────────────────────────────
// The assistant emits INTENT only: a tree of auto-layout containers (stack/row/
// grid) holding kit components and content. This compiler owns ALL geometry, so
// the model never guesses coordinates — the thing that lets quality scale to any
// screen, not just hand-built ones.

export interface UINode {
  // leaf: a kit component
  component?: string
  props?: Record<string, unknown>
  // leaf: raw text
  text?: string
  fontSize?: number
  fontWeight?: number
  color?: string
  align?: 'left' | 'center' | 'right'
  // container
  stack?: 'y' | 'x' | 'grid'
  gap?: number
  pad?: number
  cols?: number
  bg?: string
  radius?: number
  // shared
  name?: string
  h?: number            // explicit height (spacer, or fixed leaf)
  w?: number            // fixed width inside a row (others share remaining space)
  grow?: boolean        // in a row, share leftover width equally
  children?: UINode[]
}

export interface CompileOpts { kit?: Kit; accent?: string; width?: number }
interface Compiled { specs: ObjectSpec[]; w: number; h: number }

let _uid = 0
const tid = (p: string): string => `${p}${(_uid++).toString(36)}`

// Measure the wrapped height of a text leaf so a heading that wraps to multiple
// lines reserves real vertical space — otherwise the next stacked element renders
// on top of it (the classic overlapping-hero bug). Honours explicit "\n" breaks and
// word-wraps at the available width using a shared canvas context; falls back to a
// character-width estimate when no DOM is available (tests/SSR).
let _measureCtx: CanvasRenderingContext2D | null | undefined
function measureCtx(): CanvasRenderingContext2D | null {
  if (_measureCtx !== undefined) return _measureCtx
  try { _measureCtx = (typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null) } catch { _measureCtx = null }
  return _measureCtx
}
function wrappedTextHeight(text: string, fs: number, fw: number, w: number): number {
  const lineH = Math.round(fs * 1.35)
  const paras = (text || '').split('\n')
  const ctx = w > 0 ? measureCtx() : null
  if (!ctx) {
    const cpl = Math.max(1, Math.floor(w / (fs * 0.55)))
    let lines = 0
    for (const p of paras) lines += Math.max(1, Math.ceil((p.length || 1) / cpl))
    return Math.max(1, lines) * lineH
  }
  ctx.font = `${fw} ${fs}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  let lines = 0
  for (const p of paras) {
    if (!p) { lines += 1; continue }
    let line = ''
    for (const word of p.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > w && line) { lines++; line = word } else line = test
    }
    if (line) lines++
  }
  return Math.max(1, lines) * lineH
}

function leafText(node: UINode, x: number, y: number, w: number, k: Kit): Compiled {
  const fs = node.fontSize ?? 15
  const h = node.h ?? wrappedTextHeight(node.text ?? '', fs, node.fontWeight ?? 400, w)
  return {
    specs: [{ type: 'text', name: node.name || 'Text', x, y, w, h, text: node.text ?? '', color: node.color ?? k.ink, fontSize: fs, fontWeight: node.fontWeight ?? 400, align: node.align ?? 'left' }],
    w, h
  }
}

// The compiler already knows the layout intent for every container it emits, so
// it stamps the auto-layout fields the canvas engine reads. Generated frames then
// behave like hand-built ones: change a label, everything reflows. Values are
// always explicit, never left undefined, because the engine falls back to gap 12
// and pad 16 and that would shift the geometry the compiler just computed.
const LAYOUT_MODE = { x: 'horizontal', y: 'vertical', grid: 'grid' } as const

function compile(node: UINode, x: number, y: number, w: number, k: Kit): Compiled {
  // Component leaf — kit owns its internal geometry.
  if (node.component && isComponent(node.component)) {
    const props = (node.props && typeof node.props === 'object' ? node.props : {}) as Record<string, unknown>
    const specs = buildComponent(node.component, x, y, w, props, k)
    return { specs, w, h: componentHeight(node.component, props, w) }
  }
  // Raw text leaf.
  if (typeof node.text === 'string' && !node.children) return leafText(node, x, y, w, k)
  // Spacer.
  if (!node.children || !node.children.length) return { specs: [], w, h: node.h ?? 0 }

  // Container.
  const ref = tid('box')
  const pad = node.pad ?? 0
  const gap = node.gap ?? 0
  const kids = node.children
  const mode = LAYOUT_MODE[node.stack ?? 'y']
  const frame: ObjectSpec = {
    type: 'frame', ref, name: node.name || 'Frame', x, y, w, h: 0,
    fillEnabled: !!node.bg, ...(node.bg ? { fill: resolveColor(node.bg, k) } : {}), strokeEnabled: false,
    ...(typeof node.radius === 'number' ? { radius: node.radius } : {}),
    layoutMode: mode, layoutGap: gap, layoutPadX: pad, layoutPadY: pad, layoutAlign: 'start', layoutJustify: 'start',
    ...(mode === 'grid' ? { layoutCols: Math.max(1, node.cols ?? 2) } : {}),
    widthMode: 'fixed', heightMode: 'fit'
  }
  const out: ObjectSpec[] = [frame]
  const innerX = x + pad, innerY = y + pad, innerW = w - pad * 2

  if (node.stack === 'x') {
    // fixed-width children (node.w) keep their size; the rest share the remainder.
    const n = kids.length
    const fixed = kids.reduce((s, c) => s + (c.w || 0), 0)
    const flexCount = kids.filter((c) => !c.w).length
    const flexW = flexCount > 0 ? (innerW - gap * (n - 1) - fixed) / flexCount : 0
    let cx = innerX, maxH = 0
    for (const child of kids) {
      const cw = child.w || flexW
      const r = compile(child, cx, innerY, cw, k)
      attach(r.specs, ref, { widthMode: child.w ? 'fixed' : 'fill', heightMode: 'fixed' }); out.push(...r.specs)
      cx += cw + gap; maxH = Math.max(maxH, r.h)
    }
    frame.h = maxH + pad * 2
  } else if (node.stack === 'grid') {
    const cols = Math.max(1, node.cols ?? 2)
    const cellW = (innerW - gap * (cols - 1)) / cols
    // Two passes: measure every cell, then place on a uniform row height. Ragged
    // rows would put the compiler and the reflow engine at odds, and equal cards
    // read better anyway.
    const cells = kids.map((child, i) => compile(child, innerX + (i % cols) * (cellW + gap), innerY, cellW, k))
    const cellH = cells.reduce((m, c) => Math.max(m, c.h), 0)
    const rows = Math.max(1, Math.ceil(kids.length / cols))
    cells.forEach((r, i) => {
      const dy = Math.floor(i / cols) * (cellH + gap)
      const moved = dy ? r.specs.map((sp) => ({ ...sp, y: (sp.y ?? 0) + dy })) : r.specs
      attach(moved, ref, { widthMode: 'fixed', heightMode: 'fixed' }); out.push(...moved)
    })
    frame.h = rows * cellH + gap * (rows - 1) + pad * 2
    if (frame.h < pad * 2) frame.h = pad * 2
  } else {
    // vertical stack (default)
    let cy = innerY
    for (const child of kids) {
      const r = compile(child, innerX, cy, innerW, k)
      attach(r.specs, ref, { widthMode: 'fill', heightMode: 'fixed' }); out.push(...r.specs)
      cy += r.h + gap
    }
    frame.h = (cy - gap - innerY) + pad * 2
    if (frame.h < pad * 2) frame.h = pad * 2
  }
  return { specs: out, w, h: frame.h }
}

/** Parent each child's ROOT spec to the container; nested children keep their parent.
 *  The sizing modes go on at the same time: only the container knows whether a
 *  child was given a fixed width or told to share what was left. A nested
 *  container hugs its own content, so its heightMode is never overwritten. */
function attach(specs: ObjectSpec[], parentRef: string, sizing?: { widthMode: 'fixed' | 'fill'; heightMode: 'fixed' }): void {
  if (!specs.length) return
  const root = specs[0]
  const hugs = root.type === 'frame' && root.heightMode === 'fit'
  specs[0] = { ...root, parent: parentRef, ...(sizing ? { widthMode: sizing.widthMode, ...(hugs ? {} : { heightMode: sizing.heightMode }) } : {}) }
}

function resolveColor(v: string, k: Kit): string {
  const map: Record<string, string> = { accent: k.accent, ink: k.ink, muted: k.muted, faint: k.faint, surface: k.surface, card: k.card, border: k.border, bg: k.bg, white: '#ffffff' }
  return map[v] ?? v
}

/** Compile a semantic tree into positioned ObjectSpecs ready for buildObject. */
export function compileTree(root: UINode, opts: CompileOpts = {}): ObjectSpec[] {
  const baseKit = opts.kit ?? DEFAULT_KIT
  // Enforce a confident accent: a missing or near-grey accent (the monochrome
  // failure mode) is swapped for a tasteful default so the primary is never grey.
  const accent = vibrantAccent(opts.accent ?? baseKit.accent)
  const pair = readablePair(accent)
  const kit: Kit = { ...baseKit, accent: pair.bg, onAccent: pair.ink }
  const w = opts.width ?? 390
  return compile(root, 0, 0, w, kit).specs
}
