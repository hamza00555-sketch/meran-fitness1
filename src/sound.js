// ── Sound: short library sounds, played through Web Audio ─────
//
// Every sound the app makes is a file in public/sounds/ (Kenney's CC0
// interface and impact packs — see public/sounds/LICENSES.md), never a
// synthesized beep. Each exists as .m4a and .mp3; the browser gets the
// one it can decode, and the other if decoding fails.
//
// iOS only lets a page make sound from an AudioContext created or
// resumed inside a tap. So there is one context for the whole app,
// unlocked by the first tap anywhere (and by every tap that leads to a
// sound — «تمّت المجموعة», the steppers, ±15), and the files are fetched
// and decoded then, not at page load. A sound asked for before its file
// is decoded still plays, as long as its moment hasn't passed.
//
// The phone's mute: Web Audio on an iPhone follows the ringer switch —
// the audio session is set to «transient», which ducks the lifter's
// music for a moment instead of stopping it and stays silent when the
// phone is on silent. Android plays at the media volume. Elsewhere the
// platform has no mute to respect.
//
// Nothing here ever throws: no AudioContext, no fetch, a file that won't
// decode — each is a quiet no-op.

export const SOUNDS = {
  'set-done':    { gain: 0.6 },    // every set: very short, subtle
  'pr':          { gain: 0.85 },   // the personal record
  'raise':       { gain: 0.55 },   // «ارفع الوزن», soft
  'rest-tick':   { gain: 0.75 },   // rest −3 / −2 / −1
  'rest-end':    { gain: 0.9 },    // rest at zero
  'medal':       { gain: 0.8 },    // a medal lands
  'medal-heavy': { gain: 0.8 },    // a rare / epic / legendary one
  'new-weight':  { gain: 0.6 },    // the monthly report's new heaviest weight
}

/** The ones a session uses, decoded on the first tap. The rest load when asked for. */
const SESSION = ['set-done', 'rest-tick', 'rest-end', 'pr', 'raise']

let ctx = null
const buffers = new Map()     // name → AudioBuffer
const loading = new Map()     // name → Promise<AudioBuffer|null>

const base = (() => {
  try { return import.meta.env?.BASE_URL || '/' } catch { return '/' }
})()

/** m4a first where AAC decodes (Safari, Chrome on phones), else mp3. */
function formats() {
  try {
    const a = document.createElement('audio')
    const aac = a.canPlayType?.('audio/mp4; codecs="mp4a.40.2"')
    return aac ? ['m4a', 'mp3'] : ['mp3', 'm4a']
  } catch { return ['mp3', 'm4a'] }
}

function decode(c, data) {
  return new Promise((resolve, reject) => {
    try {
      const p = c.decodeAudioData(data, resolve, reject)   // old Safari: callbacks only
      if (p && typeof p.then === 'function') p.then(resolve, reject)
    } catch (e) { reject(e) }
  })
}

/** Fetch and decode one sound. Resolves to the buffer, or null — never rejects. */
export function load(name) {
  if (buffers.has(name)) return Promise.resolve(buffers.get(name))
  if (loading.has(name)) return loading.get(name)
  const c = ctx
  if (!c || typeof c.decodeAudioData !== 'function' || typeof fetch !== 'function' || !SOUNDS[name]) {
    return Promise.resolve(null)
  }
  const p = (async () => {
    for (const ext of formats()) {
      try {
        const res = await fetch(`${base}sounds/${name}.${ext}`)
        if (!res.ok) continue
        const buf = await decode(c, await res.arrayBuffer())
        if (buf) { buffers.set(name, buf); return buf }
      } catch { /* try the other format */ }
    }
    return null
  })()
  loading.set(name, p)
  // A failure is not remembered for good: the next unlock may be online.
  p.then(b => { if (!b) loading.delete(name) })
  return p
}

/**
 * Create or wake the shared context. Call it from inside a tap; it is
 * also what the first tap anywhere in the app does by itself.
 */
export function unlock() {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      const r = ctx.resume()
      if (r && typeof r.catch === 'function') r.catch(() => {})
    }
    // Duck the music instead of stopping it, and stay silent on silent.
    try { if (navigator.audioSession) navigator.audioSession.type = 'transient' } catch {}
    // Older iOS only unlocks after something has played inside the tap.
    if (!unlock.primed && typeof ctx.createBuffer === 'function' && typeof ctx.createBufferSource === 'function') {
      unlock.primed = true
      try {
        const src = ctx.createBufferSource()
        src.buffer = ctx.createBuffer(1, 1, 22050)
        src.connect(ctx.destination)
        src.start(0)
      } catch {}
    }
    for (const n of SESSION) load(n)
  } catch { ctx = null }
  return ctx
}

export const context = () => ctx
export const unlocked = () => !!ctx && ctx.state !== 'closed'
export const running = () => !!ctx && ctx.state === 'running'

// A sound asked for "now" that is still decoding plays late by at most
// this much; later than that it is dropped (a late click is worse than none).
const LATE_OK = 0.25

/**
 * Play a sound `at` seconds from now (on the audio clock), or at the
 * absolute context time `when`. Returns a cancel function; with no audio
 * it returns a no-op. `fallback(c, t)` may draw something itself when the
 * file can't be had (the rest's ticks keep a plain tone for that case).
 */
export function play(name, { at = 0, when = null, gain = null, fallback = null } = {}) {
  const c = ctx
  if (!c || c.state === 'closed' || !SOUNDS[name]) return () => {}
  let cancelled = false
  let node = null
  let extra = null
  const t0 = when != null ? when : (c.currentTime || 0) + Math.max(0, at)
  const start = (buf) => {
    if (cancelled) return
    const now = c.currentTime || 0
    if (t0 < now - LATE_OK) return
    try {
      if (!buf) { if (fallback) extra = fallback(c, Math.max(t0, now)); return }
      const src = c.createBufferSource()
      const g = c.createGain()
      src.buffer = buf
      g.gain.value = gain ?? SOUNDS[name].gain
      src.connect(g)
      g.connect(c.destination)
      src.start(Math.max(t0, now))
      node = { src, g }
    } catch {}
  }
  const ready = buffers.get(name)
  if (ready) start(ready)
  else load(name).then(start)
  return () => {
    cancelled = true
    if (node) {
      try { node.g.disconnect() } catch {}
      try { node.src.stop() } catch {}
    }
    if (typeof extra === 'function') { try { extra() } catch {} }
  }
}

// The first tap anywhere unlocks the context and starts the decoding,
// so the first set's sound is ready by the time it is needed.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const events = ['pointerdown', 'touchend', 'keydown']
  const first = () => {
    // Not every keydown is a gesture the browser accepts (Escape isn't).
    try { if (navigator.userActivation && !navigator.userActivation.isActive) return } catch {}
    unlock()
    if (running()) events.forEach(e => document.removeEventListener(e, first, true))
  }
  events.forEach(e => document.addEventListener(e, first, { capture: true, passive: true }))
}
