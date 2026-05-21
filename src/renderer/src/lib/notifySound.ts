// Tiny synthesized "ding" played when something needs the user's attention.
// Uses Web Audio so we don't have to ship an asset. Two short notes (E5 → A5)
// with a soft envelope; deliberately quiet so it's not annoying.
//
// Throttled to once every 5s so a burst of events doesn't sound like an alarm.

let ctx: AudioContext | null = null
let lastPlayedAt = 0

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      if (!Ctor) return null
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}

function note(c: AudioContext, freq: number, startAt: number, durationMs: number, gain: number): void {
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  // Quick attack, gentle decay
  g.gain.setValueAtTime(0, startAt)
  g.gain.linearRampToValueAtTime(gain, startAt + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000)
  osc.connect(g).connect(c.destination)
  osc.start(startAt)
  osc.stop(startAt + durationMs / 1000 + 0.05)
}

export function playAttentionChime(): void {
  const now = Date.now()
  if (now - lastPlayedAt < 5000) return
  lastPlayedAt = now

  const c = getCtx()
  if (!c) return
  const t0 = c.currentTime + 0.01
  // E5 → A5, 140ms each, low volume
  note(c, 659.25, t0,         140, 0.08)
  note(c, 880.00, t0 + 0.10,  180, 0.08)
}
