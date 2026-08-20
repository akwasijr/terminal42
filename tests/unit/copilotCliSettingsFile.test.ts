import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

vi.mock('electron', () => ({ ipcMain: { handle: () => {} } }))

const { getPlaintextToken, setPlaintextToken } = await import('../../src/main/copilotCliSettings')

let home: string
const priorHome = process.env.COPILOT_HOME

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 't42-cli-settings-'))
  process.env.COPILOT_HOME = home
})

afterEach(() => {
  if (priorHome === undefined) delete process.env.COPILOT_HOME
  else process.env.COPILOT_HOME = priorHome
  rmSync(home, { recursive: true, force: true })
})

const file = (): string => join(home, 'settings.json')
const write = (text: string): void => writeFileSync(file(), text, 'utf8')
const read = (): string => readFileSync(file(), 'utf8')

describe('getPlaintextToken', () => {
  it('reports off when the settings file does not exist yet', async () => {
    expect(await getPlaintextToken()).toMatchObject({ enabled: false, ok: true })
  })

  it('reports the value from the file', async () => {
    write('{"storeTokenPlaintext": true}')
    expect(await getPlaintextToken()).toMatchObject({ enabled: true, ok: true })
    write('{"theme": "dark"}')
    expect(await getPlaintextToken()).toMatchObject({ enabled: false, ok: true })
  })

  it('reports not-ok for a file it cannot parse', async () => {
    write('{ broken')
    expect(await getPlaintextToken()).toMatchObject({ enabled: false, ok: false })
  })
})

describe('setPlaintextToken', () => {
  it('creates the file when there is none', async () => {
    const res = await setPlaintextToken(true)
    expect(res).toMatchObject({ enabled: true, ok: true })
    expect(JSON.parse(read())).toEqual({ storeTokenPlaintext: true })
  })

  it('preserves every existing key', async () => {
    const original = {
      theme: 'high-contrast',
      allowedUrls: ['http://127.0.0.1:6001'],
      disabledMcpServers: ['viztweak'],
      sandbox: { enabled: false, userPolicy: { network: { allowLocalNetwork: true } } },
      model: 'claude-opus-5'
    }
    write(JSON.stringify(original, null, 2))
    await setPlaintextToken(true)
    expect(JSON.parse(read())).toEqual({ ...original, storeTokenPlaintext: true })
  })

  it('restores the original file when toggled on then off', async () => {
    const original = { theme: 'dark', allowedUrls: ['https://example.com'] }
    write(JSON.stringify(original, null, 2))
    await setPlaintextToken(true)
    await setPlaintextToken(false)
    expect(JSON.parse(read())).toEqual(original)
  })

  it('refuses to write over a file it cannot parse', async () => {
    const corrupt = '{ this is not json'
    write(corrupt)
    const res = await setPlaintextToken(true)
    expect(res.ok).toBe(false)
    expect(read()).toBe(corrupt)
  })

  it('leaves no temp file behind', async () => {
    await setPlaintextToken(true)
    expect(readdirSync(home).filter((f) => f.includes('tmp'))).toEqual([])
    expect(existsSync(file())).toBe(true)
  })

  it('round-trips through the reader', async () => {
    await setPlaintextToken(true)
    expect(await getPlaintextToken()).toMatchObject({ enabled: true, ok: true })
    await setPlaintextToken(false)
    expect(await getPlaintextToken()).toMatchObject({ enabled: false, ok: true })
  })
})
