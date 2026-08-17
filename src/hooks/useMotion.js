// ── Motion primitives for the monthly report ──────────────────
// The report is meant to feel alive rather than merely animated, which
// puts a lot of movement on screen at once. Three rules hold that
// together and every hook here obeys them:
//
//   1. One listener, one observer — shared across the whole report
//      rather than one per element, because a hundred scroll handlers
//      is how a page starts to stutter.
//   2. Nothing off screen animates. The observer that reveals a
//      section is the same one that tells it to stop.
//   3. Reduced motion is not a lesser animation, it is none: the final
//      value, immediately.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

// ── Does this device want stillness? ──────────────────────────
// Read through useSyncExternalStore so switching the OS setting takes
// effect without a reload.
const QUERY = '(prefers-reduced-motion: reduce)'
const mql = () => (typeof matchMedia === 'function' ? matchMedia(QUERY) : null)

const subscribeMotion = (cb) => {
  const m = mql()
  if (!m) return () => {}
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}

export const prefersReducedMotion = () => !!mql()?.matches

export function useReducedMotion() {
  return useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => false)
}

// ── Counting a number up ──────────────────────────────────────
// Starts only when `run` turns true, so the number climbs as its
// section arrives rather than having finished before it was ever seen.
//
// Eases out: fast off the mark and settling at the end, which reads as
// a number landing rather than a progress bar filling.
const easeOut = (t) => 1 - Math.pow(1 - t, 3)

export function useCountUp(value, { run = true, duration = 1100, decimals = 0 } = {}) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(reduced || !run ? value : 0)
  const frame = useRef(0)

  useEffect(() => {
    if (reduced || !run) { setShown(value); return }
    if (!Number.isFinite(value)) { setShown(value); return }

    const from = 0
    const start = performance.now()
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const v = from + (value - from) * easeOut(t)
      setShown(decimals ? Math.round(v * 10 ** decimals) / 10 ** decimals : Math.round(v))
      if (t < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [value, run, duration, decimals, reduced])

  return shown
}

// ── Revealing a section when it arrives ───────────────────────
// Returns [ref, revealed]. Once a section has been seen it stays
// revealed — re-playing an entrance every time the user scrolls back
// is a fidget, not a flourish. `active` is separate: it tracks whether
// the section is on screen *right now*, and is what switches the
// continuous animations off once it leaves.
export function useReveal({ rootMargin = '0px 0px -12% 0px', threshold = 0.15 } = {}) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const [revealed, setRevealed] = useState(reduced)
  const [active, setActive] = useState(reduced)

  useEffect(() => {
    if (reduced) { setRevealed(true); setActive(true); return }
    const el = ref.current
    if (!el || typeof IntersectionObserver !== 'function') { setRevealed(true); setActive(true); return }

    const io = new IntersectionObserver(([entry]) => {
      setActive(entry.isIntersecting)
      if (entry.isIntersecting) setRevealed(true)
    }, { rootMargin, threshold })

    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin, threshold, reduced])

  return [ref, revealed, active]
}

// ── Scroll position as a CSS variable ─────────────────────────
// One listener for the whole report, throttled to a frame, writing a
// single 0-1 custom property. Everything that reacts to scrolling —
// the rail, the parallax on the cover — is then plain CSS reading
// var(--scroll), so scrolling costs one style write rather than a
// React render per pixel.
export function useScrollProgress(scrollerRef, { onProgress } = {}) {
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    if (reduced) { el.style.setProperty('--scroll', '0'); return }

    let frame = 0
    const measure = () => {
      frame = 0
      const max = el.scrollHeight - el.clientHeight
      const p = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0
      el.style.setProperty('--scroll', p.toFixed(4))
      onProgress?.(p)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure) }

    measure()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [scrollerRef, onProgress, reduced])
}

// ── A step sequence ───────────────────────────────────────────
// Drives the opening: each call advances one step on a timer, so the
// intro can be written as a list of stages instead of nested timeouts.
// Under reduced motion it jumps straight to the end.
export function useSequence(steps, { run = true, interval = 700 } = {}) {
  const reduced = useReducedMotion()
  const [step, setStep] = useState(reduced ? steps : 0)

  useEffect(() => {
    if (reduced) { setStep(steps); return }
    if (!run) return
    let n = 0
    const id = setInterval(() => {
      n += 1
      setStep(n)
      if (n >= steps) clearInterval(id)
    }, interval)
    return () => clearInterval(id)
  }, [steps, run, interval, reduced])

  return step
}
