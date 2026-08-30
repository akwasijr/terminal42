/**
 * Making a design's relative URLs resolve when it is rendered through srcDoc.
 *
 * A browser resolves relative URLs in an srcDoc document against
 * about:srcdoc, so every local image, stylesheet and script in a design would
 * break. Injecting the design's own directory as a <base> fixes that.
 *
 * The catch, and the bug this was extracted for: a document may already
 * declare its own base. A built starter template does — "./dist/", because
 * that is where its assets are. Injecting ours in front of it did not add to
 * that, it replaced it, because the first <base> with an href is the only one
 * that counts. Assets were then looked for one directory too high and the
 * page came up blank.
 *
 * So an existing base is resolved against the design directory rather than
 * overruled, and only a document without one is given ours.
 *
 * This lives apart from design.ts so it can be tested without Electron.
 */

/** Rewrite or inject the <base> so relative URLs resolve against `baseHref`. */
export function applyBaseHref(content: string, baseHref: string): string {
  if (!baseHref) return content

  const existing = /<base\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*>/i.exec(content)
  if (existing) {
    const declared = existing[1]
    // An absolute href is a deliberate choice; leave it alone.
    const absolute = /^[a-z][a-z0-9+.-]*:/i.test(declared) || declared.startsWith('//')
    if (absolute) return content
    let resolved = baseHref
    try { resolved = new URL(declared, baseHref).toString() } catch { /* keep the design dir */ }
    return content.replace(existing[0], `<base href="${resolved}">`)
  }

  const baseTag = `<base href="${baseHref}">`
  return /<head[^>]*>/i.test(content)
    ? content.replace(/<head([^>]*)>/i, (_m, attrs) => `<head${attrs}>${baseTag}`)
    : baseTag + content
}

/** The base a document's relative URLs resolve against, after applyBaseHref. */
export function effectiveBase(content: string, baseHref: string): string {
  const m = /<base\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*>/i.exec(content)
  return m ? m[1] : baseHref
}

const REMOTE = /^(https?:|data:|blob:|\/\/)/i

/**
 * Pull a design's own scripts and stylesheets into the document.
 *
 * Setting the base is not enough on its own. The preview is an srcDoc
 * document inside a page served over http, so a <script src="file://…">
 * — which is what a built starter's bundle is — is refused as cross-origin
 * and never runs. The page then renders as an empty <div id="root">: no
 * error, just nothing, which reads as the project having failed to open.
 *
 * Inlining sidesteps the origin question entirely, because there is nothing
 * left to fetch. Anything remote is left alone: a font from Google is
 * supposed to be fetched, and can be.
 *
 * `read` returns null for anything it cannot read, and that reference is left
 * as it was — a page missing one stylesheet is worth more than no page.
 */
export async function inlineLocalAssets(
  content: string,
  base: string,
  read: (fileUrl: string) => Promise<string | null>
): Promise<string> {
  if (!base) return content

  const jobs: Array<{ tag: string; url: string; kind: 'script' | 'style' }> = []

  const scripts = content.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/gi)
  for (const m of scripts) {
    if (!REMOTE.test(m[1])) jobs.push({ tag: m[0], url: m[1], kind: 'script' })
  }

  const links = content.matchAll(/<link\b[^>]*>/gi)
  for (const m of links) {
    const tag = m[0]
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) continue
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)
    if (href && !REMOTE.test(href[1])) jobs.push({ tag, url: href[1], kind: 'style' })
  }

  let out = content
  for (const job of jobs) {
    let abs: string
    try { abs = new URL(job.url, base).toString() } catch { continue }
    const body = await read(abs)
    if (body === null) continue
    // A closing tag inside the payload would end the element early.
    const safe = body.replace(/<\/(script|style)/gi, '<\\/$1')
    const isModule = job.kind === 'script' && /\btype\s*=\s*["']module["']/i.test(job.tag)
    // A function replacement, not a string: `$&` and friends are special in
    // a string replacement, and a minified bundle is full of them. Passing
    // one corrupted the script and spilled it into the page as text.
    const replacement =
      job.kind === 'script'
        ? `<script${isModule ? ' type="module"' : ''}>${safe}</script>`
        : `<style>${safe}</style>`
    out = out.replace(job.tag, () => replacement)
  }
  return out
}
