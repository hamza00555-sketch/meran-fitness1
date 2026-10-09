// ── Rest you can hear without looking ─────────────────────────
//
// iOS only lets a page make sound from an AudioContext that was created
// or resumed inside a tap. The old beep built a fresh context from a
// timer, outside any tap, and could start suspended and stay silent.
//
// So: one context for the whole app, primed by the «تمّت المجموعة» tap
// (and any stepper press). In that same tap the rest starts, and its
// tones are scheduled ahead on the audio clock — three short 660Hz ticks
// at −3/−2/−1s and an 880Hz end tone at zero — so they play on time even
// if the JS timers are throttled. ±15 and skip cancel and reschedule.
// Vibration is an extra, never the signal: iPhones have none on the web.

let ctx = null

/** Create or wake the shared context. Call it from inside a user tap. */
export function primeAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    // Duck the lifter's music instead of stopping it, where supported.
    try { if (navigator.audioSession) navigator.audioSession.type = 'transient' } catch {}
  } catch { ctx = null }
  return ctx
}

export const audioPrimed = () => !!ctx && ctx.state !== 'closed'

/**
 * Schedule the rest tones for a rest ending `secondsLeft` from now.
 * Returns a cancel function.
 */
export function scheduleRestTones(secondsLeft) {
  if (!ctx || ctx.state === 'closed' || !(secondsLeft > 0)) return () => {}
  const now = ctx.currentTime
  const nodes = []
  const tone = (at, freq, dur, peak) => {
    if (at < 0.05) return
    try {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      o.connect(g)
      g.connect(ctx.destination)
      const t = now + at
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(peak, t + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.start(t)
      o.stop(t + dur + 0.03)
      nodes.push([o, g])
    } catch {}
  }
  for (const k of [3, 2, 1]) tone(secondsLeft - k, 660, 0.11, 0.28)
  tone(secondsLeft, 880, 0.5, 0.38)
  return () => {
    for (const [o, g] of nodes) {
      try { g.disconnect() } catch {}
      try { o.stop() } catch {}
    }
  }
}

/** A short chime now — for a rest that ended with nothing scheduled. */
export function chimeNow() {
  if (!ctx || ctx.state !== 'running') return false
  const cancel = scheduleRestTones(0.06)
  void cancel
  return true
}
