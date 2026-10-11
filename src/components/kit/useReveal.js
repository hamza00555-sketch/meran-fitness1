import { useLayoutEffect, useRef, useState } from 'react'
import { animate, reducedMotion } from '../../motion.js'

// ── An exercise's picture comes in softly ─────────────────────
//
// Phase 5 (the plan's «اقتراح 7»). While a picture or a demo loop is
// still on its way, its place carries a faint light that crosses it every
// 1.2s (data-wait, kit.css); when it arrives it fades in over 200ms
// instead of popping. One already in the phone — decoded by the time it
// mounts, or arriving within QUICK_MS (a cached file still loads a beat
// later than its element) — shows at once, with no light and no fade:
// the light starts off the picture's edge, so it never flashes for one
// that is quick. Reduced motion: the place stays still and the picture
// simply appears.
//
// Spread the returned props on the <img> or <video>:
//   const reveal = useReveal(src)
//   <img src={src} {...reveal} />

const QUICK_MS = 120

export function useReveal(src) {
  const ref = useRef(null)
  const [waiting, setWaiting] = useState(true)
  const instant = useRef(false)
  const mountedAt = useRef(0)

  // Before paint: a picture already there never shows the waiting light.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ready = el.tagName === 'VIDEO' ? el.readyState >= 2 : (el.complete && el.naturalWidth > 0)
    instant.current = ready
    mountedAt.current = performance.now()
    setWaiting(!ready)
  }, [src])

  const arrived = () => {
    const el = ref.current
    if (!el || instant.current) return
    instant.current = true
    const quick = performance.now() - mountedAt.current < QUICK_MS
    if (!quick && !reducedMotion()) animate(el, [{ opacity: 0 }, { opacity: 1 }], { d: 200, e: 'ease-out' })
    setWaiting(false)
  }

  // An error is the caller's (each falls to the next rung of its ladder);
  // the light goes with it.
  return {
    ref,
    'data-wait': waiting ? '1' : undefined,
    onLoad: arrived,
    onLoadedData: arrived,
  }
}
