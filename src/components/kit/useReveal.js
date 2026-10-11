import { useLayoutEffect, useRef, useState } from 'react'
import { animate, reducedMotion } from '../../motion.js'

// ── An exercise's picture comes in softly ─────────────────────
//
// Phase 5 (the plan's «اقتراح 7»). While a picture or a demo loop is
// still on its way, its place carries a faint light that crosses it every
// 1.2s (data-wait, kit.css); when it arrives it fades in over 200ms
// instead of popping. One already in the phone shows at once, with no
// light and no fade: decoded by the time it mounts, or arriving within
// QUICK_MS — a cached file still loads a beat after its element (and a
// lazy one only once it is laid out), so the light is only switched on
// once QUICK_MS has passed without the picture. Reduced motion: the place
// stays still and the picture simply appears.
//
// Spread the returned props on the <img> or <video>:
//   const reveal = useReveal(src)
//   <img src={src} {...reveal} />

const QUICK_MS = 120

export function useReveal(src) {
  const ref = useRef(null)
  const [waiting, setWaiting] = useState(false)
  // This showing of `src`: arrived yet, when it began, the light's timer.
  const st = useRef({ arrived: false, at: 0, timer: 0 })

  // Before paint, for every new picture: one already there is simply
  // there; one on its way gets the light if it is not here in QUICK_MS.
  useLayoutEffect(() => {
    const el = ref.current
    const s = st.current
    clearTimeout(s.timer)
    if (!el) return
    const ready = el.tagName === 'VIDEO' ? el.readyState >= 2 : (el.complete && el.naturalWidth > 0)
    s.arrived = ready
    s.at = performance.now()
    setWaiting(false)
    if (!ready) s.timer = setTimeout(() => { if (!s.arrived) setWaiting(true) }, QUICK_MS)
    // An error is the caller's (each falls to the next rung of its
    // ladder, which is a new `src`); the light goes with it.
    const failed = () => { s.arrived = true; clearTimeout(s.timer); setWaiting(false) }
    el.addEventListener('error', failed)
    return () => { clearTimeout(s.timer); el.removeEventListener('error', failed) }
  }, [src])

  const arrived = () => {
    const el = ref.current
    const s = st.current
    if (!el || s.arrived) return
    s.arrived = true
    clearTimeout(s.timer)
    const quick = performance.now() - s.at < QUICK_MS
    if (!quick && !reducedMotion()) animate(el, [{ opacity: 0 }, { opacity: 1 }], { d: 200, e: 'ease-out' })
    setWaiting(false)
  }

  return {
    ref,
    'data-wait': waiting ? '1' : undefined,
    onLoad: arrived,
    onLoadedData: arrived,
  }
}
