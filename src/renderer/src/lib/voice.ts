// Voice input: wraps getUserMedia + Web Audio for both the live waveform
// AND the actual audio capture. We deliberately AVOID MediaRecorder
// (webm/opus) because macOS afconvert / CoreAudio can't decode opus, so
// we'd have to depend on ffmpeg. Instead we tap an AudioWorkletNode (or
// fall back to ScriptProcessorNode) to gather raw Float32 PCM samples
// during recording, then synthesize a 16kHz mono WAV ourselves on stop
// and ship the bytes straight to whisper via the main process.

import { useCallback, useEffect, useRef, useState } from 'react'

export function isVoiceInputSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

type Options = {
  /** Called when transcription returns. The transcript is the whole text. */
  onTranscript?: (text: string) => void
  /** Called with the final transcript (or empty string on error). */
  onFinal?: (text: string) => void
  /** Called when transcription fails. */
  onError?: (error: string) => void
  /** Number of waveform bars to keep (default 48). */
  bars?: number
}

const TARGET_SR = 16000

export function useVoiceInput({ onTranscript, onFinal, onError, bars = 48 }: Options = {}): {
  recording: boolean
  transcribing: boolean
  seconds: number
  levels: number[]
  error: string | null
  start: () => Promise<void>
  stop: () => void
  cancel: () => void
} {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [levels, setLevels] = useState<number[]>(() => new Array(bars).fill(0))
  const [error, setError] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const procRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  // Captured float32 PCM chunks at the AudioContext's sample rate.
  const pcmChunksRef = useRef<Float32Array[]>([])
  const sampleRateRef = useRef<number>(48000)
  const cancelledRef = useRef(false)

  const cleanup = useCallback((): void => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null
    if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null
    try { sourceRef.current?.disconnect() } catch {}
    try { procRef.current?.disconnect() } catch {}
    sourceRef.current = null
    procRef.current = null
    try { ctxRef.current?.close() } catch {}
    ctxRef.current = null
    analyserRef.current = null
    streamRef.current?.getTracks().forEach((t) => { try { t.stop() } catch {} })
    streamRef.current = null
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  const finishAndTranscribe = useCallback(async (): Promise<void> => {
    // Concat all PCM chunks
    const chunks = pcmChunksRef.current
    pcmChunksRef.current = []
    const sr = sampleRateRef.current
    let total = 0
    for (const c of chunks) total += c.length
    const merged = new Float32Array(total)
    let off = 0
    for (const c of chunks) { merged.set(c, off); off += c.length }
    cleanup()
    setRecording(false)
    if (cancelledRef.current || merged.length === 0) {
      setTranscribing(false)
      return
    }
    setTranscribing(true)
    try {
      // Down-sample to 16 kHz mono and write a WAV in memory.
      const down = downsample(merged, sr, TARGET_SR)
      const wav = floatPcmToWav(down, TARGET_SR)
      const t42 = (window as unknown as { terminal42?: { voice?: { transcribe?: (b: ArrayBuffer, m: string) => Promise<{ ok: true; text: string } | { ok: false; error: string }> } } }).terminal42
      if (!t42?.voice?.transcribe) {
        const msg = 'Voice transcription not wired in this build. Quit and re-open the app to pick up the new preload.'
        setError(msg); onError?.(msg); onFinal?.('')
        setTranscribing(false)
        return
      }
      const res = await t42.voice.transcribe(wav.buffer as ArrayBuffer, 'audio/wav')
      setTranscribing(false)
      if (res.ok) {
        const text = res.text.trim()
        onTranscript?.(text)
        onFinal?.(text)
      } else {
        setError(res.error); onError?.(res.error); onFinal?.('')
      }
    } catch (err) {
      setTranscribing(false)
      const msg = String(err)
      setError(msg); onError?.(msg); onFinal?.('')
    }
  }, [cleanup, onTranscript, onFinal, onError])

  const start = useCallback(async (): Promise<void> => {
    if (recording) return
    setError(null)
    setSeconds(0)
    setLevels(new Array(bars).fill(0))
    cancelledRef.current = false
    pcmChunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }
      })
      streamRef.current = stream
      const ACtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new ACtx()
      ctxRef.current = ctx
      sampleRateRef.current = ctx.sampleRate
      const src = ctx.createMediaStreamSource(stream)
      sourceRef.current = src

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.5
      src.connect(analyser)
      analyserRef.current = analyser

      // ScriptProcessorNode is deprecated but still works everywhere
      // including Electron: and unlike AudioWorkletNode it doesn't need a
      // separate worklet module file. Buffer 4096 = ~85ms at 48kHz.
      const proc = ctx.createScriptProcessor(4096, 1, 1)
      proc.onaudioprocess = (e: AudioProcessingEvent): void => {
        const ch = e.inputBuffer.getChannelData(0)
        // Copy because the buffer is reused.
        pcmChunksRef.current.push(new Float32Array(ch))
      }
      src.connect(proc)
      // proc must connect to destination for Chromium to actually pump it,
      // but we route it through a near-mute gain so it's silent in playback.
      const mute = ctx.createGain()
      mute.gain.value = 0
      proc.connect(mute)
      mute.connect(ctx.destination)
      procRef.current = proc

      // Waveform sampling
      const buf = new Uint8Array(analyser.frequencyBinCount)
      const tick = (): void => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(buf)
        let sum = 0
        const lo = 4
        const hi = Math.min(buf.length, 64)
        for (let i = lo; i < hi; i++) sum += buf[i]
        const avg = sum / (hi - lo) / 255
        const boosted = Math.min(1, avg * 1.6)
        setLevels((prev) => {
          const next = prev.slice(1)
          next.push(boosted)
          return next
        })
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()

      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
      setRecording(true)
    } catch (err) {
      setError(String(err))
      cleanup()
    }
  }, [recording, bars, cleanup])

  const stop = useCallback((): void => {
    if (!recording) return
    cancelledRef.current = false
    void finishAndTranscribe()
  }, [recording, finishAndTranscribe])

  const cancel = useCallback((): void => {
    cancelledRef.current = true
    pcmChunksRef.current = []
    cleanup()
    setRecording(false)
    setTranscribing(false)
  }, [cleanup])

  return { recording, transcribing, seconds, levels, error, start, stop, cancel }
}

export function formatVoiceTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── PCM → WAV helpers ─────────────────────────────────────────────────────

/** Linear-interpolated downsampling. Good enough for speech. */
function downsample(data: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return data
  const ratio = fromRate / toRate
  const outLength = Math.floor(data.length / ratio)
  const out = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const idx = i * ratio
    const i0 = Math.floor(idx)
    const i1 = Math.min(i0 + 1, data.length - 1)
    const t = idx - i0
    out[i] = data[i0] * (1 - t) + data[i1] * t
  }
  return out
}

/** Synthesize a mono 16-bit PCM WAV file from Float32 samples. */
function floatPcmToWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  let p = 0
  function w8(s: string): void { for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i)) }
  function w32(v: number): void { view.setUint32(p, v, true); p += 4 }
  function w16(v: number): void { view.setUint16(p, v, true); p += 2 }
  w8('RIFF'); w32(36 + dataSize); w8('WAVE')
  w8('fmt '); w32(16); w16(1); w16(numChannels); w32(sampleRate); w32(byteRate); w16(blockAlign); w16(bitsPerSample)
  w8('data'); w32(dataSize)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    p += 2
  }
  return new Uint8Array(buffer)
}
