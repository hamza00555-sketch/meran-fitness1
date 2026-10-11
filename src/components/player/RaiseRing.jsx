import { useEffect, useState } from 'react'

// ── «Add weight», drawn on the number itself ──────────────────
//
// The ring goes around the one thing the advice is about: the weight
// field, which already shows the raised number in gold.
//
// Two strokes start at the bottom centre and climb both sides to meet at
// the top (two lines rising reads as "up"; one line circling reads as
// "loading"). The first time an exercise shows the reminder the ring
// draws in 900ms, half a second into it; after that it is simply there.
// Then it breathes — a slow dim and back, every 2.4s — until the lifter
// touches the number (حمزة: «تبقى لين ألمس الرقم»), and is still from
// then on. Put back with «خلّها 75», it withdraws down the way it came
// (300ms); raised again by hand, it redraws quickly (600ms).
//
// Reduced motion: whole and still, from the first frame (the CSS).
//
// Real pixels are needed for the corner arcs, so the host is measured,
// and its radius read from computed style rather than typed here.

const INSET = 1          // half the stroke, so the line sits fully inside

/** One half of the ring: bottom centre up to top centre, on one side. */
function half(w, h, r, dir) {
  const cx = w / 2
  const x  = cx + dir * (w / 2 - INSET)
  const y0 = h - INSET, y1 = INSET
  const rr = Math.max(0, Math.min(r - INSET, (w / 2 - INSET), (h / 2 - INSET)))
  const sweep = dir > 0 ? 0 : 1
  return [
    `M ${cx} ${y0}`,
    `L ${x - dir * rr} ${y0}`,
    `A ${rr} ${rr} 0 0 ${sweep} ${x} ${y0 - rr}`,
    `L ${x} ${y1 + rr}`,
    `A ${rr} ${rr} 0 0 ${sweep} ${x - dir * rr} ${y1}`,
    `L ${cx} ${y1}`,
  ].join(' ')
}

/**
 * draw: 'full' (the first showing: 900ms after `drawDelay` ms), 'quick'
 * (raised again by hand: 600ms), or null (already whole).
 * breathe: dim-and-back until touched, starting `breatheDelay` ms from now.
 * retract: withdraw (300ms) — the ring is on its way out.
 */
export default function RaiseRing({ hostRef, draw = null, drawDelay = 0, breathe = false, breatheDelay = 0, retract = false }) {
  const [box, setBox] = useState(null)
  // The delays are fixed when the ring appears: a CSS animation whose
  // delay changes mid-run jumps, and the ring re-renders with every step.
  const [delays] = useState(() => ({ draw: Math.max(0, Math.round(drawDelay)), breathe: Math.round(breatheDelay) }))

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const measure = () => {
      const cs = getComputedStyle(el)
      const bw = parseFloat(cs.borderLeftWidth) || 0
      const r = Math.max(0, (parseFloat(cs.borderTopLeftRadius) || 0) - bw)
      setBox({ w: el.clientWidth, h: el.clientHeight, r })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hostRef])

  if (!box || box.w < 40 || box.h < 30) return null
  const { w, h, r } = box
  const mode = retract ? ' s-raise-retract' : draw === 'full' ? ' s-raise-draw' : draw === 'quick' ? ' s-raise-quick' : ''

  return (
    <svg
      className={`raise-ring s-raise-ring${mode}${breathe && !retract ? ' s-raise-breathe' : ''}`}
      data-testid="raise-ring"
      data-state={retract ? 'retract' : breathe ? 'breathe' : 'still'}
      aria-hidden="true"
      width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ '--ring-delay': `${delays.draw}ms`, '--breathe-delay': `${delays.breathe}ms` }}
    >
      {[1, -1].map(dir => (
        <path
          key={dir}
          className="s-raise-path"
          d={half(w, h, r, dir)}
          pathLength="100"
          fill="none"
          stroke="var(--raise)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}
