import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { getDb, type ProjectRow } from './db'

export type VTBootstrapStep =
  | { kind: 'check'; ok: boolean; message: string }
  | { kind: 'install'; ok: boolean; message: string }
  | { kind: 'inject'; ok: boolean; message: string; file?: string }
  | { kind: 'mcp'; ok: boolean; message: string; file?: string }
  | { kind: 'done'; ok: boolean; message: string }

async function pathExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

async function readJson(p: string): Promise<any | null> {
  try { return JSON.parse(await fs.readFile(p, 'utf8')) } catch { return null }
}

async function writeJson(p: string, data: any): Promise<void> {
  await fs.writeFile(p, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function detectFramework(pkg: any): 'next' | 'vite' | 'cra' | 'unknown' {
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) }
  if (deps.next) return 'next'
  if (deps.vite || deps['@vitejs/plugin-react']) return 'vite'
  if (deps['react-scripts']) return 'cra'
  return 'unknown'
}

async function findEntryFile(projectPath: string, framework: string): Promise<string | null> {
  const candidates: string[] = []
  if (framework === 'next') {
    candidates.push('app/layout.tsx', 'app/layout.jsx', 'src/app/layout.tsx', 'pages/_app.tsx', 'pages/_app.jsx', 'src/pages/_app.tsx')
  } else if (framework === 'vite' || framework === 'cra') {
    candidates.push('src/App.tsx', 'src/App.jsx', 'src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx')
  } else {
    candidates.push('src/App.tsx', 'src/App.jsx', 'app/layout.tsx', 'pages/_app.tsx')
  }
  for (const c of candidates) {
    const full = join(projectPath, c)
    if (await pathExists(full)) return full
  }
  return null
}

async function injectVizTweak(filePath: string): Promise<{ ok: boolean; message: string }> {
  let src = await fs.readFile(filePath, 'utf8')
  if (/from\s+["']viztweak["']/.test(src) || /<VizTweak\s*\/?>/.test(src)) {
    return { ok: true, message: 'Component already present' }
  }
  // Insert import after the last existing import line
  const importLine = 'import { VizTweak } from "viztweak"'
  const lines = src.split('\n')
  let lastImport = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) lastImport = i
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, importLine)
  } else {
    lines.unshift(importLine, '')
  }
  src = lines.join('\n')

  // Insert <VizTweak /> just before the closing tag of the outermost return.
  // Heuristic: find the last `</body>`; otherwise the last `</>` or last JSX
  // closing tag in the default export's return.
  const bodyMatch = src.lastIndexOf('</body>')
  if (bodyMatch !== -1) {
    src = src.slice(0, bodyMatch) + '        <VizTweak />\n        ' + src.slice(bodyMatch)
  } else {
    // Fallback: insert before the last `</...>` or `</>` we can find inside a return
    const fragMatch = src.lastIndexOf('</>')
    if (fragMatch !== -1) {
      src = src.slice(0, fragMatch) + '      <VizTweak />\n      ' + src.slice(fragMatch)
    } else {
      return { ok: false, message: 'Could not find a safe place to insert <VizTweak />. Add it manually next to your root element.' }
    }
  }
  await fs.writeFile(filePath, src, 'utf8')
  return { ok: true, message: 'Inserted <VizTweak /> and import' }
}

async function updateMcpJson(projectPath: string): Promise<{ ok: boolean; message: string; file: string }> {
  const file = join(projectPath, '.mcp.json')
  const existing = (await readJson(file)) || {}
  if (!existing.mcpServers || typeof existing.mcpServers !== 'object') existing.mcpServers = {}
  if (existing.mcpServers.viztweak) {
    return { ok: true, message: 'MCP entry already present', file }
  }
  existing.mcpServers.viztweak = {
    command: 'npx',
    args: ['-y', 'viztweak']
  }
  await writeJson(file, existing)
  return { ok: true, message: 'Wrote viztweak entry to .mcp.json', file }
}

function runNpmInstall(projectPath: string): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    const proc = spawn('npm', ['install', '--save-dev', 'viztweak'], {
      cwd: projectPath,
      shell: false,
      env: process.env
    })
    let stderr = ''
    proc.stderr.on('data', (b) => { stderr += b.toString() })
    proc.on('error', (err) => resolve({ ok: false, message: `npm install failed to start: ${err.message}` }))
    proc.on('exit', (code) => {
      if (code === 0) resolve({ ok: true, message: 'Installed viztweak as devDependency' })
      else resolve({ ok: false, message: `npm install exited ${code}: ${stderr.split('\n').slice(-3).join(' ')}` })
    })
  })
}

export function registerVizTweakIpc(): void {
  ipcMain.handle('viztweak:status', async (_e, projectId: string) => {
    const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as ProjectRow | undefined
    if (!row) return { installed: false, hasComponent: false, hasMcp: false, projectPath: null }
    const projectPath = row.path
    const pkg = await readJson(join(projectPath, 'package.json'))
    const deps = pkg ? { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } : {}
    const installed = !!deps.viztweak
    const framework = detectFramework(pkg)
    const entry = await findEntryFile(projectPath, framework)
    let hasComponent = false
    if (entry) {
      const src = await fs.readFile(entry, 'utf8').catch(() => '')
      hasComponent = /<VizTweak\s*\/?>/.test(src) && /from\s+["']viztweak["']/.test(src)
    }
    const mcp = await readJson(join(projectPath, '.mcp.json'))
    const hasMcp = !!mcp?.mcpServers?.viztweak
    return { installed, hasComponent, hasMcp, projectPath, framework, entryFile: entry }
  })

  ipcMain.handle('viztweak:bootstrap', async (_e, projectId: string) => {
    const steps: VTBootstrapStep[] = []
    const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as ProjectRow | undefined
    if (!row) {
      steps.push({ kind: 'check', ok: false, message: 'Project not found' })
      return { ok: false, steps }
    }
    const projectPath = row.path
    const pkgPath = join(projectPath, 'package.json')
    if (!(await pathExists(pkgPath))) {
      steps.push({ kind: 'check', ok: false, message: 'No package.json: viztweak requires a JS/TS project' })
      return { ok: false, steps }
    }
    const pkg = await readJson(pkgPath)
    const framework = detectFramework(pkg)
    steps.push({ kind: 'check', ok: true, message: `Detected ${framework === 'unknown' ? 'JS/TS project' : framework} project` })

    const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) }
    if (!deps.viztweak) {
      const r = await runNpmInstall(projectPath)
      steps.push({ kind: 'install', ok: r.ok, message: r.message })
      if (!r.ok) return { ok: false, steps }
    } else {
      steps.push({ kind: 'install', ok: true, message: 'viztweak already installed' })
    }

    const entry = await findEntryFile(projectPath, framework)
    if (!entry) {
      steps.push({ kind: 'inject', ok: false, message: 'Could not find an entry file. Add <VizTweak /> manually to your root layout.' })
    } else {
      const r = await injectVizTweak(entry)
      steps.push({ kind: 'inject', ok: r.ok, message: r.message, file: entry })
    }

    const mcpR = await updateMcpJson(projectPath)
    steps.push({ kind: 'mcp', ok: mcpR.ok, message: mcpR.message, file: mcpR.file })

    const allOk = steps.every((s) => s.ok)
    steps.push({ kind: 'done', ok: allOk, message: allOk
      ? 'Visual editing ready. Restart your dev server, then click any element in the page.'
      : 'Setup completed with issues: see steps above.'
    })
    return { ok: allOk, steps }
  })
}
