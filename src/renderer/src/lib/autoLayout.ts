import type { FObj } from './freeformTypes'

/** True when a frame is configured as a flex / auto-layout container. */
export function isFlex(o: FObj): boolean {
  return o.type === 'frame' && !!o.layoutMode && o.layoutMode !== 'none'
}

interface FrameSize { w: number; h: number }
interface ChildBox { id: string; x: number; y: number; w: number; h: number }

/** Derived column count for a grid frame. */
function gridCols(frame: FObj, n: number): number {
  if (frame.layoutCols && frame.layoutCols > 0) return Math.min(frame.layoutCols, Math.max(1, n))
  return Math.max(1, Math.ceil(Math.sqrt(n)))
}

/** Uniform grid layout: children flow row-major into equal cells, frame hugs. */
function layoutGrid(frame: FObj, childrenIn: FObj[]): { children: ChildBox[]; size: FrameSize } {
  const padX = frame.layoutPadX ?? frame.layoutPadding ?? 16
  const padY = frame.layoutPadY ?? frame.layoutPadding ?? 16
  const gap = frame.layoutGap ?? 12
  // reading order: top→bottom, then left→right
  const children = [...childrenIn].sort((a, b) => (a.y - b.y) || (a.x - b.x))
  const n = children.length
  const cols = gridCols(frame, n)
  const rows = Math.max(1, Math.ceil(n / cols))
  const cellW = children.reduce((m, c) => Math.max(m, c.w), 0)
  const cellH = children.reduce((m, c) => Math.max(m, c.h), 0)
  const wMode = frame.widthMode ?? 'fixed'
  const hMode = frame.heightMode ?? 'fixed'
  let w = frame.w
  let h = frame.h
  if (wMode === 'fit') w = padX * 2 + cols * cellW + (cols - 1) * gap
  if (hMode === 'fit') h = padY * 2 + rows * cellH + (rows - 1) * gap
  const out: ChildBox[] = children.map((c, i) => {
    const col = i % cols
    const rw = Math.floor(i / cols)
    return {
      id: c.id,
      x: Math.round(frame.x + padX + col * (cellW + gap)),
      y: Math.round(frame.y + padY + rw * (cellH + gap)),
      w: Math.round(c.w),
      h: Math.round(c.h),
    }
  })
  return { children: out, size: { w: Math.round(w), h: Math.round(h) } }
}

/** Wrapped flex: pack along the main axis, wrap to a new line when overflowing. */
function layoutWrapped(frame: FObj, childrenIn: FObj[]): { children: ChildBox[]; size: FrameSize } {
  const row = frame.layoutMode !== 'vertical'
  const padX = frame.layoutPadX ?? frame.layoutPadding ?? 16
  const padY = frame.layoutPadY ?? frame.layoutPadding ?? 16
  const gap = frame.layoutGap ?? 12
  const padMain = row ? padX : padY
  const padCross = row ? padY : padX
  const mainSize = (o: FObj): number => (row ? o.w : o.h)
  const crossSize = (o: FObj): number => (row ? o.h : o.w)
  const children = [...childrenIn].sort((a, b) => (row ? (a.y - b.y) || (a.x - b.x) : (a.x - b.x) || (a.y - b.y)))
  const mainExtent = row ? frame.w : frame.h
  const boundary = mainExtent - padMain * 2

  // group into lines
  const lines: FObj[][] = []
  let line: FObj[] = []
  let used = 0
  for (const c of children) {
    const s = mainSize(c)
    if (line.length && used + gap + s > boundary) { lines.push(line); line = []; used = 0 }
    if (line.length) used += gap
    used += s
    line.push(c)
  }
  if (line.length) lines.push(line)

  const lineCross = lines.map((l) => l.reduce((m, c) => Math.max(m, crossSize(c)), 0))
  const lineMain = lines.map((l) => l.reduce((s, c) => s + mainSize(c), 0) + gap * Math.max(0, l.length - 1))
  const contentCross = lineCross.reduce((s, v) => s + v, 0) + gap * Math.max(0, lines.length - 1)
  const contentMain = lineMain.reduce((m, v) => Math.max(m, v), 0)

  const wMode = frame.widthMode ?? 'fixed'
  const hMode = frame.heightMode ?? 'fixed'
  let w = frame.w
  let h = frame.h
  if (row) {
    if (wMode === 'fit') w = contentMain + padMain * 2
    if (hMode === 'fit') h = contentCross + padCross * 2
  } else {
    if (hMode === 'fit') h = contentMain + padMain * 2
    if (wMode === 'fit') w = contentCross + padCross * 2
  }
  const align = frame.layoutAlign ?? 'start'
  const out: ChildBox[] = []
  let crossCursor = padCross
  lines.forEach((l, li) => {
    let mainCursor = padMain
    for (const c of l) {
      const cs = crossSize(c)
      let cross = crossCursor
      if (align === 'center') cross = crossCursor + Math.max(0, (lineCross[li] - cs) / 2)
      else if (align === 'end') cross = crossCursor + Math.max(0, lineCross[li] - cs)
      const localMain = mainCursor
      mainCursor += mainSize(c) + gap
      const localX = row ? localMain : cross
      const localY = row ? cross : localMain
      out.push({ id: c.id, x: Math.round(frame.x + localX), y: Math.round(frame.y + localY), w: Math.round(c.w), h: Math.round(c.h) })
    }
    crossCursor += lineCross[li] + gap
  })
  return { children: out, size: { w: Math.round(w), h: Math.round(h) } }
}

/**
 * Lay out a flex frame's direct children (Figma auto-layout). Returns the new
 * absolute child boxes and the frame's resolved size (which may grow to hug its
 * content when the matching axis is set to "fit"). A child can "fill" the main
 * axis (grow to share leftover space) or the cross axis (stretch). Pure.
 */
export function layoutFrame(frame: FObj, childrenIn: FObj[]): { children: ChildBox[]; size: FrameSize } {
  if (frame.layoutMode === 'grid') return layoutGrid(frame, childrenIn)
  if (frame.layoutWrap && childrenIn.length > 1) return layoutWrapped(frame, childrenIn)
  const row = frame.layoutMode !== 'vertical'
  const padX = frame.layoutPadX ?? frame.layoutPadding ?? 16
  const padY = frame.layoutPadY ?? frame.layoutPadding ?? 16
  const gap = frame.layoutGap ?? 12
  const padMain = row ? padX : padY
  const padCross = row ? padY : padX
  const mainSize = (o: FObj): number => (row ? o.w : o.h)
  const crossSize = (o: FObj): number => (row ? o.h : o.w)
  const mainMode = (o: FObj): string => (row ? o.widthMode : o.heightMode) ?? 'fixed'
  const crossMode = (o: FObj): string => (row ? o.heightMode : o.widthMode) ?? 'fixed'

  // Order children by their current main-axis position so manual drag reorders.
  const children = [...childrenIn].sort((a, b) => (row ? a.x - b.x : a.y - b.y))
  const n = children.length

  const fixedMain = children.reduce((s, c) => s + (mainMode(c) === 'fill' ? 0 : mainSize(c)), 0)
  const fillCount = children.filter((c) => mainMode(c) === 'fill').length
  const maxCross = children.reduce((m, c) => Math.max(m, crossSize(c)), 0)
  const contentMain = fixedMain + gap * Math.max(0, n - 1)

  // Resolve the frame size. "fit" hugs the content on that axis; otherwise keep it.
  const wMode = frame.widthMode ?? 'fixed'
  const hMode = frame.heightMode ?? 'fixed'
  let w = frame.w
  let h = frame.h
  if (row) {
    if (wMode === 'fit') w = contentMain + padMain * 2
    if (hMode === 'fit') h = maxCross + padCross * 2
  } else {
    if (hMode === 'fit') h = contentMain + padMain * 2
    if (wMode === 'fit') w = maxCross + padCross * 2
  }
  const innerMain = (row ? w : h) - padMain * 2
  const innerCross = (row ? h : w) - padCross * 2

  // Distribute leftover main-axis space among "fill" children.
  const leftover = Math.max(0, innerMain - contentMain)
  const fillMain = fillCount > 0 ? leftover / fillCount : 0
  const effMain = (c: FObj): number => (mainMode(c) === 'fill' ? Math.max(1, fillMain) : mainSize(c))
  const effCross = (c: FObj): number => (crossMode(c) === 'fill' ? Math.max(1, innerCross) : crossSize(c))

  const usedMain = children.reduce((s, c) => s + effMain(c), 0) + gap * Math.max(0, n - 1)
  const justify = frame.layoutJustify ?? 'start'
  let cursor = padMain
  let step = gap
  if (fillCount === 0) {
    if (justify === 'center') cursor = padMain + Math.max(0, (innerMain - usedMain) / 2)
    else if (justify === 'end') cursor = padMain + Math.max(0, innerMain - usedMain)
    else if (justify === 'space-between' && n > 1) step = gap + Math.max(0, (innerMain - usedMain) / (n - 1))
  }

  const align = frame.layoutAlign ?? 'start'
  const out: ChildBox[] = children.map((c) => {
    const cm = effMain(c)
    const cc = effCross(c)
    let cross = padCross
    if (crossMode(c) !== 'fill') {
      if (align === 'center') cross = padCross + Math.max(0, (innerCross - cc) / 2)
      else if (align === 'end') cross = padCross + Math.max(0, innerCross - cc)
    }
    const localMain = cursor
    cursor += cm + step
    const localX = row ? localMain : cross
    const localY = row ? cross : localMain
    return {
      id: c.id,
      x: Math.round(frame.x + localX),
      y: Math.round(frame.y + localY),
      w: Math.round(row ? cm : cc),
      h: Math.round(row ? cc : cm),
    }
  })
  return { children: out, size: { w: Math.round(w), h: Math.round(h) } }
}

/** Parent-chain depth of an object (0 = top-level). */
function depthOf(o: FObj, byId: Map<string, FObj>): number {
  let d = 0
  let cur = o.parent ? byId.get(o.parent) : undefined
  const seen = new Set<string>([o.id])
  while (cur && !seen.has(cur.id)) { d++; seen.add(cur.id); cur = cur.parent ? byId.get(cur.parent) : undefined }
  return d
}

/**
 * Reflow every flex frame in `objects`, deepest frames first so a nested
 * container's size settles before its parent positions it. Idempotent: returns
 * the SAME array reference when nothing moved (so it can be called from an effect
 * without looping).
 */
export function reflowAll(objects: FObj[]): FObj[] {
  const flexFrames = objects.filter(isFlex)
  if (!flexFrames.length) return objects
  const byId = new Map(objects.map((o) => [o.id, o]))
  const patched = new Map<string, Partial<FObj>>()
  const cur = (id: string): FObj => {
    const base = byId.get(id)!
    const p = patched.get(id)
    return p ? { ...base, ...p } : base
  }
  const ordered = [...flexFrames].sort((a, b) => depthOf(b, byId) - depthOf(a, byId))
  let changed = false
  for (const f of ordered) {
    const frame = cur(f.id)
    const kids = objects.filter((k) => k.parent === f.id).map((k) => cur(k.id))
    if (!kids.length) continue
    const res = layoutFrame(frame, kids)
    if (res.size.w !== frame.w || res.size.h !== frame.h) {
      patched.set(f.id, { ...patched.get(f.id), w: res.size.w, h: res.size.h })
      changed = true
    }
    for (const c of res.children) {
      const o = cur(c.id)
      if (o.x !== c.x || o.y !== c.y || o.w !== c.w || o.h !== c.h) {
        patched.set(c.id, { ...patched.get(c.id), x: c.x, y: c.y, w: c.w, h: c.h })
        changed = true
      }
    }
  }
  if (!changed) return objects
  return objects.map((o) => (patched.has(o.id) ? { ...o, ...patched.get(o.id) } : o))
}
