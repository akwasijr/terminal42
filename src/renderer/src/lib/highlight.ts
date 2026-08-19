// Syntax highlighting for the code pane.
//
// Shiki with real TextMate grammars, rather than a regex highlighter, because
// the pane shows diffs of the user's own source: mis-tokenised code in a view
// whose whole job is "look at exactly what changed" is worse than no colour.
//
// Three deliberate constraints:
//
// 1. Everything is dynamically imported. Shiki's full bundle carries every
//    grammar it ships; loading the core, one theme and one grammar on demand
//    keeps all of it out of the main chunk and off the app's startup path.
//
// 2. The JavaScript regex engine, not Oniguruma. It avoids shipping and
//    instantiating a wasm binary inside Electron, and `forgiving` means a
//    grammar construct it cannot compile degrades to weaker highlighting
//    instead of throwing.
//
// 3. Tokens, not HTML. The pane renders its own rows with line-number gutters
//    and add/delete tints, so it needs per-line tokens to place inside that
//    structure. Shiki's `codeToTokens` gives exactly that.

import type { HighlighterCore } from 'shiki/core'

export type CodeToken = { content: string; color?: string }

/** Grammars we load on demand, keyed by the id Shiki knows them by. */
const LANG_LOADERS: Record<string, () => Promise<unknown>> = {
  typescript: () => import('@shikijs/langs/typescript'),
  tsx: () => import('@shikijs/langs/tsx'),
  javascript: () => import('@shikijs/langs/javascript'),
  jsx: () => import('@shikijs/langs/jsx'),
  json: () => import('@shikijs/langs/json'),
  css: () => import('@shikijs/langs/css'),
  scss: () => import('@shikijs/langs/scss'),
  html: () => import('@shikijs/langs/html'),
  markdown: () => import('@shikijs/langs/markdown'),
  python: () => import('@shikijs/langs/python'),
  go: () => import('@shikijs/langs/go'),
  rust: () => import('@shikijs/langs/rust'),
  java: () => import('@shikijs/langs/java'),
  ruby: () => import('@shikijs/langs/ruby'),
  php: () => import('@shikijs/langs/php'),
  shellscript: () => import('@shikijs/langs/shellscript'),
  yaml: () => import('@shikijs/langs/yaml'),
  toml: () => import('@shikijs/langs/toml'),
  sql: () => import('@shikijs/langs/sql'),
  swift: () => import('@shikijs/langs/swift'),
  kotlin: () => import('@shikijs/langs/kotlin'),
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  csharp: () => import('@shikijs/langs/csharp'),
  diff: () => import('@shikijs/langs/diff'),
  xml: () => import('@shikijs/langs/xml'),
  vue: () => import('@shikijs/langs/vue'),
  svelte: () => import('@shikijs/langs/svelte')
}

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript', mts: 'typescript', cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  jsx: 'jsx',
  json: 'json', jsonc: 'json',
  css: 'css', pcss: 'css', postcss: 'css',
  scss: 'scss', sass: 'scss',
  html: 'html', htm: 'html',
  md: 'markdown', markdown: 'markdown', mdx: 'markdown',
  py: 'python', pyi: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  rb: 'ruby',
  php: 'php',
  sh: 'shellscript', bash: 'shellscript', zsh: 'shellscript', fish: 'shellscript',
  yml: 'yaml', yaml: 'yaml',
  toml: 'toml',
  sql: 'sql',
  swift: 'swift',
  kt: 'kotlin', kts: 'kotlin',
  c: 'c', h: 'c',
  cc: 'cpp', cpp: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp',
  cs: 'csharp',
  diff: 'diff', patch: 'diff',
  xml: 'xml', svg: 'xml',
  vue: 'vue',
  svelte: 'svelte'
}

/** Files whose whole name, not extension, identifies the language. */
const FILENAME_TO_LANG: Record<string, string> = {
  dockerfile: 'shellscript',
  makefile: 'shellscript',
  '.env': 'shellscript',
  '.gitignore': 'shellscript',
  '.bashrc': 'shellscript',
  '.zshrc': 'shellscript'
}

/**
 * Shiki language id for a path, or null when we have no grammar for it.
 *
 * Null is a normal outcome, not a failure: the pane renders plain text and
 * stays useful for file types we do not colour.
 */
export function languageForPath(path: string): string | null {
  const name = (path.split('/').pop() ?? '').toLowerCase()
  if (FILENAME_TO_LANG[name]) return FILENAME_TO_LANG[name]
  const dot = name.lastIndexOf('.')
  if (dot < 0) return null
  const ext = name.slice(dot + 1)
  const lang = EXT_TO_LANG[ext]
  return lang && LANG_LOADERS[lang] ? lang : null
}

let corePromise: Promise<HighlighterCore> | null = null
const loadedLangs = new Set<string>()

async function getHighlighter(): Promise<HighlighterCore> {
  if (!corePromise) {
    corePromise = (async () => {
      const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, theme] = await Promise.all([
        import('shiki/core'),
        import('@shikijs/engine-javascript'),
        import('@shikijs/themes/vitesse-dark')
      ])
      return createHighlighterCore({
        themes: [theme.default],
        langs: [],
        // Forgiving: a grammar rule the JS engine cannot compile is skipped
        // rather than thrown, so an exotic file loses colour but still renders.
        engine: createJavaScriptRegexEngine({ forgiving: true })
      })
    })().catch((err) => {
      // Let a later call retry rather than caching a permanent failure.
      corePromise = null
      throw err
    })
  }
  return corePromise
}

/**
 * Tokenise `code` into one array of tokens per line.
 *
 * Returns null whenever highlighting is unavailable or fails for any reason —
 * unknown language, grammar that will not load, engine error. Callers are
 * expected to fall back to plain text, so highlighting can never be the reason
 * a diff fails to display.
 */
export async function highlightToLines(code: string, lang: string | null): Promise<CodeToken[][] | null> {
  if (!lang) return null
  const loader = LANG_LOADERS[lang]
  if (!loader) return null

  try {
    const highlighter = await getHighlighter()
    if (!loadedLangs.has(lang)) {
      const mod = (await loader()) as { default: unknown }
      await highlighter.loadLanguage(mod.default as Parameters<HighlighterCore['loadLanguage']>[0])
      loadedLangs.add(lang)
    }
    const { tokens } = highlighter.codeToTokens(code, { lang, theme: 'vitesse-dark' })
    return tokens.map((line) => line.map((t) => ({ content: t.content, color: t.color })))
  } catch {
    return null
  }
}
