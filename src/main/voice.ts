// Voice-input transcription via local whisper.cpp.
//
// The renderer captures audio via Web Audio + ScriptProcessorNode, writes
// a 16 kHz mono WAV in memory, and ships the bytes here. We just write
// them to a temp .wav and run whisper-cli: no codec conversion needed.

import { ipcMain } from 'electron'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { tmpdir, homedir } from 'os'
import { join } from 'path'

const MODEL_PATH = join(homedir(), '.terminal42', 'whisper', 'ggml-base.en.bin')

let whisperBin: string | null | undefined
let modelExists: boolean | undefined

async function findWhisperBin(): Promise<string | null> {
  if (whisperBin !== undefined) return whisperBin
  const candidates = [
    '/opt/homebrew/bin/whisper-cli',
    '/opt/homebrew/bin/whisper-cpp',
    '/opt/homebrew/bin/main',
    '/usr/local/bin/whisper-cli',
    '/usr/local/bin/whisper-cpp'
  ]
  for (const p of candidates) {
    try {
      const s = await fs.stat(p)
      if (s.isFile()) { whisperBin = p; return p }
    } catch { /* keep looking */ }
  }
  whisperBin = null
  return null
}

async function ensureModel(): Promise<boolean> {
  if (modelExists !== undefined) return modelExists
  try {
    const s = await fs.stat(MODEL_PATH)
    modelExists = s.isFile()
  } catch {
    modelExists = false
  }
  return modelExists
}

type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; error: string }

async function transcribeBytes(bytes: ArrayBuffer | Uint8Array, mimeType: string): Promise<TranscribeResult> {
  const bin = await findWhisperBin()
  if (!bin) {
    return {
      ok: false,
      error: 'Voice transcription needs whisper.cpp. Install with: `brew install whisper-cpp`. Then retry.'
    }
  }
  if (!(await ensureModel())) {
    return {
      ok: false,
      error: `Voice transcription needs the whisper model at ${MODEL_PATH}. Download with: \`mkdir -p ~/.terminal42/whisper && curl -L -o ~/.terminal42/whisper/ggml-base.en.bin "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin?download=true"\``
    }
  }

  // The renderer always sends 16kHz mono WAV bytes. mimeType is mostly
  // informational: we still treat anything as raw and pass to whisper.
  void mimeType
  const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8)
  const dir = await fs.mkdtemp(join(tmpdir(), 't42-voice-'))
  const wavPath = join(dir, `rec-${stamp}.wav`)

  try {
    const buf = Buffer.from(bytes as ArrayBuffer)
    await fs.writeFile(wavPath, buf)

    // Run whisper-cli. --output-txt produces wavfile.wav.txt next to it.
    await runQuiet(bin, [
      '-m', MODEL_PATH,
      '-f', wavPath,
      '--output-txt',
      '--no-prints'
    ])

    const txtPath = wavPath + '.txt'
    let text = ''
    try { text = (await fs.readFile(txtPath, 'utf8')).trim() } catch {}
    return { ok: true, text }
  } catch (err) {
    return { ok: false, error: String(err) }
  } finally {
    try { await fs.rm(dir, { recursive: true, force: true }) } catch {}
  }
}

function runQuiet(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (d) => { stderr += d.toString() })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 300)}`))
    })
    child.on('error', reject)
  })
}

export function registerVoiceIpc(): void {
  ipcMain.handle('voice:transcribe', async (_e, args: { bytes: ArrayBuffer | Uint8Array; mimeType: string }) => {
    return await transcribeBytes(args.bytes, args.mimeType ?? 'audio/wav')
  })
}
