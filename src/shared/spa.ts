/**
 * Telling a single-page app apart from a page, and the plumbing to serve one.
 *
 * A design is previewed by putting its HTML into an iframe's srcDoc. That is
 * right for a page: it is one document, it has no other files to fetch, and
 * srcDoc keeps it on the app's own origin so the canvas can reach into it to
 * annotate and edit.
 *
 * It is wrong for an app built around a router. An srcDoc document's address
 * is about:srcdoc, so its pathname is the string "srcdoc" — which matches no
 * route anyone has ever written. The router falls through to nothing and the
 * page comes up blank: no error, just an empty mount point, which reads as
 * the project having failed to open.
 *
 * The only real fix is an address, so those are served over a loopback origin
 * where the app sits at "/". Everything else keeps srcDoc, because swapping
 * it out costs the canvas its reach into the document.
 *
 * Shared because the canvas asks the question and the server answers it.
 */

/**
 * Whether this document is an app waiting to be mounted rather than a page.
 *
 * The test is the shape of the thing rather than the name of a library: a
 * body whose only real content is an empty mount point, and a script to fill
 * it. A router is the usual reason such a page needs an address, but the
 * shape is what survives minification -- a bundler will rename
 * `createBrowserRouter` and drop the package name, and it cannot rename an
 * empty <div id="root">.
 */
export function looksLikeSpa(html: string): boolean {
  const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html
  // Scripts are what fills the mount point; they are not content themselves.
  const withoutScripts = body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  if (!/<script\b/i.test(body)) return false

  const mount = /<div\b[^>]*\bid\s*=\s*["'](root|app|__next|___gatsby)["'][^>]*>([\s\S]*?)<\/div>/i
    .exec(withoutScripts)
  if (!mount) return false
  // A mount point with markup already in it is server-rendered: it has
  // something to show whatever the router decides, so leave it on srcDoc.
  if (mount[2].trim() !== '') return false

  // Anything of substance outside the mount point means this is a page that
  // happens to contain a widget, not an app.
  const rest = withoutScripts.replace(mount[0], '').replace(/<[^>]+>/g, '').trim()
  return rest === ''
}
