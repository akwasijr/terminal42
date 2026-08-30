import { extractCss } from './share'

// Detecting the guidelines rather than describing them.
//
// The report has to be short and specific — "7 inline styles, first one here"
// — which means the finding has to be a fact, not an opinion. So every rule
// below is decided by looking at the source, and a rule that could only be
// guessed at was left out of the catalogue entirely.
//
// The detectors work on text rather than a parsed tree because the same code
// has to judge an HTML file, a stylesheet and a React component, and because
// a project being checked is frequently not valid enough to parse.

export type ScanFile = { path: string; text: string }
export type FileKind = 'html' | 'css' | 'jsx'

export type Finding = {
  id: string
  /** How many times, or 1 for a rule about something missing. */
  count: number
  /** The first offending line, trimmed, so the row can be opened. */
  example?: string
  /** Which file it was first seen in. */
  file?: string
}

export function fileKind(path: string): FileKind | null {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase()
  if (ext === '.html' || ext === '.htm') return 'html'
  if (ext === '.css' || ext === '.scss' || ext === '.less') return 'css'
  if (ext === '.jsx' || ext === '.tsx' || ext === '.vue' || ext === '.svelte') return 'jsx'
  return null
}

/** Source with comments and string-ish noise removed, so counts are honest. */
function stripComments(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

function lineOf(text: string, index: number): string {
  const start = text.lastIndexOf('\n', index) + 1
  let end = text.indexOf('\n', index)
  if (end < 0) end = text.length
  return text.slice(start, end).trim().slice(0, 160)
}

/** Every match of a pattern, as a count plus the first line it appeared on. */
function occurrences(text: string, re: RegExp): { count: number; example?: string } {
  const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  let count = 0
  let example: string | undefined
  let m: RegExpExecArray | null
  while ((m = rx.exec(text)) !== null) {
    if (count === 0) example = lineOf(text, m.index)
    count += 1
    if (m.index === rx.lastIndex) rx.lastIndex += 1
  }
  return { count, example }
}

// ── Markup rules ──────────────────────────────────────────────────────────

const SEMANTIC = /<(main|nav|header|footer|section|article|aside|figure)\b/i

function scanMarkup(text: string): Finding[] {
  const out: Finding[] = []
  const push = (id: string, r: { count: number; example?: string }): void => {
    if (r.count > 0) out.push({ id, count: r.count, example: r.example })
  }

  // Four or more opening divs with no semantic element between them. Three
  // nested divs is ordinary; a fourth means the structure has stopped saying
  // anything about the content.
  {
    let count = 0
    let example: string | undefined
    const parts = text.split(SEMANTIC)
    for (const part of parts) {
      const runs = part.match(/(?:<div\b[^>]*>\s*){4,}/gi)
      if (!runs) continue
      count += runs.length
      if (!example) example = runs[0].replace(/\s+/g, ' ').trim().slice(0, 160)
    }
    push('div-soup', { count, example })
  }

  push('inline-styles', occurrences(text, /\sstyle\s*=\s*["'{]/i))
  push('div-button', occurrences(text, /<div\b[^>]*\son[Cc]lick/i))
  push('emoji-icons', occurrences(text, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u))
  push('positive-tabindex', occurrences(text, /tabindex\s*=\s*["'{]?\s*[1-9]/i))
  push('redundant-role', occurrences(text, /<(button|nav|main|header|footer|a)\b[^>]*\srole\s*=/i))
  push('href-less-link', occurrences(text, /<a\b(?![^>]*\shref)[^>]*>/i))
  push('unlabelled-input', occurrences(
    text, /<input\b(?![^>]*\b(?:aria-label|aria-labelledby|id)\s*=)(?![^>]*\btype\s*=\s*["']?(?:hidden|submit|button|reset))[^>]*>/i))

  // An image is missing its alt whether the attribute is absent or empty of
  // an explicit decorative marker; alt="" is deliberate and allowed.
  push('missing-alt', occurrences(text, /<img\b(?![^>]*\salt\s*=)[^>]*>/i))
  push('no-dimensions', occurrences(text, /<img\b(?![^>]*\swidth\s*=)[^>]*>/i))
  push('render-blocking', occurrences(text, /<script\b(?![^>]*\b(?:defer|async|type\s*=\s*["']module["']))[^>]*\ssrc\s*=/i))

  const imgs = occurrences(text, /<img\b/i)
  if (imgs.count > 0) {
    if (!/loading\s*=\s*["']?lazy/i.test(text)) out.push({ id: 'no-lazy', count: 1 })
    if (!/<picture\b/i.test(text) && !/\.(avif|webp)/i.test(text)) {
      out.push({ id: 'legacy-format', count: 1 })
    }
  }

  return out
}

/** Rules about something the whole document should have, judged once. */
function scanDocument(text: string): Finding[] {
  const out: Finding[] = []
  if (!/<main\b/i.test(text)) out.push({ id: 'no-landmarks', count: 1 })
  if (!/<html\b[^>]*\slang\s*=/i.test(text)) out.push({ id: 'no-lang', count: 1 })
  if (!/href\s*=\s*["']#(main|content|main-content)/i.test(text)) {
    out.push({ id: 'no-skip-link', count: 1 })
  }

  const h1s = occurrences(text, /<h1\b/i)
  if (h1s.count > 1) out.push({ id: 'multiple-h1', count: h1s.count, example: h1s.example })

  // A level is skipped when a heading is more than one deeper than the
  // deepest seen so far, which is what a reader notices as a missing rung.
  const levels = [...text.matchAll(/<h([1-6])\b/gi)].map((m) => ({ n: Number(m[1]), i: m.index ?? 0 }))
  let deepest = 0
  let skips = 0
  let skipExample: string | undefined
  for (const h of levels) {
    if (deepest > 0 && h.n > deepest + 1) {
      skips += 1
      if (!skipExample) skipExample = lineOf(text, h.i)
    }
    deepest = Math.max(deepest, h.n)
  }
  if (skips > 0) out.push({ id: 'heading-skip', count: skips, example: skipExample })

  return out
}

// ── Stylesheet rules ──────────────────────────────────────────────────────

function scanCss(text: string): Finding[] {
  const out: Finding[] = []
  const push = (id: string, r: { count: number; example?: string }): void => {
    if (r.count > 0) out.push({ id, count: r.count, example: r.example })
  }

  push('important', occurrences(text, /!important/i))
  push('float-layout', occurrences(text, /\bfloat\s*:\s*(left|right)/i))
  push('pure-black', occurrences(text, /:\s*(#000\b|#000000\b|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))/i))
  push('outline-none', occurrences(text, /outline\s*:\s*(none|0)\b/i))
  push('viewport-hero', occurrences(text, /\bheight\s*:\s*100vh\b/i))

  // A width in pixels is a problem on a container, not on an icon, so only
  // three figures and up count — nothing that small is a layout decision.
  // min-width and max-width are the fix being recommended, not the fault,
  // and a word boundary alone does not tell them apart from width.
  push('fixed-width', occurrences(text, /(?<![-\w])width\s*:\s*\d{3,}px/i))

  // Spacing is on the 4px grid or it is not; 0 and multiples of 4 pass.
  {
    let count = 0
    let example: string | undefined
    const rx = /\b(?:margin|padding|gap)(?:-(?:top|right|bottom|left|inline|block))?\s*:\s*([^;}]+)/gi
    let m: RegExpExecArray | null
    while ((m = rx.exec(text)) !== null) {
      const values = (m[1] ?? '').match(/(-?\d+(?:\.\d+)?)px/g) ?? []
      const bad = values.some((v) => {
        const n = Math.abs(parseFloat(v))
        return n > 0 && n % 4 !== 0
      })
      if (bad) {
        count += 1
        if (!example) example = lineOf(text, m.index)
      }
    }
    push('off-grid-spacing', { count, example })
  }

  // A colour spelled out is only a problem where a token could have gone, so
  // declarations inside :root are the definition and are left alone.
  {
    const withoutRoot = text.replace(/:root\b[^{]*\{[\s\S]*?\}/gi, '')
    push('hardcoded-colour', occurrences(withoutRoot, /:\s*(#[0-9a-f]{3,8}\b|rgba?\(|hsla?\()/i))
  }

  // A selector is what stands between the previous rule and this rule's
  // brace. Counting parts of a whole line instead, as a first attempt did,
  // calls every minified stylesheet deep.
  {
    let count = 0
    let example: string | undefined
    const rx = /(?:^|[};])([^{};]+)\{/g
    let m: RegExpExecArray | null
    while ((m = rx.exec(text)) !== null) {
      const selector = (m[1] ?? '').trim()
      if (!selector || selector.startsWith('@')) continue
      const deepest = Math.max(...selector.split(',').map(
        (s) => s.trim().split(/[\s>+~]+/).filter(Boolean).length))
      if (deepest > 4) {
        count += 1
        if (!example) example = selector.slice(0, 160)
      }
    }
    push('deep-selector', { count, example })
  }

  // Spacing a list with a margin on its children rather than a gap on the
  // parent is only worth saying where flex or grid is already in use.
  if (/display\s*:\s*(flex|grid)/i.test(text) && !/\bgap\s*:/i.test(text)) {
    const r = occurrences(text, /\bmargin(?:-(?:top|bottom|right|left))?\s*:\s*(?!0)/i)
    if (r.count > 0) out.push({ id: 'margin-spacing', count: r.count, example: r.example })
  }

  push('absolute-layout', occurrences(text, /\bposition\s*:\s*absolute/i))

  if (!/--[a-z0-9-]+\s*:/i.test(text)) out.push({ id: 'no-tokens', count: 1 })
  if (!/@media[^{]*min-width/i.test(text)) out.push({ id: 'no-responsive', count: 1 })
  if (!/:hover\b/i.test(text)) out.push({ id: 'no-hover', count: 1 })
  if (!/:focus(-visible)?\b/i.test(text)) out.push({ id: 'no-focus', count: 1 })
  if (!/prefers-color-scheme/i.test(text)) out.push({ id: 'no-dark-mode', count: 1 })
  if (!/color-scheme\s*:/i.test(text)) out.push({ id: 'no-colour-scheme', count: 1 })
  if (/@keyframes|animation\s*:|transition\s*:/i.test(text) && !/prefers-reduced-motion/i.test(text)) {
    out.push({ id: 'no-reduced-motion', count: 1 })
  }
  if (/@font-face/i.test(text) && !/font-display/i.test(text)) {
    out.push({ id: 'no-font-display', count: 1 })
  }

  // A control smaller than a fingertip, where a height is stated outright.
  {
    let count = 0
    let example: string | undefined
    const rx = /\b(?:height|min-height)\s*:\s*(\d+)px/gi
    let m: RegExpExecArray | null
    while ((m = rx.exec(text)) !== null) {
      if (Number(m[1]) < 44 && Number(m[1]) >= 16) {
        count += 1
        if (!example) example = lineOf(text, m.index)
      }
    }
    push('small-target', { count, example })
  }

  return out
}

/** Merge two findings for the same rule, keeping the first example seen. */
function merge(into: Map<string, Finding>, f: Finding, file: string): void {
  const prev = into.get(f.id)
  if (!prev) {
    into.set(f.id, { ...f, file })
    return
  }
  prev.count += f.count
  if (!prev.example && f.example) { prev.example = f.example; prev.file = file }
}

/**
 * Check a project. Absence rules ('no dark mode') are judged over everything
 * at once, because a stylesheet split across four files still only needs to
 * declare its tokens in one of them.
 */
export function scanProject(files: ScanFile[]): Finding[] {
  const kinds = files.map((f) => ({ ...f, kind: fileKind(f.path) })).filter((f) => f.kind !== null)
  if (kinds.length === 0) return []

  const perRule = new Map<string, Finding>()
  const absent = new Map<string, Finding>()

  const ABSENCE = new Set([
    'no-landmarks', 'no-lang', 'no-skip-link', 'no-lazy', 'legacy-format',
    'no-tokens', 'no-responsive', 'no-hover', 'no-focus', 'no-dark-mode',
    'no-colour-scheme', 'no-reduced-motion', 'no-font-display'
  ])

  // Everything the project's styles amount to, wherever they were written.
  const allCss = kinds
    .map((f) => (f.kind === 'css' ? stripComments(f.text) : extractCss(stripComments(f.text))))
    .filter(Boolean)
    .join('\n')
  const allMarkup = kinds.filter((f) => f.kind !== 'css').map((f) => stripComments(f.text)).join('\n')
  const hasHtml = kinds.some((f) => f.kind === 'html')

  const take = (findings: Finding[], file: string): void => {
    for (const f of findings) {
      if (ABSENCE.has(f.id)) {
        if (!absent.has(f.id)) absent.set(f.id, { ...f, file })
      } else merge(perRule, f, file)
    }
  }

  for (const f of kinds) {
    const text = stripComments(f.text)
    if (f.kind === 'css') continue
    take(scanMarkup(text).filter((x) => !ABSENCE.has(x.id)), f.path)
  }
  if (allCss.trim()) take(scanCss(allCss).filter((x) => !ABSENCE.has(x.id)), 'styles')

  // The absence rules, asked once of the whole project.
  if (hasHtml) {
    for (const f of scanDocument(allMarkup)) {
      if (ABSENCE.has(f.id)) absent.set(f.id, f)
      else merge(perRule, f, 'document')
    }
    for (const f of scanMarkup(allMarkup)) if (ABSENCE.has(f.id)) absent.set(f.id, f)
  }
  if (allCss.trim()) for (const f of scanCss(allCss)) if (ABSENCE.has(f.id)) absent.set(f.id, f)

  return [...perRule.values(), ...absent.values()].sort((a, b) => b.count - a.count)
}
