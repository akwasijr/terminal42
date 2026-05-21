// Convert .pptx -> .pdf via system LibreOffice (soffice). The resulting
// PDF can be rendered natively by Electron's built-in Chromium PDF viewer
// inside an <iframe>, so we get a real per-slide preview of the model's
// PPT EDIT MODE output for free: no PNG sequence pipeline, no third-
// party renderer.

import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { dirname, basename, join } from 'path'

let sofficePath: string | null = null

async function findSoffice(): Promise<string | null> {
  if (sofficePath) return sofficePath
  const candidates = [
    '/opt/homebrew/bin/soffice',
    '/usr/local/bin/soffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/usr/bin/soffice'
  ]
  for (const p of candidates) {
    try {
      const s = await fs.stat(p)
      if (s.isFile()) { sofficePath = p; return p }
    } catch { /* keep looking */ }
  }
  // Fall back to PATH lookup
  return await new Promise((resolve) => {
    const child = spawn('which', ['soffice'])
    let out = ''
    child.stdout.on('data', (d) => { out += d.toString() })
    child.on('close', () => {
      const trimmed = out.trim()
      if (trimmed) { sofficePath = trimmed; resolve(trimmed) }
      else resolve(null)
    })
    child.on('error', () => resolve(null))
  })
}

/**
 * Convert a .pptx file to a .pdf alongside it. Returns the absolute path
 * to the produced PDF, or null if conversion failed (soffice missing or
 * conversion error). Quiet: caller decides what to surface.
 */
export async function pptxToPdf(pptxPath: string): Promise<string | null> {
  const so = await findSoffice()
  if (!so) return null
  const outDir = dirname(pptxPath)
  // soffice emits <basename>.pdf in --outdir. We need a stable, unique
  // user profile dir per call so concurrent renders don't trample each
  // other's lock files (lo files are infamous for this).
  const profile = await fs.mkdtemp(join(outDir, '.lo-profile-'))
  return await new Promise((resolve) => {
    const args = [
      '--headless',
      '--norestore',
      '--nofirststartwizard',
      `-env:UserInstallation=file://${profile}`,
      '--convert-to', 'pdf',
      '--outdir', outDir,
      pptxPath
    ]
    const child = spawn(so, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (d) => { stderr += d.toString() })
    child.on('close', async (code) => {
      // Clean up the throwaway profile dir.
      try { await fs.rm(profile, { recursive: true, force: true }) } catch {}
      if (code !== 0) {
        console.error('[render] soffice failed:', code, stderr.slice(0, 300))
        resolve(null)
        return
      }
      const pdfName = basename(pptxPath).replace(/\.pptx$/i, '.pdf')
      const pdfPath = join(outDir, pdfName)
      try {
        await fs.access(pdfPath)
        resolve(pdfPath)
      } catch {
        resolve(null)
      }
    })
    child.on('error', () => resolve(null))
  })
}
