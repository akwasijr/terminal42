// Export: stills and video.
//
// Nothing here records the screen. Each frame is rendered at an exact loop
// phase (k / frames) into an offscreen canvas at the export resolution, then
// handed to the encoder. Recording in real time would inherit every dropped
// frame and every scheduling hiccup, and a loop that is one frame long at the
// seam is a loop that visibly stutters forever.
//
// The trade this makes is honest: export takes as long as it takes rather than
// as long as the video is.

import type { MotionDoc } from '../../../../shared/motion/types'
import { cardCountFor } from '../../../../shared/motion/frame'
import { clipTimeline, placementsAt } from '../../../../shared/motion/entrance'
import { exportSize } from './backdrop'
import { composeFrame } from './compose'
import { ensureTextFonts } from './fonts'
import type { MotionEngine } from './engine'

export type ExportProgress = { done: number; total: number; label: string }

/** The only video containers a browser can actually encode without a bundled codec. */
export function supportedVideoMime(): { mime: string; ext: 'mp4' | 'webm' } | null {
  const candidates: Array<{ mime: string; ext: 'mp4' | 'webm' }> = [
    { mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' }
  ]
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mime)) return c
  }
  return null
}

function composite(
  engine: MotionEngine,
  doc: MotionDoc,
  phase: number,
  width: number,
  height: number,
  out: HTMLCanvasElement,
  transparent: boolean,
  anim: { kind: 'in' | 'out'; elapsedSec: number } | null = null
): void {
  const ctx = out.getContext('2d')
  if (!ctx) return
  const gl = engine.renderAtSize(width, height, phase, placementsAt(doc, phase, anim))
  composeFrame(ctx, doc, gl, width, height, {
    transparent,
    showGrid: doc.frame.gridInExport || doc.export.gridBehindComponent,
    images: engine.sourceImages
  })
}

/** A single frame as base64, ready to hand to the main process to write. */
export function exportStill(
  engine: MotionEngine,
  doc: MotionDoc,
  phase: number
): { base64: string; ext: 'png' | 'jpg' } | null {
  const base = exportSize(doc.frame.aspect, 1080)
  const scale = doc.export.stillScale
  const width = base.width * scale
  const height = base.height * scale
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  // JPEG has no alpha, so asking for a transparent JPEG would silently give a
  // black background. PNG is forced instead of quietly ignoring the request.
  const transparent = doc.export.transparentBackground
  const type = transparent || doc.export.stillFormat === 'png' ? 'image/png' : 'image/jpeg'
  composite(engine, doc, phase, width, height, out, transparent)
  const url = out.toDataURL(type, 0.92)
  const base64 = url.split(',')[1]
  return base64 ? { base64, ext: type === 'image/png' ? 'png' : 'jpg' } : null
}

export async function exportVideo(
  engine: MotionEngine,
  doc: MotionDoc,
  onProgress: (p: ExportProgress) => void,
  signal?: { cancelled: boolean }
): Promise<{ base64: string; ext: 'mp4' | 'webm'; lagged: boolean } | { error: string }> {
  const support = supportedVideoMime()
  if (!support) return { error: 'This build cannot encode video: no MP4 or WebM encoder is available.' }

  // Before the first frame, not during: a face that arrives midway through
  // would change the type partway into the video.
  await ensureTextFonts(doc.visual.text)

  const { width, height } = exportSize(doc.frame.aspect, doc.export.resolution)
  const fps = doc.export.fps

  const timeline = clipTimeline(doc, cardCountFor(doc))
  const frames = timeline.frames
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  // captureStream(0) means the stream produces a frame only when asked, which
  // is what lets a slow render still emit a perfectly timed video.
  const stream = canvas.captureStream(0)
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined
  if (!track) return { error: 'The browser refused to capture the export canvas.' }

  const chunks: Blob[] = []
  const recorder = new MediaRecorder(stream, {
    mimeType: support.mime,
    videoBitsPerSecond: Math.min(40_000_000, width * height * fps * 0.12)
  })
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
  const finished = new Promise<void>((resolve) => { recorder.onstop = () => resolve() })
  recorder.start()

  // Frames are handed to the recorder on a wall-clock schedule, not as fast as
  // they render. MediaRecorder timestamps each frame when it arrives, so a
  // loop rendered in 0.9s would otherwise become a 0.9s video however many
  // frames it contained, and play back too fast.
  const startedAt = performance.now()
  const interval = 1000 / fps

  for (let k = 0; k < frames; k++) {
    if (signal?.cancelled) break
    const { phase, anim } = timeline.at(k)
    composite(engine, doc, phase, width, height, canvas, false, anim)
    const due = startedAt + k * interval
    const waitFor = due - performance.now()
    // The wait doubles as the yield that lets the progress bar paint; without
    // it the whole export happens inside one frame and the UI looks hung.
    await new Promise((r) => setTimeout(r, Math.max(0, waitFor)))
    track.requestFrame()
    onProgress({ done: k + 1, total: frames, label: 'Rendering' })
  }

  // Judged on the whole run rather than any single frame: one slow frame is
  // invisible, but a render that is consistently behind stretches the clip.
  const lagged = performance.now() - startedAt > (frames / fps) * 1000 * 1.1

  recorder.stop()
  await finished
  if (signal?.cancelled) return { error: 'Export cancelled.' }

  const blob = new Blob(chunks, { type: support.mime })
  const buf = await blob.arrayBuffer()
  onProgress({ done: frames, total: frames, label: 'Writing' })
  return { base64: bytesToBase64(new Uint8Array(buf)), ext: support.ext, lagged }
}

function bytesToBase64(bytes: Uint8Array): string {
  let out = ''
  // Chunked because String.fromCharCode with a few million arguments blows the
  // call stack, and a 4K export is exactly that size.
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    out += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(out)
}

type CanvasCaptureMediaStreamTrack = MediaStreamTrack & { requestFrame: () => void }

export function cardCount(doc: MotionDoc): number {
  return cardCountFor(doc)
}
