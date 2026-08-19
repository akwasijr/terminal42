// Pure helper for the direct-edit "bake" engine: insert or replace a single
// managed <style>/<script> block (keyed by id) in an HTML document. Extracted so
// the injection logic can be unit-tested without the Electron app context.

export function upsertManagedBlock(
  html: string,
  blockId: string,
  content: string,
  tag: 'style' | 'script' = 'style',
): string {
  const safeId = blockId.replace(/[^a-z0-9_-]/gi, '') || 'edit'
  // Drop any existing managed block with this id so re-applies replace it.
  const re = new RegExp(`\\s*<(?:style|script) data-t42-block="${safeId}">[\\s\\S]*?<\\/(?:style|script)>`, 'i')
  let out = html.replace(re, '')

  const trimmed = content.trim()
  if (!trimmed) return out

  const block = `<${tag} data-t42-block="${safeId}">\n${trimmed}\n</${tag}>`
  if (tag === 'script') {
    // Scripts run at end of body so the DOM they target exists.
    if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, `${block}\n</body>`)
    else out = `${out}\n${block}`
  } else if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `${block}\n</head>`)
  } else if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${block}\n</body>`)
  } else {
    out = `${out}\n${block}`
  }
  return out
}
