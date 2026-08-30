// Handing a design to something else — a coding agent, another tool in the
// app, a colleague — used to mean picking one of several near-identical
// export commands and then going looking for the file it wrote. What is
// actually wanted is usually smaller than a file: the path, so an agent can
// open it, or the stylesheet, so it can be reused. Both are here, next to the
// formats, because they are all answers to the same question.

/** The `<style>` blocks of a document, in order, as one stylesheet. */
export function extractCss(html: string): string {
  const out: string[] = []
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const body = (m[1] ?? '').trim()
    if (body) out.push(body)
  }
  return out.join('\n\n')
}

/**
 * A design's `:root` custom properties, which is what someone means by "the
 * tokens" when they ask for them. Later declarations win, as they do in CSS.
 */
export function extractTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  const blocks = css.match(/:root\b[^{]*\{([\s\S]*?)\}/gi) ?? []
  for (const block of blocks) {
    const body = block.slice(block.indexOf('{') + 1, block.lastIndexOf('}'))
    for (const decl of body.split(';')) {
      const i = decl.indexOf(':')
      if (i < 0) continue
      const name = decl.slice(0, i).trim()
      const value = decl.slice(i + 1).trim()
      if (name.startsWith('--') && value) tokens[name] = value
    }
  }
  return tokens
}

/**
 * What to paste into a coding agent. A path on its own is ambiguous once you
 * have several; the title says which design it is, and the file name says
 * which version, so the reference still means something an hour later.
 */
export function shareReference(a: { title: string; fileName: string; filePath: string }): string {
  const version = a.fileName.replace(/\.[^.]+$/, '')
  const name = a.title.trim() || 'Untitled design'
  return `${name} · ${version}\n${a.filePath}`
}

/** A home-relative path, which is shorter to read and safe to show. */
export function friendlyPath(p: string): string {
  return p.replace(/^\/Users\/[^/]+/, '~')
}
