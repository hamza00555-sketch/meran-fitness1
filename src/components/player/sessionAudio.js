// ── Rest you can hear without looking ─────────────────────────
//
// iOS only lets a page make sound from an AudioContext that was created
// or resumed inside a tap. The old beep built a fresh context from a
// timer, outside any tap, and could start suspended and stay silent.
//
// So: one context for the whole app (src/sound.js), primed by the
// «تمّت المجموعة» tap (and any stepper press). In that same tap the rest
// starts, and its sounds are scheduled ahead on the audio clock — the
// library's short tick at −3/−2/−1s and its end chime at zero — so they
// play on time even if the JS timers are throttled. ±15 and skip cancel
// and reschedule. Vibration is an extra, never the signal: iPhones have
// none on the web.
//
// The sounds are files (public/sounds), decoded on the first tap. If a
// file can't be had at all (offline before it was ever cached, a codec
// the phone lacks), the rest keeps a plain tone in its place: the end of
// a rest is a signal, not a flourish.

import { unlock, unlocked, running, play } from '../../sound.js'

/** Create or wake the shared context. Call it from inside a user tap. */
export function primeAudio() {
  return unlock()
}

export const audioPrimed = () => unlocked()

// The tone a rest falls back to when its file is missing — the old
// 660Hz tick and 880Hz end, unchanged.
const toneFallback = (freq, dur, peak) => (c, t) => {
  try {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    o.connect(g)
    g.connect(c.destination)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.start(t)
    o.stop(t + dur + 0.03)
    return () => { try { g.disconnect() } catch {} try { o.stop() } catch {} }
  } catch { return null }
}
const TICK = toneFallback(660, 0.11, 0.28)
const END = toneFallback(880, 0.5, 0.38)

/**
 * Schedule the rest sounds for a rest ending `secondsLeft` from now.
 * Returns a cancel function.
 */
export function scheduleRestTones(secondsLeft) {
  if (!unlocked() || !(secondsLeft > 0)) return () => {}
  const cancels = []
  const at = (s, name, fallback) => {
    if (s < 0.05) return
    cancels.push(play(name, { at: s, fallback }))
  }
  for (const k of [3, 2, 1]) at(secondsLeft - k, 'rest-tick', TICK)
  at(secondsLeft, 'rest-end', END)
  return () => cancels.forEach(c => c())
}

/** The end chime now — for a rest that ended with nothing scheduled. */
export function chimeNow() {
  if (!running()) return false
  play('rest-end', { at: 0.06, fallback: END })
  return true
}
