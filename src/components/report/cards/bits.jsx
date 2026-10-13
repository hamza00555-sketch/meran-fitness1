// ── Small pieces the report's cards share ─────────────────────
// A number that counts to its value once, the dust that floats in the
// cover's floodlight, a film grain, and the few drawn marks (✕, the
// arrows) the icon family has no match for.

import { useEffect, useRef, useState } from 'react'
import { reducedMotion } from '../../../motion.js'

const fmt = (v, dec) => Number(v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

/**
 * Counts from `from` to `to` once `run` turns true (after `delay` ms,
 * over `dur` ms). `ease="lin"` steps one whole number at a time, in step
 * with the cover's dashes lighting one by one. Reduced motion, or not
 * running: the final number, still.
 */
export function CountTo({ to, from = 0, dec = 0, dur = 900, delay = 0, ease = 'out', run = true }) {
  const [v, setV] = useState(() => (run && !reducedMotion() ? from : to))
  useEffect(() => {
    if (!run || reducedMotion() || !Number.isFinite(to)) { setV(to); return }
    let raf = 0
    setV(from)
    const span = to - from
    const ez = ease === 'lin' ? (t) => Math.floor(t * span) / (span || 1) : easeOutExpo
    const timer = setTimeout(() => {
      const t0 = performance.now()
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur)
        setV(from + span * ez(t))
        if (t < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delay)
    return () => { clearTimeout(timer); cancelAnimationFrame(raf) }
  }, [to, from, dur, delay, ease, run]) // eslint-disable-line react-hooks/exhaustive-deps
  return <>{fmt(v, dec)}</>
}

// ── Unique ids for SVG gradients and clips ─────────────────────
// React's useId has colons, which url(#…) would need escaped.
let uid = 0
export function useSvgId(prefix = 'rs') {
  const ref = useRef(null)
  if (ref.current == null) ref.current = `${prefix}${++uid}`
  return ref.current
}

// ── Dust in the floodlight ─────────────────────────────────────
// Specks drifting up through the beam, brightest where the light is.
// Only moves while `moving` (the story's cover on screen); otherwise it
// is drawn once, still. Never more than one loop per canvas.
export function Dust({ moving = false }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv || typeof cv.getContext !== 'function') return
    const P = []
    for (let i = 0; i < 46; i++) {
      const r = Math.random()
      P.push({ x: 0.5 + (Math.random() - 0.5) * (0.25 + 0.6 * r), y: Math.random(), s: 0.4 + Math.random() * 1.3, v: 0.004 + Math.random() * 0.012, w: Math.random() * 6.28 })
    }
    let raf = 0, last = 0
    const draw = (dt) => {
      const w = cv.clientWidth, h = cv.clientHeight
      if (!w || !h) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr) }
      const c = cv.getContext('2d')
      if (!c) return
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      c.clearRect(0, 0, w, h)
      for (const p of P) {
        if (dt) { p.y -= p.v * dt; p.w += dt * 0.6; if (p.y < -0.02) { p.y = 1.02; p.x = 0.5 + (Math.random() - 0.5) * 0.7 } }
        const x = p.x + Math.sin(p.w) * 0.012
        const hw = 0.07 + 0.4 * p.y
        let a = Math.max(0, 1 - Math.abs(x - 0.5) / hw)
        a = Math.pow(a, 1.4) * (1 - p.y * 0.55) * 0.7
        if (a <= 0.01) continue
        c.beginPath()
        c.arc(x * w, p.y * h, p.s, 0, 6.283)
        c.fillStyle = `rgba(244,246,248,${a.toFixed(3)})`
        c.fill()
      }
    }
    const loop = (now) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      draw(dt)
      raf = requestAnimationFrame(loop)
    }
    if (moving && !reducedMotion()) raf = requestAnimationFrame(loop)
    else raf = requestAnimationFrame(() => draw(0))
    return () => cancelAnimationFrame(raf)
  }, [moving])
  return <canvas ref={ref} className="dust" aria-hidden="true" />
}

/** A film grain, made once, as a CSS variable on the story layer. */
let grain = null
export function grainUrl() {
  if (grain !== null) return grain
  grain = ''
  try {
    const g = document.createElement('canvas')
    g.width = g.height = 96
    const c = g.getContext('2d')
    const d = c.createImageData(96, 96)
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.random() * 255
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v
      d.data[i + 3] = 10
    }
    c.putImageData(d, 0, 0)
    grain = `url(${g.toDataURL()})`
  } catch { grain = '' }
  return grain
}

// ── Drawn marks ────────────────────────────────────────────────
export const XMark = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></svg>
)

/** «+12.5», its sign on the left of its digits in any context. */
export function Plus({ kg }) {
  const v = Math.round(Number(kg) * 10) / 10
  return <bdi dir="ltr" className="k-num gain-plus">{`+${v.toLocaleString('en-US')}`}</bdi>
}
