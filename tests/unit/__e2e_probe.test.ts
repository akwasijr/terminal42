import { it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import { writtenPathFrom, toolArgumentsOf } from '../../src/shared/toolArtifacts'
import { pickPreviewArtifact, fileUrlFor } from '../../src/shared/previewArtifact'

it('real CLI turn produces a preview artifact', async () => {
  const cwd = '/tmp/t42e2e'
  const args = [
    '--prompt', 'Create a simple webpage called index.html with a heading that says Hello.',
    '--allow-all-tools', '--allow-all-paths',
    '--output-format', 'json', '--no-color', '-C', cwd, '--no-ask-user'
  ]
  const child = spawn('copilot', args, { cwd, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }, stdio: ['ignore','pipe','pipe'] })
  const written: string[] = []
  const types = new Set<string>()
  let buf = ''
  child.stdout.on('data', (d) => {
    buf += d.toString()
    const lines = buf.split('\n'); buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      let evt: any
      try { evt = JSON.parse(line) } catch { continue }
      types.add(evt.type)
      if (['tool.execution_start','assistant.tool_call_start','assistant.tool_request'].includes(evt.type)) {
        const data = evt.data ?? {}
        const name = String(data.toolName ?? data.name ?? 'tool')
        const a = toolArgumentsOf(data)
        const w = writtenPathFrom(name, a)
        console.log('TOOL:', name, '-> written:', w, '| argKeys:', a ? Object.keys(a).join(',') : 'NONE')
        if (w && !written.includes(w)) written.push(w)
      }
    }
  })
  child.stderr.on('data', (d) => console.log('STDERR:', d.toString().slice(0,200)))
  await new Promise((res) => child.on('close', res))
  console.log('EVENT TYPES:', [...types].join(', '))
  console.log('WRITTEN:', written)
  const page = pickPreviewArtifact(written.map((path) => ({ path, status: 'added' as const })))
  console.log('PICKED PAGE:', page)
  console.log('PREVIEW URL:', page ? fileUrlFor(page, cwd) : null)
  expect(page).toBeTruthy()
}, 240000)
