import { useEffect, useState } from 'react'

// ── The card says "add weight" with its edge ──────────────────
//
// The advice to raise the weight used to be one chip among seven, in
// the same gold as the best-weight chip beside it, and it went unseen
// mid-set. Now the card itself carries it: a gold stroke starts at the
// bottom centre, climbs both sides at once and meets at the top, then
// stays — breathing slowly — for as long as the advice stands. Drawn
// once so it is noticed; kept so it is not missed by looking away at
// the wrong second.
//
// Two mirrored paths rather than one loop, because two lines rising to
// meet reads as "up" and a single line circling reads as "loading".
//
// Real pixels are needed for the corner arcs, so the host card is
// measured. The radius is read from the card's computed style rather
// than typed here, so the ring follows the deload mode's rounder
// corners without knowing the mode exists.

const INSET = 1.5          // half the stroke, so the line sits fully inside

/** One half of the ring: bottom centre up to top centre, on one side. */
function half(w, h, r, dir) {
  // dir = +1 draws the right-hand side, -1 the left. Everything is
  // measured from the centre line so both halves are one formula.
  const cx = w / 2
  const x  = cx + dir * (w / 2 - INSET)          // the side edge
  const y0 = h - INSET, y1 = INSET                // bottom and top edges
  const rr = Math.max(0, Math.min(r - INSET, (w / 2 - INSET), (h / 2 - INSET)))
  const sweep = dir > 0 ? 0 : 1                   // arc direction flips with the side
  return [
    `M ${cx} ${y0}`,
    `L ${x - dir * rr} ${y0}`,
    `A ${rr} ${rr} 0 0 ${sweep} ${x} ${y0 - rr}`,
    `L ${x} ${y1 + rr}`,
    `A ${rr} ${rr} 0 0 ${sweep} ${x - dir * rr} ${y1}`,
    `L ${cx} ${y1}`,
  ].join(' ')
}

export default function RaiseRing({ hostRef }) {
  const [box, setBox] = useState(null)

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      const r = parseFloat(getComputedStyle(el).borderRadius) || 0
      setBox({ w: rect.width, h: rect.height, r })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hostRef])

  if (!box || box.w < 40 || box.h < 40) return null
  const { w, h, r } = box

  return (
    <svg
      className="raise-ring"
      data-testid="raise-ring"
      aria-hidden="true"
      width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        overflow: 'visible',
      }}
    >
      {[1, -1].map(dir => (
        <path
          key={dir}
          className="raise-ring-path"
          d={half(w, h, r, dir)}
          pathLength="100"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}
