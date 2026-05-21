// PPTX template fact extractor.
//
// PPTX is a zip archive of XML. To anchor the model to a template we
// pre-extract a small set of structured facts (slide count, theme
// palette, theme fonts, per-slide layout + text) so the prompt carries
// concrete values instead of asking the model to do its own XML parsing
// (which it routinely skips).
//
// The extractor shells out to the system `unzip` and then regex-parses
// the relevant XML fragments. We deliberately avoid pulling in a full
// XML parser dependency: the PPTX schema is rigid enough that small
// targeted regexes are reliable and zero-install.

import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'

export type PptxFacts = {
  slideCount: number
  slideWidthPx: number   // converted from EMUs (cx / 9525)
  slideHeightPx: number  // converted from EMUs (cy / 9525)
  aspect: '16:9' | '4:3' | 'other'
  theme: {
    /** dk1, lt1, dk2, lt2 + accent1..6 + hlink + folHlink: keyed by role. */
    colors: Record<string, string>
    headingFont: string | null
    bodyFont: string | null
  }
  /** Every slide in order. */
  slides: Array<{
    index: number
    layoutName: string | null
    /** First <a:t> from a title placeholder, if found. */
    title: string | null
    /** All other <a:t> runs in the slide, joined with paragraph breaks. */
    body: string
    /** Total <a:t> count: useful as a 'how dense is this slide' signal. */
    textRunCount: number
    /** Names of distinct shape types referenced (textBox, pic, etc). */
    shapeKinds: string[]
  }>
  /** Filenames in ppt/media/. */
  media: string[]
}

/**
 * Extract structured facts from a .pptx file. Throws if the file isn't a
 * valid pptx zip or the unzip command fails.
 */
export async function extractPptxFacts(pptxPath: string, workDir: string): Promise<PptxFacts> {
  const tplDir = join(workDir, '_tpl')
  await fs.mkdir(tplDir, { recursive: true })
  await runUnzip(pptxPath, tplDir)

  const presXml = await safeRead(join(tplDir, 'ppt', 'presentation.xml'))
  const themeXml = await safeRead(join(tplDir, 'ppt', 'theme', 'theme1.xml'))
  const slideFiles = (await safeLs(join(tplDir, 'ppt', 'slides')))
    .filter((f) => /^slide\d+\.xml$/.test(f))
    .sort((a, b) => (parseInt(a.match(/\d+/)![0], 10) - parseInt(b.match(/\d+/)![0], 10)))

  // Slide size (EMUs): <p:sldSz cx="..." cy="..."/>
  const sldSz = presXml?.match(/<p:sldSz\s+cx="(\d+)"\s+cy="(\d+)"/i)
  const cx = sldSz ? parseInt(sldSz[1], 10) : 9144000  // default 4:3
  const cy = sldSz ? parseInt(sldSz[2], 10) : 6858000
  const slideWidthPx = Math.round(cx / 9525)
  const slideHeightPx = Math.round(cy / 9525)
  const ratio = slideWidthPx / slideHeightPx
  const aspect: PptxFacts['aspect'] =
    Math.abs(ratio - 16 / 9) < 0.05 ? '16:9' :
    Math.abs(ratio - 4 / 3) < 0.05 ? '4:3' : 'other'

  // Theme colors: from <a:clrScheme>. The roles inside (dk1/lt1/dk2/lt2/
  // accent1..6/hlink/folHlink) wrap exactly one of <a:srgbClr val="HEX"/>
  // or <a:sysClr val="windowText" lastClr="HEX"/>. Capture both forms.
  const colors: Record<string, string> = {}
  if (themeXml) {
    const clrSchemeMatch = themeXml.match(/<a:clrScheme\b[^>]*>([\s\S]*?)<\/a:clrScheme>/i)
    if (clrSchemeMatch) {
      const inner = clrSchemeMatch[1]
      const roleRe = /<a:(dk1|lt1|dk2|lt2|accent1|accent2|accent3|accent4|accent5|accent6|hlink|folHlink)\b[^>]*>([\s\S]*?)<\/a:\1>/g
      let m: RegExpExecArray | null
      while ((m = roleRe.exec(inner)) !== null) {
        const role = m[1]
        const body = m[2]
        const srgb = body.match(/<a:srgbClr\s+val="([0-9A-Fa-f]{6})"/)
        const sysLast = body.match(/<a:sysClr\b[^>]*lastClr="([0-9A-Fa-f]{6})"/)
        const hex = srgb?.[1] ?? sysLast?.[1]
        if (hex) colors[role] = '#' + hex.toUpperCase()
      }
    }
  }

  // Theme fonts. <a:fontScheme> contains <a:majorFont> and <a:minorFont>;
  // each has a <a:latin typeface="..."/>.
  let headingFont: string | null = null
  let bodyFont: string | null = null
  if (themeXml) {
    const major = themeXml.match(/<a:majorFont>[\s\S]*?<a:latin\s+typeface="([^"]+)"/)
    const minor = themeXml.match(/<a:minorFont>[\s\S]*?<a:latin\s+typeface="([^"]+)"/)
    if (major) headingFont = major[1]
    if (minor) bodyFont = minor[1]
  }

  // Slide rels point each slide to its slideLayout: we need that to
  // know which layout name a slide uses. The layout name lives in
  // ppt/slideLayouts/slideLayoutN.xml as <p:cSld name="..."/>.
  const slides: PptxFacts['slides'] = []
  for (let i = 0; i < slideFiles.length; i++) {
    const slideName = slideFiles[i]
    const slideXml = (await safeRead(join(tplDir, 'ppt', 'slides', slideName))) ?? ''
    const slideRels = (await safeRead(join(tplDir, 'ppt', 'slides', '_rels', slideName + '.rels'))) ?? ''
    // Layout target: the rel with Type ending in /slideLayout
    const layoutRel = slideRels.match(/Target="\.\.\/slideLayouts\/(slideLayout\d+\.xml)"/)
    let layoutName: string | null = null
    if (layoutRel) {
      const layoutXml = (await safeRead(join(tplDir, 'ppt', 'slideLayouts', layoutRel[1]))) ?? ''
      const nameMatch = layoutXml.match(/<p:cSld\s+name="([^"]+)"/)
      if (nameMatch) layoutName = nameMatch[1]
    }
    // Text runs: <a:t>...</a:t>. Multiple per shape, multiple paragraphs.
    const runs: string[] = []
    const tRe = /<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g
    let tm: RegExpExecArray | null
    while ((tm = tRe.exec(slideXml)) !== null) {
      const text = decodeXmlEntities(tm[1]).trim()
      if (text) runs.push(text)
    }
    // Title is the first <a:t> inside a placeholder of type="title" or "ctrTitle".
    let title: string | null = null
    const titleSpRe = /<p:sp\b[\s\S]*?<p:nvSpPr[\s\S]*?<p:ph\b[^>]*type="(?:ctrTitle|title)"[\s\S]*?<\/p:sp>/g
    let tsp: RegExpExecArray | null
    while ((tsp = titleSpRe.exec(slideXml)) !== null) {
      const ts = tsp[0].match(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/)
      if (ts) { title = decodeXmlEntities(ts[1]).trim(); break }
    }
    const body = title ? runs.filter((r) => r !== title).join(' / ') : runs.join(' / ')
    // Shape kinds: distinct top-level element local names inside spTree.
    const shapeKinds = Array.from(new Set(
      Array.from(slideXml.matchAll(/<p:(sp|pic|graphicFrame|grpSp|cxnSp)\b/g)).map((x) => x[1])
    ))
    slides.push({
      index: i + 1,
      layoutName,
      title,
      body: body.slice(0, 400),  // cap so the prompt stays sane on long decks
      textRunCount: runs.length,
      shapeKinds
    })
  }

  // Media filenames
  const media = await safeLs(join(tplDir, 'ppt', 'media'))

  return {
    slideCount: slides.length,
    slideWidthPx,
    slideHeightPx,
    aspect,
    theme: { colors, headingFont, bodyFont },
    slides,
    media
  }
}

/** Build a compact pre-extracted facts block for the LLM prompt. */
export function pptxFactsToPrompt(facts: PptxFacts): string[] {
  const lines: string[] = []
  lines.push('PRE-EXTRACTED TEMPLATE FACTS (already read from the .pptx: do NOT re-parse):')
  lines.push(`  Slide count: ${facts.slideCount}`)
  lines.push(`  Slide size: ${facts.slideWidthPx}x${facts.slideHeightPx}px (${facts.aspect})`)
  const colorBits = Object.entries(facts.theme.colors).map(([k, v]) => `${k}=${v}`).join(' ')
  lines.push(`  Theme colours: ${colorBits || '(none extracted)'}`)
  const fontBits: string[] = []
  if (facts.theme.headingFont) fontBits.push(`heading="${facts.theme.headingFont}"`)
  if (facts.theme.bodyFont) fontBits.push(`body="${facts.theme.bodyFont}"`)
  lines.push(`  Theme fonts: ${fontBits.join(' ') || '(none extracted)'}`)
  if (facts.media.length) {
    lines.push(`  Media files (in _tpl/ppt/media/): ${facts.media.slice(0, 12).join(', ')}${facts.media.length > 12 ? `, +${facts.media.length - 12} more` : ''}`)
  }
  lines.push('  Slides:')
  for (const s of facts.slides) {
    const layout = s.layoutName ? ` [${s.layoutName}]` : ''
    const shapes = s.shapeKinds.length ? ` shapes:${s.shapeKinds.join('+')}` : ''
    const titleBit = s.title ? ` title="${s.title.slice(0, 80)}"` : ''
    const bodyBit = s.body ? ` body="${s.body.slice(0, 100)}${s.body.length > 100 ? '…' : ''}"` : ''
    lines.push(`    ${String(s.index).padStart(2, '0')}.${layout}${titleBit}${bodyBit}${shapes} (${s.textRunCount} text runs)`)
  }
  return lines
}

// ─── helpers ──────────────────────────────────────────────────────────────

function runUnzip(zipPath: string, outDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('unzip', ['-o', '-q', zipPath, '-d', outDir])
    let stderr = ''
    child.stderr.on('data', (d) => { stderr += d.toString() })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`unzip exited ${code}: ${stderr.slice(0, 200)}`))
    })
    child.on('error', reject)
  })
}

async function safeRead(path: string): Promise<string | null> {
  try { return await fs.readFile(path, 'utf8') } catch { return null }
}

async function safeLs(path: string): Promise<string[]> {
  try { return await fs.readdir(path) } catch { return [] }
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
}
