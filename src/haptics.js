// ── Haptics: a tap you can feel ───────────────────────────────
//
// Android has navigator.vibrate. iPhones have no vibration API in any
// browser — but since iOS 18, Safari gives a real haptic tick when a
// switch control (<input type="checkbox" switch>) is toggled, and a
// label.click() inside a tap toggles it. So on an iPhone a hidden switch
// is flipped, in the same tap that asked for the haptic; outside a tap
// (a timer, the end of a rest) iOS gives nothing, and that is fine: the
// haptic is an extra, never the only signal.
//
// Everywhere else (desktop, older iOS, no DOM) every call is a no-op and
// none of them ever throws.
//
//   set    — every «تمّت المجموعة»: one short tick
//   pr     — a personal record: two pulses
//   swipe  — moving to the next exercise by swiping: the lightest tick
//   rest   — the rest is over (Android only; it never comes from a tap)
//   medal       — a medal lands in the session summary: one light pulse
//   medal-heavy — an epic or legendary one lands heavy: a firmer double
//                 (both are timed by the reveal, not a tap, so on an iPhone
//                 they are felt only when the landing is a tap's — a skip)

const PATTERNS = {
  set:   { vibrate: 12,             ticks: 1 },
  pr:    { vibrate: [12, 70, 28],   ticks: 2 },
  swipe: { vibrate: 8,              ticks: 1 },
  rest:  { vibrate: [180, 80, 180], ticks: 0 },
  medal: { vibrate: 14,             ticks: 1 },
  'medal-heavy': { vibrate: [24, 60, 40], ticks: 2 },
}

const hasVibrate = () => {
  try { return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' } catch { return false }
}

const isIOS = () => {
  try {
    const ua = navigator.userAgent || ''
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  } catch { return false }
}

/** One iOS haptic tick: flip a hidden switch, then take it away. */
function switchTick() {
  if (typeof document === 'undefined' || !document.body) return
  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.display = 'none'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.tabIndex = -1
  label.appendChild(input)
  document.body.appendChild(label)
  try { label.click() } finally { label.remove() }
}

/** Fire a named haptic. Call it from inside the tap for iOS to feel it. */
export function haptic(kind = 'set') {
  const p = PATTERNS[kind] || PATTERNS.set
  try {
    if (hasVibrate()) { navigator.vibrate(p.vibrate); return }
    if (!p.ticks || !isIOS()) return
    switchTick()
    for (let i = 1; i < p.ticks; i++) setTimeout(() => { try { switchTick() } catch {} }, 90 * i)
  } catch {}
}
